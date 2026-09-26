(function () {
  "use strict";

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  }

  function initMobileNavigation() {
    var toggle = document.getElementById("nav-toggle");
    var nav = document.getElementById("primary-nav");
    if (!toggle || !nav) return;

    var label = toggle.querySelector(".visually-hidden");

    function syncState() {
      var open = toggle.getAttribute("aria-expanded") === "true";
      document.body.classList.toggle("menu-open", open);
      if (label) label.textContent = open ? "Close navigation" : "Open navigation";
    }

    toggle.addEventListener("click", function () {
      window.requestAnimationFrame(syncState);
    });

    Array.prototype.forEach.call(nav.querySelectorAll("a"), function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        syncState();
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        window.requestAnimationFrame(syncState);
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 768) syncState();
    });
  }

  function initOutcomesCarousel() {
    var carousel = document.querySelector("[data-outcomes-carousel]");
    if (!carousel) return;

    var section = carousel.closest(".outcomes");
    var track = carousel.querySelector("[data-carousel-track]");
    var slides = Array.prototype.slice.call(
      carousel.querySelectorAll("[data-carousel-slide]")
    );
    var previous = document.querySelector("[data-carousel-prev]");
    var next = document.querySelector("[data-carousel-next]");
    var status = document.querySelector("[data-carousel-status]");
    var index = 0;

    if (!section || !track || slides.length < 2 || !previous || !next) return;
    section.classList.add("is-enhanced");

    function render() {
      track.style.transform = "translate3d(" + index * -100 + "%, 0, 0)";
      slides.forEach(function (slide, slideIndex) {
        slide.setAttribute("aria-hidden", slideIndex === index ? "false" : "true");
      });
      if (status) status.textContent = index + 1 + " / " + slides.length;
    }

    function move(step) {
      index = (index + step + slides.length) % slides.length;
      render();
    }

    previous.addEventListener("click", function () {
      move(-1);
    });

    next.addEventListener("click", function () {
      move(1);
    });

    carousel.setAttribute("tabindex", "0");
    carousel.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      }
    });

    render();
  }

  function wrapScrubWords(node) {
    var words = node.textContent.trim().split(/\s+/);
    node.textContent = "";

    words.forEach(function (word, index) {
      var span = document.createElement("span");
      span.className = "scrub-word";
      span.textContent = word + (index === words.length - 1 ? "" : " ");
      node.appendChild(span);
    });

    return Array.prototype.slice.call(node.querySelectorAll(".scrub-word"));
  }

  function initHeroTopology(reduceMotion) {
    var canvas = document.querySelector("[data-hero-topology]");
    var hero = canvas && canvas.closest(".landing-hero");
    if (!canvas || !hero || !canvas.getContext) return;

    var context = canvas.getContext("2d");
    if (!context) return;

    var glows = Array.prototype.slice.call(
      hero.querySelectorAll("[data-hero-depth]")
    );
    var geometry = { nodes: [], edges: [], faults: [], debris: [], route: [] };
    var width = 0;
    var height = 0;
    var dpr = 1;
    var frame = 0;
    var visible = true;
    var startTime = performance.now();
    var lastTime = startTime;
    var lastDrawTime = 0;
    var introProgress = reduceMotion ? 1 : 0;
    var pointer = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      intensity: reduceMotion ? 0.18 : 0,
      targetIntensity: reduceMotion ? 0.18 : 0
    };
    var finePointer = !reduceMotion && window.matchMedia &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    var frameInterval = finePointer ? 0 : 1000 / 30;
    var cachedBounds = null;

    function clamp(value, minimum, maximum) {
      return Math.min(maximum, Math.max(minimum, value));
    }

    function seededRandom(seed) {
      var value = seed >>> 0;
      return function () {
        value += 0x6d2b79f5;
        var result = value;
        result = Math.imul(result ^ result >>> 15, result | 1);
        result ^= result + Math.imul(result ^ result >>> 7, result | 61);
        return ((result ^ result >>> 14) >>> 0) / 4294967296;
      };
    }

    function buildGeometry() {
      var random = seededRandom(315);
      var nodeCount = 38;
      var faultPositions = [0.075, 0.205, 0.34, 0.66, 0.795, 0.925];

      geometry.nodes = [];
      geometry.edges = [];
      geometry.faults = [];
      geometry.debris = [];

      for (var index = 0; index < nodeCount; index += 1) {
        var leftSide = index % 2 === 0;
        geometry.nodes.push({
          x: leftSide ? 0.02 + random() * 0.32 : 0.66 + random() * 0.32,
          y: 0.035 + random() * 0.93,
          depth: 0.28 + random() * 0.72,
          phase: random() * Math.PI * 2,
          size: 0.65 + random() * 1.25,
          side: leftSide ? -1 : 1
        });
      }

      geometry.nodes.forEach(function (node, nodeIndex) {
        var nearest = geometry.nodes
          .map(function (candidate, candidateIndex) {
            var xDistance = candidate.x - node.x;
            var yDistance = candidate.y - node.y;
            var sidePenalty = candidate.side === node.side ? 0 : 0.08;
            return {
              index: candidateIndex,
              distance: xDistance * xDistance + yDistance * yDistance + sidePenalty
            };
          })
          .filter(function (candidate) {
            return candidate.index !== nodeIndex;
          })
          .sort(function (a, b) {
            return a.distance - b.distance;
          })
          .slice(0, 2);

        nearest.forEach(function (candidate) {
          var first = Math.min(nodeIndex, candidate.index);
          var second = Math.max(nodeIndex, candidate.index);
          var duplicate = geometry.edges.some(function (edge) {
            return edge[0] === first && edge[1] === second;
          });
          if (!duplicate) geometry.edges.push([first, second]);
        });
      });

      faultPositions.forEach(function (position, faultIndex) {
        var points = [];
        var segments = 8 + Math.floor(random() * 3);
        for (var pointIndex = 0; pointIndex <= segments; pointIndex += 1) {
          var y = pointIndex / segments;
          points.push({
            x: position + (random() - 0.5) * 0.032,
            y: y,
            halfWidth: 0.004 + random() * 0.012,
            gap: pointIndex > 0 && pointIndex < segments && random() > 0.73
          });
        }
        geometry.faults.push({
          points: points,
          depth: 0.26 + random() * 0.7,
          phase: faultIndex * 0.83 + random(),
          alpha: 0.025 + random() * 0.045
        });
      });

      for (var debrisIndex = 0; debrisIndex < 56; debrisIndex += 1) {
        var debrisLeft = debrisIndex % 2 === 0;
        geometry.debris.push({
          x: debrisLeft ? random() * 0.39 : 0.61 + random() * 0.39,
          y: random(),
          length: 2 + random() * 9,
          speed: 0.35 + random() * 0.9,
          phase: random(),
          alpha: 0.025 + random() * 0.09,
          depth: 0.2 + random() * 0.8,
          warm: random() > 0.7
        });
      }

      geometry.route = [
        { x: 0.03, y: 0.83 },
        { x: 0.14, y: 0.68 },
        { x: 0.28, y: 0.76 },
        { x: 0.41, y: 0.67 },
        { x: 0.61, y: 0.73 },
        { x: 0.78, y: 0.64 },
        { x: 0.95, y: 0.79 }
      ];
    }

    function updateAtmosphere() {
      glows.forEach(function (glow) {
        var depth = Number(glow.getAttribute("data-hero-depth")) || 0.5;
        var x = pointer.x * depth * 24;
        var y = pointer.y * depth * 16;
        glow.style.transform = "translate3d(" + x.toFixed(2) + "px, " + y.toFixed(2) + "px, 0)";
      });
    }

    function bendPoint(point, depth, maxPush) {
      var x = point.x * width + pointer.x * depth * 14;
      var y = point.y * height + pointer.y * depth * 10;
      if (!pointer.intensity) return { x: x, y: y };

      var pointerX = width * (0.5 + pointer.x * 0.5);
      var pointerY = height * (0.5 + pointer.y * 0.5);
      var deltaX = x - pointerX;
      var deltaY = y - pointerY;
      var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 1;
      var radius = clamp(width * 0.18, 170, 290);

      if (distance < radius) {
        var force = Math.pow(1 - distance / radius, 2) * maxPush * pointer.intensity;
        x += deltaX / distance * force;
        y += deltaY / distance * force;
      }
      return { x: x, y: y };
    }

    function curveControl(a, b, edgeIndex) {
      var direction = edgeIndex % 2 === 0 ? 1 : -1;
      var distance = Math.abs(b.x - a.x);
      return {
        x: (a.x + b.x) * 0.5,
        y: (a.y + b.y) * 0.5 + direction * clamp(distance * 0.08, 7, 38)
      };
    }

    function traceCurve(a, b, control) {
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.quadraticCurveTo(control.x, control.y, b.x, b.y);
      context.stroke();
    }

    function routePoint(points, progress) {
      var scaled = clamp(progress, 0, 0.999999) * (points.length - 1);
      var index = Math.floor(scaled);
      var local = scaled - index;
      var a = points[index];
      var b = points[index + 1];
      return {
        x: a.x + (b.x - a.x) * local,
        y: a.y + (b.y - a.y) * local
      };
    }

    function drawFaults(now) {
      geometry.faults.forEach(function (fault) {
        var drift = reduceMotion ? 0 : Math.sin(now * 0.00018 + fault.phase) * 0.006;
        var start = 0;

        for (var index = 1; index < fault.points.length; index += 1) {
          var previous = fault.points[index - 1];
          var current = fault.points[index];
          if (current.gap) {
            start = index;
            continue;
          }

          var previousBase = { x: previous.x + drift, y: previous.y };
          var currentBase = { x: current.x + drift, y: current.y };
          var a = bendPoint(previousBase, fault.depth, 22);
          var b = bendPoint(currentBase, fault.depth, 22);
          var previousHalf = Math.max(2.5, previous.halfWidth * width);
          var currentHalf = Math.max(2.5, current.halfWidth * width);
          var alpha = fault.alpha * introProgress * (start ? 0.86 : 1);

          context.fillStyle = "rgba(117, 7, 35, " + alpha + ")";
          context.beginPath();
          context.moveTo(a.x - previousHalf, a.y);
          context.lineTo(a.x + previousHalf, a.y);
          context.lineTo(b.x + currentHalf, b.y);
          context.lineTo(b.x - currentHalf, b.y);
          context.closePath();
          context.fill();

          context.strokeStyle = "rgba(202, 31, 69, " + alpha * 1.8 + ")";
          context.lineWidth = 0.55;
          context.beginPath();
          context.moveTo(a.x + previousHalf, a.y);
          context.lineTo(b.x + currentHalf, b.y);
          context.stroke();
        }
      });
    }

    function drawConnections(now) {
      geometry.edges.forEach(function (edge, edgeIndex) {
        var first = geometry.nodes[edge[0]];
        var second = geometry.nodes[edge[1]];
        var a = bendPoint(first, first.depth, 24);
        var b = bendPoint(second, second.depth, 24);
        var control = curveControl(a, b, edgeIndex);
        var depth = (first.depth + second.depth) * 0.5;
        var shimmer = reduceMotion ? 0.82 : 0.68 + Math.sin(now * 0.001 + first.phase) * 0.14;

        context.strokeStyle = "rgba(174, 111, 126, " +
          (0.045 + depth * 0.048) * introProgress * shimmer + ")";
        context.lineWidth = 0.55 + depth * 0.34;
        traceCurve(a, b, control);
      });
    }

    function drawDebris(now) {
      geometry.debris.forEach(function (particle) {
        var travel = reduceMotion ? particle.phase :
          (particle.phase + now * 0.000018 * particle.speed) % 1;
        var base = {
          x: particle.x,
          y: travel
        };
        var point = bendPoint(base, particle.depth, 12);
        var alpha = particle.alpha * introProgress;

        context.strokeStyle = particle.warm ?
          "rgba(224, 211, 215, " + alpha * 0.72 + ")" :
          "rgba(227, 52, 86, " + alpha + ")";
        context.lineWidth = 0.55;
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(point.x, point.y + particle.length);
        context.stroke();
      });
    }

    function drawRoute(now) {
      var cycle = reduceMotion ? 0.72 : (now % 9200) / 9200;
      var tailStart = Math.max(0, cycle - 0.17);
      var points = geometry.route.map(function (point) {
        return bendPoint(point, 0.82, 24);
      });

      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "rgba(180, 19, 55, 0.15)";
      context.lineWidth = 0.75;
      context.beginPath();
      points.forEach(function (point, index) {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.stroke();

      var steps = 34;
      var routeAlpha = 0.58 + pointer.intensity * 0.3;
      context.strokeStyle = "rgba(242, 49, 87, " + routeAlpha + ")";
      context.shadowColor = "rgba(225, 27, 65, 0.52)";
      context.shadowBlur = 12 + pointer.intensity * 7;
      context.lineWidth = 1.35;
      context.beginPath();
      for (var step = 0; step <= steps; step += 1) {
        var progress = tailStart + (cycle - tailStart) * (step / steps);
        var routePosition = routePoint(points, progress);
        if (step === 0) context.moveTo(routePosition.x, routePosition.y);
        else context.lineTo(routePosition.x, routePosition.y);
      }
      context.stroke();

      var head = routePoint(points, cycle);
      context.fillStyle = "rgba(255, 74, 108, 0.94)";
      context.beginPath();
      context.arc(head.x, head.y, 2.2 + pointer.intensity * 0.8, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    function drawNodes(now) {
      geometry.nodes.forEach(function (node, index) {
        var reveal = reduceMotion ? 1 : clamp(introProgress * 1.55 - index * 0.018, 0, 1);
        if (!reveal) return;

        var point = bendPoint(node, node.depth, 24);
        var pulse = reduceMotion ? 0.58 : 0.48 + Math.sin(now * 0.0014 + node.phase) * 0.14;
        var radius = node.size * (0.78 + reveal * 0.22);
        context.fillStyle = "rgba(232, 219, 222, " + reveal * pulse + ")";
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fill();

        if (node.depth > 0.76) {
          context.strokeStyle = "rgba(226, 47, 84, " + reveal * 0.12 + ")";
          context.lineWidth = 0.65;
          context.beginPath();
          context.arc(point.x, point.y, radius + 4.8, 0, Math.PI * 2);
          context.stroke();
        }
      });
    }

    function draw(now) {
      if (!width || !height) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      drawFaults(now);
      drawConnections(now);
      drawDebris(now);
      drawRoute(now);
      drawNodes(now);
      updateAtmosphere();
    }

    function animate(now) {
      frame = 0;
      var delta = Math.min(48, now - lastTime);
      lastTime = now;

      if (!finePointer) {
        pointer.targetX = Math.sin(now * 0.00012) * 0.42;
        pointer.targetY = Math.cos(now * 0.00009) * 0.3;
        pointer.targetIntensity = 0.36;
      }

      var smoothing = 1 - Math.exp(-delta * 0.0065);
      pointer.x += (pointer.targetX - pointer.x) * smoothing;
      pointer.y += (pointer.targetY - pointer.y) * smoothing;
      pointer.intensity += (pointer.targetIntensity - pointer.intensity) * smoothing;
      introProgress = Math.max(introProgress, clamp((now - startTime) / 1900, 0, 1));

      if (!frameInterval || now - lastDrawTime >= frameInterval) {
        lastDrawTime = now;
        draw(now);
      }

      if (visible && !document.hidden) frame = window.requestAnimationFrame(animate);
    }

    function start() {
      if (reduceMotion || frame || !visible || document.hidden) return;
      lastTime = performance.now();
      frame = window.requestAnimationFrame(animate);
    }

    function stop() {
      if (!frame) return;
      window.cancelAnimationFrame(frame);
      frame = 0;
    }

    function resize() {
      var bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      cachedBounds = hero.getBoundingClientRect();
      buildGeometry();
      draw(performance.now());
      canvas.classList.add("is-ready");
    }

    if (finePointer) {
      hero.addEventListener("pointerenter", function () {
        pointer.targetIntensity = 1;
      });

      hero.addEventListener("pointermove", function (event) {
        if (!cachedBounds) return;
        pointer.targetX = clamp(
          (event.clientX - cachedBounds.left) / cachedBounds.width * 2 - 1,
          -1,
          1
        );
        pointer.targetY = clamp(
          (event.clientY - cachedBounds.top) / cachedBounds.height * 2 - 1,
          -1,
          1
        );
        pointer.targetIntensity = 1;
      });

      hero.addEventListener("pointerleave", function () {
        pointer.targetX = 0;
        pointer.targetY = 0;
        pointer.targetIntensity = 0;
      });
    }

    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(hero);
    } else {
      window.addEventListener("resize", resize);
    }

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start();
        else stop();
      }, { rootMargin: "12% 0px" }).observe(hero);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else start();
    });

    resize();
    if (!reduceMotion) start();
  }

  function initMotion(reduceMotion) {
    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;

    if (reduceMotion || !gsap || !ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    var heroItems = gsap.utils.toArray(".landing-hero [data-reveal]");
    gsap.from(heroItems, {
      y: 34,
      opacity: 0,
      duration: 1.15,
      stagger: 0.11,
      ease: "expo.out",
      clearProps: "transform,opacity"
    });

    var reveals = gsap.utils.toArray(
      "main > section:not(.landing-hero) [data-reveal]"
    );

    ScrollTrigger.batch(reveals, {
      start: "top 88%",
      once: true,
      onEnter: function (batch) {
        gsap.from(batch, {
          y: 46,
          opacity: 0,
          duration: 1,
          stagger: 0.08,
          ease: "expo.out",
          clearProps: "transform,opacity"
        });
      }
    });

    gsap.utils.toArray(".evidence-inline-media").forEach(function (media) {
      gsap.fromTo(
        media,
        { scale: 0.84, opacity: 0.28 },
        {
          scale: 1,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: media,
            start: "top 92%",
            end: "center 56%",
            scrub: 0.5
          }
        }
      );
    });

    gsap.utils.toArray("[data-scrub-copy]").forEach(function (paragraph) {
      var words = wrapScrubWords(paragraph);
      gsap.fromTo(
        words,
        { opacity: 0.14 },
        {
          opacity: 1,
          stagger: 0.055,
          ease: "none",
          scrollTrigger: {
            trigger: paragraph,
            start: "top 82%",
            end: "bottom 42%",
            scrub: 0.45
          }
        }
      );
    });

    ScrollTrigger.refresh();
  }

  ready(function () {
    var reduceMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    initMobileNavigation();
    initOutcomesCarousel();
    initHeroTopology(reduceMotion);
    initMotion(reduceMotion);
  });
})();
