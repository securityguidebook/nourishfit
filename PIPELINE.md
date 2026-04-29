NourishFit — Project Pipeline

✅ Shipped

v0.1.0  Foundation — Dashboard, Nutrition (AI scanner), Workout, dark theme
v0.2.0  Health & Recovery tab — injury logging, sleep/recovery cards
v0.3.0  Supplements tab — dose tracking, heatmap, streak, category filter
v0.4.0  AI Coach tab — form cues, training split, chat interface
v0.5.0  Profile page, Mifflin-St Jeor calorie targets, dynamic macros
v0.6.0  Active Workout Session — live timer, rest countdown, empty states
v0.7.0  Injury progression log, supplement history + streak, weekly routine
v0.8.0  Routine templates, session start prompt, set-level checkboxes
v0.9.0  PWA, progress photos, water tracking, onboarding, light mode foundation
v0.9.1  Supabase auth screen, light mode default, iOS scroll fix, deployment
v0.9.2  Supabase profile sync — load on sign-in, upsert on save
v0.9.3  Supabase meals & water sync; Nutrition History + Trends tabs
v0.9.5  Hybrid bottom nav, guided renovation tour, recovery model, supplement dose counting
v1.0.0  Capacitor native build, Apple HealthKit/Health Connect sync, GPS Run Tracker,
        push notification reminders, body weight log + trend chart, food database search
        (Open Food Facts), personal records tracking, weekly summary card,
        data export (CSV), share a workout — timezone bug fixes


🔧 In Progress / Up Next

v1.1.0 — Supabase Sync Phase 3: Workouts, Supplements & Routines
  Workouts → Supabase workouts table (currently localStorage only)
  Supplements + history → Supabase supplements table
  Weekly routine + templates → Supabase routines table
  Weight log → Supabase (new column or separate table)

v1.2.0 — Progress Photos: Supabase Storage
  Create progress-photos Storage bucket (private, RLS by user_id)
  Update savePhoto / loadPhoto in src/db.js to upload/download from Supabase Storage
  Metadata (date, notes) → Supabase progress_photos table
  IndexedDB kept as local cache after download


📋 Backlog (priority order)

v1.3.0 — Meal Management
  Edit individual logged meals (currently add/delete only)
  Favourite meals / quick re-log from history
  Calorie budget rollover display

v1.4.0 — Sleep Logging
  Daily sleep log with hours + quality (Poor / Fair / Good / Great)
  Sleep history chart
  Recovery score incorporates sleep quality + workout load (beyond current model)

v1.5.0 — Analytics Dashboard
  Workout frequency heatmap calendar
  Macro hit-rate trend (rolling 30 days)
  Calorie adherence bar chart (beyond 7-day weekly card)
  Streak tracking across all habits (workouts, water, supplements, logging)

v1.6.0 — Coach AI with Memory
  References past sessions, PRs, and trends in conversation
  Proactive suggestions based on training load and nutrition gaps
  Workout plan builder with progressive overload tracking


💡 Future Ideas (not scheduled)
  Barcode scanner for packaged food macros (supplement to Open Food Facts search)
  Meal plan templates (bulk week, cut week)
  Apple Watch companion app
  Share progress card (screenshot-friendly visual summary)
  Multi-language support
  Wearable heart rate zone training
