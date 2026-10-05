"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ENGAGEMENT_TRANSITIONS,
  INVOICE_TRANSITIONS,
  canTransition,
} = require("../src/domain");
const { permissionsForRole } = require("../src/organization-context");

test("engagement transition matrix permits every specified forward path", () => {
  assert.equal(canTransition(ENGAGEMENT_TRANSITIONS, "pending", "scoping"), true);
  assert.equal(canTransition(ENGAGEMENT_TRANSITIONS, "pending", "cancelled"), true);
  assert.equal(canTransition(ENGAGEMENT_TRANSITIONS, "scoping", "active"), true);
  assert.equal(canTransition(ENGAGEMENT_TRANSITIONS, "scoping", "cancelled"), true);
  assert.equal(canTransition(ENGAGEMENT_TRANSITIONS, "active", "completed"), true);
  assert.equal(canTransition(ENGAGEMENT_TRANSITIONS, "active", "cancelled"), true);
});

test("engagement terminal and reverse transitions are rejected", () => {
  assert.equal(canTransition(ENGAGEMENT_TRANSITIONS, "completed", "active"), false);
  assert.equal(canTransition(ENGAGEMENT_TRANSITIONS, "cancelled", "pending"), false);
  assert.equal(canTransition(ENGAGEMENT_TRANSITIONS, "active", "scoping"), false);
  assert.equal(canTransition(ENGAGEMENT_TRANSITIONS, "unknown", "pending"), false);
});

test("invoice transitions allow the specified lifecycle and optional same-state update", () => {
  assert.equal(canTransition(INVOICE_TRANSITIONS, "not_issued", "outstanding"), true);
  assert.equal(canTransition(INVOICE_TRANSITIONS, "outstanding", "paid"), true);
  assert.equal(canTransition(INVOICE_TRANSITIONS, "not_issued", "cancelled"), true);
  assert.equal(canTransition(INVOICE_TRANSITIONS, "outstanding", "cancelled"), true);
  assert.equal(canTransition(INVOICE_TRANSITIONS, "paid", "outstanding"), false);
  assert.equal(canTransition(INVOICE_TRANSITIONS, "paid", "paid", true), true);
});

test("organization roles expose the intended server-side capabilities", () => {
  assert.equal(permissionsForRole("owner").can_manage_organization, true);
  assert.equal(permissionsForRole("manager").can_manage_members, true);
  assert.equal(permissionsForRole("member").can_view_invoices, false);
  assert.equal(permissionsForRole("member").can_submit_engagements, true);
  assert.equal(permissionsForRole("billing").can_view_full_engagements, false);
  assert.equal(permissionsForRole("billing").can_submit_engagements, false);
});
