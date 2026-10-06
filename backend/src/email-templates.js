"use strict";

const DISCLOSURE = "Oracle Red Labs is a fictional company created for an academic project (ITS122P).";
const INVITATION_GUIDANCE = "Invitations expire seven days after creation. If you were not expecting this invitation, you can ignore it.";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

// Accept only the copy needed by each template. Event metadata never enters the layout.
function renderEmail({ variant, url, organizationName, intendedRole }) {
  const destination = new URL(url);
  if (!["http:", "https:"].includes(destination.protocol) || destination.username || destination.password) {
    throw new Error("Invalid email destination");
  }
  let subject;
  let heading;
  let message;
  let instruction;
  let action;
  let guidance;
  switch (variant) {
    case "account-update":
      subject = "Oracle Red Labs: an update is available";
      heading = "An update is available";
      message = "An update is available in your Oracle Red Labs account.";
      instruction = "Sign in to review it.";
      action = "Review update";
      guidance = "You can change event email preferences in Notifications.";
      break;
    case "existing-account-invitation":
    case "new-account-invitation":
      subject = "Oracle Red Labs: organization invitation";
      heading = "Organization invitation";
      message = `You have been invited to join ${organizationName} as ${intendedRole}.`;
      instruction = variant === "existing-account-invitation"
        ? "Sign in to review this invitation in your received invitations."
        : "Sign in or create an account to review this invitation.";
      action = "Review invitation";
      guidance = INVITATION_GUIDANCE;
      break;
    default:
      throw new Error("Unknown email template");
  }

  const href = escapeHtml(destination.href);
  // Optional break points keep the visible fallback URL readable even without CSS.
  // They add no characters to the link text and never change the actual destination.
  const urlLabel = destination.href.match(/.{1,24}/g).map(escapeHtml).join("<wbr>");
  const text = ["Oracle Red Labs", heading, message, instruction, `${action}:\n${destination.href}`,
    guidance, DISCLOSURE].join("\n\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(subject)}</title>
  <style>
    @media screen and (max-width: 600px) {
      .email-content { padding: 24px !important; }
      .email-heading { font-size: 26px !important; line-height: 32px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #050505; color: #FFFFFF; font-family: Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%;">
  <div aria-hidden="true" style="display: none; font-size: 1px; line-height: 1px; color: #050505; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all;">${escapeHtml(message)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; table-layout: fixed; background-color: #050505;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; table-layout: fixed; background-color: #0D0D0F; border: 1px solid #27272A; border-radius: 8px;">
          <tr>
            <td class="email-content" style="padding: 40px; color: #FFFFFF; font-family: Arial, Helvetica, sans-serif; word-wrap: break-word; overflow-wrap: anywhere;">
              <p style="margin: 0 0 40px; color: #FFFFFF; font-size: 20px; line-height: 24px; font-weight: 700; letter-spacing: 0.8px;">ORACLE <span style="color: #D13B3B;">RED LABS</span></p>
              <h1 class="email-heading" style="margin: 0 0 16px; color: #FFFFFF; font-size: 28px; line-height: 36px; font-weight: 700; letter-spacing: -0.5px;">${escapeHtml(heading)}</h1>
              <p style="margin: 0 0 12px; color: #FFFFFF; font-size: 16px; line-height: 26px;">${escapeHtml(message)}</p>
              <p style="margin: 0 0 24px; color: #A1A1AA; font-size: 16px; line-height: 26px;">${escapeHtml(instruction)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px;">
                <tr>
                  <td style="background-color: #D13B3B; border-radius: 8px; mso-padding-alt: 12px 24px;">
                    <a href="${href}" style="display: inline-block; padding: 12px 24px; border: 1px solid #D13B3B; border-radius: 8px; background-color: #D13B3B; color: #FFFFFF; font-size: 16px; line-height: 24px; font-weight: 700; text-align: center; text-decoration: none;">${escapeHtml(action)}</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; color: #A1A1AA; font-size: 14px; line-height: 22px;">Or open this link:</p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 22px; word-break: break-all; word-wrap: break-word; overflow-wrap: anywhere;"><a href="${href}" style="color: #FFFFFF; text-decoration: underline; word-break: break-all; word-wrap: break-word; overflow-wrap: anywhere;">${urlLabel}</a></p>
              <p style="margin: 0 0 24px; color: #A1A1AA; font-size: 14px; line-height: 22px;">${escapeHtml(guidance)}</p>
              <p style="margin: 0; padding-top: 24px; border-top: 1px solid #27272A; color: #A1A1AA; font-size: 12px; line-height: 20px;">${escapeHtml(DISCLOSURE)}</p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, text, html };
}

module.exports = { renderEmail };
