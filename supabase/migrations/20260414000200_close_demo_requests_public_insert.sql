-- ==========================================================================
-- BPS — Close direct public insert path for demo_requests
-- ==========================================================================
-- Public demo request submissions now go through the server-side
-- Route Handler (/api/demo-request) which uses service role.
-- The anon and authenticated insert policies are no longer needed.
-- ==========================================================================

DROP POLICY IF EXISTS demo_requests_public_insert ON demo_requests;
DROP POLICY IF EXISTS demo_requests_auth_insert ON demo_requests;

-- Revoke anon insert grant
REVOKE INSERT ON demo_requests FROM anon;
