"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const express = require("express");
const multer = require("multer");
const config = require("../config");
const { pool } = require("../db");
const { AppError, asyncHandler, requireClient } = require("../http");

const router = express.Router();
fs.mkdir(config.uploadDir, { recursive: true }).catch(console.error);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, config.uploadDir),
    filename: (_req, _file, callback) => callback(null, `${crypto.randomUUID()}.pdf`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== "application/pdf") {
      return callback(new AppError(422, "INVALID_FILE_TYPE", "The authorization document must be a PDF."));
    }
    callback(null, true);
  },
});

function mysqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function field(body, canonical, legacy) {
  return body[canonical] ?? body[legacy];
}

function validateEngagement(req) {
  const fields = {};
  const serviceSlug = field(req.body, "service_slug", "service");
  const scope = field(req.body, "scope_description", "scope")?.trim();
  const targetText = field(req.body, "targets", "targets") || "";
  const targets = targetText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const requestedStart = new Date(field(req.body, "requested_start_at", "requested-slot"));
  const billingMethodRaw = field(req.body, "billing_method", "payment-method");
  const billingMethod = billingMethodRaw === "card" ? "card_link" : billingMethodRaw === "po" ? "purchase_order" : billingMethodRaw;
  const billingEmail = field(req.body, "billing_email", "billing-email")?.trim().toLowerCase();
  const poNumber = field(req.body, "purchase_order_number", "po-number")?.trim() || null;
  const ack = field(req.body, "authorization_ack", "authorization-ack");

  if (!serviceSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(serviceSlug) || serviceSlug.length > 120) {
    fields.service = "Choose an active service.";
  }
  if (!scope || scope.length < 40 || scope.length > 5000) fields.scope = "Use 40 to 5,000 characters for the scope.";
  if (!targets.length || targets.length > 100 || targets.some((value) => value.length > 255)) {
    fields.targets = "List 1 to 100 targets, one per line, with no line over 255 characters.";
  }
  if (Number.isNaN(requestedStart.getTime()) || requestedStart.getTime() < Date.now() + 24 * 60 * 60 * 1000) {
    fields["requested-slot"] = "Choose a start time at least 24 hours from now.";
  }
  if (!["invoice", "card_link", "purchase_order"].includes(billingMethod)) {
    fields["payment-method"] = "Choose a billing preference.";
  }
  if (!billingEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail) || billingEmail.length > 254) {
    fields["billing-email"] = "Enter a valid billing email address.";
  }
  if (billingMethod === "purchase_order" && !poNumber) fields["po-number"] = "Enter the purchase order number.";
  if (poNumber && poNumber.length > 100) fields["po-number"] = "Keep the purchase order number under 100 characters.";
  if (!(ack === true || ack === "true" || ack === "on")) fields["authorization-ack"] = "Confirm the signed authorization.";
  if (!req.file) fields.authorization = "Attach the signed authorization PDF.";
  if (req.file && path.basename(req.file.originalname).length > 255) {
    fields.authorization = "Use a PDF filename no longer than 255 characters.";
  }

  if (Object.keys(fields).length) {
    throw new AppError(422, "VALIDATION_ERROR", "Check the highlighted fields.", fields);
  }
  return { serviceSlug, scope, targets, requestedStart, billingMethod, billingEmail, poNumber };
}

async function verifyPdf(filePath) {
  const handle = await fs.open(filePath, "r");
  try {
    const header = Buffer.alloc(5);
    await handle.read(header, 0, 5, 0);
    if (header.toString("ascii") !== "%PDF-") {
      throw new AppError(422, "INVALID_PDF", "The uploaded file is not a valid PDF document.", {
        authorization: "Choose a valid PDF file.",
      });
    }
  } finally {
    await handle.close();
  }
}

async function referenceCode(connection) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = `ORL-${String(crypto.randomInt(0, 1000000)).padStart(6, "0")}`;
    const [rows] = await connection.execute("SELECT engagement_id FROM engagements WHERE reference_code = ?", [code]);
    if (!rows.length) return code;
  }
  throw new AppError(503, "REFERENCE_UNAVAILABLE", "A reference could not be allocated. Try again.");
}

async function sha256(filePath) {
  const contents = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(contents).digest("hex");
}

const baseListQuery = `
  SELECT e.engagement_id, e.reference_code, e.scope_description,
         e.requested_start_at, e.billing_method, e.billing_email,
         e.purchase_order_number, e.status, e.price_snapshot,
         e.cancelled_at, e.created_at, e.updated_at,
         s.service_id, s.name AS service_name, s.slug AS service_slug,
         i.invoice_id, i.amount AS invoice_amount, i.currency,
         i.status AS invoice_status, i.issued_at, i.paid_at
    FROM engagements e
    JOIN services s ON s.service_id = e.service_id
    JOIN invoices i ON i.engagement_id = e.engagement_id`;

async function loadClientEngagement(reference, userId) {
  const [rows] = await pool.execute(
    `${baseListQuery} WHERE e.reference_code = ? AND e.client_user_id = ?`,
    [reference, userId]
  );
  if (!rows.length) throw new AppError(404, "ENGAGEMENT_NOT_FOUND", "That engagement was not found.");
  const engagement = rows[0];
  const [targets] = await pool.execute(
    "SELECT target_value, sort_order FROM engagement_targets WHERE engagement_id = ? ORDER BY sort_order",
    [engagement.engagement_id]
  );
  const [history] = await pool.execute(
    `SELECT old_status, new_status, note, created_at
       FROM engagement_status_history
      WHERE engagement_id = ? ORDER BY created_at, history_id`,
    [engagement.engagement_id]
  );
  return { ...engagement, targets, status_history: history };
}

router.use(requireClient);

router.post("/", upload.single("authorization"), asyncHandler(async (req, res) => {
  const values = validateEngagement(req);
  await verifyPdf(req.file.path);
  const digest = await sha256(req.file.path);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [services] = await connection.execute(
      "SELECT service_id, base_price FROM services WHERE slug = ? AND is_active = TRUE FOR UPDATE",
      [values.serviceSlug]
    );
    if (!services.length) {
      throw new AppError(422, "SERVICE_UNAVAILABLE", "The selected service is no longer available.", {
        service: "Choose an active service.",
      });
    }
    const service = services[0];
    const reference = await referenceCode(connection);
    const [engagementResult] = await connection.execute(
      `INSERT INTO engagements
        (reference_code, client_user_id, service_id, scope_description,
         requested_start_at, billing_method, billing_email,
         purchase_order_number, price_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        req.session.user.user_id,
        service.service_id,
        values.scope,
        mysqlDate(values.requestedStart),
        values.billingMethod,
        values.billingEmail,
        values.poNumber,
        service.base_price,
      ]
    );
    const engagementId = engagementResult.insertId;
    for (let index = 0; index < values.targets.length; index += 1) {
      await connection.execute(
        "INSERT INTO engagement_targets (engagement_id, target_value, sort_order) VALUES (?, ?, ?)",
        [engagementId, values.targets[index], index + 1]
      );
    }
    await connection.execute(
      `INSERT INTO authorization_documents
        (engagement_id, original_filename, stored_filename, mime_type, file_size_bytes, sha256)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [engagementId, path.basename(req.file.originalname), req.file.filename, req.file.mimetype, req.file.size, digest]
    );
    await connection.execute(
      "INSERT INTO invoices (engagement_id, amount) VALUES (?, ?)",
      [engagementId, service.base_price]
    );
    await connection.execute(
      `INSERT INTO engagement_status_history
        (engagement_id, old_status, new_status, changed_by, note)
       VALUES (?, NULL, 'pending', ?, 'Engagement request submitted.')`,
      [engagementId, req.session.user.user_id]
    );
    await connection.commit();
    res.status(201).json({ data: { reference_code: reference, status: "pending" }, message: "Engagement request submitted." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

router.get("/", asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `${baseListQuery} WHERE e.client_user_id = ? ORDER BY e.created_at DESC`,
    [req.session.user.user_id]
  );
  res.json({ data: rows });
}));

router.get("/:reference", asyncHandler(async (req, res) => {
  res.json({ data: await loadClientEngagement(req.params.reference, req.session.user.user_id) });
}));

router.patch("/:reference/cancel", asyncHandler(async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT engagement_id, status FROM engagements
        WHERE reference_code = ? AND client_user_id = ? FOR UPDATE`,
      [req.params.reference, req.session.user.user_id]
    );
    if (!rows.length) throw new AppError(404, "ENGAGEMENT_NOT_FOUND", "That engagement was not found.");
    if (!["pending", "scoping"].includes(rows[0].status)) {
      throw new AppError(409, "CANNOT_CANCEL", "Only pending or scoping engagements can be cancelled online.");
    }
    await connection.execute(
      "UPDATE engagements SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP() WHERE engagement_id = ?",
      [rows[0].engagement_id]
    );
    await connection.execute(
      "UPDATE invoices SET status = 'cancelled' WHERE engagement_id = ? AND status <> 'paid'",
      [rows[0].engagement_id]
    );
    await connection.execute(
      `INSERT INTO engagement_status_history
        (engagement_id, old_status, new_status, changed_by, note)
       VALUES (?, ?, 'cancelled', ?, 'Cancelled by client.')`,
      [rows[0].engagement_id, rows[0].status, req.session.user.user_id]
    );
    await connection.commit();
    res.json({ data: { reference_code: req.params.reference, status: "cancelled" }, message: "Engagement cancelled." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

module.exports = router;
