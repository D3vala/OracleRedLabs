-- Oracle Red Labs organization ownership migration.
-- Safe to rerun on MySQL 8.0+ after the original client-owned schema.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

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

DROP PROCEDURE IF EXISTS migrate_organization_ownership;
DELIMITER $$
CREATE PROCEDURE migrate_organization_ownership()
BEGIN
  DECLARE done BOOLEAN DEFAULT FALSE;
  DECLARE v_user_id BIGINT UNSIGNED;
  DECLARE v_company_name VARCHAR(150);
  DECLARE v_email VARCHAR(254);
  DECLARE v_organization_id BIGINT UNSIGNED;
  DECLARE v_count BIGINT DEFAULT 0;
  DECLARE client_cursor CURSOR FOR
    SELECT user_id, company_name, email FROM users WHERE role = 'client' ORDER BY user_id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'engagements' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE engagements ADD COLUMN organization_id BIGINT UNSIGNED NULL AFTER reference_code;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'engagements' AND column_name = 'submitted_by_user_id'
  ) THEN
    ALTER TABLE engagements ADD COLUMN submitted_by_user_id BIGINT UNSIGNED NULL AFTER organization_id;
  END IF;

  DROP TEMPORARY TABLE IF EXISTS migration_organization_map;
  CREATE TEMPORARY TABLE migration_organization_map (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL
  );

  OPEN client_cursor;
  client_loop: LOOP
    FETCH client_cursor INTO v_user_id, v_company_name, v_email;
    IF done THEN LEAVE client_loop; END IF;

    SELECT MIN(organization_id) INTO v_organization_id
      FROM organization_memberships
     WHERE user_id = v_user_id AND role = 'owner';

    IF v_organization_id IS NULL THEN
      INSERT INTO organizations (name, billing_email) VALUES (v_company_name, v_email);
      SET v_organization_id = LAST_INSERT_ID();
      INSERT INTO organization_memberships (organization_id, user_id, role)
      VALUES (v_organization_id, v_user_id, 'owner');
    END IF;

    INSERT INTO migration_organization_map (user_id, organization_id)
    VALUES (v_user_id, v_organization_id)
    ON DUPLICATE KEY UPDATE organization_id = VALUES(organization_id);
  END LOOP;
  CLOSE client_cursor;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'engagements' AND column_name = 'client_user_id'
  ) THEN
    UPDATE engagements e
    JOIN migration_organization_map m ON m.user_id = e.client_user_id
       SET e.organization_id = COALESCE(e.organization_id, m.organization_id),
           e.submitted_by_user_id = COALESCE(e.submitted_by_user_id, e.client_user_id);
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM engagements
   WHERE organization_id IS NULL OR submitted_by_user_id IS NULL;
  IF v_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Organization migration stopped because one or more engagements could not be mapped.';
  END IF;

  ALTER TABLE engagements
    MODIFY organization_id BIGINT UNSIGNED NOT NULL,
    MODIFY submitted_by_user_id BIGINT UNSIGNED NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'engagements'
       AND index_name = 'idx_engagements_organization_created'
  ) THEN
    ALTER TABLE engagements ADD KEY idx_engagements_organization_created (organization_id, created_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'engagements'
       AND index_name = 'idx_engagements_submitter'
  ) THEN
    ALTER TABLE engagements ADD KEY idx_engagements_submitter (submitted_by_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE constraint_schema = DATABASE() AND table_name = 'engagements'
       AND constraint_name = 'fk_engagements_organization'
  ) THEN
    ALTER TABLE engagements ADD CONSTRAINT fk_engagements_organization
      FOREIGN KEY (organization_id) REFERENCES organizations (organization_id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE constraint_schema = DATABASE() AND table_name = 'engagements'
       AND constraint_name = 'fk_engagements_submitter'
  ) THEN
    ALTER TABLE engagements ADD CONSTRAINT fk_engagements_submitter
      FOREIGN KEY (submitted_by_user_id) REFERENCES users (user_id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE constraint_schema = DATABASE() AND table_name = 'engagements'
       AND constraint_name = 'fk_engagements_client'
  ) THEN
    ALTER TABLE engagements DROP FOREIGN KEY fk_engagements_client;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'engagements'
       AND index_name = 'idx_engagements_client_created'
  ) THEN
    ALTER TABLE engagements DROP INDEX idx_engagements_client_created;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'engagements' AND column_name = 'client_user_id'
  ) THEN
    ALTER TABLE engagements DROP COLUMN client_user_id;
  END IF;

  DROP TEMPORARY TABLE IF EXISTS migration_organization_map;
END$$
DELIMITER ;

CALL migrate_organization_ownership();
DROP PROCEDURE migrate_organization_ownership;
