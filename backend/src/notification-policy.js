"use strict";

const crypto = require("node:crypto");
const { renderEmail } = require("./email-templates");
const DEFAULT_PREFERENCES = Object.freeze({ engagement_email: true, invoice_email: true, team_email: false, personal_access_email: true });
const TYPES = Object.freeze([
  "engagement_submitted", "engagement_status_changed", "invoice_changed", "invitation_created",
  "invitation_cancelled", "invitation_accepted", "member_role_changed", "member_removed",
]);

function audienceFor(event, user) {
  if (Number(user.user_id) === Number(event.actorUserId)) return null;
  const oversight = ["owner", "manager"].includes(user.role);
  switch (event.type) {
    case "engagement_submitted": return user.role !== "billing" ? "engagement" : null;
    case "engagement_status_changed": return "status";
    case "invoice_changed": return ["owner", "manager", "billing"].includes(user.role) ? "invoice" : null;
    case "member_role_changed":
      if (Number(user.user_id) === Number(event.subjectUserId)) return "personal_access";
      return oversight ? "team" : null;
    default: return oversight ? "team" : null;
  }
}

function visibleAudiences(role) {
  if (["owner", "manager"].includes(role)) return ["engagement", "status", "invoice", "team", "personal_access"];
  if (role === "member") return ["engagement", "status", "personal_access"];
  if (role === "billing") return ["status", "invoice", "personal_access"];
  return [];
}

function emailEligible(type, audience, preferences = DEFAULT_PREFERENCES) {
  if (audience === "engagement") return false;
  const key = { status: "engagement_email", invoice: "invoice_email", team: "team_email", personal_access: "personal_access_email" }[audience];
  // A role change for other team members remains in-app even when team emails are enabled.
  if (type === "member_role_changed" && audience === "team") return false;
  return Boolean(preferences[key]);
}

function projectNotification(row) {
  const reference = row.reference_code;
  const subject = row.subject_name || "A former member";
  const status = (row.new_value || "").replaceAll("_", " ");
  const titles = {
    engagement_submitted: "Engagement submitted", engagement_status_changed: "Engagement status changed",
    invoice_changed: "Invoice updated", invitation_created: "Invitation created", invitation_cancelled: "Invitation cancelled",
    invitation_accepted: "Member joined", member_role_changed: "Membership role changed", member_removed: "Member removed",
  };
  let message;
  switch (row.event_type) {
    case "engagement_submitted": message = `${reference || "An engagement"} was submitted.`; break;
    case "engagement_status_changed": message = `${reference || "An engagement"} is now ${status}.`; break;
    case "invoice_changed": message = `The invoice for ${reference || "an engagement"} was updated${status ? ` (${status})` : ""}.`; break;
    case "invitation_created": message = "A new organization invitation was created."; break;
    case "invitation_cancelled": message = "An organization invitation was cancelled."; break;
    case "invitation_accepted": message = `${subject} joined the organization.`; break;
    case "member_role_changed": message = row.audience === "personal_access" ? `Your organization role is now ${status}.` : `${subject}'s role is now ${status}.`; break;
    case "member_removed": message = `${subject} was removed from the organization.`; break;
    default: throw new Error("Unknown notification type");
  }
  const url = row.engagement_id ? (reference ? `engagement-details.html?reference=${encodeURIComponent(reference)}` : null) : "organization.html";
  return { notification_id: row.notification_id, type: row.event_type, title: titles[row.event_type], message, url,
    created_at: row.created_at, read_at: row.read_at };
}

function encryptToken(token, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((value) => value.toString("base64")).join(".");
}

function decryptToken(payload, key) {
  const parts = payload.split(".").map((part) => Buffer.from(part, "base64"));
  if (parts.length !== 3 || parts[0].length !== 12 || parts[1].length !== 16) throw new Error("Invalid encrypted payload");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, parts[0]);
  decipher.setAuthTag(parts[1]);
  return Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString("utf8");
}

const RETRY_MINUTES = Object.freeze([1, 5, 30, 120, 360]);
function deliveryOutcome(error, attempts, now = new Date()) {
  const permanent = Number(error.responseCode) >= 500 && Number(error.responseCode) < 600;
  const code = permanent ? "SMTP_REJECTED" : "SMTP_TEMPORARY";
  if (permanent || attempts >= 6) return { state: "failed", code, next: now };
  return { state: "pending", code, next: new Date(now.getTime() + RETRY_MINUTES[attempts - 1] * 60000) };
}

function eventEmail(baseUrl, job) {
  const url = new URL("notifications.html", baseUrl);
  url.searchParams.set("organization", job.organization_id);
  url.searchParams.set("notification", job.notification_id);
  return renderEmail({ variant: "account-update", url: url.href });
}

module.exports = { DEFAULT_PREFERENCES, TYPES, audienceFor, visibleAudiences, emailEligible, projectNotification,
  encryptToken, decryptToken, deliveryOutcome, eventEmail };
