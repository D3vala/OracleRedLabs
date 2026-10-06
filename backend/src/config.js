"use strict";

const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const isTest = process.env.NODE_ENV === "test";

const mailEnabled = process.env.MAIL_ENABLED === "true";
const mail = {
  enabled: mailEnabled,
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  user: process.env.SMTP_USER,
  password: process.env.SMTP_PASSWORD,
  from: process.env.MAIL_FROM,
  baseUrl: process.env.APP_BASE_URL,
  payloadKey: mailEnabled ? Buffer.from(required("MAIL_PAYLOAD_KEY"), "base64") : null,
};
if (mailEnabled) {
  for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "APP_BASE_URL"]) required(key);
  const url = new URL(mail.baseUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash
      || !Number.isInteger(mail.port) || mail.port < 1 || mail.port > 65535 || mail.payloadKey.length !== 32
      || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(mail.from)) {
    throw new Error("Invalid email configuration");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Production APP_BASE_URL must use HTTPS");
  mail.baseUrl = url.href.endsWith("/") ? url.href : url.href + "/";
}

module.exports = {
  mail,
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  frontendDir: path.resolve(__dirname, "../../frontend"),
  uploadDir: path.resolve(
    __dirname,
    "..",
    process.env.UPLOAD_DIR || "uploads/authorizations"
  ),
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: isTest
      ? process.env.DB_TEST_NAME || "oracle_red_labs_test"
      : process.env.DB_NAME || "oracle_red_labs",
    charset: "utf8mb4",
  },
  sessionSecret: isTest
    ? process.env.SESSION_SECRET || "test-only-session-secret-with-32-chars"
    : required("SESSION_SECRET"),
  secureCookies: process.env.NODE_ENV === "production",
};
