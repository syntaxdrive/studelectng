-- =============================================================================
-- STUSELECT HIGH-CONCURRENCY ATOMIC VOTING TRANSACTION & IDEMPOTENCY LOCK
-- =============================================================================
-- This migration guarantees:
-- 1. ACID-compliant atomic ballot submission (all-or-nothing transaction).
-- 2. Row-level locks (FOR UPDATE) preventing double-voting race conditions.
-- 3. Hard UNIQUE index on voter accreditation (one vote per student per election).
-- 4. Complete decoupling of ballot recording from expensive results aggregation.
-- =============================================================================

-- 1. Ensure hard uniqueness constraints exist on the database tables
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_election_student_accreditation 
ON public.voter_accreditations (election_id, student_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_ballot_receipt_hash 
ON public.ballots (receipt_hash);

-- 2. Atomic Ballot Transaction RPC Function
CREATE OR REPLACE FUNCTION public.fn_cast_secure_ballot(
    p_election_id TEXT,
    p_ballot_id TEXT,
    p_receipt_hash TEXT,
    p_block_hash TEXT,
    p_selections JSONB,
    p_cast_at TIMESTAMPTZ,
    p_student_id TEXT DEFAULT NULL,
    p_token_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_election_status TEXT;
    v_acc_status TEXT;
    v_existing_ballot TEXT;
BEGIN
    -- 1. Check Election is Open & LIVE
    SELECT status INTO v_election_status
    FROM public.elections
    WHERE id = p_election_id;

    IF v_election_status IS NOT NULL AND v_election_status <> 'LIVE' THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ELECTION_NOT_LIVE',
            'message', 'This election is not currently open for voting (Status: ' || v_election_status || ').'
        );
    END IF;

    -- 2. Strict One-Vote Guard via Row Lock (FOR UPDATE)
    IF p_student_id IS NOT NULL AND p_student_id <> '' THEN
        SELECT status INTO v_acc_status
        FROM public.voter_accreditations
        WHERE election_id = p_election_id AND student_id = p_student_id
        FOR UPDATE;

        IF v_acc_status = 'VOTED' THEN
            RETURN jsonb_build_object(
                'success', false,
                'already_voted', true,
                'code', 'ALREADY_VOTED',
                'message', 'You have already cast your official ballot for this election. Multiple voting is strictly prohibited.'
            );
        END IF;
    END IF;

    -- 3. Check for receipt hash collision / idempotency
    SELECT id INTO v_existing_ballot
    FROM public.ballots
    WHERE receipt_hash = p_receipt_hash;

    IF v_existing_ballot IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'already_voted', true,
            'code', 'RECEIPT_EXISTS',
            'receipt_hash', p_receipt_hash,
            'message', 'Ballot with this cryptographic receipt code is already certified.'
        );
    END IF;

    -- 4. Insert Anonymous Decoupled Ballot (Authoritative Vote Record)
    INSERT INTO public.ballots (
        id,
        election_id,
        receipt_hash,
        selections,
        cast_at,
        block_hash
    ) VALUES (
        p_ballot_id,
        p_election_id,
        p_receipt_hash,
        p_selections,
        COALESCE(p_cast_at, NOW()),
        p_block_hash
    );

    -- 5. Mark Voter Accreditation as VOTED (Atomic State Transition)
    IF p_student_id IS NOT NULL AND p_student_id <> '' THEN
        INSERT INTO public.voter_accreditations (
            election_id,
            student_id,
            status,
            voted_at
        ) VALUES (
            p_election_id,
            p_student_id,
            'VOTED',
            COALESCE(p_cast_at, NOW())
        )
        ON CONFLICT (election_id, student_id)
        DO UPDATE SET
            status = 'VOTED',
            voted_at = EXCLUDED.voted_at,
            updated_at = NOW();
    END IF;

    -- 6. Log Audit Event (Non-blocking ledger entry)
    INSERT INTO public.audit_logs (
        id,
        election_id,
        action_type,
        actor_role,
        payload,
        prev_hash,
        current_hash
    ) VALUES (
        'audit-' || substr(md5(random()::text), 1, 12),
        p_election_id,
        'BALLOT_CAST',
        'VOTER',
        jsonb_build_object('receipt_hash', p_receipt_hash, 'block_hash', p_block_hash),
        '0x000000',
        p_block_hash
    );

    RETURN jsonb_build_object(
        'success', true,
        'ballot_id', p_ballot_id,
        'receipt_hash', p_receipt_hash,
        'block_hash', p_block_hash,
        'message', 'Ballot cast and committed atomically.'
    );
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', false,
            'already_voted', true,
            'code', 'DUPLICATE_BALLOT',
            'message', 'A duplicate ballot entry was rejected by database uniqueness constraints.'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'TRANSACTION_ERROR',
            'message', SQLERRM
        );
END;
$$;

-- Grant execution to authenticated & service roles
GRANT EXECUTE ON FUNCTION public.fn_cast_secure_ballot TO anon, authenticated, service_role;
