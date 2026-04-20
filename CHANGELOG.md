NourishFit Changelog

v0.9.1 — Auth, UX Polish & Deployment (current)

Supabase Auth
  Sign in / Sign up screen shown to unauthenticated users before the app loads
  Toggle between Sign In and Sign Up with animated tab selector
  Email confirmation flow — user is informed to check their inbox, then redirected back to the live app
  emailRedirectTo uses window.location.origin so confirmation links always point to the deployed URL, not localhost
  Session state managed via supabase.auth.getSession + onAuthStateChange
  Sign Out button in Profile tab
  Auth gate placed after all React hooks to comply with Rules of Hooks
  Local-only mode still works when Supabase env vars are absent

Light Mode & Theme
  Default theme is now light (previously forced dark)
  System preference (prefers-color-scheme) respected on first launch
  iOS system colours used for light palette (backgrounds, text, accents)
  Toggle in Profile tab switches between light and dark
  Body background synced at paint time via inline script — no overscroll flash on iOS
  Dual theme-color meta tags for browser chrome to match light/dark mode

iOS UX Fixes
  All inputs, textareas and selects forced to font-size: 16px — prevents iOS auto-zoom on tap
  Removed height:100% from html/body/#root — was clipping scrollable content on iOS Safari
  Main wrapper paddingBottom increased to calc(110px + env(safe-area-inset-bottom, 0px)) for reliable nav clearance
  Removed fixed minHeight constraint from tab content wrapper
  Greeting emoji removed — cleaner, more professional header

Rogue UI Removal
  "Data" card with red Reset border was rendering on every tab — removed from global layout
  Reset Local Data button moved inside Profile tab with subtle neutral styling

Cloudflare Deployment
  public/_redirects added (/* /index.html 200) for SPA routing
  .gitignore covers .env, .env.local, dist, node_modules
  .env.example template committed for onboarding contributors
  Supabase URL and anon key set as Cloudflare Pages environment variables

v0.9.0 — PWA, Progress Photos, Water Tracking, Onboarding & Light Mode Foundation

PWA
  vite-plugin-pwa with Workbox service worker and autoUpdate strategy
  Full web app manifest (name, display: standalone, orientation: portrait-primary)
  Icon set: 64×64, 192×192, 512×512, maskable 512×512, apple-touch-icon 180×180, favicon.ico
  viewport-fit=cover, apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style: black-translucent
  Safe area insets applied to header (top), bottom nav, and modals (bottom)
  100dvh used throughout instead of 100vh
  Installable on iPhone via Safari → Add to Home Screen

Progress Photos (Calendar View)
  Dedicated ◫ Progress tab with monthly calendar
  Each day shows a dot indicator if photos were taken that day
  Tap any date to view, add or delete that day's photos (maximum 5 per day)
  Photos stored as blobs in IndexedDB via src/db.js (savePhoto / loadPhoto / deletePhoto)
  Client-side compression via browser-image-compression — max 200KB, max 1080px before storage
  Side-by-side date comparison: select two dates and view photos full-screen split

Water Tracking
  WaterCard component in Nutrition tab
  Daily ml log keyed by date (localStorage)
  Quick-add buttons: +250ml, +500ml, +750ml, +1L, custom
  Circular progress ring with percentage and ml display
  Daily goal configurable in Profile (default 2500ml)
  Water stat on Dashboard home card

Guided Onboarding
  6-step Coach-voiced modal on first launch: "Hey, Coach here…"
  Steps cover Nutrition, Training, Coach AI, Progress Photos, Profile
  Skippable at any step
  Progress dots navigation (tap to go back)
  Stored in localStorage (nf_onboarded) so it only shows once
  Re-accessible via ? button in header or "View App Tutorial" in Profile

Time-of-Day Greeting
  "Good morning / Good afternoon / Good evening / Late night grind"
  Replaces static "Good morning" — correct regardless of when app is opened
  Emoji removed from greeting (cleaner header)

Health Tab — Dynamic Values
  Sleep: reads from daily sleep log, no hardcoded 7.5h
  Recovery: calculated from workout timestamp (id = Date.now()), no hardcoded 78%
  Recovery tiers: Active recovery / Still recovering / Ready to train / Fully recovered / Peak readiness
  Sleep quality colours use function pattern (() => COLORS.X) so they resolve at render time per theme

Supabase Foundation
  src/lib/supabase.js — client with null-safety (graceful when env vars missing)
  supabase/schema.sql — full RLS schema: profiles (auto-created on signup trigger), meals, workouts, injuries, supplements, routines, water_log, sleep_log, progress_photos
  Storage bucket instructions for progress-photos/{user_id}/{id}.jpg

v0.8.0 — Routine Templates, Smart Session Start & Set Checkboxes

  Save any day's exercise plan as a named reusable template
  Session Start Prompt when today has a planned routine
  Set-level checkboxes with sequential unlocking and auto-rest timer
  Collapsed exercise summary after all sets complete
  Session delete with confirmation

v0.7.0 — Injury Tracking, Supplement History & Weekly Routine

  Injury progression log with timeline history
  Supplement dose tracking with 7-day strip and streak counter
  Weekly Routine Planner (Mon–Sun grid)
  Today's Plan banner on Dashboard

v0.6.0 — Active Workout Session & Live Timers

  Full ActiveWorkoutSession flow (Setup → Active → Finish)
  Live stopwatch, rest timer with progress bar, Skip and +30s controls
  MET-based calorie estimation using profile body weight
  Quick Log modal for cardio entries
  All demo data removed — clean empty states

v0.5.0 — Profile, Smart Macros & Exercise Logger

  Profile page: name, age, gender, weight, height, goal, activity level, cheat days
  BMI calculated and colour-coded
  Mifflin-St Jeor BMR → TDEE → calorie goal (no more hardcoded 2400 kcal)
  Dynamic macro targets (30/40/30 split)
  Weekly Flexible Budget panel with cheat day calories
  Exercise logger with per-set reps × weight tracking

v0.4.0 — AI Coach Tab

  AI chat with exercise form cues and training split recommendations
  Quick-start prompt tiles
  Log exercise to workout history from Coach

v0.3.0 — Supplements Tab

  Add / edit / delete supplements with emoji + colour picker
  28-day consistency heatmap, streak counter, daily check-off
  Category filter, Today's Stack progress bar

v0.2.0 — Health & Recovery Tab

  Injury logging with body area, severity, status, notes
  Sleep and recovery overview cards

v0.1.0 — Foundation

  Dashboard, Nutrition (AI photo scanner), Workout tab
  Calorie bar, macro rings, stats row
  Dark theme, Space Mono / DM Sans typography
