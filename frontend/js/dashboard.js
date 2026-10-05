(function () {
  "use strict";
  var rows = [];
  var status = document.getElementById("dashboard-status");
  var tbody = document.querySelector("#engagements-table tbody");
  var empty = document.getElementById("dashboard-empty");
  var stats = document.getElementById("dashboard-stats");
  var user = null;

  function el(tag, className, text) { var node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
  function formatDate(value) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  function formatMoney(value) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
  function cell(label, content) { var td = el("td"); td.dataset.label = label; if (content instanceof Node) td.appendChild(content); else td.textContent = content; return td; }

  function renderStats() {
    var open = rows.filter(function (item) { return ["pending", "scoping", "active"].includes(item.status); }).length;
    var mayViewInvoices = user.active_organization.permissions.can_view_invoices;
    var outstanding = mayViewInvoices ? rows.filter(function (item) { return item.invoice_status === "outstanding"; }).reduce(function (sum, item) { return sum + Number(item.invoice_amount); }, 0) : 0;
    stats.replaceChildren();
    var summary = [["Shared engagements", rows.length], ["Open requests", open], mayViewInvoices ? ["Outstanding invoices", formatMoney(outstanding)] : ["Access level", user.active_organization.role]];
    summary.forEach(function (pair) {
      var card = el("article", "card"); card.appendChild(el("p", "card__label", pair[0])); card.appendChild(el("p", "stat__value", String(pair[1]))); stats.appendChild(card);
    });
  }

  function renderTable() {
    tbody.replaceChildren();
    var permissions = user.active_organization.permissions;
    document.querySelectorAll("[data-billing-column]").forEach(function (node) { node.hidden = !permissions.can_view_invoices; });
    var guidance = document.querySelector("#engagements-guidance");
    if (guidance && !permissions.can_submit_engagements) {
      guidance.textContent = "Billing members can review schedules and invoice state. Scope details and engagement actions stay restricted.";
    }
    rows.forEach(function (item) {
      var tr = document.createElement("tr"); var ref = el("th", "table__row-head", item.reference_code); ref.scope = "row"; tr.appendChild(ref);
      tr.appendChild(cell("Service", item.service_name)); tr.appendChild(cell("Submitted by", item.submitted_by_name)); tr.appendChild(cell("Status", el("span", "badge badge--" + item.status, item.status))); tr.appendChild(cell("Requested slot", formatDate(item.requested_start_at))); if (permissions.can_view_invoices) { var invoiceCell = cell("Invoice", item.invoice_status.replace("_", " ") + " · " + formatMoney(item.invoice_amount)); invoiceCell.setAttribute("data-billing-column", ""); tr.appendChild(invoiceCell); }
      var actions = el("div", "table__actions"); var view = el("a", "btn btn--ghost btn--sm", "View details"); view.href = "engagement-details.html?reference=" + encodeURIComponent(item.reference_code); actions.appendChild(view);
      if (permissions.can_cancel_engagements) { var cancel = el("button", "btn btn--danger btn--sm", "Cancel"); cancel.type = "button"; cancel.disabled = !["pending", "scoping"].includes(item.status); cancel.addEventListener("click", async function () { if (!window.confirm("Cancel " + item.reference_code + "? This cannot be reversed.")) return; cancel.disabled = true; try { await ORLApi.request("/api/engagements/" + encodeURIComponent(item.reference_code) + "/cancel", { method: "PATCH", body: {} }); await load(); } catch (error) { status.textContent = error.message; cancel.disabled = false; } }); actions.appendChild(cancel); }
      tr.appendChild(cell("Actions", actions)); tbody.appendChild(tr);
    });
    empty.hidden = rows.length !== 0; document.getElementById("engagements-table").hidden = rows.length === 0;
  }

  async function load() {
    user = await ORLApi.guard("client"); if (!user) return; status.textContent = "Loading shared engagements…";
    document.getElementById("dashboard-organization-name").textContent = user.active_organization.name;
    document.getElementById("dashboard-organization-role").textContent = user.active_organization.role;
    document.querySelectorAll('a[href="engage.html"]').forEach(function (link) { if (!user.active_organization.permissions.can_submit_engagements) link.hidden = true; });
    try { rows = (await ORLApi.request("/api/engagements")).data; renderStats(); renderTable(); status.textContent = rows.length ? rows.length + " shared engagement" + (rows.length === 1 ? "" : "s") + " loaded." : "No engagements are attached to this organization."; }
    catch (error) { status.textContent = error.message; }
  }
  load();
})();
