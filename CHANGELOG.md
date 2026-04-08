NourishFit Changelog
v0.8.0 — Routine Templates, Smart Session Start & Set Checkboxes (current)

Routine Templates

Save any day's exercise plan as a named reusable template
"Templates" button in the day planner modal shows all saved templates
Load a template → pre-fills name, type, and full exercise list instantly
Delete individual templates from the picker
Templates persisted to localStorage under nf_templates

Session Start Prompt

Tapping ▶ Start when today has a planned routine shows a choice sheet
Preview shows day name, type, and all exercises with sets/reps/weight
"Use Today's Routine" → pre-populates all exercises with planned sets
"Start Fresh" → blank session as before
No prompt shown if today has no routine

Set-level Checkboxes with Sequential Unlocking

Each exercise shows individual set rows: Set # · Reps input · Weight input · Checkbox
Only the next undone set's checkbox is active — earlier locked once done, later locked until their turn
Ticking a set → marks complete and starts rest timer automatically
All sets in an exercise done → collapses to compact badge summary (Bench Press S1 8×80kg…)
"Edit" button on collapsed exercise expands it back for adjustments
When last set of last exercise is ticked → "All sets complete!" banner with Keep Going / Finish Session prompt

Session Delete

Each logged workout card now has a ✕ delete button with confirmation

v0.7.0 — Injury Tracking, Supplement History & Weekly Routine

Injury Progression Tracking

Injuries now store a full log array of { date, severity, status, note } entries
"Update" button on each injury card opens UpdateInjuryModal with progression timeline
Timeline shows all logged updates as a scrollable history with status icon + colour coding
New status update form: severity, status (new / worsening / stable / improving / healed), notes
Healed injuries automatically move to a separate "Recovered" section
Mini progression trail (last 5 dots) shown on active injury cards

Supplement Dose Tracking

Replaced checkbox with a 48px ring button — ring fills when taken, shows ✓; empty ring shows "TAKE"
Date-keyed history object { "YYYY-MM-DD": true } persists every dose across months
7-day strip below each supplement card shows last 7 days as coloured dots (taken = supplement colour, missed = dim)
Streak counter: consecutive days taken up to today shown on each card

Weekly Routine Planner

New Weekly Routine section in Workout tab showing Mon–Sun grid
Each day card is tappable — opens RoutineDayModal to set activity name + type (Strength / Cardio / HIIT / Mobility / Rest / Sport)
Days with a routine show name + colour-coded type badge; empty days show "+ Plan"
"Today's Plan" banner on Dashboard highlights today's scheduled activity (if set)
Routine persisted to localStorage under weeklyRoutine key

v0.6.0 — Active Workout Session & Live Timers

Active Workout Session (Hevy-style)

Replaced simple "Log Session" modal with a full ActiveWorkoutSession flow
Three-phase flow: Setup → Active → Finish
Setup phase: session name, rest timer preset (30s / 1m / 90s / 2m / 3m), exercises + sets pre-planned
Active phase: live session stopwatch (mm:ss), per-exercise/set tracking with ✓ checkmark to complete
Rest Timer: full-screen countdown with animated progress bar, Skip and +30s controls
Finish phase: summary card showing duration, estimated calories, exercise count, total sets
Calories auto-estimated using MET 4.5 × body weight (kg) × session hours
Exercises saved inline on workout cards with S# × kg badges
Added "Quick Log" button for cardio/manual entries (duration, calories, distance)

Data & UX Cleanup

Removed all hard-coded demo data — meals, workouts, injuries, supplements all start empty
Added empty states for: Dashboard (workouts, meals), Nutrition (meals), Workout tab
userWeightKg derived from profile for accurate calorie estimates
Workout date now uses real locale date string instead of "Today" / "Yesterday"
Removed separate ExerciseLogModal — exercises are now tracked live within ActiveWorkoutSession

v0.5.0 — Profile, Smart Macros & Exercise Logger
Profile Page

Added ◉ Profile tab to bottom navigation

User info form: name, age, gender, weight (kg/lbs), height (cm/in)

Avatar display with gender icon, BMI calculated and colour-coded (Underweight / Healthy / Overweight / Obese)

Edit/Save/Cancel flow — fields locked until Edit is pressed

Fitness goal selector: Lose Weight (−500 kcal/day), Maintain, Build Muscle (+300 kcal/day)

Activity level selector: Sedentary → Very Active (5 levels)

Cheat days per week picker (0–3)

Calculated Stats card showing BMR, TDEE, and Daily Calorie Target — all derived live from profile inputs

Smart Macro Targets

Removed hardcoded calorieGoal = 2400 — calorie goal now calculated dynamically using Mifflin-St Jeor BMR formula

Macro targets (protein/carbs/fat) calculated as 30/40/30% split of daily calorie goal

MacroRings in Nutrition tab now use dynamic macroTargets.protein/carbs/fat instead of fixed values

New "Daily Targets" card in Nutrition tab showing Calories, Protein, Carbs, Fat with kcal and % breakdown

Weekly Flexible Budget panel: splits weekly budget across normal days and cheat days (at 125% calories)

Goal badge shows Cut 🔥 / Bulk 💪 / Maintain ⚖️

Exercise Logger

New "Exercise Progress" section inside Workout tab

+ Log Exercises for a Session button opens ExerciseLogModal

Session-based logging: name the session (e.g. "Full Body", "Push Day")

Add multiple exercises per session, each with their own sets

Per-set tracking: reps × weight (kg)

+ Add Set and + Add Exercise buttons within modal

Logged sessions display with exercise name, set badges (S1 12×15kg format)

Sample data pre-loaded: Full Body and Upper Body Push sessions with Bicep Curl, Bench Press, Shoulder Press

Header avatar/profile icon tappable — shortcuts directly to Profile tab

v0.4.0 — AI Coach Tab
Added ✦ Coach tab to bottom navigation

AI exercise search with form cues, common mistakes, beginner explanations

Smart training split recommendation based on logged weekly session count (Full Body / Upper Lower / PPL) with expandable science reasoning

Quick-start prompt tiles: Romanian Deadlift, Push-up form, Running posture, Hip flexor stretch, Pull-up progression, Squat technique

Log exercise directly to Workout history from Coach chat

"Add to Routine" follow-up prompt flow

Fixed: useEffect missing from React import (caused crash on Coach tab)

v0.3.0 — Supplements Tab
Added ❋ Supplements tab to bottom navigation

Pre-loaded stack: Fish Oil, Creatine, Vitamin C, EVOO, Vitamin D3, Magnesium

Per-supplement 28-day consistency heatmap (expandable)

Streak counter, 28-day adherence %, days taken out of 28

Daily check-off with colour-coded pill buttons

Today's Stack progress bar with quick-tap marking

Category filter (Vitamin, Mineral, Omega-3, Performance, Healthy Fat)

Add / Edit / Delete supplement modal with emoji picker, colour picker, timing and category selectors

Supplements summary widget on Dashboard

v0.2.0 — Health & Recovery Tab
Added ♡ Health tab

Injury and symptom logging with body area, severity (mild/moderate/severe), status (new/stable/improving/worsening), and notes

Sleep and recovery overview cards

Severity-coded left border on injury cards

v0.1.0 — Foundation
Dashboard with calorie progress bar, macro rings (protein/carbs/fat), stats row, quick actions

◎ Nutrition tab with AI photo macro scanner (Claude Vision API), meal log, per-meal macro breakdown

△ Workout tab with session logging (Strength/Cardio/HIIT/Mobility/Sport), duration, calories, distance, sets

Bottom navigation (5 tabs)

Dark theme with Space Mono / DM Sans typography
