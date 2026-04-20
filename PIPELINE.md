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
v0.9.1  Supabase auth screen, light mode default, iOS scroll fix, no-zoom inputs, deployment


🔧 In Progress / Up Next

v0.9.2 — Supabase Data Sync (Phase 1: Profile)
  On sign-in: load profile from Supabase profiles table
  On profile save: upsert to Supabase
  Merge strategy: Supabase is source of truth, localStorage as local cache
  Show sync indicator in Profile header

v0.9.3 — Supabase Data Sync (Phase 2: Meals & Water)
  Migrate meals from localStorage to Supabase meals table
  Migrate water_log to Supabase water_log table
  Real-time sync — changes reflected across devices

v0.9.4 — Supabase Data Sync (Phase 3: Workouts, Supplements, Routines)
  Workouts → Supabase workouts table
  Supplements + history → Supabase supplements table
  Weekly routine + templates → Supabase routines table

v0.9.5 — Progress Photos: Supabase Storage
  Create progress-photos Storage bucket (private, RLS by user_id)
  Update savePhoto / loadPhoto in src/db.js to upload/download from Supabase Storage
  Metadata (date, weight, notes) → Supabase progress_photos table
  IndexedDB used only as local cache after download


📋 Backlog (priority order)

v1.0.0 — Weight Tracking
  Daily weight log from Profile page
  Weight trend chart (last 30 / 90 days)
  Starting weight vs current comparison
  BMI trend over time

v1.1.0 — Meal Management
  Edit and delete individual logged meals
  Meal history by date (not just today)
  Favourite meals / quick re-log
  Calorie budget rollover display

v1.2.0 — Analytics Dashboard
  Weekly calorie adherence chart
  Macro hit-rate trend
  Workout frequency chart (heatmap calendar)
  Personal records per exercise (heaviest lift)
  Streak tracking: workouts, water, supplements, logging

v1.3.0 — Sleep Logging
  Daily sleep log with hours + quality (Poor / Fair / Good / Great)
  Sleep history chart
  Recovery score incorporates sleep quality + workout load
  Placeholder for future Apple Health sync

v1.4.0 — Notifications & Reminders
  Water reminder if under goal by 6pm
  Supplement reminder at configured timing (Morning / Evening)
  Workout reminder on planned routine days
  Web Push API via Supabase Edge Functions


💡 Future Ideas (not scheduled)
  Apple Health sync (sleep, steps, heart rate, workouts)
  Barcode scanner for packaged food macros
  Meal plan templates (bulk week, cut week)
  Workout plan builder with progressive overload tracking
  Share progress card (screenshot-friendly summary)
  Coach AI with memory (references past sessions and trends)
  Multi-language support
  Wearable integration (Apple Watch companion)
