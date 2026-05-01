-- VitalCenter — Supabase Schema
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- ─── Profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id              UUID    REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name            TEXT,
  age             INTEGER,
  gender          TEXT    DEFAULT 'male',
  weight          DECIMAL,
  weight_unit     TEXT    DEFAULT 'kg',
  height          DECIMAL,
  height_unit     TEXT    DEFAULT 'cm',
  goal            TEXT    DEFAULT 'maintain',
  activity_level  TEXT    DEFAULT 'moderate',
  cheat_days      INTEGER DEFAULT 1,
  water_goal      INTEGER DEFAULT 2500,
  location        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Meals ────────────────────────────────────────────────────────────────────
CREATE TABLE public.meals (
  id          BIGINT      PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT        NOT NULL,
  time        TEXT,
  calories    INTEGER     DEFAULT 0,
  protein     DECIMAL     DEFAULT 0,
  carbs       DECIMAL     DEFAULT 0,
  fat         DECIMAL     DEFAULT 0,
  img         TEXT        DEFAULT '🍽️',
  logged_date DATE        DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meals" ON public.meals FOR ALL USING (auth.uid() = user_id);

-- ─── Workouts ─────────────────────────────────────────────────────────────────
CREATE TABLE public.workouts (
  id          BIGINT      PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type        TEXT        DEFAULT 'Strength',
  name        TEXT,
  duration    INTEGER,
  calories    INTEGER,
  sets        INTEGER,
  date        TEXT,
  exercises   JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workouts" ON public.workouts FOR ALL USING (auth.uid() = user_id);

-- ─── Injuries ─────────────────────────────────────────────────────────────────
CREATE TABLE public.injuries (
  id          BIGINT      PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  area        TEXT        NOT NULL,
  severity    TEXT,
  status      TEXT        DEFAULT 'new',
  note        TEXT,
  date        TEXT,
  log         JSONB       DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.injuries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own injuries" ON public.injuries FOR ALL USING (auth.uid() = user_id);

-- ─── Supplements ──────────────────────────────────────────────────────────────
CREATE TABLE public.supplements (
  id          BIGINT      PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT        NOT NULL,
  emoji       TEXT        DEFAULT '💊',
  dose        TEXT,
  timing      TEXT,
  category    TEXT,
  color       TEXT,
  benefit     TEXT,
  history     JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own supplements" ON public.supplements FOR ALL USING (auth.uid() = user_id);

-- ─── Weekly Routine ───────────────────────────────────────────────────────────
CREATE TABLE public.routines (
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  plan        JSONB       DEFAULT '{}',
  templates   JSONB       DEFAULT '[]',
  checks      JSONB       DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own routines" ON public.routines FOR ALL USING (auth.uid() = user_id);

-- ─── Water Log ────────────────────────────────────────────────────────────────
CREATE TABLE public.water_log (
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date        DATE        NOT NULL,
  ml          INTEGER     DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
ALTER TABLE public.water_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own water" ON public.water_log FOR ALL USING (auth.uid() = user_id);

-- ─── Sleep Log ────────────────────────────────────────────────────────────────
CREATE TABLE public.sleep_log (
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date        DATE        NOT NULL,
  hours       DECIMAL     NOT NULL,
  quality     TEXT        DEFAULT 'good',
  PRIMARY KEY (user_id, date)
);
ALTER TABLE public.sleep_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sleep" ON public.sleep_log FOR ALL USING (auth.uid() = user_id);

-- ─── Progress Photos ──────────────────────────────────────────────────────────
-- Blobs go in Supabase Storage bucket "progress-photos/{user_id}/{id}.jpg"
-- This table stores metadata only
CREATE TABLE public.progress_photos (
  id          TEXT        PRIMARY KEY,   -- same id used as Storage filename
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date        DATE        NOT NULL,
  date_str    TEXT,
  weight      DECIMAL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own photos" ON public.progress_photos FOR ALL USING (auth.uid() = user_id);

-- ─── Weight Log ──────────────────────────────────────────────────────────────
CREATE TABLE public.weight_log (
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date        DATE        NOT NULL,
  weight      DECIMAL     NOT NULL,
  PRIMARY KEY (user_id, date)
);
ALTER TABLE public.weight_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own weight" ON public.weight_log FOR ALL USING (auth.uid() = user_id);

-- ─── Migration: add location to existing profiles table ──────────────────────
-- Run this if the profiles table already exists:
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;

-- ─── Migration: Workout Routines Feature ─────────────────────────────────────
-- Run these in Supabase SQL Editor if the routines table already exists:
-- ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS saved_routines JSONB DEFAULT '[]';
-- ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS prs JSONB DEFAULT '{}';

-- ─── Migration: Weight Log (new table for existing DBs) ──────────────────────
-- Run this in Supabase SQL Editor if the DB already exists:
-- CREATE TABLE IF NOT EXISTS public.weight_log (
--   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
--   date DATE NOT NULL, weight DECIMAL NOT NULL, PRIMARY KEY (user_id, date)
-- );
-- ALTER TABLE public.weight_log ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "own weight" ON public.weight_log FOR ALL USING (auth.uid() = user_id);

-- ─── Storage bucket for progress photos ───────────────────────────────────────
-- Run this separately or via the Supabase dashboard:
-- Storage → New bucket → Name: "progress-photos" → Private
-- Then add this policy in Storage → progress-photos → Policies:
--   INSERT: (auth.uid()::text = (storage.foldername(name))[1])
--   SELECT: (auth.uid()::text = (storage.foldername(name))[1])
--   DELETE: (auth.uid()::text = (storage.foldername(name))[1])
