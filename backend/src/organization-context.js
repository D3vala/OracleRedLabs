"use strict";

const { pool } = require("./db");
const { AppError } = require("./http");

const ROLE_PERMISSIONS = Object.freeze({
  owner: Object.freeze({
    can_view_engagements: true,
    can_view_full_engagements: true,
    can_view_invoices: true,
    can_submit_engagements: true,
    can_cancel_engagements: true,
    can_manage_organization: true,
    can_invite_members: true,
    can_manage_members: true,
    can_view_member_emails: true,
    can_view_pending_invitations: true,
  }),
  manager: Object.freeze({
    can_view_engagements: true,
    can_view_full_engagements: true,
    can_view_invoices: true,
    can_submit_engagements: true,
    can_cancel_engagements: true,
    can_manage_organization: false,
    can_invite_members: true,
    can_manage_members: true,
    can_view_member_emails: true,
    can_view_pending_invitations: true,
  }),
  member: Object.freeze({
    can_view_engagements: true,
    can_view_full_engagements: true,
    can_view_invoices: false,
    can_submit_engagements: true,
    can_cancel_engagements: true,
    can_manage_organization: false,
    can_invite_members: false,
    can_manage_members: false,
    can_view_member_emails: false,
    can_view_pending_invitations: false,
  }),
  billing: Object.freeze({
    can_view_engagements: true,
    can_view_full_engagements: false,
    can_view_invoices: true,
    can_submit_engagements: false,
    can_cancel_engagements: false,
    can_manage_organization: false,
    can_invite_members: false,
    can_manage_members: false,
    can_view_member_emails: false,
    can_view_pending_invitations: false,
  }),
});

function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || {};
}

async function loadActiveMembership(connection, userId, preferredOrganizationId) {
  const executor = connection || pool;
  const [memberships] = await executor.execute(
    `SELECT o.organization_id, o.name, o.billing_email, o.is_active,
            m.role, m.joined_at
       FROM organization_memberships m
       JOIN organizations o ON o.organization_id = m.organization_id
      WHERE m.user_id = ? AND o.is_active = TRUE
      ORDER BY CASE WHEN o.organization_id = ? THEN 0 ELSE 1 END,
               m.joined_at, o.organization_id
      LIMIT 1`,
    [userId, preferredOrganizationId || 0]
  );
  return memberships[0] || null;
}

function organizationPayload(membership) {
  if (!membership) return null;
  return {
    organization_id: membership.organization_id,
    name: membership.name,
    billing_email: membership.billing_email,
    role: membership.role,
    permissions: permissionsForRole(membership.role),
  };
}

async function requireOrganizationContext(req, _res, next) {
  try {
    const membership = await loadActiveMembership(
      null,
      req.session.user.user_id,
      req.session.activeOrganizationId
    );
    if (!membership) {
      throw new AppError(403, "ORG_CONTEXT_REQUIRED", "No active organization membership is available.");
    }
    req.session.activeOrganizationId = membership.organization_id;
    req.organization = organizationPayload(membership);
    next();
  } catch (error) {
    next(error);
  }
}

function requireOrganizationRoles(...roles) {
  return function organizationRoleMiddleware(req, _res, next) {
    if (!req.organization || !roles.includes(req.organization.role)) {
      return next(new AppError(403, "ORGANIZATION_PERMISSION_DENIED", "Your organization role does not permit this action."));
    }
    return next();
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  permissionsForRole,
  loadActiveMembership,
  organizationPayload,
  requireOrganizationContext,
  requireOrganizationRoles,
};
