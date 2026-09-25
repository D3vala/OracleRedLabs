/* ==========================================================================
   js/board.js - index.html only
   The world's authored moment: the route sets itself, block by block, and
   the page wakes one band at a time along a single axis.

   Contract with css/dispatch.css:
     panel--armed on [data-panel]   -> route unlit, sequence drives .is-set
     .is-lit on .panel__chip        -> chip dot follows its block
     .is-woken on .band             -> band content rises, head rule draws
     .is-clear on .graph__row       -> lifecycle lamp ignites in sequence

   Safe failure: without this file the CSS default is the END state (route
   set, lamps lit, everything visible). prefers-reduced-motion never arms
   the panel - the finished sentence is shown at once.
   ========================================================================== */

(function () {
  "use strict";

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  /* ----------------------------------------------------------------------
     1. Route panel: sequential route setting + pointer readouts
     ---------------------------------------------------------------------- */
  function initPanel() {
    var panel = document.querySelector("[data-panel]");
    if (!panel) {
      return;
    }

    var blocks = panel.querySelectorAll(".blk");
    var chips = panel.querySelectorAll(".panel__chip");
    var status = panel.querySelector(".panel__status");
    var countEl = document.getElementById("route-count");
    var stateEl = document.getElementById("route-state");
    var total = blocks.length;
    var phaseText = "Route set"; /* what the readout returns to on blur */

    function setCount(n) {
      if (countEl) {
        countEl.textContent = pad2(n) + "/" + pad2(total);
      }
    }

    function setState(text, isSet) {
      if (stateEl) {
        stateEl.textContent = text;
      }
      if (status) {
        status.classList.toggle("is-set", !!isSet);
      }
    }

    /* Reduced motion / nothing to drive: the markup already prints the end
       state, so only the readout needs confirming. */
    if (reduceMotion || !total) {
      setCount(total);
      setState(phaseText, true);
      return;
    }

    panel.classList.add("panel--armed");
    setCount(0);
    phaseText = "Setting route";
    setState(phaseText, false);

    var i = 0;
    function step() {
      if (i >= total) {
        phaseText = "Route set";
        panel.classList.add("panel--done");
        setState(phaseText, true);
        return;
      }
      blocks[i].classList.add("is-set");
      var chip = panel.querySelector(
        '.panel__chip[data-block="' + (i + 1) + '"]'
      );
      if (chip) {
        chip.classList.add("is-lit");
      }
      i += 1;
      setCount(i);
      window.setTimeout(step, 320);
    }
    /* Let the typed line start first; the route begins half a second in. */
    window.setTimeout(step, 450);

    /* Pointing at a block puts its name on the readout. */
    Array.prototype.forEach.call(chips, function (chip) {
      function point() {
        var n = parseInt(chip.getAttribute("data-block"), 10) || 0;
        var blk = panel.querySelector('.blk[data-block="' + n + '"]');
        if (blk) {
          blk.classList.add("is-pointed");
        }
        setState(chip.getAttribute("data-status") || phaseText, false);
      }
      function unpoint() {
        var n = parseInt(chip.getAttribute("data-block"), 10) || 0;
        var blk = panel.querySelector('.blk[data-block="' + n + '"]');
        if (blk) {
          blk.classList.remove("is-pointed");
        }
        setState(phaseText, panel.classList.contains("panel--done"));
      }

      chip.addEventListener("mouseenter", point);
      chip.addEventListener("mouseleave", unpoint);
      chip.addEventListener("focus", point);
      chip.addEventListener("blur", unpoint);
    });
  }

  /* ----------------------------------------------------------------------
     2. Band wake: one observer, per-band stagger, graph lamps following
     ---------------------------------------------------------------------- */
  function initBands() {
    var bands = document.querySelectorAll(".band");
    if (!bands.length) {
      return;
    }

    function wake(band, instant) {
      /* Stagger the band's own children down a single axis. */
      var anims = band.querySelectorAll(".band-anim");
      Array.prototype.forEach.call(anims, function (node, index) {
        node.style.setProperty("--wake-delay", Math.min(index, 5) * 90 + "ms");
      });
      band.classList.add("is-woken");

      var rows = band.querySelectorAll(".graph__row");
      Array.prototype.forEach.call(rows, function (row, index) {
        if (instant) {
          row.classList.add("is-clear");
        } else {
          window.setTimeout(function () {
            row.classList.add("is-clear");
          }, 380 + index * 160);
        }
      });
    }

    if (reduceMotion || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(bands, function (band) {
        wake(band, true);
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        Array.prototype.forEach.call(entries, function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          observer.unobserve(entry.target);
          wake(entry.target, false);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    Array.prototype.forEach.call(bands, function (band) {
      observer.observe(band);
    });
  }

  function init() {
    initPanel();
    initBands();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
