# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Semantic HTML, CSS, and plain browser JavaScript served by a Node.js and Express application. MySQL stores users, organizations, memberships, invitations, sessions, catalogue records, inquiries, engagements, document metadata, invoices, and audit history. The front end retains its build-free structure.

## Users

The primary audience is CISOs and security or engineering leaders evaluating an authorised red-team partner. Secondary audiences are academic graders and portfolio reviewers evaluating the quality and completeness of this fictional business concept.

## Product Purpose

Oracle Red Labs presents controlled red-team services and lets a visitor create or join an organization, submit an authorized engagement request, and track its persisted status with other authorized members. Administrators manage the catalogue, inquiries, engagements, invoices, and private authorization documents.

## Positioning

Oracle Red Labs focuses on simulation-first intrusion testing under written authorisation. Findings are presented as replayable attack paths that engineers can reproduce, remediate, and retest rather than as scanner scores alone.

## Operating Context

Visitors compare three fictional services: ORACLE AI, PHANTASM, and CHAINBREAK. The application records requests and administrative states; it does not run the described security work. Public, client, and administrator areas share the same Express origin.

## Capabilities and Constraints

- Accounts, organizations, memberships, invitations, inquiries, engagements, status history, catalogue records, and billing states persist in MySQL.
- Engagements belong to organizations while retaining the original submitting user.
- One active organization is selected per server session; the data model supports multiple memberships.
- Organization-scoped in-app notifications persist per recipient, with current-role visibility, individual read state, and 90-day retention.
- SMTP invitation and event emails use a transactional queue, retries, per-user organization preferences, and generic event summaries. Sending is disabled until configured; manual invitation links remain available.
- The browser source remains build-free and framework-free; Express is required to serve it with the API.
- Existing page routes and service query strings remain compatible.
- JavaScript enhancements require readable no-script and reduced-motion fallbacks.
- Billing is a recorded preference only. The application never collects card details or processes payments.
- Uploaded authorization PDFs are private and available only through an administrator route.
- No verified clients, testimonials, performance outcomes, or commercial claims are available.

## Brand Commitments

- Name: Oracle Red Labs.
- Tagline: “We break so you can build.”
- Primary action: “Book a red-team briefing.”
- The identity uses a near-black technical environment with a disciplined red signal color.
- The homepage’s locked visual world is “Breach Replay Engine”: a procedural red particle attack surface resolving into traced, replayable intrusion paths.

## Evidence on Hand

- Service definitions and placeholder prices are seeded from `database/seed.sql`.
- Existing descriptions of the four-stage engagement method.
- Existing SVG brand mark and technical imagery in `frontend/assets/images/`.
- Synthetic engagement metrics may be used only when they are visibly labeled as demonstration data.
- There are no real client logos, testimonials, case studies, or measured outcomes to imply.

## Product Principles

- Authorisation before action.
- Reproducible evidence over dramatic claims.
- Clear scope and stop conditions.
- Remediation and retest complete the engagement.
- Demo content is labeled honestly.

## Accessibility & Inclusion

Use semantic HTML, visible keyboard focus, readable contrast, 44px touch targets, progressive enhancement, and a complete `prefers-reduced-motion` experience.
