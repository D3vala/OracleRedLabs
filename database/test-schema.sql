CREATE DATABASE IF NOT EXISTS oracle_red_labs_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE oracle_red_labs_test;

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
  client_user_id BIGINT UNSIGNED NOT NULL,
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
  KEY idx_engagements_client_created (client_user_id, created_at),
  KEY idx_engagements_service (service_id),
  KEY idx_engagements_status_start (status, requested_start_at),
  CONSTRAINT chk_engagements_price CHECK (price_snapshot >= 0),
  CONSTRAINT fk_engagements_client
    FOREIGN KEY (client_user_id) REFERENCES users (user_id)
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

