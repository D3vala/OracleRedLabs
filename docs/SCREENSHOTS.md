# Application Screenshot Evidence

The images in `output/screenshots/` were captured from a running Express application connected to an isolated MySQL database recreated from the committed schema with fictional demonstration data.

| File | Evidence |
|---|---|
| `01-public-home.png` | Public landing page and established visual system |
| `02-client-dashboard.png` | Active organization identity, membership role, shared engagement register, and allowed actions |
| `03-engagement-detail.png` | Organization-owned scope, submitter, targets, updated state, invoice, and status history |
| `04-admin-console.png` | Administrator console with organization and submitter context |
| `05-organization-membership.png` | Active-organization switcher, member roles, invitations, and permission-aware controls |
| `06-invitation-acceptance.png` | Manual invitation preview and account acceptance flow |
| `07-organization-membership-mobile.png` | Full 390 px organization-management flow without horizontal overflow |
| `08-invitation-acceptance-mobile.png` | Full 390 px invitation preview, routing actions, and delivery note |

All names, organizations, domains, prices, records, and authorization content in these screenshots are fictional demonstration data. Screenshots 01–08 document the completed membership feature before notifications. Screenshots 09–13 document the notification extension using synthetic data and disabled real email delivery; SMTP delivery is verified with a fake transport in integration tests.

| Notification file | Evidence |
|---|---|
| `09-notifications-desktop.png` | 1440 px organization-scoped feed, unread count, preferences, separate incoming invitations |
| `10-notifications-mobile.png` | 390 px stacked feed, role context, full-width actions and preferences |
| `11-notifications-empty.png` | Unread empty state after Mark all read |
| `12-notifications-error.png` | Network failure with Retry and recoverable state |
| `13-notifications-no-javascript.png` | Readable explanation and navigation with unavailable controls hidden |
