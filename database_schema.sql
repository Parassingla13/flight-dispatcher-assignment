-- ================================================================
-- Assignment 2 – Database Schema
-- UserBase: Database System with User Login & Record Management
-- ================================================================
-- Database: PostgreSQL 15+ (also compatible with MySQL 8 / SQLite)
-- ================================================================

-- ── Table: users ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                  SERIAL          PRIMARY KEY,
    first_name          VARCHAR(100)    NOT NULL,
    last_name           VARCHAR(100)    NOT NULL,
    email               VARCHAR(255)    NOT NULL UNIQUE,
    phone               VARCHAR(30),
    role                VARCHAR(50)     NOT NULL DEFAULT 'Employee',
    department          VARCHAR(100),
    username            VARCHAR(100)    NOT NULL UNIQUE,
    password_hash       TEXT            NOT NULL,
    must_change_password BOOLEAN        NOT NULL DEFAULT TRUE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    source              VARCHAR(20)     NOT NULL DEFAULT 'registration',
                        -- values: 'registration' | 'import' | 'manual'
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Indexes for login lookups
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active   ON users(is_active);

-- ── Table: sessions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id          SERIAL          PRIMARY KEY,
    user_id     INT             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255)    NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ     NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    ip_address  VARCHAR(45),
    user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- ── Table: otp_verifications ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_verifications (
    id          SERIAL          PRIMARY KEY,
    email       VARCHAR(255)    NOT NULL,
    otp_code    VARCHAR(10)     NOT NULL,
    purpose     VARCHAR(30)     NOT NULL DEFAULT 'registration',
                -- values: 'registration' | 'password_reset'
    payload     JSONB,          -- stores pending registration data
    is_used     BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ     NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(email);

-- ── Table: audit_log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL       PRIMARY KEY,
    user_id     INT             REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(50)     NOT NULL,
                -- values: 'LOGIN' | 'LOGOUT' | 'CREATE_USER' | 'UPDATE_USER'
                --         'DELETE_USER' | 'CHANGE_PASSWORD' | 'IMPORT_EXCEL'
                --         'OTP_SENT' | 'OTP_VERIFIED' | 'OTP_FAILED'
    target_id   INT,            -- id of affected user (for admin actions)
    detail      TEXT,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_id   ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON audit_log(created_at DESC);

-- ── Auto-update updated_at trigger ───────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Cleanup expired sessions (run via cron or pg_cron) ───────────
-- DELETE FROM sessions WHERE expires_at < NOW();
-- DELETE FROM otp_verifications WHERE expires_at < NOW() OR is_used = TRUE;

-- ================================================================
-- ENTITY RELATIONSHIP SUMMARY
-- ================================================================
--
--  users ──────────────────────────────────────────────────────
--    id (PK)                 Auto-increment integer
--    first_name              Required
--    last_name               Required
--    email                   Required, unique (used as login)
--    phone                   Optional
--    role                    Default: Employee
--    department              Optional
--    username                Auto-generated (e.g. jsmith42), unique
--    password_hash           bcrypt/base64 hash
--    must_change_password    TRUE on first login, set FALSE after change
--    is_active               Soft-enable/disable
--    source                  registration | import | manual
--    created_at              Timestamp
--    updated_at              Auto-updated on any change
--
--  sessions  [1 user → many sessions]
--    id, user_id (FK), token, created_at, expires_at, ip, agent
--
--  otp_verifications  [email-based, no FK to users yet]
--    id, email, otp_code, purpose, payload (JSONB), is_used, expires_at
--
--  audit_log  [optional but recommended for production]
--    id, user_id (FK nullable), action, target_id, detail, ip, created_at
--
-- ================================================================
-- SAMPLE QUERIES
-- ================================================================

-- Login: find user by username or email
SELECT * FROM users
WHERE (username = $1 OR email = $1)
  AND is_active = TRUE
LIMIT 1;

-- Create session after successful login
INSERT INTO sessions (user_id, token, ip_address)
VALUES ($1, $2, $3)
RETURNING *;

-- Get user by session token
SELECT u.* FROM users u
JOIN sessions s ON s.user_id = u.id
WHERE s.token = $1
  AND s.expires_at > NOW()
  AND u.is_active = TRUE;

-- Create user (after OTP verified or manual add)
INSERT INTO users (first_name, last_name, email, phone, role, department, username, password_hash, source)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- Force password change on first login
UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW()
WHERE id = $2;

-- Soft-delete: deactivate (preferred over hard delete)
UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1;

-- Hard delete (Step 2 requirement: user can delete their own record)
DELETE FROM users WHERE id = $1;

-- Save OTP for registration
INSERT INTO otp_verifications (email, otp_code, purpose, payload)
VALUES ($1, $2, 'registration', $3::jsonb)
ON CONFLICT DO NOTHING;

-- Verify OTP
SELECT * FROM otp_verifications
WHERE email = $1
  AND otp_code = $2
  AND is_used = FALSE
  AND expires_at > NOW()
LIMIT 1;

-- Mark OTP used after successful verification
UPDATE otp_verifications SET is_used = TRUE WHERE id = $1;
