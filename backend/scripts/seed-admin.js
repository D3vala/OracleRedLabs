"use strict";

const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const bcrypt = require("bcryptjs");
const { pool } = require("../src/db");

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME?.trim() || "Oracle Red Labs Administrator";
  const companyName = process.env.ADMIN_COMPANY?.trim() || "Oracle Red Labs";

  if (!email || !password || password.length < 12 || password.length > 72) {
    throw new Error("Set ADMIN_EMAIL and an ADMIN_PASSWORD containing 12 to 72 characters in backend/.env.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.execute(
    `INSERT INTO users (full_name, email, company_name, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, 'admin', TRUE)
     ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), company_name = VALUES(company_name),
       password_hash = VALUES(password_hash), role = 'admin', is_active = TRUE`,
    [fullName, email, companyName, passwordHash]
  );
  console.log(`Administrator ready: ${email}`);
}

seedAdmin()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error.message);
    await pool.end();
    process.exit(1);
  });
