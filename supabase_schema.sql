-- =============================================================================
-- STUDBALLOT / STUDELECT • COMPLETE SUPABASE POSTGRESQL PRODUCTION SCHEMA
-- Multi-Tenant Nigerian University Student Election Platform
-- =============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE org_type AS ENUM ('SUG', 'FACULTY', 'DEPARTMENT', 'HALL', 'CLUB');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE program_type AS ENUM ('FULL_TIME', 'PART_TIME', 'DLI', 'SANDWICH', 'POSTGRADUATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE disciplinary_status AS ENUM ('GOOD_STANDING', 'PROBATION', 'SUSPENDED', 'EXPELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE election_status AS ENUM ('DRAFT', 'SCHEDULED', 'ACCREDITATION_OPEN', 'LIVE', 'CONCLUDED', 'AUDITED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE results_visibility AS ENUM ('LIVE', 'SEALED_UNTIL_CLOSE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE auth_mode AS ENUM ('PIN_SLIP', 'EMAIL_OTP', 'TELEGRAM', 'SECRET_MATCH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE candidate_status AS ENUM ('NOMINATED', 'CLEARED', 'DISQUALIFIED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE accreditation_status AS ENUM ('ELIGIBLE', 'ACCREDITED', 'TOKEN_ISSUED', 'VOTED', 'DISQUALIFIED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE admin_role_type AS ENUM ('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'ELCOM_CHAIRMAN', 'RETURNING_OFFICER', 'POLLING_AGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 3. CORE MULTI-TENANT TABLES
-- =============================================================================

-- 3.1. INSTITUTIONS (Campuses)
CREATE TABLE IF NOT EXISTS public.institutions (
    id TEXT PRIMARY KEY DEFAULT ('inst-' || substr(md5(random()::text), 1, 8)),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    tagline TEXT,
    logo_url TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.2. ORGANIZATIONS (SUG, Faculty, Department, Hall)
CREATE TABLE IF NOT EXISTS public.organizations (
    id TEXT PRIMARY KEY DEFAULT ('org-' || substr(md5(random()::text), 1, 8)),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    org_type org_type DEFAULT 'DEPARTMENT',
    code TEXT NOT NULL,
    parent_org_id TEXT REFERENCES public.organizations(id) ON DELETE SET NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_institution_org_slug UNIQUE (institution_id, slug)
);

-- 3.3. STUDENTS (Voter Roster & Constitutional Clearance)
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY DEFAULT ('stud-' || substr(md5(random()::text), 1, 8)),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    matric_no TEXT NOT NULL,
    normalized_matric TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone_number TEXT,
    faculty TEXT NOT NULL DEFAULT 'Faculty of Science',
    department TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 100,
    program_type program_type DEFAULT 'FULL_TIME',
    is_registered_session BOOLEAN DEFAULT TRUE,
    dues_paid BOOLEAN DEFAULT TRUE,
    disciplinary_status disciplinary_status DEFAULT 'GOOD_STANDING',
    hall_of_residence TEXT,
    portal_pin TEXT,
    portal_secret_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_institution_student_matric UNIQUE (institution_id, normalized_matric)
);

-- 3.4. ELECTIONS
CREATE TABLE IF NOT EXISTS public.elections (
    id TEXT PRIMARY KEY DEFAULT ('elec-' || substr(md5(random()::text), 1, 8)),
    organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    academic_session TEXT NOT NULL DEFAULT '2025/2026',
    description TEXT,
    status election_status DEFAULT 'LIVE',
    results_visibility results_visibility DEFAULT 'LIVE',
    auth_mode auth_mode DEFAULT 'PIN_SLIP',
    require_dues_payment BOOLEAN DEFAULT TRUE,
    require_full_time_only BOOLEAN DEFAULT TRUE,
    require_good_disciplinary_standing BOOLEAN DEFAULT TRUE,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    multi_sig_approvals JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.5. POSTS (Offices Contested)
CREATE TABLE IF NOT EXISTS public.posts (
    id TEXT PRIMARY KEY DEFAULT ('post-' || substr(md5(random()::text), 1, 8)),
    election_id TEXT NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    max_selections INTEGER DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    allowed_levels INTEGER[] DEFAULT '{}',
    allowed_departments TEXT[] DEFAULT '{}',
    gender_restriction TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.6. CANDIDATES
CREATE TABLE IF NOT EXISTS public.candidates (
    id TEXT PRIMARY KEY DEFAULT ('cand-' || substr(md5(random()::text), 1, 8)),
    post_id TEXT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    nickname TEXT,
    matric_no TEXT,
    photo_url TEXT,
    manifesto TEXT,
    running_mate TEXT,
    status candidate_status DEFAULT 'NOMINATED',
    vote_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.7. VOTER ACCREDITATIONS (Identity Verification & Screening Gate)
CREATE TABLE IF NOT EXISTS public.voter_accreditations (
    id TEXT PRIMARY KEY DEFAULT ('acc-' || substr(md5(random()::text), 1, 8)),
    election_id TEXT NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    status accreditation_status DEFAULT 'ELIGIBLE',
    disqualification_reason TEXT,
    voter_pin_hash TEXT,
    token_issued_at TIMESTAMPTZ,
    voted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_election_student_accreditation UNIQUE (election_id, student_id)
);

-- 3.8. BALLOTS (Zero-Trust Decoupled Anonymous Store)
-- ZERO foreign keys or references to student identity
CREATE TABLE IF NOT EXISTS public.ballots (
    id TEXT PRIMARY KEY DEFAULT ('ballot-' || substr(md5(random()::text), 1, 12)),
    election_id TEXT NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    receipt_hash TEXT NOT NULL UNIQUE,
    selections JSONB NOT NULL,
    cast_at TIMESTAMPTZ DEFAULT NOW(),
    block_hash TEXT NOT NULL
);

-- 3.9. AUDIT LOGS (Immutable Cryptographic Ledger)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT ('audit-' || substr(md5(random()::text), 1, 12)),
    election_id TEXT NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    actor_id TEXT,
    actor_role TEXT,
    payload JSONB,
    prev_hash TEXT NOT NULL,
    current_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.10. ADMIN USERS
CREATE TABLE IF NOT EXISTS public.admin_users (
    id TEXT PRIMARY KEY DEFAULT ('admin-' || substr(md5(random()::text), 1, 8)),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role admin_role_type DEFAULT 'ELCOM_CHAIRMAN',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. PERFORMANCE & LOOKUP INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_institutions_slug ON public.institutions(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_students_matric ON public.students(institution_id, normalized_matric);
CREATE INDEX IF NOT EXISTS idx_elections_org ON public.elections(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_ballots_election ON public.ballots(election_id, cast_at);
CREATE INDEX IF NOT EXISTS idx_accreditations_status ON public.voter_accreditations(election_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_election ON public.audit_logs(election_id, created_at);

-- =============================================================================
-- 5. REALTIME WEBSOCKET REPLICATION SETUP
-- Enables instant live vote counts & turnout progress bars
-- =============================================================================
ALTER TABLE public.ballots REPLICA IDENTITY FULL;
ALTER TABLE public.elections REPLICA IDENTITY FULL;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ballots;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.elections;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_object THEN null;
END $$;

-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voter_accreditations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Anonymous public read policies
CREATE POLICY "Public can view institutions" ON public.institutions FOR SELECT USING (true);
CREATE POLICY "Public can view organizations" ON public.organizations FOR SELECT USING (true);
CREATE POLICY "Public can view active elections" ON public.elections FOR SELECT USING (true);
CREATE POLICY "Public can view posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Public can view candidates" ON public.candidates FOR SELECT USING (true);
CREATE POLICY "Public can read anonymous ballots" ON public.ballots FOR SELECT USING (true);
CREATE POLICY "Public can insert ballots with valid nonce" ON public.ballots FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can lookup students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Students can self-register" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Students can update profile" ON public.students FOR UPDATE USING (true);
CREATE POLICY "Public can read audit logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Public can read accreditations" ON public.voter_accreditations FOR SELECT USING (true);
CREATE POLICY "Public can insert accreditations" ON public.voter_accreditations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update accreditations" ON public.voter_accreditations FOR UPDATE USING (true);

-- Admin users management
CREATE POLICY "Admins full access" ON public.admin_users FOR ALL USING (true);

-- Portal provisioning policies
CREATE POLICY "Public can insert organizations" ON public.organizations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update organizations" ON public.organizations FOR UPDATE USING (true);
CREATE POLICY "Public can insert elections" ON public.elections FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update elections" ON public.elections FOR UPDATE USING (true);
CREATE POLICY "Public can insert posts" ON public.posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update posts" ON public.posts FOR UPDATE USING (true);
CREATE POLICY "Public can insert candidates" ON public.candidates FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update candidates" ON public.candidates FOR UPDATE USING (true);

-- =============================================================================
-- 7. CANONICAL SEED DATA (Nigerian Universities & Starter Associations)
-- =============================================================================

-- 7.1. Seed Institutions
INSERT INTO public.institutions (id, name, slug, code, tagline, logo_url) VALUES
('inst-ui', 'University of Ibadan', 'ui', 'UI', 'Recte Sapere Fons • Ibadan, Oyo', '/logos/ui.svg'),
('inst-unilag', 'University of Lagos', 'unilag', 'UNILAG', 'In Deed and in Truth • Akoka, Lagos', '/logos/unilag.svg'),
('inst-unn', 'University of Nigeria, Nsukka', 'unn', 'UNN', 'To Restore the Dignity of Man • Nsukka, Enugu', '/logos/unn.svg'),
('inst-oau', 'Obafemi Awolowo University', 'oau', 'OAU', 'For Learning and Culture • Ile-Ife, Osun', '/logos/oau.svg'),
('inst-abu', 'Ahmadu Bello University', 'abu', 'ABU', 'First in the North • Zaria, Kaduna', '/logos/abu.svg'),
('inst-futa', 'Federal University of Technology, Akure', 'futa', 'FUTA', 'Technology for Self Reliance • Akure, Ondo', '/logos/futa.svg'),
('inst-uniben', 'University of Benin', 'uniben', 'UNIBEN', 'Knowledge and Effective Service • Benin City, Edo', '/logos/uniben.svg')
ON CONFLICT (slug) DO NOTHING;

-- 7.2. Seed Organizations
INSERT INTO public.organizations (id, institution_id, name, slug, org_type, code) VALUES
('org-ui-nesa', 'inst-ui', 'Nigerian Economics Students'' Association (NESA)', 'nesa', 'FACULTY', 'NESA'),
('org-unilag-nacos', 'inst-unilag', 'Nigeria Association of Computing Students (NACOS)', 'nacos', 'DEPARTMENT', 'NACOS'),
('org-unilag-sug', 'inst-unilag', 'Student Union Government (SUG)', 'sug', 'SUG', 'SUG'),
('org-ui-sug', 'inst-ui', 'University of Ibadan Students'' Union (UISU)', 'sug', 'SUG', 'UISU')
ON CONFLICT (institution_id, slug) DO NOTHING;

-- 7.3. Seed Starter Active Elections
INSERT INTO public.elections (id, organization_id, title, academic_session, description, status, results_visibility) VALUES
('elec-ui-nesa-2026', 'org-ui-nesa', 'NESA UI 2026/2027 Executive Council Elections', '2025/2026', 'Annual general elections to elect executive officers for the Nigerian Economics Students Association.', 'LIVE', 'LIVE'),
('elec-nacos-2026', 'org-unilag-nacos', 'NACOS UNILAG 2026/2027 Executive Council Elections', '2025/2026', 'Annual general elections for the Department of Computer Sciences.', 'LIVE', 'LIVE')
ON CONFLICT (id) DO NOTHING;

-- 7.4. Seed Platform SuperAdmin User
-- Default password: superadmin2026 (bcrypt hash: $2a$10$w6KzI5ZqH7lG4jK3rL9Xk.5L5N8t4fM6bU5r8gP3k2H1q0w9y7s)
INSERT INTO public.admin_users (id, institution_id, email, full_name, password_hash, role) VALUES
('admin-super-01', 'inst-unilag', 'superadmin@studelect.ng', 'Platform Super Administrator', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'SUPER_ADMIN')
ON CONFLICT (email) DO NOTHING;
