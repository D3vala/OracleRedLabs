/* Landing page interactions. Content remains readable when JS or motion is off. */
(function () {
  "use strict";

  function initProofCarousel() {
    var carousel = document.querySelector("[data-proof-carousel]");
    if (!carousel) return;

    var slides = Array.prototype.slice.call(carousel.querySelectorAll("[data-proof-slide]"));
    var controls = carousel.querySelector(".landing-proof__controls");
    var count = carousel.querySelector("[data-proof-count]");
    var previous = carousel.querySelector("[data-proof-prev]");
    var next = carousel.querySelector("[data-proof-next]");
    if (slides.length < 2 || !controls || !previous || !next) return;

    var active = 0;
    function show(index) {
      active = (index + slides.length) % slides.length;
      slides.forEach(function (slide, slideIndex) {
        slide.hidden = slideIndex !== active;
      });
      if (count) count.textContent = active + 1 + " / " + slides.length;
    }

    controls.hidden = false;
    previous.addEventListener("click", function () { show(active - 1); });
    next.addEventListener("click", function () { show(active + 1); });
    show(0);
  }

  function initMotion() {
    if (!window.gsap || !window.ScrollTrigger) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    gsap.registerPlugin(ScrollTrigger);

    var visual = document.querySelector(".landing-hero__visual img");
    if (visual) {
      gsap.fromTo(visual, { y: 34, opacity: 0.45 }, {
        y: 0, opacity: 1, duration: 1.25, ease: "power2.out", delay: 0.15
      });
    }

    var statement = document.querySelector("[data-scrub-text]");
    if (statement) {
      var copy = statement.textContent.trim();
      var visualWords = document.createElement("span");
      visualWords.setAttribute("aria-hidden", "true");
      statement.textContent = "";
      statement.setAttribute("aria-label", copy);

      copy.split(/(\s+)/).forEach(function (part) {
        if (/^\s+$/.test(part)) {
          visualWords.appendChild(document.createTextNode(part));
        } else if (part) {
          var word = document.createElement("span");
          word.setAttribute("data-scrub-word", "");
          word.textContent = part;
          visualWords.appendChild(word);
        }
      });
      statement.appendChild(visualWords);

      gsap.fromTo(statement.querySelectorAll("[data-scrub-word]"),
        { opacity: 0.18 },
        {
          opacity: 1,
          stagger: 0.1,
          ease: "none",
          scrollTrigger: {
            trigger: statement,
            start: "top 78%",
            end: "bottom 32%",
            scrub: 0.6
          }
        }
      );
    }

    var media = gsap.matchMedia();
    media.add("(min-width: 981px)", function () {
      var steps = Array.prototype.slice.call(
        document.querySelectorAll(".landing-process__step")
      );
      if (!steps.length) return;

      steps.forEach(function (step, index) {
        step.style.setProperty("--stack-index", String(index));
        if (index === steps.length - 1) return;

        gsap.to(step, {
          scale: 0.94,
          opacity: 0.42,
          ease: "none",
          scrollTrigger: {
            trigger: steps[index + 1],
            start: "top 78%",
            end: "top 24%",
            scrub: 0.55
          }
        });
      });
    });
  }

  function init() {
    initProofCarousel();
    initMotion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
