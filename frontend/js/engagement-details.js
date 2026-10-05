(function () {
  "use strict";
  var status = document.getElementById("detail-status");
  var root = document.getElementById("engagement-detail");
  function text(id, value) { document.getElementById(id).textContent = value; }
  function date(value) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  function money(value) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
  function addPair(dl, label, value) { var dt = document.createElement("dt"); var dd = document.createElement("dd"); dt.textContent = label; dd.textContent = value; dl.append(dt, dd); }
  async function init() {
    var user = await ORLApi.guard("client");
    if (!user) return;
    var reference = new URLSearchParams(location.search).get("reference");
    if (!/^ORL-\d{6}$/.test(reference || "")) { status.textContent = "Choose an engagement from your dashboard."; return; }
    try {
      var item = (await ORLApi.request("/api/engagements/" + encodeURIComponent(reference))).data;
      text("detail-reference", item.reference_code); text("detail-service", item.service_name); text("detail-organization", item.organization_name + " · submitted by " + item.submitted_by_name);
      if (item.scope_description !== undefined) text("detail-scope", item.scope_description);
      var badge = document.getElementById("detail-badge"); badge.className = "badge badge--" + item.status; badge.textContent = item.status;
      var summary = document.getElementById("detail-summary"); addPair(summary, "Requested start", date(item.requested_start_at)); if (item.billing_method !== undefined) addPair(summary, "Billing preference", item.billing_method.replace("_", " ")); if (item.invoice_amount !== undefined) addPair(summary, "Estimated amount", money(item.invoice_amount)); if (item.invoice_status !== undefined) addPair(summary, "Invoice state", item.invoice_status.replace("_", " ")); addPair(summary, "Submitted", date(item.created_at));
      var mayViewSensitive = user.active_organization.permissions.can_view_full_engagements;
      root.classList.toggle("detail-layout--single", !mayViewSensitive);
      document.getElementById("detail-sensitive").hidden = !mayViewSensitive;
      document.getElementById("detail-history-panel").hidden = !mayViewSensitive;
      if (mayViewSensitive) { var targets = document.getElementById("detail-targets"); item.targets.forEach(function (entry) { var li = document.createElement("li"); li.textContent = entry.target_value; targets.appendChild(li); }); var history = document.getElementById("detail-history"); item.status_history.forEach(function (entry) { var li = document.createElement("li"); var title = document.createElement("strong"); var meta = document.createElement("span"); title.textContent = entry.new_status; meta.textContent = date(entry.created_at) + (entry.note ? " · " + entry.note : ""); li.append(title, meta); history.appendChild(li); }); }
      status.textContent = "Engagement record loaded."; root.hidden = false;
    } catch (error) { status.textContent = error.message; }
  }
  init();
})();
