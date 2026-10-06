"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");

const enabled = process.env.RUN_DB_TESTS === "1";

test("complete client and administrator transaction persists across the API", { skip: !enabled }, async () => {
  process.env.NODE_ENV = "test";
  const request = require("supertest");
  const bcrypt = require("bcryptjs");
  const app = require("../src/app");
  const config = require("../src/config");
  const { pool } = require("../src/db");
  const client = request.agent(app);
  const secondClient = request.agent(app);
  const invitedMember = request.agent(app);
  const billingClient = request.agent(app);
  const wrongInviteClient = request.agent(app);
  const admin = request.agent(app);
  let storedFilename;

  async function resetDatabase() {
    assert.match(config.db.database, /_test$/, "Destructive integration reset requires a _test database.");
    const tables = [
      "notification_email_outbox", "notifications", "notification_preferences", "notification_events",
      "engagement_status_history", "invoices", "authorization_documents",
      "engagement_targets", "engagements", "organization_invitations",
      "organization_memberships", "organizations", "inquiries", "resources",
      "services", "sessions", "users",
    ];
    await pool.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of tables) await pool.query(`TRUNCATE TABLE ${table}`);
    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  }

  async function csrf(agent) {
    const response = await agent.get("/api/auth/csrf-token").expect(200);
    return response.body.data.csrf_token;
  }

  try {
    await resetDatabase();
    await pool.execute(
      `INSERT INTO services
        (name, slug, short_description, long_description, category, delivery_method, base_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["Test Service", "test-service", "A test service record.", "Long enough test service description for API validation.", "Testing", "Local", 1250]
    );

    await request(app).post("/api/inquiries").send({
      full_name: "No Token",
      email: "no-token@example.test",
      company_name: "Example Company",
      message: "This mutation deliberately omits its CSRF token.",
    }).expect(403);

    const inquiryToken = await csrf(client);
    const inquiryResponse = await client.post("/api/inquiries").set("X-CSRF-Token", inquiryToken).send({
      full_name: "Inquiry Person",
      email: "inquiry@example.test",
      company_name: "Example Company",
      message: "Robert'); DROP TABLE services; -- remains harmless inquiry text.",
    }).expect(201);
    assert.equal(inquiryResponse.body.data.status, "new");

    const registerResponse = await client.post("/api/auth/register").set("X-CSRF-Token", inquiryToken).send({
      full_name: "Client One",
      email: "client-one@example.test",
      company_name: "Client Company",
      password: "correct horse battery staple",
      authorization_ack: "true",
    }).expect(201);
    let clientToken = registerResponse.body.data.csrf_token;
    assert.equal(registerResponse.body.data.user.role, "client");
    assert.equal(registerResponse.body.data.user.active_organization.role, "owner");
    const primaryOrganizationId = registerResponse.body.data.user.active_organization.organization_id;
    const [registrationRows] = await pool.execute(
      `SELECT o.name, m.role FROM organizations o
       JOIN organization_memberships m USING (organization_id)
       WHERE o.organization_id = ? AND m.user_id = ?`,
      [primaryOrganizationId, registerResponse.body.data.user.user_id]
    );
    assert.deepEqual(registrationRows[0], { name: "Client Company", role: "owner" });

    await client.post("/api/auth/register").set("X-CSRF-Token", clientToken).send({
      full_name: "Duplicate Client",
      email: "client-one@example.test",
      company_name: "Client Company",
      password: "correct horse battery staple",
      authorization_ack: "true",
    }).expect(409);

    await client.post("/api/engagements")
      .set("X-CSRF-Token", clientToken)
      .field("service_slug", "test-service")
      .field("scope_description", "A sufficiently detailed fictional integration-test scope for the academic application.")
      .field("targets", "portal.example.test")
      .field("requested_start_at", new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString())
      .field("billing_method", "invoice")
      .field("billing_email", "billing@example.test")
      .field("authorization_ack", "true")
      .attach("authorization", Buffer.from("This has a PDF name but no PDF signature."), { filename: "invalid.pdf", contentType: "application/pdf" })
      .expect(422);

    const requestedStart = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const createResponse = await client.post("/api/engagements")
      .set("X-CSRF-Token", clientToken)
      .field("service_slug", "test-service")
      .field("scope_description", "A sufficiently detailed fictional integration-test scope for the academic application.")
      .field("targets", "portal.example.test\napi.example.test")
      .field("requested_start_at", requestedStart)
      .field("billing_method", "invoice")
      .field("billing_email", "billing@example.test")
      .field("authorization_ack", "true")
      .attach("authorization", path.resolve(__dirname, "../../output/pdf/sample-authorization.pdf"))
      .expect(201);
    const reference = createResponse.body.data.reference_code;
    assert.match(reference, /^ORL-\d{6}$/);

    const [transactionCounts] = await pool.execute(
      `SELECT
        (SELECT COUNT(*) FROM engagements WHERE reference_code = ?) AS engagements,
        (SELECT COUNT(*) FROM engagement_targets t JOIN engagements e USING (engagement_id) WHERE e.reference_code = ?) AS targets,
        (SELECT COUNT(*) FROM authorization_documents d JOIN engagements e USING (engagement_id) WHERE e.reference_code = ?) AS documents,
        (SELECT COUNT(*) FROM invoices i JOIN engagements e USING (engagement_id) WHERE e.reference_code = ?) AS invoices,
        (SELECT COUNT(*) FROM engagement_status_history h JOIN engagements e USING (engagement_id) WHERE e.reference_code = ?) AS history`,
      [reference, reference, reference, reference, reference]
    );
    assert.deepEqual(transactionCounts[0], { engagements: 1, targets: 2, documents: 1, invoices: 1, history: 1 });
    const [ownership] = await pool.execute(
      `SELECT organization_id, submitted_by_user_id FROM engagements WHERE reference_code = ?`,
      [reference]
    );
    assert.equal(ownership[0].organization_id, primaryOrganizationId);
    assert.equal(ownership[0].submitted_by_user_id, registerResponse.body.data.user.user_id);

    const clientList = await client.get("/api/engagements").expect(200);
    assert.equal(clientList.body.data.length, 1);
    assert.equal(clientList.body.data[0].reference_code, reference);

    const secondToken = await csrf(secondClient);
    const secondRegister = await secondClient.post("/api/auth/register").set("X-CSRF-Token", secondToken).send({
      full_name: "Client Two",
      email: "client-two@example.test",
      company_name: "Second Company",
      password: "another correct horse staple",
      authorization_ack: "true",
    }).expect(201);
    assert.ok(secondRegister.body.data.csrf_token);
    await secondClient.get(`/api/engagements/${reference}`).expect(404);

    const invitationResponse = await client.post("/api/organizations/current/invitations")
      .set("X-CSRF-Token", clientToken)
      .send({ email: "member@example.test", role: "member" })
      .expect(201);
    assert.equal(invitationResponse.body.data.account_exists, false);
    const invitationToken = new URL(invitationResponse.body.data.invitation_url, "http://localhost").searchParams.get("token");
    assert.match(invitationToken, /^[a-f0-9]{64}$/);
    await request(app).get(`/api/invitations/preview?token=${invitationToken}`).expect(200);

    const wrongToken = await csrf(wrongInviteClient);
    await wrongInviteClient.post("/api/auth/register").set("X-CSRF-Token", wrongToken).send({
      full_name: "Wrong Invite User",
      email: "wrong-invite@example.test",
      company_name: "Ignored Company",
      password: "correct horse invitation wrong",
      authorization_ack: "true",
      invitation_token: invitationToken,
    }).expect(403);

    const memberCsrf = await csrf(invitedMember);
    const memberRegistration = await invitedMember.post("/api/auth/register").set("X-CSRF-Token", memberCsrf).send({
      full_name: "Invited Member",
      email: "member@example.test",
      company_name: "Ignored Company",
      password: "correct horse invited member",
      authorization_ack: "true",
      invitation_token: invitationToken,
    }).expect(201);
    let memberToken = memberRegistration.body.data.csrf_token;
    assert.equal(memberRegistration.body.data.user.active_organization.organization_id, primaryOrganizationId);
    assert.equal(memberRegistration.body.data.user.active_organization.role, "member");
    await request(app).get(`/api/invitations/preview?token=${invitationToken}`).expect(409);

    const sharedList = await invitedMember.get("/api/engagements").expect(200);
    assert.equal(sharedList.body.data[0].reference_code, reference);
    assert.equal(sharedList.body.data[0].invoice_status, undefined);
    const sharedDetail = await invitedMember.get(`/api/engagements/${reference}`).expect(200);
    assert.equal(sharedDetail.body.data.scope_description.includes("integration-test scope"), true);
    assert.equal(sharedDetail.body.data.invoice_amount, undefined);

    const billingCsrf = await csrf(billingClient);
    const billingRegistration = await billingClient.post("/api/auth/register").set("X-CSRF-Token", billingCsrf).send({
      full_name: "Billing Member",
      email: "billing-member@example.test",
      company_name: "Billing Member Company",
      password: "correct horse billing member",
      authorization_ack: "true",
    }).expect(201);
    let billingToken = billingRegistration.body.data.csrf_token;
    const billingOwnOrganizationId = billingRegistration.body.data.user.active_organization.organization_id;
    const billingInvitation = await client.post("/api/organizations/current/invitations")
      .set("X-CSRF-Token", clientToken)
      .send({ email: "billing-member@example.test", role: "billing" })
      .expect(201);
    assert.equal(billingInvitation.body.data.account_exists, true);
    assert.equal(billingInvitation.body.data.invitation_url, null);
    const received = await billingClient.get("/api/invitations/received").expect(200);
    assert.equal(received.body.data.length, 1);
    await billingClient.post(`/api/invitations/received/${received.body.data[0].invitation_id}/accept`)
      .set("X-CSRF-Token", billingToken).send({}).expect(200);
    await billingClient.post(`/api/invitations/received/${received.body.data[0].invitation_id}/accept`)
      .set("X-CSRF-Token", billingToken).send({}).expect(409);
    const organizations = await billingClient.get("/api/organizations").expect(200);
    assert.equal(organizations.body.data.length, 2);
    await billingClient.patch("/api/organizations/active").set("X-CSRF-Token", billingToken)
      .send({ organization_id: primaryOrganizationId }).expect(200);
    const billingDetail = await billingClient.get(`/api/engagements/${reference}`).expect(200);
    assert.equal(billingDetail.body.data.scope_description, undefined);
    assert.equal(billingDetail.body.data.targets.length, 0);
    assert.equal(billingDetail.body.data.invoice_amount, 1250);
    await billingClient.post("/api/engagements").set("X-CSRF-Token", billingToken).expect(403);
    await billingClient.patch(`/api/engagements/${reference}/cancel`).set("X-CSRF-Token", billingToken).send({}).expect(403);
    await billingClient.patch("/api/organizations/active").set("X-CSRF-Token", billingToken)
      .send({ organization_id: billingOwnOrganizationId }).expect(200);

    await client.patch(`/api/organizations/current/members/${registerResponse.body.data.user.user_id}`)
      .set("X-CSRF-Token", clientToken).send({ role: "manager" }).expect(409);
    await client.delete(`/api/organizations/current/members/${registerResponse.body.data.user.user_id}`)
      .set("X-CSRF-Token", clientToken).expect(409);

    const cancelInvitation = await client.post("/api/organizations/current/invitations")
      .set("X-CSRF-Token", clientToken).send({ email: "cancelled@example.test", role: "member" }).expect(201);
    const cancelledToken = new URL(cancelInvitation.body.data.invitation_url, "http://localhost").searchParams.get("token");
    await client.delete(`/api/organizations/current/invitations/${cancelInvitation.body.data.invitation_id}`)
      .set("X-CSRF-Token", clientToken).expect(200);
    await request(app).get(`/api/invitations/preview?token=${cancelledToken}`).expect(409);
    await request(app).get(`/api/invitations/preview?token=${"0".repeat(64)}`).expect(404);

    const expiredInvitation = await client.post("/api/organizations/current/invitations")
      .set("X-CSRF-Token", clientToken).send({ email: "expired@example.test", role: "member" }).expect(201);
    const expiredToken = new URL(expiredInvitation.body.data.invitation_url, "http://localhost").searchParams.get("token");
    await pool.execute("UPDATE organization_invitations SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) WHERE invitation_id = ?", [expiredInvitation.body.data.invitation_id]);
    await request(app).get(`/api/invitations/preview?token=${expiredToken}`).expect(410);

    await client.patch(`/api/organizations/current/members/${memberRegistration.body.data.user.user_id}`)
      .set("X-CSRF-Token", clientToken).send({ role: "manager" }).expect(200);
    await invitedMember.post("/api/organizations/current/invitations").set("X-CSRF-Token", memberToken)
      .send({ email: "owner-attempt@example.test", role: "owner" }).expect(403);
    await invitedMember.delete(`/api/organizations/current/members/${registerResponse.body.data.user.user_id}`)
      .set("X-CSRF-Token", memberToken).expect(403);

    const adminHash = await bcrypt.hash("administrator test password", 12);
    await pool.execute(
      `INSERT INTO users (full_name, email, company_name, password_hash, role)
       VALUES ('Test Administrator', 'admin@example.test', 'Oracle Red Labs', ?, 'admin')`,
      [adminHash]
    );
    const adminLoginToken = await csrf(admin);
    const adminLogin = await admin.post("/api/auth/login").set("X-CSRF-Token", adminLoginToken).send({
      email: "admin@example.test",
      password: "administrator test password",
    }).expect(200);
    let adminToken = adminLogin.body.data.csrf_token;

    await admin.patch(`/api/admin/engagements/${reference}/status`).set("X-CSRF-Token", adminToken).send({
      status: "scoping",
      note: "Administrator accepted the fictional scope.",
    }).expect(200);
    await admin.patch(`/api/admin/engagements/${reference}/status`).set("X-CSRF-Token", adminToken).send({
      status: "completed",
      note: "This transition must be rejected because active was skipped.",
    }).expect(409);
    await admin.patch(`/api/admin/engagements/${reference}/invoice`).set("X-CSRF-Token", adminToken).send({
      status: "outstanding",
      amount: 1250,
    }).expect(200);

    const updated = await client.get(`/api/engagements/${reference}`).expect(200);
    assert.equal(updated.body.data.status, "scoping");
    assert.equal(updated.body.data.invoice_status, "outstanding");
    assert.equal(updated.body.data.status_history.length, 2);

    const download = await admin.get(`/api/admin/engagements/${reference}/authorization`).expect(200);
    assert.match(download.headers["content-type"], /application\/pdf/);
    await admin.delete("/api/admin/services/1").set("X-CSRF-Token", adminToken).expect(409);

    const resource = await admin.post("/api/admin/resources").set("X-CSRF-Token", adminToken).send({
      title: "Temporary Test Resource",
      slug: "temporary-test-resource",
      abstract: "A fictional resource created for the database integration test.",
      category: "whitepaper",
      published_at: "2026-10-02",
      is_published: true,
    }).expect(201);
    const resourceId = resource.body.data.resource_id;
    await admin.put(`/api/admin/resources/${resourceId}`).set("X-CSRF-Token", adminToken).send({
      title: "Updated Test Resource",
      slug: "temporary-test-resource",
      abstract: "An updated fictional resource created for the database integration test.",
      category: "case-study",
      published_at: "2026-10-02",
      is_published: false,
    }).expect(200);
    await admin.delete(`/api/admin/resources/${resourceId}`).set("X-CSRF-Token", adminToken).expect(200);

    const inquiryId = inquiryResponse.body.data.inquiry_id;
    await admin.patch(`/api/admin/inquiries/${inquiryId}/status`).set("X-CSRF-Token", adminToken).send({ status: "reviewed" }).expect(200);
    await admin.delete(`/api/admin/inquiries/${inquiryId}`).set("X-CSRF-Token", adminToken).expect(200);

    const [documents] = await pool.execute(
      `SELECT d.stored_filename FROM authorization_documents d
       JOIN engagements e USING (engagement_id) WHERE e.reference_code = ?`,
      [reference]
    );
    storedFilename = documents[0].stored_filename;
  } finally {
    if (storedFilename) await fs.unlink(path.join(config.uploadDir, storedFilename)).catch(() => {});
    await resetDatabase().catch(() => {});
    await pool.end();
  }
});
