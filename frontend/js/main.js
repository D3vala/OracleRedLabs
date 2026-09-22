/* ==========================================================================
   js/main.js
   Shared front-end behaviour for every page of the Oracle Red Labs site.

   What lives here:
     1. tiny helpers + date/price formatters (reused by the page renderers)
     2. mobile navigation toggle
     3. active nav-link marker (keeps the header markup identical everywhere)
     4. footer copyright year
     5. demo form handling for the pages that have no back end yet
     6. password confirmation check (register.html)
     7. "Copy Key" button (contact.html)
     8. accessible tabs (admin.html)
     9. data-driven card renderers for the mock "services" data set

   Load order matters: this file is loaded by the shared footer before any
   page-specific script, because vault-filter.js uses ORL.formatISODate().
   Everything is plain ES5-ish JavaScript so it runs in any modern browser
   with no build step and no framework.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     1. Helpers
     ---------------------------------------------------------------------- */

  /** Shorthand for querySelector, with an optional scope element. */
  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  /** Shorthand for querySelectorAll that returns a real array. */
  function $all(selector, scope) {
    return Array.prototype.slice.call(
      (scope || document).querySelectorAll(selector)
    );
  }

  /** 15000 -> "$15,000 USD". Whole dollars only: this is display copy. */
  function formatPriceUSD(value) {
    var amount = Number(value);
    if (isNaN(amount)) {
      return String(value);
    }
    return (
      "$" +
      amount.toLocaleString("en-US", { maximumFractionDigits: 0 }) +
      " USD"
    );
  }

  /** "2026-03-01" -> "Mar 1, 2026" without timezone surprises. */
  function formatISODate(isoString) {
    var date = new Date(isoString + "T00:00:00");
    if (isNaN(date.getTime())) {
      return isoString;
    }
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  /** Create an element with a class and (optionally) text content. */
  function el(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (typeof text === "string") {
      node.textContent = text; // textContent, never innerHTML: no injection
    }
    return node;
  }

  /** Run a function once the DOM is available. */
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  /* ------------------------------------------------------------------------
     2. Mobile navigation toggle
     The button only exists below 768px (it is hidden by CSS above that).
     ---------------------------------------------------------------------- */
  function initNavToggle() {
    var toggle = $("#nav-toggle");
    var nav = $("#primary-nav");
    if (!toggle || !nav) {
      return;
    }

    function setOpen(isOpen) {
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      nav.classList.toggle("is-open", isOpen);
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    /* Escape closes the menu and returns focus to the button, so keyboard
       users are never stranded inside a hidden region. */
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });

    /* If the viewport grows past the breakpoint, drop the open state so the
       desktop nav is not left with a stale class. */
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 768) {
        setOpen(false);
      }
    });
  }

  /* ------------------------------------------------------------------------
     3. Active nav-link marker
     The shared header is byte-for-byte identical in every HTML file, so the
     "you are here" state is applied here instead of via aria-current in the
     markup. Every anchor inside the primary nav is considered (including the
     Register button); pages that have no nav entry - index, dashboard,
     admin - simply get no marker.
     ---------------------------------------------------------------------- */
  function setActiveNavLink() {
    var current = window.location.pathname.split("/").pop() || "index.html";
    $all("#primary-nav a[href]").forEach(function (link) {
      var target = link.getAttribute("href");
      if (target === current) {
        link.setAttribute("aria-current", "page");
      }
    });
  }

  /* ------------------------------------------------------------------------
     4. Footer year
     ---------------------------------------------------------------------- */
  function setFooterYear() {
    var year = String(new Date().getFullYear());
    $all("[data-current-year]").forEach(function (node) {
      node.textContent = year;
    });
  }

  /* ------------------------------------------------------------------------
     5. Demo form handling (contact, register, login)
     There is no server yet, so a valid submit is intercepted, a confirmation
     message is shown in place, and the form is reset. In Milestone 7 this
     function is replaced by a real fetch() POST - the markup does not change.
     ---------------------------------------------------------------------- */
  function initDemoForms() {
    $all("[data-demo-form]").forEach(function (form) {
      var status = $("[data-form-status]", form) ||
        $("[data-form-status]", form.parentNode);

      form.addEventListener("submit", function (event) {
        event.preventDefault();

        /* Native constraint validation already covers required/type/pattern.
           If something is invalid, let the browser highlight the first field
           and stop here - no generic alert() anywhere on this site. */
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        if (status) {
          var successText = form.getAttribute("data-success-message");
          status.textContent = successText ||
            "Received. This is a front-end demo, so nothing was transmitted yet.";
          status.classList.add("form-message--success");
          status.hidden = false;
          status.focus(); // move screen readers to the confirmation
        }

        form.reset();
      });
    });
  }

  /* ------------------------------------------------------------------------
     6. Password confirmation (register.html)
     Compares the two password fields and reports a mismatch inline instead of
     relying on a browser bubble.
     ---------------------------------------------------------------------- */
  function initPasswordConfirmation() {
    $all("[data-password-form]").forEach(function (form) {
      var password = $("[data-password]", form);
      var confirmation = $("[data-password-confirm]", form);
      var error = $("[data-password-error]", form);
      if (!password || !confirmation || !error) {
        return;
      }

      function validate() {
        var matches = password.value === confirmation.value;

        /* setCustomValidity plugs into native validation, so a mismatch also
           blocks submission; the inline message explains it in plain words. */
        confirmation.setCustomValidity(matches ? "" : "Passwords do not match.");
        confirmation.setAttribute("aria-invalid", matches ? "false" : "true");
        error.hidden = matches || confirmation.value === "";
        if (!error.hidden) {
          error.textContent = "Passwords do not match.";
        }
        return matches;
      }

      password.addEventListener("input", validate);
      confirmation.addEventListener("input", validate);
    });
  }

  /* ------------------------------------------------------------------------
     7. Copy-to-clipboard buttons (the PGP key block on contact.html)
     Uses the async Clipboard API when available and falls back to selecting
     the text so a manual copy still works (older browsers or file:// URLs).
     ---------------------------------------------------------------------- */
  function initCopyButtons() {
    $all("[data-copy-target]").forEach(function (button) {
      button.addEventListener("click", function () {
        var target = $(button.getAttribute("data-copy-target"));
        if (!target) {
          return;
        }

        var text = target.textContent;
        var status = button.parentNode
          ? $("[data-copy-status]", button.parentNode)
          : null;

        /* Small feedback loop so the user sees the copy worked. */
        function report(message) {
          button.textContent = message;
          if (status) {
            status.textContent = message;
          }
          window.setTimeout(function () {
            button.textContent = button.getAttribute("data-label") || "Copy Key";
          }, 2500);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            function () {
              report("Copied");
            },
            function () {
              report("Press Ctrl+C");
            }
          );
        } else {
          var range = document.createRange();
          range.selectNodeContents(target);
          var selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          report("Press Ctrl+C");
        }
      });
    });
  }


  /* ------------------------------------------------------------------------
     8. Accessible tabs (admin.html)
     Follows the WAI-ARIA tabs pattern: arrow keys move between tabs, Home and
     End jump to the ends, and only the selected panel is visible.
     ---------------------------------------------------------------------- */
  function initTabs() {
    $all("[data-tabs]").forEach(function (root) {
      var tabs = $all('[role="tab"]', root);
      if (!tabs.length) {
        return;
      }

      function select(index, moveFocus) {
        tabs.forEach(function (tab, i) {
          var isSelected = i === index;
          var panel = document.getElementById(tab.getAttribute("aria-controls"));

          tab.setAttribute("aria-selected", isSelected ? "true" : "false");
          /* Roving tabindex: only the active tab is in the tab order. */
          tab.tabIndex = isSelected ? 0 : -1;
          if (panel) {
            panel.hidden = !isSelected;
          }
        });
        if (moveFocus) {
          tabs[index].focus();
        }
      }

      tabs.forEach(function (tab, index) {
        tab.addEventListener("click", function () {
          select(index, false);
        });

        tab.addEventListener("keydown", function (event) {
          var last = tabs.length - 1;
          if (event.key === "ArrowRight") {
            select(index === last ? 0 : index + 1, true);
          } else if (event.key === "ArrowLeft") {
            select(index === 0 ? last : index - 1, true);
          } else if (event.key === "Home") {
            select(0, true);
          } else if (event.key === "End") {
            select(last, true);
          } else {
            return; // any other key keeps its normal behaviour
          }
          event.preventDefault();
        });
      });

      select(0, false);
    });
  }

  /* ------------------------------------------------------------------------
     9. Service cards rendered from js/data/services.js
     services.html renders the full card (price, delivery method, expandable
     description); index.html renders the compact teaser variant. Rendering
     from the data array is what makes the Milestone 7 swap to
     fetch("/api/services") a one-line change.
     ---------------------------------------------------------------------- */

  /** Append a label/value pair to a .card__meta definition list. */
  function appendMeta(metaList, label, value) {
    metaList.appendChild(el("dt", null, label));
    metaList.appendChild(el("dd", null, value));
  }

  /** Build one service card. `variant` is "full" or "teaser". */
  function buildServiceCard(service, variant) {
    var card = el("article", "card card--interactive");
    card.id = service.slug; // gives services.html a stable #anchor target

    var heading = el("h3");
    if (variant === "teaser") {
      var titleLink = el("a", "card__link", service.name);
      titleLink.href = "services.html#" + service.slug;
      heading.appendChild(titleLink);
    } else {
      heading.textContent = service.name;
    }

    card.appendChild(el("span", "badge badge--tag", service.category));
    card.appendChild(heading);
    card.appendChild(el("p", "text-muted", service.short_description));

    if (variant === "teaser") {
      card.appendChild(el("p", "footnote", "Full scope and pricing on the services page."));
      return card;
    }

    /* Full card: price, delivery method, expandable long description, CTA. */
    card.appendChild(el("p", "card__price", formatPriceUSD(service.base_price)));

    var meta = el("dl", "card__meta");
    appendMeta(meta, "Delivery", service.delivery_method);
    card.appendChild(meta);

    /* <details> gives us the expand/collapse with no JavaScript and no page
       reload, and it stays keyboard accessible for free. */
    var details = el("details", "details");
    details.appendChild(el("summary", "details__summary", "Learn more"));
    details.appendChild(el("p", "details__body", service.long_description));
    card.appendChild(details);

    var cta = el("a", "btn btn--secondary btn--sm", "Request this service");
    cta.href = "engage.html?service=" + encodeURIComponent(service.slug);
    card.appendChild(cta);

    return card;
  }

  function initServiceCards() {
    /* typeof guard: pages that do not load js/data/services.js simply skip. */
    if (typeof services === "undefined") {
      return;
    }

    $all("[data-services-grid]").forEach(function (container) {
      var variant = container.getAttribute("data-services-grid") || "full";
      /* Re-render from data instead of toggling pre-built markup. */
      container.replaceChildren();
      services.forEach(function (service) {
        container.appendChild(buildServiceCard(service, variant));
      });
    });

    /* Engage form: build the service <select> from the same data set so the
       two pages can never drift apart. */
    $all("[data-services-select]").forEach(function (select) {
      services.forEach(function (service) {
        var option = document.createElement("option");
        option.value = service.slug;
        option.textContent =
          service.name + " - " + formatPriceUSD(service.base_price);
        select.appendChild(option);
      });
    });
  }

  /* ------------------------------------------------------------------------
     Boot
     ---------------------------------------------------------------------- */
  function init() {
    initNavToggle();
    setActiveNavLink();
    setFooterYear();
    initDemoForms();
    initPasswordConfirmation();
    initCopyButtons();
    initTabs();
    initServiceCards();
  }

  /* Small shared API so the page-specific scripts (vault-filter.js) can reuse
     the same helpers instead of duplicating them. */
  window.ORL = {
    $: $,
    $all: $all,
    el: el,
    formatPriceUSD: formatPriceUSD,
    formatISODate: formatISODate,
  };

  ready(init);
})();
