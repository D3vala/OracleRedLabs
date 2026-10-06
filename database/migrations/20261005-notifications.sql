-- Additive notification migration. Apply after organizations/memberships.
-- Select the database explicitly before running. Safe to rerun on MySQL 8.0+.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS notification_events (
  event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  source_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_type ENUM('engagement_submitted','engagement_status_changed','invoice_changed','invitation_created','invitation_cancelled','invitation_accepted','member_role_changed','member_removed') NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  subject_user_id BIGINT UNSIGNED NULL,
  engagement_id BIGINT UNSIGNED NULL,
  invitation_id BIGINT UNSIGNED NULL,
  old_value VARCHAR(20) NULL,
  new_value VARCHAR(20) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id),
  UNIQUE KEY uq_notification_event_source (source_key),
  UNIQUE KEY uq_notification_event_org (event_id, organization_id),
  KEY idx_notification_event_created (created_at),
  CONSTRAINT fk_notification_event_org FOREIGN KEY (organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_event_actor FOREIGN KEY (actor_user_id) REFERENCES users (user_id) ON DELETE SET NULL,
  CONSTRAINT fk_notification_event_subject FOREIGN KEY (subject_user_id) REFERENCES users (user_id) ON DELETE SET NULL,
  CONSTRAINT fk_notification_event_engagement FOREIGN KEY (engagement_id) REFERENCES engagements (engagement_id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_event_invitation FOREIGN KEY (invitation_id) REFERENCES organization_invitations (invitation_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
  recipient_user_id BIGINT UNSIGNED NOT NULL,
  audience ENUM('engagement','status','invoice','team','personal_access') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  PRIMARY KEY (notification_id),
  UNIQUE KEY uq_notification_recipient (event_id, recipient_user_id),
  UNIQUE KEY uq_notification_identity (notification_id, organization_id, recipient_user_id),
  KEY idx_notification_recipient_order (organization_id, recipient_user_id, notification_id),
  KEY idx_notification_unread (organization_id, recipient_user_id, read_at, notification_id),
  CONSTRAINT fk_notification_event FOREIGN KEY (event_id, organization_id) REFERENCES notification_events (event_id, organization_id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_membership FOREIGN KEY (organization_id, recipient_user_id) REFERENCES organization_memberships (organization_id, user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_preferences (
  organization_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  engagement_email BOOLEAN NOT NULL DEFAULT TRUE,
  invoice_email BOOLEAN NOT NULL DEFAULT TRUE,
  team_email BOOLEAN NOT NULL DEFAULT FALSE,
  personal_access_email BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (organization_id, user_id),
  CONSTRAINT fk_notification_preferences_membership FOREIGN KEY (organization_id, user_id) REFERENCES organization_memberships (organization_id, user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_email_outbox (
  job_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  delivery_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
  notification_id BIGINT UNSIGNED NULL,
  recipient_user_id BIGINT UNSIGNED NULL,
  invitation_id BIGINT UNSIGNED NULL,
  template ENUM('event','invitation_existing','invitation_new') NOT NULL,
  encrypted_payload TEXT NULL,
  state ENUM('pending','sending','accepted','cancelled','failed') NOT NULL DEFAULT 'pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_token CHAR(36) NULL,
  lease_expires_at DATETIME NULL,
  accepted_at DATETIME NULL,
  finished_at DATETIME NULL,
  error_code VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (job_id),
  UNIQUE KEY uq_notification_delivery (delivery_key),
  KEY idx_notification_jobs_due (state, next_attempt_at),
  KEY idx_notification_jobs_lease (state, lease_expires_at),
  KEY idx_notification_jobs_invitation (invitation_id, organization_id),
  CONSTRAINT fk_notification_job_org FOREIGN KEY (organization_id) REFERENCES organizations (organization_id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_job_recipient FOREIGN KEY (notification_id, organization_id, recipient_user_id) REFERENCES notifications (notification_id, organization_id, recipient_user_id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_job_invitation FOREIGN KEY (invitation_id) REFERENCES organization_invitations (invitation_id) ON DELETE CASCADE,
  CONSTRAINT chk_notification_job_kind CHECK (
    (template = 'event' AND notification_id IS NOT NULL AND recipient_user_id IS NOT NULL AND invitation_id IS NULL)
    OR (template <> 'event' AND notification_id IS NULL AND recipient_user_id IS NULL AND invitation_id IS NOT NULL)
  )
) ENGINE=InnoDB;
