/* ==========================================================================
   js/typewriter.js
   Feature 1: terminal typewriter effect for the home-page hero tagline.

   How it works
     - index.html puts the full tagline in a visually hidden span (so screen
       readers get the real sentence immediately) and an empty aria-hidden
       span for the animation.
     - This script types one character at a time with setInterval and leaves
       the blinking cursor running afterwards (the blink is CSS, see
       .typewriter-cursor in css/base.css).
     - .hero__tagline reserves two lines of height in CSS, so typing cannot
       push the rest of the page around.

   No libraries, no build step.
   ========================================================================== */

(function () {
  "use strict";

  /* Milliseconds between characters. The brief asks for roughly 40-60ms. */
  var SPEED_MS = 45;

  function init() {
    var heading = document.querySelector("[data-typewriter-text]");
    var output = document.getElementById("hero-typed");

    /* This script only runs on index.html; bail out quietly anywhere else. */
    if (!heading || !output) {
      return;
    }

    var text = heading.getAttribute("data-typewriter-text") || "";

    /* Respect prefers-reduced-motion: show the finished sentence at once. */
    var prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      output.textContent = text;
      return;
    }

    var position = 0;

    var timer = window.setInterval(function () {
      position += 1;
      /* slice() is safe even if position overshoots the string length. */
      output.textContent = text.slice(0, position);

      if (position >= text.length) {
        window.clearInterval(timer); // stop the interval once fully typed
      }
    }, SPEED_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
