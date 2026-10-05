# Oracle Red Labs API

The backend is an Express 5 application that serves the existing `frontend/` directory and a JSON API under `/api`.

## Modules

- `src/app.js` composes security middleware, sessions, routes, static files, and errors.
- `src/config.js` validates environment configuration.
- `src/db.js` owns the MySQL connection pool.
- `src/session-store.js` persists Express sessions in MySQL.
- `src/http.js` contains errors, validation, CSRF, and role middleware.
- `src/organization-context.js` resolves the active organization and server-side role capabilities.
- `src/routes/auth.js` implements registration, login, logout, and current user.
- `src/routes/organizations.js` implements organization switching, membership, and invitation acceptance.
- `src/routes/public.js` implements public services, resources, and inquiries.
- `src/routes/engagements.js` implements the client transaction and ownership checks.
- `src/routes/admin.js` implements administrator CRUD and status operations.
- `scripts/seed-admin.js` creates or updates the environment-configured administrator.

## Storage boundaries

`frontend/` is public. Uploaded authorization PDFs are written to `backend/uploads/authorizations` by default and are never exposed through static middleware. Document downloads pass through an administrator-only API route.

Registration uses one transaction for the account, organization or invitation membership, and invitation acceptance. Engagement creation uses one transaction for the organization-owned engagement, targets, document metadata, invoice, and initial history row. If an engagement transaction fails, the uploaded file is removed.

Organization-scoped routes validate the selected membership on every request. Owners and managers can see invoices, members receive no billing fields, and billing members receive no scope or target data. Administrators retain global access.

Invitation tokens are random 32-byte values. Only SHA-256 hashes are stored. The raw link is returned once for manual delivery when the recipient has no account; existing users see matching invitations after signing in. Notifications and email delivery are not implemented.

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
