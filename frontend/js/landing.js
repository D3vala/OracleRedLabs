/* Landing-page enhancement. Core content remains readable without motion. */
(function () {
  "use strict";

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function arrowIcon() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("class", "landing-arrow");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", "0 0 20 20");
    path.setAttribute("d", "M3 10h13M11 5l5 5-5 5");
    svg.appendChild(path);
    return svg;
  }

  function initServiceAccordion() {
    var accordion = document.querySelector("[data-service-accordion]");
    if (!accordion) return;

    if (typeof services === "undefined" || !Array.isArray(services)) {
      var fallback = el("a", "landing-text-link", "Explore the service catalogue ");
      fallback.href = "services.html";
      fallback.appendChild(arrowIcon());
      accordion.appendChild(fallback);
      return;
    }

    function activate(selected) {
      accordion.querySelectorAll(".landing-service-panel").forEach(function (panel) {
        var active = panel === selected;
        var content = panel.querySelector(".landing-service-panel__content");
        var contentLink = content.querySelector("a");
        panel.classList.toggle("is-active", active);
        panel.querySelector("button").setAttribute("aria-expanded", String(active));
        content.setAttribute("aria-hidden", String(!active));
        contentLink.tabIndex = active ? 0 : -1;
      });
    }

    services.slice(0, 3).forEach(function (service, index) {
      var panel = el("article", "landing-service-panel");
      var trigger = el("button", "landing-service-panel__trigger");
      var category = el("span", "landing-service-panel__category", service.category);
      var name = el("h3", "landing-service-panel__name", service.name);
      var content = el("div", "landing-service-panel__content");
      var description = el("p", "", service.short_description);
      var delivery = el("small", "landing-service-panel__meta", service.delivery_method);
      var link = el("a", "landing-service-panel__link", "Explore service ");

      if (index === 0) panel.classList.add("is-active");
      trigger.type = "button";
      trigger.id = "service-trigger-" + service.slug;
      trigger.setAttribute("aria-controls", "service-content-" + service.slug);
      trigger.setAttribute("aria-expanded", index === 0 ? "true" : "false");
      trigger.appendChild(category);
      trigger.appendChild(name);

      link.href = "services.html#" + service.slug;
      link.appendChild(arrowIcon());
      link.tabIndex = index === 0 ? 0 : -1;
      content.id = "service-content-" + service.slug;
      content.setAttribute("role", "region");
      content.setAttribute("aria-labelledby", trigger.id);
      content.setAttribute("aria-hidden", index === 0 ? "false" : "true");
      content.appendChild(description);
      content.appendChild(delivery);
      content.appendChild(link);
      panel.appendChild(trigger);
      panel.appendChild(content);
      accordion.appendChild(panel);

      ["pointerenter", "focusin"].forEach(function (eventName) {
        panel.addEventListener(eventName, function () { activate(panel); });
      });
      trigger.addEventListener("click", function () { activate(panel); });
    });
  }

  function initMotion() {
    if (!window.gsap || !window.ScrollTrigger) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    gsap.registerPlugin(ScrollTrigger);

    var media = gsap.matchMedia();
    media.add("(min-width: 981px)", function () {
      var process = document.querySelector(".landing-process");
      var intro = document.querySelector("[data-process-intro]");
      var steps = Array.prototype.slice.call(document.querySelectorAll("[data-process-step]"));
      if (!process || !intro || !steps.length) return;

      intro.style.position = "relative";
      var pin = ScrollTrigger.create({
        trigger: process,
        start: "top top+=96",
        end: "bottom bottom-=64",
        pin: intro,
        pinSpacing: false
      });

      steps.forEach(function (step, index) {
        step.style.setProperty("--stack-index", String(index));
        if (index === steps.length - 1) return;

        gsap.to(step, {
          scale: 0.945,
          opacity: 0.46,
          ease: "none",
          scrollTrigger: {
            trigger: steps[index + 1],
            start: "top 78%",
            end: "top 26%",
            scrub: 0.55
          }
        });
      });

      return function () {
        pin.kill();
        intro.style.position = "";
      };
    });
  }

  function init() {
    initServiceAccordion();
    initMotion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
