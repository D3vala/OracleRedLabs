/* ==========================================================================
   js/engage-form.js
   Feature 2: the three-step engagement funnel on engage.html.

   Behaviour
     - "Next" only advances when every required control in the current step is
       valid; "Back" always works with no validation.
     - Errors are written inline next to the specific field (never alert()).
     - A "Step 2 of 3" indicator plus the visual stepper update on every move.
     - Step 2 checks the authorisation upload: present, .pdf, and <= 5 MB.
     - The requested start slot must be a date/time in the future.
     - The final submit sends the validated request and PDF to the API, then
       displays the server-issued reference number.

   DOM contract used by this script (see engage.html):
     #engage-form             the form, marked novalidate (we validate ourselves)
     [data-step-panel]        the three step panels, in order
     [data-step-marker]       the stepper <li> elements, in order
     [data-step-status]       the live "Step n of 3" text
     [data-field]             a control that participates in validation
     [data-error-for="<id>"]  the inline error paragraph for that control/group
     [data-radio-group]       a wrapper whose inputs are validated as one group
     [data-conditional-on]    wrapper revealed when a radio with that value is on
     #engage-confirmation     the success panel
     #engage-reference        where the committed server reference is written
     #engage-summary          the <dl> recapping what was submitted
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     Configuration
     --------------------------------------------------------------------- */
  var TOTAL_STEPS = 3;
  var MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB, per the brief
  var MAX_FILE_LABEL = "5 MB";

  /* ---------------------------------------------------------------------
     State
     --------------------------------------------------------------------- */
  var form = null;
  var panels = [];
  var markers = [];
  var stepStatus = null;
  var progress = null;
  var confirmation = null;
  var referenceNode = null;
  var summaryList = null;
  var currentStep = 1;

  /* ---------------------------------------------------------------------
     Tiny helpers
     --------------------------------------------------------------------- */
  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $all(selector, scope) {
    return Array.prototype.slice.call(
      (scope || document).querySelectorAll(selector)
    );
  }

  /** The inline error paragraph that belongs to a control (or radio group). */
  function errorNodeFor(id) {
    return $('[data-error-for="' + id + '"]');
  }

  /** Show an inline error for a control and flag it for assistive tech. */
  function showError(control, message) {
    control.setAttribute("aria-invalid", "true");
    var error = errorNodeFor(control.id);
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  function clearError(control) {
    control.setAttribute("aria-invalid", "false");
    var error = errorNodeFor(control.id);
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }
  }

  /** Local "YYYY-MM-DDTHH:MM" string for <input type="datetime-local">. */
  function toLocalInputValue(date) {
    function pad(value) {
      return value < 10 ? "0" + value : String(value);
    }
    return (
      date.getFullYear() +
      "-" + pad(date.getMonth() + 1) +
      "-" + pad(date.getDate()) +
      "T" + pad(date.getHours()) +
      ":" + pad(date.getMinutes())
    );
  }

  /* ---------------------------------------------------------------------
     Field rules
     Each rule returns an error message, or "" when the field is fine.
     Messages can be overridden per field with data-error-* attributes, so the
     wording can change without editing this file.
     --------------------------------------------------------------------- */
  function checkField(field) {
    /* --- File upload (step 2): present, PDF, under the size cap --- */
    if (field.type === "file") {
      if (!field.files || field.files.length === 0) {
        return (
          field.getAttribute("data-error-required") ||
          "Attach the signed authorisation document."
        );
      }

      var file = field.files[0];
      /* Browsers do not always fill in file.type, so the extension is checked
         as a fallback before rejecting the upload. */
      var looksLikePdf =
        file.type === "application/pdf" || /\.pdf$/i.test(file.name);

      if (!looksLikePdf) {
        return (
          field.getAttribute("data-error-type") ||
          "The authorisation document must be a PDF file."
        );
      }

      if (file.size > MAX_FILE_BYTES) {
        return (
          field.getAttribute("data-error-size") ||
          "That file is too large. The limit is " + MAX_FILE_LABEL + "."
        );
      }

      return "";
    }

    /* --- Checkbox (the authorisation acknowledgement) --- */
    if (field.type === "checkbox") {
      if (field.required && !field.checked) {
        return (
          field.getAttribute("data-error-required") ||
          "Please confirm this before continuing."
        );
      }
      return "";
    }

    /* --- Empty required text field / select --- */
    if (field.required && field.value.trim() === "") {
      return (
        field.getAttribute("data-error-required") || "This field is required."
      );
    }

    /* --- Requested start slot must be in the future --- */
    if (field.type === "datetime-local" && field.value !== "") {
      var slot = new Date(field.value);
      if (isNaN(slot.getTime())) {
        return "Enter a valid date and time.";
      }
      if (slot.getTime() <= Date.now()) {
        return (
          field.getAttribute("data-error-future") ||
          "Choose a start slot in the future."
        );
      }
    }

    /* --- Anything else the browser considers invalid (type, pattern, length) --- */
    if (field.value !== "" && !field.checkValidity()) {
      return (
        field.getAttribute("data-error-invalid") ||
        "Please check this value and try again."
      );
    }

    return "";
  }

  /* ---------------------------------------------------------------------
     Step validation
     --------------------------------------------------------------------- */

  /** A radio group is valid when at least one of its inputs is selected. */
  function validateRadioGroup(group) {
    var inputs = $all('input[type="radio"]', group);
    var groupId = group.id;
    var checked = inputs.some(function (input) {
      return input.checked;
    });
    var anchor = inputs[0] ? inputs[0] : group;
    var error = errorNodeFor(groupId);

    if (checked) {
      if (error) {
        error.hidden = true;
        error.textContent = "";
      }
      return null;
    }

    if (error) {
      error.textContent =
        group.getAttribute("data-error-required") ||
        "Choose one of the options above.";
      error.hidden = false;
    }
    return anchor; // the first radio is a sensible focus target
  }

  /**
   * Validate one step.
   * Returns true when the step may advance, false when it may not, and moves
   * focus to the first problem so keyboard users are not left guessing.
   */
  function validateStep(stepNumber) {
    var panel = panels[stepNumber - 1];
    if (!panel) {
      return true;
    }

    var firstInvalid = null;

    /* Plain controls (text, select, textarea, file, checkbox). */
    $all("[data-field]", panel).forEach(function (field) {
      if (field.type === "radio") {
        return; // radio groups are handled as a unit below
      }

      var message = checkField(field);
      if (message) {
        showError(field, message);
        if (!firstInvalid) {
          firstInvalid = field;
        }
      } else {
        clearError(field);
      }
    });

    /* Radio groups. */
    $all("[data-radio-group]", panel).forEach(function (group) {
      var invalidTarget = validateRadioGroup(group);
      if (invalidTarget && !firstInvalid) {
        firstInvalid = invalidTarget;
      }
    });

    if (firstInvalid) {
      firstInvalid.focus();
      return false;
    }
    return true;
  }

  /* ---------------------------------------------------------------------
     Step navigation
     --------------------------------------------------------------------- */
  function goToStep(stepNumber, moveFocus) {
    /* Clamp so the indicator can never show "Step 4 of 3". */
    currentStep = Math.min(Math.max(stepNumber, 1), TOTAL_STEPS);

    /* One panel visible at a time: the others get the hidden attribute, which
       removes them from the accessibility tree as well as the layout. */
    panels.forEach(function (panel, index) {
      panel.hidden = index + 1 !== currentStep;
    });

    markers.forEach(function (marker, index) {
      var step = index + 1;
      marker.classList.toggle("is-complete", step < currentStep);
      if (step === currentStep) {
        marker.setAttribute("aria-current", "step");
      } else {
        marker.removeAttribute("aria-current");
      }
    });

    if (stepStatus) {
      var marker = markers[currentStep - 1];
      var title = marker ? marker.getAttribute("data-step-title") : "";
      stepStatus.textContent =
        "Step " + currentStep + " of " + TOTAL_STEPS + (title ? ": " + title : "");
    }

    /* Move focus into the new panel so screen-reader and keyboard users land
       in the right place instead of at the top of the document. Skipped on the
       initial call so loading the page does not yank the viewport down. */
    var panel = panels[currentStep - 1];
    if (panel && moveFocus !== false) {
      panel.setAttribute("tabindex", "-1");
      panel.focus();
      panel.scrollIntoView({ block: "nearest" });
    }
  }

  /* ---------------------------------------------------------------------
     Conditional fields: a wrapper with data-conditional-on="po" is only
     shown (and only required) while the matching radio/checkbox is selected,
     so hidden inputs can never block the submit.
     --------------------------------------------------------------------- */
  function initConditionalFields() {
    var wrappers = $all("[data-conditional-on]", form);

    function refresh() {
      wrappers.forEach(function (wrapper) {
        var triggerValue = wrapper.getAttribute("data-conditional-on");
        var trigger = $(
          'input[type="radio"][value="' + triggerValue + '"], ' +
            'input[type="checkbox"][value="' + triggerValue + '"]',
          form
        );
        var isOn = !!trigger && trigger.checked;
        wrapper.hidden = !isOn;

        $all("[data-field]", wrapper).forEach(function (field) {
          if (isOn) {
            /* Restore the required flag remembered when it was hidden. */
            if (field.getAttribute("data-was-required") === "true") {
              field.required = true;
            }
          } else {
            if (field.required) {
              field.setAttribute("data-was-required", "true");
              field.required = false;
            }
            clearError(field);
          }
        });
      });
    }

    form.addEventListener("change", function (event) {
      if (event.target.type === "radio" || event.target.type === "checkbox") {
        refresh();
      }
    });

    refresh();
  }

  /* ---------------------------------------------------------------------
     Review summary and confirmation
     --------------------------------------------------------------------- */
  function createEl(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (typeof text === "string") {
      node.textContent = text;
    }
    return node;
  }

  /** Shorten long free-text answers for the summary panel. */
  function outline(text) {
    var clean = (text || "").trim().replace(/\s+/g, " ");
    return clean.length > 140 ? clean.slice(0, 137) + "..." : clean;
  }

  /** The label text of the checked payment option, falling back to its value. */
  function paymentMethodLabel() {
    var checked = $('input[name="payment-method"]:checked', form);
    if (!checked) {
      return "";
    }
    var label = checked.closest ? checked.closest("label") : checked.parentNode;
    return label ? outline(label.textContent) : checked.value;
  }

  /** Read the form into an array of [label, value] pairs. */
  function readSummary() {
    var serviceSelect = $("#service", form);
    var scope = $("#scope", form);
    var targets = $("#targets", form);
    var slot = $("#requested-slot", form);
    var authorisation = $("#authorization", form);
    var billing = $("#billing-email", form);
    var serviceText = "";

    if (serviceSelect && serviceSelect.selectedIndex >= 0) {
      serviceText = serviceSelect.options[serviceSelect.selectedIndex].text;
    }

    return [
      ["Service", serviceText],
      ["Scope outline", outline(scope ? scope.value : "")],
      ["Target list", outline(targets ? targets.value : "")],
      [
        "Requested start",
        slot && slot.value ? new Date(slot.value).toLocaleString() : "",
      ],
      [
        "Authorisation file",
        authorisation && authorisation.files[0]
          ? authorisation.files[0].name
          : "",
      ],
      ["Payment method", paymentMethodLabel()],
      ["Billing contact", billing ? billing.value : ""],
    ];
  }

  /** Paint the summary definition list. */
  function renderSummary() {
    if (!summaryList) {
      return;
    }
    summaryList.replaceChildren();
    readSummary().forEach(function (pair) {
      summaryList.appendChild(createEl("dt", null, pair[0]));
      summaryList.appendChild(createEl("dd", null, pair[1] || "-"));
    });
  }

  function showConfirmation(reference) {
    if (referenceNode) {
      referenceNode.textContent = reference;
    }
    renderSummary();

    if (progress) {
      progress.hidden = true;
    }
    form.hidden = true;

    if (confirmation) {
      confirmation.hidden = false;
      confirmation.setAttribute("tabindex", "-1");
      confirmation.focus();
      confirmation.scrollIntoView({ block: "nearest" });
    }
  }


  /* ---------------------------------------------------------------------
     Event wiring
     --------------------------------------------------------------------- */
  async function init() {
    form = document.getElementById("engage-form");
    if (!form) {
      return; // not the engage page
    }

    var user = window.ORLApi ? await window.ORLApi.guard("client") : null;
    if (window.ORLApi && !user) return;
    if (user && !user.active_organization.permissions.can_submit_engagements) {
      form.hidden = true;
      document.getElementById("engage-progress").hidden = true;
      document.getElementById("engage-access-denied").hidden = false;
      return;
    }

    panels = $all("[data-step-panel]", form);
    markers = $all("[data-step-marker]");
    stepStatus = $("[data-step-status]");
    progress = document.getElementById("engage-progress");
    confirmation = document.getElementById("engage-confirmation");
    referenceNode = document.getElementById("engage-reference");
    summaryList = document.getElementById("engage-summary");

    /* --- Next / Back --- */
    $all("[data-step-next]").forEach(function (button) {
      button.addEventListener("click", function () {
        /* Next is the only gate: validate before advancing. */
        if (validateStep(currentStep)) {
          goToStep(currentStep + 1);
        }
      });
    });

    $all("[data-step-back]").forEach(function (button) {
      button.addEventListener("click", function () {
        goToStep(currentStep - 1); // Back never validates
      });
    });

    /* --- Final submit --- */
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!validateStep(currentStep)) {
        return;
      }
      var submit = form.querySelector('button[type="submit"]');
      var status = $("[data-step-status]");
      if (submit) submit.disabled = true;
      if (status) status.textContent = "Submitting engagement request…";
      try {
        var payload = await window.ORLApi.request("/api/engagements", {
          method: "POST",
          body: new FormData(form),
        });
        showConfirmation(payload.data.reference_code);
      } catch (error) {
        window.ORLApi.applyFieldErrors(form, error.fields);
        if (status) status.textContent = error.message;
        var first = form.querySelector('[aria-invalid="true"]');
        if (first) first.focus();
      } finally {
        if (submit) submit.disabled = false;
      }
    });

    /* --- Live error clearing: once a field is fixed, drop the message --- */
    form.addEventListener("input", handleFieldChange);
    form.addEventListener("change", handleFieldChange);

    /* --- Start over from the confirmation panel --- */
    $all("[data-engage-restart]").forEach(function (button) {
      button.addEventListener("click", function () {
        form.reset();
        form.hidden = false;
        if (confirmation) {
          confirmation.hidden = true;
        }
        if (progress) {
          progress.hidden = false;
        }
        initConditionalFields();
        goToStep(1, false);
      });
    });

    /* --- Step 1: the earliest bookable slot is 24 hours from now --- */
    var slot = $("#requested-slot", form);
    if (slot) {
      var earliest = new Date(Date.now() + 24 * 60 * 60 * 1000);
      slot.min = toLocalInputValue(earliest);
    }

    initConditionalFields();
    goToStep(1, false); // no focus grab when the page first loads
  }

  /** Re-check a single control as the user types or changes a value. */
  function handleFieldChange(event) {
    var field = event.target;
    if (!field.hasAttribute || !field.hasAttribute("data-field")) {
      return;
    }

    if (field.type === "radio") {
      var group = field.closest ? field.closest("[data-radio-group]") : null;
      if (group) {
        validateRadioGroup(group);
      }
      return;
    }

    var message = checkField(field);
    if (message) {
      showError(field, message);
    } else {
      clearError(field);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

