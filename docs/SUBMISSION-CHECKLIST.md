# Oracle Red Labs Final Submission Checklist

## Scope and documentation

- [x] Original business proposal retained as `business-proposal.md`.
- [x] Instructor guidance retained as `project-instructions.md`.
- [x] Final academic scope and deferred proposal features documented in `SRS.md`.
- [x] Setup, configuration, database, seed, test, and run commands documented in `README.md`.
- [x] Milestone 2 sitemap, navigation model, and wireframes documented and exported to PDF.
- [x] Final presentation and demonstration guide included.

## Front end

- [x] Existing Oracle Red Labs visual design retained.
- [x] Public service and resource content loads from the API.
- [x] Registration, login, inquiry, and engagement forms submit to Express.
- [x] Client dashboard and engagement detail pages use authenticated records.
- [x] Organization page supports switching, member roles, removals, pending invitations, and received invitations.
- [x] Owner, manager, member, and billing projections are enforced on the server.
- [x] Administrator console provides working service, resource, inquiry, engagement, and invoice controls.
- [x] Loading, empty, validation, success, warning, and error states are present.
- [x] Protected pages enforce client or administrator access.
- [x] Unsupported encryption, payment-processing, findings, report, and staff-assignment promises were removed.
- [x] Public, client, and administrator screenshots captured from a running database-backed instance.

## Backend and database

- [x] Express 5 application serves the front end and `/api` routes.
- [x] MySQL schema contains users, organizations, memberships, invitations, services, resources, inquiries, engagements, targets, authorization documents, invoices, status history, and sessions.
- [x] Schema, seed data, and complete SQL export are included.
- [x] Password hashing, MySQL-backed sessions, CSRF checks, rate limits, role checks, ownership checks, and parameterized SQL are implemented.
- [x] Engagement creation stores all related records in one transaction.
- [x] Registration and invitation acceptance store related account and membership records in transactions.
- [x] The rerunnable migration preserves existing engagement child records and original submitters.
- [x] Authorization PDFs are limited to 5 MB, checked by MIME type and `%PDF-` signature, renamed randomly, hashed, and stored outside the public directory.
- [x] Engagement and invoice transition rules are enforced on the server.
- [x] Engagement status changes create audit-history records.
- [x] Administrator credentials are created from environment variables and are absent from source control.

## CRUD evidence

- [x] Create: account, inquiry, engagement, service, and resource.
- [x] Read: catalogue, vault, dashboard, engagement detail, and administrator records.
- [x] Update: service, resource, inquiry status, engagement status, and invoice status/amount.
- [x] Delete: unused service, resource, and inquiry.
- [x] Business cancellation: eligible client engagement is cancelled through an audited update.
- [x] Referenced service deletion returns HTTP 409.

## Verification evidence

- [x] Default Node test run passes seven tests and skips the opt-in live-database suite.
- [x] Live MySQL integration suite passes the complete transaction and CRUD scenario.
- [x] Live MySQL suite covers organizations, invitations, role projections, final-owner protection, and cross-organization denial.
- [x] Legacy migration succeeds on rerun without losing targets, invoices, or status history.
- [x] Production dependency audit reports zero vulnerabilities.
- [x] Browser and server JavaScript syntax checks pass.
- [x] HTML local references, duplicate IDs, labels, ARIA references, and error references pass the repository checker.
- [x] MySQL schema and seed recreate thirteen tables, three services, and eight resources from an empty database.
- [x] Responsive browser review completed at 390 px and desktop widths.
- [x] Final PowerPoint passed package, slide-count, font, geometry, native-table, and import validation.

## Delivery safety

- [x] No `.env` file is included.
- [x] No real credentials are included.
- [x] No authorization uploads or local database files are included.
- [x] `node_modules`, temporary build directories, logs, and Git metadata are excluded.
- [x] Safe sample authorization PDF is included for the live demonstration.
- [x] Submission archive contains source, assets, documentation, screenshots, presentation, PDFs, and SQL artifacts.

## Presentation environment note

The schema targets MySQL 8.4 LTS as specified in the SRS. The completed live integration and screenshot runs used the locally available MySQL 8.0.42 server, which supports the implemented SQL features. The final presentation machine should run the clean setup once with MySQL 8.4 before the assessed demonstration.
