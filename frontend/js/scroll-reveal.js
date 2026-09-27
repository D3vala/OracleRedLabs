/* ==========================================================================
   scroll-reveal.js - Staggered IntersectionObserver reveals for page content.
   Applies a restrained fade-up the first time an element enters the viewport,
   and staggers siblings so cards and supporting blocks arrive as a cascade.
   Unobserves after reveal so it never re-triggers on scroll-back.
   The matching CSS lives in css/components.css ([data-reveal="card"]).
   Respects prefers-reduced-motion and bails out where IntersectionObserver is
   missing, so no-JS / old-browser visitors always see the cards.
   ========================================================================== */

(function () {
  "use strict";

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function initScrollReveal() {
    // Reduced motion or no IntersectionObserver: leave the page exactly as it
    // is. Cards are only ever hidden once this script tags them.
    if (reduceMotion || !("IntersectionObserver" in window)) {
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var target = entry.target;
            target.classList.add("is-revealed");
            observer.unobserve(target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    // Group cards by their parent container so each grid cascades on its own,
    // then observe them. 90ms per sibling (capped at 6) keeps a long list from
    // holding its last card back for a second.
    function observeCards() {
      var cards = document.querySelectorAll(".card:not([data-reveal])");
      if (!cards.length) return;

      var parentMap = new Map();

      Array.prototype.forEach.call(cards, function (card) {
        card.setAttribute("data-reveal", "card");

        var parent = card.parentElement;
        if (!parentMap.has(parent)) {
          parentMap.set(parent, []);
        }
        parentMap.get(parent).push(card);
      });

      parentMap.forEach(function (siblingCards) {
        siblingCards.forEach(function (card, index) {
          card.style.setProperty("--reveal-delay", (index % 6) * 90 + "ms");
          observer.observe(card);
        });
      });
    }

    // Interior pages also reveal their editorial headings and large functional
    // surfaces. These selectors are deliberately structural: no content is
    // hidden until JavaScript has found and registered it with the observer.
    function observePageElements() {
      var selector = [
        ".page-head__code",
        ".page-head h1",
        ".page-head .lede",
        ".section__head",
        ".toolbar",
        ".table-wrap",
        ".cta-band",
        ".split > *",
        ".prose-grid > *",
        ".armory",
        ".stepper",
        ".interior-footer__cta",
      ].join(",");

      var elements = document.querySelectorAll(selector);
      Array.prototype.forEach.call(elements, function (element, index) {
        if (!element.hasAttribute("data-reveal")) {
          element.setAttribute("data-reveal", "element");
        }
        if (element.getAttribute("data-reveal-observed") === "true") return;
        element.setAttribute("data-reveal-observed", "true");
        element.style.setProperty("--reveal-delay", (index % 3) * 85 + "ms");
        observer.observe(element);
      });
    }

    // Initial pass covers everything in the served HTML; the rAF guard below
    // keeps a burst of late inserts (services catalogue, vault filter,
    // dashboard tiles) to a single sweep per frame.
    observeCards();
    observePageElements();

    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        observeCards();
        observePageElements();
      });
    }).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScrollReveal);
  } else {
    initScrollReveal();
  }
})();
