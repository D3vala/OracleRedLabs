"use strict";

const path = require("node:path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const config = require("./config");
const MySQLSessionStore = require("./session-store");
const {
  csrfProtection,
  notFound,
  errorHandler,
} = require("./http");

const authRoutes = require("./routes/auth");
const publicRoutes = require("./routes/public");
const engagementRoutes = require("./routes/engagements");
const adminRoutes = require("./routes/admin");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

const sessionStore = new MySQLSessionStore();

app.use(session({
  name: "orl.sid",
  secret: config.sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookies,
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });
const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => !["POST", "PUT", "PATCH", "DELETE"].includes(req.method),
});

app.use("/api", generalLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/inquiries", submissionLimiter);
app.use("/api/engagements", submissionLimiter);
app.use("/api", csrfProtection);

app.use("/api/auth", authRoutes);
app.use("/api", publicRoutes);
app.use("/api/engagements", engagementRoutes);
app.use("/api/admin", adminRoutes);

app.use(express.static(config.frontendDir, {
  extensions: ["html"],
  index: "index.html",
  maxAge: config.env === "production" ? "1h" : 0,
}));

app.get("/health", (_req, res) => res.json({ data: { status: "ok" } }));
app.use("/api", notFound);
app.use((req, res) => res.status(404).sendFile(path.join(config.frontendDir, "index.html")));
app.use(errorHandler);

module.exports = app;
