-- Adds the 'no_response' request status.
--
-- A volunteer who claims a request but can't reach the recipient marks
-- the request 'no_response' (see STATUS_LABELS in app/volunteer/page.js
-- and /api/requests/status), so Emily can follow up or pull it down.
--
-- Already applied to the live Supabase project; committed here so a
-- fresh project built from schema.sql + migrations matches production.
-- Safe to re-run: 'if not exists' makes it a no-op when present.

alter type request_status add value if not exists 'no_response';
