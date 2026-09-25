/* ==========================================================================
   hero-network.js - Generates & mounts the self-contained animated
   SVG "network sphere" for Oracle Red Labs hero.
   Plain JS, dependency-free, offline-ready.
   ========================================================================== */

(function () {
  "use strict";

  function initHeroNetwork() {
    var container = document.getElementById("hero-network-canvas");
    if (!container) return;

    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 600 600");
    svg.setAttribute("class", "hero-network__svg");
    svg.setAttribute("aria-hidden", "true");

    // Definitions (filters for glow)
    var defs = document.createElementNS(svgNS, "defs");

    // Radial gradient for ambient mesh backglow
    var radGrad = document.createElementNS(svgNS, "radialGradient");
    radGrad.setAttribute("id", "sphere-ambient");
    radGrad.setAttribute("cx", "50%");
    radGrad.setAttribute("cy", "50%");
    radGrad.setAttribute("r", "50%");

    var stop1 = document.createElementNS(svgNS, "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", "var(--color-accent-soft)");
    stop1.setAttribute("stop-opacity", "0.6");
    radGrad.appendChild(stop1);

    var stop2 = document.createElementNS(svgNS, "stop");
    stop2.setAttribute("offset", "100%");
    stop2.setAttribute("stop-color", "transparent");
    radGrad.appendChild(stop2);
    defs.appendChild(radGrad);

    // Glow filter for core
    var filter = document.createElementNS(svgNS, "filter");
    filter.setAttribute("id", "core-glow-filter");
    filter.setAttribute("x", "-50%");
    filter.setAttribute("y", "-50%");
    filter.setAttribute("width", "200%");
    filter.setAttribute("height", "200%");

    var feBlur = document.createElementNS(svgNS, "feGaussianBlur");
    feBlur.setAttribute("stdDeviation", "8");
    feBlur.setAttribute("result", "coloredBlur");
    filter.appendChild(feBlur);

    var feMerge = document.createElementNS(svgNS, "feMerge");
    var feMergeNode1 = document.createElementNS(svgNS, "feMergeNode");
    feMergeNode1.setAttribute("in", "coloredBlur");
    var feMergeNode2 = document.createElementNS(svgNS, "feMergeNode");
    feMergeNode2.setAttribute("in", "SourceGraphic");
    feMerge.appendChild(feMergeNode1);
    feMerge.appendChild(feMergeNode2);
    filter.appendChild(feMerge);

    defs.appendChild(filter);
    svg.appendChild(defs);

    // Ambient backdrop circle
    var bgCircle = document.createElementNS(svgNS, "circle");
    bgCircle.setAttribute("cx", "300");
    bgCircle.setAttribute("cy", "300");
    bgCircle.setAttribute("r", "250");
    bgCircle.setAttribute("fill", "url(#sphere-ambient)");
    svg.appendChild(bgCircle);

    // Node Cluster Group (rotates)
    var clusterG = document.createElementNS(svgNS, "g");
    clusterG.setAttribute("class", "hero-network__cluster");

    // 22 nodes in pseudo-spherical 3D space projected to 2D
    // z-depth from -1 to 1: 1 = near/front/center, -1 = far/edge
    var rawNodes = [
      { x: 300, y: 300, z: 1.0, isCore: true },
      { x: 345, y: 240, z: 0.8 },
      { x: 250, y: 260, z: 0.75 },
      { x: 270, y: 355, z: 0.85 },
      { x: 360, y: 340, z: 0.7 },
      { x: 395, y: 285, z: 0.55 },
      { x: 215, y: 315, z: 0.6 },
      { x: 295, y: 195, z: 0.5 },
      { x: 315, y: 410, z: 0.45 },
      { x: 410, y: 200, z: 0.3 },
      { x: 190, y: 220, z: 0.35 },
      { x: 175, y: 380, z: 0.25 },
      { x: 390, y: 405, z: 0.3 },
      { x: 450, y: 320, z: 0.2 },
      { x: 155, y: 295, z: 0.15 },
      { x: 235, y: 155, z: 0.2 },
      { x: 355, y: 150, z: 0.1 },
      { x: 440, y: 410, z: -0.1 },
      { x: 160, y: 440, z: -0.15 },
      { x: 240, y: 455, z: -0.2 },
      { x: 475, y: 250, z: -0.25 },
      { x: 125, y: 240, z: -0.3 }
    ];

    // The table above spans roughly 350 of the 600 viewBox units, so on its own
    // the mesh sits small inside the hero's right zone. Scaling the coordinates
    // about the centre widens it to fill that zone; the connections, the packet
    // routes and the core all read from this same array, so everything stays
    // aligned no matter how the scale is tuned later.
    var SPHERE_SCALE = 1.25;
    rawNodes.forEach(function (node) {
      node.x = 300 + (node.x - 300) * SPHERE_SCALE;
      node.y = 300 + (node.y - 300) * SPHERE_SCALE;
    });

    var connections = [
      { from: 0, to: 1, active: true },
      { from: 0, to: 2, active: true },
      { from: 0, to: 3, active: true },
      { from: 0, to: 4, active: false },
      { from: 1, to: 2, active: false },
      { from: 2, to: 3, active: false },
      { from: 3, to: 4, active: false },
      /* These six lit links are exactly the three packet routes below:
         5-1-0, 6-2-0 and 8-3-0, every chain ending on the core. */
      { from: 4, to: 5, active: false },
      { from: 1, to: 5, active: true },
      { from: 2, to: 6, active: true },
      { from: 3, to: 6, active: false },
      { from: 1, to: 7, active: false },
      { from: 2, to: 7, active: false },
      { from: 3, to: 8, active: true },
      { from: 4, to: 8, active: false },
      { from: 5, to: 9, active: false },
      { from: 7, to: 9, active: false },
      { from: 7, to: 10, active: false },
      { from: 6, to: 10, active: false },
      { from: 6, to: 11, active: false },
      { from: 8, to: 11, active: false },
      { from: 8, to: 12, active: false },
      { from: 5, to: 13, active: false },
      { from: 12, to: 13, active: false },
      { from: 6, to: 14, active: false },
      { from: 10, to: 14, active: false },
      { from: 11, to: 14, active: false },
      { from: 7, to: 15, active: false },
      { from: 10, to: 15, active: false },
      { from: 7, to: 16, active: false },
      { from: 9, to: 16, active: false },
      { from: 12, to: 17, active: false },
      { from: 13, to: 17, active: false },
      { from: 11, to: 18, active: false },
      { from: 14, to: 18, active: false },
      { from: 8, to: 19, active: false },
      { from: 12, to: 19, active: false },
      { from: 9, to: 20, active: false },
      { from: 13, to: 20, active: false },
      { from: 10, to: 21, active: false },
      { from: 14, to: 21, active: false }
    ];

    var linesGroup = document.createElementNS(svgNS, "g");
    linesGroup.setAttribute("class", "hero-network__lines");

    connections.forEach(function (c) {
      var n1 = rawNodes[c.from];
      var n2 = rawNodes[c.to];
      var line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", n1.x);
      line.setAttribute("y1", n1.y);
      line.setAttribute("x2", n2.x);
      line.setAttribute("y2", n2.y);
      line.setAttribute("stroke-linecap", "round");

      var avgZ = (n1.z + n2.z) / 2;
      var opacity = Math.max(0.12, (avgZ + 0.4) * 0.45);
      var strokeWidth = Math.max(0.8, (avgZ + 0.5) * 1.5);

      if (c.active) {
        line.setAttribute("stroke", "var(--color-accent-line)");
        line.setAttribute("stroke-width", String(strokeWidth + 0.5));
        line.setAttribute("stroke-opacity", String(Math.min(0.9, opacity + 0.35)));
        // The dash pulse in hero.css is what makes these read as live links.
        line.setAttribute("class", "hero-network__line-active");
      } else {
        line.setAttribute("stroke", "var(--color-border-strong)");
        line.setAttribute("stroke-width", String(strokeWidth));
        line.setAttribute("stroke-opacity", String(opacity));
      }

      linesGroup.appendChild(line);
    });
    clusterG.appendChild(linesGroup);

    // Nodes Group
    var nodesGroup = document.createElementNS(svgNS, "g");
    nodesGroup.setAttribute("class", "hero-network__nodes");

    rawNodes.forEach(function (node) {
      if (node.isCore) {
        // Core node outer halo
        var halo = document.createElementNS(svgNS, "circle");
        halo.setAttribute("cx", node.x);
        halo.setAttribute("cy", node.y);
        halo.setAttribute("r", "24");
        halo.setAttribute("fill", "var(--color-accent-soft)");
        halo.setAttribute("class", "hero-network__core-glow");
        halo.setAttribute("filter", "url(#core-glow-filter)");
        nodesGroup.appendChild(halo);

        // Core node body
        var core = document.createElementNS(svgNS, "circle");
        core.setAttribute("cx", node.x);
        core.setAttribute("cy", node.y);
        core.setAttribute("r", "12");
        core.setAttribute("fill", "var(--color-accent)");
        core.setAttribute("stroke", "var(--color-text)");
        core.setAttribute("stroke-width", "2");
        nodesGroup.appendChild(core);

        // Inner jewel pip
        var pip = document.createElementNS(svgNS, "circle");
        pip.setAttribute("cx", node.x);
        pip.setAttribute("cy", node.y);
        pip.setAttribute("r", "4");
        pip.setAttribute("fill", "#ffffff");
        nodesGroup.appendChild(pip);
      } else {
        // Standard node: size and opacity vary with z-depth for 3D sphere feel
        var radius = Math.max(2.2, (node.z + 0.5) * 4.2);
        var opacity = Math.max(0.25, (node.z + 0.5) * 0.7);

        var circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", node.x);
        circle.setAttribute("cy", node.y);
        circle.setAttribute("r", radius.toFixed(1));

        if (node.z > 0.4) {
          circle.setAttribute("fill", "var(--color-text)");
          circle.setAttribute("fill-opacity", String(opacity));
          circle.setAttribute("stroke", "var(--color-accent)");
          circle.setAttribute("stroke-width", "1");
        } else {
          circle.setAttribute("fill", "var(--color-text-muted)");
          circle.setAttribute("fill-opacity", String(opacity));
          circle.setAttribute("stroke", "var(--color-border)");
          circle.setAttribute("stroke-width", "0.75");
        }

        nodesGroup.appendChild(circle);
      }
    });
    clusterG.appendChild(nodesGroup);

    // Traveling packet dots. Each route is a chain of node indices ending on
    // the core (index 0); the CSS path string is built from the same scaled
    // coordinates as the mesh, so a dot always rides its lit link.
    // The dots ride CSS offset-path, which older engines ignore - they would
    // park every dot on the SVG origin, so those browsers just lose the dots.
    // The static mesh, cluster rotation and core pulse carry the graphic.
    var canOffsetPath =
      window.CSS &&
      typeof window.CSS.supports === "function" &&
      window.CSS.supports("offset-path", "path('M 0 0 L 1 1')");

    var packetRoutes = [
      { nodes: [5, 1, 0], r: 4, fill: "var(--color-accent-hover)", className: "hero-network__packet-1" },
      { nodes: [6, 2, 0], r: 3.5, fill: "var(--color-accent)", className: "hero-network__packet-2" },
      { nodes: [8, 3, 0], r: 3.5, fill: "var(--color-accent-hover)", className: "hero-network__packet-3" }
    ];

    if (canOffsetPath) {
      packetRoutes.forEach(function (route) {
        var points = route.nodes.map(function (index) {
          var node = rawNodes[index];
          return node.x + " " + node.y;
        });
        var dot = document.createElementNS(svgNS, "circle");
        dot.setAttribute("r", String(route.r));
        dot.setAttribute("fill", route.fill);
        dot.setAttribute("filter", "url(#core-glow-filter)");
        dot.setAttribute("class", route.className);
        dot.style.offsetPath = "path('M " + points.join(" L ") + "')";
        clusterG.appendChild(dot);
      });
    }

    svg.appendChild(clusterG);
    container.appendChild(svg);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeroNetwork);
  } else {
    initHeroNetwork();
  }
})();
