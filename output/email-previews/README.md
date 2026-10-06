# Synthetic email previews

These are local review fixtures generated from the shared server-side renderer. They contain no recipient addresses, real organization data or usable invitation tokens. `.test` destinations and all IDs/tokens are fabricated. Nothing was emailed.

Regenerate from `backend/` with `node scripts/preview-emails.js`. The command writes the six HTML/plain-text pairs below, without configuration, database or SMTP access. Screenshots require a separate browser capture; regenerating HTML alone does not refresh screenshot evidence.

| Fixture | Purpose |
|---|---|
| `account-update.html` / `.txt` | Generic account update with the notification deep link |
| `existing-account-invitation.html` / `.txt` | Existing-account received-invitations destination |
| `new-account-invitation.html` / `.txt` | Fabricated token acceptance destination |
| `invitation-long-content.html` / `.txt` | Long organization name, unbroken text, escaped markup and long deployment URL |
| `account-update-inline-only.html` / `.txt` | Head CSS stripped; inline essentials retained |
| `invitation-unstyled.html` / `.txt` | All styles removed and redundant hidden preview removed; text and links retained |

`screenshots/` contains all six fixtures at desktop 1440px, mobile 375px and mobile 390px. File suffixes identify each width. The PNGs were captured directly from these local HTML files in headless Chrome on 2026-10-06, full-page from the document top, without image assets, animation or external requests. This is their source/provenance record. `browser-checks.json` records the measured layout and contrast checks.

These images are browser previews, not Gmail inbox screenshots. Actual Gmail light/dark behavior remains a user-controlled check. See [implementation, test results, restart steps and Gmail checklist](../../docs/EMAIL-TEMPLATES.md).
