# Milestone 2: Low-Fidelity Wireframes

These as-built wireframes document hierarchy and behavior. Visual styling is governed by `DESIGN.md`.

## Home

```text
[Brand] [Public navigation]                         [Login] [Register]
-----------------------------------------------------------------------
[Primary value statement]             [Attack-path illustration]
[Book engagement] [Review services]
-----------------------------------------------------------------------
[Method summary] [Service teasers from database]
[Audience / evidence sections]
[Inquiry form -> database]
[Fictional academic disclaimer + footer navigation]
```

## Services and Vault

```text
[Page title + explanation]
-----------------------------------------------------------------------
Services: [API loading/error state] -> [Service card grid] -> [Engage]
Vault:    [Search] [Category filters] [Result count]
          [Published resource grid] / [Empty state] / [Error state]
```

## Inquiry

```text
[Page title]
-----------------------------------------------------------------------
[Name]
[Company email] [Company]
[Message]
[Data handling notice]
[Submit] [Live success/error message]   [Handling and response guidance]
```

## Registration and Login

```text
[Access page title]
-----------------------------------------------------------------------
Register: [Name] [Email] [Company] [Password] [Confirm] [Authorization]
Login:    [Email] [Password]
[Submit] [Field errors] [Live server status]
                                      [What the account provides]
```

## Engagement request

```text
[Progress: 1 Scope ---- 2 Schedule ---- 3 Authorization/Billing]
-----------------------------------------------------------------------
Step 1: [Service] [Scope] [Targets]
Step 2: [Requested start]
Step 3: [Signed PDF] [Acknowledgment] [Billing method] [Conditional PO]
-----------------------------------------------------------------------
[Back] [Continue/Submit] -> [Committed ORL reference receipt]
```

## Client dashboard and detail

```text
Dashboard
[Welcome] [New engagement] [Logout]
[Total] [Open] [Completed]
[Reference | Service | Requested | Status | Invoice | Amount | Actions]
[Loading / Empty / Error states]

Detail
[Back] [Reference + service] [Status]
[Schedule] [Created] [Billing and invoice]
[Scope]
[Ordered targets]
[Status history timeline]
[Cancel when pending/scoping]
```

## Administrator console

```text
[Administrator identity] [Logout]
[Services] [Resources] [Engagements] [Inquiries]  <- keyboard tab list
-----------------------------------------------------------------------
Services:    [Add/Edit form] [CRUD table]
Resources:   [Add/Edit form] [Publish and CRUD table]
Engagements: [List] -> [Detail, PDF, status transition, invoice update]
Inquiries:   [List] [Review/Close/Delete]
[Per-panel loading, empty, validation, conflict, and success states]
```

## Annotated interaction requirements

- Forms preserve user input after failed requests.
- Status regions use `role="status"`; validation identifies the affected control.
- Confirmation is required before cancellation or deletion.
- Admin tabs support Arrow Left, Arrow Right, Home, and End.
- Tables stack into readable record blocks on narrow screens.
- Protected PDF content never appears as a public URL.
