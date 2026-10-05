"use strict";

const path = require("node:path");
const express = require("express");
const { body, param } = require("express-validator");
const config = require("../config");
const { pool } = require("../db");
const { ENGAGEMENT_TRANSITIONS, INVOICE_TRANSITIONS, canTransition } = require("../domain");
const { AppError, asyncHandler, requireAdmin, requireValid } = require("../http");

const router = express.Router();
router.use(requireAdmin);

const serviceRules = [
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Enter a service name."),
  body("slug").trim().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).isLength({ max: 120 }).withMessage("Use a lowercase hyphenated slug."),
  body("short_description").trim().isLength({ min: 10, max: 255 }).withMessage("Use 10 to 255 characters."),
  body("long_description").trim().isLength({ min: 20, max: 10000 }).withMessage("Use at least 20 characters."),
  body("category").trim().isLength({ min: 2, max: 100 }).withMessage("Enter a category."),
  body("delivery_method").trim().isLength({ min: 2, max: 150 }).withMessage("Enter a delivery method."),
  body("base_price").isFloat({ min: 0, max: 9999999999.99 }).withMessage("Enter a nonnegative price."),
  body("is_active").isBoolean().withMessage("Choose whether the service is active."),
];

const resourceRules = [
  body("title").trim().isLength({ min: 3, max: 200 }).withMessage("Use 3 to 200 characters."),
  body("slug").trim().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).isLength({ max: 220 }).withMessage("Use a lowercase hyphenated slug."),
  body("abstract").trim().isLength({ min: 20, max: 5000 }).withMessage("Use 20 to 5,000 characters."),
  body("category").isIn(["whitepaper", "case-study", "rule-set"]).withMessage("Choose a valid category."),
  body("published_at").isISO8601({ strict: true }).withMessage("Choose a valid publication date."),
  body("is_published").isBoolean().withMessage("Choose whether the resource is published."),
];

router.get("/services", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query("SELECT * FROM services ORDER BY service_id");
  res.json({ data: rows });
}));

router.post("/services", serviceRules, asyncHandler(async (req, res) => {
  requireValid(req);
  const value = req.body;
  const [result] = await pool.execute(
    `INSERT INTO services
      (name, slug, short_description, long_description, category, delivery_method, base_price, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [value.name, value.slug, value.short_description, value.long_description, value.category, value.delivery_method, value.base_price, value.is_active]
  );
  res.status(201).json({ data: { service_id: result.insertId }, message: "Service created." });
}));

router.put("/services/:id", [param("id").isInt({ min: 1 }), ...serviceRules], asyncHandler(async (req, res) => {
  requireValid(req);
  const value = req.body;
  const [result] = await pool.execute(
    `UPDATE services SET name = ?, slug = ?, short_description = ?, long_description = ?,
            category = ?, delivery_method = ?, base_price = ?, is_active = ?
      WHERE service_id = ?`,
    [value.name, value.slug, value.short_description, value.long_description, value.category, value.delivery_method, value.base_price, value.is_active, req.params.id]
  );
  if (!result.affectedRows) throw new AppError(404, "SERVICE_NOT_FOUND", "That service was not found.");
  res.json({ data: { service_id: Number(req.params.id) }, message: "Service updated." });
}));

router.delete("/services/:id", param("id").isInt({ min: 1 }), asyncHandler(async (req, res) => {
  requireValid(req);
  const [result] = await pool.execute("DELETE FROM services WHERE service_id = ?", [req.params.id]);
  if (!result.affectedRows) throw new AppError(404, "SERVICE_NOT_FOUND", "That service was not found.");
  res.json({ data: null, message: "Service deleted." });
}));

router.get("/resources", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query("SELECT * FROM resources ORDER BY published_at DESC, resource_id DESC");
  res.json({ data: rows });
}));

router.post("/resources", resourceRules, asyncHandler(async (req, res) => {
  requireValid(req);
  const value = req.body;
  const [result] = await pool.execute(
    `INSERT INTO resources (title, slug, abstract, category, published_at, is_published)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [value.title, value.slug, value.abstract, value.category, value.published_at, value.is_published]
  );
  res.status(201).json({ data: { resource_id: result.insertId }, message: "Resource created." });
}));

router.put("/resources/:id", [param("id").isInt({ min: 1 }), ...resourceRules], asyncHandler(async (req, res) => {
  requireValid(req);
  const value = req.body;
  const [result] = await pool.execute(
    `UPDATE resources SET title = ?, slug = ?, abstract = ?, category = ?,
            published_at = ?, is_published = ? WHERE resource_id = ?`,
    [value.title, value.slug, value.abstract, value.category, value.published_at, value.is_published, req.params.id]
  );
  if (!result.affectedRows) throw new AppError(404, "RESOURCE_NOT_FOUND", "That resource was not found.");
  res.json({ data: { resource_id: Number(req.params.id) }, message: "Resource updated." });
}));

router.delete("/resources/:id", param("id").isInt({ min: 1 }), asyncHandler(async (req, res) => {
  requireValid(req);
  const [result] = await pool.execute("DELETE FROM resources WHERE resource_id = ?", [req.params.id]);
  if (!result.affectedRows) throw new AppError(404, "RESOURCE_NOT_FOUND", "That resource was not found.");
  res.json({ data: null, message: "Resource deleted." });
}));

const adminEngagementQuery = `
  SELECT e.engagement_id, e.reference_code, e.scope_description, e.requested_start_at,
         e.billing_method, e.billing_email, e.purchase_order_number, e.status,
         e.price_snapshot, e.created_at, e.updated_at, e.organization_id,
         e.submitted_by_user_id, o.name AS company_name, o.name AS organization_name,
         u.full_name AS client_name, u.email AS client_email,
         s.name AS service_name, s.slug AS service_slug,
         i.amount AS invoice_amount, i.currency, i.status AS invoice_status,
         i.issued_at, i.paid_at
    FROM engagements e
    JOIN organizations o ON o.organization_id = e.organization_id
    JOIN users u ON u.user_id = e.submitted_by_user_id
    JOIN services s ON s.service_id = e.service_id
    JOIN invoices i ON i.engagement_id = e.engagement_id`;

router.get("/engagements", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(`${adminEngagementQuery} ORDER BY e.created_at DESC`);
  res.json({ data: rows });
}));

router.get("/engagements/:reference", asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(`${adminEngagementQuery} WHERE e.reference_code = ?`, [req.params.reference]);
  if (!rows.length) throw new AppError(404, "ENGAGEMENT_NOT_FOUND", "That engagement was not found.");
  const engagement = rows[0];
  const [targets] = await pool.execute(
    "SELECT target_value, sort_order FROM engagement_targets WHERE engagement_id = ? ORDER BY sort_order",
    [engagement.engagement_id]
  );
  const [history] = await pool.execute(
    `SELECT h.old_status, h.new_status, h.note, h.created_at, u.full_name AS changed_by_name
       FROM engagement_status_history h
       LEFT JOIN users u ON u.user_id = h.changed_by
      WHERE h.engagement_id = ? ORDER BY h.created_at, h.history_id`,
    [engagement.engagement_id]
  );
  res.json({ data: { ...engagement, targets, status_history: history } });
}));

router.patch(
  "/engagements/:reference/status",
  [
    body("status").isIn(Object.keys(ENGAGEMENT_TRANSITIONS)).withMessage("Choose a valid engagement status."),
    body("note").optional({ values: "falsy" }).trim().isLength({ max: 500 }).withMessage("Keep the note under 500 characters."),
  ],
  asyncHandler(async (req, res) => {
    requireValid(req);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        "SELECT engagement_id, status FROM engagements WHERE reference_code = ? FOR UPDATE",
        [req.params.reference]
      );
      if (!rows.length) throw new AppError(404, "ENGAGEMENT_NOT_FOUND", "That engagement was not found.");
      const oldStatus = rows[0].status;
      if (!canTransition(ENGAGEMENT_TRANSITIONS, oldStatus, req.body.status)) {
        throw new AppError(409, "INVALID_STATUS_TRANSITION", `A ${oldStatus} engagement cannot move to ${req.body.status}.`);
      }
      await connection.execute(
        `UPDATE engagements SET status = ?, cancelled_at = CASE WHEN ? = 'cancelled' THEN UTC_TIMESTAMP() ELSE cancelled_at END
          WHERE engagement_id = ?`,
        [req.body.status, req.body.status, rows[0].engagement_id]
      );
      if (req.body.status === "cancelled") {
        await connection.execute(
          "UPDATE invoices SET status = 'cancelled' WHERE engagement_id = ? AND status <> 'paid'",
          [rows[0].engagement_id]
        );
      }
      await connection.execute(
        `INSERT INTO engagement_status_history
          (engagement_id, old_status, new_status, changed_by, note)
         VALUES (?, ?, ?, ?, ?)`,
        [rows[0].engagement_id, oldStatus, req.body.status, req.session.user.user_id, req.body.note?.trim() || null]
      );
      await connection.commit();
      res.json({ data: { reference_code: req.params.reference, status: req.body.status }, message: "Engagement status updated." });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

router.patch(
  "/engagements/:reference/invoice",
  [
    body("status").isIn(Object.keys(INVOICE_TRANSITIONS)).withMessage("Choose a valid invoice status."),
    body("amount").isFloat({ min: 0, max: 9999999999.99 }).withMessage("Enter a nonnegative invoice amount."),
  ],
  asyncHandler(async (req, res) => {
    requireValid(req);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT i.invoice_id, i.status
           FROM invoices i JOIN engagements e ON e.engagement_id = i.engagement_id
          WHERE e.reference_code = ? FOR UPDATE`,
        [req.params.reference]
      );
      if (!rows.length) throw new AppError(404, "INVOICE_NOT_FOUND", "That invoice was not found.");
      if (!canTransition(INVOICE_TRANSITIONS, rows[0].status, req.body.status, true)) {
        throw new AppError(409, "INVALID_INVOICE_TRANSITION", `A ${rows[0].status} invoice cannot move to ${req.body.status}.`);
      }
      await connection.execute(
        `UPDATE invoices SET amount = ?, status = ?,
           issued_at = CASE WHEN ? = 'outstanding' AND issued_at IS NULL THEN UTC_TIMESTAMP() ELSE issued_at END,
           paid_at = CASE WHEN ? = 'paid' THEN UTC_TIMESTAMP() ELSE paid_at END
         WHERE invoice_id = ?`,
        [req.body.amount, req.body.status, req.body.status, req.body.status, rows[0].invoice_id]
      );
      await connection.commit();
      res.json({ data: { reference_code: req.params.reference, invoice_status: req.body.status }, message: "Invoice updated." });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

router.get("/engagements/:reference/authorization", asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT d.original_filename, d.stored_filename
       FROM authorization_documents d
       JOIN engagements e ON e.engagement_id = d.engagement_id
      WHERE e.reference_code = ?`,
    [req.params.reference]
  );
  if (!rows.length) throw new AppError(404, "DOCUMENT_NOT_FOUND", "The authorization document was not found.");
  res.download(path.join(config.uploadDir, rows[0].stored_filename), rows[0].original_filename);
}));

router.get("/inquiries", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT q.inquiry_id, q.full_name, q.email, q.company_name, q.message,
            q.status, q.reviewed_at, q.created_at, u.full_name AS reviewed_by_name
       FROM inquiries q LEFT JOIN users u ON u.user_id = q.reviewed_by
      ORDER BY q.created_at DESC`
  );
  res.json({ data: rows });
}));

router.patch(
  "/inquiries/:id/status",
  [param("id").isInt({ min: 1 }), body("status").isIn(["new", "reviewed", "closed"]).withMessage("Choose a valid inquiry status.")],
  asyncHandler(async (req, res) => {
    requireValid(req);
    const reviewed = req.body.status === "new" ? null : req.session.user.user_id;
    const [result] = await pool.execute(
      `UPDATE inquiries SET status = ?, reviewed_by = ?,
              reviewed_at = CASE WHEN ? = 'new' THEN NULL ELSE UTC_TIMESTAMP() END
        WHERE inquiry_id = ?`,
      [req.body.status, reviewed, req.body.status, req.params.id]
    );
    if (!result.affectedRows) throw new AppError(404, "INQUIRY_NOT_FOUND", "That inquiry was not found.");
    res.json({ data: { inquiry_id: Number(req.params.id), status: req.body.status }, message: "Inquiry updated." });
  })
);

router.delete("/inquiries/:id", param("id").isInt({ min: 1 }), asyncHandler(async (req, res) => {
  requireValid(req);
  const [result] = await pool.execute("DELETE FROM inquiries WHERE inquiry_id = ?", [req.params.id]);
  if (!result.affectedRows) throw new AppError(404, "INQUIRY_NOT_FOUND", "That inquiry was not found.");
  res.json({ data: null, message: "Inquiry deleted." });
}));

module.exports = router;
