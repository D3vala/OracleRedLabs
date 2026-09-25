/*
 * bath.js - index-only progressive enhancement.
 *
 * Four behaviours, all optional: the pigment bath under the hero, comb
 * reveals for the bands, gentle drop repulsion in the service pool, and
 * THE LIFT at the close. Without this file (or with reduced motion) the
 * page is complete: content is visible, the summary is printed, the
 * canvas simply stays empty under the grid.
 */
(function () {
  "use strict";

  var doc = document;
  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     1. The pigment bath: floating status inks the pointer combs into
        rings. Canvas is aria-hidden decoration; content never waits on it.
     ------------------------------------------------------------------ */
  function initBath() {
    var canvas = doc.getElementById("bath-canvas");
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext("2d");
    var hero = canvas.parentNode;
    var inks = [
      { c: "217, 161, 59", a: 0.13 },  /* pending amber  */
      { c: "111, 143, 214", a: 0.13 }, /* scoping blue   */
      { c: "79, 180, 119", a: 0.12 },  /* active green   */
      { c: "194, 99, 79", a: 0.13 },   /* cancelled rust */
      { c: "209, 59, 59", a: 0.1 }     /* ops flare      */
    ];
    var blobs = [];
    var rings = [];
    var w = 0;
    var h = 0;
    var running = false;
    var raf = 0;
    var visible = true;
    var pointer = { x: -9999, y: -9999, lx: -9999, ly: -9999, travel: 0 };

    function resize() {
      var rect = hero.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!blobs.length) seed();
      if (reduceMotion) paint();
    }

    function seed() {
      var count = w < 600 ? 7 : 11;
      for (var i = 0; i < count; i++) {
        var ink = inks[i % inks.length];
        blobs.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 70 + Math.random() * 110,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          c: ink.c,
          a: ink.a,
          px: 0,
          py: 0
        });
      }
    }

    function paint() {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, "rgba(" + b.c + "," + b.a + ")");
        g.addColorStop(1, "rgba(" + b.c + ",0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (var j = 0; j < rings.length; j++) {
        var ring = rings[j];
        ctx.strokeStyle = "rgba(" + ring.c + "," + ring.a + ")";
        ctx.lineWidth = ring.w;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    function step() {
      if (!running) return;
      /* Blobs drift home; pointer force decays back into the drift. */
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        b.px += (0 - b.px) * 0.06;
        b.py += (0 - b.py) * 0.06;
        b.x += b.vx + b.px;
        b.y += b.vy + b.py;
        if (b.x < -b.r) b.x = w + b.r;
        if (b.x > w + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = h + b.r;
        if (b.y > h + b.r) b.y = -b.r;
      }
      /* Rings push colour outward, then fade - every drop makes a ring. */
      for (var j = rings.length - 1; j >= 0; j--) {
        var ring = rings[j];
        ring.r += ring.vr;
        ring.a -= 0.006;
        ring.vr *= 0.985;
        if (ring.a <= 0.01) rings.splice(j, 1);
      }
      paint();
      raf = window.requestAnimationFrame(step);
    }

    function onPointer(ev) {
      var rect = hero.getBoundingClientRect();
      pointer.x = ev.clientX - rect.left;
      pointer.y = ev.clientY - rect.top;
      if (pointer.lx > -9998) {
        var dx = pointer.x - pointer.lx;
        var dy = pointer.y - pointer.ly;
        pointer.travel += Math.sqrt(dx * dx + dy * dy);
      }
      pointer.lx = pointer.x;
      pointer.ly = pointer.y;

      /* Displacement: nearby pigment is combed away from the pointer. */
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var ox = b.x - pointer.x;
        var oy = b.y - pointer.y;
        var d = Math.sqrt(ox * ox + oy * oy) || 1;
        if (d < 190) {
          var force = (1 - d / 190) * 1.6;
          b.px += (ox / d) * force;
          b.py += (oy / d) * force;
        }
      }

      /* Travel far enough and a new ring drops where the finger was. */
      if (pointer.travel > 110) {
        pointer.travel = 0;
        if (rings.length < 14) {
          rings.push({
            x: pointer.x,
            y: pointer.y,
            r: 10,
            vr: 2.6,
            a: 0.5,
            w: 1.5,
            c: inks[(rings.length + 1) % inks.length].c
          });
        }
      }
    }

    function setRunning(on) {
      if (reduceMotion) return;
      if (on && !running) {
        running = true;
        raf = window.requestAnimationFrame(step);
      } else if (!on && running) {
        running = false;
        window.cancelAnimationFrame(raf);
      }
    }

    resize();
    window.addEventListener("resize", resize);

    if (reduceMotion) return; /* one static painted frame, no loop */

    doc.addEventListener("visibilitychange", function () {
      setRunning(!doc.hidden && visible);
    });
    hero.addEventListener("pointermove", onPointer, { passive: true });
    hero.addEventListener(
      "pointerleave",
      function () {
        pointer.x = pointer.y = -9999;
        pointer.lx = pointer.ly = -9999;
      },
      { passive: true }
    );

    if (window.IntersectionObserver) {
      new window.IntersectionObserver(
        function (entries) {
          visible = entries[0].isIntersecting;
          setRunning(visible && !doc.hidden);
        },
        { threshold: 0 }
      ).observe(hero);
    }
    setRunning(true);
  }

  /* ------------------------------------------------------------------
     2. Comb reveals: bands comb into view once, with staggered teeth.
        Elements are visible until this arms them, so no-JS never hides.
     ------------------------------------------------------------------ */
  function initComb() {
    if (reduceMotion || !window.IntersectionObserver) return;
    var bands = doc.querySelectorAll("[data-band]");
    Array.prototype.forEach.call(bands, function (band) {
      var items = band.querySelectorAll(".band-anim");
      Array.prototype.forEach.call(items, function (item, i) {
        item.style.setProperty("--comb-delay", Math.min(i, 5) * 70 + "ms");
      });
      band.className += " comb-armed";
    });
    var io = new window.IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.className += " is-combed";
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );
    Array.prototype.forEach.call(bands, function (band) {
      io.observe(band);
    });
  }

  /* ------------------------------------------------------------------
     3. Bath pool: service drops yield to the pointer like pigment,
        settling back when it leaves. Keyboard focus simply settles them.
     ------------------------------------------------------------------ */
  function initPool() {
    if (reduceMotion) return;
    var pool = doc.querySelector(".bath-pool");
    if (!pool) return;
    var pending = null;

    function settle() {
      pending = null;
      Array.prototype.forEach.call(pool.children, function (card) {
        card.style.setProperty("--dx", "0px");
        card.style.setProperty("--dy", "0px");
      });
    }

    pool.addEventListener(
      "pointermove",
      function (ev) {
        if (pending !== null) return;
        pending = window.requestAnimationFrame(function () {
          pending = null;
          Array.prototype.forEach.call(pool.children, function (card) {
            var rect = card.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            var dx = cx - ev.clientX;
            var dy = cy - ev.clientY;
            var d = Math.sqrt(dx * dx + dy * dy) || 1;
            var reach = Math.max(rect.width, 220);
            if (d < reach) {
              var push = (1 - d / reach) * 14;
              card.style.setProperty("--dx", (dx / d) * push + "px");
              card.style.setProperty("--dy", (dy / d) * push + "px");
            } else {
              card.style.setProperty("--dx", "0px");
              card.style.setProperty("--dy", "0px");
            }
          });
        });
      },
      { passive: true }
    );
    pool.addEventListener("pointerleave", settle, { passive: true });
    pool.addEventListener("focusin", settle, { passive: true });
  }

  /* ------------------------------------------------------------------
     4. THE LIFT: one pull prints the closing summary, then the
        composition is spent - one pass, like the bath it came from.
     ------------------------------------------------------------------ */
  function initLift() {
    var lift = doc.querySelector("[data-lift]");
    if (!lift) return;
    var summary = lift.querySelector("[data-lift-summary]");
    var handle = lift.querySelector("[data-lift-handle]");
    if (!summary || !handle) return;

    lift.className += " lift--armed";

    handle.addEventListener("click", function () {
      if (lift.className.indexOf("is-printing") !== -1) return;
      lift.className += " is-printing";
      summary.removeAttribute("aria-hidden");
      handle.setAttribute("aria-expanded", "true");
      var label = handle.querySelector("[data-lift-label]");
      window.setTimeout(
        function () {
          handle.disabled = true;
          if (label) label.textContent = "Printed - one pass only";
        },
        reduceMotion ? 0 : 720
      );
    });
  }

  /* Boot: each module is isolated so one failure never costs the page. */
  function boot() {
    [initBath, initComb, initPool, initLift].forEach(function (fn) {
      try {
        fn();
      } catch (err) {
        /* The page is complete without its enhancement. */
      }
    });
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

