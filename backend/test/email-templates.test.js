"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const { renderEmail } = require("../src/email-templates");
const { eventEmail, TYPES, encryptToken } = require("../src/notification-policy");
const { createWorker } = require("../src/notification-worker");

function links(html) {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]
    .replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<").replaceAll("&gt;", ">"));
}

test("account mail stays identical and generic across all event categories and private metadata", () => {
  const baseline = eventEmail("https://example.test/", { organization_id: 2, notification_id: 1 });
  for (const event_type of TYPES) {
    const result = eventEmail("https://example.test/", {
      organization_id: 2, notification_id: 1, event_type, type: event_type,
      organizationName: "SECRET_ORGANIZATION", name: "SECRET_NAME", reference_code: "ORL-SECRET",
      new_value: "SECRET_STATUS", intended_role: "SECRET_ROLE", subject_name: "SECRET_MEMBER",
      invoice_amount: 998877, scope_description: "SECRET_SCOPE", targets: "SECRET_TARGET",
      document: "SECRET_DOCUMENT", note: "SECRET_NOTE", email: "private@example.test",
    });
    assert.deepEqual(result, baseline, event_type);
    assert.doesNotMatch(JSON.stringify(result), /SECRET_|ORL-|998877|private@example|engagement|invoice|membership/);
  }
  assert.equal(baseline.subject, "Oracle Red Labs: an update is available");
  assert.match(baseline.html, /An update is available in your Oracle Red Labs account\./);
  assert.match(baseline.text, /You can change event email preferences in Notifications\./);
  assert.deepEqual(links(baseline.html), Array(2).fill("https://example.test/notifications.html?organization=2&notification=1"));
  assert.ok(baseline.text.includes(links(baseline.html)[0]));
});

test("invitation text and HTML escape dynamic content and preserve corresponding links", () => {
  const organizationName = `A & <img src=x onerror='alert(1)'> "Quoted"`;
  const intendedRole = `<script>role</script>`;
  const url = "https://example.test/review'quoted?label='value'&next=received";
  const destination = new URL(url).href;
  for (const variant of ["existing-account-invitation", "new-account-invitation"]) {
    const result = renderEmail({ variant, url, organizationName, intendedRole });
    assert.equal(result.subject, "Oracle Red Labs: organization invitation");
    assert.doesNotMatch(result.html, /<img|<script|onerror='/);
    assert.match(result.html, /A &amp; &lt;img src=x onerror=&#39;alert\(1\)&#39;&gt; &quot;Quoted&quot;/);
    assert.match(result.html, /&lt;script&gt;role&lt;\/script&gt;/);
    assert.match(result.html, /review&#39;quoted\?label=%27value%27&amp;next=received/);
    assert.ok(result.text.includes(organizationName));
    assert.ok(result.text.includes(intendedRole));
    assert.deepEqual(links(result.html), [destination, destination]);
    assert.ok(result.text.includes(destination));
    const urlLabel = /Or open this link:[\s\S]*?<a [^>]+>([\s\S]*?)<\/a>/.exec(result.html)[1];
    assert.ok(urlLabel.includes("<wbr>"));
    assert.equal(urlLabel.replaceAll("<wbr>", "").replaceAll("&amp;", "&").replaceAll("&#39;", "'"), destination);
    for (const content of [result.html, result.text]) {
      assert.match(content, /seven days after creation/);
      assert.match(content, /not expecting this invitation, you can ignore it/);
      assert.match(content, /academic project \(ITS122P\)/);
      assert.doesNotMatch(content, /unsubscribe|email preferences/);
    }
  }
});

test("templates reject non-web destinations and unknown variants without echoing inputs", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,unsafe", "https://user:password@example.test/"]) {
    assert.throws(() => renderEmail({ variant: "account-update", url }), /^Error: Invalid email destination$/);
  }
  assert.throws(() => renderEmail({ variant: "unknown", url: "https://example.test/" }), /Unknown email template/);
});

// Synthetic database rows exercise the real worker without configuration, a database, or network SMTP.
function harness({ template = "event", event = {}, invitation = {}, baseUrl = "https://example.test/", token = "a".repeat(64) } = {}) {
  const payloadKey = crypto.randomBytes(32);
  const job = { job_id: 1, organization_id: 2, notification_id: 3, recipient_user_id: 4, invitation_id: 5,
    template, attempt_count: 0, delivery_key: "synthetic-email-test", encrypted_payload: encryptToken(token, payloadKey) };
  const row = template === "event"
    ? { email: "recipient@example.test", role: "owner", audience: "status", event_type: "engagement_status_changed", ...event }
    : { invited_email: "invitee@example.test", intended_role: "manager", name: "Synthetic Organization", user_id: null,
      token_hash: crypto.createHash("sha256").update(token).digest("hex"), ...invitation };
  const logs = [];
  const messages = [];
  const wireMessages = [];
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query() { return [[job]]; }, async execute() { return [{ affectedRows: 1 }]; },
  };
  const pool = {
    async getConnection() { return connection; },
    async execute(sql) {
      if (sql.includes("FROM notifications n") || sql.includes("FROM organization_invitations i")) return [[row]];
      if (sql.startsWith("SELECT job_id")) return [[{ job_id: job.job_id }]];
      return [{ affectedRows: 1 }];
    },
  };
  // Nodemailer's offline JSON transport builds both alternatives; it never opens a socket.
  const fakeSmtp = nodemailer.createTransport({ jsonTransport: true });
  const worker = createWorker({ pool, mail: { enabled: true, from: "sender@example.test", baseUrl, payloadKey },
    log: (entry) => logs.push(entry), transport: { async sendMail(message) {
      messages.push(message);
      wireMessages.push(JSON.parse((await fakeSmtp.sendMail(message)).message));
      return { accepted: [message.to] };
    } } });
  return { worker, messages, wireMessages, logs, token, job };
}

test("worker delivers all three variants with both formats, branded sender, and original destinations", async (t) => {
  for (const baseUrl of ["https://example.test/", "https://example.test/deploy/oracle/", "http://localhost:3000/"]) {
    for (const variant of ["account-update", "existing-account-invitation", "new-account-invitation"]) {
      await t.test(`${variant} at ${baseUrl}`, async () => {
        const context = harness({ baseUrl, template: variant === "account-update" ? "event" : "invitation",
          invitation: variant === "existing-account-invitation" ? { user_id: 7, account_active: true, account_role: "client" } : {} });
        await context.worker.runOnce();
        assert.equal(context.messages.length, 1);
        const message = context.messages[0];
        const path = variant === "account-update" ? "notifications.html?organization=2&notification=3"
          : variant === "existing-account-invitation" ? "organization.html#received-heading"
            : `accept-invitation.html?token=${context.token}`;
        const destination = new URL(path, baseUrl).href;
        assert.deepEqual(links(message.html), [destination, destination]);
        assert.ok(message.text.includes(destination));
        assert.deepEqual(message.from, { name: "Oracle Red Labs", address: "sender@example.test" });
        assert.equal(context.wireMessages[0].html, message.html);
        assert.equal(context.wireMessages[0].text, message.text);
        assert.equal(context.wireMessages[0].from.name, "Oracle Red Labs");
        assert.match(message.messageId, /^<orl-[a-f0-9]{64}@/);
        assert.deepEqual(context.logs.map((entry) => entry.state), ["accepted"]);
        assert.doesNotMatch(JSON.stringify(context.logs), /example\.test|Synthetic Organization|Review|a{64}/);
        if (variant === "existing-account-invitation") {
          assert.doesNotMatch(message.html + message.text, /token=/);
          assert.match(message.text, /received invitations/);
        }
      });
    }
  }
});

test("worker uses generic content across eligible engagement, invoice, team, and access emails", async () => {
  let baseline;
  for (const [event_type, audience] of [["engagement_status_changed", "status"], ["invoice_changed", "invoice"],
    ["invitation_created", "team"], ["invitation_cancelled", "team"], ["invitation_accepted", "team"],
    ["member_removed", "team"], ["member_role_changed", "personal_access"]]) {
    const context = harness({ event: { event_type, audience, team_email: true, name: "PRIVATE_ORG", new_value: "PRIVATE_STATUS", invoice_amount: 987654 } });
    await context.worker.runOnce();
    const { subject, text, html } = context.messages[0];
    const content = { subject, text, html };
    if (!baseline) baseline = content;
    assert.deepEqual(content, baseline, event_type);
    assert.doesNotMatch(JSON.stringify(content), /PRIVATE_|987654|invoice|engagement|membership/);
  }
});

test("worker retains delivery-time role, preference, account, and encrypted-token eligibility checks", async () => {
  const contexts = [
    harness({ event: { role: "member", audience: "invoice", event_type: "invoice_changed" } }),
    harness({ event: { engagement_email: false } }),
    harness({ event: { audience: "engagement", event_type: "engagement_submitted" } }),
    harness({ template: "invitation", invitation: { user_id: 7, account_active: false, account_role: "client" } }),
    harness({ template: "invitation", invitation: { user_id: 7, account_active: true, account_role: "admin" } }),
    harness({ template: "invitation", invitation: { token_hash: "invalid" } }),
  ];
  for (const context of contexts) {
    await context.worker.runOnce();
    assert.equal(context.messages.length, 0);
    assert.ok(["cancelled", "failed"].includes(context.logs[0].state));
  }
});
