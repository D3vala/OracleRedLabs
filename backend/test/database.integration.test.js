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
  const admin = request.agent(app);
  let storedFilename;

  async function resetDatabase() {
    const tables = [
      "engagement_status_history", "invoices", "authorization_documents",
      "engagement_targets", "engagements", "inquiries", "resources",
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
