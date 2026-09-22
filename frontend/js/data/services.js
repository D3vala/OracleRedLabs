/* ==========================================================================
   js/data/services.js
   Mock service catalogue for Oracle Red Labs.

   Deliberately written as a plain script (no import/export) because the site
   has no bundler: the `const` below becomes a global that any later <script>
   tag on the page can read.

   The object keys match the columns of the future `services` table, so wiring
   this up in Milestone 7 is "replace the array with a fetch()", not a rewrite:

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
      "ORACLE AI pairs a human red team with a model-assisted recon and payload-synthesis pipeline. Over a fixed window we map every internet-facing asset you declare in scope, chain the most promising weaknesses into a demonstrable intrusion path, and replay the whole thing on request so your engineers see the exact sequence that worked. Deliverables include a replayable timeline, per-finding reproduction steps, and a prioritised remediation queue. No production data is exfiltrated or retained: proof objects are hashed, not copied.",
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
      "PHANTASM assumes an attacker has already crossed your boundary and asks a harder question: how long can they stay, and what can they reach? We plant instrumented beacons (never destructive implants), attempt privilege escalation and lateral movement toward your crown-jewel systems, and measure how your detection stack responds. Every beacon is time-boxed, tagged to a signed authorisation, and removed at engagement close. Your team receives a detection-gap report mapped to the tactics we used and the log sources that missed us.",
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
      "CHAINBREAK reviews the software you ship and the machinery that builds it: CI/CD permissions, artifact signing, dependency provenance, and the human process around releases. We model realistic commit-to-production sabotage scenarios, test whether your pipeline would allow an unreviewed artifact to reach customers, and produce a staged hardening plan weighted by blast radius. The report is written so a platform team can start on the highest-impact item the same week.",
    category: "Supply Chain",
    delivery_method: "Fixed-Scope Project (3-6 Weeks)",
    base_price: 18000.0,
  },
];
