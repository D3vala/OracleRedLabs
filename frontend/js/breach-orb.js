/* Progressive enhancement for the landing-page attack-surface visualization. */
(function () {
  "use strict";

  var canvas = document.querySelector("[data-breach-orb]");
  var hero = document.querySelector("[data-breach-hero]");
  if (!canvas || !hero || !canvas.getContext) return;

  var context = canvas.getContext("2d");
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var particles = [];
  var routes = [];
  var frame = 0;
  var inView = true;
  var pointerX = 0;
  var pointerY = 0;
  var currentX = 0;
  var currentY = 0;
  var startedAt = performance.now();
  var width = 0;
  var height = 0;
  var dpr = 1;

  function random(index) {
    var value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function createScene() {
    particles = [];
    routes = [];

    var count = Math.max(240, Math.min(620, Math.round(width * 0.46)));
    for (var index = 0; index < count; index += 1) {
      var y = 1 - (index / Math.max(1, count - 1)) * 2;
      var radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      var theta = Math.PI * (3 - Math.sqrt(5)) * index;
      particles.push({
        x: Math.cos(theta) * radiusAtY,
        y: y,
        z: Math.sin(theta) * radiusAtY,
        size: 0.55 + random(index) * 1.15,
        phase: random(index + 900) * Math.PI * 2
      });
    }

    routes = [
      { a: 0.13, b: 0.54, bend: -0.18, phase: 0.1 },
      { a: 0.28, b: 0.77, bend: 0.21, phase: 0.54 },
      { a: 0.42, b: 0.89, bend: -0.09, phase: 0.81 }
    ];
  }

  function resize() {
    var box = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.max(1, Math.round(box.width));
    height = Math.max(1, Math.round(box.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    createScene();
    draw(performance.now());
  }

  function project(particle, rotation, radius) {
    var cos = Math.cos(rotation);
    var sin = Math.sin(rotation);
    var x = particle.x * cos - particle.z * sin;
    var z = particle.x * sin + particle.z * cos;
    return {
      x: width * 0.5 + x * radius + currentX,
      y: height * 0.51 + particle.y * radius + currentY,
      z: z
    };
  }

  function drawRoute(route, radius, time) {
    var startAngle = route.a * Math.PI * 2;
    var endAngle = route.b * Math.PI * 2;
    var startX = width * 0.5 + Math.cos(startAngle) * radius * 0.82 + currentX;
    var startY = height * 0.51 + Math.sin(startAngle) * radius * 0.52 + currentY;
    var endX = width * 0.5 + Math.cos(endAngle) * radius * 0.82 + currentX;
    var endY = height * 0.51 + Math.sin(endAngle) * radius * 0.52 + currentY;
    var controlX = (startX + endX) * 0.5 + route.bend * radius;
    var controlY = (startY + endY) * 0.5 - route.bend * radius * 0.65;

    context.beginPath();
    context.moveTo(startX, startY);
    context.quadraticCurveTo(controlX, controlY, endX, endY);
    context.strokeStyle = "rgba(255, 70, 70, 0.34)";
    context.lineWidth = 0.8;
    context.stroke();

    var travel = (time * 0.00011 + route.phase) % 1;
    var inverse = 1 - travel;
    var pulseX = inverse * inverse * startX + 2 * inverse * travel * controlX + travel * travel * endX;
    var pulseY = inverse * inverse * startY + 2 * inverse * travel * controlY + travel * travel * endY;
    context.beginPath();
    context.arc(pulseX, pulseY, 2.3, 0, Math.PI * 2);
    context.fillStyle = "rgba(255, 238, 232, 0.92)";
    context.shadowColor = "rgba(255, 45, 45, 0.95)";
    context.shadowBlur = 11;
    context.fill();
    context.shadowBlur = 0;
  }

  function draw(time) {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);

    currentX += (pointerX - currentX) * 0.045;
    currentY += (pointerY - currentY) * 0.045;
    var elapsed = Math.max(0, time - startedAt);
    var assembly = reduceMotion ? 1 : Math.min(1, elapsed / 1400);
    var eased = 1 - Math.pow(1 - assembly, 4);
    var radius = Math.min(width, height) * 0.425;
    var rotation = reduceMotion ? 0.18 : elapsed * 0.000035;

    particles.forEach(function (particle, index) {
      var point = project(particle, rotation, radius);
      var scatter = (1 - eased) * Math.max(width, height) * 0.34;
      var sx = point.x + (random(index + 1300) - 0.5) * scatter;
      var sy = point.y + (random(index + 2600) - 0.5) * scatter;
      var front = (point.z + 1) * 0.5;
      var flicker = reduceMotion ? 1 : 0.84 + Math.sin(time * 0.0016 + particle.phase) * 0.16;
      var alpha = (0.08 + front * 0.38) * eased * flicker;
      context.beginPath();
      context.arc(sx, sy, particle.size * (0.75 + front * 0.7), 0, Math.PI * 2);
      context.fillStyle = "rgba(255, 62, 62," + alpha.toFixed(3) + ")";
      context.fill();
    });

    routes.forEach(function (route) {
      drawRoute(route, radius, time);
    });
  }

  function tick(time) {
    draw(time);
    if (inView && !document.hidden && !reduceMotion) {
      frame = window.requestAnimationFrame(tick);
    }
  }

  hero.addEventListener("pointermove", function (event) {
    if (reduceMotion) return;
    var box = hero.getBoundingClientRect();
    pointerX = ((event.clientX - box.left) / box.width - 0.5) * 13;
    pointerY = ((event.clientY - box.top) / box.height - 0.5) * 9;
  });

  hero.addEventListener("pointerleave", function () {
    pointerX = 0;
    pointerY = 0;
  });

  document.addEventListener("visibilitychange", function () {
    window.cancelAnimationFrame(frame);
    if (!document.hidden && inView && !reduceMotion) {
      frame = window.requestAnimationFrame(tick);
    }
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      window.cancelAnimationFrame(frame);
      if (inView && !document.hidden && !reduceMotion) {
        frame = window.requestAnimationFrame(tick);
      }
    }, { threshold: 0.01 }).observe(hero);
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();
  if (!reduceMotion) frame = window.requestAnimationFrame(tick);
})();
