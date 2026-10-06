# Transactional email templates

Oracle Red Labs sends a matching HTML and plain-text alternative for every existing queued email path. `backend/src/email-templates.js` is the shared server-side renderer and returns `{ subject, text, html }`. `eventEmail()` constructs the existing account deep link and delegates rendering; the worker renders invitations after the current eligibility checks and token validation. Nodemailer receives both formats and the sender object `{ name: "Oracle Red Labs", address: mail.from }`. The configured sender address and SMTP settings are unchanged.

## Variants and destinations

| Variant | Subject (unchanged) | Action | Destination |
|---|---|---|---|
| Account update | Oracle Red Labs: an update is available | Review update | `notifications.html?organization=<id>&notification=<id>` |
| Existing-account invitation | Oracle Red Labs: organization invitation | Review invitation | `organization.html#received-heading` |
| New-account invitation | Oracle Red Labs: organization invitation | Review invitation | `accept-invitation.html?token=<existing decrypted token>` |

All paths resolve against the existing configured `APP_BASE_URL`, including deployments beneath a directory. Both HTML links and the plain-text link use the same absolute destination. The account deep link retains the existing authorization and explicit organization-switch confirmation in the application; email rendering adds no automatic switch or authorization bypass.

Account-update subjects, HTML title, hidden preview text, body and plain text remain generic across engagement, invoice, team and personal-access events. The message is “An update is available in your Oracle Red Labs account.” The renderer receives only the variant and destination for updates; event details are not interpolated. Organization and notification IDs remain in the authorized deep link, as before. Preferences guidance remains “You can change event email preferences in Notifications.”

Invitations identify the inviting organization and intended role. Existing accounts are directed to received invitations; new accounts retain the token acceptance flow. Both say “Invitations expire seven days after creation” and explain that an unexpected invitation can be ignored. This wording does not imply a new seven-day window after delayed delivery or retry. Invitations bypass event preferences, so they include no unsubscribe or preference promise.

Dynamic text, visible URLs and quoted HTML attributes are escaped. Destinations must be HTTP(S) without embedded credentials. The body contains no images, tracking, remote fonts, promotional content, greeting or invented support address. The footer retains the established fictional-company/academic-project disclosure. Plain text carries the same message, action destination, guidance and disclosure.

## Delivery boundaries

There are no new events, dependencies, environment variables or schema changes. Current authorization, recipient selection, actor exclusion, preferences, encrypted invitation tokens, retries, leases, stable Message-IDs, retention and sanitized worker logging retain their existing behavior. Queued jobs are rendered at delivery time, so already-pending eligible jobs use the new templates after a worker restart. Invalid, revoked or expired jobs still suppress delivery. No renderer writes message bodies to the outbox or logs.

## Local previews

From `backend/`:

```powershell
node scripts/preview-emails.js
```

This command uses only synthetic fixture data. It never imports application configuration, reads the database, or contacts SMTP. Open files in `output/email-previews/`, or serve that directory for convenience:

```powershell
python -m http.server 8001 --directory output/email-previews
```

The server command runs from the repository root. All preview destinations use reserved `.test` names, fabricated IDs and a fabricated token; they are not acceptance links. Each HTML file has a corresponding `.txt` file. The fixture generator writes only these preview pairs; it does not regenerate the completed presentation, submission archive or existing website pages.

Preview coverage includes all three normal variants, an invitation with a long/unbroken organization name and long deployment URL, an account update without the head style block, and an invitation with all styling removed. The latter is a deliberately simplified fallback simulation; actual clients may remove a different subset of markup or styles.

## Verification

`npm test` includes `backend/test/email-templates.test.js`: generic privacy across every event category and eligible worker audience, escaped organization/role text and URL attributes, invalid destination rejection, unchanged subjects, both invitation destinations, root/subdirectory/local deployment paths, HTML/plain-text/visible-URL equivalence, sender display name, both alternatives entering Nodemailer's offline JSON transport, and retained delivery-time suppression. It does not send real mail.

`npm run test:db` runs the existing database suites only when `RUN_DB_TESTS=1`. Use `NODE_ENV=test` and a fresh, explicitly selected database ending in `_test` on a separate local MySQL instance. Never use the development database. The suites reset their selected test database; preserve their name guards. The notification suite injects fake SMTP and checks HTML/text links and the branded sender alongside its existing role, preference, invitation, retry, encryption and retention checks. No actual SMTP transport is started by either suite.

Verification on 2026-10-06: 27 default checks passed, with the two database suites skipped by default. All 10 enabled database checks passed against a newly initialized temporary MySQL 8.0 instance on `127.0.0.1:13317`, using `oracle_red_labs_email_test` and an isolated upload directory. The temporary instance was stopped afterward. An initial local HTTP run required loopback access outside the sandbox; an initial integration harness upload directory was hidden and therefore rejected by the existing download behavior. The corrected harness passed without changing application download behavior.

Chrome screenshots cover all six fixtures at 1440, 375 and 390px (18 captures). `output/email-previews/browser-checks.json` records zero horizontal overflow, browser errors or remote requests, matching destinations/visible URLs and 50px primary actions in styled variants. Measured contrast is 4.77:1 for white action text on primary red and 7.58:1 for muted text on the panel. The red wordmark is bold 20px large text with 4.07:1 contrast. Essential formatting survives removal of the head style block; the full styling removal fixture remains readable with ordinary links and text branding.

Browser screenshots establish local layout only. They do not establish actual Gmail inbox rendering, inbox placement, sender authentication, or client dark-mode/color rewriting. Gmail can ignore unsupported styles; the implementation uses inline essentials and an optional width media query, following [Google's Gmail CSS documentation](https://developers.google.com/workspace/gmail/design/css). Passing `text` and `html` together follows [Nodemailer's message configuration](https://nodemailer.com/message). Outlook's conditional width wrapper and padding fallback are present but not verified in an Outlook inbox.

## Restart

Stop the running application and notification worker in their respective terminals with Ctrl+C and let them exit. From `backend/`, restart the application in one terminal:

```powershell
npm start
```

In a separate terminal, also from `backend/`:

```powershell
npm run worker:notifications
```

If using `npm run dev`, the application watches source changes; the separate notification worker still needs its own restart. Keep the current SMTP credentials, sender address, `MAIL_PAYLOAD_KEY`, session configuration and `APP_BASE_URL`. This change requires no migration or additional configuration. Restarting the worker processes already-queued eligible jobs under the existing `MAIL_ENABLED` setting.

## User-controlled Gmail check

Only send messages when you choose to trigger the existing account/invitation actions with your controlled recipient accounts.

- [ ] Receive an account update and both invitation variants in Gmail desktop and the Gmail mobile app.
- [ ] In light and dark modes, check the wordmark, heading, message, red button, underlined URL and footer for legibility, clipping and horizontal scrolling. Check with images disabled as well; branding is text.
- [ ] Confirm account-update subject and inbox snippet remain generic and disclose no organization, category, role, engagement, invoice or member details.
- [ ] Follow both the button and URL. Confirm updates require sign-in and explicit organization-switch confirmation when applicable; existing invitations open received invitations; new invitations retain token acceptance.
- [ ] Confirm invitations show the correct organization/role, seven-day-from-creation guidance and unexpected-invitation instruction; only updates mention event preferences.
- [ ] Inspect Gmail's “Show original” locally to confirm the Oracle Red Labs sender name and both `text/plain` and `text/html` alternatives. Check the plain-text alternative's message and destination.

Record actual inbox observations separately from browser preview results.
