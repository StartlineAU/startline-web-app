-- ============================================================
-- StartLine: Supabase schema setup (reference / optional migrations)
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Profiles table (legacy: auth0_sub column name retained for existing DBs)
CREATE TABLE IF NOT EXISTS profiles (
  auth0_sub TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'organiser')),
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Saved events (bookmarks)
CREATE TABLE IF NOT EXISTS saved_events (
  auth0_sub TEXT NOT NULL,
  event_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (auth0_sub, event_id)
);

-- 3. Event registrations (interest / RSVP)
CREATE TABLE IF NOT EXISTS event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth0_sub TEXT NOT NULL,
  event_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auth0_sub, event_id)
);

-- 4. Add organiser + approval columns to existing events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS organiser_sub TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected'));

-- ============================================================
-- Row Level Security
-- ============================================================

-- Profiles: service role has full access; anon can read
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on profiles"
  ON profiles FOR ALL
  USING (true)
  WITH CHECK (true);

-- Saved events
ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on saved_events"
  ON saved_events FOR ALL
  USING (true)
  WITH CHECK (true);

-- Event registrations
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on event_registrations"
  ON event_registrations FOR ALL
  USING (true)
  WITH CHECK (true);
