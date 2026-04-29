import { Health } from "@capgo/capacitor-health";

const READ_TYPES  = ["steps", "distance", "calories", "heartRate", "sleep", "workouts"];
const WRITE_TYPES = ["calories", "distance", "workouts"];

export async function isHealthKitAvailable() {
  try {
    const res = await Health.isAvailable();
    return res.available === true;
  } catch {
    return false;
  }
}

export async function requestHealthKitAuth() {
  await Health.requestAuthorization({ read: READ_TYPES, write: WRITE_TYPES });
}

function dayRange(dateStr) {
  return {
    startDate: new Date(dateStr + "T00:00:00").toISOString(),
    endDate:   new Date(dateStr + "T23:59:59").toISOString(),
  };
}

// Use aggregated queries — more efficient than reading every sample
export async function querySteps(dateStr) {
  const { startDate, endDate } = dayRange(dateStr);
  const res = await Health.queryAggregated({ dataType: "steps", startDate, endDate, bucket: "day", aggregation: "sum" });
  return Math.round(res.samples[0]?.value ?? 0);
}

export async function queryActiveCalories(dateStr) {
  const { startDate, endDate } = dayRange(dateStr);
  const res = await Health.queryAggregated({ dataType: "calories", startDate, endDate, bucket: "day", aggregation: "sum" });
  return Math.round(res.samples[0]?.value ?? 0);
}

export async function queryHeartRate(dateStr) {
  const { startDate, endDate } = dayRange(dateStr);
  const res = await Health.queryAggregated({ dataType: "heartRate", startDate, endDate, bucket: "day", aggregation: "average" });
  const v = res.samples[0]?.value;
  return v != null ? Math.round(v) : null;
}

export async function queryDistance(dateStr) {
  const { startDate, endDate } = dayRange(dateStr);
  const res = await Health.queryAggregated({ dataType: "distance", startDate, endDate, bucket: "day", aggregation: "sum" });
  const meters = res.samples[0]?.value ?? 0;
  return Math.round(meters / 10) / 100; // → km, 2 dp
}

// Sleep window: noon yesterday → noon today covers overnight sleep
export async function querySleep(dateStr) {
  const windowEnd = new Date(dateStr + "T12:00:00");
  const windowStart = new Date(windowEnd);
  windowStart.setDate(windowStart.getDate() - 1);
  const res = await Health.readSamples({
    dataType: "sleep",
    startDate: windowStart.toISOString(),
    endDate:   windowEnd.toISOString(),
    limit: 100,
  });
  const asleepMs = res.samples
    .filter(s => s.sleepState && s.sleepState !== "inBed")
    .reduce((sum, s) => sum + (new Date(s.endDate) - new Date(s.startDate)), 0);
  return asleepMs > 0 ? Math.round((asleepMs / 3_600_000) * 10) / 10 : null;
}

// Pull all today's health data in parallel
export async function syncToday(dateStr) {
  const [steps, activeCalories, heartRate, distanceKm, sleepHours] = await Promise.all([
    querySteps(dateStr).catch(() => null),
    queryActiveCalories(dateStr).catch(() => null),
    queryHeartRate(dateStr).catch(() => null),
    queryDistance(dateStr).catch(() => null),
    querySleep(dateStr).catch(() => null),
  ]);
  return { steps, activeCalories, heartRate, distanceKm, sleepHours };
}

// ── Write a completed run to Apple Health / Health Connect ─────────────────
export async function saveRunToHealth({ startDate, endDate, distanceKm, calories }) {
  const distanceMeters = Math.round(distanceKm * 1000);
  const durationMin    = Math.round((new Date(endDate) - new Date(startDate)) / 60_000);

  await Promise.allSettled([
    // Active calories burned
    Health.saveSample({ dataType: "calories", value: calories, unit: "kilocalorie", startDate, endDate }),
    // Distance covered
    Health.saveSample({ dataType: "distance", value: distanceMeters, unit: "meter", startDate, endDate }),
    // Workout entry (shows in Fitness app's Workouts list & Activity rings)
    Health.saveSample({ dataType: "workouts", value: durationMin, unit: "minute", startDate, endDate, metadata: { workoutType: "running" } }),
  ]);
}
