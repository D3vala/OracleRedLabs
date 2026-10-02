# Oracle Red Labs

Oracle Red Labs is a fictional academic full-stack application for requesting and tracking authorized security engagements. It demonstrates account authentication, a transactional multipart booking flow, role-based access, MySQL CRUD, protected document storage, and status audit history. It does not perform security testing or process payments.

## Requirements

- Node.js 24 or newer
- MySQL 8.4
- npm 11 or compatible

## First-time setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Set a long random `SESSION_SECRET` and your local MySQL credentials.
3. Create the databases and load the schema and catalogue data:

   ```powershell
   mysql -u root -p < database/schema.sql
   mysql -u root -p oracle_red_labs < database/seed.sql
   ```

4. Install the server dependencies:

   ```powershell
   cd backend
   npm install
   ```

5. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`, then create or update the administrator:

   ```powershell
   npm run seed:admin
   ```

6. Start the application with `npm start` from `backend/`.
7. Open `http://localhost:3000`.

Do not open the HTML files directly. The pages rely on same-origin API routes served by Express.

## Configuration

| Variable | Purpose | Example |
|---|---|---|
| `PORT` | Express port | `3000` |
| `NODE_ENV` | Runtime environment | `development` |
| `SESSION_SECRET` | Session signing secret, 32+ random characters | required |
| `DB_HOST` / `DB_PORT` | MySQL host and port | `127.0.0.1` / `3306` |
| `DB_USER` / `DB_PASSWORD` | MySQL credentials | local values |
| `DB_NAME` | Main database | `oracle_red_labs` |
| `DB_TEST_NAME` | Isolated test database | `oracle_red_labs_test` |
| `UPLOAD_DIR` | Private authorization document directory | `uploads/authorizations` |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Administrator seed values | required for seed |

Never commit `backend/.env`, uploaded PDFs, or real credentials.

## Project structure

```text
frontend/                 Plain HTML, CSS, JavaScript, and visual assets
backend/src/              Express application, middleware, routes, database access
backend/scripts/          Administrator seed command
database/schema.sql       Repeatable production database schema
database/test-schema.sql  Repeatable isolated test database schema
database/seed.sql         Fictional service and resource catalogue
database/oracle_red_labs.sql  Submission entry point for schema and seed data
docs/milestone-2/         Sitemap and low-fidelity wireframes
docs/TESTING.md           Automated and manual verification plan
docs/PRESENTATION.md      Demonstration script and CRUD matrix
docs/SUBMISSION-CHECKLIST.md  Final rubric and delivery verification
output/screenshots/       Database-backed public, client, and admin evidence
output/presentation/      Final editable PowerPoint presentation
output/pdf/               Milestone 2 and sample authorization PDFs
SRS.md                    Authoritative software requirements
```

## Commands

Run these from `backend/`:

```powershell
npm start
npm run dev
npm run seed:admin
npm test
```

`npm test` runs database-independent unit and HTTP smoke tests. Full database acceptance checks are listed in `docs/TESTING.md`.

From the repository root, `./scripts/check-html.ps1` checks local links, duplicate IDs, labels, and ARIA references across every HTML page.

## Main workflow

1. Register a client account or sign in.
2. Select an active service and complete the engagement wizard.
3. Upload a signed PDF authorization and submit the request.
4. View the persisted request in the client dashboard.
5. Sign in as the seeded administrator and update engagement and invoice states.
6. Return to the client session and verify the updates and status history.

## Documentation

- [Software requirements](SRS.md)
- [Backend notes](backend/README.md)
- [Sitemap](docs/milestone-2/sitemap.md)
- [Wireframes](docs/milestone-2/wireframes.md)
- [Milestone 2 PDF](output/pdf/oracle-red-labs-milestone-2.pdf)
- [Testing](docs/TESTING.md)
- [Presentation guide](docs/PRESENTATION.md)
- [Submission checklist](docs/SUBMISSION-CHECKLIST.md)
- [Screenshot evidence](docs/SCREENSHOTS.md)
- [Final PowerPoint presentation](output/presentation/oracle-red-labs-final-presentation.pptx)
- [Safe sample authorization PDF](output/pdf/sample-authorization.pdf)

All company names, services, prices, resources, inquiries, and engagement records are fictional demonstration content for ITS122P.
