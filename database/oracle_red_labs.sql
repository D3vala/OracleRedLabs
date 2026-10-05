-- Oracle Red Labs final submission export
-- Recreates the schema and loads fictional demonstration catalogue data.

CREATE DATABASE IF NOT EXISTS oracle_red_labs
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE oracle_red_labs;

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  company_name VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('client', 'admin') NOT NULL DEFAULT 'client',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_active (role, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS organizations (
  organization_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  billing_email VARCHAR(254) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id),
  KEY idx_organizations_active_name (is_active, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS organization_memberships (
  organization_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('owner', 'manager', 'member', 'billing') NOT NULL,
  invited_by_user_id BIGINT UNSIGNED NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, user_id),
  KEY idx_memberships_user_role (user_id, role),
  KEY idx_memberships_inviter (invited_by_user_id),
  CONSTRAINT fk_memberships_organization
    FOREIGN KEY (organization_id) REFERENCES organizations (organization_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_memberships_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_memberships_inviter
    FOREIGN KEY (invited_by_user_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS organization_invitations (
  invitation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  invited_email VARCHAR(254) NOT NULL,
  intended_role ENUM('owner', 'manager', 'member', 'billing') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  status ENUM('pending', 'accepted', 'cancelled', 'expired') NOT NULL DEFAULT 'pending',
  pending_email VARCHAR(254) GENERATED ALWAYS AS (
    CASE WHEN status = 'pending' THEN invited_email ELSE NULL END
  ) STORED,
  invited_by_user_id BIGINT UNSIGNED NOT NULL,
  accepted_by_user_id BIGINT UNSIGNED NULL,
  cancelled_by_user_id BIGINT UNSIGNED NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (invitation_id),
  UNIQUE KEY uq_invitations_token_hash (token_hash),
  UNIQUE KEY uq_invitations_pending_email (organization_id, pending_email),
  KEY idx_invitations_received (invited_email, status, expires_at),
  KEY idx_invitations_inviter (invited_by_user_id),
  KEY idx_invitations_acceptor (accepted_by_user_id),
  KEY idx_invitations_canceller (cancelled_by_user_id),
  CONSTRAINT fk_invitations_organization
    FOREIGN KEY (organization_id) REFERENCES organizations (organization_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_invitations_inviter
    FOREIGN KEY (invited_by_user_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_invitations_acceptor
    FOREIGN KEY (accepted_by_user_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_invitations_canceller
    FOREIGN KEY (cancelled_by_user_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS services (
  service_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  short_description VARCHAR(255) NOT NULL,
  long_description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  delivery_method VARCHAR(150) NOT NULL,
  base_price DECIMAL(12,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (service_id),
  UNIQUE KEY uq_services_name (name),
  UNIQUE KEY uq_services_slug (slug),
  KEY idx_services_active (is_active),
  CONSTRAINT chk_services_base_price CHECK (base_price >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS resources (
  resource_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL,
  abstract TEXT NOT NULL,
  category ENUM('whitepaper', 'case-study', 'rule-set') NOT NULL,
  published_at DATE NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (resource_id),
  UNIQUE KEY uq_resources_slug (slug),
  KEY idx_resources_publication (is_published, published_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inquiries (
  inquiry_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  company_name VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('new', 'reviewed', 'closed') NOT NULL DEFAULT 'new',
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (inquiry_id),
  KEY idx_inquiries_status_created (status, created_at),
  KEY idx_inquiries_reviewer (reviewed_by),
  CONSTRAINT fk_inquiries_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS engagements (
  engagement_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference_code CHAR(10) NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
  submitted_by_user_id BIGINT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  scope_description TEXT NOT NULL,
  requested_start_at DATETIME NOT NULL,
  billing_method ENUM('invoice', 'card_link', 'purchase_order') NOT NULL,
  billing_email VARCHAR(254) NOT NULL,
  purchase_order_number VARCHAR(100) NULL,
  status ENUM('pending', 'scoping', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  price_snapshot DECIMAL(12,2) NOT NULL,
  cancelled_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (engagement_id),
  UNIQUE KEY uq_engagements_reference (reference_code),
  KEY idx_engagements_organization_created (organization_id, created_at),
  KEY idx_engagements_submitter (submitted_by_user_id),
  KEY idx_engagements_service (service_id),
  KEY idx_engagements_status_start (status, requested_start_at),
  CONSTRAINT chk_engagements_price CHECK (price_snapshot >= 0),
  CONSTRAINT fk_engagements_organization
    FOREIGN KEY (organization_id) REFERENCES organizations (organization_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_engagements_submitter
    FOREIGN KEY (submitted_by_user_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_engagements_service
    FOREIGN KEY (service_id) REFERENCES services (service_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS engagement_targets (
  target_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  engagement_id BIGINT UNSIGNED NOT NULL,
  target_value VARCHAR(255) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (target_id),
  UNIQUE KEY uq_engagement_target_order (engagement_id, sort_order),
  CONSTRAINT fk_targets_engagement
    FOREIGN KEY (engagement_id) REFERENCES engagements (engagement_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS authorization_documents (
  document_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  engagement_id BIGINT UNSIGNED NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes INT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id),
  UNIQUE KEY uq_authorization_engagement (engagement_id),
  UNIQUE KEY uq_authorization_filename (stored_filename),
  CONSTRAINT chk_authorization_size CHECK (file_size_bytes <= 5242880),
  CONSTRAINT fk_authorization_engagement
    FOREIGN KEY (engagement_id) REFERENCES engagements (engagement_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  engagement_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status ENUM('not_issued', 'outstanding', 'paid', 'cancelled') NOT NULL DEFAULT 'not_issued',
  issued_at DATETIME NULL,
  paid_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (invoice_id),
  UNIQUE KEY uq_invoices_engagement (engagement_id),
  KEY idx_invoices_status (status),
  CONSTRAINT chk_invoice_amount CHECK (amount >= 0),
  CONSTRAINT fk_invoices_engagement
    FOREIGN KEY (engagement_id) REFERENCES engagements (engagement_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS engagement_status_history (
  history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  engagement_id BIGINT UNSIGNED NOT NULL,
  old_status ENUM('pending', 'scoping', 'active', 'completed', 'cancelled') NULL,
  new_status ENUM('pending', 'scoping', 'active', 'completed', 'cancelled') NOT NULL,
  changed_by BIGINT UNSIGNED NULL,
  note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (history_id),
  KEY idx_history_engagement_created (engagement_id, created_at),
  KEY idx_history_actor (changed_by),
  CONSTRAINT fk_history_engagement
    FOREIGN KEY (engagement_id) REFERENCES engagements (engagement_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_history_actor
    FOREIGN KEY (changed_by) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL,
  expires BIGINT UNSIGNED NOT NULL,
  data MEDIUMTEXT NOT NULL,
  PRIMARY KEY (session_id),
  KEY idx_sessions_expires (expires)
) ENGINE=InnoDB;

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
