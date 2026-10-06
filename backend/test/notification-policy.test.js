"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const policy = require("../src/notification-policy");

test("notification event recipients match every organization role and exclude actors", () => {
  const expected = {
    engagement_submitted: ["engagement", "engagement", "engagement", null],
    engagement_status_changed: ["status", "status", "status", "status"],
    invoice_changed: ["invoice", "invoice", null, "invoice"],
    invitation_created: ["team", "team", null, null], invitation_cancelled: ["team", "team", null, null],
    invitation_accepted: ["team", "team", null, null], member_role_changed: ["team", "team", null, null],
    member_removed: ["team", "team", null, null],
  };
  for (const type of policy.TYPES) {
    ["owner", "manager", "member", "billing"].forEach((role, index) => {
      assert.equal(policy.audienceFor({ type, actorUserId: 1, subjectUserId: 3 }, { role, user_id: 2 }), expected[type][index], `${type}/${role}`);
      assert.equal(policy.audienceFor({ type, actorUserId: 2 }, { role, user_id: 2 }), null);
    });
  }
  for (const role of ["owner", "manager", "member", "billing"]) {
    assert.equal(policy.audienceFor({ type: "member_role_changed", actorUserId: 1, subjectUserId: 2 }, { role, user_id: 2 }), "personal_access");
  }
});

test("visibility and email defaults do not grant operational or invoice access", () => {
  assert.deepEqual(policy.visibleAudiences("billing"), ["status", "invoice", "personal_access"]);
  assert.equal(policy.visibleAudiences("member").includes("invoice"), false);
  assert.deepEqual(policy.visibleAudiences("admin"), []);
  assert.equal(policy.emailEligible("engagement_submitted", "engagement", { engagement_email: true }), false);
  assert.equal(policy.emailEligible("engagement_status_changed", "status"), true);
  assert.equal(policy.emailEligible("invoice_changed", "invoice"), true);
  assert.equal(policy.emailEligible("invitation_accepted", "team"), false);
  assert.equal(policy.emailEligible("member_role_changed", "team", { team_email: true }), false);
  assert.equal(policy.emailEligible("member_role_changed", "personal_access"), true);
  assert.equal(policy.emailEligible("invoice_changed", "invoice", { invoice_email: false }), false);
});

test("templates never propagate free-form content or invitation addresses", () => {
  for (const event_type of policy.TYPES) {
    const result = policy.projectNotification({ event_type, notification_id: 1, audience: "status", reference_code: "ORL-123456", new_value: "scoping", subject_name: "Example Member", scope_description: "SECRET_SCOPE", invited_email: "private@example.test", note: "PRIVATE_NOTE", invoice_amount: 123456 });
    assert.doesNotMatch(JSON.stringify(result), /SECRET_SCOPE|private@example|PRIVATE_NOTE|invoice_amount/);
  }
  const email = policy.eventEmail("https://example.test/", { notification_id: 1, organization_id: 2, reference_code: "SECRET_REFERENCE", name: "SECRET_ORGANIZATION" });
  assert.doesNotMatch(JSON.stringify(email), /SECRET_/);
  assert.match(email.text, /notifications.html\?organization=2&notification=1/);
});

test("invitation encryption is randomized and authenticated", () => {
  const key = crypto.randomBytes(32);
  const token = crypto.randomBytes(32).toString("hex");
  const a = policy.encryptToken(token, key);
  const b = policy.encryptToken(token, key);
  assert.notEqual(a, b);
  assert.equal(a.includes(token), false);
  assert.equal(policy.decryptToken(a, key), token);
  assert.throws(() => policy.decryptToken(a, crypto.randomBytes(32)));
  assert.throws(() => policy.decryptToken("broken", key));
});

test("SMTP retries are bounded and permanent rejections are terminal", () => {
  const now = new Date("2026-10-05T00:00:00Z");
  [1, 5, 30, 120, 360].forEach((delay, index) => {
    const result = policy.deliveryOutcome({ responseCode: 451 }, index + 1, now);
    assert.equal(result.state, "pending");
    assert.equal(result.next.getTime() - now.getTime(), delay * 60000);
  });
  assert.equal(policy.deliveryOutcome({}, 6, now).state, "failed");
  assert.equal(policy.deliveryOutcome({ responseCode: 550 }, 1, now).state, "failed");
});
