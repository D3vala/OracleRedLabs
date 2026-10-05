(function () {
  "use strict";

  var state = { user: null, organizations: [], current: null, members: [], pending: [], received: [] };
  var status = document.getElementById("organization-status");
  var switcher = document.getElementById("organization-switcher");

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function announce(message, isError) {
    status.textContent = message;
    status.classList.toggle("form-message--error", Boolean(isError));
  }

  function date(value) {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
  }

  function roleLabel(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function setControls() {
    var permissions = state.current.permissions;
    document.getElementById("active-role").textContent = roleLabel(state.current.role) + " role";
    document.getElementById("organization-name").value = state.current.name;
    document.getElementById("organization-billing-email").value = state.current.billing_email || "";
    document.querySelectorAll("#organization-form input").forEach(function (input) { input.disabled = !permissions.can_manage_organization; });
    document.getElementById("organization-save").hidden = !permissions.can_manage_organization;
    document.getElementById("invite-panel").hidden = !permissions.can_invite_members;
    document.getElementById("pending-panel").hidden = !permissions.can_view_pending_invitations;
    var ownerOption = document.querySelector('#invitation-role option[value="owner"]');
    ownerOption.hidden = state.current.role !== "owner";
    ownerOption.disabled = state.current.role !== "owner";
  }

  function renderOrganizations() {
    switcher.replaceChildren();
    state.organizations.forEach(function (organization) {
      var option = el("option", null, organization.name + " · " + roleLabel(organization.role));
      option.value = organization.organization_id;
      option.selected = organization.organization_id === state.current.organization_id;
      switcher.appendChild(option);
    });
    switcher.disabled = state.organizations.length < 2;
  }

  function roleSelect(member) {
    var select = el("select", "select select--inline");
    select.setAttribute("aria-label", "Role for " + member.full_name);
    ["owner", "manager", "member", "billing"].forEach(function (role) {
      var option = el("option", null, roleLabel(role));
      option.value = role;
      option.selected = role === member.role;
      select.appendChild(option);
    });
    var actorRole = state.current.role;
    var manageable = actorRole === "owner" || (actorRole === "manager" && ["member", "billing"].includes(member.role));
    select.disabled = !manageable;
    if (actorRole === "manager") select.querySelector('option[value="owner"]').disabled = true;
    select.addEventListener("change", async function () {
      var previousRole = member.role;
      var requestedRole = select.value;
      var confirmed = window.confirm(
        "Change " + member.full_name + " from " + roleLabel(previousRole) + " to " + roleLabel(requestedRole) + "?"
      );
      if (!confirmed) {
        select.value = previousRole;
        return;
      }
      select.disabled = true;
      select.setAttribute("aria-busy", "true");
      announce("Updating " + member.full_name + " to the " + requestedRole + " role…");
      try {
        await ORLApi.request("/api/organizations/current/members/" + member.user_id, { method: "PATCH", body: { role: requestedRole } });
        await loadCurrent();
        announce(member.full_name + " now has the " + requestedRole + " role.");
      } catch (error) {
        select.value = previousRole;
        announce(error.message, true);
      } finally {
        select.removeAttribute("aria-busy");
        if (select.isConnected) select.disabled = !manageable;
      }
    });
    return select;
  }

  function cell(label, content) {
    var td = el("td");
    td.dataset.label = label;
    if (content instanceof Node) td.appendChild(content); else td.textContent = content;
    return td;
  }

  function renderMembers() {
    var tbody = document.querySelector("#members-table tbody");
    tbody.replaceChildren();
    state.members.forEach(function (member) {
      var row = document.createElement("tr");
      var name = el("th", "table__row-head", member.full_name);
      name.scope = "row";
      var actions = el("div", "table__actions");
      var manageable = state.current.role === "owner" || (state.current.role === "manager" && ["member", "billing"].includes(member.role));
      if (manageable) {
        var remove = el("button", "btn btn--danger btn--sm", member.user_id === state.user.user_id ? "Leave" : "Remove");
        remove.type = "button";
        remove.addEventListener("click", function () { removeMember(member); });
        actions.appendChild(remove);
      } else {
        actions.appendChild(el("span", "text-faint", "No actions"));
      }
      row.append(name, cell("Email", member.email || "Private"), cell("Role", roleSelect(member)), cell("Joined", date(member.joined_at)), cell("Actions", actions));
      tbody.appendChild(row);
    });
    document.getElementById("member-count").textContent = state.members.length + " member" + (state.members.length === 1 ? "" : "s");
    document.getElementById("members-table").hidden = state.members.length === 0;
    document.getElementById("members-empty").hidden = state.members.length !== 0;
  }

  async function removeMember(member) {
    var message = member.user_id === state.user.user_id
      ? "Leave " + state.current.name + "? You may lose access to its engagements."
      : "Remove " + member.full_name + " from " + state.current.name + "?";
    if (!window.confirm(message)) return;
    try {
      await ORLApi.request("/api/organizations/current/members/" + member.user_id, { method: "DELETE" });
      if (member.user_id === state.user.user_id) {
        window.location.reload();
        return;
      }
      await loadCurrent();
      announce(member.full_name + " was removed.");
    } catch (error) { announce(error.message, true); }
  }

  function renderInvitationList(rootId, emptyId, rows, received) {
    var root = document.getElementById(rootId);
    root.replaceChildren();
    rows.forEach(function (item) {
      var li = el("li", "organization-list__item");
      var copy = el("div");
      copy.append(el("strong", null, received ? item.organization_name : item.invited_email));
      copy.append(el("span", "text-muted", roleLabel(item.intended_role) + " · expires " + date(item.expires_at)));
      var button = el("button", received ? "btn btn--primary btn--sm" : "btn btn--danger btn--sm", received ? "Accept" : "Cancel");
      button.type = "button";
      button.addEventListener("click", async function () {
        if (!received && !window.confirm("Cancel the invitation for " + item.invited_email + "?")) return;
        button.disabled = true;
        try {
          if (received) {
            await ORLApi.request("/api/invitations/received/" + item.invitation_id + "/accept", { method: "POST", body: {} });
            window.location.reload();
          } else {
            await ORLApi.request("/api/organizations/current/invitations/" + item.invitation_id, { method: "DELETE" });
            await loadCurrent();
            announce("Invitation cancelled.");
          }
        } catch (error) { button.disabled = false; announce(error.message, true); }
      });
      li.append(copy, button);
      root.appendChild(li);
    });
    document.getElementById(emptyId).hidden = rows.length !== 0;
  }

  async function loadCurrent() {
    var results = await Promise.all([
      ORLApi.request("/api/organizations"),
      ORLApi.request("/api/organizations/current"),
      ORLApi.request("/api/organizations/current/members"),
      ORLApi.request("/api/invitations/received"),
    ]);
    state.organizations = results[0].data;
    state.current = results[1].data;
    state.members = results[2].data;
    state.received = results[3].data;
    state.pending = state.current.permissions.can_view_pending_invitations
      ? (await ORLApi.request("/api/organizations/current/invitations")).data
      : [];
    renderOrganizations();
    setControls();
    renderMembers();
    renderInvitationList("pending-invitations", "pending-empty", state.pending, false);
    renderInvitationList("received-invitations", "received-empty", state.received, true);
  }

  async function init() {
    state.user = await ORLApi.guard("client");
    if (!state.user) return;
    try {
      await loadCurrent();
      announce("Organization access loaded.");
    } catch (error) { announce(error.message, true); }

    switcher.addEventListener("change", async function () {
      switcher.disabled = true;
      try {
        await ORLApi.request("/api/organizations/active", { method: "PATCH", body: { organization_id: Number(switcher.value) } });
        await loadCurrent();
        announce("Active organization changed to " + state.current.name + ".");
      } catch (error) { announce(error.message, true); }
      finally { switcher.disabled = state.organizations.length < 2; }
    });

    document.getElementById("organization-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      var form = event.currentTarget;
      var button = document.getElementById("organization-save");
      button.disabled = true;
      try {
        var payload = await ORLApi.request("/api/organizations/current", {
          method: "PATCH",
          body: { name: form.elements.name.value, billing_email: form.elements.billing_email.value },
        });
        state.current = payload.data;
        await loadCurrent();
        announce(payload.message);
      } catch (error) { ORLApi.applyFieldErrors(form, error.fields); announce(error.message, true); }
      finally { button.disabled = false; }
    });

    document.getElementById("invitation-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      var form = event.currentTarget;
      var button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        var payload = await ORLApi.request("/api/organizations/current/invitations", {
          method: "POST",
          body: { email: form.elements.email.value, role: form.elements.role.value },
        });
        form.reset();
        if (payload.data.invitation_url) {
          var absolute = new URL(payload.data.invitation_url, window.location.href).href;
          document.getElementById("invitation-link").value = absolute;
          document.getElementById("invitation-link-panel").hidden = false;
        } else {
          document.getElementById("invitation-link-panel").hidden = true;
        }
        await loadCurrent();
        announce(payload.message);
      } catch (error) { ORLApi.applyFieldErrors(form, error.fields); announce(error.message, true); }
      finally { button.disabled = false; }
    });

    document.getElementById("copy-invitation-link").addEventListener("click", async function () {
      var input = document.getElementById("invitation-link");
      try {
        await navigator.clipboard.writeText(input.value);
        announce("Invitation link copied.");
      } catch (_error) {
        input.select();
        announce("Select and copy the invitation link.");
      }
    });
  }

  init();
})();
