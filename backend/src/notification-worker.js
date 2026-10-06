"use strict";

const crypto = require("node:crypto");
const { visibleAudiences, DEFAULT_PREFERENCES, emailEligible, decryptToken, deliveryOutcome, eventEmail } = require("./notification-policy");
const { renderEmail } = require("./email-templates");

function createWorker({ pool, mail, transport, now = () => new Date(), log = () => {} }) {
  async function finish(job, state, errorCode = null) {
    const [result] = await pool.execute(`UPDATE notification_email_outbox SET state = ?, error_code = ?, encrypted_payload = NULL,
      finished_at = UTC_TIMESTAMP(), accepted_at = CASE WHEN ? = 'accepted' THEN UTC_TIMESTAMP() ELSE NULL END,
      lease_token = NULL, lease_expires_at = NULL WHERE job_id = ? AND state = 'sending' AND lease_token = ?`,
    [state, errorCode, state, job.job_id, job.lease_token]);
    if (result.affectedRows) log({ job_id: job.job_id, state, attempt_count: job.attempt_count, error_code: errorCode });
  }

  async function claim() {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(`SELECT * FROM notification_email_outbox
        WHERE (state = 'pending' AND next_attempt_at <= UTC_TIMESTAMP())
          OR (state = 'sending' AND lease_expires_at <= UTC_TIMESTAMP())
        ORDER BY job_id LIMIT 1 FOR UPDATE SKIP LOCKED`);
      if (!rows.length) { await connection.commit(); return null; }
      const job = rows[0];
      job.lease_token = crypto.randomUUID();
      // A crash during the final send must not allow a seventh attempt.
      if (job.attempt_count >= 6) {
        await connection.execute(`UPDATE notification_email_outbox SET state = 'failed', encrypted_payload = NULL,
          finished_at = UTC_TIMESTAMP(), error_code = 'ATTEMPTS_EXHAUSTED', lease_token = NULL, lease_expires_at = NULL WHERE job_id = ?`, [job.job_id]);
        await connection.commit(); return null;
      }
      job.attempt_count += 1;
      await connection.execute(`UPDATE notification_email_outbox SET state = 'sending', attempt_count = ?, lease_token = ?,
        lease_expires_at = UTC_TIMESTAMP() + INTERVAL 5 MINUTE WHERE job_id = ?`, [job.attempt_count, job.lease_token, job.job_id]);
      await connection.commit();
      return job;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async function messageFor(job) {
    if (job.template === "event") {
      const [rows] = await pool.execute(`SELECT u.email, m.role, n.audience, e.event_type,
        p.engagement_email, p.invoice_email, p.team_email, p.personal_access_email
        FROM notifications n JOIN notification_events e ON e.event_id = n.event_id AND e.organization_id = n.organization_id
        JOIN organization_memberships m ON m.organization_id = n.organization_id AND m.user_id = n.recipient_user_id
        JOIN users u ON u.user_id = m.user_id JOIN organizations o ON o.organization_id = m.organization_id
        LEFT JOIN notification_preferences p ON p.organization_id = m.organization_id AND p.user_id = m.user_id
        WHERE n.notification_id = ? AND n.organization_id = ? AND n.recipient_user_id = ?
          AND u.is_active = TRUE AND u.role = 'client' AND o.is_active = TRUE
          AND n.created_at > UTC_TIMESTAMP() - INTERVAL 90 DAY`,
      [job.notification_id, job.organization_id, job.recipient_user_id]);
      const row = rows[0];
      if (!row || !visibleAudiences(row.role).includes(row.audience)) return null;
      const preferences = Object.fromEntries(Object.entries(DEFAULT_PREFERENCES).map(([key, value]) => [key, row[key] == null ? value : Boolean(row[key])]));
      if (!emailEligible(row.event_type, row.audience, preferences)) return null;
      return { to: row.email, ...eventEmail(mail.baseUrl, job) };
    }
    const [rows] = await pool.execute(`SELECT i.invited_email, i.intended_role, o.name, i.token_hash,
      account.user_id, account.is_active AS account_active, account.role AS account_role
      FROM organization_invitations i JOIN organizations o ON o.organization_id = i.organization_id
      LEFT JOIN users account ON account.email = i.invited_email
      WHERE i.invitation_id = ? AND i.organization_id = ? AND i.status = 'pending'
        AND i.expires_at > UTC_TIMESTAMP() AND o.is_active = TRUE`, [job.invitation_id, job.organization_id]);
    const row = rows[0];
    if (!row || (row.user_id && (!row.account_active || row.account_role !== "client"))) return null;
    let url;
    if (row.user_id) {
      url = new URL("organization.html#received-heading", mail.baseUrl).href;
    } else {
      let token;
      try {
        token = decryptToken(job.encrypted_payload, mail.payloadKey);
        if (!/^[a-f0-9]{64}$/.test(token) || crypto.createHash("sha256").update(token).digest("hex") !== row.token_hash) throw new Error("Invalid invitation payload");
      } catch (_error) { throw Object.assign(new Error("Invalid invitation payload"), { code: "INVALID_PAYLOAD" }); }
      url = new URL(`accept-invitation.html?token=${token}`, mail.baseUrl).href;
    }
    return { to: row.invited_email, ...renderEmail({
      variant: row.user_id ? "existing-account-invitation" : "new-account-invitation",
      url, organizationName: row.name, intendedRole: row.intended_role,
    }) };
  }

  async function runOnce() {
    if (!mail.enabled) return false;
    const job = await claim();
    if (!job) return false;
    let message;
    try { message = await messageFor(job); }
    catch (error) {
      if (error.code === "INVALID_PAYLOAD") await finish(job, "failed", "INVALID_PAYLOAD");
      else await retry(job, {}, "DATABASE_TEMPORARY");
      return true;
    }
    if (!message) { await finish(job, "cancelled", "NO_LONGER_ELIGIBLE"); return true; }
    // Revocation can invalidate a claimed job while eligibility is being checked.
    const [live] = await pool.execute("SELECT job_id FROM notification_email_outbox WHERE job_id = ? AND state = 'sending' AND lease_token = ?", [job.job_id, job.lease_token]);
    if (!live.length) return true;
    try {
      const result = await transport.sendMail({ from: { name: "Oracle Red Labs", address: mail.from }, ...message,
        messageId: `<orl-${crypto.createHash("sha256").update(job.delivery_key).digest("hex")}@${new URL(mail.baseUrl).hostname}>` });
      if (!result.accepted?.length) throw Object.assign(new Error("Rejected"), { responseCode: 550 });
      await finish(job, "accepted");
    } catch (error) {
      await retry(job, error);
    }
    return true;
  }

  async function retry(job, error, code) {
    const outcome = deliveryOutcome(error, job.attempt_count, now());
    code = code || outcome.code;
    if (outcome.state === "failed") await finish(job, "failed", code);
    else {
      const [result] = await pool.execute(`UPDATE notification_email_outbox SET state = 'pending', error_code = ?, next_attempt_at = ?,
        lease_token = NULL, lease_expires_at = NULL WHERE job_id = ? AND state = 'sending' AND lease_token = ?`,
      [code, outcome.next, job.job_id, job.lease_token]);
      if (result.affectedRows) log({ job_id: job.job_id, state: "pending", attempt_count: job.attempt_count, error_code: code });
    }
  }

  async function cleanup() {
    // Clear secret payloads on invalid invitations even while sending is disabled.
    await pool.execute(`UPDATE notification_email_outbox j JOIN organization_invitations i ON i.invitation_id = j.invitation_id
      JOIN organizations o ON o.organization_id = i.organization_id
      SET j.state = 'cancelled', j.encrypted_payload = NULL, j.finished_at = UTC_TIMESTAMP(), j.lease_token = NULL, j.lease_expires_at = NULL
      WHERE j.state IN ('pending','sending') AND (i.status <> 'pending' OR i.expires_at <= UTC_TIMESTAMP() OR o.is_active = FALSE)`);
    await pool.query("DELETE FROM notification_events WHERE created_at <= UTC_TIMESTAMP() - INTERVAL 90 DAY ORDER BY event_id LIMIT 500");
    await pool.query("DELETE FROM notification_email_outbox WHERE finished_at <= UTC_TIMESTAMP() - INTERVAL 7 DAY ORDER BY job_id LIMIT 500");
  }

  return { runOnce, cleanup, messageFor };
}

module.exports = { createWorker };
