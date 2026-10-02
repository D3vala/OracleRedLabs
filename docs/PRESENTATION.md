# Final Presentation and Demonstration Guide

## Recommended slide sequence

1. Business concept, target users, and problem
2. Original proposal versus final academic scope
3. Sitemap, user roles, and primary transaction
4. Visual system and responsive front end
5. Node/Express/MySQL architecture
6. Database ERD and integrity rules
7. Authentication, authorization, CSRF, and protected PDFs
8. JavaScript features and API integration
9. CRUD evidence
10. Testing, defects resolved, limitations, and lessons

## Five-minute live demonstration

1. Open the public services and resource pages to show database content and vault filtering.
2. Submit a public inquiry.
3. Register the prepared client account.
4. Book an engagement with a valid sample PDF and read the server-generated reference.
5. Open the dashboard and engagement details.
6. In a separate browser profile, sign in as the seeded administrator.
7. Find the same reference, download its authorization, and move it to `scoping`.
8. Move its invoice to `outstanding`.
9. Return to the client profile and refresh to show both persisted updates and history.
10. Add, edit, and delete a temporary resource; show a referenced service deletion conflict; review and delete the inquiry.

## CRUD evidence matrix

| Operation | Demonstration |
|---|---|
| Create | Register, submit inquiry, book engagement, add service/resource |
| Read | Public catalogue, resource filter, client dashboard/detail, admin tables |
| Update | Edit service/resource, change engagement/invoice/inquiry state |
| Delete | Delete unused service, resource, or inquiry |
| Controlled business update | Client cancellation of a pending/scoping engagement |

## Prepared demonstration data

- One administrator created with `npm run seed:admin`
- One fresh client email not already present
- One second client for ownership isolation
- A PDF under 5 MB beginning with a valid `%PDF-` signature
- A start date at least 24 hours ahead
- At least two targets on separate lines
- Scope text longer than 40 characters
- A temporary resource and unused temporary service for deletion

Keep credentials in the local `.env` or presenter notes. Do not put them in source, slides, screenshots, or the submission archive.

## Final packaging checklist

- [ ] README clean setup succeeds on a new copy.
- [ ] `database/oracle_red_labs.sql` contains the final schema and approved fictional demonstration data.
- [ ] SRS matches the application behavior.
- [ ] Sitemap and wireframes are included.
- [ ] Test report contains completed results and resolved defects.
- [ ] Public, client, booking, database, and admin screenshots are current.
- [ ] Presentation uses the acceptance scenario above.
- [ ] `.env`, real credentials, uploaded private PDFs, logs, and local database files are absent.
- [ ] ZIP includes source, assets, documentation, screenshots, slides, and SQL export.
- [ ] All remaining claims describe a fictional academic application accurately.
