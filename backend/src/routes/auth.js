"use strict";

const crypto = require("node:crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const { body } = require("express-validator");
const { pool } = require("../db");
const { createEvent, cancelInvitationMail } = require("../notifications");
const {
  AppError,
  asyncHandler,
  requireValid,
  ensureCsrfToken,
  requireAuth,
} = require("../http");
const { loadActiveMembership, organizationPayload } = require("../organization-context");

const router = express.Router();

function invitationHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicUser(row, membership) {
  return {
    user_id: row.user_id,
    full_name: row.full_name,
    email: row.email,
    company_name: row.company_name,
    role: row.role,
    active_organization: organizationPayload(membership),
  };
}

async function establishSession(req, user, membership) {
  await new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
  req.session.user = publicUser(user, membership);
  req.session.activeOrganizationId = membership?.organization_id || null;
  req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  return req.session.user;
}

function validateInvitation(invitation, email) {
  if (!invitation) throw new AppError(404, "INVITATION_NOT_FOUND", "That invitation is invalid or no longer available.");
  if (invitation.status !== "pending") {
    throw new AppError(409, "INVITATION_UNAVAILABLE", `That invitation is already ${invitation.status}.`);
  }
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    throw new AppError(410, "INVITATION_EXPIRED", "That invitation has expired.");
  }
  if (!invitation.is_active) throw new AppError(409, "ORGANIZATION_INACTIVE", "That organization is not active.");
  if (invitation.invited_email !== email) {
    throw new AppError(403, "INVITATION_EMAIL_MISMATCH", "Register with the email address that received this invitation.", {
      email: "Use the invited email address.",
    });
  }
}

router.get("/csrf-token", (req, res) => {
  res.json({ data: { csrf_token: ensureCsrfToken(req) } });
});

router.post(
  "/register",
  [
    body("full_name").trim().isLength({ min: 2, max: 100 }).withMessage("Enter your full name."),
    body("email").trim().isEmail().normalizeEmail().withMessage("Enter a valid email address."),
    body("company_name").custom((value, { req }) => {
      if (req.body.invitation_token) return true;
      return typeof value === "string" && value.trim().length >= 2 && value.trim().length <= 150;
    }).withMessage("Enter your company name."),
    body("password").isLength({ min: 12, max: 72 }).withMessage("Use a password between 12 and 72 characters."),
    body("authorization_ack").equals("true").withMessage("Confirm that you are authorized to request testing."),
    body("invitation_token").optional({ values: "falsy" }).isHexadecimal().isLength({ min: 64, max: 64 }).withMessage("Use a valid invitation link."),
  ],
  asyncHandler(async (req, res) => {
    requireValid(req);
    const email = req.body.email.toLowerCase();
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const connection = await pool.getConnection();
    let user;
    let membership;
    try {
      await connection.beginTransaction();
      const [existing] = await connection.execute("SELECT user_id FROM users WHERE email = ? FOR UPDATE", [email]);
      if (existing.length) {
        throw new AppError(409, "EMAIL_EXISTS", "An account already uses this email.", {
          email: "Use a different email or sign in.",
        });
      }

      let invitation = null;
      if (req.body.invitation_token) {
        const [invitations] = await connection.execute(
          `SELECT i.*, o.name AS organization_name, o.billing_email, o.is_active
             FROM organization_invitations i
             JOIN organizations o ON o.organization_id = i.organization_id
            WHERE i.token_hash = ? FOR UPDATE`,
          [invitationHash(req.body.invitation_token)]
        );
        invitation = invitations[0];
        validateInvitation(invitation, email);
      }

      const companyName = invitation ? invitation.organization_name : req.body.company_name.trim();
      const [result] = await connection.execute(
        `INSERT INTO users (full_name, email, company_name, password_hash)
         VALUES (?, ?, ?, ?)`,
        [req.body.full_name.trim(), email, companyName, passwordHash]
      );
      user = {
        user_id: result.insertId,
        full_name: req.body.full_name.trim(),
        email,
        company_name: companyName,
        role: "client",
      };

      if (invitation) {
        await connection.execute(
          `INSERT INTO organization_memberships
            (organization_id, user_id, role, invited_by_user_id)
           VALUES (?, ?, ?, ?)`,
          [invitation.organization_id, user.user_id, invitation.intended_role, invitation.invited_by_user_id]
        );
        await connection.execute(
          `UPDATE organization_invitations
              SET status = 'accepted', accepted_by_user_id = ?, accepted_at = UTC_TIMESTAMP()
            WHERE invitation_id = ?`,
          [user.user_id, invitation.invitation_id]
        );
        await cancelInvitationMail(connection, invitation.invitation_id);
        await createEvent(connection, { type: "invitation_accepted", organizationId: invitation.organization_id,
          actorUserId: user.user_id, subjectUserId: user.user_id, invitationId: invitation.invitation_id,
          sourceKey: `invitation:${invitation.invitation_id}:accepted` });
        membership = {
          organization_id: invitation.organization_id,
          name: invitation.organization_name,
          billing_email: invitation.billing_email,
          role: invitation.intended_role,
        };
      } else {
        const [organizationResult] = await connection.execute(
          "INSERT INTO organizations (name, billing_email) VALUES (?, ?)",
          [companyName, email]
        );
        await connection.execute(
          `INSERT INTO organization_memberships (organization_id, user_id, role)
           VALUES (?, ?, 'owner')`,
          [organizationResult.insertId, user.user_id]
        );
        membership = {
          organization_id: organizationResult.insertId,
          name: companyName,
          billing_email: email,
          role: "owner",
        };
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const sessionUser = await establishSession(req, user, membership);
    res.status(201).json({
      data: { user: sessionUser, csrf_token: req.session.csrfToken },
      message: req.body.invitation_token ? "Account created and invitation accepted." : "Account created.",
    });
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
    if (!valid) throw new AppError(401, "LOGIN_FAILED", "The email or password is incorrect.");

    const membership = row.role === "client" ? await loadActiveMembership(null, row.user_id, null) : null;
    if (row.role === "client" && !membership) {
      throw new AppError(403, "ORG_CONTEXT_REQUIRED", "No active organization membership is available for this account.");
    }
    const user = await establishSession(req, row, membership);
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

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT user_id, full_name, email, company_name, role, is_active
       FROM users WHERE user_id = ?`,
    [req.session.user.user_id]
  );
  const row = rows[0];
  if (!row || !row.is_active) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
  const membership = row.role === "client"
    ? await loadActiveMembership(null, row.user_id, req.session.activeOrganizationId)
    : null;
  if (row.role === "client" && !membership) {
    throw new AppError(403, "ORG_CONTEXT_REQUIRED", "No active organization membership is available for this account.");
  }
  req.session.activeOrganizationId = membership?.organization_id || null;
  req.session.user = publicUser(row, membership);
  res.json({ data: { user: req.session.user } });
}));

module.exports = router;
