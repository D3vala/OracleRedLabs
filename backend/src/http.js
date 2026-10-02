"use strict";

const crypto = require("node:crypto");
const { validationResult } = require("express-validator");

class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function validationErrors(req) {
  const result = validationResult(req);
  if (result.isEmpty()) return null;
  const fields = {};
  result.array({ onlyFirstError: true }).forEach((item) => {
    fields[item.path] = item.msg;
  });
  return fields;
}

function requireValid(req) {
  const fields = validationErrors(req);
  if (fields) {
    throw new AppError(422, "VALIDATION_ERROR", "Check the highlighted fields.", fields);
  }
}

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

function csrfProtection(req, _res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const expected = ensureCsrfToken(req);
  const received = req.get("x-csrf-token") || req.body?._csrf;
  if (!received || received.length !== expected.length) {
    return next(new AppError(403, "CSRF_INVALID", "Refresh the page and try again."));
  }
  const valid = crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  return valid
    ? next()
    : next(new AppError(403, "CSRF_INVALID", "Refresh the page and try again."));
}

function requireAuth(req, _res, next) {
  if (!req.session.user) {
    return next(new AppError(401, "AUTH_REQUIRED", "Sign in to continue."));
  }
  return next();
}

function requireAdmin(req, _res, next) {
  if (!req.session.user) {
    return next(new AppError(401, "AUTH_REQUIRED", "Sign in to continue."));
  }
  if (req.session.user.role !== "admin") {
    return next(new AppError(403, "ADMIN_REQUIRED", "Administrator access is required."));
  }
  return next();
}

function requireClient(req, _res, next) {
  if (!req.session.user) {
    return next(new AppError(401, "AUTH_REQUIRED", "Sign in to continue."));
  }
  if (req.session.user.role !== "client") {
    return next(new AppError(403, "CLIENT_REQUIRED", "A client account is required."));
  }
  return next();
}

function notFound(req, _res, next) {
  next(new AppError(404, "NOT_FOUND", `No route matches ${req.method} ${req.path}.`));
}

function errorHandler(error, req, res, _next) {
  if (req.file && error) {
    const fs = require("node:fs/promises");
    fs.unlink(req.file.path).catch(() => {});
  }

  let status = error.status || 500;
  let code = error.code || "INTERNAL_ERROR";
  let message = error.message || "The server could not complete the request.";

  if (error.code === "ER_DUP_ENTRY") {
    status = 409;
    code = "DUPLICATE_RECORD";
    message = "A record with that unique value already exists.";
  } else if (error.code === "ER_ROW_IS_REFERENCED_2") {
    status = 409;
    code = "RECORD_IN_USE";
    message = "This record is still in use and cannot be deleted.";
  } else if (error.code === "LIMIT_FILE_SIZE") {
    status = 422;
    code = "FILE_TOO_LARGE";
    message = "The authorization PDF must be 5 MB or smaller.";
  }

  if (status >= 500) {
    console.error(error);
    message = "The server could not complete the request. Try again.";
  }

  res.status(status).json({
    error: {
      code,
      message,
      ...(error.fields ? { fields: error.fields } : {}),
    },
  });
}

module.exports = {
  AppError,
  asyncHandler,
  requireValid,
  ensureCsrfToken,
  csrfProtection,
  requireAuth,
  requireAdmin,
  requireClient,
  notFound,
  errorHandler,
};
