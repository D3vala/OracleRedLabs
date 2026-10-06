"use strict";

const express = require("express");
const { body, param, query } = require("express-validator");
const { pool } = require("../db");
const { AppError, asyncHandler, requireClient, requireValid } = require("../http");
const { requireOrganizationContext } = require("../organization-context");
const { DEFAULT_PREFERENCES, projectNotification } = require("../notification-policy");

const router = express.Router();
// Shared by every read and write, with live memberships rather than session capabilities.
const joins = `JOIN organization_memberships m ON m.organization_id = n.organization_id AND m.user_id = n.recipient_user_id
  JOIN users recipient ON recipient.user_id = m.user_id
  JOIN organizations org ON org.organization_id = m.organization_id`;
const visible = `n.organization_id = ? AND n.recipient_user_id = ?
  AND recipient.is_active = TRUE AND recipient.role = 'client' AND org.is_active = TRUE
  AND n.created_at > UTC_TIMESTAMP() - INTERVAL 90 DAY
  AND (n.audience IN ('status', 'personal_access')
    OR (n.audience = 'engagement' AND m.role IN ('owner','manager','member'))
    OR (n.audience = 'invoice' AND m.role IN ('owner','manager','billing'))
    OR (n.audience = 'team' AND m.role IN ('owner','manager')))`;
const contextParams = (req) => [req.organization.organization_id, req.session.user.user_id];

router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.use(requireClient, asyncHandler(async (req, _res, next) => {
  const [users] = await pool.execute("SELECT user_id FROM users WHERE user_id = ? AND is_active = TRUE AND role = 'client'", [req.session.user.user_id]);
  if (!users.length) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
  next();
}), requireOrganizationContext, query("organization_id").isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }), (req, _res, next) => {
  requireValid(req);
  if (Number(req.query.organization_id) !== Number(req.organization.organization_id)) {
    throw new AppError(409, "ORGANIZATION_CONTEXT_CHANGED", "Your active organization changed. Refresh to continue.");
  }
  next();
});

async function summary(req) {
  const [rows] = await pool.execute(
    `SELECT COALESCE(SUM(n.read_at IS NULL), 0) AS unread_count, COALESCE(MAX(n.notification_id), 0) AS watermark
       FROM notifications n ${joins} WHERE ${visible}`, contextParams(req)
  );
  return { organization_id: req.organization.organization_id, role: req.organization.role,
    unread_count: Number(rows[0].unread_count), watermark: Number(rows[0].watermark) };
}

router.get("/summary", asyncHandler(async (req, res) => { res.json({ data: await summary(req) }); }));

router.get("/preferences", asyncHandler(async (req, res) => {
  const [rows] = await pool.execute("SELECT engagement_email, invoice_email, team_email, personal_access_email FROM notification_preferences WHERE organization_id = ? AND user_id = ?", contextParams(req));
  res.json({ data: rows.length ? Object.fromEntries(Object.keys(DEFAULT_PREFERENCES).map((key) => [key, Boolean(rows[0][key])])) : DEFAULT_PREFERENCES });
}));

router.patch("/preferences", Object.keys(DEFAULT_PREFERENCES).map((key) => body(key).isBoolean({ strict: true })), asyncHandler(async (req, res) => {
  requireValid(req);
  const values = Object.keys(DEFAULT_PREFERENCES).map((key) => req.body[key]);
  await pool.execute(`INSERT INTO notification_preferences (organization_id, user_id, engagement_email, invoice_email, team_email, personal_access_email)
    VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE engagement_email = VALUES(engagement_email), invoice_email = VALUES(invoice_email),
    team_email = VALUES(team_email), personal_access_email = VALUES(personal_access_email)`, [...contextParams(req), ...values]);
  res.json({ data: Object.fromEntries(Object.keys(DEFAULT_PREFERENCES).map((key) => [key, req.body[key]])), message: "Email preferences saved." });
}));

router.post("/read-all", body("watermark").isInt({ min: 0, max: Number.MAX_SAFE_INTEGER }), asyncHandler(async (req, res) => {
  requireValid(req);
  await pool.execute(`UPDATE notifications n ${joins} SET n.read_at = COALESCE(n.read_at, UTC_TIMESTAMP())
    WHERE ${visible} AND n.notification_id <= ? AND n.read_at IS NULL`, [...contextParams(req), Number(req.body.watermark)]);
  res.json({ data: await summary(req), message: "Notifications marked read." });
}));

router.get("/", [query("filter").optional().isIn(["all", "unread"]),
  query("cursor").optional().isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }), query("limit").optional().isInt({ min: 1, max: 50 })], asyncHandler(async (req, res) => {
  requireValid(req);
  const limit = Number(req.query.limit || 20);
  const params = contextParams(req);
  let extra = req.query.filter === "unread" ? " AND n.read_at IS NULL" : "";
  if (req.query.cursor) { extra += " AND n.notification_id < ?"; params.push(Number(req.query.cursor)); }
  const [rows] = await pool.execute(`SELECT n.notification_id, n.audience, n.created_at, n.read_at,
    e.event_type, e.engagement_id, e.old_value, e.new_value, engagement.reference_code, subject.full_name AS subject_name
    FROM notifications n ${joins} JOIN notification_events e ON e.event_id = n.event_id AND e.organization_id = n.organization_id
    LEFT JOIN engagements engagement ON engagement.engagement_id = e.engagement_id AND engagement.organization_id = n.organization_id
    LEFT JOIN users subject ON subject.user_id = e.subject_user_id
    WHERE ${visible}${extra} ORDER BY n.notification_id DESC LIMIT ${limit + 1}`, params);
  const page = rows.slice(0, limit);
  res.json({ data: page.map(projectNotification), meta: { ...await summary(req), next_cursor: rows.length > limit ? page[page.length - 1].notification_id : null } });
}));

router.patch("/:id", [param("id").isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }), body("read").isBoolean({ strict: true })], asyncHandler(async (req, res) => {
  requireValid(req);
  const [result] = await pool.execute(`UPDATE notifications n ${joins}
    SET n.read_at = ${req.body.read ? "COALESCE(n.read_at, UTC_TIMESTAMP())" : "NULL"}
    WHERE ${visible} AND n.notification_id = ?`, [...contextParams(req), req.params.id]);
  if (!result.affectedRows) throw new AppError(404, "NOTIFICATION_NOT_FOUND", "That notification is no longer available.");
  res.json({ data: await summary(req), message: req.body.read ? "Notification marked read." : "Notification marked unread." });
}));

module.exports = router;
