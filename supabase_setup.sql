-- Run this in Supabase → SQL Editor, in the SAME shared project as
-- madegood-budget-tracker / moonjuice-budget-tracker / tacgrowth-budget-tracker
-- / drsquatch-budget-tracker (rieakopaagjwbueghsju) — reusing the shared
-- free-tier project rather than setting up a new one.
--
-- Built for Loulou Viemeister's mailer projects (Slack, 2026-09-30/10-01):
-- "i need to be able to separate client and then mailer project, so
-- madegood - bts, madegood - evergreen etc." One tracker spans every client's
-- mailer projects, rather than one tracker per client like the other
-- budget trackers — client + project are just columns on each entry here.
-- No Lumanu/DocuSign/invoice flow and no per-project dollar budget (Emmett's
-- call, 2026-10-01: "No, just log spend") — this is a straightforward
-- expense log with a client ↔ project categorization and a per-client total.

CREATE TABLE mailer_budget_entries (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client      text NOT NULL,   -- e.g. "MadeGood" — must match a key in app.js's CLIENT_PROJECTS
  project     text NOT NULL,   -- e.g. "BTS" — must match one of that client's projects in CLIENT_PROJECTS
  date        date NOT NULL,
  amount      numeric(12, 2) NOT NULL,
  description text,
  created_at  timestamptz DEFAULT now()
);

-- Allow public read/write (no login required — internal tool, same as every other tracker)
ALTER TABLE mailer_budget_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read"   ON mailer_budget_entries FOR SELECT USING (true);
CREATE POLICY "Public insert" ON mailer_budget_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update" ON mailer_budget_entries FOR UPDATE USING (true);
CREATE POLICY "Public delete" ON mailer_budget_entries FOR DELETE USING (true);

-- Only needed if this shared project enforces the newer Data API grants
-- (see moonjuice-budget-tracker/supabase_setup.sql) — skip unless the Data
-- API can't reach the table:
--   grant select on public.mailer_budget_entries to anon;
--   grant select, insert, update, delete on public.mailer_budget_entries to authenticated;
--   grant select, insert, update, delete on public.mailer_budget_entries to service_role;
