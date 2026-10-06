"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const enabled = process.env.RUN_DB_TESTS === "1";

test("notification transactions, authorization, read lifecycle, and SMTP queue", { skip: !enabled }, async (t) => {
  process.env.NODE_ENV = "test";
  Object.assign(process.env, { MAIL_ENABLED: "true", SMTP_HOST: "smtp.example.test", SMTP_USER: "test", SMTP_PASSWORD: "fake-transport-only",
    MAIL_FROM: "notifications@example.test", APP_BASE_URL: "https://example.test/", MAIL_PAYLOAD_KEY: crypto.randomBytes(32).toString("base64") });
  const request = require("supertest");
  const bcrypt = require("bcryptjs");
  const app = require("../src/app");
  const config = require("../src/config");
  const { pool } = require("../src/db");
  const { createEvent } = require("../src/notifications");
  const { createWorker } = require("../src/notification-worker");
  const { decryptToken } = require("../src/notification-policy");
  const tables = ["notification_email_outbox", "notifications", "notification_preferences", "notification_events", "engagement_status_history", "invoices",
    "authorization_documents", "engagement_targets", "engagements", "organization_invitations", "organization_memberships", "organizations", "inquiries", "resources", "services", "sessions", "users"];
  async function reset() {
    assert.match(config.db.database, /_test$/);
    const connection = await pool.getConnection();
    try { await connection.query("SET FOREIGN_KEY_CHECKS = 0"); for (const name of tables) await connection.query(`TRUNCATE TABLE ${name}`); }
    finally { await connection.query("SET FOREIGN_KEY_CHECKS = 1"); connection.release(); }
  }
  async function count(table, where = "1=1", params = []) {
    const [rows] = await pool.execute(`SELECT COUNT(*) AS total FROM ${table} WHERE ${where}`, params);
    return Number(rows[0].total);
  }
  async function emit(type, extra = {}) {
    const connection = await pool.getConnection();
    try { await connection.beginTransaction(); const id = await createEvent(connection, { type, organizationId: 1, actorUserId: 8, ...extra }); await connection.commit(); return id; }
    catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }
  const clients = {};
  const sent = [];
  const worker = createWorker({ pool, mail: config.mail, transport: { async sendMail(message) { sent.push(message); return { accepted: [message.to] }; } } });
  let reference;
  let engagementId;
  let storedFilename;
  const endpoint = (suffix = "", org = 1) => `/api/notifications${suffix}${suffix.includes("?") ? "&" : "?"}organization_id=${org}`;
  try {
    await reset();
    const hash = await bcrypt.hash("NotificationTestPassword2026", 4);
    for (let id = 1; id <= 8; id += 1) {
      await pool.execute("INSERT INTO users (user_id, full_name, email, company_name, password_hash, role) VALUES (?, ?, ?, 'Test Organization', ?, ?)",
        [id, `Notification User ${id}`, `notification${id}@example.test`, hash, id === 8 ? "admin" : "client"]);
    }
    await pool.query("INSERT INTO organizations (organization_id, name) VALUES (1, 'Primary Organization'), (2, 'Other Organization')");
    await pool.query("INSERT INTO organization_memberships (organization_id, user_id, role) VALUES (1,1,'owner'),(1,2,'owner'),(1,3,'manager'),(1,4,'member'),(1,5,'billing'),(2,6,'owner'),(1,7,'member'),(2,7,'billing')");
    await pool.execute(`INSERT INTO services (name, slug, short_description, long_description, category, delivery_method, base_price)
      VALUES ('Test Service', 'test-service', 'Test service record', 'Test service long description for notifications', 'Testing', 'Local', 1250)`);
    for (let id = 1; id <= 8; id += 1) {
      const agent = request.agent(app);
      const csrf = await agent.get("/api/auth/csrf-token").expect(200);
      const login = await agent.post("/api/auth/login").set("X-CSRF-Token", csrf.body.data.csrf_token).send({ email: `notification${id}@example.test`, password: "NotificationTestPassword2026" }).expect(200);
      clients[id] = { agent, token: login.body.data.csrf_token };
    }
    const mutate = (id, method, path, body) => clients[id].agent[method](path).set("X-CSRF-Token", clients[id].token).send(body);
    await t.test("guests, administrators, invalid context, and CSRF are rejected", async () => {
      await request(app).get(endpoint()).expect(401);
      await clients[8].agent.get(endpoint()).expect(403);
      const mismatch = await clients[1].agent.get(endpoint("", 2)).expect(409);
      assert.equal(mismatch.body.error.code, "ORGANIZATION_CONTEXT_CHANGED");
      await clients[1].agent.get("/api/notifications").expect(422);
      await clients[1].agent.post(endpoint("/read-all")).send({ watermark: 0 }).expect(403);
      await clients[1].agent.get(endpoint("?limit=51")).expect(422);
      await clients[1].agent.get(endpoint("?filter=invalid")).expect(422);
    });
    await t.test("submission and admin updates create role-specific notifications without sensitive content", async () => {
      const response = await clients[1].agent.post("/api/engagements").set("X-CSRF-Token", clients[1].token)
        .field("service_slug", "test-service").field("scope_description", "SECRET_SCOPE: written authorization for private test targets under controlled scope.")
        .field("targets", "SECRET_TARGET.example.test").field("requested_start_at", new Date(Date.now() + 72 * 3600000).toISOString())
        .field("billing_method", "invoice").field("billing_email", "SECRET_BILLING@example.test").field("authorization_ack", "true")
        .attach("authorization", Buffer.from("%PDF-1.7\nnotification test document\n%%EOF"), { filename: "notification-test.pdf", contentType: "application/pdf" }).expect(201);
      reference = response.body.data.reference_code;
      const [rows] = await pool.execute("SELECT e.engagement_id, d.stored_filename FROM engagements e JOIN authorization_documents d USING (engagement_id) WHERE reference_code = ?", [reference]);
      engagementId = rows[0].engagement_id; storedFilename = rows[0].stored_filename;
      assert.equal(await count("notifications", "recipient_user_id = 1"), 0);
      assert.equal(await count("notifications", "recipient_user_id = 5"), 0);
      assert.equal(await count("notification_email_outbox"), 0);
      await mutate(8, "patch", `/api/admin/engagements/${reference}/status`, { status: "scoping", note: "SECRET_INTERNAL_NOTE" }).expect(200);
      await mutate(8, "patch", `/api/admin/engagements/${reference}/invoice`, { status: "outstanding", amount: 1400 }).expect(200);
      for (const id of [1, 2, 3, 4, 5, 7]) {
        const response = await clients[id].agent.get(endpoint()).expect(200);
        assert.equal(response.headers["cache-control"], "no-store");
        assert.doesNotMatch(JSON.stringify(response.body), /SECRET_|1400|notification\d@example/);
        const invoices = response.body.data.filter((item) => item.type === "invoice_changed");
        assert.equal(invoices.length, [1, 2, 3, 5].includes(id) ? 1 : 0);
      }
      const before = await count("notification_events");
      await mutate(8, "patch", `/api/admin/engagements/${reference}/invoice`, { status: "outstanding", amount: 1400 }).expect(200);
      assert.equal(await count("notification_events"), before);
      const [cancelledEngagement] = await pool.execute(`INSERT INTO engagements (reference_code, organization_id, submitted_by_user_id, service_id,
        scope_description, requested_start_at, billing_method, billing_email, price_snapshot)
        SELECT 'ORL-333333', organization_id, submitted_by_user_id, service_id, scope_description, requested_start_at,
        billing_method, billing_email, price_snapshot FROM engagements WHERE engagement_id = ?`, [engagementId]);
      await pool.execute("INSERT INTO invoices (engagement_id, amount) VALUES (?, 1000)", [cancelledEngagement.insertId]);
      const beforeCancel = await count("notification_events");
      await mutate(1, "patch", "/api/engagements/ORL-333333/cancel", {}).expect(200);
      assert.equal(await count("notification_events"), beforeCancel + 2);
      const billingCancel = await clients[5].agent.get(endpoint()).expect(200);
      assert.equal(billingCancel.body.data.filter((item) => item.message.includes("ORL-333333")).length, 2);
      await mutate(8, "patch", `/api/admin/engagements/${reference}/status`, { status: "pending" }).expect(409);
      assert.equal(await count("notification_events"), beforeCancel + 2);
    });
    await t.test("read state is individual, paginated, idempotent, and isolated by organization", async () => {
      const first = await clients[2].agent.get(endpoint("?limit=1")).expect(200);
      assert.equal(first.body.data.length, 1);
      assert.ok(first.body.meta.next_cursor);
      const second = await clients[2].agent.get(endpoint(`?limit=1&cursor=${first.body.meta.next_cursor}`)).expect(200);
      assert.notEqual(first.body.data[0].notification_id, second.body.data[0].notification_id);
      const id = first.body.data[0].notification_id;
      const otherBefore = (await clients[1].agent.get(endpoint("/summary"))).body.data.unread_count;
      await mutate(2, "patch", endpoint(`/${id}`), { read: true }).expect(200);
      await mutate(2, "patch", endpoint(`/${id}`), { read: true }).expect(200);
      assert.equal((await clients[1].agent.get(endpoint("/summary"))).body.data.unread_count, otherBefore);
      await mutate(2, "patch", endpoint(`/${id}`), { read: false }).expect(200);
      await mutate(1, "patch", endpoint(`/${id}`), { read: true }).expect(404);
      await mutate(6, "patch", endpoint(`/${id}`, 2), { read: true }).expect(404);
      const snapshot = (await clients[2].agent.get(endpoint("/summary"))).body.data;
      await emit("engagement_status_changed", { engagementId, newValue: "active" });
      await mutate(2, "post", endpoint("/read-all"), { watermark: snapshot.watermark }).expect(200);
      const unread = await clients[2].agent.get(endpoint("?filter=unread")).expect(200);
      assert.equal(unread.body.data.length, 1);
      assert.ok(unread.body.data[0].notification_id > snapshot.watermark);
      await mutate(7, "patch", "/api/organizations/active", { organization_id: 2 }).expect(200);
      await clients[7].agent.get(endpoint()).expect(409);
      assert.equal((await clients[7].agent.get(endpoint("/summary", 2))).body.data.unread_count, 0);
      await mutate(7, "patch", "/api/organizations/active", { organization_id: 1 }).expect(200);
    });
    await t.test("downgrades, role notices, final-owner protection, and removal take effect immediately", async () => {
      await mutate(1, "patch", "/api/organizations/current/members/2", { role: "member" }).expect(200);
      const list = await clients[2].agent.get(endpoint()).expect(200);
      assert.equal(list.body.data.some((item) => item.type === "invoice_changed"), false);
      assert.ok(list.body.data.some((item) => item.message === "Your organization role is now member."));
      const before = await count("notification_events");
      await mutate(1, "patch", "/api/organizations/current/members/2", { role: "member" }).expect(200);
      assert.equal(await count("notification_events"), before);
      await mutate(1, "delete", "/api/organizations/current/members/1", {}).expect(409);
      assert.equal(await count("notification_events"), before);
      const defaults = await clients[5].agent.get(endpoint("/preferences")).expect(200);
      assert.equal(defaults.body.data.invoice_email, true);
      await mutate(5, "patch", endpoint("/preferences"), { ...defaults.body.data, invoice_email: false }).expect(200);
      await mutate(1, "delete", "/api/organizations/current/members/4", {}).expect(200);
      assert.equal(await count("notifications", "recipient_user_id = 4"), 0);
      assert.equal(await count("notification_email_outbox", "recipient_user_id = 4"), 0);
      await clients[4].agent.get(endpoint()).expect(403);
    });
    await t.test("both invitation acceptance paths notify oversight and maintain a separate incoming inbox", async () => {
      const before = await count("notifications", "recipient_user_id = 6");
      const existing = await mutate(1, "post", "/api/organizations/current/invitations", { email: "notification6@example.test", role: "member" }).expect(201);
      assert.equal(existing.body.data.email_queued, true);
      while (await worker.runOnce()) { /* exercise existing-account invitation SMTP before acceptance */ }
      const invitationMail = sent.find((mail) => mail.to === "notification6@example.test" && mail.subject.includes("invitation"));
      assert.ok(invitationMail);
      assert.match(invitationMail.text, /organization.html#received-heading/);
      assert.doesNotMatch(invitationMail.text, /token=/);
      const received = await clients[6].agent.get("/api/invitations/received").expect(200);
      assert.equal(received.body.data.length, 1);
      assert.equal(await count("notifications", "recipient_user_id = 6"), before);
      await mutate(6, "post", `/api/invitations/received/${existing.body.data.invitation_id}/accept`, {}).expect(200);
      const newInvite = await mutate(1, "post", "/api/organizations/current/invitations", { email: "new-notification@example.test", role: "member" }).expect(201);
      const token = new URL(newInvite.body.data.invitation_url, "https://example.test/").searchParams.get("token");
      const [jobs] = await pool.execute("SELECT * FROM notification_email_outbox WHERE invitation_id = ?", [newInvite.body.data.invitation_id]);
      assert.notEqual(jobs[0].encrypted_payload, token);
      assert.equal(decryptToken(jobs[0].encrypted_payload, config.mail.payloadKey), token);
      const newcomer = request.agent(app);
      const csrf = (await newcomer.get("/api/auth/csrf-token")).body.data.csrf_token;
      await newcomer.post("/api/auth/register").set("X-CSRF-Token", csrf).send({ full_name: "New Notification Member", email: "new-notification@example.test", password: "NotificationTestPassword2026", authorization_ack: "true", invitation_token: token }).expect(201);
      const [cancelled] = await pool.execute("SELECT state, encrypted_payload FROM notification_email_outbox WHERE invitation_id = ?", [newInvite.body.data.invitation_id]);
      assert.equal(cancelled[0].state, "cancelled"); assert.equal(cancelled[0].encrypted_payload, null);
      const eventCount = await count("notification_events");
      await emit("engagement_submitted", { engagementId, sourceKey: `engagement:${engagementId}:submitted` });
      assert.equal(await count("notification_events"), eventCount);
      assert.equal((await newcomer.get(endpoint())).body.data.length, 0);
      const rejoin = await mutate(1, "post", "/api/organizations/current/invitations", { email: "notification4@example.test", role: "member" }).expect(201);
      await mutate(4, "post", `/api/invitations/received/${rejoin.body.data.invitation_id}/accept`, {}).expect(200);
      assert.equal((await clients[4].agent.get(endpoint())).body.data.length, 0);
    });
    await t.test("notification insertion and outbox failures roll back the domain transaction", async () => {
      const connection = await pool.getConnection();
      try {
        await connection.query(`CREATE TRIGGER notification_test_fail BEFORE INSERT ON notification_email_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test queue failure'`);
        const before = await count("notification_events");
        await mutate(8, "patch", `/api/admin/engagements/${reference}/invoice`, { status: "outstanding", amount: 1500 }).expect(500);
        const [invoices] = await connection.execute("SELECT amount FROM invoices WHERE engagement_id = ?", [engagementId]);
        assert.equal(Number(invoices[0].amount), 1400);
        assert.equal(await count("notification_events"), before);
      } finally { await connection.query("DROP TRIGGER IF EXISTS notification_test_fail"); connection.release(); }
    });
    await t.test("worker suppresses revoked rights and preferences, retries, and clears invitation secrets", async () => {
      while (await worker.runOnce()) { /* drain currently due jobs */ }
      assert.ok(sent.length > 0);
      for (const message of sent) {
        assert.ok(message.html.includes("ORACLE"));
        assert.ok(message.text.includes("Oracle Red Labs"));
        assert.deepEqual(message.from, { name: "Oracle Red Labs", address: config.mail.from });
        const destination = /href="([^"]+)"/.exec(message.html)[1].replaceAll("&amp;", "&");
        assert.ok(message.text.includes(destination));
      }
      assert.equal(sent.some((mail) => mail.to === "notification4@example.test"), false);
      assert.equal(sent.some((mail) => mail.to === "notification5@example.test" && mail.text.includes("invoice")), false);
      assert.doesNotMatch(JSON.stringify(sent.filter((mail) => mail.subject.includes("update is available"))), /SECRET_|Primary Organization|1400|ORL-/);
      const [downgradedInvoice] = await pool.execute("SELECT state FROM notification_email_outbox j JOIN notifications n USING (notification_id) WHERE n.recipient_user_id = 2 AND n.audience = 'invoice'");
      assert.equal(downgradedInvoice[0].state, "cancelled");
      const expired = await mutate(1, "post", "/api/organizations/current/invitations", { email: "expired-notification@example.test", role: "member" }).expect(201);
      await pool.execute("UPDATE organization_invitations SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 DAY WHERE invitation_id = ?", [expired.body.data.invitation_id]);
      await worker.runOnce();
      const revoked = await mutate(1, "post", "/api/organizations/current/invitations", { email: "revoked-notification@example.test", role: "member" }).expect(201);
      await mutate(1, "delete", `/api/organizations/current/invitations/${revoked.body.data.invitation_id}`, {}).expect(200);
      const [revokedRows] = await pool.execute("SELECT state, encrypted_payload FROM notification_email_outbox WHERE invitation_id IN (?, ?)", [expired.body.data.invitation_id, revoked.body.data.invitation_id]);
      for (const row of revokedRows) { assert.equal(row.state, "cancelled"); assert.equal(row.encrypted_payload, null); }
      const retryInvite = await mutate(1, "post", "/api/organizations/current/invitations", { email: "retry-notification@example.test", role: "member" }).expect(201);
      const failures = createWorker({ pool, mail: config.mail, transport: { async sendMail() { throw { responseCode: 451 }; } } });
      await failures.runOnce();
      let [retry] = await pool.execute("SELECT * FROM notification_email_outbox WHERE invitation_id = ?", [retryInvite.body.data.invitation_id]);
      assert.equal(retry[0].state, "pending"); assert.equal(retry[0].attempt_count, 1); assert.ok(retry[0].encrypted_payload);
      await pool.execute("UPDATE notification_email_outbox SET state = 'sending', lease_token = 'lost-lease', lease_expires_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE invitation_id = ?", [retryInvite.body.data.invitation_id]);
      await worker.runOnce();
      [retry] = await pool.execute("SELECT * FROM notification_email_outbox WHERE invitation_id = ?", [retryInvite.body.data.invitation_id]);
      assert.equal(retry[0].state, "accepted"); assert.equal(retry[0].attempt_count, 2); assert.equal(retry[0].encrypted_payload, null);
      assert.match(sent.at(-1).text, /accept-invitation.html\?token=/);
      const permanent = await mutate(1, "post", "/api/organizations/current/invitations", { email: "reject-notification@example.test", role: "member" }).expect(201);
      await createWorker({ pool, mail: config.mail, transport: { async sendMail() { throw { responseCode: 550 }; } } }).runOnce();
      const [failed] = await pool.execute("SELECT state, encrypted_payload FROM notification_email_outbox WHERE invitation_id = ?", [permanent.body.data.invitation_id]);
      assert.equal(failed[0].state, "failed"); assert.equal(failed[0].encrypted_payload, null);
      const exhausted = await mutate(1, "post", "/api/organizations/current/invitations", { email: "exhausted-notification@example.test", role: "member" }).expect(201);
      await pool.execute("UPDATE notification_email_outbox SET state = 'sending', attempt_count = 6, lease_expires_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE invitation_id = ?", [exhausted.body.data.invitation_id]);
      const sentBefore = sent.length;
      await worker.runOnce();
      const [terminal] = await pool.execute("SELECT state, attempt_count, encrypted_payload FROM notification_email_outbox WHERE invitation_id = ?", [exhausted.body.data.invitation_id]);
      assert.equal(terminal[0].state, "failed"); assert.equal(terminal[0].attempt_count, 6); assert.equal(terminal[0].encrypted_payload, null);
      assert.equal(sent.length, sentBefore);
      const tampered = await mutate(1, "post", "/api/organizations/current/invitations", { email: "tampered-notification@example.test", role: "member" }).expect(201);
      await pool.execute("UPDATE notification_email_outbox SET encrypted_payload = 'invalid' WHERE invitation_id = ?", [tampered.body.data.invitation_id]);
      await worker.runOnce();
      const [invalid] = await pool.execute("SELECT state, error_code, encrypted_payload FROM notification_email_outbox WHERE invitation_id = ?", [tampered.body.data.invitation_id]);
      assert.equal(invalid[0].state, "failed"); assert.equal(invalid[0].error_code, "INVALID_PAYLOAD"); assert.equal(invalid[0].encrypted_payload, null);
    });
    await t.test("disabled sending creates no backlog and retention removes read/unread rows", async () => {
      const before = await count("notification_email_outbox");
      config.mail.enabled = false;
      await mutate(8, "patch", `/api/admin/engagements/${reference}/status`, { status: "active" }).expect(200);
      assert.equal(await count("notification_email_outbox"), before);
      assert.equal(await worker.runOnce(), false);
      const id = await emit("engagement_status_changed", { engagementId, newValue: "completed" });
      await pool.execute("UPDATE notification_events SET created_at = UTC_TIMESTAMP() - INTERVAL 91 DAY WHERE event_id = ?", [id]);
      await pool.execute("UPDATE notifications SET created_at = UTC_TIMESTAMP() - INTERVAL 91 DAY WHERE event_id = ?", [id]);
      const list = await clients[1].agent.get(endpoint()).expect(200);
      assert.equal(list.body.data.some((item) => item.message.endsWith("completed.")), false);
      await worker.cleanup();
      assert.equal(await count("notification_events", "event_id = ?", [id]), 0);
      await pool.execute("UPDATE users SET is_active = FALSE WHERE user_id = 5");
      await clients[5].agent.get(endpoint()).expect(401);
    });
  } finally {
    if (storedFilename) await require("node:fs/promises").unlink(require("node:path").join(config.uploadDir, storedFilename)).catch(() => {});
    await reset();
    await pool.end();
  }
});
