# Oracle Red Labs — Backend

This folder is intentionally **empty of code** — the site is a static,
build-free front end and every form currently runs as an in-browser demo stub
(the UI messages say so explicitly: *"there is no back end yet"*).

It exists as the reserved home for the server side of the project
(the "Milestone 7" API referenced in comments throughout the front end).

## What is planned to live here

| Endpoint (planned) | Front-end call site today | Purpose |
|---|---|---|
| `POST /api/contact` | `frontend/js/main.js` (Encrypted Inquiry form) | Store new contact inquiries; feeds the admin console's inquiry table |
| `POST /api/engage` | `frontend/js/engage-form.js` (3-step funnel) | Store engagement requests; source of the `ORL-######` reference numbers |
| `POST /api/register`, `POST /api/login` | `frontend/js/engage-form.js` form handling | Client accounts and sessions for `register.html` / `login.html` |
| `GET /api/services` | `frontend/js/data/services.js` | Replace the inlined service catalogue array with live data |
| `GET /api/resources` | `frontend/js/data/resources.js` | Replace the inlined vault array with live data |
| `GET/PUT` engagement status | dashboard & admin tables (`frontend/js/`) | Persist the status currently changed by the admin dropdowns |

## Front-end integration points

The front end was written so wiring this up is a swap, not a rewrite:

- `js/vault-filter.js` — comment: the `GET /api/resources` response replaces the
  local array in one place.
- `js/data/services.js` data file — *"replace the array with a `fetch()`"*.
- `js/engage-form.js` — *"the `fetch()` POST goes here and the reference number
  comes [from the server]"*.
- `js/main.js` — `fetch("/api/services")` noted as a one-line change.

## Running

Nothing to run yet. Until a server exists, open
`../frontend/index.html` directly in a browser — no install, no build step.
