"use strict";

// Static synthetic fixtures only: this script never reads .env, the database, or SMTP settings.
const fs = require("node:fs");
const path = require("node:path");
const { renderEmail } = require("../src/email-templates");
const { eventEmail } = require("../src/notification-policy");
const destination = path.resolve(__dirname, "../../output/email-previews");
const baseUrl = "https://oracle-red-labs.example.test/";
const syntheticToken = "abcdef0123456789".repeat(4);
const longBaseUrl = `${baseUrl}synthetic-deployment/${"long-application-path-".repeat(8)}/`;
const fixtures = {
  "account-update": eventEmail(baseUrl, { organization_id: 42, notification_id: 108 }),
  "existing-account-invitation": renderEmail({ variant: "existing-account-invitation",
    organizationName: "Synthetic Research Organization", intendedRole: "manager", url: `${baseUrl}organization.html#received-heading` }),
  "new-account-invitation": renderEmail({ variant: "new-account-invitation",
    organizationName: "Synthetic Research Organization", intendedRole: "member", url: `${baseUrl}accept-invitation.html?token=${syntheticToken}` }),
  "invitation-long-content": renderEmail({ variant: "new-account-invitation",
    organizationName: `Synthetic Research & Development <Demonstration> ${"UnbrokenOrganizationName".repeat(5)}`,
    intendedRole: "billing", url: `${longBaseUrl}accept-invitation.html?token=${syntheticToken}` }),
};
fixtures["account-update-inline-only"] = { ...fixtures["account-update"],
  html: fixtures["account-update"].html.replace(/<style>[\s\S]*?<\/style>/, "") };
fixtures["invitation-unstyled"] = { ...fixtures["new-account-invitation"],
  html: fixtures["new-account-invitation"].html.replace(/<style>[\s\S]*?<\/style>/, "")
    .replace(/ style="[^"]*"/g, "").replace(/<div aria-hidden="true">[\s\S]*?<\/div>/, "") };
fs.mkdirSync(destination, { recursive: true });
for (const [name, message] of Object.entries(fixtures)) {
  fs.writeFileSync(path.join(destination, `${name}.html`), message.html);
  fs.writeFileSync(path.join(destination, `${name}.txt`), `Subject: ${message.subject}\n\n${message.text}\n`);
}
console.log(`Created ${Object.keys(fixtures).length} synthetic email preview pairs in output/email-previews/. No messages sent.`);
