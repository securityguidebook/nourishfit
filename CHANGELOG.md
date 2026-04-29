NourishFit Changelog

v1.0.0 — HealthKit, GPS Running, Capacitor & 7 Feature Improvements (current)

Native Health Integration
  Capacitor setup (capacitor.config.ts, appId: com.nourishfit.app) — enables iOS/Android native builds
  Apple HealthKit / Health Connect read sync via @capgo/capacitor-health: steps, active calories,
    heart rate, heart rate average, sleep (noon-to-noon window), distance
  Apple HealthKit write sync: completed GPS runs written back to Fitness app as workout + distance + calories
  HealthKit card appears on Dashboard only when running in a native Capacitor build (not PWA)
  Sync button with last-synced time; sleep auto-imported if no manual entry exists for that day

GPS Run Tracker (Strava-style)
  Three-screen flow: GPS lock → active run → post-run summary
  Live Leaflet map (OpenStreetMap, no API key) with green route trail drawn as the run progresses
  Real-time stats: distance (km or mi based on profile unit), current pace, elapsed time, elevation gain
  Haversine distance formula; GPS samples every 5 seconds to keep route array small
  Pause/Resume without ending the run
  Post-run summary: distance, time, avg pace, calories (MET × weight × distance), elevation, editable run name
  Save Run logs to workout history and writes back to Apple Health (if available)
  Share button on post-run summary (native share sheet or clipboard fallback)
  "🏃 Run" button in Workout tab header

Push Notification Reminders (Item 1)
  Custom service worker (src/sw.js) using injectManifest strategy — handles push events, tap-to-open,
    and in-app SCHEDULE_NOTIFICATION messages so notifications appear in system tray when tab is backgrounded
  src/lib/notifications.js: isSupported, getPermission, requestPermission, scheduleForToday, scheduleAll
  Profile → Notifications section: per-reminder toggles and time pickers for supplement, water, and meal reminders
  Permissions flow: unsupported / blocked / prompt / granted states all handled with clear messaging
  Timers re-scheduled on app open and whenever preferences change; cleaned up on unmount

Body Weight Log + Trend Chart (Item 2)
  Dashboard weight card below the 4-stat grid
  Log daily weight via LogWeightModal (large number input, date picker, supports backdating)
  SVG polyline sparkline with gradient fill — green when trending down, red when trending up
  Card shows latest weight, delta from previous entry, and total change across visible entries
  Stored in nf_weight_log (YYYY-MM-DD → number), persisted to localStorage

Food Database Search (Item 3)
  "🔍 Search" button in Nutrition → Today header (alongside Manual and Scan)
  Searches Open Food Facts (3M+ products, free, no API key) with 450ms debounce
  Results show product name, brand, macros per 100g in colour-coded chips
  Portion screen: gram input pre-filled with product serving size; live macro preview updates as you type
  Logs meal identically to Manual and Scan entries; syncs to Supabase

Personal Records Tracking (Item 4)
  Epley 1RM formula (weight × (1 + reps/30)) applied to every completed set on session finish
  New PR auto-detected and stored; yellow toast banner names the exercise(s) for 4 seconds
  Personal Records section at the bottom of the Workout tab, sorted by most recently set
  Each PR card: exercise name, estimated 1RM, best set (weight × reps), date, PRSparkline history chart
  AddPRModal for manual entry: bodyweight exercises, backdating, live 1RM preview
  Stored in nf_prs; delete any record with ✕

Weekly Summary Card (Item 5)
  Collapsible "Week in Review" card on Dashboard (rolling 7-day window)
  7-day activity strip: green bar = workout logged that day, grey = rest
  Workout stats: sessions, total active minutes, total kcal burned
  Nutrition row: avg daily calories vs goal, days logged out of 7
  Wellness row: avg sleep hours, days water goal met, supplement adherence %
  Grid auto-adjusts to 2 or 3 columns based on data available

Data Export (CSV) (Item 6)
  Profile → Export Data section with 5 download buttons
  Meals CSV: date, time, name, calories, protein, carbs, fat
  Workouts CSV: date, session, type, duration, est. calories, exercise, sets (one row per exercise)
  Health Metrics CSV: one row per date with weight, water, sleep hours, sleep quality
  Supplements CSV: supplement × date grid (last 30 days), 1 = taken / 0 = not
  Personal Records CSV: exercise, best 1RM, best weight, best reps, date
  Buttons greyed out with "No data" label when the category is empty
  All exports client-side — nothing leaves the device

Share a Workout (Item 7)
  Web Share API on mobile (native share sheet: WhatsApp, Instagram, Messages, etc.)
  Clipboard fallback on desktop with "✓ Copied to clipboard!" toast
  Three entry points: workout history card (↗ icon), session-complete summary, run-complete summary
  Strength format: session name, duration, calories, sets, exercise list with reps×weight
  Run format: distance, time, avg pace, elevation gain, calories

Bug Fixes & Timezone Fixes
  Supplements and water tracking date keys now use local time (localDateKey helper) instead of
    toISOString() which was returning UTC dates and causing 1-day rollback in some timezones
  Water log random reset fixed: addWater uses functional setState to avoid stale closure;
    Supabase sync uses Math.max(local, remote) for today to prevent cloud overwrites
  Profile location field added (city/country text input); synced to Supabase profiles table

v0.9.5 — Hybrid Navigation, Guided Tour & UX Polish

Navigation
  Bottom nav bar: Home · Track · Coach · Progress · Wellbeing (replaces 8-tab bottom row)
  Track group: Nutrition + Workout — tapping always opens last-used sub-tab
  Wellbeing group: Health + Supplements — same last-used memory, persisted to localStorage
  Header pill: visible only inside group tabs, opens a dropdown to switch between sub-options
  Pill dropdown: animated chevron, current tab ticked, closes on outside tap
  Full nav sheet removed — bottom nav covers all destinations

Coach — Guided Renovation Tour
  Interactive 8-step induction for existing users on next open after update
  Coach navigates the app for users — each step switches to the relevant tab automatically
  Pulsing accent glow highlights the specific UI element being explained each step
  Steps cover: bottom nav, pill switcher, Nutrition History/Trends, Workout cards, Recovery, Supplements, Profile Help
  Progress bar, Back button, and Skip tour option throughout
  Stored as nf_renovated_v093 — never shown again once completed or skipped
  New users see original onboarding only; renovation tour never shown to first-time users

Recovery
  Qualitative model replaces arbitrary percentage: Rest · Low · Moderate · Good · Optimal
  Multi-factor score: time since last workout (base) + sleep hours/quality + training load
  Matches smartwatch-style readiness language

Supplements
  Rolling 7-day history strip (day-of-week labels, Mon–Sun relative to today)
  Dose counting: tap once to log, tap again to add (protein shake twice = 2 doses)
  Backward-compatible with existing boolean history entries

Workout Sessions
  History cards now collapse — tap any session to expand exercise detail
  Delete individual sets mid-session (✕ on uncompleted sets only)

iOS / Viewport
  Prevented accidental zoom on tab switch (user-scalable=no, overflow-x hidden)
  Bottom content no longer clipped on iPhone

v0.9.3 — Meals & Water Sync + History & Trends

Meals & Water — Supabase Sync
  Meals are now synced to Supabase on add and delete; loaded from cloud on sign-in
  Water log is synced to Supabase on add and reset; loaded from cloud on sign-in
  Existing localStorage meals backfilled with today's date on first run
  Meal delete button added to both Today and History views

Nutrition — History Tab
  New "History" sub-tab groups all past meals by date
  Each day shows: calorie total, water intake, calorie + water progress bars
  Full meal list per day with macros and delete option

Nutrition — Trends Tab
  New "Trends" sub-tab with 7-day analytics
  Summary stats: avg daily calories, avg water, days on calorie target, days on hydration target
  Bar chart: calories per day vs goal (colour-coded: green = on target, yellow = under, red = over)
  Bar chart: water intake per day vs goal
  Macro breakdown card: 7-day average protein/carbs/fat vs targets + stacked % bar

Today Tab
  Today's meals now correctly filtered to today only (history kept in separate tab)
  Dashboard "Today's Meals" widget also filtered to today

v0.9.1 — Auth, UX Polish & Deployment

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
