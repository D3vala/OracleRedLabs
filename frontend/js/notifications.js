(function () {
  "use strict";
  var state = { organization: null, organizations: [], filter: "all", cursor: null, watermark: 0, generation: 0, busy: false, items: [], pendingSwitch: null };
  var status = document.getElementById("notification-status");
  var content = document.getElementById("notification-content");
  var list = document.getElementById("notification-list");
  var form = document.getElementById("notification-preferences");
  var deepLink = new URLSearchParams(window.location.search);

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function announce(message, error) {
    status.textContent = message;
    status.classList.toggle("form-message--error", Boolean(error));
  }
  function url(path) { return "/api/notifications" + path + (path.indexOf("?") < 0 ? "?" : "&") + "organization_id=" + state.organization.organization_id; }
  function setBusy(value) {
    state.busy = value;
    content.querySelectorAll("button").forEach(function (button) { button.disabled = value; });
    document.getElementById("notification-organization").disabled = value || state.organizations.length < 2;
    document.getElementById("notification-read-all").disabled = value || !state.watermark;
  }
  function clear() {
    state.generation += 1;
    state.items = [];
    state.cursor = null;
    state.watermark = 0;
    list.replaceChildren();
    content.hidden = true;
    document.getElementById("notification-more").hidden = true;
    document.getElementById("notification-switch-prompt").hidden = true;
  }
  function render() {
    list.replaceChildren();
    state.items.forEach(function (item) {
      var row = el("li", "notification-row" + (!item.read_at ? " is-unread" : ""));
      row.id = "notification-" + item.notification_id;
      var body = el("div", "notification-row__body");
      body.appendChild(el("span", "badge badge--tag", item.read_at ? "Read" : "Unread"));
      body.appendChild(el("h3", null, item.title));
      body.appendChild(el("p", "text-muted", item.message));
      var time = el("time", "mono", new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at)));
      time.dateTime = new Date(item.created_at).toISOString();
      body.appendChild(time);
      var actions = el("div", "notification-actions");
      if (item.url) {
        var open = el("a", "btn btn--secondary", "Open");
        open.href = item.url;
        open.setAttribute("aria-label", "Open: " + item.title);
        open.setAttribute("data-notification-action", "open");
        open.addEventListener("click", function (event) {
          event.preventDefault();
          if (!state.busy) mutate(item, true, true);
        });
        actions.appendChild(open);
      } else actions.appendChild(el("span", "text-muted", "Destination unavailable"));
      var read = el("button", "btn btn--ghost", item.read_at ? "Mark unread" : "Mark read");
      read.type = "button";
      read.setAttribute("data-notification-action", "toggle");
      read.setAttribute("aria-label", (item.read_at ? "Mark unread: " : "Mark read: ") + item.title);
      read.addEventListener("click", function () { mutate(item, !item.read_at, false); });
      actions.appendChild(read);
      row.append(body, actions);
      list.appendChild(row);
    });
    var empty = document.getElementById("notification-empty");
    empty.hidden = state.items.length > 0;
    document.getElementById("notification-empty-heading").textContent = state.filter === "unread" ? "You're all caught up" : "No notifications yet";
    document.getElementById("notification-empty-copy").textContent = state.filter === "unread" ? "There are no unread updates for this organization." : "New updates for this organization will appear here.";
    document.getElementById("notification-more").hidden = !state.cursor;
    document.getElementById("notification-all").setAttribute("aria-pressed", String(state.filter === "all"));
    document.getElementById("notification-unread").setAttribute("aria-pressed", String(state.filter === "unread"));
  }
  async function fail(error) {
    if ([401, 403, 409].includes(error.status)) {
      clear();
      window.dispatchEvent(new Event("orl:organization-changing"));
    }
    if (error.status === 401) { await ORLApi.guard("client"); return; }
    announce(error.status === 404 ? "That update is no longer available. Refresh your notifications." : error.message, true);
    document.getElementById("notification-retry").hidden = false;
  }
  async function page(append) {
    var generation = state.generation;
    var path = "/?filter=" + state.filter + (append && state.cursor ? "&cursor=" + state.cursor : "");
    var payload = await ORLApi.request(url(path));
    if (generation !== state.generation) return false;
    if (payload.meta.role !== state.organization.role) { throw Object.assign(new Error("Your membership role changed. Refresh to continue."), { status: 409 }); }
    state.items = append ? state.items.concat(payload.data) : payload.data;
    state.cursor = payload.meta.next_cursor;
    state.watermark = payload.meta.watermark;
    document.getElementById("notification-count").textContent = payload.meta.unread_count + " unread · " + state.organization.name;
    render();
    window.dispatchEvent(new Event("orl:notifications-updated"));
    return true;
  }
  async function mutate(item, read, navigate) {
    if (state.busy) return;
    setBusy(true);
    var generation = state.generation;
    try {
      await ORLApi.request(url("/" + item.notification_id), { method: "PATCH", body: { read: read } });
      if (generation !== state.generation) return;
      if (navigate) { window.location.assign(item.url); return; }
      if (await page(false) && generation === state.generation) announce(read ? "Notification marked read." : "Notification marked unread.");
    } catch (error) { if (generation === state.generation) await fail(error); }
    finally {
      if (generation === state.generation) {
        setBusy(false);
        if (!navigate && !content.hidden) {
          var row = document.getElementById("notification-" + item.notification_id);
          var focus = row ? row.querySelector('[data-notification-action="toggle"]') : list.querySelector('[data-notification-action="toggle"]');
          if (!focus) { focus = document.getElementById("updates-heading"); focus.tabIndex = -1; }
          focus.focus();
        }
      }
    }
  }
  async function refresh() {
    clear();
    var generation = state.generation;
    setBusy(true);
    announce("Loading your updates…");
    document.getElementById("notification-retry").hidden = true;
    try {
      var user = await ORLApi.guard("client");
      if (!user || generation !== state.generation) return;
      var organizations = await ORLApi.request("/api/organizations");
      if (generation !== state.generation) return;
      state.organizations = organizations.data;
      state.organization = user.active_organization;
      var requested = deepLink.get("organization");
      if (requested && Number(requested) !== Number(state.organization.organization_id)) {
        var target = state.organizations.find(function (org) { return Number(org.organization_id) === Number(requested); });
        if (!target) { deepLink = new URLSearchParams(); throw new Error("The linked organization is no longer available to your account. Retry to view your active organization."); }
        state.pendingSwitch = target;
        document.getElementById("notification-switch-message").textContent = "This link belongs to " + target.name + ". Switch organizations to review it.";
        document.getElementById("notification-switch-prompt").hidden = false;
        announce("Confirm the organization before opening this update.");
        return;
      }
      var selector = document.getElementById("notification-organization");
      selector.replaceChildren();
      state.organizations.forEach(function (org) {
        var option = el("option", null, org.name + " · " + org.role);
        option.value = org.organization_id;
        option.selected = Number(org.organization_id) === Number(state.organization.organization_id);
        selector.appendChild(option);
      });
      document.getElementById("notification-role").textContent = state.organization.role + " role";
      var preferences = await ORLApi.request(url("/preferences"));
      if (generation !== state.generation) return;
      Object.keys(preferences.data).forEach(function (key) { form.elements[key].checked = preferences.data[key]; });
      document.querySelector("[data-notification-invoice]").hidden = !state.organization.permissions.can_view_invoices;
      document.querySelector("[data-notification-team]").hidden = !state.organization.permissions.can_manage_members;
      if (!await page(false) || generation !== state.generation) return;
      content.hidden = false;
      announce("Organization updates loaded.");
      try {
        var invitations = await ORLApi.request("/api/invitations/received");
        if (generation !== state.generation) return;
        var received = document.getElementById("notification-invitations");
        received.replaceChildren();
        invitations.data.forEach(function (invitation) {
          received.appendChild(el("li", "organization-list__item", invitation.organization_name + " · " + invitation.intended_role));
        });
        document.getElementById("notification-invitations-empty").hidden = invitations.data.length > 0;
        document.getElementById("notification-invitations-error").hidden = true;
      } catch (_error) {
        if (generation === state.generation) {
          document.getElementById("notification-invitations-error").hidden = false;
          document.getElementById("notification-retry").hidden = false;
        }
      }
      var id = deepLink.get("notification");
      if (id && /^\d+$/.test(id)) {
        var row = document.getElementById("notification-" + id);
        if (row) { row.tabIndex = -1; row.focus(); }
        else announce("The linked update is not on this page or is no longer available. Review the list below.");
      }
      deepLink = new URLSearchParams();
    } catch (error) { if (generation === state.generation) await fail(error); }
    finally { if (generation === state.generation) setBusy(false); }
  }
  async function switchOrganization(id) {
    clear();
    var generation = state.generation;
    window.dispatchEvent(new Event("orl:organization-changing"));
    try {
      await ORLApi.request("/api/organizations/active", { method: "PATCH", body: { organization_id: Number(id) } });
      if (generation !== state.generation) return;
      window.dispatchEvent(new Event("orl:organization-changed"));
      await refresh();
    } catch (error) { if (generation === state.generation) await fail(error); }
  }
  document.getElementById("notification-switch-confirm").addEventListener("click", function () {
    if (!state.pendingSwitch) return;
    var id = state.pendingSwitch.organization_id;
    state.pendingSwitch = null;
    switchOrganization(id);
  });
  document.getElementById("notification-organization").addEventListener("change", function (event) { deepLink = new URLSearchParams(); switchOrganization(event.target.value); });
  document.getElementById("notification-retry").addEventListener("click", refresh);
  document.getElementById("notification-more").addEventListener("click", async function () {
    if (state.busy) return;
    var generation = state.generation;
    setBusy(true);
    try { if (await page(true) && generation === state.generation) announce("More updates loaded."); }
    catch (error) { if (generation === state.generation) await fail(error); }
    finally {
      if (generation === state.generation) {
        setBusy(false);
        if (!content.hidden) {
          var focus = state.cursor ? document.getElementById("notification-more") : document.getElementById("updates-heading");
          if (!state.cursor) focus.tabIndex = -1;
          focus.focus();
        }
      }
    }
  });
  ["all", "unread"].forEach(function (filter) {
    document.getElementById("notification-" + filter).addEventListener("click", async function () {
      if (state.busy) return;
      var previous = state.filter;
      var generation = state.generation;
      state.filter = filter;
      setBusy(true);
      try { if (await page(false) && generation === state.generation) announce(filter === "unread" ? "Showing unread updates." : "Showing all updates."); }
      catch (error) { if (generation === state.generation) { state.filter = previous; await fail(error); } }
      finally { if (generation === state.generation) { setBusy(false); if (!content.hidden) document.getElementById("notification-" + filter).focus(); } }
    });
  });
  document.getElementById("notification-read-all").addEventListener("click", async function () {
    if (state.busy) return;
    var generation = state.generation;
    setBusy(true);
    try {
      await ORLApi.request(url("/read-all"), { method: "POST", body: { watermark: state.watermark } });
      if (generation !== state.generation) return;
      if (await page(false) && generation === state.generation) announce("Notifications marked read.");
    }
    catch (error) { if (generation === state.generation) await fail(error); }
    finally { if (generation === state.generation) { setBusy(false); if (!content.hidden) document.getElementById("notification-read-all").focus(); } }
  });
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (state.busy) return;
    var generation = state.generation;
    setBusy(true);
    var body = {};
    form.querySelectorAll("input[name]").forEach(function (input) { body[input.name] = input.checked; });
    try {
      await ORLApi.request(url("/preferences"), { method: "PATCH", body: body });
      if (generation === state.generation) announce("Email preferences saved for this organization.");
    }
    catch (error) { if (generation === state.generation) await fail(error); }
    finally { if (generation === state.generation) { setBusy(false); if (!content.hidden) form.querySelector('button[type="submit"]').focus(); } }
  });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
  refresh();
})();
