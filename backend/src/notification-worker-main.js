"use strict";

const nodemailer = require("nodemailer");
const config = require("./config");
const { pool, verifyDatabase } = require("./db");
const { createWorker } = require("./notification-worker");

async function main() {
  await verifyDatabase();
  const transport = config.mail.enabled ? nodemailer.createTransport({
    host: config.mail.host, port: config.mail.port, secure: config.mail.port === 465,
    requireTLS: config.mail.port !== 465, auth: { user: config.mail.user, pass: config.mail.password },
    connectionTimeout: 30000, greetingTimeout: 30000, socketTimeout: 30000,
  }) : null;
  const worker = createWorker({ pool, mail: config.mail, transport, log: (entry) => console.log(JSON.stringify(entry)) });
  let stopping = false;
  let lastCleanup = 0;
  let timer;
  let wake;
  function stop() { stopping = true; clearTimeout(timer); if (wake) wake(); }
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  console.log(`Notification worker started; email ${config.mail.enabled ? "enabled" : "disabled"}.`);
  try {
    while (!stopping) {
      try {
        if (Date.now() - lastCleanup >= 15 * 60000) { await worker.cleanup(); lastCleanup = Date.now(); }
        for (let index = 0; index < 20 && !stopping; index += 1) { if (!await worker.runOnce()) break; }
      } catch (_error) { console.error("Notification worker cycle failed; retrying on the next cycle."); }
      if (!stopping) await new Promise((resolve) => { wake = resolve; timer = setTimeout(resolve, 5000); });
    }
  } finally { transport?.close(); await pool.end(); }
}

main().catch(() => { console.error("Notification worker could not start. Check database and email configuration."); process.exitCode = 1; });
