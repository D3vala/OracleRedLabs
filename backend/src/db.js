"use strict";

const mysql = require("mysql2/promise");
const config = require("./config");

const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "Z",
  decimalNumbers: true,
  namedPlaceholders: false,
});

// mysql2's timezone option controls date decoding, not MySQL session timestamps.
// Queue UTC initialization before this new connection is handed to a caller.
pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

async function verifyDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.query("SELECT 1");
  } finally {
    connection.release();
  }
}

module.exports = { pool, verifyDatabase };
