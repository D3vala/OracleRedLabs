"use strict";

const session = require("express-session");
const { pool } = require("./db");

class MySQLSessionStore extends session.Store {
  constructor() {
    super();
    this.cleanupTimer = setInterval(() => {
      pool.execute("DELETE FROM sessions WHERE expires < ?", [Date.now()]).catch(console.error);
    }, 15 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  get(sessionId, callback) {
    pool.execute("SELECT data, expires FROM sessions WHERE session_id = ?", [sessionId])
      .then(([rows]) => {
        if (!rows.length || Number(rows[0].expires) < Date.now()) {
          if (rows.length) this.destroy(sessionId, () => {});
          callback(null, null);
          return;
        }
        callback(null, JSON.parse(rows[0].data));
      })
      .catch(callback);
  }

  set(sessionId, sessionData, callback = () => {}) {
    const expires = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : Date.now() + 8 * 60 * 60 * 1000;
    pool.execute(
      `INSERT INTO sessions (session_id, expires, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE expires = VALUES(expires), data = VALUES(data)`,
      [sessionId, expires, JSON.stringify(sessionData)]
    ).then(() => callback()).catch(callback);
  }

  destroy(sessionId, callback = () => {}) {
    pool.execute("DELETE FROM sessions WHERE session_id = ?", [sessionId])
      .then(() => callback()).catch(callback);
  }

  touch(sessionId, sessionData, callback = () => {}) {
    const expires = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : Date.now() + 8 * 60 * 60 * 1000;
    pool.execute("UPDATE sessions SET expires = ? WHERE session_id = ?", [expires, sessionId])
      .then(() => callback()).catch(callback);
  }
}

module.exports = MySQLSessionStore;
