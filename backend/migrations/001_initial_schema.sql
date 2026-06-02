-- ============================================================
-- LeadFlow — Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100)  NOT NULL,
    email      VARCHAR(255)  NOT NULL UNIQUE,
    password   VARCHAR(255)  NOT NULL,
    role       VARCHAR(20)   NOT NULL CHECK (role IN ('admin', 'manager', 'agent')),
    is_active  BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── refresh_tokens ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── leads ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(255),
    phone       VARCHAR(30),
    source      VARCHAR(50)  CHECK (source IN ('website','referral','social','email','cold_call','event','other')),
    status      VARCHAR(30)  NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','contacted','qualified','proposal','negotiation','won','lost')),
    assigned_to UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_by  UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes       TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── activity_logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id    UUID         REFERENCES leads(id) ON DELETE CASCADE,
    user_id    UUID         REFERENCES users(id) ON DELETE SET NULL,
    action     VARCHAR(50)  NOT NULL,
    details    JSONB,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── agent_assignment_tracker ─────────────────────────────────────────────────
-- Tracks per-agent lead count for least-loaded assignment strategy
CREATE TABLE IF NOT EXISTS agent_assignment_tracker (
    agent_id        UUID    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    lead_count      INTEGER NOT NULL DEFAULT 0,
    last_assigned_at TIMESTAMPTZ
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_status       ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source       ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to  ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_by   ON leads(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_created_at   ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_lead ON activity_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_time ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_role         ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_uid ON refresh_tokens(user_id);

-- ─── Trigger: auto-update updated_at ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Seed: default admin user ─────────────────────────────────────────────────
-- Password: Admin@123 (bcrypt hash)
INSERT INTO users (name, email, password, role)
VALUES (
    'System Admin',
    'admin@leadmanager.com',
    '$2a$10$rUxQyWr9oKUglNbaR6MjceJv0Va4scj.6yCwpz9J5fnjUoGMVr94S', -- Admin@123
    'admin'
)
ON CONFLICT (email) DO NOTHING;
