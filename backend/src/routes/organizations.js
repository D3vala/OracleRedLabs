"use strict";

const crypto = require("node:crypto");
const express = require("express");
const { body, param, query } = require("express-validator");
const { pool } = require("../db");
const {
  AppError,
  asyncHandler,
  requireAuth,
  requireClient,
  requireValid,
} = require("../http");
const {
  permissionsForRole,
  requireOrganizationContext,
  requireOrganizationRoles,
} = require("../organization-context");

const organizationsRouter = express.Router();
const invitationsRouter = express.Router();
const ORGANIZATION_ROLES = ["owner", "manager", "member", "billing"];
const MANAGER_ASSIGNABLE_ROLES = ["manager", "member", "billing"];

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function invitationState(row) {
  if (row.status === "pending" && new Date(row.expires_at).getTime() <= Date.now()) return "expired";
  return row.status;
}

function assertInvitationUsable(row, email) {
  if (!row) throw new AppError(404, "INVITATION_NOT_FOUND", "That invitation is invalid or no longer available.");
  const state = invitationState(row);
  if (state === "expired") throw new AppError(410, "INVITATION_EXPIRED", "That invitation has expired.");
  if (state !== "pending") throw new AppError(409, "INVITATION_UNAVAILABLE", `That invitation is already ${state}.`);
  if (email && row.invited_email !== email.toLowerCase()) {
    throw new AppError(403, "INVITATION_EMAIL_MISMATCH", "This invitation belongs to a different email address.");
  }
}

async function acceptInvitation(req, selector, value) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT i.*, o.name AS organization_name, o.is_active
         FROM organization_invitations i
         JOIN organizations o ON o.organization_id = i.organization_id
        WHERE ${selector} = ? FOR UPDATE`,
      [value]
    );
    const invitation = rows[0];
    assertInvitationUsable(invitation, req.session.user.email);
    if (!invitation.is_active) {
      throw new AppError(409, "ORGANIZATION_INACTIVE", "That organization is not active.");
    }
    const [memberships] = await connection.execute(
      `SELECT role FROM organization_memberships
        WHERE organization_id = ? AND user_id = ? FOR UPDATE`,
      [invitation.organization_id, req.session.user.user_id]
    );
    if (memberships.length) {
      throw new AppError(409, "MEMBERSHIP_EXISTS", "You already belong to that organization.");
    }
    await connection.execute(
      `INSERT INTO organization_memberships
        (organization_id, user_id, role, invited_by_user_id)
       VALUES (?, ?, ?, ?)`,
      [invitation.organization_id, req.session.user.user_id, invitation.intended_role, invitation.invited_by_user_id]
    );
    await connection.execute(
      `UPDATE organization_invitations
          SET status = 'accepted', accepted_by_user_id = ?, accepted_at = UTC_TIMESTAMP()
        WHERE invitation_id = ?`,
      [req.session.user.user_id, invitation.invitation_id]
    );
    await connection.commit();
    req.session.activeOrganizationId = invitation.organization_id;
    return {
      organization_id: invitation.organization_id,
      name: invitation.organization_name,
      role: invitation.intended_role,
      permissions: permissionsForRole(invitation.intended_role),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

organizationsRouter.use(requireClient);

organizationsRouter.get("/", asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT o.organization_id, o.name, o.billing_email, m.role, m.joined_at,
            (o.organization_id = ?) AS is_active
       FROM organization_memberships m
       JOIN organizations o ON o.organization_id = m.organization_id
      WHERE m.user_id = ? AND o.is_active = TRUE
      ORDER BY m.joined_at, o.organization_id`,
    [req.session.activeOrganizationId || 0, req.session.user.user_id]
  );
  res.json({ data: rows.map((row) => ({ ...row, permissions: permissionsForRole(row.role) })) });
}));

organizationsRouter.patch(
  "/active",
  body("organization_id").isInt({ min: 1 }).withMessage("Choose an organization."),
  asyncHandler(async (req, res) => {
    requireValid(req);
    const [rows] = await pool.execute(
      `SELECT o.organization_id, o.name, o.billing_email, m.role
         FROM organization_memberships m
         JOIN organizations o ON o.organization_id = m.organization_id
        WHERE m.user_id = ? AND o.organization_id = ? AND o.is_active = TRUE`,
      [req.session.user.user_id, req.body.organization_id]
    );
    if (!rows.length) throw new AppError(404, "ORGANIZATION_NOT_FOUND", "That organization membership was not found.");
    req.session.activeOrganizationId = rows[0].organization_id;
    res.json({
      data: { ...rows[0], permissions: permissionsForRole(rows[0].role) },
      message: "Active organization changed.",
    });
  })
);

organizationsRouter.use("/current", requireOrganizationContext);

organizationsRouter.get("/current", (req, res) => {
  res.json({ data: req.organization });
});

organizationsRouter.patch(
  "/current",
  requireOrganizationRoles("owner"),
  [
    body("name").trim().isLength({ min: 2, max: 150 }).withMessage("Use 2 to 150 characters for the organization name."),
    body("billing_email").optional({ values: "falsy" }).trim().isEmail().normalizeEmail().withMessage("Enter a valid billing email address."),
  ],
  asyncHandler(async (req, res) => {
    requireValid(req);
    await pool.execute(
      "UPDATE organizations SET name = ?, billing_email = ? WHERE organization_id = ?",
      [req.body.name.trim(), req.body.billing_email?.toLowerCase() || null, req.organization.organization_id]
    );
    res.json({
      data: { ...req.organization, name: req.body.name.trim(), billing_email: req.body.billing_email?.toLowerCase() || null },
      message: "Organization details updated.",
    });
  })
);

organizationsRouter.get("/current/members", asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT u.user_id, u.full_name, u.email, m.role, m.joined_at
       FROM organization_memberships m
       JOIN users u ON u.user_id = m.user_id
      WHERE m.organization_id = ? AND u.is_active = TRUE
      ORDER BY FIELD(m.role, 'owner', 'manager', 'member', 'billing'), u.full_name, u.user_id`,
    [req.organization.organization_id]
  );
  const maySeeEmail = req.organization.permissions.can_view_member_emails;
  res.json({ data: rows.map((row) => maySeeEmail ? row : ({ ...row, email: undefined })) });
}));

organizationsRouter.patch(
  "/current/members/:userId",
  requireOrganizationRoles("owner", "manager"),
  [
    param("userId").isInt({ min: 1 }).withMessage("Choose a member."),
    body("role").isIn(ORGANIZATION_ROLES).withMessage("Choose a valid organization role."),
  ],
  asyncHandler(async (req, res) => {
    requireValid(req);
    const targetUserId = Number(req.params.userId);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [targets] = await connection.execute(
        `SELECT m.role, u.full_name, u.is_active
           FROM organization_memberships m JOIN users u ON u.user_id = m.user_id
          WHERE m.organization_id = ? AND m.user_id = ? FOR UPDATE`,
        [req.organization.organization_id, targetUserId]
      );
      if (!targets.length) throw new AppError(404, "MEMBERSHIP_NOT_FOUND", "That organization membership was not found.");
      const oldRole = targets[0].role;
      const newRole = req.body.role;
      if (req.organization.role === "manager") {
        if (!["member", "billing"].includes(oldRole) || !MANAGER_ASSIGNABLE_ROLES.includes(newRole)) {
          throw new AppError(403, "ORGANIZATION_PERMISSION_DENIED", "Managers may change only member or billing memberships and cannot assign the owner role.");
        }
      }
      if (oldRole === "owner" && newRole !== "owner" && targets[0].is_active) {
        const [owners] = await connection.execute(
          `SELECT m.user_id FROM organization_memberships m
           JOIN users u ON u.user_id = m.user_id
            WHERE m.organization_id = ? AND m.role = 'owner' AND u.is_active = TRUE FOR UPDATE`,
          [req.organization.organization_id]
        );
        if (owners.length <= 1) throw new AppError(409, "FINAL_OWNER_REQUIRED", "The final active owner cannot be demoted.");
      }
      await connection.execute(
        "UPDATE organization_memberships SET role = ? WHERE organization_id = ? AND user_id = ?",
        [newRole, req.organization.organization_id, targetUserId]
      );
      await connection.commit();
      res.json({ data: { user_id: targetUserId, role: newRole }, message: `${targets[0].full_name}'s role was updated.` });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

organizationsRouter.delete(
  "/current/members/:userId",
  requireOrganizationRoles("owner", "manager"),
  param("userId").isInt({ min: 1 }).withMessage("Choose a member."),
  asyncHandler(async (req, res) => {
    requireValid(req);
    const targetUserId = Number(req.params.userId);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [targets] = await connection.execute(
        `SELECT m.role, u.full_name, u.is_active
           FROM organization_memberships m JOIN users u ON u.user_id = m.user_id
          WHERE m.organization_id = ? AND m.user_id = ? FOR UPDATE`,
        [req.organization.organization_id, targetUserId]
      );
      if (!targets.length) throw new AppError(404, "MEMBERSHIP_NOT_FOUND", "That organization membership was not found.");
      if (req.organization.role === "manager" && !["member", "billing"].includes(targets[0].role)) {
        throw new AppError(403, "ORGANIZATION_PERMISSION_DENIED", "Managers may remove only member or billing memberships.");
      }
      if (targets[0].role === "owner" && targets[0].is_active) {
        const [owners] = await connection.execute(
          `SELECT m.user_id FROM organization_memberships m
           JOIN users u ON u.user_id = m.user_id
            WHERE m.organization_id = ? AND m.role = 'owner' AND u.is_active = TRUE FOR UPDATE`,
          [req.organization.organization_id]
        );
        if (owners.length <= 1) throw new AppError(409, "FINAL_OWNER_REQUIRED", "The final active owner cannot be removed.");
      }
      await connection.execute(
        "DELETE FROM organization_memberships WHERE organization_id = ? AND user_id = ?",
        [req.organization.organization_id, targetUserId]
      );
      await connection.commit();
      if (targetUserId === req.session.user.user_id) req.session.activeOrganizationId = null;
      res.json({ data: null, message: `${targets[0].full_name} was removed from the organization.` });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

organizationsRouter.get(
  "/current/invitations",
  requireOrganizationRoles("owner", "manager"),
  asyncHandler(async (req, res) => {
    await pool.execute(
      `UPDATE organization_invitations SET status = 'expired'
        WHERE organization_id = ? AND status = 'pending' AND expires_at <= UTC_TIMESTAMP()`,
      [req.organization.organization_id]
    );
    const [rows] = await pool.execute(
      `SELECT i.invitation_id, i.invited_email, i.intended_role, i.status,
              i.expires_at, i.created_at, u.full_name AS invited_by_name
         FROM organization_invitations i
         JOIN users u ON u.user_id = i.invited_by_user_id
        WHERE i.organization_id = ? AND i.status = 'pending'
        ORDER BY i.created_at DESC`,
      [req.organization.organization_id]
    );
    res.json({ data: rows });
  })
);

organizationsRouter.post(
  "/current/invitations",
  requireOrganizationRoles("owner", "manager"),
  [
    body("email").trim().isEmail().normalizeEmail().withMessage("Enter a valid email address."),
    body("role").isIn(ORGANIZATION_ROLES).withMessage("Choose a valid organization role."),
  ],
  asyncHandler(async (req, res) => {
    requireValid(req);
    const email = req.body.email.toLowerCase();
    const role = req.body.role;
    if (req.organization.role === "manager" && !MANAGER_ASSIGNABLE_ROLES.includes(role)) {
      throw new AppError(403, "ORGANIZATION_PERMISSION_DENIED", "Managers cannot invite organization owners.");
    }
    const connection = await pool.getConnection();
    const token = crypto.randomBytes(32).toString("hex");
    try {
      await connection.beginTransaction();
      await connection.execute(
        "SELECT organization_id FROM organizations WHERE organization_id = ? FOR UPDATE",
        [req.organization.organization_id]
      );
      await connection.execute(
        `UPDATE organization_invitations SET status = 'expired'
          WHERE organization_id = ? AND status = 'pending' AND expires_at <= UTC_TIMESTAMP()`,
        [req.organization.organization_id]
      );
      const [existingMembers] = await connection.execute(
        `SELECT m.user_id FROM organization_memberships m
         JOIN users u ON u.user_id = m.user_id
        WHERE m.organization_id = ? AND u.email = ?`,
        [req.organization.organization_id, email]
      );
      if (existingMembers.length) throw new AppError(409, "MEMBERSHIP_EXISTS", "That email already belongs to this organization.");
      const [pending] = await connection.execute(
        `SELECT invitation_id FROM organization_invitations
          WHERE organization_id = ? AND invited_email = ? AND status = 'pending' FOR UPDATE`,
        [req.organization.organization_id, email]
      );
      if (pending.length) throw new AppError(409, "INVITATION_EXISTS", "A pending invitation already exists for that email.");
      const [accounts] = await connection.execute("SELECT user_id FROM users WHERE email = ?", [email]);
      const [result] = await connection.execute(
        `INSERT INTO organization_invitations
          (organization_id, invited_email, intended_role, token_hash, invited_by_user_id, expires_at)
         VALUES (?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))`,
        [req.organization.organization_id, email, role, tokenHash(token), req.session.user.user_id]
      );
      await connection.commit();
      res.status(201).json({
        data: {
          invitation_id: result.insertId,
          invited_email: email,
          intended_role: role,
          account_exists: accounts.length > 0,
          invitation_url: accounts.length ? null : `accept-invitation.html?token=${token}`,
        },
        message: accounts.length
          ? "Invitation created. The user can accept it from their organization page."
          : "Invitation created. Copy the link now; it cannot be shown again.",
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

organizationsRouter.delete(
  "/current/invitations/:invitationId",
  requireOrganizationRoles("owner", "manager"),
  param("invitationId").isInt({ min: 1 }).withMessage("Choose an invitation."),
  asyncHandler(async (req, res) => {
    requireValid(req);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT intended_role, status FROM organization_invitations
          WHERE invitation_id = ? AND organization_id = ? FOR UPDATE`,
        [req.params.invitationId, req.organization.organization_id]
      );
      if (!rows.length) throw new AppError(404, "INVITATION_NOT_FOUND", "That invitation was not found.");
      if (rows[0].status !== "pending") throw new AppError(409, "INVITATION_UNAVAILABLE", "Only pending invitations can be cancelled.");
      if (req.organization.role === "manager" && rows[0].intended_role === "owner") {
        throw new AppError(403, "ORGANIZATION_PERMISSION_DENIED", "Managers cannot cancel owner invitations.");
      }
      await connection.execute(
        `UPDATE organization_invitations
            SET status = 'cancelled', cancelled_by_user_id = ?, cancelled_at = UTC_TIMESTAMP()
          WHERE invitation_id = ?`,
        [req.session.user.user_id, req.params.invitationId]
      );
      await connection.commit();
      res.json({ data: null, message: "Invitation cancelled." });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

invitationsRouter.get(
  "/preview",
  query("token").isHexadecimal().isLength({ min: 64, max: 64 }).withMessage("Use a valid invitation link."),
  asyncHandler(async (req, res) => {
    requireValid(req);
    const [rows] = await pool.execute(
      `SELECT i.invited_email, i.intended_role, i.status, i.expires_at,
              o.name AS organization_name
         FROM organization_invitations i
         JOIN organizations o ON o.organization_id = i.organization_id
        WHERE i.token_hash = ?`,
      [tokenHash(req.query.token)]
    );
    assertInvitationUsable(rows[0]);
    res.json({
      data: {
        organization_name: rows[0].organization_name,
        intended_role: rows[0].intended_role,
        expires_at: rows[0].expires_at,
      },
    });
  })
);

invitationsRouter.post(
  "/accept",
  requireClient,
  body("token").isHexadecimal().isLength({ min: 64, max: 64 }).withMessage("Use a valid invitation link."),
  asyncHandler(async (req, res) => {
    requireValid(req);
    const organization = await acceptInvitation(req, "i.token_hash", tokenHash(req.body.token));
    res.json({ data: organization, message: `You joined ${organization.name}.` });
  })
);

invitationsRouter.get("/received", requireAuth, asyncHandler(async (req, res) => {
  if (req.session.user.role !== "client") return res.json({ data: [] });
  await pool.execute(
    `UPDATE organization_invitations SET status = 'expired'
      WHERE invited_email = ? AND status = 'pending' AND expires_at <= UTC_TIMESTAMP()`,
    [req.session.user.email]
  );
  const [rows] = await pool.execute(
    `SELECT i.invitation_id, i.intended_role, i.expires_at, i.created_at,
            o.organization_id, o.name AS organization_name,
            u.full_name AS invited_by_name
       FROM organization_invitations i
       JOIN organizations o ON o.organization_id = i.organization_id
       JOIN users u ON u.user_id = i.invited_by_user_id
      WHERE i.invited_email = ? AND i.status = 'pending' AND o.is_active = TRUE
      ORDER BY i.created_at DESC`,
    [req.session.user.email]
  );
  res.json({ data: rows });
}));

invitationsRouter.post(
  "/received/:invitationId/accept",
  requireClient,
  param("invitationId").isInt({ min: 1 }).withMessage("Choose an invitation."),
  asyncHandler(async (req, res) => {
    requireValid(req);
    const organization = await acceptInvitation(req, "i.invitation_id", req.params.invitationId);
    res.json({ data: organization, message: `You joined ${organization.name}.` });
  })
);

module.exports = { organizationsRouter, invitationsRouter };
