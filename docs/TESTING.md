# Verification and Test Report

## Automated checks

From `backend/` run:

```powershell
npm test
```

The committed automated suite verifies status transition rules, reference format behavior, the health endpoint, security headers, static serving, and the JSON 404 contract without requiring a database connection.

From the repository root, run `./scripts/check-html.ps1` to check every HTML page for missing local assets, duplicate IDs, and broken label or ARIA references.

Before final submission, create `oracle_red_labs_test` from `database/test-schema.sql` and run the database cases below against that isolated database. Never point destructive test setup at `oracle_red_labs`.

To enable the committed live-database integration test in PowerShell:

```powershell
$env:RUN_DB_TESTS = "1"
$env:NODE_ENV = "test"
npm run test:db
```

## API and database matrix

| Area | Cases | Expected result |
|---|---|---|
| Registration | valid record, duplicate email, short password, missing acknowledgment | session on valid record; 409 duplicate; 422 validation failures |
| Registration organization | normal and invitation registration | normal creates owner organization; invitation joins the intended organization only |
| Invitations | new/existing email, invalid, expired, used, cancelled, wrong email | manual link or received list; invalid lifecycle states rejected |
| Membership | duplicate, role change, removal, final owner | unique membership; role matrix enforced; final owner retained |
| Active organization | user with two memberships | session context switches only to an authorized active organization |
| Login | valid client/admin, wrong email/password, inactive user | correct role session; generic 401 failures |
| Logout | valid session, repeated request | session removed; later protected request returns 401 |
| Inquiry | valid, malformed email, short message | persisted new inquiry; 422 invalid inputs |
| Authorization | guest, organization roles, different organization, admin | role and organization boundaries return 401/403/404 as specified |
| Engagement | valid complete request | one engagement, targets, document, invoice, and initial history row |
| Engagement validation | inactive service, short scope, zero/101 targets, long target, past date | 422 and no partial records or orphaned PDF |
| PDF | wrong MIME, oversized file, false `.pdf`, valid PDF | rejected invalid files; accepted file outside public directory |
| Organization isolation | two organizations and shared members | members share their organization records; another organization receives 404 |
| Role projections | owner, manager, member, billing | members receive no billing fields; billing receives no scope or targets |
| Cancellation | pending, scoping, active, completed, already cancelled | first two succeed; other client operations return conflict |
| Engagement state | every allowed and disallowed transition | allowed state and history commit together; invalid returns 409 |
| Invoice state | allowed, terminal, amount update | valid transitions persist timestamps; invalid returns 409 |
| Service CRUD | create/read/update/delete unused/delete referenced | CRUD persists; referenced deletion returns 409 |
| Resource CRUD | create/read/update/publish/delete | public API shows only published records |
| Inquiry admin | list/review/close/reset/delete | reviewer and timestamps follow status |
| CSRF | missing, wrong, correct token | mutation rejects first two with 403 |
| Injection-shaped input | quotes and SQL fragments in text fields | stored as data or rejected by validation; query structure unchanged |

## Database inspection after engagement creation

Use the returned reference to verify the transaction:

```sql
SELECT * FROM engagements WHERE reference_code = 'ORL-000000';
SELECT t.* FROM engagement_targets t JOIN engagements e USING (engagement_id)
WHERE e.reference_code = 'ORL-000000' ORDER BY t.sort_order;
SELECT d.* FROM authorization_documents d JOIN engagements e USING (engagement_id)
WHERE e.reference_code = 'ORL-000000';
SELECT i.* FROM invoices i JOIN engagements e USING (engagement_id)
WHERE e.reference_code = 'ORL-000000';
SELECT h.* FROM engagement_status_history h JOIN engagements e USING (engagement_id)
WHERE e.reference_code = 'ORL-000000' ORDER BY h.history_id;
```

Replace the example reference with the actual response. The expected count is one engagement, one or more targets, one document, one invoice, and one initial `NULL -> pending` history row.

## Manual browser checklist

Run at 390 px, 768 px, and desktop widths.

- [ ] All header/footer links reach a real page.
- [ ] Public information remains readable when JavaScript is disabled.
- [ ] Services and resources show loading, content, empty, and error states.
- [ ] Registration, login, inquiry, and engagement forms announce errors without clearing input.
- [ ] Keyboard focus remains visible; tab order follows the page.
- [ ] Admin tabs work with mouse, Tab, arrows, Home, and End.
- [ ] Long names, service titles, messages, and empty tables do not break layouts.
- [ ] Dashboard and admin tables become readable stacked records on mobile.
- [ ] Reduced-motion mode removes nonessential motion.
- [ ] Client and administrator sessions route to the proper areas.
- [ ] Organization switcher changes dashboard context and persists in the session.
- [ ] Invitation links support registration; existing accounts accept from the received list.
- [ ] Owner and manager controls match their role; final owner cannot be removed or demoted.
- [ ] Members cannot see invoice data; billing users cannot see scope/targets or submit/cancel.
- [ ] A member cannot view another organization's reference by changing the URL.
- [ ] Authorization download works for admin and has no public static URL.
- [ ] Browser console and server output contain no unexpected errors.

## End-to-end acceptance run

1. Start from a fresh schema and seed.
2. Register client A and confirm its owner organization membership.
3. Create an invitation for a new member, copy the link, and register client B through it.
4. Create a billing account, invite its existing email, accept from the received-invitations list, and switch organizations.
5. Create an engagement with the sample authorization PDF and confirm organization and submitter ownership.
6. Confirm the owner and member see the shared record, with billing fields absent for the member.
7. Confirm the billing user sees invoice data but no scope or targets and cannot submit or cancel.
8. Register a separate organization and confirm the reference is inaccessible.
9. In a separate administrator session, download the PDF, move the engagement to `scoping`, and set the invoice to `outstanding`.
10. Demonstrate the final-owner guard and manager membership restrictions.
11. Demonstrate service/resource CRUD and inquiry administration.
12. Restart Express and confirm the records and session-backed organization selection remain.

## Environment result

The committed schema and integration flow were validated with an isolated MySQL 8.0.42 instance because MySQL 8.4 was not installed on the development host. MySQL 8.4 remains the target presentation runtime. The final presenter should repeat the checklist on MySQL 8.4 and add current screenshots.

| Date | Tester | Environment | Result | Defect/resolution |
|---|---|---|---|---|
| 2026-10-02 | Codex implementation pass | Node 25.8.1; MySQL 8.0.42 isolated instance | PASS: schema 10 tables; 3 services; 8 resources; database integration test passed | Admin editor ignored `hidden` because grid display overrode it; added a global hidden rule and verified at 360 px |
| 2026-10-02 | Codex implementation pass | Node test runner and Supertest | PASS: 6 unit/HTTP checks; live database suite PASS when enabled | Removed the vulnerable third-party session-store dependency and replaced it with the project session store; `npm audit --omit=dev` reports 0 vulnerabilities |
| 2026-10-02 | Codex implementation pass | Codex in-app Chromium, 360 px and 1440 px | PASS: home, client dashboard, engagement detail, and admin shell responsive checks | Static preview reports expected API errors because it has no database-backed Express process |
| 2026-10-03 | Codex organization pass | Node test runner; isolated MySQL 8.0.42 | PASS: 7 default tests; live organization/invitation/shared-engagement integration test; legacy migration succeeded twice without child-record loss | Notifications intentionally deferred; destructive reset guarded by `_test` database suffix |
