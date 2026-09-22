/* ==========================================================================
   js/vault-filter.js
   Feature 3: the Exploit Vault filter + live search (vault.html).

   Design rule from the brief: filter the in-memory data array and re-render
   the grid, rather than hiding pre-built DOM cards with display:none. That
   means the same function keeps working when `resources` is replaced by a
   fetch("/api/resources") response in Milestone 7.

   Filter and search combine with AND logic: a card must match the active
   category AND contain the search text.
   ========================================================================== */

(function () {
  "use strict";

  var ORL = window.ORL || {};

  /* Human-readable labels for the category values stored in the data file. */
  var CATEGORY_LABELS = {
    "whitepaper": "Whitepaper",
    "case-study": "Case Study",
    "rule-set": "Rule Set",
  };

  /* Decorative cover art per category. Chosen here rather than inside the data
     file so resources.js keeps exactly the columns the future API returns. */
  var COVER_BY_CATEGORY = {
    "whitepaper": "assets/images/cover-whitepaper.svg",
    "case-study": "assets/images/cover-case-study.svg",
    "rule-set": "assets/images/cover-rule-set.svg",
  };

  /* Module state */
  var grid = null;
  var searchInput = null;
  var statusLine = null;
  var emptyState = null;
  var filterButtons = [];
  var activeCategory = "all";
  var searchTerm = "";

  /** The full data set. `resources` is a top-level `const` in
      js/data/resources.js, which makes it a global lexical binding - it is
      reachable by name but deliberately NOT a property of window. */
  function allResources() {
    return typeof resources === "undefined" ? [] : resources;
  }

  /* ---------------------------------------------------------------------
     Filtering
     --------------------------------------------------------------------- */

  /** True when the entry matches the active category button. */
  function matchesCategory(resource) {
    return activeCategory === "all" || resource.category === activeCategory;
  }

  /** True when the entry's title or abstract contains the search text. */
  function matchesSearch(resource) {
    if (searchTerm === "") {
      return true;
    }
    var haystack = (resource.title + " " + resource.abstract).toLowerCase();
    return haystack.indexOf(searchTerm) !== -1;
  }

  /** The filtered list, rebuilt from the source array on every interaction. */
  function getVisibleResources() {
    return allResources().filter(function (resource) {
      return matchesCategory(resource) && matchesSearch(resource);
    });
  }

  /* ---------------------------------------------------------------------
     Rendering
     --------------------------------------------------------------------- */

  /** Build one vault card with DOM APIs (textContent keeps this injection-safe). */
  function buildCard(resource) {
    var card = ORL.el("article", "card");

    /* Decorative artwork: alt="" plus aria-hidden keeps it out of the
       accessibility tree, exactly as the brief asks for decorative images. */
    var cover = document.createElement("img");
    cover.className = "card__cover";
    cover.src = COVER_BY_CATEGORY[resource.category] || COVER_BY_CATEGORY.whitepaper;
    cover.alt = "";
    cover.setAttribute("aria-hidden", "true");
    cover.width = 640;
    cover.height = 200;
    cover.loading = "lazy";
    card.appendChild(cover);

    card.appendChild(
      ORL.el(
        "span",
        "badge badge--tag",
        CATEGORY_LABELS[resource.category] || resource.category
      )
    );

    card.appendChild(ORL.el("h3", null, resource.title));
    card.appendChild(ORL.el("p", "text-muted", resource.abstract));

    var meta = ORL.el("dl", "card__meta");
    meta.appendChild(ORL.el("dt", null, "Published"));
    meta.appendChild(ORL.el("dd", null, ORL.formatISODate(resource.published_at)));
    card.appendChild(meta);

    return card;
  }

  /** Re-render the whole grid from the filtered data. */
  function render() {
    var visible = getVisibleResources();
    var total = allResources().length;

    /* Rebuild the grid in one operation instead of toggling each card. */
    grid.replaceChildren();
    visible.forEach(function (resource) {
      grid.appendChild(buildCard(resource));
    });

    if (statusLine) {
      statusLine.textContent =
        visible.length === total
          ? total + " entries available"
          : visible.length + " of " + total + " entries match";
    }

    /* Show the empty state only when the combined filter removed everything. */
    if (emptyState) {
      emptyState.hidden = visible.length !== 0;
    }
    grid.hidden = visible.length === 0;
  }

  /* ---------------------------------------------------------------------
     Wiring
     --------------------------------------------------------------------- */

  /** Apply a category and repaint. */
  function setCategory(category) {
    activeCategory = category;

    /* aria-pressed is the accessible state; CSS styles it (see .filter-btn). */
    filterButtons.forEach(function (button) {
      button.setAttribute(
        "aria-pressed",
        button.getAttribute("data-category") === category ? "true" : "false"
      );
    });

    render();
  }

  function init() {
    grid = document.getElementById("vault-grid");
    if (!grid) {
      return; // not the vault page
    }

    if (typeof resources === "undefined") {
      return; // data file missing: nothing to render
    }

    searchInput = document.getElementById("vault-search");
    statusLine = document.getElementById("vault-status");
    emptyState = document.getElementById("vault-empty");
    filterButtons = ORL.$all("[data-category]");

    filterButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setCategory(button.getAttribute("data-category"));
      });
    });

    if (searchInput) {
      /* Listen on "input" (not "submit"): the grid updates as the user types. */
      searchInput.addEventListener("input", function () {
        searchTerm = searchInput.value.trim().toLowerCase();
        render();
      });
    }

    /* Initial paint: everything, with the "All" button active. */
    setCategory("all");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
