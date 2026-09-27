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
    var geometry = {
      nodes: [],
      edges: [],
      faults: [],
      debris: [],
      seamFragments: [],
      seamSpikes: [],
      routeNetwork: { points: [], backbone: [], paths: [], junctions: [] }
    };
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
      var nodeCount = 44;
      var seamRatio = width < 640 ? 0.58 : 0.55;
      var faultPositions = [
        0.045, 0.115, 0.19, 0.28, 0.365,
        0.635, 0.72, 0.81, 0.885, 0.955
      ];

      geometry.nodes = [];
      geometry.edges = [];
      geometry.faults = [];
      geometry.debris = [];
      geometry.seamFragments = [];
      geometry.seamSpikes = [];

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
          origin: position,
          points: points,
          depth: 0.26 + random() * 0.7,
          phase: faultIndex * 0.83 + random(),
          alpha: 0.055 + random() * 0.075,
          strands: Array.apply(null, Array(2 + Math.floor(random() * 3))).map(function () {
            return {
              offset: (random() - 0.5) * 0.026,
              alpha: 0.45 + random() * 0.4,
              width: 0.45 + random() * 0.7
            };
          }),
          ticks: Array.apply(null, Array(7 + Math.floor(random() * 6))).map(function () {
            return {
              offset: (random() - 0.5) * 0.04,
              y: 0.02 + random() * 0.94,
              length: 0.006 + random() * 0.034,
              alpha: 0.32 + random() * 0.58,
              width: 0.45 + random() * 0.85
            };
          })
        });
      });

      for (var debrisIndex = 0; debrisIndex < 80; debrisIndex += 1) {
        var debrisLeft = debrisIndex % 2 === 0;
        geometry.debris.push({
          x: debrisLeft ? random() * 0.39 : 0.61 + random() * 0.39,
          y: random(),
          length: 2 + random() * 9,
          speed: 0.35 + random() * 0.9,
          phase: random(),
          alpha: 0.04 + random() * 0.12,
          depth: 0.2 + random() * 0.8,
          warm: random() > 0.7
        });
      }

      for (var fragmentIndex = 0; fragmentIndex < 68; fragmentIndex += 1) {
        var fragmentX = random();
        geometry.seamFragments.push({
          x: fragmentX,
          length: 0.004 + random() * 0.026,
          offset: (random() - 0.5) * 0.012,
          alpha: 0.15 + random() * 0.55,
          phase: random() * Math.PI * 2
        });
      }

      for (var spikeIndex = 0; spikeIndex < 52; spikeIndex += 1) {
        var spikeX = random();
        geometry.seamSpikes.push({
          x: spikeX,
          length: 4 + random() * 28,
          alpha: 0.08 + random() * 0.34,
          direction: random() > 0.5 ? 1 : -1,
          phase: random() * Math.PI * 2
        });
      }

      var networkPoints = [
        { x: 0.015, y: seamRatio }, { x: 0.14, y: seamRatio + 0.002 },
        { x: 0.275, y: seamRatio - 0.003 }, { x: 0.395, y: seamRatio + 0.003 },
        { x: 0.5, y: seamRatio }, { x: 0.605, y: seamRatio - 0.003 },
        { x: 0.725, y: seamRatio + 0.004 }, { x: 0.86, y: seamRatio - 0.002 },
        { x: 0.985, y: seamRatio }, { x: 0.045, y: 0.08 },
        { x: 0.18, y: 0.22 }, { x: 0.04, y: 0.93 },
        { x: 0.19, y: 0.81 }, { x: 0.955, y: 0.1 },
        { x: 0.82, y: 0.21 }, { x: 0.96, y: 0.92 },
        { x: 0.81, y: 0.83 }
      ];

      geometry.routeNetwork = {
        points: networkPoints,
        backbone: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        paths: [
          { points: [9, 10, 2, 3, 4], phase: 0 },
          { points: [11, 12, 2, 3, 4], phase: 0.045 },
          { points: [13, 14, 6, 5, 4], phase: 0.085 },
          { points: [15, 16, 6, 5, 4], phase: 0.125 }
        ],
        junctions: [2, 3, 4, 5, 6]
      };
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

          context.strokeStyle = "rgba(202, 31, 69, " + alpha * 1.5 + ")";
          context.lineWidth = 0.55;
          context.beginPath();
          context.moveTo(a.x + previousHalf, a.y);
          context.lineTo(b.x + currentHalf, b.y);
          context.stroke();

          fault.strands.forEach(function (strand) {
            var strandA = bendPoint({
              x: previousBase.x + strand.offset,
              y: previousBase.y
            }, fault.depth, 18);
            var strandB = bendPoint({
              x: currentBase.x + strand.offset,
              y: currentBase.y
            }, fault.depth, 18);

            context.strokeStyle = "rgba(238, 39, 76, " +
              alpha * strand.alpha + ")";
            context.lineWidth = strand.width;
            context.beginPath();
            context.moveTo(strandA.x, strandA.y);
            context.lineTo(strandB.x, strandB.y);
            context.stroke();
          });
        }

        fault.ticks.forEach(function (tick) {
          var tickBase = {
            x: fault.origin + drift + tick.offset,
            y: tick.y
          };
          var tickEnd = {
            x: tickBase.x,
            y: Math.min(1, tick.y + tick.length)
          };
          var tickA = bendPoint(tickBase, fault.depth, 17);
          var tickB = bendPoint(tickEnd, fault.depth, 17);
          var tickAlpha = fault.alpha * tick.alpha * introProgress * 2.35;

          context.strokeStyle = "rgba(250, 48, 82, " + tickAlpha + ")";
          context.lineWidth = tick.width;
          context.beginPath();
          context.moveTo(tickA.x, tickA.y);
          context.lineTo(tickB.x, tickB.y);
          context.stroke();
        });
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

    function smoothStep(value) {
      var amount = clamp(value, 0, 1);
      return amount * amount * (3 - 2 * amount);
    }

    function surgeState(now) {
      if (reduceMotion) return { intensity: 0.62, wave: 0.66 };

      var cycle = (now % 8200) / 8200;
      if (cycle < 0.54) return { intensity: 0.08, wave: 0 };

      var active = (cycle - 0.54) / 0.46;
      var intensity;
      if (active < 0.18) intensity = smoothStep(active / 0.18);
      else if (active < 0.46) intensity = 1;
      else intensity = 1 - smoothStep((active - 0.46) / 0.54) * 0.92;

      return {
        intensity: intensity,
        wave: smoothStep(clamp(active * 1.08, 0, 1))
      };
    }

    function edgeEnergy(x) {
      var distance = Math.abs(x - 0.5) * 2;
      return 0.16 + Math.pow(distance, 1.55) * 0.84;
    }

    function drawFirewallSeam(now, surge) {
      var seamY = height * (width < 640 ? 0.58 : 0.55) + pointer.y * 3.5;
      var gradient = context.createLinearGradient(0, seamY, width, seamY);
      gradient.addColorStop(0, "rgba(255, 86, 110, 0.88)");
      gradient.addColorStop(0.22, "rgba(238, 41, 75, 0.58)");
      gradient.addColorStop(0.39, "rgba(205, 23, 58, 0.16)");
      gradient.addColorStop(0.5, "rgba(192, 17, 52, 0.1)");
      gradient.addColorStop(0.61, "rgba(205, 23, 58, 0.16)");
      gradient.addColorStop(0.78, "rgba(238, 41, 75, 0.58)");
      gradient.addColorStop(1, "rgba(255, 86, 110, 0.88)");

      context.save();
      context.lineCap = "round";
      context.strokeStyle = gradient;
      context.shadowColor = "rgba(236, 26, 64, " +
        (0.22 + surge.intensity * 0.2) + ")";
      context.shadowBlur = 20 + surge.intensity * 12;
      context.lineWidth = 7 + surge.intensity * 3;
      context.globalAlpha = 0.2 + surge.intensity * 0.11;
      context.beginPath();
      context.moveTo(0, seamY);
      context.lineTo(width, seamY);
      context.stroke();

      context.lineWidth = 0.8 + surge.intensity * 0.55;
      context.globalAlpha = 0.82;
      context.shadowBlur = 8 + surge.intensity * 7;
      context.beginPath();
      context.moveTo(0, seamY);
      context.lineTo(width, seamY);
      context.stroke();

      geometry.seamFragments.forEach(function (fragment) {
        var x = fragment.x * width;
        var oscillation = reduceMotion ? 0 :
          Math.sin(now * 0.0018 + fragment.phase) * 1.35;
        var y = seamY + fragment.offset * height + oscillation;
        var alpha = fragment.alpha * edgeEnergy(fragment.x) *
          (0.46 + surge.intensity * 0.54);

        context.strokeStyle = "rgba(255, 68, 98, " + alpha + ")";
        context.lineWidth = 0.5 + surge.intensity * 0.55;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(Math.min(width, x + fragment.length * width), y);
        context.stroke();
      });

      geometry.seamSpikes.forEach(function (spike) {
        var x = spike.x * width;
        var flicker = reduceMotion ? 0.74 :
          0.54 + Math.sin(now * 0.0022 + spike.phase) * 0.2;
        var spikeAlpha = spike.alpha * edgeEnergy(spike.x) * flicker *
          (0.58 + surge.intensity * 0.42);

        context.strokeStyle = "rgba(245, 47, 82, " + spikeAlpha + ")";
        context.lineWidth = 0.55;
        context.beginPath();
        context.moveTo(x, seamY);
        context.lineTo(x, seamY + spike.length * spike.direction);
        context.stroke();
      });

      if (pointer.intensity > 0.01) {
        var pointerX = width * (0.5 + pointer.x * 0.5);
        var bloomWidth = clamp(width * 0.16, 120, 260);
        var bloom = context.createLinearGradient(
          pointerX - bloomWidth,
          seamY,
          pointerX + bloomWidth,
          seamY
        );
        bloom.addColorStop(0, "rgba(255, 52, 86, 0)");
        bloom.addColorStop(0.5, "rgba(255, 116, 135, " +
          (0.32 * pointer.intensity) + ")");
        bloom.addColorStop(1, "rgba(255, 52, 86, 0)");
        context.strokeStyle = bloom;
        context.shadowColor = "rgba(255, 45, 78, 0.5)";
        context.shadowBlur = 16;
        context.lineWidth = 1.4;
        context.beginPath();
        context.moveTo(pointerX - bloomWidth, seamY);
        context.lineTo(pointerX + bloomWidth, seamY);
        context.stroke();
      }
      context.restore();
    }

    function drawPolyline(points) {
      context.beginPath();
      points.forEach(function (point, index) {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.stroke();
    }

    function drawPathSlice(points, start, end) {
      var steps = 26;
      context.beginPath();
      for (var step = 0; step <= steps; step += 1) {
        var progress = start + (end - start) * (step / steps);
        var position = routePoint(points, progress);
        if (step === 0) context.moveTo(position.x, position.y);
        else context.lineTo(position.x, position.y);
      }
      context.stroke();
    }

    function drawRouteNetwork(now, surge) {
      var network = geometry.routeNetwork;
      var transformed = network.points.map(function (point) {
        return bendPoint(point, 0.84, 25);
      });
      var backbone = network.backbone.map(function (index) {
        return transformed[index];
      });
      var paths = network.paths.map(function (path) {
        return {
          points: path.points.map(function (index) {
            return transformed[index];
          }),
          phase: path.phase
        };
      });
      var allPaths = [backbone].concat(paths.map(function (path) {
        return path.points;
      }));

      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "rgba(190, 25, 58, 0.19)";
      context.lineWidth = 0.78;
      allPaths.forEach(drawPolyline);

      context.strokeStyle = "rgba(246, 48, 81, " +
        (0.1 + surge.intensity * 0.28 + pointer.intensity * 0.08) + ")";
      context.shadowColor = "rgba(232, 24, 61, 0.48)";
      context.shadowBlur = 8 + surge.intensity * 12 + pointer.intensity * 4;
      context.lineWidth = 1 + surge.intensity * 0.65;
      allPaths.forEach(drawPolyline);

      paths.forEach(function (path) {
        var wave = clamp(surge.wave - path.phase, 0, 1);
        if (!wave) return;
        var tail = Math.max(0, wave - 0.22);
        context.strokeStyle = "rgba(255, 92, 116, " +
          (0.32 + surge.intensity * 0.54) + ")";
        context.lineWidth = 1.35 + surge.intensity * 0.8;
        context.shadowBlur = 15 + surge.intensity * 11;
        drawPathSlice(path.points, tail, wave);
      });

      var leftBackbone = backbone.slice(0, 5);
      var rightBackbone = backbone.slice(4).reverse();
      var backboneWave = clamp(surge.wave - 0.1, 0, 1);
      if (backboneWave) {
        var backboneTail = Math.max(0, backboneWave - 0.24);
        context.strokeStyle = "rgba(255, 104, 126, " +
          (0.34 + surge.intensity * 0.5) + ")";
        context.lineWidth = 1.45 + surge.intensity * 0.9;
        context.shadowBlur = 17 + surge.intensity * 12;
        drawPathSlice(leftBackbone, backboneTail, backboneWave);
        drawPathSlice(rightBackbone, backboneTail, backboneWave);
      }

      network.junctions.forEach(function (index) {
        var point = transformed[index];
        var radius = 1.35 + surge.intensity * 1.65;
        context.fillStyle = "rgba(255, 112, 132, " +
          (0.28 + surge.intensity * 0.5) + ")";
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fill();
      });
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
      var surge = surgeState(now);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      drawFaults(now);
      drawConnections(now);
      drawDebris(now);
      drawFirewallSeam(now, surge);
      drawRouteNetwork(now, surge);
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

    gsap.utils.toArray(".service-card").forEach(function (card, index) {
      var image = card.querySelector(".service-visual img");
      if (!image) return;

      var direction = index === 1 ? 1 : -1;
      gsap.fromTo(
        image,
        {
          xPercent: direction * 7,
          yPercent: 8,
          scale: 0.94,
          opacity: 0.2
        },
        {
          xPercent: direction * -3,
          yPercent: -4,
          scale: 1.035,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: card,
            start: "top 92%",
            end: "bottom 34%",
            scrub: 0.75
          }
        }
      );
    });

    var evidenceRoute = document.querySelector("[data-evidence-route]");
    if (evidenceRoute) {
      gsap.fromTo(
        evidenceRoute,
        { xPercent: -5, scale: 0.94, opacity: 0.18 },
        {
          xPercent: 3,
          scale: 1.025,
          opacity: 0.68,
          ease: "none",
          scrollTrigger: {
            trigger: ".evidence__stage",
            start: "top 86%",
            end: "bottom 28%",
            scrub: 0.85
          }
        }
      );
    }

    gsap.utils.toArray(".method-visual img").forEach(function (image) {
      gsap.fromTo(
        image,
        { yPercent: 9, scale: 0.94, opacity: 0.32 },
        {
          yPercent: -7,
          scale: 1.045,
          opacity: 0.94,
          ease: "none",
          scrollTrigger: {
            trigger: ".method",
            start: "top 88%",
            end: "bottom 30%",
            scrub: 0.8
          }
        }
      );
    });

    gsap.utils.toArray(".outcome-slide__visual img").forEach(function (image) {
      gsap.fromTo(
        image,
        { xPercent: -6, yPercent: 7, scale: 0.94, opacity: 0.26 },
        {
          xPercent: 4,
          yPercent: -5,
          scale: 1.04,
          opacity: 0.9,
          ease: "none",
          scrollTrigger: {
            trigger: ".outcomes",
            start: "top 88%",
            end: "bottom 34%",
            scrub: 0.8
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
