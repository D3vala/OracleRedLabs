/* ==========================================================================
   js/data/resources.js
   Mock entries for the Exploit Vault / resource library.

   Plain script (no import/export) so later <script> tags can read the global
   `resources` array. Keys match the future `resources` table columns:

     GET /api/resources  ->  [{ resource_id, title, abstract, category, ... }]

   Categories are limited to the three filter values used by vault.html:
   "whitepaper" | "case-study" | "rule-set".

   NOTE: titles and abstracts are fictional placeholder content written for a
   school project. The vault is a document library, not a tool.
   ========================================================================== */

const resources = [
  {
    resource_id: 1,
    title: "Signals Over Noise: Triaging 40,000 Daily Alerts",
    abstract:
      "A field note on reducing alert fatigue: how we clustered detection output by campaign rather than by rule, and cut analyst triage time by two thirds on a pilot deployment.",
    category: "whitepaper",
    published_at: "2026-01-14",
  },
  {
    resource_id: 2,
    title: "Case Study: 11 Minutes From Vendor Portal to Domain Admin",
    abstract:
      "An assumed-breach engagement for a fictional logistics operator in which a forgotten vendor portal became a path to domain admin. Includes the timeline, the three controls that would have broken the chain, and the retrospective.",
    category: "case-study",
    published_at: "2026-02-02",
  },
  {
    resource_id: 3,
    title: "Detection Rule Set: Credential Access in Hybrid AD",
    abstract:
      "Twelve portable rules covering credential dumping, DCSync-style replication abuse and token theft in environments that bridge on-premises Active Directory with a cloud identity provider.",
    category: "rule-set",
    published_at: "2026-02-21",
  },
  {
    resource_id: 4,
    title: "The Authorization Ledger: Paper Trails for Simulated Attacks",
    abstract:
      "Our internal methodology for scoping, signing and logging an engagement so that every simulated action can be traced to a written authorisation. Written for defenders who have to explain red-team activity to auditors.",
    category: "whitepaper",
    published_at: "2026-03-01",
  },
  {
    resource_id: 5,
    title: "Case Study: Ransomware Rehearsal at a Regional Health Network",
    abstract:
      "A fictional tabletop-plus-technical exercise across four hospital sites. Covers the pre-agreed stop conditions, the clinical systems we deliberately excluded, and why the fastest containment path was a switch, not a tool.",
    category: "case-study",
    published_at: "2026-03-19",
  },
  {
    resource_id: 6,
    title: "Rule Set: Container Escape Telemetry for Kubernetes",
    abstract:
      "Eight eBPF-backed detections for namespace escapes, privilege-escalation via mounted sockets and anomalous exec patterns inside production pods, with tuning notes for noisy clusters.",
    category: "rule-set",
    published_at: "2026-04-05",
  },
  {
    resource_id: 7,
    title: "Build-System Trust: Threat Modelling the Release Pipeline",
    abstract:
      "A whitepaper on treating a CI/CD pipeline as a production system: reviewer bypass paths, artifact provenance, secret scope, and the recovery time you should assume if the runner is compromised.",
    category: "whitepaper",
    published_at: "2026-04-23",
  },
  {
    resource_id: 8,
    title: "Case Study: Insiders, Federated Identity and a Quiet Exfiltration",
    abstract:
      "A fictional SaaS scenario in which a compromised contractor identity mirrored read-only tenant data for six weeks. Includes the detection gap that hid the activity and the access-review change that closed it.",
    category: "case-study",
    published_at: "2026-05-11",
  },
];
