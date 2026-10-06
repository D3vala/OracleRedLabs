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

Invitation tokens are random 32-byte values. The invitation table stores SHA-256 hashes. The raw link is returned once for manual delivery when the recipient has no account; configured email delivery temporarily encrypts that token in the outbox. Existing users receive a sign-in link to their received-invitations section.

Organization-scoped notifications, recipient rows, preferences, and outbox jobs persist in four InnoDB tables. Event writes and eligible email jobs share the originating domain transaction. Current roles, membership, active account, and preferences are checked again before display or delivery. Read state is individual. Backend MySQL connections initialize their SQL timezone to UTC.

`src/notification-policy.js` owns audiences, email eligibility/deep links, encryption and retries; `src/email-templates.js` renders the shared branded HTML and matching plain text; `src/notifications.js` writes events and jobs; `src/routes/notifications.js` exposes client APIs; `src/notification-worker.js` provides the injectable worker, and `src/notification-worker-main.js` runs it with Nodemailer. Sending defaults off; start `npm run worker:notifications` separately. See [configuration, privacy, API and rollout](../docs/NOTIFICATIONS.md) and [email templates, previews, tests and restart steps](../docs/EMAIL-TEMPLATES.md).

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
