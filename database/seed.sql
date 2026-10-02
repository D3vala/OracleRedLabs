USE oracle_red_labs;

INSERT INTO services
  (service_id, name, slug, short_description, long_description, category, delivery_method, base_price, is_active)
VALUES
  (1, 'ORACLE AI', 'oracle-ai',
   'Machine-assisted external assault simulation across your public attack surface.',
   'ORACLE AI is a fictional external-assessment service used to demonstrate catalogue browsing and engagement booking. The academic application records the requested scope, targets, schedule, authorization document, and billing preference. It does not scan assets, generate payloads, or produce security findings.',
   'External Assault', '48-Hour Blitz or Monthly Retainer', 15000.00, TRUE),
  (2, 'PHANTASM', 'phantasm',
   'Covert persistence, evasion and lateral-movement testing against assumed-breach scenarios.',
   'PHANTASM is a fictional assumed-breach service used to demonstrate an authorization-first request workflow. The academic application stores and tracks the request only. No beacons, persistence, privilege escalation, lateral movement, or target interaction is performed.',
   'Assumed Breach', '2-4 Week Resident Engagement', 22000.00, TRUE),
  (3, 'CHAINBREAK', 'chainbreak',
   'Supply-chain and software-assurance review for pipelines, dependencies and build infrastructure.',
   'CHAINBREAK is a fictional supply-chain review category for demonstrating service administration and engagement tracking. The academic application records a proposed scope for CI/CD, dependency, and release-process review; it does not inspect repositories or build systems.',
   'Supply Chain', 'Fixed-Scope Project (3-6 Weeks)', 18000.00, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), short_description = VALUES(short_description),
  long_description = VALUES(long_description), category = VALUES(category),
  delivery_method = VALUES(delivery_method), base_price = VALUES(base_price),
  is_active = VALUES(is_active);

INSERT INTO resources
  (resource_id, title, slug, abstract, category, published_at, is_published)
VALUES
  (1, 'Signals Over Noise: Triaging 40,000 Daily Alerts', 'signals-over-noise', 'A field note on reducing alert fatigue: how we clustered detection output by campaign rather than by rule, and cut analyst triage time by two thirds on a pilot deployment.', 'whitepaper', '2026-01-14', TRUE),
  (2, 'Case Study: 11 Minutes From Vendor Portal to Domain Admin', 'vendor-portal-domain-admin', 'An assumed-breach engagement for a fictional logistics operator in which a forgotten vendor portal became a path to domain admin.', 'case-study', '2026-02-02', TRUE),
  (3, 'Detection Rule Set: Credential Access in Hybrid AD', 'credential-access-hybrid-ad', 'Twelve portable rules covering credential dumping, replication abuse and token theft in hybrid identity environments.', 'rule-set', '2026-02-21', TRUE),
  (4, 'The Authorization Ledger: Paper Trails for Simulated Attacks', 'authorization-ledger', 'Our methodology for scoping, signing and logging an engagement so every simulated action maps to written authorization.', 'whitepaper', '2026-03-01', TRUE),
  (5, 'Case Study: Ransomware Rehearsal at a Regional Health Network', 'ransomware-rehearsal-health', 'A fictional tabletop-plus-technical exercise across four hospital sites, including stop conditions and deliberately excluded clinical systems.', 'case-study', '2026-03-19', TRUE),
  (6, 'Rule Set: Container Escape Telemetry for Kubernetes', 'container-escape-telemetry', 'Eight eBPF-backed detections for namespace escapes, mounted-socket privilege escalation and anomalous execution patterns.', 'rule-set', '2026-04-05', TRUE),
  (7, 'Build-System Trust: Threat Modelling the Release Pipeline', 'build-system-trust', 'A whitepaper on reviewer bypass paths, artifact provenance, secret scope and recovery assumptions for CI/CD systems.', 'whitepaper', '2026-04-23', TRUE),
  (8, 'Case Study: Insiders, Federated Identity and a Quiet Exfiltration', 'insiders-federated-identity', 'A fictional SaaS scenario involving a compromised contractor identity, a detection gap and a corrective access-review process.', 'case-study', '2026-05-11', TRUE)
ON DUPLICATE KEY UPDATE
  title = VALUES(title), abstract = VALUES(abstract), category = VALUES(category),
  published_at = VALUES(published_at), is_published = VALUES(is_published);
