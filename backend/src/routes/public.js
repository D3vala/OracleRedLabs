"use strict";

const express = require("express");
const { body } = require("express-validator");
const { pool } = require("../db");
const { asyncHandler, requireValid } = require("../http");

const router = express.Router();

router.get("/services", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT service_id, name, slug, short_description, long_description,
            category, delivery_method, base_price
       FROM services
      WHERE is_active = TRUE
      ORDER BY service_id`
  );
  res.json({ data: rows });
}));

router.get("/resources", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT resource_id, title, slug, abstract, category, published_at
       FROM resources
      WHERE is_published = TRUE
      ORDER BY published_at DESC, resource_id DESC`
  );
  res.json({ data: rows });
}));

router.post(
  "/inquiries",
  [
    body("full_name").trim().isLength({ min: 2, max: 100 }).withMessage("Enter your full name."),
    body("email").trim().isEmail().normalizeEmail().withMessage("Enter a valid email address."),
    body("company_name").trim().isLength({ min: 2, max: 150 }).withMessage("Enter your company name."),
    body("message").trim().isLength({ min: 20, max: 5000 }).withMessage("Enter a message between 20 and 5,000 characters."),
  ],
  asyncHandler(async (req, res) => {
    requireValid(req);
    const { full_name, email, company_name, message } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO inquiries (full_name, email, company_name, message)
       VALUES (?, ?, ?, ?)`,
      [full_name.trim(), email.toLowerCase(), company_name.trim(), message.trim()]
    );
    res.status(201).json({
      data: { inquiry_id: result.insertId, status: "new" },
      message: "Your inquiry has been received.",
    });
  })
);

module.exports = router;
