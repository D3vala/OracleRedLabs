"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../src/app");
const { pool } = require("../src/db");

test.after(async () => {
  await pool.end();
});

test("health endpoint returns the standard success envelope", async () => {
  const response = await request(app).get("/health").expect(200);
  assert.deepEqual(response.body, { data: { status: "ok" } });
  assert.equal(response.headers["x-powered-by"], undefined);
  assert.match(response.headers["content-security-policy"], /default-src 'self'/);
});

test("the Express server delivers the public home page", async () => {
  const response = await request(app).get("/").expect(200);
  assert.match(response.headers["content-type"], /text\/html/);
  assert.match(response.text, /Oracle Red Labs/);
});

test("unknown API routes return a structured JSON error", async () => {
  const response = await request(app).get("/api/not-a-route").expect(404);
  assert.equal(response.body.error.code, "NOT_FOUND");
  assert.match(response.body.error.message, /No route matches/);
});
