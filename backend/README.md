# Oracle Red Labs API

The backend is an Express 5 application that serves the existing `frontend/` directory and a JSON API under `/api`.

## Modules

- `src/app.js` composes security middleware, sessions, routes, static files, and errors.
- `src/config.js` validates environment configuration.
- `src/db.js` owns the MySQL connection pool.
- `src/session-store.js` persists Express sessions in MySQL.
- `src/http.js` contains errors, validation, CSRF, and role middleware.
- `src/routes/auth.js` implements registration, login, logout, and current user.
- `src/routes/public.js` implements public services, resources, and inquiries.
- `src/routes/engagements.js` implements the client transaction and ownership checks.
- `src/routes/admin.js` implements administrator CRUD and status operations.
- `scripts/seed-admin.js` creates or updates the environment-configured administrator.

## Storage boundaries

`frontend/` is public. Uploaded authorization PDFs are written to `backend/uploads/authorizations` by default and are never exposed through static middleware. Document downloads pass through an administrator-only API route.

Engagement creation uses one transaction for the engagement, targets, document metadata, invoice, and initial history row. If a transaction fails, the uploaded file is removed.

## API errors

Expected validation and authorization failures use a stable error object:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check the highlighted fields.",
    "fields": {}
  }
}
```

Database duplicate and referenced-row errors are translated to HTTP 409. Internal error details are logged server-side and are not returned to the browser.

See the root `README.md` for setup and `SRS.md` for the complete route contract.
