(function () {
  "use strict";
  var status = document.getElementById("invitation-status");
  var preview = document.getElementById("invitation-preview");
  var token = new URLSearchParams(window.location.search).get("token") || "";

  function date(value) {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date(value));
  }

  async function init() {
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      status.textContent = "This invitation link is invalid.";
      status.classList.add("form-message--error");
      return;
    }
    try {
      var payload = await ORLApi.request("/api/invitations/preview?token=" + encodeURIComponent(token));
      var invitation = payload.data;
      document.getElementById("invitation-organization").textContent = invitation.organization_name;
      document.getElementById("invitation-role").textContent = invitation.intended_role;
      document.getElementById("invitation-expiry").textContent = date(invitation.expires_at);
      var user = await ORLApi.currentUser(true);
      var accept = document.getElementById("accept-invitation");
      var register = document.getElementById("register-for-invitation");
      var login = document.getElementById("login-for-invitation");
      if (user && user.role === "client") {
        accept.hidden = false;
        register.hidden = true;
        login.hidden = true;
      } else if (user) {
        register.hidden = true;
        login.hidden = true;
        status.textContent = "Administrator accounts cannot accept organization invitations.";
      } else {
        var next = "accept-invitation.html?token=" + encodeURIComponent(token);
        register.href = "register.html?invitation=" + encodeURIComponent(token);
        login.href = "login.html?next=" + encodeURIComponent(next);
      }
      accept.addEventListener("click", async function () {
        accept.disabled = true;
        status.textContent = "Accepting invitation…";
        try {
          var accepted = await ORLApi.request("/api/invitations/accept", { method: "POST", body: { token: token } });
          status.textContent = accepted.message;
          window.location.assign("organization.html");
        } catch (error) {
          status.textContent = error.message;
          status.classList.add("form-message--error");
          accept.disabled = false;
        }
      });
      preview.hidden = false;
      if (!user) status.textContent = "Invitation ready. Sign in or create the invited account to continue.";
      else if (user.role === "client") status.textContent = "Invitation ready for review.";
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("form-message--error");
    }
  }

  init();
})();
