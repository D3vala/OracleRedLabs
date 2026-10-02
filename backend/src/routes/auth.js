"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const { body } = require("express-validator");
const { pool } = require("../db");
const {
  AppError,
  asyncHandler,
  requireValid,
  ensureCsrfToken,
  requireAuth,
} = require("../http");

const router = express.Router();

function publicUser(row) {
  return {
    user_id: row.user_id,
    full_name: row.full_name,
    email: row.email,
    company_name: row.company_name,
    role: row.role,
  };
}

router.get("/csrf-token", (req, res) => {
  res.json({ data: { csrf_token: ensureCsrfToken(req) } });
});

router.post(
  "/register",
  [
    body("full_name").trim().isLength({ min: 2, max: 100 }).withMessage("Enter your full name."),
    body("email").trim().isEmail().normalizeEmail().withMessage("Enter a valid email address."),
    body("company_name").trim().isLength({ min: 2, max: 150 }).withMessage("Enter your company name."),
    body("password").isLength({ min: 12, max: 72 }).withMessage("Use a password between 12 and 72 characters."),
    body("authorization_ack").equals("true").withMessage("Confirm that you are authorized to request testing."),
  ],
  asyncHandler(async (req, res) => {
    requireValid(req);
    const email = req.body.email.toLowerCase();
    const [existing] = await pool.execute("SELECT user_id FROM users WHERE email = ?", [email]);
    if (existing.length) {
      throw new AppError(409, "EMAIL_EXISTS", "An account already uses this email.", {
        email: "Use a different email or sign in.",
      });
    }

    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const [result] = await pool.execute(
      `INSERT INTO users (full_name, email, company_name, password_hash)
       VALUES (?, ?, ?, ?)`,
      [req.body.full_name.trim(), email, req.body.company_name.trim(), passwordHash]
    );
    const user = {
      user_id: result.insertId,
      full_name: req.body.full_name.trim(),
      email,
      company_name: req.body.company_name.trim(),
      role: "client",
    };
    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
    req.session.user = user;
    req.session.csrfToken = require("node:crypto").randomBytes(32).toString("hex");
    res.status(201).json({ data: { user, csrf_token: req.session.csrfToken }, message: "Account created." });
  })
);

router.post(
  "/login",
  [
    body("email").trim().isEmail().normalizeEmail().withMessage("Enter a valid email address."),
    body("password").isString().notEmpty().withMessage("Enter your password."),
  ],
  asyncHandler(async (req, res) => {
    requireValid(req);
    const [rows] = await pool.execute(
      `SELECT user_id, full_name, email, company_name, password_hash, role, is_active
         FROM users WHERE email = ?`,
      [req.body.email.toLowerCase()]
    );
    const row = rows[0];
    const valid = row && row.is_active && await bcrypt.compare(req.body.password, row.password_hash);
    if (!valid) {
      throw new AppError(401, "LOGIN_FAILED", "The email or password is incorrect.");
    }
    const user = publicUser(row);
    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
    req.session.user = user;
    req.session.csrfToken = require("node:crypto").randomBytes(32).toString("hex");
    await pool.execute("UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE user_id = ?", [user.user_id]);
    res.json({ data: { user, csrf_token: req.session.csrfToken }, message: "Signed in." });
  })
);

router.post("/logout", requireAuth, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("orl.sid");
    res.json({ data: null, message: "Signed out." });
  });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ data: { user: req.session.user } });
});

module.exports = router;
