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
3. Register the prepared owner account and show the automatically created organization.
4. Create a member invitation and copy the manual link; explain that the database stores only its hash.
5. Accept the invitation in a second client profile and show the shared organization dashboard.
6. Book an engagement with a valid sample PDF and read the server-generated reference.
7. Compare owner, member, and billing projections; switch a multi-organization account's active context.
8. In a separate administrator profile, download the authorization and move the engagement to `scoping`.
9. Move its invoice to `outstanding`, then return to the organization and show the persisted update.
10. Show final-owner protection, add/edit/delete a temporary resource, demonstrate a referenced service conflict, and administer the inquiry.

## CRUD evidence matrix

| Operation | Demonstration |
|---|---|
| Create | Register an organization owner, create invitation/membership, submit inquiry, book engagement, add service/resource |
| Read | Organization roster, received invitations, shared dashboard/detail, public catalogue, admin tables |
| Update | Switch active organization, change member role, edit service/resource, update workflow states |
| Delete | Remove an allowed membership, cancel an invitation, delete unused service/resource/inquiry |
| Controlled business update | Client cancellation of a pending/scoping engagement |

## Prepared demonstration data

- One administrator created with `npm run seed:admin`
- One fresh client email not already present
- One second client for ownership isolation
- One invited member and one billing user for role projection
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
