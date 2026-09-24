-- SOPY database schema
-- Multi-tenant: every operational table carries tenant_id and application
-- code scopes all queries by it. See README for a note on upgrading to
-- Postgres Row-Level Security for defense in depth.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name TEXT NOT NULL,
  country         TEXT NOT NULL,
  business_type   TEXT,                    -- e.g. 'restaurant', 'cafe', 'cloud_kitchen', 'bar'
  branch_count    INTEGER NOT NULL DEFAULT 1,   -- planned/subscribed count, independent of actual rows
  user_count      INTEGER NOT NULL DEFAULT 1,
  onboarding_step TEXT NOT NULL DEFAULT 'who_are_you',
    -- who_are_you -> configure_data -> pricing -> checkout -> onboarding -> complete
  onboarding_completed_at TIMESTAMPTZ,
  referral_code   TEXT UNIQUE,              -- this business's share code (?ref=…); created on first view
  referred_by_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL, -- whose link they signed up with
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  timezone    TEXT DEFAULT 'UTC',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_branches_tenant ON branches(tenant_id);

CREATE TYPE user_role AS ENUM (
  'business_owner',
  'operations_manager',
  'area_manager',
  'store_manager',
  'employee'
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  title         TEXT,
  email         CITEXT,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'employee',
  language      TEXT NOT NULL DEFAULT 'en',       -- UI language: 'en' | 'ar' | 'fr'
  access_level  TEXT NOT NULL DEFAULT 'standard', -- 'admin' | 'manager' | 'standard'
  status        TEXT NOT NULL DEFAULT 'active',   -- 'invited' | 'active' | 'disabled'
  invite_token  TEXT,               -- one-time link: an invite, or a manager-issued password reset
  -- Sessions issued before this are refused: set when a password changes
  -- or is reset, so a lost phone's session stops working.
  tokens_valid_after TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Login looks users up by email alone (a user belongs to exactly one
-- tenant), so email must be globally unique, not just per-tenant.
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- Many-to-many: a user (esp. area/ops managers) can be assigned to several branches
CREATE TABLE user_branches (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, branch_id)
);

CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_count          INTEGER NOT NULL,
  user_count            INTEGER NOT NULL,
  branch_rate           NUMERIC(10,4) NOT NULL,   -- blended per-branch rate at time of billing
  user_rate             NUMERIC(10,4) NOT NULL,   -- blended per-user rate at time of billing
  monthly_total         NUMERIC(10,2) NOT NULL,
  credit_applied        NUMERIC(10,2) NOT NULL DEFAULT 0, -- account credit taken off this checkout's first payment
  status                TEXT NOT NULL DEFAULT 'pending', -- pending|active|past_due|canceled
  paddle_subscription_id TEXT,
  paddle_customer_id     TEXT,
  paddle_transaction_id  TEXT,
  current_period_end    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);

-- Master checkpoint library: global (tenant_id NULL) + tenant-custom items
CREATE TABLE checklist_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global library item
  text         TEXT NOT NULL,
  description  TEXT,
  standard     TEXT NOT NULL,     -- 'HACCP' | 'ISO_22000' | 'LOCAL_CODE' | 'INTERNAL_QC' | 'CUSTOM'
  category     TEXT,              -- section grouping, e.g. 'Daily QC — B. Food Safety & Temperature'
  requires_photo BOOLEAN NOT NULL DEFAULT false,
  is_critical  BOOLEAN NOT NULL DEFAULT false, -- a failing response here auto-flags the submission as an incident
  sort_order   INTEGER NOT NULL DEFAULT 0, -- preserves source-document order within a category (INSERT row order isn't guaranteed)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklist_items_tenant ON checklist_items(tenant_id);
CREATE INDEX idx_checklist_items_standard ON checklist_items(standard);

-- Translations of library content, keyed by the English source string
-- rather than by item id. Two reasons: the seeded items get fresh UUIDs
-- on every re-seed, and the same phrase (a category heading, a repeated
-- checkpoint) then only needs translating once. English rows stay the
-- source of truth in checklist_items and are never overwritten — the
-- client transcribed SOP 1-11 and the QC audit content from their own
-- documents, so a translation is an additional view of that text, not a
-- replacement for it. `source` marks whether a human has reviewed it.
-- In-app feedback from any signed-in user. page_path records where they
-- were when they sent it, since "this screen is confusing" is useless
-- without knowing which screen.
CREATE TABLE feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  category    TEXT NOT NULL,             -- 'bug' | 'idea' | 'other'
  message     TEXT NOT NULL,
  page_path   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_tenant ON feedback(tenant_id);

CREATE TABLE content_translations (
  lang        TEXT NOT NULL,             -- 'ar' | 'fr'
  source_text TEXT NOT NULL,             -- the exact English string
  translated  TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'machine', -- 'machine' | 'reviewed'
  PRIMARY KEY (lang, source_text)
);

CREATE TABLE checklist_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  kind        TEXT NOT NULL DEFAULT 'custom', -- 'custom' | 'kitchen_daily' | 'bar_daily'
  frequency   TEXT NOT NULL DEFAULT 'daily',  -- 'daily' | 'weekly' | 'monthly'
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_templates_tenant ON checklist_templates(tenant_id);

CREATE TABLE checklist_template_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  item_id      UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  section      TEXT -- e.g. 'temperature_log' | 'receiving_log' | 'waste_log' | 'equipment_status' | 'opening' | 'closing' | 'sign_off'
);
CREATE INDEX idx_template_items_template ON checklist_template_items(template_id);

CREATE TABLE checklist_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id  UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  branch_id    UUID REFERENCES branches(id) ON DELETE CASCADE,   -- NULL = all branches
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,      -- NULL = not user-specific
  role         user_role,                                        -- NULL = not role-specific
  due_time     TIME,          -- local time of day this recurs
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assignments_tenant ON checklist_assignments(tenant_id);
CREATE INDEX idx_assignments_branch ON checklist_assignments(branch_id);

CREATE TABLE checklist_submissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assignment_id  UUID REFERENCES checklist_assignments(id) ON DELETE SET NULL,
  template_id    UUID NOT NULL REFERENCES checklist_templates(id),
  branch_id      UUID NOT NULL REFERENCES branches(id),
  submitted_by   UUID NOT NULL REFERENCES users(id),
  status         TEXT NOT NULL DEFAULT 'in_progress', -- in_progress|submitted
  form_data      JSONB NOT NULL DEFAULT '{}',
    -- structured sections for daily ops reports:
    -- { temperature_log: [...], receiving_log: [...], waste_log: [...],
    --   equipment_status: [...], notes: '' }
  has_incident   BOOLEAN NOT NULL DEFAULT false,
  gps_lat        DOUBLE PRECISION,
  gps_lng        DOUBLE PRECISION,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at   TIMESTAMPTZ,
  signed_off_by  UUID REFERENCES users(id),
  signed_off_at  TIMESTAMPTZ
);
CREATE INDEX idx_submissions_tenant ON checklist_submissions(tenant_id);
CREATE INDEX idx_submissions_branch ON checklist_submissions(branch_id);
CREATE INDEX idx_submissions_submitted_at ON checklist_submissions(submitted_at);

CREATE TABLE checklist_submission_responses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES checklist_submissions(id) ON DELETE CASCADE,
  item_id        UUID NOT NULL REFERENCES checklist_items(id),
  is_compliant   BOOLEAN,
  value_text     TEXT,          -- free-text or numeric-as-text reading (e.g. temperature)
  photo_path     TEXT,          -- captured-in-app photo evidence (camera only, never a file upload)
  gps_lat        DOUBLE PRECISION,
  gps_lng        DOUBLE PRECISION,
  captured_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_responses_submission ON checklist_submission_responses(submission_id);

CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- A report PDF someone shared by link (WhatsApp/email). The file lives
-- in server/storage/shares/<token>.pdf (outside the public /uploads
-- folder) and is served by /api/shared/:token until expires_at.
CREATE TABLE report_shares (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  submission_id  UUID NOT NULL REFERENCES checklist_submissions(id) ON DELETE CASCADE,
  token          TEXT NOT NULL UNIQUE,
  file_name      TEXT NOT NULL,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_report_shares_tenant ON report_shares(tenant_id);
-- Account credit a business can spend on its payments. Today the only
-- source is referrals: one row per referred business that paid (the
-- UNIQUE on referred_tenant_id makes the reward once-only even if the
-- activation is reported twice). A row is 'available' until it's put
-- towards a payment: 'scheduled' when attached to a Paddle renewal as a
-- one-time discount, 'used' once that payment (or a checkout) is made.
CREATE TABLE account_credits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount              NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  source              TEXT NOT NULL DEFAULT 'referral',
  referred_tenant_id  UUID UNIQUE REFERENCES tenants(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'available', -- available | scheduled | used
  paddle_discount_id  TEXT,
  used_on_subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at             TIMESTAMPTZ
);
CREATE INDEX idx_account_credits_tenant ON account_credits(tenant_id);
-- A business gets at most one welcome discount.
CREATE UNIQUE INDEX idx_account_credits_one_welcome ON account_credits(tenant_id) WHERE source = 'welcome';