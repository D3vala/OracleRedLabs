/* ==========================================================================
   js/data/services.js
   Historical service catalogue retained as a documented seed source.

   Deliberately written as a plain script (no import/export) because the site
   has no bundler: the `const` below becomes a global that any later <script>
   tag on the page can read.

   Runtime pages load the same shape from the services API. This file is not
   loaded by the application and remains only as a migration reference:

     GET /api/services  ->  [{ service_id, name, slug, ... }, ...]

   NOTE: these are fictional service names and placeholder prices for a
   school project. Nothing here performs real security work.
   ========================================================================== */

const services = [
  {
    service_id: 1,
    name: "ORACLE AI",
    slug: "oracle-ai",
    short_description:
      "Machine-assisted external assault simulation across your public attack surface.",
    long_description:
      "ORACLE AI is a fictional external-assessment service used to demonstrate catalogue browsing and engagement booking. The academic application records the requested scope, targets, schedule, authorization document, and billing preference. It does not scan assets, generate payloads, or produce security findings.",
    category: "External Assault",
    delivery_method: "48-Hour Blitz or Monthly Retainer",
    base_price: 15000.0,
  },
  {
    service_id: 2,
    name: "PHANTASM",
    slug: "phantasm",
    short_description:
      "Covert persistence, evasion and lateral-movement testing against assumed-breach scenarios.",
    long_description:
      "PHANTASM is a fictional assumed-breach service used to demonstrate an authorization-first request workflow. The academic application stores and tracks the request only. No beacons, persistence, privilege escalation, lateral movement, or target interaction is performed.",
    category: "Assumed Breach",
    delivery_method: "2-4 Week Resident Engagement",
    base_price: 22000.0,
  },
  {
    service_id: 3,
    name: "CHAINBREAK",
    slug: "chainbreak",
    short_description:
      "Supply-chain and software-assurance review for pipelines, dependencies and build infrastructure.",
    long_description:
      "CHAINBREAK is a fictional supply-chain review category for demonstrating service administration and engagement tracking. The academic application records a proposed scope for CI/CD, dependency, and release-process review; it does not inspect repositories or build systems.",
    category: "Supply Chain",
    delivery_method: "Fixed-Scope Project (3-6 Weeks)",
    base_price: 18000.0,
  },
];
