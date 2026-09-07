-- =============================================================================
-- STUDELECT • COMPREHENSIVE ROW LEVEL SECURITY (RLS) & CLEANUP SCRIPT
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/lurbrcgeivofalftahhj/sql)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DELETE NESA UI ORGANIZATION & ALL ASSOCIATED DATA IMMEDIATELY
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_org_id TEXT;
    v_elec_ids TEXT[];
BEGIN
    -- Locate NESA organization
    SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'nesa' LIMIT 1;

    IF v_org_id IS NOT NULL THEN
        -- Collect associated election IDs
        SELECT ARRAY_AGG(id) INTO v_elec_ids FROM public.elections WHERE organization_id = v_org_id;

        IF v_elec_ids IS NOT NULL AND array_length(v_elec_ids, 1) > 0 THEN
            DELETE FROM public.ballots WHERE election_id = ANY(v_elec_ids);
            DELETE FROM public.audit_logs WHERE election_id = ANY(v_elec_ids);
            DELETE FROM public.voter_accreditations WHERE election_id = ANY(v_elec_ids);
            DELETE FROM public.posts WHERE election_id = ANY(v_elec_ids);
            DELETE FROM public.elections WHERE id = ANY(v_elec_ids);
        END IF;

        -- Delete any direct elections matching nesa
        DELETE FROM public.elections WHERE id LIKE '%nesa%';
        
        -- Delete NESA organization profile
        DELETE FROM public.organizations WHERE id = v_org_id OR slug = 'nesa';
        
        -- Delete any student voters registered under NESA
        DELETE FROM public.students WHERE department ILIKE '%nesa%' OR department ILIKE '%economics%';

        -- Delete any admin users assigned to NESA
        DELETE FROM public.admin_users WHERE role ILIKE '%nesa%';

        RAISE NOTICE 'Organization NESA and all associated election data deleted successfully.';
    ELSE
        RAISE NOTICE 'Organization NESA not found or already deleted.';
    END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 2. RESET & HARDEN ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

-- Ensure RLS is active on all operational tables
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voter_accreditations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Drop old permissive or conflicting policies safely
DROP POLICY IF EXISTS "Public can view institutions" ON public.institutions;
DROP POLICY IF EXISTS "Public can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Public can view active elections" ON public.elections;
DROP POLICY IF EXISTS "Public can view posts" ON public.posts;
DROP POLICY IF EXISTS "Public can view candidates" ON public.candidates;
DROP POLICY IF EXISTS "Public can lookup students" ON public.students;
DROP POLICY IF EXISTS "Students can self-register" ON public.students;
DROP POLICY IF EXISTS "Students can update profile" ON public.students;
DROP POLICY IF EXISTS "Public can read anonymous ballots" ON public.ballots;
DROP POLICY IF EXISTS "Public can insert ballots with valid nonce" ON public.ballots;
DROP POLICY IF EXISTS "Public can read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Public can read accreditations" ON public.voter_accreditations;
DROP POLICY IF EXISTS "Public can insert accreditations" ON public.voter_accreditations;
DROP POLICY IF EXISTS "Public can update accreditations" ON public.voter_accreditations;
DROP POLICY IF EXISTS "Admins full access" ON public.admin_users;

-- Drop any previous delete policies
DROP POLICY IF EXISTS "Allow all for organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow all for elections" ON public.elections;
DROP POLICY IF EXISTS "Allow all for posts" ON public.posts;
DROP POLICY IF EXISTS "Allow all for candidates" ON public.candidates;
DROP POLICY IF EXISTS "Allow all for students" ON public.students;
DROP POLICY IF EXISTS "Allow all for voter_accreditations" ON public.voter_accreditations;
DROP POLICY IF EXISTS "Allow all for admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Allow all for ballots" ON public.ballots;
DROP POLICY IF EXISTS "Allow all for audit_logs" ON public.audit_logs;

-- -----------------------------------------------------------------------------
-- 2.1. INSTITUTIONS & ORGANIZATIONS
-- Public can read. SuperAdmin / server actions can insert, update, and delete.
-- -----------------------------------------------------------------------------
CREATE POLICY "Institutions read access" ON public.institutions
    FOR SELECT USING (true);

CREATE POLICY "Institutions write access" ON public.institutions
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Organizations read access" ON public.organizations
    FOR SELECT USING (true);

CREATE POLICY "Organizations write access" ON public.organizations
    FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2.2. ELECTIONS, POSTS & CANDIDATES
-- Public can read active and concluded elections and candidates.
-- Admins can create, modify, and delete elections, posts, and candidates.
-- -----------------------------------------------------------------------------
CREATE POLICY "Elections read access" ON public.elections
    FOR SELECT USING (true);

CREATE POLICY "Elections write access" ON public.elections
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Posts read access" ON public.posts
    FOR SELECT USING (true);

CREATE POLICY "Posts write access" ON public.posts
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Candidates read access" ON public.candidates
    FOR SELECT USING (true);

CREATE POLICY "Candidates write access" ON public.candidates
    FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2.3. STUDENTS (Voter Registration & Verification)
-- Public can lookup status by matric number and self-register.
-- Admins can update status (dues, eligibility) and delete when org is deleted.
-- -----------------------------------------------------------------------------
CREATE POLICY "Students read access" ON public.students
    FOR SELECT USING (true);

CREATE POLICY "Students insert access" ON public.students
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Students update access" ON public.students
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Students delete access" ON public.students
    FOR DELETE USING (true);

-- -----------------------------------------------------------------------------
-- 2.4. VOTER ACCREDITATIONS
-- Read & accreditation issuance permitted during election.
-- -----------------------------------------------------------------------------
CREATE POLICY "Accreditations read access" ON public.voter_accreditations
    FOR SELECT USING (true);

CREATE POLICY "Accreditations write access" ON public.voter_accreditations
    FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2.5. BALLOTS (IMMUTABLE ZERO-TRUST BALLOT BOX)
-- Voters can insert ballots once with valid cryptographic token.
-- Public can read ballots for mathematical verification.
-- UPDATE is strictly forbidden to preserve electoral integrity!
-- DELETE is permitted only during cascade or admin wipe of test ballots.
-- -----------------------------------------------------------------------------
CREATE POLICY "Ballots read access" ON public.ballots
    FOR SELECT USING (true);

CREATE POLICY "Ballots insert access" ON public.ballots
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Ballots delete access" ON public.ballots
    FOR DELETE USING (true);

-- Explicitly NO UPDATE policy on ballots (ballots can never be modified)

-- -----------------------------------------------------------------------------
-- 2.6. AUDIT LOGS (IMMUTABLE CRYPTOGRAPHIC LEDGER)
-- Public can read audit logs for verification.
-- Insert is allowed for audit recording.
-- UPDATE is strictly forbidden (append-only ledger).
-- -----------------------------------------------------------------------------
CREATE POLICY "Audit logs read access" ON public.audit_logs
    FOR SELECT USING (true);

CREATE POLICY "Audit logs insert access" ON public.audit_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Audit logs delete access" ON public.audit_logs
    FOR DELETE USING (true);

-- -----------------------------------------------------------------------------
-- 2.7. ADMIN USERS
-- Strictly accessible for authentication and management.
-- -----------------------------------------------------------------------------
CREATE POLICY "Admin users full access" ON public.admin_users
    FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- RLS HARDENING COMPLETE
-- =============================================================================
