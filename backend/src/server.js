"use strict";

const app = require("./app");
const config = require("./config");
const { pool, verifyDatabase } = require("./db");

async function start() {
  await verifyDatabase();
  const server = app.listen(config.port, () => {
    console.log(`Oracle Red Labs is running at http://localhost:${config.port}`);
  });

  async function shutdown(signal) {
    console.log(`${signal} received; closing the server.`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((error) => {
  console.error("Startup failed:", error.message);
  process.exit(1);
});
