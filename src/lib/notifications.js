export const isSupported = () => "Notification" in window && "serviceWorker" in navigator;

export const getPermission = () => (isSupported() ? Notification.permission : "unsupported");

export async function requestPermission() {
  if (!isSupported()) return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

// Schedule a single notification for a specific clock time today.
// Returns a numeric timeout ID (or null if the time has already passed).
// The app calls this on open; if the user closes the tab the timeout is lost —
// that's acceptable for the in-session MVP. Full background push needs VAPID.
export function scheduleForToday(hour, minute, title, body, tag) {
  if (!isSupported() || Notification.permission !== "granted") return null;

  const now  = new Date();
  const fire = new Date();
  fire.setHours(hour, minute, 0, 0);

  const delay = fire.getTime() - now.getTime();
  if (delay <= 0) return null; // already passed

  return setTimeout(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      // Route through SW so it shows in system tray even when tab is in BG
      if (reg.active) {
        reg.active.postMessage({ type: "SCHEDULE_NOTIFICATION", title, body, tag });
      } else {
        reg.showNotification(title, {
          body, icon: "/pwa-192x192.png", badge: "/pwa-64x64.png", tag,
        });
      }
    } catch {
      // Fallback to plain Notification API
      new Notification(title, { body, icon: "/pwa-192x192.png" });
    }
  }, delay);
}

// Parse a "HH:MM" preference string into { hour, minute }
export function parseTime(str) {
  const [h, m] = (str || "08:00").split(":").map(Number);
  return { hour: h || 8, minute: m || 0 };
}

// Schedule all three daily reminders; returns array of timeout IDs to cancel on cleanup
export function scheduleAll(prefs, supplementCount = 0) {
  const ids = [];

  if (prefs.notifSupplements && supplementCount > 0) {
    const { hour, minute } = parseTime(prefs.notifSupplementTime);
    ids.push(scheduleForToday(hour, minute,
      "💊 Supplement reminder",
      `Time to take your ${supplementCount} supplement${supplementCount > 1 ? "s" : ""}!`,
      "nf-supplements"
    ));
  }

  if (prefs.notifWater) {
    const { hour, minute } = parseTime(prefs.notifWaterTime);
    ids.push(scheduleForToday(hour, minute,
      "💧 Hydration check",
      "Halfway through the day — how's your water intake?",
      "nf-water"
    ));
  }

  if (prefs.notifMeals) {
    const { hour, minute } = parseTime(prefs.notifMealTime);
    ids.push(scheduleForToday(hour, minute,
      "🥗 Meal log reminder",
      "Don't forget to log what you've eaten today!",
      "nf-meals"
    ));
  }

  return ids.filter(Boolean);
}
