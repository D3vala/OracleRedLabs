# Notifications and email delivery

Notifications are implemented for client accounts and belong to one recipient within one organization. Administrators keep the existing console. This feature does not execute security testing or process payments.

## Events and recipients

The actor is excluded. Only active client accounts with active organization memberships receive new rows. There is no historical backfill or delivery of old events to newly joined members.

| Event | In-app audience | Default email |
|---|---|---|
| Engagement submitted | Owner, manager, member | Off |
| Engagement status changed, including cancellation | All roles; basic status only | On |
| Invoice status or amount changed | Owner, manager, billing | On |
| Invitation created or cancelled | Owner, manager | Off |
| Invitation accepted / member joined | Owner, manager | Off |
| Member role changed | Owner, manager, affected member | Affected member only |
| Member removed | Remaining owner and manager memberships | Off |

Creating an invitation separately queues an invitation email when sending is enabled. Existing accounts receive a link to `organization.html#received-heading`; new accounts receive the existing token-based acceptance link. Manual new-account links remain available once. Incoming invitations use `/api/invitations/received` and are separate from organization notifications and unread counts.

Same-value role changes and unchanged invoice writes create no event. Rejected operations create no event. Cancellation that also cancels an unpaid invoice creates both applicable events. Paid and already-cancelled invoices create no additional cancellation notice. There are no expiry reminders, login alerts, organization-detail alerts, staff inbox, digests, or push delivery.

## Data and authorization

`notification_events` contains typed identifiers and short event values, without arbitrary HTML, scope, targets, document contents, emails, or internal notes. `notifications` contains per-recipient audience and read state. Composite foreign keys keep each notification's event, recipient membership, and organization together. `notification_preferences` belongs to a membership. `notification_email_outbox` holds durable event/invitation jobs and temporary encrypted new-account invitation tokens.

Every notification route checks a live active client account and organization membership. Every list, unread count, and read-state mutation constrains recipient, active organization, current role audience, and the 90-day retention boundary. A downgrade immediately hides restricted rows and removes them from the count. Membership deletion cascades notifications, preferences, and associated queued mail; rejoining starts fresh. SMTP eligibility is rechecked before each send.

Backend pool connections initialize their MySQL session timezone to UTC; the driver's timezone option alone does not set SQL `CURRENT_TIMESTAMP`. Notification timestamps and queue scheduling use UTC.

Responses use `Cache-Control: no-store`. The UI renders with `textContent`, does not persist private data in local storage, clears old organization content when switching, and discards stale asynchronous responses. Browser return-to-tab refreshes the context. It does not poll continuously.

## API

All routes require a client session and an `organization_id` query parameter. This parameter is an expected-context guard, not an organization selector. A mismatch returns `409 ORGANIZATION_CONTEXT_CHANGED`. Switch through the existing organization API explicitly. Missing/invalid parameters return 422; guests return 401, administrators 403, and another recipient's or invisible notification IDs 404. Mutations require the existing CSRF token.

| Method and route | Contract |
|---|---|
| `GET /api/notifications` | `filter=all` or `unread`; optional exclusive notification-ID `cursor`; `limit` defaults to 20, maximum 50 |
| `GET /api/notifications/summary` | `{ data: { organization_id, role, unread_count, watermark } }` |
| `PATCH /api/notifications/:id` | JSON `{ "read": true }` or `{ "read": false }`; idempotent |
| `POST /api/notifications/read-all` | JSON `{ "watermark": 123 }`; marks only currently visible rows through that snapshot boundary |
| `GET /api/notifications/preferences` | Four boolean email flags |
| `PATCH /api/notifications/preferences` | All four JSON boolean flags required |

The list response is `{ data: [...], meta: { organization_id, role, unread_count, watermark, next_cursor } }`. Each item contains `notification_id`, `type`, `title`, `message`, `url`, `created_at`, and `read_at`. The list is newest notification ID first. Merely listing or viewing the page does not mark anything read. Open marks the item read before navigation; explicit controls also allow marking unread.

Default preferences are `engagement_email=true`, `invoice_email=true`, `team_email=false`, and `personal_access_email=true`. Engagement email covers status changes; submission emails remain off. Team opt-in covers invitation and removal/join activity; other people's role changes remain in-app. Hidden role-ineligible categories confer no access. Invitation delivery bypasses event preferences because it is an explicit invitation action.

## SMTP setup and worker

Apply `database/migrations/20261005-notifications.sql` after the organization migration, against the explicitly selected database. The migration is additive and rerunnable. Fresh schema, test schema, and submission SQL include the same four new tables. No application startup migration or destructive reset is performed.

Use the placeholders in `backend/.env.notifications.example` to configure `backend/.env`:

- `MAIL_ENABLED=true` explicitly enables creation and processing of email jobs. Its default is false, including development/tests. Disabled creation produces no sendable backlog; notifications still persist.
- `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_USER`, `SMTP_PASSWORD`, and `MAIL_FROM` (a plain sender email address) are required when enabled.
- `APP_BASE_URL` must be an HTTP(S) application URL; production requires HTTPS. Include a trailing slash for deployment beneath a path. It must not contain credentials, a query, or a fragment.
- `MAIL_PAYLOAD_KEY` must decode to exactly 32 bytes. Generate it with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Keep it outside the repository and separate from the session secret. Do not replace it while new-account invitation jobs are pending.

Run the application and, in a separate supervised process, `npm run worker:notifications` from `backend/`. The worker uses TLS on port 465 and requires STARTTLS on other ports, retains certificate validation, and has 30-second connection/greeting/socket timeouts. It polls every five seconds with at most 20 jobs per cycle and recoverable five-minute leases. A disabled worker still runs retention cleanup.

Email jobs commit with the originating domain change. A queue-write failure rolls back that change. SMTP outages do not roll back committed work. Attempts occur immediately, then after 1 minute, 5 minutes, 30 minutes, 2 hours, and 6 hours; a permanent rejection or exhausted sixth attempt is terminal. Worker crashes recover expired leases without allowing a seventh attempt. Stable Message-IDs and unique queue delivery keys reduce duplicates, but SMTP is at-least-once: an uncertain acknowledgement can still cause a duplicate.

Event email contains generic copy and a sign-in link without organization names, engagement references, invoice amounts, role values, or operational information. A linked organization is verified and requires explicit switch confirmation when it differs from the active organization. Invitation email may identify the organization and intended role. Token payloads use AES-256-GCM and are cleared after acceptance by SMTP, cancellation, expiry, or terminal failure. SMTP acceptance is recorded as `accepted`, not proof of inbox delivery. The UI reports only `Email queued` or `Email is disabled`.

Logs contain job IDs, attempt counts, states, and sanitized codes. No addresses, tokens, bodies, credentials, or raw SMTP errors are logged by the worker. There is no provider webhook, bounce tracking, or delivery-status API in this release. Revocation suppresses unsent jobs; mail already handed to SMTP cannot be recalled.

### Branded email templates

All existing delivery paths now use `backend/src/email-templates.js` for matching HTML/plain-text messages with a text wordmark, one red action, the existing destination URL and a quiet academic-demo footer. Update subjects, preview text and copy remain generic across event categories. Invitations retain organization/role and seven-day-from-creation guidance, with no unsubscribe promise. The sender display name is Oracle Red Labs using the same configured address. Rendering occurs after delivery eligibility checks; pending jobs pick up the templates after worker restart. No schema or private configuration change is required. See [template contracts, synthetic previews, verification, restart steps and the user-controlled Gmail checklist](EMAIL-TEMPLATES.md).

## Retention, verification, and rollout

Read and unread notifications expire 90 days after creation. Queries exclude them immediately; the worker removes old event rows in batches of 500 every 15 minutes, cascading recipient rows. Terminal email jobs are purged seven days after finishing. Existing engagement history remains unchanged.

Use `npm test` for policy/HTTP checks, and `RUN_DB_TESTS=1` with `NODE_ENV=test` and an isolated `_test` database for `npm run test:db`. The integration tests use a fake SMTP transport and never send real messages. The test reset includes all four new tables and retains its `_test` guard.

Roll out schema first, then application and worker with email disabled. Configure a controlled SMTP destination, verify invitation and event templates, and then enable sending. Queue state/attempt/error fields and sanitized worker logs provide failure monitoring. Disable sending and stop the worker to roll back email behavior; preserve domain and notification records. The completed membership presentation and submission archive are intentionally not regenerated by this feature pass.
