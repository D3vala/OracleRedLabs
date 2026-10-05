(function () {
  "use strict";
  var form = document.getElementById("register-form");
  if (!form) return;
  var token = new URLSearchParams(window.location.search).get("invitation") || "";
  if (!token) return;
  var notice = document.getElementById("registration-invitation");
  var company = document.getElementById("register-company");
  var submit = form.querySelector('button[type="submit"]');
  notice.hidden = false;
  submit.disabled = true;
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    notice.textContent = "This invitation link is invalid. Ask an organization owner for a new link.";
    return;
  }
  ORLApi.request("/api/invitations/preview?token=" + encodeURIComponent(token)).then(function (payload) {
    var invitation = payload.data;
    notice.textContent = "You are registering to join " + invitation.organization_name + " as " + invitation.intended_role + ".";
    company.value = invitation.organization_name;
    company.readOnly = true;
    company.setAttribute("aria-describedby", "registration-invitation");
    submit.textContent = "Create Account and Join";
    submit.disabled = false;
  }).catch(function (error) {
    notice.textContent = error.message;
  });
})();
