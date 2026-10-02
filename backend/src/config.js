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

module.exports = {
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
