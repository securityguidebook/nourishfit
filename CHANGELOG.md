NourishFit Changelog
v0.5.0 — Profile, Smart Macros & Exercise Logger (current)
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
