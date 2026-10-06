"use strict";

const crypto = require("node:crypto");
const config = require("./config");
const { TYPES, DEFAULT_PREFERENCES, audienceFor, emailEligible, encryptToken } = require("./notification-policy");

async function createEvent(connection, event) {
  if (!TYPES.includes(event.type)) throw new Error("Invalid notification event type");
  if (event.type === "member_role_changed" && event.oldValue === event.newValue) return null;
  let result;
  try {
    [result] = await connection.execute(
    `INSERT INTO notification_events (organization_id, source_key, event_type, actor_user_id, subject_user_id,
      engagement_id, invitation_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [event.organizationId, event.sourceKey || crypto.randomUUID(), event.type, event.actorUserId || null,
      event.subjectUserId || null, event.engagementId || null, event.invitationId || null, event.oldValue || null, event.newValue || null]
    );
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY" || !event.sourceKey) throw error;
    const [existing] = await connection.execute("SELECT event_id FROM notification_events WHERE source_key = ? AND organization_id = ?", [event.sourceKey, event.organizationId]);
    if (!existing.length) throw error;
    return existing[0].event_id;
  }
  const [members] = await connection.execute(
    `SELECT m.user_id, m.role, p.engagement_email, p.invoice_email, p.team_email, p.personal_access_email
       FROM organization_memberships m JOIN users u ON u.user_id = m.user_id
       JOIN organizations o ON o.organization_id = m.organization_id
       LEFT JOIN notification_preferences p ON p.organization_id = m.organization_id AND p.user_id = m.user_id
      WHERE m.organization_id = ? AND u.is_active = TRUE AND u.role = 'client' AND o.is_active = TRUE`,
    [event.organizationId]
  );
  for (const member of members) {
    const audience = audienceFor(event, member);
    if (!audience) continue;
    const [notification] = await connection.execute(
      `INSERT INTO notifications (event_id, organization_id, recipient_user_id, audience) VALUES (?, ?, ?, ?)`,
      [result.insertId, event.organizationId, member.user_id, audience]
    );
    const preferences = Object.fromEntries(Object.entries(DEFAULT_PREFERENCES).map(([key, value]) => [key, member[key] == null ? value : Boolean(member[key])]));
    if (config.mail.enabled && emailEligible(event.type, audience, preferences)) {
      await connection.execute(
        `INSERT INTO notification_email_outbox (delivery_key, organization_id, notification_id, recipient_user_id, template)
         VALUES (?, ?, ?, ?, 'event')`,
        [`notification:${notification.insertId}`, event.organizationId, notification.insertId, member.user_id]
      );
    }
  }
  return result.insertId;
}

async function queueInvitation(connection, organizationId, invitationId, token, existing) {
  if (!config.mail.enabled) return false;
  await connection.execute(
    `INSERT INTO notification_email_outbox (delivery_key, organization_id, invitation_id, template, encrypted_payload)
     VALUES (?, ?, ?, ?, ?)`,
    [`invitation:${invitationId}`, organizationId, invitationId, existing ? "invitation_existing" : "invitation_new",
      existing ? null : encryptToken(token, config.mail.payloadKey)]
  );
  return true;
}

async function cancelInvitationMail(connection, invitationId) {
  await connection.execute(
    `UPDATE notification_email_outbox SET state = 'cancelled', encrypted_payload = NULL, finished_at = UTC_TIMESTAMP(),
      lease_token = NULL, lease_expires_at = NULL WHERE invitation_id = ? AND state IN ('pending', 'sending')`, [invitationId]
  );
}

async function cancelEngagementInvoice(connection, engagementId, organizationId, actorUserId) {
  const [rows] = await connection.execute("SELECT status FROM invoices WHERE engagement_id = ? FOR UPDATE", [engagementId]);
  if (!rows.length || ["paid", "cancelled"].includes(rows[0].status)) return;
  await connection.execute("UPDATE invoices SET status = 'cancelled' WHERE engagement_id = ?", [engagementId]);
  await createEvent(connection, { type: "invoice_changed", organizationId, actorUserId, engagementId,
    oldValue: rows[0].status, newValue: "cancelled" });
}

module.exports = { createEvent, queueInvitation, cancelInvitationMail, cancelEngagementInvoice };
