/* ========================================================================== 
   interior.js - lightweight spatial behaviour for non-landing pages

   The script adds pointer-responsive depth to the page instrument, marks the
   detached header once the masthead leaves view, and numbers dynamic content
   after catalogue/filter renderers update it. Motion is transform/opacity
   only and is disabled when reduced motion is requested.
   ========================================================================== */

(function () {
  "use strict";

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function numberChildren(selector) {
    Array.prototype.forEach.call(
      document.querySelectorAll(selector),
      function (element, index) {
        element.setAttribute("data-index", String(index + 1).padStart(2, "0"));
      }
    );
  }

  function numberEditorialSurfaces() {
    numberChildren(".service-ledger > .card");
    numberChildren(".sector-atlas__grid > .card");
    numberChildren(".archive-grid > .card");
    numberChildren(".operations-summary .stat-grid > .card");
  }

  function initVisualDepth() {
    var visual = document.querySelector(".page-visual");
    if (!visual || reduceMotion) return;

    var frame = 0;
    var nextX = 0;
    var nextY = 0;

    function render() {
      visual.style.setProperty("--visual-x", nextX.toFixed(2) + "deg");
      visual.style.setProperty("--visual-y", nextY.toFixed(2) + "deg");
      frame = 0;
    }

    visual.addEventListener("pointermove", function (event) {
      var bounds = visual.getBoundingClientRect();
      nextY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 3.5;
      nextX = -((event.clientY - bounds.top) / bounds.height - 0.5) * 3.5;
      if (!frame) frame = window.requestAnimationFrame(render);
    });

    visual.addEventListener("pointerleave", function () {
      nextX = 0;
      nextY = 0;
      if (!frame) frame = window.requestAnimationFrame(render);
    });

    visual.classList.add("is-depth-ready");
  }

  function initHeaderState() {
    var header = document.querySelector(".interior-header");
    var masthead = document.querySelector(".page-head");
    if (!header || !masthead || !("IntersectionObserver" in window)) return;

    new IntersectionObserver(
      function (entries) {
        header.classList.toggle("is-condensed", !entries[0].isIntersecting);
      },
      { threshold: 0.08 }
    ).observe(masthead);
  }

  function initNavClose() {
    var nav = document.querySelector("#primary-nav");
    var toggle = document.querySelector("#nav-toggle");
    if (!nav || !toggle) return;

    nav.addEventListener("click", function (event) {
      if (!event.target.closest("a")) return;
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  }

  function init() {
    numberEditorialSurfaces();
    initVisualDepth();
    initHeaderState();
    initNavClose();

    if (!("MutationObserver" in window)) return;
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        numberEditorialSurfaces();
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
