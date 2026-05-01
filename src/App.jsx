import { useState, useRef, useEffect, useCallback } from "react";
import imageCompression from "browser-image-compression";
import { savePhoto, loadPhoto, deletePhoto } from "./db.js";
import { supabase, signIn, signUp, signOut, onAuthChange } from "./lib/supabase.js";
import { analyzeImage, chatWithTools } from "./lib/ai.js";
import { isHealthKitAvailable, requestHealthKitAuth, syncToday, saveRunToHealth } from "./lib/healthkit.js";
import { scheduleAll, requestPermission, getPermission } from "./lib/notifications.js";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// Fix Leaflet default marker icon asset path issue with Vite bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).href,
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).href,
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).href,
});

const DARK_COLORS = {
  bg: "#0a0a0f",
  surface: "#13131a",
  card: "#1a1a24",
  border: "#2a2a3a",
  accent: "#00e5a0",
  accentDim: "#00e5a025",
  accentMid: "#00e5a060",
  warn: "#ff6b6b",
  blue: "#4d9fff",
  yellow: "#ffd166",
  purple: "#b57aff",
  orange: "#ff8c42",
  text: "#e8e8f0",
  muted: "#666680",
  mutedLight: "#9999b0",
};

const LIGHT_COLORS = {
  bg: "#f2f2f7",
  surface: "#ffffff",
  card: "#e9e9ef",
  border: "#d1d1d6",
  accent: "#00a870",
  accentDim: "#00a87018",
  accentMid: "#00a87050",
  warn: "#ff3b30",
  blue: "#007aff",
  yellow: "#ff9500",
  purple: "#af52de",
  orange: "#e8560a",
  text: "#1c1c1e",
  muted: "#8e8e93",
  mutedLight: "#6c6c70",
};

// Mutable — synced to theme before every render
const COLORS = { ...DARK_COLORS };

// ─── Onboarding ───────────────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  { icon: "💪", title: "Hey, Coach here.", body: "Welcome to VitalCenter — I'll help you eat smarter, train harder, and track your transformation. Let me show you around real quick." },
  { icon: "◎", title: "Nutrition & Water", body: "Log meals by typing or snap a photo — I'll scan it and pull the macros instantly. Track your water intake right alongside it." },
  { icon: "△", title: "Training", body: "Plan your weekly routine, start live sessions with set tracking and rest timers, or quick-log cardio. Your full history lives here." },
  { icon: "✦", title: "Ask Me Anything", body: "The Coach tab is your AI trainer — form tips, training splits, recovery advice. Available 24/7, no appointment needed." },
  { icon: "◫", title: "Progress Photos", body: "Take up to 5 check-in photos per day. Pick any two dates and compare side by side. Seeing is believing." },
  { icon: "◉", title: "First stop: your Profile.", body: "Fill in your weight, height, and goal so I can dial in your calorie targets and macro splits. Takes 30 seconds.", isLast: true },
];

function OnboardingModal({ onComplete }) {
  const [step, setStep] = useState(0);
  const s = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", background: `${COLORS.bg}e0` }}>
      <div style={{ width: "100%", maxWidth: 480, background: COLORS.surface, borderRadius: "28px 28px 0 0", padding: "0 24px calc(32px + env(safe-area-inset-bottom,0px))", border: `1px solid ${COLORS.border}`, borderBottom: "none" }}>
        <div style={{ width: 36, height: 4, background: COLORS.border, borderRadius: 99, margin: "14px auto 0" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 0 4px" }}>
          <button onClick={onComplete} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>Skip</button>
        </div>
        <div style={{ fontSize: 54, textAlign: "center", marginBottom: 18, lineHeight: 1, fontFamily: "'Space Mono',monospace" }}>{s.icon}</div>
        <div style={{ fontSize: 21, fontWeight: 800, fontFamily: "'Space Mono',monospace", color: COLORS.text, textAlign: "center", marginBottom: 12, lineHeight: 1.25 }}>{s.title}</div>
        <div style={{ fontSize: 15, color: COLORS.muted, textAlign: "center", lineHeight: 1.65, marginBottom: 30, minHeight: 72 }}>{s.body}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 22 }}>
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} onClick={() => i < step && setStep(i)}
              style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 99, background: i <= step ? COLORS.accent : COLORS.border, transition: "all 0.3s cubic-bezier(.4,0,.2,1)", cursor: i < step ? "pointer" : "default" }} />
          ))}
        </div>
        <button onClick={() => isLast ? onComplete() : setStep(n => n + 1)}
          style={{ width: "100%", padding: "16px 0", background: COLORS.accent, border: "none", borderRadius: 14, color: "#000", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
          {isLast ? "Let's Go 🚀" : "Next →"}
        </button>
      </div>
    </div>
  );
}

// ─── Renovation Tour (v0.9.3) ─────────────────────────────────────────────────
// Update TOUR_STEPS and bump nf_renovated key on next meaningful release.

const TOUR_STEPS = [
  {
    tab: null,
    highlight: null,
    title: "The gym's been renovated.",
    body: "Hey — Coach here. I've been putting in work while you were away. New layout, smarter tracking, cloud sync. I'm taking you through it right now.",
  },
  {
    tab: "dashboard",
    highlight: "bottom-nav",
    title: "Your new home base.",
    body: "This bar covers everything. Track holds Nutrition & Workout. Wellbeing holds Health & Supplements. One tap gets you anywhere.",
  },
  {
    tab: "nutrition",
    highlight: "pill",
    title: "The switcher pill.",
    body: "See that pill in the top-right? Tap it to flip between Nutrition and Workout while you're in Track — same logic for the Wellbeing group.",
  },
  {
    tab: "nutrition",
    highlight: "nutrition-subtabs",
    nutritionView: "history",
    title: "History and Trends.",
    body: "Meals and water now sync to your account. These tabs let you browse every logged day or pull a 7-day breakdown of calories, water, and macros.",
  },
  {
    tab: "workout",
    highlight: "workout-history",
    title: "Collapsible sessions.",
    body: "Each session card collapses. Tap one to expand it. Mid-session you can also delete individual sets before marking them done.",
  },
  {
    tab: "health",
    highlight: "recovery-card",
    title: "Smarter recovery.",
    body: "Recovery now reads like a smartwatch — Rest, Low, Moderate, Good, Optimal. It factors in your sleep, training load, and time since your last session.",
  },
  {
    tab: "supplements",
    highlight: "supplements-list",
    title: "Rolling dose tracking.",
    body: "Supplements roll day by day. Tap the check to log a dose — tap again if you doubled up. The 7-day strip shows your full history at a glance.",
  },
  {
    tab: "profile",
    highlight: "help-section",
    title: "Need a hand?",
    body: "Anything you're unsure about — scroll to the bottom of Profile. Help is right there. That's the full tour. Now go get after it.",
    isLast: true,
  },
];

// ─── Auth Screen ──────────────────────────────────────────────────────────────

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setInfo("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: err } = await signUp(email, password);
        if (err) { setError(err.message); return; }
        if (data?.user && !data.session) {
          setInfo("Check your email to confirm your account, then sign in.");
          setMode("signin");
          return;
        }
        if (data?.session) onAuth(data.session, name.trim());
      } else {
        const { data, error: err } = await signIn(email, password);
        if (err) { setError(err.message); return; }
        if (data?.session) onAuth(data.session, null);
      }
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "14px 16px", background: COLORS.card,
    border: `1px solid ${COLORS.border}`, borderRadius: 12, color: COLORS.text,
    fontSize: 16, outline: "none", marginBottom: 12, WebkitAppearance: "none",
  };

  return (
    <div style={{ minHeight: "100dvh", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 24px calc(24px + env(safe-area-inset-bottom,0px))" }}>
      <div style={{ fontSize: 42, marginBottom: 8 }}>💪</div>
      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Space Mono',monospace", color: COLORS.text, marginBottom: 4 }}>VitalCenter</div>
      <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 36 }}>Your AI fitness & nutrition coach</div>

      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", background: COLORS.card, borderRadius: 12, padding: 4, marginBottom: 24 }}>
          {["signin", "signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); setInfo(""); }}
              style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: "none", background: mode === m ? COLORS.accent : "transparent", color: mode === m ? "#000" : COLORS.muted, fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all 0.2s" }}>
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Your name (optional)" style={inputStyle} autoComplete="name" />
          )}
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" type="email" required style={inputStyle} autoComplete="email" autoCapitalize="none" />
          <input value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" type="password" required style={{ ...inputStyle, marginBottom: 20 }} autoComplete={mode === "signup" ? "new-password" : "current-password"} />

          {error && <div style={{ color: COLORS.warn, fontSize: 13, marginBottom: 14, textAlign: "center" }}>{error}</div>}
          {info  && <div style={{ color: COLORS.accent, fontSize: 13, marginBottom: 14, textAlign: "center" }}>{info}</div>}

          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "16px 0", background: loading ? COLORS.border : COLORS.accent, border: "none", borderRadius: 14, color: "#000", fontWeight: 800, fontSize: 16, cursor: loading ? "not-allowed" : "pointer", transition: "background 0.2s" }}>
            {loading ? "..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

const NAV = [
  { id: "dashboard", icon: "⊞", label: "Home" },
  { id: "nutrition", icon: "◎", label: "Nutrition" },
  { id: "workout", icon: "△", label: "Workout" },
  { id: "coach", icon: "✦", label: "Coach" },
  { id: "supplements", icon: "❋", label: "Supps" },
  { id: "health", icon: "♡", label: "Health" },
  { id: "progress", icon: "◫", label: "Progress" },
  { id: "profile", icon: "◉", label: "Profile" },
];

const BOTTOM_NAV = [
  { id: "dashboard", icon: "⊞", label: "Home" },
  { id: "track",     icon: "◎", label: "Track",     group: ["nutrition", "workout"] },
  { id: "coach",     icon: "✦", label: "Coach" },
  { id: "progress",  icon: "◫", label: "Progress" },
  { id: "wellbeing", icon: "♡", label: "Wellbeing", group: ["health", "supplements"] },
];

const GROUP_ITEMS = {
  track: [
    { id: "nutrition",    icon: "◎", label: "Nutrition" },
    { id: "workout",      icon: "△", label: "Workout"   },
  ],
  wellbeing: [
    { id: "health",       icon: "♡", label: "Health" },
    { id: "supplements",  icon: "❋", label: "Supps"  },
  ],
};


// ─── Shared UI ────────────────────────────────────────────────────────────────

function Badge({ text, color }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 99, background: `${color}22`, color, border: `1px solid ${color}44`, textTransform: "uppercase" }}>
      {text}
    </span>
  );
}

function MacroRing({ label, value, max, color, size = 60 }) {
  const pct = Math.min(value / max, 1);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={COLORS.border} strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${circ * pct} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <span style={{ fontSize: 11, color: COLORS.mutedLight, marginTop: -2 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{value}g</span>
    </div>
  );
}

function CalorieBar({ consumed, goal }) {
  const pct = Math.min(consumed / goal, 1);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: COLORS.mutedLight }}>Consumed</span>
        <span style={{ fontSize: 12, color: COLORS.mutedLight }}>{consumed} / {goal} kcal</span>
      </div>
      <div style={{ height: 8, background: COLORS.border, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.blue})`, borderRadius: 99, transition: "width 1s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 11, color: COLORS.accent }}>{Math.round(pct * 100)}% of goal</span>
        <span style={{ fontSize: 11, color: COLORS.muted }}>{goal - consumed} remaining</span>
      </div>
    </div>
  );
}

// ─── AI Photo Scanner ─────────────────────────────────────────────────────────

function AIPhotoScanner({ onClose, onScan }) {
  const [scanMode, setScanMode] = useState("photo"); // "photo" | "describe"
  const [phase, setPhase] = useState("idle");
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [describeText, setDescribeText] = useState("");
  const fileRef = useRef();
  const cameraRef = useRef();

  async function runAnalysis(base64OrNull, textOrNull) {
    setPhase("scanning");
    try {
      const json = await analyzeImage(base64OrNull, textOrNull);
      setResult(json);
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const base64 = e.target.result.split(",")[1];
      setImagePreview(e.target.result);
      runAnalysis(base64, null);
    };
    reader.readAsDataURL(file);
  }

  function handleDescribe() {
    if (!describeText.trim()) return;
    setImagePreview(null);
    runAnalysis(null, describeText.trim());
  }

  function reset() {
    setPhase("idle");
    setResult(null);
    setImagePreview(null);
    setDescribeText("");
  }

  const tabStyle = active => ({
    flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none",
    borderRadius: 10, background: active ? COLORS.accent : COLORS.bg,
    color: active ? "#000" : COLORS.muted,
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "24px 24px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📸 AI Meal Scanner</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Mode tabs — only shown in idle/error state */}
        {(phase === "idle" || phase === "error") && (
          <div style={{ display: "flex", gap: 6, marginBottom: 16, background: COLORS.card, padding: 4, borderRadius: 12 }}>
            <button style={tabStyle(scanMode === "photo")} onClick={() => { setScanMode("photo"); reset(); }}>📷 Photo</button>
            <button style={tabStyle(scanMode === "describe")} onClick={() => { setScanMode("describe"); reset(); }}>✏️ Describe</button>
          </div>
        )}

        {/* ── PHOTO MODE ── */}
        {scanMode === "photo" && phase === "idle" && (
          <div>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current.click()}
              style={{ border: `2px dashed ${dragOver ? COLORS.accent : COLORS.border}`, borderRadius: 16, padding: 28, textAlign: "center", cursor: "pointer", background: dragOver ? COLORS.accentDim : "transparent", marginBottom: 10 }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>🍽️</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Drop a food photo here</div>
              <div style={{ fontSize: 11, color: COLORS.muted }}>or click to browse · JPG, PNG, WEBP</div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            </div>
            {/* Native camera capture — opens camera directly on mobile/Capacitor */}
            <button
              onClick={() => cameraRef.current.click()}
              style={{ width: "100%", padding: 12, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, color: COLORS.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              📷 Use Camera
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
          </div>
        )}

        {/* ── DESCRIBE MODE ── */}
        {scanMode === "describe" && phase === "idle" && (
          <div>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: COLORS.muted }}>Describe what you ate — the AI will estimate macros.</p>
            <textarea
              value={describeText}
              onChange={e => setDescribeText(e.target.value)}
              placeholder="e.g. 200g chicken breast with 1 cup white rice and steamed broccoli"
              rows={4}
              style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 14px", color: COLORS.text, fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box" }}
            />
            <button
              onClick={handleDescribe}
              disabled={!describeText.trim()}
              style={{ marginTop: 10, width: "100%", padding: 13, background: describeText.trim() ? COLORS.accent : COLORS.border, border: "none", borderRadius: 12, color: describeText.trim() ? "#000" : COLORS.muted, fontWeight: 800, fontSize: 14, cursor: describeText.trim() ? "pointer" : "default" }}
            >
              Analyse Macros
            </button>
          </div>
        )}

        {/* ── SCANNING ── */}
        {phase === "scanning" && (
          <div style={{ textAlign: "center", padding: 32 }}>
            {imagePreview && <img src={imagePreview} alt="preview" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12, marginBottom: 16 }} />}
            <div style={{ fontSize: 14, color: COLORS.mutedLight }}>Analysing macronutrients . . .</div>
          </div>
        )}

        {/* ── RESULT ── */}
        {phase === "done" && result && (
          <div>
            {imagePreview && <img src={imagePreview} alt="preview" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 12, marginBottom: 16 }} />}
            <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>{result.name}</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>{result.description}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[{ l: "Calories", v: result.calories, u: "kcal", c: COLORS.yellow }, { l: "Protein", v: result.protein, u: "g", c: COLORS.accent }, { l: "Carbs", v: result.carbs, u: "g", c: COLORS.blue }, { l: "Fat", v: result.fat, u: "g", c: COLORS.orange }].map(x => (
                <div key={x.l} style={{ flex: 1, background: COLORS.card, borderRadius: 10, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: x.c }}>{x.v}<span style={{ fontSize: 10 }}>{x.u}</span></div>
                  <div style={{ fontSize: 10, color: COLORS.muted }}>{x.l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { onScan(result); onClose(); }} style={{ flex: 1, padding: 14, background: COLORS.accent, border: "none", borderRadius: 14, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Log This Meal</button>
              <button onClick={reset} style={{ padding: "14px 16px", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, color: COLORS.muted, fontSize: 13, cursor: "pointer" }}>↩</button>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {phase === "error" && (
          <div style={{ textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 14, color: COLORS.warn }}>Could not analyse. Try a different photo or description.</div>
            <button onClick={reset} style={{ marginTop: 16, padding: "10px 24px", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.text, cursor: "pointer" }}>Try Again</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CSV Export Utility ───────────────────────────────────────────────────────

function downloadCSV(filename, headers, rows) {
  const esc = v => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(r => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Workout Share Utilities ──────────────────────────────────────────────────

function buildShareText(w) {
  const isRun = w.type === "Run" || (w.distance && !w.exercises?.length);
  const icon = isRun ? "🏃" : w.type === "Mobility" ? "🧘" : "💪";
  const lines = [`${icon} ${w.name} — VitalCenter`];

  if (isRun && w.distance) {
    lines.push(`📍 ${w.distance} km · ⏱ ${w.duration} min · 💨 ${w.pace ?? ""}/${w.distance > 0 ? "km" : ""}`);
    if (w.elevationGain > 0) lines.push(`⬆️ ${w.elevationGain} m elevation gain`);
    lines.push(`🔥 ${w.calories} kcal`);
  } else {
    lines.push(`⏱ ${w.duration} min · 🔥 ${w.calories} kcal${w.sets ? ` · ${w.sets} sets` : ""}`);
    if (w.exercises?.length > 0) {
      lines.push("");
      w.exercises.forEach(ex => {
        const setStr = ex.sets?.map(s => `${s.reps}×${s.weight}kg`).join(", ");
        lines.push(`• ${ex.name}${setStr ? `: ${setStr}` : ""}`);
      });
    }
  }
  lines.push("", "Tracked with VitalCenter 💚");
  return lines.join("\n");
}

async function shareWorkout(text, title) {
  if (navigator.share) {
    try { await navigator.share({ title, text }); return "shared"; }
    catch { return "cancelled"; }
  }
  if (navigator.clipboard) {
    try { await navigator.clipboard.writeText(text); return "copied"; }
    catch {}
  }
  return "error";
}

// ─── Weekly Summary Card ──────────────────────────────────────────────────────

function WeeklySummaryCard({ meals, workouts, waterLog, waterGoal, sleepLog, supplements, calorieGoal }) {
  const [open, setOpen] = useState(true);

  const ldk = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return ldk(d);
  });

  // Workouts — id is a Date.now() timestamp
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const weekWorkouts = workouts.filter(w => w.id > weekAgo);
  const weekSessions  = weekWorkouts.length;
  const weekMinutes   = weekWorkouts.reduce((s, w) => s + (w.duration  || 0), 0);
  const weekCalBurned = weekWorkouts.reduce((s, w) => s + (w.calories  || 0), 0);

  // Which days had a workout (for the activity strip)
  const activeDay = last7.map(k => weekWorkouts.some(w => ldk(new Date(w.id)) === k));

  // Nutrition — grouped by logged_date
  const calsByDay = Object.fromEntries(last7.map(k => [k, 0]));
  meals.forEach(m => { if (calsByDay[m.logged_date] !== undefined) calsByDay[m.logged_date] += m.calories || 0; });
  const daysLogged = last7.filter(k => calsByDay[k] > 0).length;
  const avgCals    = daysLogged > 0 ? Math.round(last7.reduce((s, k) => s + calsByDay[k], 0) / daysLogged) : 0;

  // Water
  const daysWaterMet = last7.filter(k => (waterLog[k] || 0) >= waterGoal).length;

  // Sleep
  const sleepEntries = last7.map(k => sleepLog[k]).filter(Boolean);
  const avgSleep = sleepEntries.length > 0
    ? (sleepEntries.reduce((s, e) => s + parseFloat(e.hours || 0), 0) / sleepEntries.length).toFixed(1)
    : null;

  // Supplements
  const suppAdherence = supplements.length > 0
    ? Math.round(supplements.reduce((s, supp) => s + last7.filter(k => supp.history?.[k]).length, 0) / (supplements.length * 7) * 100)
    : null;

  const rangeStart = new Date(last7[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const rangeEnd   = new Date(last7[6] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const statCell = (value, unit, color) => (
    <div style={{ background: COLORS.bg, borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
      <div style={{ fontSize: 17, fontWeight: 800, color, fontFamily: "'Space Mono',monospace", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 9, color: COLORS.muted, marginTop: 2 }}>{unit}</div>
    </div>
  );

  return (
    <div style={{ background: COLORS.card, borderRadius: 16, marginBottom: 14, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>📊</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.text }}>Week in Review</span>
          <span style={{ fontSize: 10, color: COLORS.muted }}>{rangeStart} – {rangeEnd}</span>
        </div>
        <span style={{ fontSize: 10, color: COLORS.muted, display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          {/* 7-day activity strip */}
          <div style={{ display: "flex", gap: 3, marginBottom: 12 }}>
            {last7.map((k, i) => {
              const dayLetter = new Date(k + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })[0];
              return (
                <div key={k} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ height: 6, borderRadius: 3, background: activeDay[i] ? COLORS.accent : COLORS.border, marginBottom: 3 }} />
                  <span style={{ fontSize: 9, color: activeDay[i] ? COLORS.accent : COLORS.muted, fontWeight: activeDay[i] ? 700 : 400 }}>{dayLetter}</span>
                </div>
              );
            })}
          </div>

          {/* Workout stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 8 }}>
            {statCell(weekSessions,  "sessions",    COLORS.accent)}
            {statCell(weekMinutes,   "min active",  COLORS.blue)}
            {statCell(weekCalBurned, "kcal burned", COLORS.orange)}
          </div>

          {/* Nutrition row */}
          {daysLogged > 0 && (
            <div style={{ background: COLORS.bg, borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 9, color: COLORS.muted, marginBottom: 2 }}>Avg daily calories</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.yellow, fontFamily: "'Space Mono',monospace" }}>
                  {avgCals} <span style={{ fontSize: 10, color: COLORS.muted, fontWeight: 400 }}>/ {calorieGoal}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: COLORS.muted, marginBottom: 2 }}>Days logged</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>{daysLogged}<span style={{ fontSize: 10, color: COLORS.muted, fontWeight: 400 }}>/7</span></div>
              </div>
            </div>
          )}

          {/* Wellness row */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${suppAdherence !== null ? 3 : 2}, 1fr)`, gap: 6 }}>
            {statCell(avgSleep !== null ? `${avgSleep}h` : "—", "avg sleep",      COLORS.purple)}
            {statCell(`${daysWaterMet}/7`,                       "water goal met", COLORS.blue)}
            {suppAdherence !== null && statCell(`${suppAdherence}%`, "supp adherence", COLORS.accent)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Personal Records ─────────────────────────────────────────────────────────

const epley1RM = (weight, reps) => {
  const w = parseFloat(weight) || 0, r = parseInt(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  return Math.round(r === 1 ? w : w * (1 + r / 30));
};

function PRSparkline({ history }) {
  if (history.length < 2) return null;
  const W = 200, H = 36, P = 3;
  const vals = history.map(h => h.oneRM);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const range = hi - lo || 1;
  const toX = i => P + (i / (history.length - 1)) * (W - P * 2);
  const toY = v => H - P - ((v - lo) / range) * (H - P * 2);
  const pts = history.map((h, i) => `${toX(i).toFixed(1)},${toY(h.oneRM).toFixed(1)}`).join(" ");
  const trend = vals[vals.length - 1] >= vals[0] ? COLORS.accent : COLORS.warn;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={trend} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={toX(history.length - 1)} cy={toY(vals[vals.length - 1])} r="3" fill={trend} />
    </svg>
  );
}

function AddPRModal({ onClose, onSave, todayStr }) {
  const [form, setForm] = useState({ name: "", weight: "", reps: "1", date: todayStr });
  const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "9px 12px", color: COLORS.text, fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" };
  const oneRM = epley1RM(form.weight, form.reps);
  const valid = form.name.trim() && parseFloat(form.weight) > 0 && parseInt(form.reps) > 0;
  const handle = () => {
    if (!valid) return;
    onSave(form.name.trim(), parseFloat(form.weight), parseInt(form.reps), form.date, oneRM);
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "24px 24px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, fontFamily: "'Space Mono',monospace" }}>Log Personal Record</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: COLORS.muted, lineHeight: 1 }}>×</button>
        </div>
        <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Exercise Name</label>
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Squat, Bench Press, Pull-ups" style={{ ...inputStyle, marginBottom: 14 }} autoFocus />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Weight (kg)</label>
            <input type="number" min="0" step="0.5" value={form.weight} onChange={e => setForm(p => ({ ...p, weight: e.target.value }))} placeholder="e.g. 100" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Reps</label>
            <input type="number" min="1" max="50" value={form.reps} onChange={e => setForm(p => ({ ...p, reps: e.target.value }))} style={inputStyle} />
          </div>
        </div>
        <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Date</label>
        <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={{ ...inputStyle, marginBottom: 16 }} />
        {oneRM > 0 && (
          <div style={{ background: COLORS.accentDim, borderRadius: 10, padding: "10px 14px", marginBottom: 16, textAlign: "center" }}>
            <span style={{ fontSize: 12, color: COLORS.muted }}>Estimated 1RM: </span>
            <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.accent, fontFamily: "'Space Mono',monospace" }}>{oneRM} kg</span>
          </div>
        )}
        <button onClick={handle} disabled={!valid}
          style={{ width: "100%", padding: "13px 0", background: valid ? COLORS.accent : COLORS.border, color: valid ? "#000" : COLORS.muted, border: "none", borderRadius: 14, fontWeight: 800, fontSize: 15, cursor: valid ? "pointer" : "default" }}>
          Save Record
        </button>
      </div>
    </div>
  );
}

// ─── Quick Log Modal (cardio / manual entry) ──────────────────────────────────

function QuickLogModal({ onClose, onAdd, initialValues }) {
  const [form, setForm] = useState({
    type: initialValues?.type || "Cardio",
    name: initialValues?.name || "",
    duration: initialValues?.duration != null ? String(initialValues.duration) : "",
    calories: initialValues?.calories != null ? String(initialValues.calories) : "",
    distance: "",
  });
  const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, width: "100%", outline: "none", marginTop: 6 };
  const handle = () => {
    if (!form.name.trim()) return;
    onAdd({ id: Date.now(), type: form.type, name: form.name, duration: parseInt(form.duration) || 0, calories: parseInt(form.calories) || 0, ...(form.distance ? { distance: form.distance } : {}), date: new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) });
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Quick Log</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        {[["Activity Name", "name", "text"], ["Duration (min)", "duration", "number"], ["Calories Burned", "calories", "number"], ["Distance (optional)", "distance", "text"]].map(([label, key, type]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>{label}</label>
            <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inputStyle} />
          </div>
        ))}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Type</label>
          <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={{ ...inputStyle }}>
            {["Cardio", "HIIT", "Mobility", "Sport", "Strength", "Other"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={handle} style={{ width: "100%", padding: 13, background: COLORS.blue, border: "none", borderRadius: 14, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Save</button>
      </div>
    </div>
  );
}

// ─── Add Injury Modal ─────────────────────────────────────────────────────────

function AddInjuryModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ area: "", severity: "mild", status: "new", note: "" });
  const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, width: "100%", outline: "none", marginTop: 6 };
  const handle = () => {
    if (!form.area.trim()) return;
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const firstEntry = { date: dateStr, severity: form.severity, status: form.status, note: form.note };
    onAdd({ id: Date.now(), area: form.area, severity: form.severity, status: form.status, note: form.note, date: dateStr, log: [firstEntry] });
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Log Symptom</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Body Area</label>
          <input value={form.area} onChange={e => setForm(p => ({ ...p, area: e.target.value }))} style={inputStyle} placeholder="e.g. Left Knee" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Severity</label>
          <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))} style={{ ...inputStyle }}>
            {["mild","moderate","severe"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Status</label>
          <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ ...inputStyle }}>
            {["new","stable","improving","worsening"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Note</label>
          <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} style={inputStyle} placeholder="Brief description..." />
        </div>
        <button onClick={handle} style={{ width: "100%", padding: 13, background: COLORS.warn, border: "none", borderRadius: 14, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Save</button>
      </div>
    </div>
  );
}

// ─── Update Injury Modal ──────────────────────────────────────────────────────

const STATUS_ORDER = ["new", "worsening", "stable", "improving", "healed"];
const STATUS_ICON = { new: "●", worsening: "▼", stable: "◆", improving: "▲", healed: "✓" };
const STATUS_COLOR = { new: COLORS.blue, worsening: COLORS.warn, stable: COLORS.mutedLight, improving: COLORS.accent, healed: "#44cc88" };

function UpdateInjuryModal({ injury, onClose, onUpdate }) {
  const [severity, setSeverity] = useState(injury.severity);
  const [status, setStatus] = useState(injury.status);
  const [note, setNote] = useState("");
  const log = injury.log || [];
  const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, width: "100%", outline: "none", marginTop: 6 };

  const handle = () => {
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    onUpdate({ ...injury, severity, status, note: note || injury.note, log: [...log, { date: dateStr, severity, status, note }] });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{injury.area}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: COLORS.muted }}>First logged: {injury.date}</p>

        {/* Progression timeline */}
        {log.length > 0 && (
          <div style={{ background: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Progression</div>
            {log.map((entry, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < log.length - 1 ? 10 : 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: STATUS_COLOR[entry.status] + "33", border: `2px solid ${STATUS_COLOR[entry.status]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: STATUS_COLOR[entry.status], fontWeight: 800 }}>{STATUS_ICON[entry.status]}</div>
                  {i < log.length - 1 && <div style={{ width: 2, flex: 1, background: COLORS.border, margin: "3px 0" }} />}
                </div>
                <div style={{ paddingBottom: i < log.length - 1 ? 10 : 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center', marginBottom: 2" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[entry.status] }}>{entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}</span>
                    <Badge text={entry.severity} color={{ mild: COLORS.yellow, moderate: COLORS.orange, severe: COLORS.warn }[entry.severity] || COLORS.muted} />
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{entry.date}</div>
                  {entry.note && <div style={{ fontSize: 11, color: COLORS.mutedLight, fontStyle: "italic", marginTop: 2 }}>{entry.note}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Update form */}
        <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Log Update</div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Current Status</label>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {STATUS_ORDER.map(s => (
              <button key={s} onClick={() => setStatus(s)}
                style={{ padding: "7px 12px", borderRadius: 9, border: `1px solid ${status === s ? STATUS_COLOR[s] : COLORS.border}`, background: status === s ? STATUS_COLOR[s] + "22" : COLORS.bg, color: status === s ? STATUS_COLOR[s] : COLORS.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {STATUS_ICON[s]} {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Severity</label>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {["mild","moderate","severe"].map(sv => (
              <button key={sv} onClick={() => setSeverity(sv)}
                style={{ flex: 1, padding: "7px 0", borderRadius: 9, border: `1px solid ${severity === sv ? { mild: COLORS.yellow, moderate: COLORS.orange, severe: COLORS.warn }[sv] : COLORS.border}`, background: severity === sv ? { mild: COLORS.yellow, moderate: COLORS.orange, severe: COLORS.warn }[sv] + "22" : COLORS.bg, color: severity === sv ? { mild: COLORS.yellow, moderate: COLORS.orange, severe: COLORS.warn }[sv] : COLORS.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {sv.charAt(0).toUpperCase() + sv.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Note (optional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} style={inputStyle} placeholder="How does it feel today?" />
        </div>
        <button onClick={handle} style={{ width: "100%", padding: 13, background: STATUS_COLOR[status], border: "none", borderRadius: 14, color: status === "healed" || status === "improving" ? "#000" : "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
          Log Update
        </button>
      </div>
    </div>
  );
}

// ─── Routine Day Modal ────────────────────────────────────────────────────────

const ROUTINE_TYPES = ["Strength","Cardio","HIIT","Mobility","Sport","Rest","Other"];
const ROUTINE_TYPE_COLOR = { Strength: COLORS.accent, Cardio: COLORS.blue, HIIT: COLORS.warn, Mobility: COLORS.yellow, Sport: COLORS.purple, Rest: COLORS.muted, Other: COLORS.mutedLight };

function RoutineDayModal({ day, existing, templates, onSaveTemplate, onDeleteTemplate, onClose, onSave }) {
  const [name, setName] = useState(existing?.name || "");
  const [type, setType] = useState(existing?.type || "Strength");
  const [exercises, setExercises] = useState(existing?.exercises || []);
  const [showTemplates, setShowTemplates] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, width: "100%", outline: "none" };
  const smallInput = { ...inputStyle, padding: "6px 8px", fontSize: 12, textAlign: "center" };

  const addExercise = () => setExercises(prev => [...prev, { id: Date.now(), name: "", sets: "3", reps: "10", weight: "" }]);
  const updateEx = (id, field, val) => setExercises(prev => prev.map(e => e.id === id ? { ...e, [field]: val } : e));
  const removeEx = (id) => setExercises(prev => prev.filter(e => e.id !== id));

  const loadTemplate = (t) => { setName(t.name); setType(t.type); setExercises(t.exercises.map(e => ({ ...e, id: Date.now() + Math.random() }))); setShowTemplates(false); };

  const handleSave = () => {
    const validExercises = exercises.filter(e => e.name.trim());
    onSave({ name: name.trim() || type, type, exercises: validExercises });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{day} Plan</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {templates?.length > 0 && <button onClick={() => setShowTemplates(!showTemplates)} style={{ padding: "5px 10px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.mutedLight, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Templates</button>}
            <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
          </div>
        </div>

        {/* Template picker */}
        {showTemplates && (
          <div style={{ background: COLORS.bg, borderRadius: 12, padding: 10, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>Load Template</div>
            {templates.map(t => (
              <div key={t.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <button onClick={() => loadTemplate(t)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", color: COLORS.text, fontSize: 13, cursor: "pointer", padding: "4px 0" }}>
                  <span style={{ fontWeight: 700 }}>{t.name}</span>
                  <span style={{ color: COLORS.muted, fontSize: 11 }}> · {t.type} · {(t.exercises || []).length} ex</span>
                </button>
                <button onClick={() => onDeleteTemplate(t.name)} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 13, cursor: "pointer", padding: "0 4px" }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Activity Name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} placeholder="e.g. Push Day, Morning Run, Rest..." />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Type</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {ROUTINE_TYPES.map(t => (
              <button key={t} onClick={() => setType(t)}
                style={{ padding: "7px 12px", borderRadius: 9, border: `1px solid ${type === t ? ROUTINE_TYPE_COLOR[t] : COLORS.border}`, background: type === t ? ROUTINE_TYPE_COLOR[t] + "22" : COLORS.bg, color: type === t ? ROUTINE_TYPE_COLOR[t] : COLORS.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Exercises */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Exercises</label>
            <button onClick={addExercise} style={{ padding: "5px 10px", background: COLORS.accent + "22", border: `1px solid ${COLORS.accent}`, borderRadius: 8, color: COLORS.accent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Add</button>
          </div>
          {exercises.length === 0 && (
            <div style={{ textAlign: "center", padding: "12px 0", color: COLORS.muted, fontSize: 12 }}>No exercises yet — tap + Add to build your plan</div>
          )}
          {exercises.map((ex, idx) => (
            <div key={ex.id} style={{ background: COLORS.bg, borderRadius: 10, padding: 10, marginBottom: 8, border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, minWidth: 18 }}>{idx + 1}.</span>
                <input value={ex.name} onChange={e => updateEx(ex.id, "name", e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Exercise name" />
                <button onClick={() => removeEx(ex.id)} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 16, cursor: "pointer", padding: "0 4px" }}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <div>
                  <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 3, textAlign: "center" }}>Sets</div>
                  <input type="number" value={ex.sets} onChange={e => updateEx(ex.id, "sets", e.target.value)} style={smallInput} placeholder="3" />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 3, textAlign: "center" }}>Reps</div>
                  <input type="number" value={ex.reps} onChange={e => updateEx(ex.id, "reps", e.target.value)} style={smallInput} placeholder="10" />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 3, textAlign: "center" }}>Weight (kg)</div>
                  <input type="number" value={ex.weight} onChange={e => updateEx(ex.id, "weight", e.target.value)} style={smallInput} placeholder="—" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Save as template */}
        {showSaveTemplate ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input value={saveTemplateName} onChange={e => setSaveTemplateName(e.target.value)} placeholder="Template name..." style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => { if (saveTemplateName.trim()) { onSaveTemplate({ name: saveTemplateName.trim(), type, exercises: exercises.filter(e => e.name.trim()) }); setSaveTemplateName(""); setShowSaveTemplate(false); } }} style={{ padding: "8px 12px", background: COLORS.accent, border: "none", borderRadius: 10, color: "#000", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Save</button>
            <button onClick={() => setShowSaveTemplate(false)} style={{ padding: "8px 10px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.muted, fontSize: 12, cursor: "pointer" }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setShowSaveTemplate(true)} style={{ width: "100%", padding: "8px 0", background: "transparent", border: `1px dashed ${COLORS.border}`, borderRadius: 10, color: COLORS.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>
            Save as Template
          </button>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          {existing && <button onClick={() => { onSave(null); onClose(); }} style={{ flex: 1, padding: 12, background: COLORS.warn + "22", border: `1px solid ${COLORS.warn}`, borderRadius: 14, color: COLORS.warn, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Clear Day</button>}
          <button onClick={handleSave} style={{ flex: 2, padding: 13, background: ROUTINE_TYPE_COLOR[type], border: "none", borderRadius: 14, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── AI Coach ─────────────────────────────────────────────────────────────────

const COACH_TOOLS = [
  {
    name: "log_meal",
    description: "Log a meal to the nutrition tracker. Use when the user clearly describes food they ate. Estimate macros from standard nutritional data.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Descriptive meal name" },
        calories: { type: "number", description: "kcal" },
        protein: { type: "number", description: "grams" },
        carbs: { type: "number", description: "grams" },
        fat: { type: "number", description: "grams" },
      },
      required: ["name", "calories", "protein", "carbs", "fat"],
    },
  },
  {
    name: "log_workout",
    description: "Log a completed workout. Use when the user describes exercises they have done.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Workout name" },
        type: { type: "string", enum: ["Strength", "Cardio", "HIIT", "Mobility", "Sport", "Other"] },
        duration: { type: "number", description: "Minutes (estimate if not stated)" },
        calories: { type: "number", description: "Estimated kcal burned" },
        intensity: { type: "string", enum: ["Low", "Moderate", "High", "Very High"] },
        exercises: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              sets: { type: "array", items: { type: "object", properties: { reps: { type: "string" }, weight: { type: "string" } }, required: ["reps"] } },
            },
            required: ["name", "sets"],
          },
        },
      },
      required: ["name", "type", "exercises"],
    },
  },
];

function hrZone(bpm) {
  if (bpm < 100) return "resting/low";
  if (bpm < 140) return "moderate zone";
  if (bpm < 160) return "aerobic zone";
  return "high intensity zone";
}

function buildCoachSystemPrompt(profile, todayMeals, recentWorkouts, hkData) {
  const totalCals = (todayMeals || []).reduce((s, m) => s + (m.calories || 0), 0);
  const hrLine = hkData?.heartRate
    ? `Today's average heart rate (Apple Health): ${hkData.heartRate} bpm — ${hrZone(hkData.heartRate)}.`
    : "No heart rate data available today.";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const recentNames = (recentWorkouts || []).slice(0, 3).map(w => w.name).join(", ") || "none";

  return `You are VitalCenter Coach, an expert AI fitness and nutrition coach. Today is ${today}.

User: ${profile?.gender || "unknown"}, age ${profile?.age || "?"}, ${profile?.weight || "?"}${profile?.weightUnit || "kg"}, goal: ${profile?.goal || "maintain"}, activity: ${profile?.activityLevel || "moderate"}.
Today's nutrition: ${totalCals} kcal across ${(todayMeals || []).length} meal(s).
Recent workouts: ${recentNames}.
${hrLine}

You have two tools:
- log_meal: call this when the user describes food they ate; estimate macros from standard nutrition data.
- log_workout: call this when the user describes a completed workout or exercise.

Rules:
- When workout intensity is unclear and no high heart-rate data is available, ask one short follow-up: "How hard was it — easy, moderate, or hard?" before calling the tool.
- If heart rate data shows aerobic/high-intensity zone (>150 bpm), use High or Very High intensity for any workout today.
- Provide a brief, friendly response alongside or after a tool call.
- Keep responses concise. Use emojis sparingly.`;
}

function AICoach({ onAddMeal, onAddWorkout, onEditMeal, onEditWorkout, todayMeals, recentWorkouts, profile, hkData, todayKey }) {
  // messages: { role: "user"|"assistant", content: string }
  //         | { role: "action", actionType: "meal"|"workout", data: {}, status: "pending"|"logged"|"dismissed" }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function handleLog(idx) {
    const action = messages[idx];
    if (action.actionType === "meal") {
      onAddMeal({
        id: Date.now(),
        name: action.data.name,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        calories: action.data.calories,
        protein: action.data.protein,
        carbs: action.data.carbs,
        fat: action.data.fat,
        img: "🍽️",
        logged_date: todayKey,
      });
    } else {
      onAddWorkout({
        id: Date.now(),
        type: action.data.type || "Strength",
        name: action.data.name,
        duration: action.data.duration || 0,
        calories: action.data.calories || 0,
        sets: (action.data.exercises || []).reduce((s, e) => s + (e.sets?.length || 0), 0),
        date: new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
        exercises: action.data.exercises || [],
      });
    }
    setMessages(prev => prev.map((m, i) => i === idx ? { ...m, status: "logged" } : m));
  }

  function handleEdit(idx) {
    const action = messages[idx];
    if (action.actionType === "meal") onEditMeal(action.data);
    else onEditWorkout(action.data);
    setMessages(prev => prev.map((m, i) => i === idx ? { ...m, status: "dismissed" } : m));
  }

  function handleDismiss(idx) {
    setMessages(prev => prev.map((m, i) => i === idx ? { ...m, status: "dismissed" } : m));
  }

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    try {
      // Only send user/assistant messages to the API (filter out action cards)
      const apiMessages = updatedMessages
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content }));

      const systemPrompt = buildCoachSystemPrompt(profile, todayMeals, recentWorkouts, hkData);
      const { text, toolCalls } = await chatWithTools(apiMessages, COACH_TOOLS, systemPrompt);

      const newEntries = [];
      if (text) newEntries.push({ role: "assistant", content: text });
      for (const tc of toolCalls) {
        if (tc.name === "log_meal" || tc.name === "log_workout") {
          newEntries.push({ role: "action", actionType: tc.name === "log_meal" ? "meal" : "workout", data: tc.input, status: "pending" });
        }
      }
      if (newEntries.length === 0) {
        newEntries.push({ role: "assistant", content: "Sorry, I couldn't get a response. Please try again." });
      }
      setMessages(prev => [...prev, ...newEntries]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't connect. Please try again." }]);
    }
    setLoading(false);
  }

  const QUICK_PROMPTS = [
    "Best pre-workout meal?",
    "I just had oats with milk and banana",
    "3 sets bicep curls 16kg",
    "How much protein do I need?",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono', monospace" }}>✦ AI Coach</h2>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: COLORS.muted }}>Ask anything · describe a meal or workout to log it</p>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
        {messages.length === 0 && (
          <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 13, color: COLORS.mutedLight, marginBottom: 10 }}>Ask a question, or describe a meal/workout to log it instantly.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {QUICK_PROMPTS.map(q => (
                <button key={q} onClick={() => setInput(q)} style={{ fontSize: 11, padding: "5px 10px", background: COLORS.accentDim, border: `1px solid ${COLORS.accentMid}`, borderRadius: 99, color: COLORS.accent, cursor: "pointer" }}>{q}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === "action") {
            if (m.status === "dismissed") return null;
            if (m.status === "logged") return (
              <div key={i} style={{ alignSelf: "flex-start", background: COLORS.accentDim, border: `1px solid ${COLORS.accentMid}`, borderRadius: 12, padding: "8px 14px", fontSize: 12, color: COLORS.accent }}>
                ✓ {m.actionType === "meal" ? "Meal" : "Workout"} logged — {m.data.name}
              </div>
            );
            // pending confirm card
            const isMeal = m.actionType === "meal";
            return (
              <div key={i} style={{ alignSelf: "flex-start", maxWidth: "92%", background: COLORS.card, borderRadius: 16, padding: 14, border: `2px solid ${COLORS.accentMid}` }}>
                <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  {isMeal ? "🍽 Ready to log" : "💪 Ready to log"}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{m.data.name}</div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
                  {isMeal
                    ? `~${m.data.calories} kcal · ${m.data.protein}g P · ${m.data.carbs}g C · ${m.data.fat}g F`
                    : [m.data.type, m.data.duration ? `~${m.data.duration} min` : null, m.data.intensity, m.data.exercises?.length ? `${m.data.exercises.length} exercise${m.data.exercises.length > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ")}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleLog(i)} style={{ flex: 1, padding: "9px 0", background: COLORS.accent, border: "none", borderRadius: 10, color: "#000", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Log it ✓</button>
                  <button onClick={() => handleEdit(i)} style={{ padding: "9px 14px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.text, fontSize: 13, cursor: "pointer" }}>Edit</button>
                  <button onClick={() => handleDismiss(i)} style={{ padding: "9px 12px", background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.muted, fontSize: 13, cursor: "pointer" }}>✕</button>
                </div>
              </div>
            );
          }
          return (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.role === "user" ? COLORS.accent : COLORS.card, color: m.role === "user" ? "#000" : COLORS.text, borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 14px", fontSize: 13, border: m.role === "assistant" ? `1px solid ${COLORS.border}` : "none" }}>
              {m.content}
            </div>
          );
        })}

        {loading && <div style={{ alignSelf: "flex-start", background: COLORS.card, borderRadius: "16px 16px 16px 4px", padding: "10px 14px", fontSize: 13, color: COLORS.muted, border: `1px solid ${COLORS.border}` }}>Thinking . . .</div>}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask or describe a meal / workout . . ." style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 14px", color: COLORS.text, fontSize: 13, outline: "none" }} />
        <button onClick={send} disabled={loading} style={{ padding: "10px 16px", background: COLORS.accent, border: "none", borderRadius: 12, color: "#000", fontWeight: 800, cursor: loading ? "default" : "pointer", opacity: loading ? 0.5 : 1 }}>↑</button>
      </div>
    </div>
  );
}

// ─── Run Tracker ──────────────────────────────────────────────────────────────

function MapAutoCenter({ pos }) {
  const map = useMap();
  useEffect(() => { if (pos) map.setView([pos.lat, pos.lng], map.getZoom()); }, [pos, map]);
  return null;
}

function RunTracker({ profile, onClose, onSave, hkAvailable }) {
  const [runCopied, setRunCopied] = useState(false);
  const [screen, setScreen] = useState("pre");
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);
  const [route, setRoute] = useState([]);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [elevationGain, setElevationGain] = useState(0);
  const [runName, setRunName] = useState("Morning Run");

  const watchId = useRef(null);
  const timerRef = useRef(null);
  const lastSampleTime = useRef(0);
  const lastAlt = useRef(null);
  const runningRef = useRef(false);

  const isMetric = profile.weightUnit !== "lbs";

  const haversine = (a, b) => {
    const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  const totalDistKm = route.length < 2 ? 0 : route.slice(1).reduce((acc, pt, i) => acc + haversine(route[i], pt), 0);
  const displayDist = isMetric ? totalDistKm : totalDistKm * 0.621371;
  const distUnit = isMetric ? "km" : "mi";

  const paceStr = (() => {
    const d = isMetric ? totalDistKm : totalDistKm * 0.621371;
    if (d < 0.05 || elapsed < 5) return "--:--";
    const spu = elapsed / d;
    return `${Math.floor(spu / 60)}:${String(Math.round(spu % 60)).padStart(2, "0")}`;
  })();

  const elapsedStr = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  // GPS watch for pre-run accuracy display
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError("GPS not available on this device."); return; }
    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsError(null);
      },
      err => setGpsError(err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    return () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); clearInterval(timerRef.current); };
  }, []);

  // Timer
  useEffect(() => {
    if (screen === "active" && !paused) {
      timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [screen, paused]);

  const startRun = () => {
    runningRef.current = true;
    lastSampleTime.current = Date.now();
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const now = Date.now();
        setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (!runningRef.current) return;
        if (now - lastSampleTime.current >= 5000) {
          lastSampleTime.current = now;
          const { latitude: lat, longitude: lng, altitude: alt } = pos.coords;
          if (alt != null && lastAlt.current != null && alt > lastAlt.current) {
            setElevationGain(eg => eg + (alt - lastAlt.current));
          }
          lastAlt.current = alt;
          setRoute(prev => [...prev, { lat, lng, alt, t: now }]);
        }
      },
      err => setGpsError(err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    setScreen("active");
  };

  const finishRun = () => {
    runningRef.current = false;
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    clearInterval(timerRef.current);
    setScreen("summary");
  };

  const saveRun = () => {
    const weightKg = profile.weightUnit === "lbs" ? (parseFloat(profile.weight) || 70) * 0.453592 : (parseFloat(profile.weight) || 70);
    const calories = Math.round(totalDistKm * weightKg);
    const now = new Date();
    const runStart = new Date(now.getTime() - elapsed * 1000);
    onSave({
      id: Date.now(),
      type: "Run",
      name: runName,
      date: now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      duration: Math.max(1, Math.round(elapsed / 60)),
      calories,
      sets: 0,
      distance: Math.round(totalDistKm * 100) / 100,
      pace: paceStr,
      elevationGain: elevationGain > 0 ? Math.round(elevationGain) : null,
      route,
      exercises: [],
    });
    // Write to Apple Health / Health Connect if available
    if (hkAvailable && totalDistKm > 0) {
      saveRunToHealth({
        startDate: runStart.toISOString(),
        endDate: now.toISOString(),
        distanceKm: totalDistKm,
        calories,
      }).catch(() => {});
    }
    onClose();
  };

  const routeLatLngs = route.map(p => [p.lat, p.lng]);
  const gpsReady = gpsAccuracy != null && gpsAccuracy <= 30;

  if (screen === "pre") {
    return (
      <div style={{ position: "fixed", inset: 0, background: COLORS.bg, zIndex: 500, display: "flex", flexDirection: "column", padding: 24, paddingTop: "calc(env(safe-area-inset-top, 0px) + 60px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 16px)", left: 16, background: "none", border: "none", color: COLORS.muted, fontSize: 24, cursor: "pointer" }}>✕</button>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
          <div style={{ fontSize: 64 }}>🏃</div>
          <h2 style={{ margin: 0, fontFamily: "'Space Mono',monospace", color: COLORS.text, fontSize: 22 }}>Track a Run</h2>
          {gpsError ? (
            <div style={{ color: COLORS.warn, fontSize: 13, textAlign: "center", maxWidth: 280 }}>{gpsError}</div>
          ) : gpsAccuracy == null ? (
            <div style={{ color: COLORS.muted, fontSize: 13 }}>Acquiring GPS signal...</div>
          ) : (
            <div style={{ color: gpsReady ? COLORS.accent : COLORS.yellow, fontSize: 13, fontWeight: 700 }}>
              {gpsReady ? `GPS ready  ±${gpsAccuracy} m` : `Improving accuracy...  ±${gpsAccuracy} m`}
            </div>
          )}
          {profile.location ? <div style={{ fontSize: 12, color: COLORS.muted }}>📍 {profile.location}</div> : null}
          <button onClick={startRun} disabled={!gpsReady} style={{ padding: "16px 48px", background: gpsReady ? COLORS.accent : COLORS.accentDim, color: gpsReady ? "#000" : COLORS.accent, border: "none", borderRadius: 16, fontWeight: 900, fontSize: 16, cursor: gpsReady ? "pointer" : "default", fontFamily: "'Space Mono',monospace", marginTop: 12 }}>
            Start Run
          </button>
        </div>
      </div>
    );
  }

  if (screen === "active") {
    return (
      <div style={{ position: "fixed", inset: 0, background: COLORS.bg, zIndex: 500, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, position: "relative" }}>
          {currentPos ? (
            <MapContainer center={[currentPos.lat, currentPos.lng]} zoom={16} style={{ height: "100%", width: "100%" }} zoomControl={false} attributionControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {routeLatLngs.length >= 2 && <Polyline positions={routeLatLngs} color={COLORS.accent} weight={5} opacity={0.9} />}
              <MapAutoCenter pos={currentPos} />
            </MapContainer>
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.muted, fontSize: 13 }}>Waiting for GPS...</div>
          )}
          <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 12px)", right: 12, zIndex: 500, background: COLORS.card + "ee", borderRadius: 20, padding: "6px 12px", fontSize: 11, color: paused ? COLORS.yellow : (gpsAccuracy <= 20 ? COLORS.accent : COLORS.yellow), fontWeight: 700, border: `1px solid ${COLORS.border}` }}>
            {paused ? "⏸ Paused" : `● GPS ±${gpsAccuracy ?? "--"} m`}
          </div>
        </div>
        <div style={{ background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, padding: "16px 20px calc(32px + env(safe-area-inset-bottom, 0px))" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: COLORS.text, fontFamily: "'Space Mono',monospace" }}>{displayDist.toFixed(2)}</div>
              <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase" }}>{distUnit}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: COLORS.accent, fontFamily: "'Space Mono',monospace" }}>{paceStr}</div>
              <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase" }}>/{distUnit}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: COLORS.text, fontFamily: "'Space Mono',monospace" }}>{elapsedStr}</div>
              <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase" }}>time</div>
            </div>
          </div>
          {elevationGain > 0 && <div style={{ fontSize: 12, color: COLORS.blue, marginBottom: 10, textAlign: "center" }}>▲ {Math.round(elevationGain)} m elevation gain</div>}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setPaused(p => !p)} style={{ flex: 1, padding: 14, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 14, color: COLORS.text, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
            <button onClick={finishRun} style={{ flex: 1, padding: 14, background: COLORS.accent, border: "none", borderRadius: 14, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              Finish
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Summary
  const weightKg = profile.weightUnit === "lbs" ? (parseFloat(profile.weight) || 70) * 0.453592 : (parseFloat(profile.weight) || 70);
  const calories = Math.round(totalDistKm * weightKg);
  return (
    <div style={{ position: "fixed", inset: 0, background: COLORS.bg, zIndex: 500, overflowY: "auto" }}>
      <div style={{ padding: "20px 20px calc(100px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingTop: "calc(env(safe-area-inset-top, 0px) + 40px)" }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 20, cursor: "pointer", padding: 0 }}>✕</button>
          <h2 style={{ margin: 0, fontFamily: "'Space Mono',monospace", fontSize: 18, color: COLORS.text }}>Run Complete</h2>
          <div style={{ marginLeft: "auto", fontSize: 24 }}>🎉</div>
        </div>
        {routeLatLngs.length >= 2 && (
          <div style={{ height: 200, borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
            <MapContainer center={routeLatLngs[Math.floor(routeLatLngs.length / 2)]} zoom={15} style={{ height: "100%", width: "100%" }} zoomControl={false} attributionControl={false} dragging={false} scrollWheelZoom={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Polyline positions={routeLatLngs} color={COLORS.accent} weight={4} opacity={0.9} />
            </MapContainer>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Distance", value: `${displayDist.toFixed(2)} ${distUnit}`, color: COLORS.accent },
            { label: "Time", value: elapsedStr, color: COLORS.text },
            { label: "Avg Pace", value: `${paceStr}/${distUnit}`, color: COLORS.blue },
            { label: "Calories", value: `${calories} kcal`, color: COLORS.orange },
            ...(elevationGain > 0 ? [{ label: "Elev Gain", value: `${Math.round(elevationGain)} m`, color: COLORS.yellow }] : []),
          ].map(s => (
            <div key={s.label} style={{ background: COLORS.card, borderRadius: 12, padding: 14, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: "'Space Mono',monospace" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2, textTransform: "uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Run Name</label>
          <input value={runName} onChange={e => setRunName(e.target.value)} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 0 }}>
          <button onClick={async () => {
            const text = buildShareText({ type: "Run", name: runName, duration: Math.round(elapsed / 60), distance: Math.round(totalDistKm * 100) / 100, pace: paceStr, calories, elevationGain: Math.round(elevationGain) || 0 });
            const r = await shareWorkout(text, runName);
            if (r === "copied") { setRunCopied(true); setTimeout(() => setRunCopied(false), 2500); }
          }} style={{ flex: 1, padding: 14, background: `${COLORS.blue}18`, border: `1px solid ${COLORS.blue}44`, borderRadius: 14, color: runCopied ? COLORS.accent : COLORS.blue, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {runCopied ? "Copied!" : "↗ Share"}
          </button>
          <button onClick={saveRun} style={{ flex: 2, padding: 14, background: COLORS.accent, border: "none", borderRadius: 14, color: "#000", fontWeight: 900, fontSize: 16, cursor: "pointer", fontFamily: "'Space Mono',monospace" }}>
            Save Run
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Weight Log Components ────────────────────────────────────────────────────

function WeightMiniChart({ entries }) {
  if (entries.length < 2) return null;

  const W = 300, H = 72, PAD = 6;
  const weights = entries.map(e => e.w);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 0.5;

  const toX = i => PAD + (i / (entries.length - 1)) * (W - PAD * 2);
  const toY = w => H - PAD - ((w - minW) / range) * (H - PAD * 2);

  const linePts = entries.map((e, i) => `${toX(i).toFixed(1)},${toY(e.w).toFixed(1)}`).join(" ");
  const first = weights[0], last = weights[weights.length - 1];
  const trendColor = last <= first ? COLORS.accent : COLORS.warn;

  const fillPts = `${toX(0).toFixed(1)},${H} ${linePts} ${toX(entries.length - 1).toFixed(1)},${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block", overflow: "visible" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trendColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill="url(#wfill)" />
      <polyline points={linePts} fill="none" stroke={trendColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={toX(0)} cy={toY(first)} r="4" fill={trendColor} />
      <circle cx={toX(entries.length - 1)} cy={toY(last)} r="4" fill={trendColor} />
    </svg>
  );
}

function LogWeightModal({ onClose, onSave, unit, lastWeight, todayStr }) {
  const [val, setVal] = useState(lastWeight != null ? String(lastWeight) : "");
  const [date, setDate] = useState(todayStr);

  const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", color: COLORS.text, outline: "none", width: "100%", boxSizing: "border-box" };

  const handle = () => {
    const w = parseFloat(val);
    if (!w || w <= 0) return;
    onSave(date, Math.round(w * 10) / 10);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "24px 24px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono',monospace" }}>Log Weight</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: COLORS.muted, lineHeight: 1 }}>×</button>
        </div>
        <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Weight ({unit})</label>
        <input
          type="number" step="0.1" min="20" max="500"
          value={val} onChange={e => setVal(e.target.value)}
          autoFocus
          placeholder={unit === "lbs" ? "e.g. 160" : "e.g. 72"}
          style={{ ...inputStyle, marginBottom: 16, fontSize: 28, fontWeight: 800, fontFamily: "'Space Mono',monospace", textAlign: "center" }}
        />
        <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: 22 }} />
        <button onClick={handle} disabled={!val || isNaN(parseFloat(val))}
          style={{ width: "100%", padding: "14px 0", background: COLORS.accent, color: "#000", border: "none", borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: "pointer", opacity: val ? 1 : 0.5 }}>
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Notification Settings Component ─────────────────────────────────────────

function NotifSettings({ profile, setProfile }) {
  const [perm, setPerm] = useState(getPermission);

  const toggle = (key) => setProfile(p => ({ ...p, [key]: !p[key] }));
  const setTime = (key, val) => setProfile(p => ({ ...p, [key]: val }));

  const handleEnable = async () => {
    const granted = await requestPermission();
    setPerm(granted ? "granted" : "denied");
  };

  const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}` };
  const switchStyle = (on) => ({ width: 44, height: 26, borderRadius: 99, background: on ? COLORS.accent : COLORS.border, border: "none", cursor: "pointer", position: "relative", flexShrink: 0 });
  const thumbStyle = (on) => ({ position: "absolute", top: 3, left: on ? 20 : 3, width: 20, height: 20, borderRadius: "50%", background: on ? "#000" : COLORS.mutedLight, transition: "left 0.2s", boxShadow: "0 1px 3px #0004" });
  const timeStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "5px 10px", color: COLORS.text, fontSize: 13, outline: "none" };

  return (
    <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
      <p style={{ margin: "0 0 14px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Notifications</p>

      {perm === "unsupported" && (
        <p style={{ fontSize: 13, color: COLORS.muted }}>Notifications are not supported in this browser.</p>
      )}

      {perm === "denied" && (
        <div style={{ fontSize: 13, color: COLORS.warn, lineHeight: 1.5 }}>
          Notifications are blocked. Enable them in your browser or device settings, then reload.
        </div>
      )}

      {perm === "default" && (
        <button onClick={handleEnable}
          style={{ width: "100%", padding: "11px 0", background: `${COLORS.accent}18`, border: `1px solid ${COLORS.accent}44`, borderRadius: 12, color: COLORS.accent, fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 4 }}>
          Enable Notifications
        </button>
      )}

      {perm === "granted" && (
        <>
          <div style={rowStyle}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Supplement reminder</div>
              <input type="time" value={profile.notifSupplementTime || "08:00"} onChange={e => setTime("notifSupplementTime", e.target.value)}
                disabled={!profile.notifSupplements} style={{ ...timeStyle, opacity: profile.notifSupplements ? 1 : 0.4, marginTop: 4 }} />
            </div>
            <button onClick={() => toggle("notifSupplements")} style={switchStyle(profile.notifSupplements)}>
              <div style={thumbStyle(profile.notifSupplements)} />
            </button>
          </div>
          <div style={rowStyle}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Hydration check</div>
              <input type="time" value={profile.notifWaterTime || "12:00"} onChange={e => setTime("notifWaterTime", e.target.value)}
                disabled={!profile.notifWater} style={{ ...timeStyle, opacity: profile.notifWater ? 1 : 0.4, marginTop: 4 }} />
            </div>
            <button onClick={() => toggle("notifWater")} style={switchStyle(profile.notifWater)}>
              <div style={thumbStyle(profile.notifWater)} />
            </button>
          </div>
          <div style={{ ...rowStyle, borderBottom: "none" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Meal log reminder</div>
              <input type="time" value={profile.notifMealTime || "18:00"} onChange={e => setTime("notifMealTime", e.target.value)}
                disabled={!profile.notifMeals} style={{ ...timeStyle, opacity: profile.notifMeals ? 1 : 0.4, marginTop: 4 }} />
            </div>
            <button onClick={() => toggle("notifMeals")} style={switchStyle(profile.notifMeals)}>
              <div style={thumbStyle(profile.notifMeals)} />
            </button>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 11, color: COLORS.muted }}>Reminders fire once per day when the app is open.</p>
        </>
      )}
    </div>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

function ProfilePage({ profile, setProfile, isDark, onToggleTheme, onShowTutorial, onSignOut, tourHL, exportData }) {
  const hlProfile = (id) => tourHL === id
    ? { outline: `2px solid ${COLORS.accent}`, outlineOffset: 3, borderRadius: 14, animation: "tourPulse 1.8s ease-in-out infinite" }
    : {};
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);

  const save = () => { setProfile(draft); setEditing(false); };
  const cancel = () => { setDraft(profile); setEditing(false); };

  const inputStyle = {
    background: COLORS.bg, border: `1px solid ${COLORS.border}`,
    borderRadius: 8, padding: "8px 12px", color: COLORS.text,
    fontSize: 13, width: "100%", outline: "none",
  };

  const wKg = profile.weightUnit === "lbs" ? (parseFloat(profile.weight) || 0) * 0.453592 : (parseFloat(profile.weight) || 0);
  const hM  = profile.heightUnit === "in"  ? (parseFloat(profile.height) || 0) * 0.0254 : (parseFloat(profile.height) || 0) / 100;
  const bmi = hM > 0 ? (wKg / (hM * hM)).toFixed(1) : "—";
  const bmiLabel = bmi === "—" ? "" : bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy" : bmi < 30 ? "Overweight" : "Obese";
  const bmiColor = bmi === "—" ? COLORS.muted : bmi < 18.5 ? COLORS.blue : bmi < 25 ? COLORS.accent : bmi < 30 ? COLORS.yellow : COLORS.warn;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono', monospace" }}>Profile</h2>
        {editing
          ? <div style={{ display: "flex", gap: 8 }}>
              <button onClick={cancel} style={{ padding: "8px 14px", background: COLORS.bg, color: COLORS.muted, border: `1px solid ${COLORS.border}`, borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Cancel</button>
              <button onClick={save} style={{ padding: "8px 14px", background: COLORS.accent, color: "#000", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Save</button>
            </div>
          : <button onClick={() => { setDraft(profile); setEditing(true); }} style={{ padding: "8px 14px", background: COLORS.blue, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Edit</button>
        }
      </div>

      <div style={{ background: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 14, border: `1px solid ${COLORS.border}`, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: COLORS.accentDim, border: `2px solid ${COLORS.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 10px" }}>
          {profile.gender === "female" ? "👩" : "🧑"}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>{profile.name || "Your Name"}</div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
          {profile.age ? `${profile.age} yrs` : ""}{profile.age && profile.weight ? " · " : ""}{profile.weight ? `${profile.weight}${profile.weightUnit}` : ""}
        </div>
        {bmi !== "—" && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, background: COLORS.bg, borderRadius: 20, padding: "5px 14px" }}>
            <span style={{ fontSize: 11, color: COLORS.muted }}>BMI</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: bmiColor, fontFamily: "'Space Mono',monospace" }}>{bmi}</span>
            <span style={{ fontSize: 11, color: bmiColor, fontWeight: 600 }}>{bmiLabel}</span>
          </div>
        )}
      </div>

      <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
        <p style={{ margin: "0 0 12px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Personal Info</p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Full Name</label>
          <input value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }} disabled={!editing} placeholder="e.g. Alex Johnson" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Location</label>
          <input value={draft.location || ""} onChange={e => setDraft(p => ({ ...p, location: e.target.value }))} style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }} disabled={!editing} placeholder="City, Country" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Age</label>
          <input type="number" value={draft.age} onChange={e => setDraft(p => ({ ...p, age: e.target.value }))} style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }} disabled={!editing} placeholder="25" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Gender</label>
          <select value={draft.gender} onChange={e => setDraft(p => ({ ...p, gender: e.target.value }))} style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }} disabled={!editing}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Weight</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="number" value={draft.weight} onChange={e => setDraft(p => ({ ...p, weight: e.target.value }))} style={{ ...inputStyle, flex: 1 }} disabled={!editing} placeholder="70" />
              <select value={draft.weightUnit} onChange={e => setDraft(p => ({ ...p, weightUnit: e.target.value }))} style={{ ...inputStyle, width: 58 }} disabled={!editing}>
                <option value="kg">kg</option><option value="lbs">lbs</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Height</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="number" value={draft.height} onChange={e => setDraft(p => ({ ...p, height: e.target.value }))} style={{ ...inputStyle, flex: 1 }} disabled={!editing} placeholder="170" />
              <select value={draft.heightUnit} onChange={e => setDraft(p => ({ ...p, heightUnit: e.target.value }))} style={{ ...inputStyle, width: 54 }} disabled={!editing}>
                <option value="cm">cm</option><option value="in">in</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
        <p style={{ margin: "0 0 12px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Goals & Activity</p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Fitness Goal</label>
          <select value={draft.goal} onChange={e => setDraft(p => ({ ...p, goal: e.target.value }))} style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }} disabled={!editing}>
            <option value="lose">Lose Weight (−500 kcal/day)</option>
            <option value="maintain">Maintain Weight</option>
            <option value="gain">Build Muscle (+300 kcal/day)</option>
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Activity Level</label>
          <select value={draft.activityLevel} onChange={e => setDraft(p => ({ ...p, activityLevel: e.target.value }))} style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }} disabled={!editing}>
            <option value="sedentary">Sedentary (desk job, no exercise)</option>
            <option value="light">Light (1–3 days/week)</option>
            <option value="moderate">Moderate (3–5 days/week)</option>
            <option value="active">Active (6–7 days/week)</option>
            <option value="veryactive">Very Active (athlete/physical job)</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Cheat Days Per Week</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[0, 1, 2, 3].map(n => (
              <button key={n} onClick={() => editing && setDraft(p => ({ ...p, cheatDays: n }))}
                style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: `1px solid ${draft.cheatDays === n ? COLORS.orange : COLORS.border}`, background: draft.cheatDays === n ? COLORS.orange + "22" : COLORS.bg, color: draft.cheatDays === n ? COLORS.orange : COLORS.muted, fontWeight: 800, fontSize: 14, cursor: editing ? "pointer" : "default" }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
        <p style={{ margin: "0 0 12px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Calculated Stats</p>
        {[
          { label: "BMR (Basal Rate)", value: `${Math.round(profile.weight ? (profile.gender === "female" ? 10*(parseFloat(profile.weight)||70)*(profile.weightUnit==="lbs"?0.453592:1) + 6.25*(parseFloat(profile.height)||170)*(profile.heightUnit==="in"?2.54:1) - 5*(parseFloat(profile.age)||25) - 161 : 10*(parseFloat(profile.weight)||70)*(profile.weightUnit==="lbs"?0.453592:1) + 6.25*(parseFloat(profile.height)||170)*(profile.heightUnit==="in"?2.54:1) - 5*(parseFloat(profile.age)||25) + 5) : 0)} kcal`, color: COLORS.purple },
          { label: "TDEE (Maintenance)", value: `${Math.round((profile.weight ? (profile.gender === "female" ? 10*(parseFloat(profile.weight)||70)*(profile.weightUnit==="lbs"?0.453592:1) + 6.25*(parseFloat(profile.height)||170)*(profile.heightUnit==="in"?2.54:1) - 5*(parseFloat(profile.age)||25) - 161 : 10*(parseFloat(profile.weight)||70)*(profile.weightUnit==="lbs"?0.453592:1) + 6.25*(parseFloat(profile.height)||170)*(profile.heightUnit==="in"?2.54:1) - 5*(parseFloat(profile.age)||25) + 5) : 1800) * ({sedentary:1.2,light:1.375,moderate:1.55,active:1.725,veryactive:1.9}[profile.activityLevel]||1.55))} kcal`, color: COLORS.blue },
          { label: "Daily Calorie Target", value: `${Math.max(1200, Math.round((profile.weight ? (profile.gender === "female" ? 10*(parseFloat(profile.weight)||70)*(profile.weightUnit==="lbs"?0.453592:1) + 6.25*(parseFloat(profile.height)||170)*(profile.heightUnit==="in"?2.54:1) - 5*(parseFloat(profile.age)||25) - 161 : 10*(parseFloat(profile.weight)||70)*(profile.weightUnit==="lbs"?0.453592:1) + 6.25*(parseFloat(profile.height)||170)*(profile.heightUnit==="in"?2.54:1) - 5*(parseFloat(profile.age)||25) + 5) : 1800) * ({sedentary:1.2,light:1.375,moderate:1.55,active:1.725,veryactive:1.9}[profile.activityLevel]||1.55)) + ({lose:-500,maintain:0,gain:300}[profile.goal]||0))} kcal`, color: COLORS.accent },
        ].map(row => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: 12, color: COLORS.mutedLight }}>{row.label}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: row.color, fontFamily: "'Space Mono',monospace" }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Appearance */}
      <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
        <p style={{ margin: "0 0 14px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Appearance</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{isDark ? "Dark Mode" : "Light Mode"}</div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Follows your system by default</div>
          </div>
          <button onClick={onToggleTheme}
            style={{ width: 52, height: 30, borderRadius: 99, background: isDark ? COLORS.border : COLORS.accent, border: "none", cursor: "pointer", position: "relative", transition: "background 0.25s" }}>
            <div style={{ position: "absolute", top: 3, left: isDark ? 4 : 22, width: 24, height: 24, borderRadius: "50%", background: isDark ? COLORS.mutedLight : "#fff", transition: "left 0.25s", boxShadow: "0 1px 3px #0004" }} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      <NotifSettings profile={profile} setProfile={setProfile} />

      {/* Export Data */}
      {exportData && (() => {
        const { meals, workouts, waterLog, weightLog, sleepLog, supplements, prs } = exportData;

        const exportMeals = () => downloadCSV(
          "vitalcenter-meals.csv",
          ["Date", "Time", "Name", "Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)"],
          meals.map(m => [m.logged_date ?? "", m.time ?? "", m.name, m.calories, m.protein, m.carbs, m.fat])
        );

        const exportWorkouts = () => {
          const rows = [];
          workouts.forEach(w => {
            if (w.exercises?.length) {
              w.exercises.forEach(ex => rows.push([w.date, w.name, w.type, w.duration, w.calories, ex.name, ex.sets?.length ?? ""]));
            } else {
              rows.push([w.date, w.name, w.type, w.duration, w.calories, "", ""]);
            }
          });
          downloadCSV("vitalcenter-workouts.csv",
            ["Date", "Session", "Type", "Duration (min)", "Est. Calories", "Exercise", "Sets"],
            rows.length ? rows : [["", "", "", "", "", "", ""]]);
        };

        const exportHealth = () => {
          const dates = [...new Set([...Object.keys(waterLog), ...Object.keys(weightLog), ...Object.keys(sleepLog)])].sort();
          downloadCSV("vitalcenter-health-metrics.csv",
            ["Date", `Weight (${profile.weightUnit})`, "Water (ml)", "Sleep (hours)", "Sleep Quality"],
            dates.map(d => [d, weightLog[d] ?? "", waterLog[d] ?? "", sleepLog[d]?.hours ?? "", sleepLog[d]?.quality ?? ""]));
        };

        const exportSupplements = () => {
          const allDates = [...new Set(supplements.flatMap(s => Object.keys(s.history || {})))].sort().slice(-30);
          downloadCSV("vitalcenter-supplements.csv",
            ["Supplement", "Dose", "Timing", ...allDates],
            supplements.map(s => [s.name, s.dose ?? "", s.timing ?? "", ...allDates.map(d => s.history?.[d] ? "1" : "0")]));
        };

        const exportPRs = () => downloadCSV(
          "vitalcenter-personal-records.csv",
          ["Exercise", "Best 1RM (kg)", "Best Weight (kg)", "Best Reps", "Date"],
          Object.entries(prs).map(([name, r]) => [name, r.best1rm, r.bestWeight, r.bestReps, r.date ?? ""])
        );

        const btnStyle = { width: "100%", padding: "11px 0", background: `${COLORS.blue}14`, border: `1px solid ${COLORS.blue}33`, borderRadius: 11, color: COLORS.blue, fontWeight: 700, fontSize: 13, cursor: "pointer", textAlign: "left", paddingLeft: 14, display: "flex", alignItems: "center", gap: 10 };

        return (
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Export Data</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: "🥗", label: "Meals",             action: exportMeals,       disabled: meals.length === 0 },
                { icon: "💪", label: "Workouts",          action: exportWorkouts,    disabled: workouts.length === 0 },
                { icon: "📈", label: "Health Metrics",    action: exportHealth,      disabled: !Object.keys({ ...waterLog, ...weightLog, ...sleepLog }).length },
                { icon: "💊", label: "Supplements",       action: exportSupplements, disabled: supplements.length === 0 },
                { icon: "🏆", label: "Personal Records",  action: exportPRs,         disabled: Object.keys(prs).length === 0 },
              ].map(({ icon, label, action, disabled }) => (
                <button key={label} onClick={action} disabled={disabled}
                  style={{ ...btnStyle, opacity: disabled ? 0.4 : 1, cursor: disabled ? "default" : "pointer" }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span style={{ flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 11, color: COLORS.muted, marginRight: 4 }}>{disabled ? "No data" : "↓ CSV"}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Help */}
      <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}`, ...hlProfile("help-section") }}>
        <p style={{ margin: "0 0 14px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Help</p>
        <button onClick={onShowTutorial}
          style={{ width: "100%", padding: "11px 0", background: `${COLORS.blue}18`, border: `1px solid ${COLORS.blue}44`, borderRadius: 12, color: COLORS.blue, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          View App Tutorial
        </button>
        {onSignOut && (
          <button onClick={onSignOut}
            style={{ width: "100%", padding: "11px 0", background: `${COLORS.warn}18`, border: `1px solid ${COLORS.warn}44`, borderRadius: 12, color: COLORS.warn, fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 10 }}>
            Sign Out
          </button>
        )}
        <button
          onClick={() => { if (window.confirm("Reset all local data? This cannot be undone.")) { localStorage.clear(); window.location.reload(); } }}
          style={{ width: "100%", padding: "11px 0", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 12, color: COLORS.muted, fontWeight: 600, fontSize: 13, cursor: "pointer", marginTop: 10 }}>
          Reset Local Data
        </button>
      </div>
    </div>
  );
}

// ─── Add Supplement Modal ─────────────────────────────────────────────────────

function AddSupplementModal({ onClose, onAdd }) {
  const EMOJI_OPTIONS = ["💊","🍊","🐟","⚡","☀️","🌙","🧴","🫒","🧬","🌿","🍋","🫐","🥩","🧪","💪"];
  const COLOR_OPTIONS = [COLORS.blue, COLORS.accent, COLORS.yellow, COLORS.orange, COLORS.purple, COLORS.warn];
  const [form, setForm] = useState({ name: "", emoji: "💊", dose: "", timing: "Morning", category: "Vitamin", color: COLORS.blue, benefit: "" });
  const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, width: "100%", outline: "none", marginTop: 6 };
  const handle = () => {
    if (!form.name.trim()) return;
    onAdd({ id: Date.now(), ...form, history: {} });
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Add Supplement</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Icon</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {EMOJI_OPTIONS.map(e => (
              <button key={e} onClick={() => setForm(p => ({ ...p, emoji: e }))}
                style={{ width: 38, height: 38, borderRadius: 9, border: `2px solid ${form.emoji === e ? COLORS.accent : COLORS.border}`, background: form.emoji === e ? COLORS.accentDim : COLORS.bg, fontSize: 18, cursor: "pointer" }}>{e}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Name</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="e.g. Creatine" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Dose</label>
          <input value={form.dose} onChange={e => setForm(p => ({ ...p, dose: e.target.value }))} style={inputStyle} placeholder="e.g. 5g, 2000mg, 1 capsule" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Timing</label>
          <select value={form.timing} onChange={e => setForm(p => ({ ...p, timing: e.target.value }))} style={{ ...inputStyle }}>
            {["Morning","Pre-workout","Post-workout","With breakfast","With meals","Before bed","Throughout day"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Category</label>
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...inputStyle }}>
            {["Vitamin","Mineral","Protein","Performance","Omega-3","Healthy Fat","Herb","Probiotic","Other"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Colour</label>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            {COLOR_OPTIONS.map(c => (
              <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${form.color === c ? COLORS.text : "transparent"}`, cursor: "pointer" }} />
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Benefit (optional)</label>
          <input value={form.benefit} onChange={e => setForm(p => ({ ...p, benefit: e.target.value }))} style={inputStyle} placeholder="e.g. Strength & muscle" />
        </div>
        <button onClick={handle} style={{ width: "100%", padding: 13, background: form.name.trim() ? COLORS.accent : COLORS.border, border: "none", borderRadius: 14, color: form.name.trim() ? "#000" : COLORS.muted, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Add Supplement</button>
      </div>
    </div>
  );
}

// ─── Food Database Search Modal (Open Food Facts) ────────────────────────────

function FoodSearchModal({ onClose, onAdd }) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [selected, setSelected] = useState(null); // product being portioned
  const [grams, setGrams]       = useState("100");
  const timerRef = useRef(null);

  const search = (q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    setError(null);
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=15&fields=product_name,brands,serving_size,nutriments`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const items = (data.products || []).filter(p => p.product_name?.trim());
        setResults(items);
        if (!items.length) setError("No results found.");
      })
      .catch(() => setError("Search failed — check your connection."))
      .finally(() => setLoading(false));
  };

  const handleInput = (val) => {
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 450);
  };

  const pick = (product) => {
    const n = product.nutriments || {};
    const serving = parseFloat(product.serving_size) || 100;
    setGrams(String(serving));
    setSelected({ product, n100: {
      kcal:    n["energy-kcal_100g"]    ?? n["energy_100g"] / 4.184 ?? 0,
      protein: n["proteins_100g"]       ?? 0,
      carbs:   n["carbohydrates_100g"]  ?? 0,
      fat:     n["fat_100g"]            ?? 0,
    }});
  };

  const addToLog = () => {
    const g = parseFloat(grams) || 100;
    const ratio = g / 100;
    const { n100, product } = selected;
    onAdd({
      id: Date.now(),
      name: product.product_name,
      img: "🍽️",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      calories: Math.round(n100.kcal    * ratio),
      protein:  Math.round(n100.protein * ratio),
      carbs:    Math.round(n100.carbs   * ratio),
      fat:      Math.round(n100.fat     * ratio),
    });
    onClose();
  };

  const inputStyle = {
    background: COLORS.bg, border: `1px solid ${COLORS.border}`,
    borderRadius: 10, padding: "10px 14px", color: COLORS.text,
    fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "20px 20px 0", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          {selected
            ? <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: COLORS.accent, fontWeight: 700, fontSize: 14, cursor: "pointer", padding: 0 }}>← Back</button>
            : <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, fontFamily: "'Space Mono',monospace" }}>Search Food</h3>
          }
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: COLORS.muted, lineHeight: 1 }}>×</button>
        </div>

        {!selected ? (
          <>
            {/* Search input */}
            <input
              autoFocus
              placeholder="e.g. Greek yogurt, brown rice, banana…"
              value={query}
              onChange={e => handleInput(e.target.value)}
              style={{ ...inputStyle, marginBottom: 12 }}
            />

            {/* Results */}
            <div style={{ overflowY: "auto", flex: 1, paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
              {loading && <div style={{ textAlign: "center", padding: 24, color: COLORS.muted, fontSize: 13 }}>Searching…</div>}
              {!loading && error && <div style={{ textAlign: "center", padding: 24, color: COLORS.muted, fontSize: 13 }}>{error}</div>}
              {!loading && !error && results.length === 0 && query.trim() && (
                <div style={{ textAlign: "center", padding: 24, color: COLORS.muted, fontSize: 13 }}>Type to search the Open Food Facts database</div>
              )}
              {!loading && !error && results.length === 0 && !query.trim() && (
                <div style={{ textAlign: "center", padding: 32, color: COLORS.muted, fontSize: 13, lineHeight: 1.7 }}>
                  Search over 3 million foods from the Open Food Facts database. Macros auto-fill from the database.
                </div>
              )}
              {results.map((p, i) => {
                const n = p.nutriments || {};
                const kcal    = Math.round(n["energy-kcal_100g"]   ?? (n["energy_100g"] / 4.184) ?? 0);
                const protein = Math.round(n["proteins_100g"]      ?? 0);
                const carbs   = Math.round(n["carbohydrates_100g"] ?? 0);
                const fat     = Math.round(n["fat_100g"]           ?? 0);
                return (
                  <button key={i} onClick={() => pick(p)}
                    style={{ width: "100%", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, textAlign: "left", cursor: "pointer", display: "block" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 3, lineHeight: 1.3 }}>{p.product_name}</div>
                    {p.brands && <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>{p.brands.split(",")[0]}</div>}
                    <div style={{ display: "flex", gap: 10, fontSize: 11, color: COLORS.mutedLight }}>
                      <span style={{ color: COLORS.yellow, fontWeight: 700 }}>{kcal} kcal</span>
                      <span>P {protein}g</span>
                      <span>C {carbs}g</span>
                      <span>F {fat}g</span>
                      <span style={{ marginLeft: "auto", color: COLORS.muted }}>per 100g</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          /* Portion screen */
          <div style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px))", overflowY: "auto" }}>
            <div style={{ background: COLORS.card, borderRadius: 14, padding: "14px 16px", marginBottom: 18, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, marginBottom: 2 }}>{selected.product.product_name}</div>
              {selected.product.brands && <div style={{ fontSize: 12, color: COLORS.muted }}>{selected.product.brands.split(",")[0]}</div>}
            </div>

            <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Amount (grams)</label>
            <input
              type="number" min="1" max="2000" step="1"
              value={grams} onChange={e => setGrams(e.target.value)}
              autoFocus
              style={{ ...inputStyle, fontSize: 26, fontWeight: 800, fontFamily: "'Space Mono',monospace", textAlign: "center", marginBottom: 18 }}
            />

            {/* Adjusted macro preview */}
            {(() => {
              const g = parseFloat(grams) || 0;
              const r = g / 100;
              const { n100 } = selected;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 22 }}>
                  {[
                    { label: "Calories", value: Math.round(n100.kcal * r),    unit: "kcal", color: COLORS.yellow  },
                    { label: "Protein",  value: Math.round(n100.protein * r), unit: "g",    color: COLORS.accent  },
                    { label: "Carbs",    value: Math.round(n100.carbs * r),   unit: "g",    color: COLORS.blue    },
                    { label: "Fat",      value: Math.round(n100.fat * r),     unit: "g",    color: COLORS.orange  },
                  ].map(m => (
                    <div key={m.label} style={{ background: COLORS.card, borderRadius: 10, padding: "10px 6px", textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: m.color, fontFamily: "'Space Mono',monospace" }}>{m.value}</div>
                      <div style={{ fontSize: 9, color: COLORS.muted }}>{m.unit}</div>
                      <div style={{ fontSize: 9, color: COLORS.mutedLight, marginTop: 1, fontWeight: 600 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <button onClick={addToLog} disabled={!grams || parseFloat(grams) <= 0}
              style={{ width: "100%", padding: "14px 0", background: COLORS.accent, color: "#000", border: "none", borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
              Add to Log
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Manual Meal Modal ────────────────────────────────────────────────────────

function ManualMealModal({ onClose, onAdd, initialValues }) {
  const EMOJI_OPTIONS = ["🍗","🥩","🐟","🥗","🍝","🥣","🥤","🍳","🥙","🍱","🫐","🍎","🥑","🍌","🍽️"];
  const [form, setForm] = useState({
    name: initialValues?.name || "",
    img: "🍽️",
    calories: initialValues?.calories != null ? String(initialValues.calories) : "",
    protein: initialValues?.protein != null ? String(initialValues.protein) : "",
    carbs: initialValues?.carbs != null ? String(initialValues.carbs) : "",
    fat: initialValues?.fat != null ? String(initialValues.fat) : "",
  });
  const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, width: "100%", outline: "none", marginTop: 6 };
  const handle = () => {
    if (!form.name.trim() || !form.calories) return;
    onAdd({ id: Date.now(), name: form.name, img: form.img, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), calories: parseInt(form.calories) || 0, protein: parseInt(form.protein) || 0, carbs: parseInt(form.carbs) || 0, fat: parseInt(form.fat) || 0 });
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Log Meal Manually</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Icon</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {EMOJI_OPTIONS.map(e => (
              <button key={e} onClick={() => setForm(p => ({ ...p, img: e }))}
                style={{ width: 38, height: 38, borderRadius: 9, border: `2px solid ${form.img === e ? COLORS.accent : COLORS.border}`, background: form.img === e ? COLORS.accentDim : COLORS.bg, fontSize: 18, cursor: "pointer" }}>{e}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Meal Name</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="e.g. Grilled Chicken" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Calories (kcal)</label>
          <input type="number" value={form.calories} onChange={e => setForm(p => ({ ...p, calories: e.target.value }))} style={inputStyle} placeholder="e.g. 450" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[["Protein (g)", "protein"], ["Carbs (g)", "carbs"], ["Fat (g)", "fat"]].map(([label, key]) => (
            <div key={key}>
              <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 6 }}>{label}</label>
              <input type="number" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={{ ...inputStyle, marginTop: 0 }} placeholder="0" />
            </div>
          ))}
        </div>
        <button onClick={handle} style={{ width: "100%", padding: 13, background: (form.name.trim() && form.calories) ? COLORS.accent : COLORS.border, border: "none", borderRadius: 14, color: (form.name.trim() && form.calories) ? "#000" : COLORS.muted, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Log Meal</button>
      </div>
    </div>
  );
}

// ─── Active Workout Session ───────────────────────────────────────────────────
// Driven by App-level session state so the timer persists across tab switches.

function ActiveWorkoutSession({ session, setSession, sessionElapsed, restLeft, resting, onFinish, onClose }) {
  const [showSummary, setShowSummary] = useState(false);
  const [allDonePrompt, setAllDonePrompt] = useState(false);
  const [sessionCopied, setSessionCopied] = useState(false);
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const estCals = Math.round((sessionElapsed / 3600) * 4.5 * (session.userWeightKg || 70));

  const updateEx = (idx, updater) => setSession(s => ({ ...s, exercises: s.exercises.map((e, i) => i === idx ? updater(e) : e) }));
  const addExercise = () => setSession(s => ({ ...s, exercises: [...s.exercises, { name: "", sets: [], collapsed: false }] }));
  const removeExercise = idx => setSession(s => ({ ...s, exercises: s.exercises.filter((_, i) => i !== idx) }));

  const addSet = idx => {
    const ex = session.exercises[idx];
    const last = ex.sets[ex.sets.length - 1];
    updateEx(idx, e => ({ ...e, sets: [...e.sets, { id: Date.now(), reps: last?.reps || "", weight: last?.weight || "", done: false }] }));
  };
  const updateSetField = (exIdx, setId, field, val) => updateEx(exIdx, e => ({ ...e, sets: e.sets.map(s => s.id === setId ? { ...s, [field]: val } : s) }));
  const removeSet = (exIdx, setId) => updateEx(exIdx, e => ({ ...e, sets: e.sets.filter(s => s.id !== setId) }));

  const completeSet = (exIdx, setId) => {
    const ex = session.exercises[exIdx];
    const updatedSets = ex.sets.map(s => s.id === setId ? { ...s, done: true } : s);
    const allDone = updatedSets.every(s => s.done) && updatedSets.length > 0;
    setSession(s => ({
      ...s,
      restStartedAt: Date.now(),
      exercises: s.exercises.map((e, i) => i === exIdx ? { ...e, sets: updatedSets, collapsed: allDone } : e),
    }));
    if (allDone) {
      const rest = session.exercises.filter((_, i) => i !== exIdx);
      if (rest.every(e => e.collapsed || (e.sets.length > 0 && e.sets.every(s => s.done)))) {
        setTimeout(() => setAllDonePrompt(true), 600);
      }
    }
  };

  const skipRest = () => setSession(s => ({ ...s, restStartedAt: null }));
  const addRestTime = extra => setSession(s => ({ ...s, restStartedAt: s.restStartedAt ? s.restStartedAt - extra * 1000 : null }));

  const validExercises = session.exercises
    .filter(e => e.name.trim() && e.sets.some(s => s.done))
    .map(e => ({ name: e.name, sets: e.sets.filter(s => s.done).map(s => ({ reps: s.reps, weight: s.weight })) }));
  const totalSets = validExercises.reduce((a, e) => a + e.sets.length, 0);
  const durationMin = Math.max(1, Math.round(sessionElapsed / 60));

  const cellInput = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 6px", color: COLORS.text, fontSize: 13, textAlign: "center", outline: "none", width: "100%" };

  if (showSummary) return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))", maxHeight: "92vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, fontFamily: "'Space Mono',monospace" }}>Session Complete 🏁</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[{ l: "Duration", v: `${durationMin}m`, c: COLORS.blue }, { l: "Est. Calories", v: `${estCals} kcal`, c: COLORS.yellow }, { l: "Exercises", v: validExercises.length, c: COLORS.accent }, { l: "Total Sets", v: totalSets, c: COLORS.purple }].map(x => (
            <div key={x.l} style={{ background: COLORS.card, borderRadius: 12, padding: 14, border: `1px solid ${COLORS.border}`, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: x.c, fontFamily: "'Space Mono',monospace" }}>{x.v}</div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{x.l}</div>
            </div>
          ))}
        </div>
        {validExercises.map((e, i) => (
          <div key={i} style={{ background: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 8, border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent, marginBottom: 6 }}>{e.name}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {e.sets.map((s, j) => (
                <div key={j} style={{ background: COLORS.bg, borderRadius: 6, padding: "3px 9px", fontSize: 11, color: COLORS.text, fontFamily: "'Space Mono',monospace" }}>
                  <span style={{ color: COLORS.muted }}>S{j+1} </span>{s.reps}<span style={{ color: COLORS.muted }}>×</span><span style={{ color: COLORS.yellow }}>{s.weight}kg</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={() => setShowSummary(false)} style={{ flex: 1, padding: 12, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 14, color: COLORS.muted, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Back</button>
          <button onClick={async () => {
            const text = buildShareText({ type: session.sessionType || "Strength", name: session.sessionName || "Workout", duration: durationMin, calories: estCals, sets: totalSets, exercises: validExercises });
            const r = await shareWorkout(text, session.sessionName || "Workout");
            if (r === "copied") { setSessionCopied(true); setTimeout(() => setSessionCopied(false), 2500); }
          }} style={{ padding: "12px 14px", background: `${COLORS.blue}18`, border: `1px solid ${COLORS.blue}44`, borderRadius: 14, color: sessionCopied ? COLORS.accent : COLORS.blue, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            {sessionCopied ? "Copied!" : "↗ Share"}
          </button>
          <button onClick={() => onFinish({ durationMin, estCals, validExercises, totalSets })} style={{ flex: 2, padding: 13, background: COLORS.accent, border: "none", borderRadius: 14, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Save Session</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))", maxHeight: "92vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <input value={session.sessionName} onChange={e => setSession(s => ({ ...s, sessionName: e.target.value }))} placeholder="Session name..."
              style={{ background: "transparent", border: "none", color: COLORS.text, fontSize: 15, fontWeight: 800, outline: "none", fontFamily: "'Space Mono',monospace", width: 210, marginBottom: 4 }} />
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 26, fontWeight: 800, color: COLORS.accent }}>{fmt(sessionElapsed)}</span>
              <span style={{ fontSize: 13, color: COLORS.yellow }}>🔥 {estCals} kcal</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={onClose} style={{ padding: "8px 10px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.muted, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>— Min</button>
            <button onClick={() => setShowSummary(true)} style={{ padding: "8px 12px", background: COLORS.warn, border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>Finish</button>
          </div>
        </div>

        {/* Rest preset row */}
        <div style={{ display: "flex", gap: 5, marginBottom: 14, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: COLORS.muted, fontWeight: 700, whiteSpace: "nowrap" }}>REST:</span>
          {[30, 60, 90, 120, 180].map(s => (
            <button key={s} onClick={() => setSession(sess => ({ ...sess, restTotal: s }))}
              style={{ flex: 1, padding: "5px 0", borderRadius: 7, border: `1px solid ${session.restTotal === s ? COLORS.blue : COLORS.border}`, background: session.restTotal === s ? COLORS.blue + "22" : "transparent", color: session.restTotal === s ? COLORS.blue : COLORS.muted, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>

        {/* Rest Timer */}
        {resting && (
          <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 14, border: `2px solid ${COLORS.blue}`, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: COLORS.blue, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Rest</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: COLORS.text, fontFamily: "'Space Mono',monospace", lineHeight: 1 }}>{fmt(restLeft)}</div>
            <div style={{ height: 3, background: COLORS.border, borderRadius: 99, margin: "10px 0", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(restLeft / session.restTotal) * 100}%`, background: COLORS.blue, borderRadius: 99, transition: "width 1s linear" }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => addRestTime(30)} style={{ padding: "6px 12px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.mutedLight, fontSize: 12, cursor: "pointer" }}>+30s</button>
              <button onClick={skipRest} style={{ padding: "6px 16px", background: COLORS.accentDim, border: `1px solid ${COLORS.accentMid}`, borderRadius: 8, color: COLORS.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Skip →</button>
            </div>
          </div>
        )}

        {/* All-done prompt */}
        {allDonePrompt && (
          <div style={{ background: COLORS.accent + "18", border: `1px solid ${COLORS.accent}55`, borderRadius: 14, padding: 14, marginBottom: 14, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.accent, marginBottom: 8 }}>All sets complete! 🎉</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => setAllDonePrompt(false)} style={{ padding: "8px 16px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Keep Going</button>
              <button onClick={() => setShowSummary(true)} style={{ padding: "8px 18px", background: COLORS.accent, border: "none", borderRadius: 10, color: "#000", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Finish Session</button>
            </div>
          </div>
        )}

        {/* Exercises */}
        {session.exercises.map((ex, idx) => {
          const nextIdx = ex.sets.findIndex(s => !s.done);

          if (ex.collapsed) {
            return (
              <div key={idx} style={{ background: COLORS.card, borderRadius: 14, padding: 12, marginBottom: 10, border: `1px solid ${COLORS.accent}44` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: COLORS.accent, fontSize: 14 }}>✓</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{ex.name}</span>
                  </div>
                  <button onClick={() => updateEx(idx, e => ({ ...e, collapsed: false }))} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 11, cursor: "pointer", padding: "2px 6px" }}>Edit</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {ex.sets.map((s, j) => (
                    <div key={j} style={{ background: COLORS.accentDim, borderRadius: 6, padding: "3px 9px", fontSize: 11, color: COLORS.accent, fontFamily: "'Space Mono',monospace", border: `1px solid ${COLORS.accentMid}` }}>
                      S{j+1} {s.reps}×{s.weight}kg
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div key={idx} style={{ background: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                <input value={ex.name} onChange={e => updateEx(idx, ex => ({ ...ex, name: e.target.value }))}
                  style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 10px", color: COLORS.text, fontSize: 13, flex: 1, outline: "none", fontWeight: 700 }} placeholder="Exercise name..." />
                {session.exercises.length > 1 && <button onClick={() => removeExercise(idx)} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 16, cursor: "pointer", padding: "0 4px" }}>✕</button>}
              </div>

              {ex.sets.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 34px 24px", gap: 6, marginBottom: 4 }}>
                    <div /><div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 700, textAlign: "center" }}>REPS</div>
                    <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 700, textAlign: "center" }}>KG</div><div /><div />
                  </div>
                  {ex.sets.map((set, si) => {
                    const isActive = si === nextIdx;
                    const isDone = set.done;
                    const isLocked = !isDone && !isActive;
                    return (
                      <div key={set.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 34px 24px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                        <div style={{ fontSize: 10, color: isDone ? COLORS.accent : COLORS.muted, fontWeight: 700, textAlign: "center" }}>S{si+1}</div>
                        <input type="number" value={set.reps} onChange={e => updateSetField(idx, set.id, "reps", e.target.value)} disabled={isDone}
                          style={{ ...cellInput, border: `1px solid ${isDone ? COLORS.accent + "44" : COLORS.border}`, color: isDone ? COLORS.muted : COLORS.text, opacity: isLocked ? 0.45 : 1 }} placeholder="—" />
                        <input type="number" value={set.weight} onChange={e => updateSetField(idx, set.id, "weight", e.target.value)} disabled={isDone}
                          style={{ ...cellInput, border: `1px solid ${isDone ? COLORS.accent + "44" : COLORS.border}`, color: isDone ? COLORS.muted : COLORS.text, opacity: isLocked ? 0.45 : 1 }} placeholder="—" />
                        <button disabled={!isActive} onClick={() => isActive && completeSet(idx, set.id)}
                          style={{ width: 32, height: 32, borderRadius: 8, border: `2px solid ${isDone ? COLORS.accent : isActive ? COLORS.accent : COLORS.border}`, background: isDone ? COLORS.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: isActive ? "pointer" : "default", opacity: isLocked ? 0.3 : 1 }}>
                          {isDone && <span style={{ color: "#000", fontSize: 14, fontWeight: 900 }}>✓</span>}
                        </button>
                        {!isDone ? (
                          <button onClick={() => removeSet(idx, set.id)}
                            style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "transparent", color: COLORS.muted, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                            ✕
                          </button>
                        ) : <div />}
                      </div>
                    );
                  })}
                </div>
              )}
              <button onClick={() => addSet(idx)}
                style={{ width: "100%", padding: "7px 0", background: "transparent", border: `1px dashed ${COLORS.border}`, borderRadius: 8, color: COLORS.mutedLight, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                + Add Set
              </button>
            </div>
          );
        })}
        <button onClick={addExercise} style={{ width: "100%", padding: 10, background: COLORS.bg, border: `1px dashed ${COLORS.border}`, borderRadius: 12, color: COLORS.mutedLight, cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>+ Add Exercise</button>
      </div>
    </div>
  );
}

// ─── Session Start Prompt ─────────────────────────────────────────────────────
function SessionStartPrompt({ todayRoutine, onUseRoutine, onFresh, onClose }) {
  const typeColor = ROUTINE_TYPE_COLOR[todayRoutine.type] || COLORS.accent;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Start Session</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ background: typeColor + "18", border: `1px solid ${typeColor}44`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: typeColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Today&apos;s Routine</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, marginBottom: 8 }}>{todayRoutine.name}</div>
          {(todayRoutine.exercises || []).map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: COLORS.mutedLight, marginBottom: 3, display: "flex", gap: 6 }}>
              <span style={{ color: typeColor }}>·</span>
              <span>{e.name}{(e.sets || e.reps) ? ` — ${[e.sets && `${e.sets} sets`, e.reps && `${e.reps} reps`, e.weight && `@ ${e.weight}kg`].filter(Boolean).join(", ")}` : ""}</span>
            </div>
          ))}
        </div>
        <button onClick={onUseRoutine}
          style={{ width: "100%", padding: 13, background: typeColor, border: "none", borderRadius: 14, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer", marginBottom: 8 }}>
          Use Today&apos;s Routine
        </button>
        <button onClick={onFresh}
          style={{ width: "100%", padding: 12, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 14, color: COLORS.mutedLight, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Start Fresh
        </button>
      </div>
    </div>
  );
}

// ─── Sleep Logger ─────────────────────────────────────────────────────────────

const SLEEP_QUALITY = [
  { id: "poor",  label: "Poor",  emoji: "😴", color: () => COLORS.warn   },
  { id: "fair",  label: "Fair",  emoji: "😐", color: () => COLORS.yellow },
  { id: "good",  label: "Good",  emoji: "🙂", color: () => COLORS.accent },
  { id: "great", label: "Great", emoji: "😄", color: () => COLORS.blue   },
];

function LogSleepModal({ existing, onClose, onSave }) {
  const [hours, setHours] = useState(existing?.hours?.toString() || "");
  const [quality, setQuality] = useState(existing?.quality || "good");

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", background: COLORS.surface, borderRadius: "20px 20px 0 0", padding: "20px 20px calc(24px + env(safe-area-inset-bottom,0px))", border: `1px solid ${COLORS.border}` }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono',monospace" }}>Log Sleep</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Hours slept</label>
        <input type="number" inputMode="decimal" placeholder="e.g. 7.5" step="0.5" min="0" max="24" value={hours}
          onChange={e => setHours(e.target.value)}
          style={{ width: "100%", marginTop: 8, marginBottom: 18, padding: "12px 14px", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, color: COLORS.text, fontSize: 22, fontWeight: 800, fontFamily: "'Space Mono',monospace", outline: "none" }} />

        <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sleep quality</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 8, marginBottom: 22 }}>
          {SLEEP_QUALITY.map(q => (
            <button key={q.id} onClick={() => setQuality(q.id)}
              style={{ padding: "10px 4px", borderRadius: 12, border: `2px solid ${quality === q.id ? q.color() : COLORS.border}`, background: quality === q.id ? `${q.color()}18` : COLORS.card, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 22 }}>{q.emoji}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: quality === q.id ? q.color() : COLORS.muted }}>{q.label}</span>
            </button>
          ))}
        </div>

        <div style={{ background: `${COLORS.blue}12`, border: `1px solid ${COLORS.blue}30`, borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}></span>
          <span style={{ fontSize: 12, color: COLORS.muted }}>Apple Health sync coming soon — your logs are safe here.</span>
        </div>

        <button
          onClick={() => { const h = parseFloat(hours); if (h > 0 && h <= 24) { onSave({ hours: h, quality }); onClose(); } }}
          style={{ width: "100%", padding: 14, background: COLORS.blue, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
          Save Sleep
        </button>
      </div>
    </div>
  );
}

// ─── Water Tracker ────────────────────────────────────────────────────────────

const WATER_QUICK = [
  { ml: 250, label: "250ml", icon: "🥛" },
  { ml: 500, label: "500ml", icon: "💧" },
  { ml: 750, label: "750ml", icon: "🍶" },
  { ml: 1000, label: "1L", icon: "🫙" },
];

function WaterCard({ waterToday, waterGoal, onAdd, onReset }) {
  const [customMl, setCustomMl] = useState("");
  const pct = Math.min(waterToday / waterGoal, 1);
  const remaining = Math.max(waterGoal - waterToday, 0);
  const fmtMl = ml => ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)}L` : `${ml}ml`;

  return (
    <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>💧 Water Intake</p>
        <button onClick={onReset} style={{ fontSize: 10, padding: "3px 8px", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.muted, cursor: "pointer" }}>Reset day</button>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 38, fontWeight: 800, fontFamily: "'Space Mono',monospace", color: COLORS.blue, lineHeight: 1 }}>{fmtMl(waterToday)}</span>
        <span style={{ fontSize: 14, color: COLORS.muted, paddingBottom: 4 }}>/ {fmtMl(waterGoal)} goal</span>
      </div>

      {/* Fill bar */}
      <div style={{ height: 10, background: COLORS.bg, borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, background: "linear-gradient(90deg,#4d9fff,#00c3ff)", borderRadius: 99, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: COLORS.blue, fontWeight: 700 }}>{Math.round(pct * 100)}%</span>
        <span style={{ fontSize: 11, color: COLORS.muted }}>{remaining > 0 ? `${fmtMl(remaining)} to go` : "Goal reached 🎉"}</span>
      </div>

      {/* Quick add */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
        {WATER_QUICK.map(q => (
          <button key={q.ml} onClick={() => onAdd(q.ml)}
            style={{ padding: "10px 4px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "border-color 0.15s" }}>
            <span style={{ fontSize: 20 }}>{q.icon}</span>
            <span style={{ fontSize: 10, color: COLORS.mutedLight, fontWeight: 700 }}>{q.label}</span>
          </button>
        ))}
      </div>

      {/* Custom amount */}
      <div style={{ display: "flex", gap: 8 }}>
        <input type="number" inputMode="numeric" placeholder="Custom ml…" value={customMl}
          onChange={e => setCustomMl(e.target.value)}
          style={{ flex: 1, padding: "9px 12px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.text, fontSize: 13, outline: "none" }} />
        <button onClick={() => { const v = parseInt(customMl); if (v > 0) { onAdd(v); setCustomMl(""); } }}
          style={{ padding: "9px 16px", background: `${COLORS.blue}22`, border: `1px solid ${COLORS.blue}`, borderRadius: 10, color: COLORS.blue, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
          + Add
        </button>
      </div>
    </div>
  );
}

// ─── Progress Photos ───────────────────────────────────────────────────────────

const MAX_PHOTOS_PER_DAY = 5;

function AddPhotoModal({ onClose, onAdd, targetDate, existingCount = 0 }) {
  const [phase, setPhase] = useState("idle");
  const [preview, setPreview] = useState(null);
  const [blob, setBlob] = useState(null);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const fileRef = useRef();

  const displayDate = new Date(targetDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const remaining = MAX_PHOTOS_PER_DAY - existingCount;

  async function handleFile(file) {
    if (!file) return;
    setPhase("compressing");
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.2, maxWidthOrHeight: 1080, useWebWorker: true, fileType: "image/jpeg" });
      setBlob(compressed);
      setPreview(URL.createObjectURL(compressed));
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }

  async function handleSave() {
    if (!blob) return;
    const id = `photo_${Date.now()}`;
    await savePhoto(id, blob);
    onAdd({
      id,
      date: targetDate,
      dateStr: new Date(targetDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      weight: weight ? parseFloat(weight) : null,
      notes: notes.trim(),
    });
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", background: COLORS.surface, borderRadius: "20px 20px 0 0", padding: "20px 20px calc(20px + env(safe-area-inset-bottom,0px))", border: `1px solid ${COLORS.border}` }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono',monospace" }}>Progress Photo</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 18 }}>{displayDate} · {remaining} slot{remaining !== 1 ? "s" : ""} remaining</div>

        {phase === "idle" && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button onClick={() => { fileRef.current.removeAttribute("capture"); fileRef.current.click(); }}
              style={{ flex: 1, padding: "14px 0", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, color: COLORS.mutedLight, cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 28 }}>🖼️</span>Library
            </button>
            <button onClick={() => { fileRef.current.setAttribute("capture", "environment"); fileRef.current.click(); }}
              style={{ flex: 1, padding: "14px 0", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, color: COLORS.mutedLight, cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 28 }}>📷</span>Camera
            </button>
          </div>
        )}

        {phase === "compressing" && (
          <div style={{ textAlign: "center", padding: "30px 0", color: COLORS.muted }}>
            <div style={{ fontSize: 32, marginBottom: 10, animation: "spin 1s linear infinite", display: "inline-block" }}>⚙️</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Compressing…</div>
          </div>
        )}

        {phase === "error" && (
          <div style={{ textAlign: "center", padding: "30px 0", color: COLORS.warn }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Failed to process image. Try another.</div>
          </div>
        )}

        {phase === "done" && preview && (
          <>
            <img src={preview} alt="preview" style={{ width: "100%", borderRadius: 12, maxHeight: 240, objectFit: "cover", marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Weight (optional)</label>
                <input type="number" inputMode="decimal" placeholder="e.g. 75.4 kg" value={weight} onChange={e => setWeight(e.target.value)}
                  style={{ width: "100%", marginTop: 6, padding: "9px 12px", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.text, fontSize: 13, outline: "none" }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Notes (optional)</label>
              <input type="text" placeholder="How are you feeling…" value={notes} onChange={e => setNotes(e.target.value)}
                style={{ width: "100%", marginTop: 6, padding: "9px 12px", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.text, fontSize: 13, outline: "none" }} />
            </div>
            <button onClick={handleSave}
              style={{ width: "100%", padding: 14, background: COLORS.accent, border: "none", borderRadius: 12, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              Save Photo
            </button>
          </>
        )}

        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}

function PhotoViewer({ photo, url, onClose, onDelete }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000f", zIndex: 1100, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "calc(env(safe-area-inset-top,0px) + 12px) 20px 12px", background: "#0008" }}>
        <button onClick={onClose} style={{ background: "#fff2", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", fontWeight: 700, padding: "6px 10px", borderRadius: 8 }}>← Back</button>
        <span style={{ fontSize: 13, color: "#ffffffaa", fontWeight: 600 }}>{photo.dateStr}</span>
        <button onClick={() => { if (window.confirm("Delete this photo?")) onDelete(photo.id); }}
          style={{ background: "#ff4a4a33", border: "1px solid #ff4a4a55", color: "#ff6b6b", fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}>
          Delete
        </button>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {url ? <img src={url} alt="progress" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <div style={{ color: COLORS.muted }}>Loading…</div>}
      </div>
      {(photo.weight || photo.notes) && (
        <div style={{ padding: "12px 20px calc(12px + env(safe-area-inset-bottom,0px))", background: "#0008", display: "flex", gap: 14, alignItems: "center" }}>
          {photo.weight && <span style={{ fontSize: 13, color: "#ffffffcc", fontWeight: 700 }}>⚖️ {photo.weight} kg</span>}
          {photo.notes && <span style={{ fontSize: 12, color: "#ffffff88", fontStyle: "italic" }}>"{photo.notes}"</span>}
        </div>
      )}
    </div>
  );
}

function CompareView({ beforeDate, afterDate, photos, onClose }) {
  const [urls, setUrls] = useState({});
  const fmtDate = d => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

  const beforePhotos = photos.filter(p => p.date === beforeDate);
  const afterPhotos = photos.filter(p => p.date === afterDate);

  useEffect(() => {
    [beforePhotos[0], afterPhotos[0]].filter(Boolean).forEach(async p => {
      const blob = await loadPhoto(p.id);
      if (blob) setUrls(prev => ({ ...prev, [p.id]: URL.createObjectURL(blob) }));
    });
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000f", zIndex: 1100, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "calc(env(safe-area-inset-top,0px) + 12px) 20px 12px", background: "#0008" }}>
        <button onClick={onClose} style={{ background: "#fff2", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>← Back</button>
        <span style={{ fontSize: 13, color: "#ffffffaa", fontWeight: 700 }}>Before / After</span>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, overflow: "hidden" }}>
        {[[beforePhotos[0], "Before", beforeDate], [afterPhotos[0], "After", afterDate]].map(([photo, label, date]) => (
          <div key={date} style={{ position: "relative", overflow: "hidden", background: COLORS.card }}>
            {photo && urls[photo.id]
              ? <img src={urls[photo.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.muted, fontSize: 12 }}>{photo ? "Loading…" : "No photo"}</div>}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,#000d)", padding: "24px 10px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{label}</div>
              <div style={{ fontSize: 11, color: "#ffffffaa" }}>{fmtDate(date)}</div>
              {photo?.weight && <div style={{ fontSize: 10, color: "#ffffff88", marginTop: 2 }}>⚖️ {photo.weight}kg</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotoCalendarPage({ photos, onAdd, onDelete }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState(null);
  const [thumbnails, setThumbnails] = useState({});
  const [dayUrls, setDayUrls] = useState({});
  const [viewing, setViewing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareDates, setCompareDates] = useState({ before: null, after: null });
  const [showCompare, setShowCompare] = useState(false);

  const photosByDate = {};
  photos.forEach(p => { if (!photosByDate[p.date]) photosByDate[p.date] = []; photosByDate[p.date].push(p); });
  const datesWithPhotos = Object.keys(photosByDate);

  const year = month.getFullYear();
  const monthNum = month.getMonth();
  const monthStr = `${year}-${String(monthNum + 1).padStart(2, "0")}`;
  const today = new Date().toISOString().split("T")[0];

  // Load thumbnails (first photo per day) for current month
  useEffect(() => {
    datesWithPhotos.filter(d => d.startsWith(monthStr)).forEach(async date => {
      if (thumbnails[date]) return;
      const blob = await loadPhoto(photosByDate[date][0].id);
      if (blob) setThumbnails(prev => ({ ...prev, [date]: URL.createObjectURL(blob) }));
    });
  }, [month, photos]);

  // Load full-size photos for selected day
  useEffect(() => {
    if (!selectedDay) return;
    (photosByDate[selectedDay] || []).forEach(async p => {
      if (dayUrls[p.id]) return;
      const blob = await loadPhoto(p.id);
      if (blob) setDayUrls(prev => ({ ...prev, [p.id]: URL.createObjectURL(blob) }));
    });
  }, [selectedDay, photos]);

  function handleDayTap(dateStr) {
    if (compareMode) {
      if (!photosByDate[dateStr]) return;
      setCompareDates(prev => {
        if (!prev.before) return { ...prev, before: dateStr };
        if (!prev.after && dateStr !== prev.before) return { ...prev, after: dateStr };
        if (dateStr === prev.before) return { ...prev, before: null };
        if (dateStr === prev.after) return { ...prev, after: null };
        return { before: prev.after, after: dateStr };
      });
    } else {
      setSelectedDay(prev => prev === dateStr ? null : dateStr);
    }
  }

  const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, monthNum, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedDayPhotos = selectedDay ? (photosByDate[selectedDay] || []) : [];
  const addTargetDate = selectedDay || today;
  const sortedCompareDates = compareDates.before && compareDates.after
    ? [compareDates.before, compareDates.after].sort() : null;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono',monospace" }}>Progress</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {datesWithPhotos.length >= 2 && (
            <button onClick={() => { setCompareMode(m => !m); setCompareDates({ before: null, after: null }); setSelectedDay(null); }}
              style={{ padding: "7px 12px", background: compareMode ? `${COLORS.purple}22` : COLORS.card, border: `1px solid ${compareMode ? COLORS.purple : COLORS.border}`, borderRadius: 10, color: compareMode ? COLORS.purple : COLORS.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              {compareMode ? "Cancel" : "Compare"}
            </button>
          )}
          {!compareMode && (
            <button onClick={() => setShowAdd(true)}
              style={{ padding: "7px 14px", background: COLORS.accent, border: "none", borderRadius: 10, color: "#000", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
              + Photo
            </button>
          )}
        </div>
      </div>

      {/* Compare mode — date picker */}
      {compareMode && (
        <div style={{ background: `${COLORS.purple}12`, border: `1px solid ${COLORS.purple}33`, borderRadius: 14, padding: "14px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: COLORS.purple, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Tap two dates on the calendar to compare
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[["Before", "before"], ["After", "after"]].map(([label, key]) => {
              const picked = compareDates[key];
              return (
                <div key={key} style={{ background: picked ? `${COLORS.purple}22` : COLORS.card, border: `1px solid ${picked ? COLORS.purple : COLORS.border}`, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
                  {picked
                    ? <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.purple }}>{new Date(picked + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                    : <div style={{ fontSize: 12, color: COLORS.muted }}>Tap a date ↓</div>}
                </div>
              );
            })}
          </div>
          {sortedCompareDates && (
            <button onClick={() => setShowCompare(true)}
              style={{ width: "100%", marginTop: 12, padding: "11px", background: COLORS.purple, border: "none", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
              Compare →
            </button>
          )}
        </div>
      )}

      {/* Month nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={() => setMonth(new Date(year, monthNum - 1, 1))} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 20, cursor: "pointer", padding: "4px 14px", borderRadius: 8 }}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <button onClick={() => setMonth(new Date(year, monthNum + 1, 1))} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 20, cursor: "pointer", padding: "4px 14px", borderRadius: 8 }}>›</button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, color: COLORS.muted, fontWeight: 700, padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = `${year}-${String(monthNum + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const count = photosByDate[dateStr]?.length || 0;
          const hasPhotos = count > 0;
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDay;
          const isBeforeDate = compareDates.before === dateStr;
          const isAfterDate = compareDates.after === dateStr;
          const borderColor = isBeforeDate || isAfterDate ? COLORS.purple : isSelected ? COLORS.accent : isToday ? `${COLORS.accent}55` : "transparent";

          return (
            <div key={i} onClick={() => handleDayTap(dateStr)}
              style={{
                position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden",
                border: `2px solid ${borderColor}`,
                background: hasPhotos ? "transparent" : COLORS.card,
                cursor: (hasPhotos || !compareMode) ? "pointer" : "default",
                opacity: compareMode && !hasPhotos ? 0.25 : 1,
              }}>
              {thumbnails[dateStr]
                ? <img src={thumbnails[dateStr]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : hasPhotos
                  ? <div style={{ width: "100%", height: "100%", background: `${COLORS.accent}15`, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 11 }}>📷</span></div>
                  : null}
              {/* Day number */}
              <div style={{ position: "absolute", top: 2, left: 3, fontSize: 9, fontWeight: 700, color: hasPhotos ? "#ffffffee" : isToday ? COLORS.accent : COLORS.muted, textShadow: hasPhotos ? "0 1px 2px #0009" : "none" }}>{day}</div>
              {/* Count badge */}
              {count > 1 && <div style={{ position: "absolute", bottom: 2, right: 2, background: "#000b", color: "#ffffffcc", fontSize: 7, fontWeight: 800, padding: "1px 3px", borderRadius: 3 }}>+{count-1}</div>}
              {/* Compare B/A labels */}
              {(isBeforeDate || isAfterDate) && <div style={{ position: "absolute", bottom: 2, left: 2, background: COLORS.purple, color: "#fff", fontSize: 7, fontWeight: 800, padding: "1px 4px", borderRadius: 3 }}>{isBeforeDate ? "B" : "A"}</div>}
              {/* Today dot (no photo) */}
              {isToday && !hasPhotos && <div style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: COLORS.accent }} />}
            </div>
          );
        })}
      </div>

      {/* Selected day panel */}
      {selectedDay && !compareMode && (
        <div style={{ marginTop: 14, background: COLORS.card, borderRadius: 16, padding: 16, border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>
                {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                {selectedDayPhotos.length} / {MAX_PHOTOS_PER_DAY} photos
                {selectedDayPhotos.length >= MAX_PHOTOS_PER_DAY && <span style={{ color: COLORS.warn, marginLeft: 6 }}>· limit reached</span>}
              </div>
            </div>
            {selectedDayPhotos.length < MAX_PHOTOS_PER_DAY && (
              <button onClick={() => setShowAdd(true)}
                style={{ padding: "7px 12px", background: `${COLORS.accent}22`, border: `1px solid ${COLORS.accent}`, borderRadius: 8, color: COLORS.accent, cursor: "pointer", fontSize: 11, fontWeight: 800 }}>
                + Add
              </button>
            )}
          </div>
          {selectedDayPhotos.length === 0
            ? <div style={{ textAlign: "center", padding: "14px 0", fontSize: 12, color: COLORS.muted }}>No photos for this day</div>
            : (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
                {selectedDayPhotos.map(p => (
                  <div key={p.id} onClick={() => setViewing(p)}
                    style={{ flexShrink: 0, width: 100, borderRadius: 10, overflow: "hidden", cursor: "pointer", position: "relative", aspectRatio: "3/4", background: COLORS.bg }}>
                    {dayUrls[p.id]
                      ? <img src={dayUrls[p.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.muted }}>…</div>}
                    {p.weight && (
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,#000b)", padding: "12px 6px 5px" }}>
                        <div style={{ fontSize: 9, color: "#ffffffcc", fontWeight: 700 }}>⚖️ {p.weight}kg</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Footer count */}
      {photos.length > 0 && (
        <div style={{ marginTop: 14, textAlign: "center", fontSize: 11, color: COLORS.muted }}>
          {photos.length} photo{photos.length !== 1 ? "s" : ""} · {datesWithPhotos.length} day{datesWithPhotos.length !== 1 ? "s" : ""}
        </div>
      )}

      {photos.length === 0 && !compareMode && (
        <div style={{ marginTop: 20, background: COLORS.card, borderRadius: 14, padding: 28, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📸</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>No photos yet</div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>Up to {MAX_PHOTOS_PER_DAY} photos per day</div>
          <button onClick={() => setShowAdd(true)} style={{ marginTop: 14, padding: "10px 20px", background: COLORS.accent, border: "none", borderRadius: 10, color: "#000", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Take First Photo</button>
        </div>
      )}

      {showAdd && <AddPhotoModal targetDate={addTargetDate} existingCount={(photosByDate[addTargetDate] || []).length} onClose={() => setShowAdd(false)} onAdd={meta => onAdd(meta)} />}
      {viewing && <PhotoViewer photo={viewing} url={dayUrls[viewing.id]} onClose={() => setViewing(null)} onDelete={id => { onDelete(id); setViewing(null); }} />}
      {showCompare && sortedCompareDates && <CompareView beforeDate={sortedCompareDates[0]} afterDate={sortedCompareDates[1]} photos={photos} onClose={() => { setShowCompare(false); setCompareMode(false); setCompareDates({ before: null, after: null }); }} />}
    </div>
  );
}

// ─── Insights ─────────────────────────────────────────────────────────────────

function getExerciseMuscles(name) {
  const n = (name || "").toLowerCase();
  if (/bench\s*press|chest\s*fly|push.?up|pec\s*dec|cable\s*fly|incline.*press|decline.*press/.test(n)) return ["chest"];
  if (/deadlift|rack\s*pull/.test(n)) return ["back", "hamstrings", "glutes"];
  if (/squat|leg\s*press|hack\s*squat|front\s*squat/.test(n)) return ["quads", "glutes"];
  if (/pull.?up|chin.?up|lat\s*pull|pulldown/.test(n)) return ["back", "biceps"];
  if (/\brow\b|t.?bar|cable\s*row/.test(n)) return ["back"];
  if (/overhead\s*press|shoulder\s*press|military|ohp|arnold/.test(n)) return ["shoulders"];
  if (/lateral\s*raise|side\s*raise|upright\s*row|face\s*pull|rear\s*delt|reverse\s*fly/.test(n)) return ["shoulders"];
  if (/bicep\s*curl|hammer\s*curl|preacher|ez\s*curl/.test(n)) return ["biceps"];
  if (/tricep|skull\s*crusher|pushdown|close\s*grip/.test(n)) return ["triceps"];
  if (/\bdip\b/.test(n)) return ["triceps", "chest"];
  if (/lunge|step.?up|leg\s*extension/.test(n)) return ["quads"];
  if (/leg\s*curl|rdl|romanian|nordic|good\s*morning/.test(n)) return ["hamstrings"];
  if (/calf\s*raise/.test(n)) return ["calves"];
  if (/plank|crunch|sit.?up|russian\s*twist|leg\s*raise|v.?up/.test(n)) return ["core"];
  if (/hip\s*thrust|glute\s*bridge|kickback/.test(n)) return ["glutes"];
  if (/run|sprint|bike|cycling|treadmill|cardio/.test(n)) return ["cardio"];
  return [];
}

function getMuscleFrequencies(workouts, days) {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const counts = {};
  workouts.filter(w => w.id > cutoff).forEach(w => {
    const seen = new Set();
    (w.exercises || []).forEach(ex => {
      getExerciseMuscles(ex.name || "").forEach(m => {
        if (!seen.has(m)) { counts[m] = (counts[m] || 0) + 1; seen.add(m); }
      });
    });
  });
  return counts;
}

function BodyFigure({ view, freq }) {
  const mf = m => {
    const n = freq[m] || 0;
    if (n === 0) return "transparent";
    if (n <= 2) return COLORS.accentDim;
    if (n <= 5) return COLORS.accentMid;
    return COLORS.accent;
  };
  const s = { stroke: COLORS.border, strokeWidth: "1.2", strokeLinejoin: "round" };
  if (view === "front") return (
    <svg viewBox="0 0 60 148" style={{ width: "100%", height: "100%" }}>
      <circle cx="30" cy="10" r="9" fill={COLORS.surface} stroke={COLORS.border} strokeWidth="1.2" />
      <rect x="27" y="19" width="6" height="5" rx="2" fill={COLORS.surface} stroke={COLORS.border} strokeWidth="1" />
      <ellipse cx="12" cy="28" rx="7" ry="5" fill={mf("shoulders")} {...s} />
      <ellipse cx="48" cy="28" rx="7" ry="5" fill={mf("shoulders")} {...s} />
      <path d="M 20,24 Q 20,43 30,44 Q 40,43 40,24 Z" fill={mf("chest")} {...s} />
      <rect x="6" y="28" width="8" height="20" rx="4" fill={mf("biceps")} {...s} />
      <rect x="46" y="28" width="8" height="20" rx="4" fill={mf("biceps")} {...s} />
      <rect x="22" y="44" width="16" height="20" rx="4" fill={mf("core")} {...s} />
      <rect x="20" y="64" width="20" height="9" rx="4" fill={COLORS.surface} stroke={COLORS.border} strokeWidth="1" />
      <rect x="19" y="73" width="11" height="38" rx="5" fill={mf("quads")} {...s} />
      <rect x="30" y="73" width="11" height="38" rx="5" fill={mf("quads")} {...s} />
      <rect x="19" y="114" width="10" height="27" rx="5" fill={mf("calves")} {...s} />
      <rect x="31" y="114" width="10" height="27" rx="5" fill={mf("calves")} {...s} />
    </svg>
  );
  return (
    <svg viewBox="0 0 60 148" style={{ width: "100%", height: "100%" }}>
      <circle cx="30" cy="10" r="9" fill={COLORS.surface} stroke={COLORS.border} strokeWidth="1.2" />
      <path d="M 27,19 L 12,26 L 15,33 L 30,27 L 45,33 L 48,26 L 33,19 Z" fill={mf("traps")} {...s} />
      <ellipse cx="10" cy="29" rx="6" ry="5" fill={mf("shoulders")} {...s} />
      <ellipse cx="50" cy="29" rx="6" ry="5" fill={mf("shoulders")} {...s} />
      <rect x="10" y="32" width="8" height="32" rx="4" fill={mf("back")} {...s} />
      <rect x="42" y="32" width="8" height="32" rx="4" fill={mf("back")} {...s} />
      <rect x="22" y="32" width="16" height="22" rx="4" fill={mf("back")} {...s} />
      <rect x="6" y="29" width="7" height="20" rx="4" fill={mf("triceps")} {...s} />
      <rect x="47" y="29" width="7" height="20" rx="4" fill={mf("triceps")} {...s} />
      <rect x="23" y="54" width="14" height="14" rx="4" fill={mf("core")} {...s} />
      <rect x="19" y="70" width="10" height="22" rx="5" fill={mf("glutes")} {...s} />
      <rect x="31" y="70" width="10" height="22" rx="5" fill={mf("glutes")} {...s} />
      <rect x="19" y="94" width="11" height="32" rx="5" fill={mf("hamstrings")} {...s} />
      <rect x="30" y="94" width="11" height="32" rx="5" fill={mf("hamstrings")} {...s} />
      <rect x="19" y="129" width="10" height="16" rx="4" fill={mf("calves")} {...s} />
      <rect x="31" y="129" width="10" height="16" rx="4" fill={mf("calves")} {...s} />
    </svg>
  );
}

function InsightsSummaryCard({ workouts, meals, waterLog, waterGoal, sleepLog, supplements, calorieGoal, period }) {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const ldk = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const dateRange = Array.from({ length: days }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (days-1-i)); return ldk(d); });
  const pw = workouts.filter(w => w.id > cutoff);
  const sessions = pw.length;
  const totalMin = pw.reduce((s, w) => s + (w.duration || 0), 0);
  const totalBurned = pw.reduce((s, w) => s + (w.calories || 0), 0);
  const activeDay = period === "7d" ? dateRange.map(k => pw.some(w => ldk(new Date(w.id)) === k)) : null;
  const calsByDay = Object.fromEntries(dateRange.map(k => [k, 0]));
  meals.forEach(m => { if (calsByDay[m.logged_date] !== undefined) calsByDay[m.logged_date] += m.calories || 0; });
  const daysLogged = dateRange.filter(k => calsByDay[k] > 0).length;
  const avgCals = daysLogged > 0 ? Math.round(dateRange.reduce((s, k) => s + calsByDay[k], 0) / daysLogged) : 0;
  const daysWaterMet = dateRange.filter(k => (waterLog[k] || 0) >= waterGoal).length;
  const sleepEntries = dateRange.map(k => sleepLog[k]).filter(Boolean);
  const avgSleep = sleepEntries.length > 0 ? (sleepEntries.reduce((s, e) => s + parseFloat(e.hours || 0), 0) / sleepEntries.length).toFixed(1) : null;
  const suppAdherence = supplements.length > 0 ? Math.round(supplements.reduce((s, supp) => s + dateRange.filter(k => supp.history?.[k]).length, 0) / (supplements.length * days) * 100) : null;
  const cell = (value, unit, color) => (
    <div style={{ background: COLORS.bg, borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
      <div style={{ fontSize: 17, fontWeight: 800, color, fontFamily: "'Space Mono',monospace", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 9, color: COLORS.muted, marginTop: 2 }}>{unit}</div>
    </div>
  );
  return (
    <div style={{ background: COLORS.card, borderRadius: 16, marginBottom: 14, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
      <div style={{ padding: "13px 16px 0" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {period === "7d" ? "This Week" : period === "30d" ? "Last 30 Days" : "Last 90 Days"}
        </span>
      </div>
      <div style={{ padding: "10px 14px 14px" }}>
        {activeDay && (
          <div style={{ display: "flex", gap: 3, marginBottom: 12 }}>
            {dateRange.map((k, i) => {
              const letter = new Date(k + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })[0];
              return (
                <div key={k} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ height: 6, borderRadius: 3, background: activeDay[i] ? COLORS.accent : COLORS.border, marginBottom: 3 }} />
                  <span style={{ fontSize: 9, color: activeDay[i] ? COLORS.accent : COLORS.muted, fontWeight: activeDay[i] ? 700 : 400 }}>{letter}</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 8 }}>
          {cell(sessions, "sessions", COLORS.accent)}
          {cell(totalMin, "min active", COLORS.blue)}
          {cell(totalBurned, "kcal burned", COLORS.orange)}
        </div>
        {daysLogged > 0 && (
          <div style={{ background: COLORS.bg, borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 9, color: COLORS.muted, marginBottom: 2 }}>Avg daily calories</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.yellow, fontFamily: "'Space Mono',monospace" }}>
                {avgCals} <span style={{ fontSize: 10, color: COLORS.muted, fontWeight: 400 }}>/ {calorieGoal}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: COLORS.muted, marginBottom: 2 }}>Days logged</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>{daysLogged}<span style={{ fontSize: 10, color: COLORS.muted, fontWeight: 400 }}>/{days}</span></div>
            </div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${suppAdherence !== null ? 3 : 2}, 1fr)`, gap: 6 }}>
          {cell(avgSleep !== null ? `${avgSleep}h` : "—", "avg sleep", COLORS.purple)}
          {cell(`${daysWaterMet}/${days}`, "water goal met", COLORS.blue)}
          {suppAdherence !== null && cell(`${suppAdherence}%`, "supp adherence", COLORS.accent)}
        </div>
      </div>
    </div>
  );
}

function BodyWeightInsightCard({ weightLog, profile, onLogWeight, period }) {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const cutoffDate = new Date(); cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);
  const allEntries = Object.entries(weightLog).sort(([a],[b]) => a.localeCompare(b)).map(([date,w]) => ({ date, w }));
  const entries = allEntries.filter(e => e.date >= cutoffStr);
  const latest = allEntries[allEntries.length - 1];
  const prev = allEntries[allEntries.length - 2];
  const delta = latest && prev ? Math.round((latest.w - prev.w) * 10) / 10 : null;
  const unit = profile.weightUnit || "kg";
  const periodDelta = entries.length >= 2 ? Math.round((entries[entries.length-1].w - entries[0].w) * 10) / 10 : null;
  const W = 300, H = 90, PAD = 6;
  const weights = entries.map(e => e.w);
  const minW = weights.length >= 2 ? Math.min(...weights) : 0;
  const maxW = weights.length >= 2 ? Math.max(...weights) : 1;
  const range = maxW - minW || 0.5;
  const toX = i => PAD + (i / (entries.length - 1)) * (W - PAD * 2);
  const toY = w => H - PAD - ((w - minW) / range) * (H - PAD * 2);
  const trendColor = delta !== null && delta <= 0 ? COLORS.accent : COLORS.warn;
  const linePts = entries.length >= 2 ? entries.map((e, i) => `${toX(i).toFixed(1)},${toY(e.w).toFixed(1)}`).join(" ") : "";
  const fillPts = entries.length >= 2 ? `${toX(0).toFixed(1)},${H} ${linePts} ${toX(entries.length-1).toFixed(1)},${H}` : "";
  return (
    <div style={{ background: COLORS.card, borderRadius: 16, padding: "14px 16px", marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Body Weight</div>
          {latest ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: COLORS.text, fontFamily: "'Space Mono',monospace" }}>{latest.w}</span>
              <span style={{ fontSize: 13, color: COLORS.muted }}>{unit}</span>
              {delta !== null && <span style={{ fontSize: 13, fontWeight: 700, color: trendColor }}>{delta > 0 ? "+" : ""}{delta}</span>}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>Not logged yet</div>
          )}
          {periodDelta !== null && (
            <div style={{ fontSize: 11, color: periodDelta <= 0 ? COLORS.accent : COLORS.warn, marginTop: 2 }}>
              {periodDelta > 0 ? "+" : ""}{periodDelta} {unit} over {days} days
            </div>
          )}
        </div>
        <button onClick={onLogWeight} style={{ padding: "7px 14px", background: COLORS.accent, color: "#000", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>+ Log</button>
      </div>
      {entries.length >= 2 ? (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block", overflow: "visible" }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="wfill2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={trendColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={fillPts} fill="url(#wfill2)" />
          <polyline points={linePts} fill="none" stroke={trendColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={toX(0)} cy={toY(weights[0])} r="4" fill={trendColor} />
          <circle cx={toX(entries.length-1)} cy={toY(weights[weights.length-1])} r="4" fill={trendColor} />
        </svg>
      ) : entries.length === 1 ? (
        <div style={{ fontSize: 11, color: COLORS.muted, textAlign: "center", paddingTop: 8 }}>Log one more entry to see your trend</div>
      ) : (
        <div style={{ fontSize: 11, color: COLORS.muted, textAlign: "center", paddingTop: 8 }}>No entries in this period</div>
      )}
    </div>
  );
}

function MuscleHeatmapCard({ workouts, period }) {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const freq = getMuscleFrequencies(workouts, days);
  const muscles = [
    { key: "chest", label: "Chest" }, { key: "back", label: "Back" },
    { key: "shoulders", label: "Shoulders" }, { key: "biceps", label: "Biceps" },
    { key: "triceps", label: "Triceps" }, { key: "core", label: "Core" },
    { key: "quads", label: "Quads" }, { key: "hamstrings", label: "Hamstrings" },
    { key: "glutes", label: "Glutes" }, { key: "calves", label: "Calves" },
  ];
  const mfColor = n => !n ? COLORS.border : n <= 2 ? COLORS.accentDim : n <= 5 ? COLORS.accentMid : COLORS.accent;
  const maxFreq = Math.max(...Object.values(freq).filter((_, k) => !["cardio","other"].includes(k)), 1);
  const trained = muscles.filter(m => freq[m.key] > 0);
  return (
    <div style={{ background: COLORS.card, borderRadius: 16, padding: "14px 16px", marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Muscles Trained</div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 9, color: COLORS.muted, marginBottom: 6, fontWeight: 600, letterSpacing: "0.08em" }}>FRONT</div>
          <div style={{ height: 148 }}><BodyFigure view="front" freq={freq} /></div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 9, color: COLORS.muted, marginBottom: 6, fontWeight: 600, letterSpacing: "0.08em" }}>BACK</div>
          <div style={{ height: 148 }}><BodyFigure view="back" freq={freq} /></div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 9, color: COLORS.muted }}>None</span>
        {[COLORS.border, COLORS.accentDim, COLORS.accentMid, COLORS.accent].map((c, i) => (
          <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: c }} />
        ))}
        <span style={{ fontSize: 9, color: COLORS.muted }}>High</span>
      </div>
      {trained.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {trained.map(m => (
            <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 72, fontSize: 11, color: COLORS.mutedLight, fontWeight: 600 }}>{m.label}</div>
              <div style={{ flex: 1, height: 6, background: COLORS.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (freq[m.key] / maxFreq) * 100)}%`, height: "100%", background: mfColor(freq[m.key]), borderRadius: 3 }} />
              </div>
              <div style={{ width: 24, fontSize: 11, color: mfColor(freq[m.key]), fontFamily: "'Space Mono',monospace", fontWeight: 700, textAlign: "right" }}>{freq[m.key]}x</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: COLORS.muted, textAlign: "center", padding: "8px 0" }}>No logged exercises in this period</div>
      )}
    </div>
  );
}

function WorkoutVolumeCard({ workouts, period }) {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const pw = workouts.filter(w => w.id > cutoff);
  const buckets = {};
  pw.forEach(w => {
    const d = new Date(w.id); const day = d.getDay() || 7;
    const mon = new Date(d); mon.setDate(d.getDate() - day + 1);
    const key = mon.toISOString().slice(0, 10);
    const label = mon.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!buckets[key]) buckets[key] = { label, sessions: 0, volume: 0 };
    buckets[key].sessions++;
    buckets[key].volume += (w.exercises || []).reduce((t, ex) => t + (ex.sets || []).reduce((s, set) => s + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0), 0), 0);
  });
  const pts = Object.entries(buckets).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
  const hasVolume = pts.some(p => p.volume > 0);
  const vals = pts.map(p => hasVolume ? p.volume : p.sessions);
  const maxVal = Math.max(...vals, 1);
  const W = 300, H = 80, PAD = 6;
  const toX = i => PAD + (i / Math.max(pts.length - 1, 1)) * (W - PAD * 2);
  const toY = v => H - PAD - (v / maxVal) * (H - PAD * 2);
  const linePts = vals.length >= 2 ? vals.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ") : "";
  const fillPts = vals.length >= 2 ? `${toX(0).toFixed(1)},${H} ${linePts} ${toX(vals.length-1).toFixed(1)},${H}` : "";
  const fmtVol = v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(Math.round(v));
  return (
    <div style={{ background: COLORS.card, borderRadius: 16, padding: "14px 16px", marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {hasVolume ? "Training Volume" : "Workout Sessions"}
        </div>
        {vals.length > 0 && (
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, fontWeight: 700, color: COLORS.blue }}>
            {hasVolume ? `${fmtVol(vals.reduce((a,b) => a+b, 0))} kg·reps` : `${vals.reduce((a,b) => a+b, 0)} sessions`}
          </div>
        )}
      </div>
      {vals.length >= 2 ? (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block", overflow: "visible" }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="volfill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.blue} stopOpacity="0.25" />
                <stop offset="100%" stopColor={COLORS.blue} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={fillPts} fill="url(#volfill)" />
            <polyline points={linePts} fill="none" stroke={COLORS.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {vals.map((v, i) => <circle key={i} cx={toX(i)} cy={toY(v)} r="3" fill={COLORS.blue} />)}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {pts.map((p, i) => <span key={i} style={{ fontSize: 9, color: COLORS.muted }}>{p.label}</span>)}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: COLORS.muted, textAlign: "center", padding: "12px 0" }}>
          {pw.length === 0 ? "No workouts in this period" : "Log more workouts to see your volume trend"}
        </div>
      )}
    </div>
  );
}

function InsightsView({ workouts, meals, waterLog, waterGoal, sleepLog, supplements, calorieGoal, weightLog, profile, onLogWeight, period, onPeriodChange }) {
  return (
    <div>
      <div style={{ display: "flex", background: COLORS.card, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {["7d", "30d", "90d"].map(p => (
          <button key={p} onClick={() => onPeriodChange(p)} style={{ flex: 1, padding: "8px 0", borderRadius: 9, background: period === p ? COLORS.accent : "transparent", color: period === p ? "#000" : COLORS.muted, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", transition: "all 0.2s" }}>
            {p}
          </button>
        ))}
      </div>
      <InsightsSummaryCard workouts={workouts} meals={meals} waterLog={waterLog} waterGoal={waterGoal} sleepLog={sleepLog} supplements={supplements} calorieGoal={calorieGoal} period={period} />
      <BodyWeightInsightCard weightLog={weightLog} profile={profile} onLogWeight={onLogWeight} period={period} />
      <MuscleHeatmapCard workouts={workouts} period={period} />
      <WorkoutVolumeCard workouts={workouts} period={period} />
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── Theme ──────────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("nf_theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  // Sync COLORS before any child renders (must be in render body, not effect)
  Object.assign(COLORS, isDark ? DARK_COLORS : LIGHT_COLORS);

  // ── Auth ───────────────────────────────────────────────────────────────────
  const [authSession, setAuthSession] = useState(undefined); // undefined = loading, null = logged out
  useEffect(() => {
    if (!supabase) { setAuthSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setAuthSession(data.session ?? null));
    const unsub = onAuthChange(s => setAuthSession(s ?? null));
    return unsub;
  }, []);

  // Load profile from Supabase when session first becomes available
  useEffect(() => {
    if (!supabase || !authSession?.user?.id) return;
    supabase.from("profiles").select("*").eq("id", authSession.user.id).single()
      .then(({ data, error }) => {
        if (error || !data) return;
        const merged = dbToProfile(data);
        setProfile(p => ({ ...p, ...merged }));
        localStorage.setItem("nf_profile", JSON.stringify({ ...merged }));
      });
  }, [authSession?.user?.id]);

  // ── Profile sync helpers ────────────────────────────────────────────────────
  const NOTIF_DEFAULTS = { notifSupplements: true, notifSupplementTime: "08:00", notifWater: true, notifWaterTime: "12:00", notifMeals: true, notifMealTime: "18:00" };
  const EMPTY_PROFILE = { name: "", age: "", gender: "male", weight: "", weightUnit: "kg", height: "", heightUnit: "cm", goal: "maintain", activityLevel: "moderate", cheatDays: 1, location: "", ...NOTIF_DEFAULTS };

  function dbToProfile(row) {
    return {
      name:          row.name          ?? "",
      age:           row.age           ?? "",
      gender:        row.gender        ?? "male",
      weight:        row.weight        ?? "",
      weightUnit:    row.weight_unit   ?? "kg",
      height:        row.height        ?? "",
      heightUnit:    row.height_unit   ?? "cm",
      goal:          row.goal          ?? "maintain",
      activityLevel: row.activity_level ?? "moderate",
      cheatDays:     row.cheat_days    ?? 1,
      waterGoal:     row.water_goal    ?? 2500,
      location:      row.location      ?? "",
    };
  }

  function profileToDb(p, userId) {
    return {
      id:             userId,
      name:           p.name          || null,
      age:            p.age           ? parseInt(p.age) : null,
      gender:         p.gender        || "male",
      weight:         p.weight        ? parseFloat(p.weight) : null,
      weight_unit:    p.weightUnit    || "kg",
      height:         p.height        ? parseFloat(p.height) : null,
      height_unit:    p.heightUnit    || "cm",
      goal:           p.goal          || "maintain",
      activity_level: p.activityLevel || "moderate",
      cheat_days:     p.cheatDays     ?? 1,
      water_goal:     p.waterGoal     ?? 2500,
      location:       p.location      || null,
      updated_at:     new Date().toISOString(),
    };
  }

  // ── Meals + Water Supabase sync ─────────────────────────────────────────────
  useEffect(() => {
    if (!supabase || !authSession?.user?.id) return;
    const uid = authSession.user.id;
    supabase.from("meals").select("*").eq("user_id", uid).order("logged_date", { ascending: false })
      .then(({ data }) => {
        if (!data?.length) return;
        const fromDb = data.map(r => ({ id: r.id, name: r.name, time: r.time || "", calories: r.calories || 0, protein: Number(r.protein) || 0, carbs: Number(r.carbs) || 0, fat: Number(r.fat) || 0, img: r.img || "🍽️", logged_date: r.logged_date }));
        setMeals(prev => {
          const dbIds = new Set(fromDb.map(m => m.id));
          const localOnly = prev.filter(m => !dbIds.has(m.id));
          return [...fromDb, ...localOnly].sort((a, b) => b.id - a.id);
        });
      });
    supabase.from("water_log").select("*").eq("user_id", uid)
      .then(({ data }) => {
        if (!data?.length) return;
        setWaterLog(prev => {
          const merged = { ...prev };
          const todayLocal = new Date();
          const todayStr = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, "0")}-${String(todayLocal.getDate()).padStart(2, "0")}`;
          data.forEach(r => {
            // For today: keep the higher value so a stale Supabase 0 never wipes out local progress
            if (r.date === todayStr) {
              merged[r.date] = Math.max(merged[r.date] || 0, r.ml || 0);
            } else {
              merged[r.date] = r.ml;
            }
          });
          return merged;
        });
      });
  }, [authSession?.user?.id]);

  // ── Onboarding ─────────────────────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("nf_onboarded"));
  const [tourStep, setTourStep] = useState(() =>
    localStorage.getItem("nf_onboarded") === "1" && !localStorage.getItem("nf_renovated_v093") ? 0 : null
  );

  const [tab, setTab] = useState("dashboard");
  const [progressSubTab, setProgressSubTab] = useState("photos");
  const [insightsPeriod, setInsightsPeriod] = useState("30d");
  const [nutritionView, setNutritionView] = useState("today");
  const [lastTrackTab, setLastTrackTab] = useState(() => localStorage.getItem("nf_last_track") || "nutrition");
  const [lastWellbeingTab, setLastWellbeingTab] = useState(() => localStorage.getItem("nf_last_wellbeing") || "health");
  const [showPillDropdown, setShowPillDropdown] = useState(false);

  const navigateTo = (id) => {
    setTab(id);
    if (id === "nutrition" || id === "workout") {
      setLastTrackTab(id);
      localStorage.setItem("nf_last_track", id);
    } else if (id === "health" || id === "supplements") {
      setLastWellbeingTab(id);
      localStorage.setItem("nf_last_wellbeing", id);
    }
  };

  const dismissTour = () => {
    localStorage.setItem("nf_renovated_v093", "1");
    setTourStep(null);
  };

  const advanceTour = () => {
    const next = tourStep + 1;
    if (next >= TOUR_STEPS.length) { dismissTour(); return; }
    const s = TOUR_STEPS[next];
    if (s.tab) { setTab(s.tab); if (s.tab === "nutrition" || s.tab === "workout") setLastTrackTab(s.tab); else if (s.tab === "health" || s.tab === "supplements") setLastWellbeingTab(s.tab); }
    if (s.nutritionView) setNutritionView(s.nutritionView);
    setTourStep(next);
  };

  const backTour = () => {
    const prev = tourStep - 1;
    if (prev < 0) return;
    const s = TOUR_STEPS[prev];
    if (s.tab) { setTab(s.tab); if (s.tab === "nutrition" || s.tab === "workout") setLastTrackTab(s.tab); else if (s.tab === "health" || s.tab === "supplements") setLastWellbeingTab(s.tab); }
    if (s.nutritionView) setNutritionView(s.nutritionView);
    setTourStep(prev);
  };

  const tourHL = tourStep !== null ? TOUR_STEPS[tourStep]?.highlight : null;
  const hl = (id) => tourHL === id
    ? { outline: `2px solid ${COLORS.accent}`, outlineOffset: 3, borderRadius: 14, animation: "tourPulse 1.8s ease-in-out infinite" }
    : {};
  const [viewMode, setViewMode] = useState("mobile"); // "mobile" | "webapp" — button hidden, kept for future web layout
  const [showScanner, setShowScanner] = useState(false);
  const [showActiveWorkout, setShowActiveWorkout] = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showRunTracker, setShowRunTracker] = useState(false);
  const [editMealPrefill, setEditMealPrefill] = useState(null);
  const [editWorkoutPrefill, setEditWorkoutPrefill] = useState(null);
  const [hkAvailable, setHkAvailable] = useState(false);
  const [hkData, setHkData] = useState({ steps: null, activeCalories: null, heartRate: null, distanceKm: null, sleepHours: null });
  const [hkSyncing, setHkSyncing] = useState(false);
  const [hkLastSync, setHkLastSync] = useState(null);
  const [showInjury, setShowInjury] = useState(false);
  const [showManualMeal, setShowManualMeal] = useState(false);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [showAddPR, setShowAddPR] = useState(false);
  const [prs, setPrs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nf_prs")) || {}; } catch { return {}; }
  });
  const [prToast, setPrToast] = useState(null);
  const [shareToast, setShareToast] = useState(false);
  const [showAddSupp, setShowAddSupp] = useState(false);
  const [editingInjury, setEditingInjury] = useState(null);
  const [routineDay, setRoutineDay] = useState(null); // { key, label }
  const [routineChecks, setRoutineChecks] = useState(() => JSON.parse(localStorage.getItem("routineChecks") || "{}"));
  const [routineTemplates, setRoutineTemplates] = useState(() => JSON.parse(localStorage.getItem("nf_templates") || "[]"));
  const [showSessionStart, setShowSessionStart] = useState(false);

  // App-level workout session (persists across tab changes)
  const [activeSession, setActiveSession] = useState(null);
  const [, setSessionTick] = useState(0);

  const [meals, setMeals] = useState(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const stored = JSON.parse(localStorage.getItem("nf_meals")) || [];
      return stored.map(m => m.logged_date ? m : { ...m, logged_date: today });
    } catch { return []; }
  });

  const [workouts, setWorkouts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nf_workouts")) || []; }
    catch { return []; }
  });
  const [expandedWorkouts, setExpandedWorkouts] = useState(new Set());

  const [injuries, setInjuries] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nf_injuries")) || []; }
    catch { return []; }
  });

  const [supplements, setSupplements] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nf_supplements")) || []; }
    catch { return []; }
  });

  const [weeklyRoutine, setWeeklyRoutine] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nf_routine")) || {}; }
    catch { return {}; }
  });

  const [profile, setProfile] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("nf_profile"));
      return saved ? { notifSupplements: true, notifSupplementTime: "08:00", notifWater: true, notifWaterTime: "12:00", notifMeals: true, notifMealTime: "18:00", ...saved } : {
        name: "", age: "", gender: "male",
        weight: "", weightUnit: "kg",
        height: "", heightUnit: "cm",
        goal: "maintain", activityLevel: "moderate",
        cheatDays: 1, location: "",
        notifSupplements: true, notifSupplementTime: "08:00",
        notifWater: true, notifWaterTime: "12:00",
        notifMeals: true, notifMealTime: "18:00",
      };
    } catch {
      return {
        name: "", age: "", gender: "male",
        weight: "", weightUnit: "kg",
        height: "", heightUnit: "cm",
        goal: "maintain", activityLevel: "moderate",
        cheatDays: 1, location: "",
        notifSupplements: true, notifSupplementTime: "08:00",
        notifWater: true, notifWaterTime: "12:00",
        notifMeals: true, notifMealTime: "18:00",
      };
    }
  });

  const _todayKeyEarly = new Date().toISOString().slice(0, 10);
  const todayMeals = meals.filter(m => (m.logged_date || _todayKeyEarly) === _todayKeyEarly);
  const totalCals = todayMeals.reduce((s, m) => s + m.calories, 0);
  const totalProtein = todayMeals.reduce((s, m) => s + m.protein, 0);
  const totalCarbs = todayMeals.reduce((s, m) => s + m.carbs, 0);
  const totalFat = todayMeals.reduce((s, m) => s + m.fat, 0);

  const bmr = (() => {
    const wKg = profile.weightUnit === "lbs" ? (parseFloat(profile.weight) || 70) * 0.453592 : (parseFloat(profile.weight) || 70);
    const hCm = profile.heightUnit === "in"  ? (parseFloat(profile.height) || 170) * 2.54 : (parseFloat(profile.height) || 170);
    const a = parseFloat(profile.age) || 25;
    return profile.gender === "female"
      ? 10 * wKg + 6.25 * hCm - 5 * a - 161
      : 10 * wKg + 6.25 * hCm - 5 * a + 5;
  })();
  const activityMult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryactive: 1.9 };
  const tdee = Math.round(bmr * (activityMult[profile.activityLevel] || 1.55));
  const goalAdj = { lose: -500, maintain: 0, gain: 300 };
  const calorieGoal = Math.max(1200, tdee + (goalAdj[profile.goal] || 0));
  const macroTargets = {
    protein: Math.round((calorieGoal * 0.30) / 4),
    carbs:   Math.round((calorieGoal * 0.40) / 4),
    fat:     Math.round((calorieGoal * 0.30) / 9),
  };
  const cheatDayCalories = Math.round(calorieGoal * 1.25);
  const weeklyCalBudget = calorieGoal * (7 - profile.cheatDays) + cheatDayCalories * profile.cheatDays;

  const userWeightKg = profile.weightUnit === "lbs" ? (parseFloat(profile.weight) || 70) * 0.453592 : (parseFloat(profile.weight) || 70);
  const localDateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayKey = localDateKey();
  const DAYS_MAP = [{ key: "sun", label: "Sun" }, { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" }, { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }];
  const todayDayKey = DAYS_MAP[new Date().getDay()].key;
  const todayRoutine = weeklyRoutine[todayDayKey];

  // Session timer — ticks every second while a session is active, auto-clears expired rest
  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => {
      setSessionTick(t => t + 1);
      setActiveSession(s => {
        if (!s?.restStartedAt) return s;
        if ((Date.now() - s.restStartedAt) / 1000 >= s.restTotal) return { ...s, restStartedAt: null };
        return s;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [!!activeSession]);

  const sessionElapsed = activeSession ? Math.floor((Date.now() - activeSession.startTime) / 1000) : 0;
  const restLeft = activeSession?.restStartedAt
    ? Math.max(0, activeSession.restTotal - Math.floor((Date.now() - activeSession.restStartedAt) / 1000))
    : 0;
  const resting = !!(activeSession?.restStartedAt && restLeft > 0);

  const startActiveSession = (routineExercises = null, sessionName = "", sessionType = "Strength") => {
    const exercises = routineExercises
      ? routineExercises.map(e => ({
          name: e.name,
          collapsed: false,
          sets: Array.from({ length: parseInt(e.sets) || 3 }, (_, i) => ({
            id: Date.now() + i * 13,
            reps: e.reps || "",
            weight: e.weight || "",
            done: false,
          })),
        }))
      : [{ name: "", sets: [], collapsed: false }];
    setActiveSession({ startTime: Date.now(), sessionName, sessionType, exercises, restTotal: 90, restStartedAt: null, userWeightKg });
    setShowActiveWorkout(true);
  };
  const handleFinishSession = ({ durationMin, estCals, validExercises, totalSets }) => {
    setWorkouts(prev => [{ id: Date.now(), type: activeSession.sessionType || "Strength", name: activeSession.sessionName || "Workout Session", duration: durationMin, calories: estCals, sets: totalSets, date: new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }), exercises: validExercises }, ...prev]);

    // Detect new personal records
    const dateStr = todayKey;
    const updates = {};
    const newPRNames = [];
    validExercises.forEach(ex => {
      const name = ex.name;
      ex.sets.forEach(set => {
        const oneRM = epley1RM(set.weight, set.reps);
        if (oneRM <= 0) return;
        const current = updates[name] || prs[name] || { best1rm: 0, history: [] };
        if (oneRM > current.best1rm) {
          const entry = { date: dateStr, weight: parseFloat(set.weight), reps: parseInt(set.reps), oneRM };
          updates[name] = { best1rm: oneRM, bestWeight: parseFloat(set.weight), bestReps: parseInt(set.reps), date: dateStr, history: [...(current.history || []), entry] };
          if (!newPRNames.includes(name)) newPRNames.push(name);
        }
      });
    });
    if (Object.keys(updates).length > 0) {
      setPrs(prev => ({ ...prev, ...updates }));
      if (newPRNames.length > 0) {
        setPrToast(newPRNames);
        setTimeout(() => setPrToast(null), 4000);
      }
    }

    setActiveSession(null);
    setShowActiveWorkout(false);
  };
  const suppsTakenToday = supplements.filter(s => s.history?.[todayKey]).length;
  const workoutTypeColor = { Strength: COLORS.accent, Cardio: COLORS.blue, HIIT: COLORS.warn, Mobility: COLORS.yellow, Sport: COLORS.purple, Other: COLORS.mutedLight };
  const severityColor = { mild: COLORS.yellow, moderate: COLORS.orange, severe: COLORS.warn };
  const statusColor = { new: COLORS.blue, stable: COLORS.mutedLight, improving: COLORS.accent, worsening: COLORS.warn };

  // Save to localStorage whenever data changes
  useEffect(() => { localStorage.setItem("nf_meals", JSON.stringify(meals)); }, [meals]);
  useEffect(() => { localStorage.setItem("nf_workouts", JSON.stringify(workouts)); }, [workouts]);
  useEffect(() => { localStorage.setItem("nf_injuries", JSON.stringify(injuries)); }, [injuries]);
  useEffect(() => { localStorage.setItem("nf_supplements", JSON.stringify(supplements)); }, [supplements]);
  // Profile → localStorage (always) + Supabase (when signed in)
  useEffect(() => {
    localStorage.setItem("nf_profile", JSON.stringify(profile));
    if (!supabase || !authSession?.user?.id) return;
    supabase.from("profiles").upsert(profileToDb(profile, authSession.user.id)).then(({ error }) => {
      if (error) console.warn("Profile sync failed:", error.message);
    });
  }, [profile, authSession]);
  useEffect(() => { localStorage.setItem("nf_routine", JSON.stringify(weeklyRoutine)); }, [weeklyRoutine]);
  useEffect(() => { localStorage.setItem("routineChecks", JSON.stringify(routineChecks)); }, [routineChecks]);
  useEffect(() => { localStorage.setItem("nf_templates", JSON.stringify(routineTemplates)); }, [routineTemplates]);
  useEffect(() => {
    localStorage.setItem("nf_theme", isDark ? "dark" : "light");
    document.body.style.background = isDark ? DARK_COLORS.bg : LIGHT_COLORS.bg;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isDark ? "#0a0a0f" : "#f2f2f7");
  }, [isDark]);

  // ── Water & Photos state ──────────────────────────────────────────────────
  const [sleepLog, setSleepLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nf_sleep")) || {}; } catch { return {}; }
  });
  const [showSleep, setShowSleep] = useState(false);
  const [waterLog, setWaterLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nf_water")) || {}; } catch { return {}; }
  });
  const [weightLog, setWeightLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nf_weight_log")) || {}; } catch { return {}; }
  });
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [progressPhotos, setProgressPhotos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nf_photos")) || []; } catch { return []; }
  });

  useEffect(() => { localStorage.setItem("nf_sleep", JSON.stringify(sleepLog)); }, [sleepLog]);
  useEffect(() => { localStorage.setItem("nf_water", JSON.stringify(waterLog)); }, [waterLog]);
  useEffect(() => { localStorage.setItem("nf_weight_log", JSON.stringify(weightLog)); }, [weightLog]);
  useEffect(() => { localStorage.setItem("nf_prs", JSON.stringify(prs)); }, [prs]);
  useEffect(() => { localStorage.setItem("nf_photos", JSON.stringify(progressPhotos)); }, [progressPhotos]);

  const waterToday = waterLog[todayKey] || 0;

  // ── Greeting ────────────────────────────────────────────────────────────────
  const greetingHour = new Date().getHours();
  const greeting = greetingHour >= 5  && greetingHour < 12 ? { text: "Good morning",    emoji: "🌅" }
                 : greetingHour >= 12 && greetingHour < 17 ? { text: "Good afternoon",   emoji: "☀️" }
                 : greetingHour >= 17 && greetingHour < 21 ? { text: "Good evening",     emoji: "🌆" }
                 :                                           { text: "Late night grind",  emoji: "🌙" };

  // ── Sleep ───────────────────────────────────────────────────────────────────
  const _yd = new Date(); _yd.setDate(_yd.getDate() - 1);
  const yesterdayKey = localDateKey(_yd);
  const sleepEntry = sleepLog[todayKey] || sleepLog[yesterdayKey] || null;
  const sleepDateLabel = sleepLog[todayKey] ? "Today" : sleepLog[yesterdayKey] ? "Last night" : null;
  const sleepQualityMeta = sleepEntry ? SLEEP_QUALITY.find(q => q.id === sleepEntry.quality) : null;

  // ── Apple Health (HealthKit) — placed here so todayKey, yesterdayKey, setSleepLog are in scope ──
  const syncHealthKit = useCallback(async () => {
    if (hkSyncing) return;
    setHkSyncing(true);
    try {
      const data = await syncToday(todayKey);
      setHkData(data);
      setHkLastSync(new Date());
      if (data.sleepHours != null) {
        setSleepLog(prev => {
          if (prev[todayKey] || prev[yesterdayKey]) return prev;
          return { ...prev, [todayKey]: { hours: data.sleepHours, quality: "good", source: "apple_health" } };
        });
      }
    } catch {
      // HealthKit not available in browser/simulator — silently no-op
    } finally {
      setHkSyncing(false);
    }
  }, [hkSyncing, todayKey, yesterdayKey]);

  useEffect(() => {
    isHealthKitAvailable().then(available => {
      setHkAvailable(available);
      if (available) requestHealthKitAuth().then(() => syncHealthKit()).catch(() => {});
    });
  // only run on mount — syncHealthKit ref is stable on first render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schedule daily notification reminders when the app opens or prefs change
  useEffect(() => {
    const ids = scheduleAll(profile, supplements.length);
    return () => ids.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.notifSupplements, profile.notifSupplementTime, profile.notifWater, profile.notifWaterTime, profile.notifMeals, profile.notifMealTime, supplements.length]);

  // ── Recovery (from workout timestamps) ─────────────────────────────────────
  const sortedByRecent = [...workouts].sort((a, b) => b.id - a.id);
  const lastWorkoutId = sortedByRecent[0]?.id ?? null;
  const hoursSinceWorkout = lastWorkoutId ? (Date.now() - lastWorkoutId) / 3600000 : null;
  const recoveryData = (() => {
    const LEVELS = [
      { label: "Rest",     rec: "Skip training — sleep and stretch only",           color: () => COLORS.warn   },
      { label: "Low",      rec: "Active recovery — walk, foam roll, light stretch",  color: () => COLORS.orange },
      { label: "Moderate", rec: "Light to moderate session only",                    color: () => COLORS.yellow },
      { label: "Good",     rec: "Ready for a solid training session",                color: () => COLORS.accent },
      { label: "Optimal",  rec: "Peak window — go hard today",                       color: () => COLORS.blue   },
    ];

    // Base score from time since last workout (0–4 scale)
    let score = hoursSinceWorkout === null ? 3
      : hoursSinceWorkout < 8  ? 0
      : hoursSinceWorkout < 16 ? 1
      : hoursSinceWorkout < 24 ? 2
      : hoursSinceWorkout < 48 ? 3
      : 4;

    const factors = [];

    // Sleep modifier
    if (sleepEntry) {
      const h = parseFloat(sleepEntry.hours) || 7;
      if (h < 5)      { score -= 2; factors.push({ text: `${h}h sleep — very low`, bad: true }); }
      else if (h < 6) { score -= 1; factors.push({ text: `${h}h sleep — low`, bad: true }); }
      else if (h >= 7){ factors.push({ text: `${h}h sleep`, bad: false }); }
      else            { factors.push({ text: `${h}h sleep`, bad: false }); }

      if (sleepEntry.quality === "poor")  { score -= 1; factors.push({ text: "Poor sleep quality", bad: true }); }
      else if (sleepEntry.quality === "great") { score += 1; factors.push({ text: "Great sleep quality", bad: false }); }
    } else {
      factors.push({ text: "No sleep logged", bad: false });
    }

    // Training load — workouts in last 3 days
    const threeDaysAgo = Date.now() - 3 * 86400000;
    const recentCount = workouts.filter(w => w.id > threeDaysAgo).length;
    if (recentCount >= 3)      { score -= 2; factors.push({ text: `${recentCount} sessions in 3 days`, bad: true }); }
    else if (recentCount === 2){ score -= 1; factors.push({ text: "2 sessions recently", bad: false }); }
    else if (recentCount === 0){ score += 1; factors.push({ text: "Well rested — no recent sessions", bad: false }); }
    else                       { factors.push({ text: "1 recent session", bad: false }); }

    // Time context
    if (hoursSinceWorkout !== null) {
      const h = Math.round(hoursSinceWorkout);
      factors.push({ text: `${h < 24 ? `${h}h` : `${Math.round(h/24)}d`} since last session`, bad: hoursSinceWorkout < 16 });
    }

    score = Math.max(0, Math.min(4, score));
    return { ...LEVELS[score], score, factors, noData: hoursSinceWorkout === null && !sleepEntry };
  })();
  const waterGoal = profile.waterGoal || 2500;

  const maxW = viewMode === "webapp" ? 960 : 480;
  const fmtSec = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Auth gate (after all hooks) ─────────────────────────────────────────────
  if (authSession === undefined) {
    return <div style={{ minHeight: "100dvh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.muted, fontSize: 14 }}>Loading…</div>;
  }
  if (supabase && authSession === null) {
    return <AuthScreen onAuth={(session, name) => {
      setAuthSession(session);
      if (name) setProfile(p => ({ ...p, name }));
    }} />;
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: "100dvh", color: COLORS.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: maxW, width: "100%", margin: "0 auto", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        body { color-scheme: ${isDark ? "dark" : "light"}; }
        select option { background: ${COLORS.card}; color: ${COLORS.text}; }
        ::placeholder { color: ${COLORS.muted}; opacity: 0.7; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes tourPulse { 0%,100% { outline-color: ${COLORS.accent}; outline-width: 2px; } 50% { outline-color: ${COLORS.accent}88; outline-width: 3px; } }
        button { touch-action: manipulation; }
        input, textarea, select { touch-action: manipulation; -webkit-user-select: text !important; user-select: text !important; font-size: 16px !important; }
      `}</style>

      {/* Fixed header — padded for iOS status bar */}
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: maxW, zIndex: 300, background: isDark ? "rgba(10,10,15,0.9)" : "rgba(242,242,247,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${COLORS.border}` }}>
      <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 12px) 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, fontFamily: "'Space Mono', monospace" }}>VitalCenter</div>
          {tab === "dashboard" && (
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
              {profile.name ? `${greeting.text}, ${profile.name.split(" ")[0]}` : greeting.text}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {/* Sub-tab switcher pill — only visible when inside a group tab */}
          {(() => {
            const trackGroup = ["nutrition", "workout"];
            const wellbeingGroup = ["health", "supplements"];
            const inTrack = trackGroup.includes(tab);
            const inWellbeing = wellbeingGroup.includes(tab);
            if (!inTrack && !inWellbeing) return null;
            const groupItems = (inTrack ? trackGroup : wellbeingGroup).map(id => NAV.find(n => n.id === id));
            const currentNav = NAV.find(n => n.id === tab);
            return (
              <div style={{ position: "relative", ...hl("pill") }}>
                <button onClick={() => setShowPillDropdown(v => !v)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: showPillDropdown ? COLORS.accentDim : COLORS.card, border: `1px solid ${showPillDropdown ? COLORS.accent : COLORS.border}`, borderRadius: 99, cursor: "pointer", transition: "background 0.15s, border-color 0.15s" }}>
                  <span style={{ fontSize: 13, lineHeight: 1 }}>{currentNav?.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: showPillDropdown ? COLORS.accent : COLORS.text }}>{currentNav?.label}</span>
                  <span style={{ fontSize: 9, color: COLORS.muted, lineHeight: 1, transition: "transform 0.2s", display: "inline-block", transform: showPillDropdown ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                </button>
                {showPillDropdown && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 499 }} onClick={() => setShowPillDropdown(false)} />
                    <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 500, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden", minWidth: 148, boxShadow: "0 8px 24px #0003" }}>
                      {groupItems.map((n, i) => {
                        const isActive = tab === n.id;
                        return (
                          <button key={n.id} onClick={() => { navigateTo(n.id); setShowPillDropdown(false); }}
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: isActive ? COLORS.accentDim : "transparent", border: "none", borderBottom: i < groupItems.length - 1 ? `1px solid ${COLORS.border}` : "none", cursor: "pointer", textAlign: "left" }}>
                            <span style={{ fontSize: 16, lineHeight: 1 }}>{n.icon}</span>
                            <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? COLORS.accent : COLORS.text }}>{n.label}</span>
                            {isActive && <span style={{ marginLeft: "auto", fontSize: 10, color: COLORS.accent }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.accentDim, border: `2px solid ${COLORS.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer", flexShrink: 0 }} onClick={() => setTab("profile")}>
            {profile.gender === "female" ? "👩" : "🧑"}
          </div>
        </div>
      </div>
      {activeSession && !showActiveWorkout && (
        <div onClick={() => setShowActiveWorkout(true)}
          style={{ margin: "0 20px 10px", background: COLORS.accentDim, border: `1px solid ${COLORS.accentMid}`, borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.accent }} />
            <span style={{ fontSize: 12, color: COLORS.accent, fontWeight: 700 }}>Session in progress</span>
          </div>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, fontWeight: 800, color: COLORS.accent }}>{fmtSec(sessionElapsed)}</span>
        </div>
      )}
      </div>

      {/* Tab Content */}
      <div style={{ padding: "16px 20px 0", paddingTop: "calc(env(safe-area-inset-top, 0px) + 76px)" }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: hkAvailable ? 8 : 14 }}>
              {[
                { label: "Calories", value: totalCals, unit: "kcal", color: COLORS.yellow, icon: "⚡" },
                { label: "Workouts", value: workouts.filter(w => w.date === "Today").length, unit: "today", color: COLORS.accent, icon: "△" },
                { label: "Supps", value: `${suppsTakenToday}/${supplements.length}`, unit: "taken", color: COLORS.purple, icon: "❋" },
                { label: "Water", value: waterToday >= 1000 ? `${(waterToday/1000).toFixed(1)}L` : `${waterToday}ml`, unit: `/ ${waterGoal/1000}L`, color: COLORS.blue, icon: "💧" },
              ].map(s => (
                <div key={s.label} style={{ background: COLORS.card, borderRadius: 12, padding: "10px 8px", textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 14, marginBottom: 2 }}>{s.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: s.color, fontFamily: "'Space Mono',monospace" }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: COLORS.muted }}>{s.unit}</div>
                  <div style={{ fontSize: 9, color: COLORS.mutedLight, marginTop: 1, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Apple Health row — only rendered when HealthKit is available (native iOS build) */}
            {hkAvailable && (
              <div style={{ background: COLORS.card, borderRadius: 14, padding: "12px 14px", marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 15 }}>❤️</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Apple Health</span>
                    {hkLastSync && <span style={{ fontSize: 9, color: COLORS.muted }}>· synced {hkLastSync.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>}
                  </div>
                  <button
                    onClick={syncHealthKit}
                    disabled={hkSyncing}
                    style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8, background: hkSyncing ? COLORS.accentDim : COLORS.accent, color: hkSyncing ? COLORS.accent : "#000", border: "none", cursor: hkSyncing ? "default" : "pointer" }}
                  >
                    {hkSyncing ? "Syncing…" : "Sync"}
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {[
                    { label: "Steps",       value: hkData.steps        != null ? hkData.steps.toLocaleString() : "--",        unit: "today",   color: COLORS.accent  },
                    { label: "Active Cal",  value: hkData.activeCalories != null ? `${hkData.activeCalories}` : "--",          unit: "kcal",    color: COLORS.orange  },
                    { label: "Heart Rate",  value: hkData.heartRate     != null ? hkData.heartRate : "--",                     unit: "bpm avg", color: COLORS.warn    },
                  ].map(s => (
                    <div key={s.label} style={{ background: COLORS.bg, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: "'Space Mono',monospace" }}>{s.value}</div>
                      <div style={{ fontSize: 9, color: COLORS.muted }}>{s.unit}</div>
                      <div style={{ fontSize: 9, color: COLORS.mutedLight, marginTop: 1, fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {hkData.distanceKm != null && (
                  <div style={{ marginTop: 8, fontSize: 11, color: COLORS.muted, textAlign: "center" }}>
                    🚶 {profile.weightUnit === "lbs" ? `${(hkData.distanceKm * 0.621371).toFixed(2)} mi` : `${hkData.distanceKm.toFixed(2)} km`} walked / run today
                  </div>
                )}
              </div>
            )}

            {/* Today's Routine */}
            {todayRoutine && (() => {
              const exs = todayRoutine.exercises || [];
              const checkKey = `${todayDayKey}_${todayKey}`;
              const done = routineChecks[checkKey] || [];
              const doneCount = exs.filter(e => done.includes(e.id)).length;
              return (
                <div onClick={() => setTab("workout")} style={{ background: ROUTINE_TYPE_COLOR[todayRoutine.type] + "18", border: `1px solid ${ROUTINE_TYPE_COLOR[todayRoutine.type]}44`, borderRadius: 14, padding: "12px 16px", marginBottom: 14, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: exs.length ? 8 : 0 }}>
                    <div>
                      <div style={{ fontSize: 10, color: ROUTINE_TYPE_COLOR[todayRoutine.type], fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Today&apos;s Plan</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{todayRoutine.name}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <Badge text={todayRoutine.type} color={ROUTINE_TYPE_COLOR[todayRoutine.type]} />
                      {exs.length > 0 && <span style={{ fontSize: 10, color: COLORS.muted }}>{doneCount}/{exs.length} done</span>}
                    </div>
                  </div>
                  {exs.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {exs.map(e => (
                        <span key={e.id} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: done.includes(e.id) ? ROUTINE_TYPE_COLOR[todayRoutine.type] + "44" : COLORS.card, color: done.includes(e.id) ? ROUTINE_TYPE_COLOR[todayRoutine.type] : COLORS.muted, fontWeight: 600, textDecoration: done.includes(e.id) ? "line-through" : "none" }}>
                          {e.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <p style={{ margin: "0 0 10px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Today&apos;s Calories</p>
            <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
              <CalorieBar consumed={totalCals} goal={calorieGoal} />
            </div>

            <p style={{ margin: "0 0 10px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Today&apos;s Supplements</p>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}>
              {supplements.map(s => (
                <div key={s.id} style={{ minWidth: 80, background: COLORS.card, borderRadius: 12, padding: 10, textAlign: "center", border: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
                  <div style={{ fontSize: 22 }}>{s.emoji}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.text, marginTop: 4 }}>{s.name}</div>
                  <div style={{ fontSize: 9, color: COLORS.muted }}>{s.dose}</div>
                </div>
              ))}
            </div>

            <p style={{ margin: "0 0 10px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Recent Workouts</p>
            {workouts.length === 0 ? (
              <div style={{ background: COLORS.card, borderRadius: 12, padding: 20, marginBottom: 8, border: `1px solid ${COLORS.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>△</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>No sessions yet</div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Tap Workout to start your first session</div>
              </div>
            ) : workouts.slice(0, 3).map(w => (
              <div key={w.id} style={{ background: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 8, border: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{w.type === "Cardio" ? "🏃" : w.type === "Mobility" ? "🧘" : "💪"}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{w.name}</div>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>{w.duration}min · {w.calories}kcal</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: COLORS.muted }}>{w.date}</span>
              </div>
            ))}

            <p style={{ margin: "14px 0 10px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Today&apos;s Meals</p>
            {todayMeals.length === 0 ? (
              <div style={{ background: COLORS.card, borderRadius: 12, padding: 20, marginBottom: 8, border: `1px solid ${COLORS.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>◎</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>No meals logged yet</div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Tap Nutrition to scan or log a meal</div>
              </div>
            ) : todayMeals.map(m => (
              <div key={m.id} style={{ background: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 8, border: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{m.img}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>{m.time}</div>
                  </div>
                </div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, fontWeight: 700, color: COLORS.yellow }}>{m.calories}<span style={{ fontSize: 10, color: COLORS.muted }}> kcal</span></div>
              </div>
            ))}
          </div>
        )}

        {/* ── NUTRITION ── */}
        {tab === "nutrition" && (() => {
          const deleteMeal = (id) => {
            setMeals(prev => prev.filter(m => m.id !== id));
            if (supabase && authSession?.user?.id) supabase.from("meals").delete().eq("id", id);
          };
          const addWater = (ml) => {
            setWaterLog(prev => {
              const newTotal = (prev[todayKey] || 0) + ml;
              if (supabase && authSession?.user?.id)
                supabase.from("water_log").upsert({ user_id: authSession.user.id, date: todayKey, ml: newTotal });
              return { ...prev, [todayKey]: newTotal };
            });
          };
          const resetWater = () => {
            setWaterLog(prev => {
              if (supabase && authSession?.user?.id)
                supabase.from("water_log").upsert({ user_id: authSession.user.id, date: todayKey, ml: 0 });
              return { ...prev, [todayKey]: 0 };
            });
          };

          // History: group meals by date, sorted newest first
          const mealsByDate = meals.reduce((acc, m) => {
            const d = m.logged_date || todayKey;
            if (!acc[d]) acc[d] = [];
            acc[d].push(m);
            return acc;
          }, {});
          const historyDates = Object.keys(mealsByDate).sort((a, b) => b.localeCompare(a));

          // Trends: last 7 days
          const last7 = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            return localDateKey(d);
          });
          const fmtDay = d => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
          const fmtDateShort = d => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

          return (
            <div>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono', monospace" }}>Nutrition</h2>
                {nutritionView === "today" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setShowManualMeal(true)} style={{ padding: "8px 10px", background: COLORS.bg, color: COLORS.mutedLight, border: `1px solid ${COLORS.border}`, borderRadius: 10, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>+ Manual</button>
                    <button onClick={() => setShowFoodSearch(true)} style={{ padding: "8px 10px", background: `${COLORS.blue}22`, color: COLORS.blue, border: `1px solid ${COLORS.blue}44`, borderRadius: 10, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>🔍 Search</button>
                    <button onClick={() => setShowScanner(true)} style={{ padding: "8px 12px", background: COLORS.accent, color: "#000", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 11, cursor: "pointer" }}>📸 Scan</button>
                  </div>
                )}
              </div>

              {/* Sub-tabs */}
              <div style={{ display: "flex", background: COLORS.card, borderRadius: 12, padding: 4, marginBottom: 16, border: `1px solid ${COLORS.border}`, ...hl("nutrition-subtabs") }}>
                {[["today","Today"],["history","History"],["trends","Trends"]].map(([v, label]) => (
                  <button key={v} onClick={() => setNutritionView(v)}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", background: nutritionView === v ? COLORS.accent : "transparent", color: nutritionView === v ? "#000" : COLORS.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.2s" }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* ── TODAY ── */}
              {nutritionView === "today" && (
                <>
                  <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
                    <CalorieBar consumed={totalCals} goal={calorieGoal} />
                    <div style={{ display: "flex", justifyContent: "space-around", marginTop: 16 }}>
                      <MacroRing label="Protein" value={totalProtein} max={macroTargets.protein} color={COLORS.accent} size={72} />
                      <MacroRing label="Carbs"   value={totalCarbs}   max={macroTargets.carbs}   color={COLORS.blue}   size={72} />
                      <MacroRing label="Fat"     value={totalFat}     max={macroTargets.fat}      color={COLORS.orange} size={72} />
                    </div>
                  </div>

                  <WaterCard waterToday={waterToday} waterGoal={waterGoal} onAdd={addWater} onReset={resetWater} />

                  <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Daily Targets</p>
                      <span style={{ fontSize: 10, color: COLORS.accent, fontWeight: 700 }}>{profile.goal === "lose" ? "Cut 🔥" : profile.goal === "gain" ? "Bulk 💪" : "Maintain ⚖️"}</span>
                    </div>
                    {[
                      { label: "Calories", value: `${calorieGoal} kcal`, sub: `TDEE ${tdee} kcal`, color: COLORS.yellow },
                      { label: "Protein",  value: `${macroTargets.protein}g`, sub: `${Math.round(macroTargets.protein * 4)} kcal · 30%`, color: COLORS.accent },
                      { label: "Carbs",    value: `${macroTargets.carbs}g`,   sub: `${Math.round(macroTargets.carbs * 4)} kcal · 40%`,   color: COLORS.blue },
                      { label: "Fat",      value: `${macroTargets.fat}g`,     sub: `${Math.round(macroTargets.fat * 9)} kcal · 30%`,     color: COLORS.orange },
                    ].map(row => (
                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{row.label}</span>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: row.color, fontFamily: "'Space Mono',monospace" }}>{row.value}</span>
                          <span style={{ fontSize: 10, color: COLORS.muted, marginLeft: 6 }}>{row.sub}</span>
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 12, background: COLORS.bg, borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, marginBottom: 4 }}>WEEKLY FLEXIBLE BUDGET</div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: COLORS.mutedLight }}>Normal days × {7 - profile.cheatDays}</span>
                        <span style={{ fontSize: 12, color: COLORS.text, fontWeight: 700 }}>{(calorieGoal * (7 - profile.cheatDays)).toLocaleString()} kcal</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: COLORS.mutedLight }}>Cheat days × {profile.cheatDays} 🍕</span>
                        <span style={{ fontSize: 12, color: COLORS.orange, fontWeight: 700 }}>{(cheatDayCalories * profile.cheatDays).toLocaleString()} kcal</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
                        <span style={{ fontSize: 12, color: COLORS.text, fontWeight: 700 }}>Weekly Total</span>
                        <span style={{ fontSize: 14, color: COLORS.accent, fontWeight: 800, fontFamily: "'Space Mono',monospace" }}>{weeklyCalBudget.toLocaleString()} kcal</span>
                      </div>
                    </div>
                  </div>

                  <p style={{ margin: "0 0 10px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Today&apos;s Meals</p>
                  {todayMeals.length === 0 ? (
                    <div style={{ background: COLORS.card, borderRadius: 14, padding: 24, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>No meals logged</div>
                      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>Tap 📸 Scan Meal to analyse a photo, or log manually</div>
                    </div>
                  ) : todayMeals.map(m => (
                    <div key={m.id} style={{ background: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${COLORS.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 28 }}>{m.img}</span>
                          <div><div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{m.name}</div><div style={{ fontSize: 11, color: COLORS.muted }}>{m.time}</div></div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 16, fontWeight: 700, color: COLORS.yellow }}>{m.calories}<span style={{ fontSize: 11, color: COLORS.muted }}> kcal</span></div>
                          <button onClick={() => deleteMeal(m.id)} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 14, cursor: "pointer", padding: 0 }}>✕</button>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {[{ l: "Protein", v: m.protein, c: COLORS.accent }, { l: "Carbs", v: m.carbs, c: COLORS.blue }, { l: "Fat", v: m.fat, c: COLORS.orange }].map(x => (
                          <div key={x.l} style={{ flex: 1, background: COLORS.bg, borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: x.c }}>{x.v}g</div>
                            <div style={{ fontSize: 10, color: COLORS.muted }}>{x.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* ── HISTORY ── */}
              {nutritionView === "history" && (
                <div>
                  {historyDates.length === 0 ? (
                    <div style={{ background: COLORS.card, borderRadius: 14, padding: 32, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>No history yet</div>
                      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>Start logging meals to build your history</div>
                    </div>
                  ) : historyDates.map(date => {
                    const dayMeals = mealsByDate[date];
                    const dayCals = dayMeals.reduce((s, m) => s + m.calories, 0);
                    const dayWater = waterLog[date] || 0;
                    const calPct = Math.min(dayCals / calorieGoal, 1);
                    const waterPct = Math.min(dayWater / waterGoal, 1);
                    const calColor = calPct >= 0.9 && calPct <= 1.1 ? COLORS.accent : calPct > 1.1 ? COLORS.warn : COLORS.yellow;
                    return (
                      <div key={date} style={{ background: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 12, border: `1px solid ${COLORS.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.text }}>{date === todayKey ? "Today" : fmtDateShort(date)}</div>
                            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 1 }}>{dayMeals.length} meal{dayMeals.length !== 1 ? "s" : ""}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: calColor, fontFamily: "'Space Mono',monospace" }}>{dayCals} kcal</div>
                            <div style={{ fontSize: 10, color: COLORS.blue }}>{dayWater >= 1000 ? `${(dayWater/1000).toFixed(1)}L` : `${dayWater}ml`} water</div>
                          </div>
                        </div>
                        {/* Calorie bar */}
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ height: 5, background: COLORS.bg, borderRadius: 99, overflow: "hidden", marginBottom: 3 }}>
                            <div style={{ height: "100%", width: `${calPct * 100}%`, background: `linear-gradient(90deg,${calColor},${calColor}aa)`, borderRadius: 99, transition: "width 0.5s" }} />
                          </div>
                          <div style={{ height: 5, background: COLORS.bg, borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${waterPct * 100}%`, background: "linear-gradient(90deg,#4d9fff,#00c3ff)", borderRadius: 99, transition: "width 0.5s" }} />
                          </div>
                        </div>
                        {/* Meal list */}
                        <div style={{ marginTop: 10, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                          {dayMeals.map(m => (
                            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 18 }}>{m.img}</span>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{m.name}</div>
                                  <div style={{ fontSize: 10, color: COLORS.muted }}>{m.protein}g P · {m.carbs}g C · {m.fat}g F</div>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.yellow, fontFamily: "'Space Mono',monospace" }}>{m.calories}</span>
                                <button onClick={() => deleteMeal(m.id)} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 12, cursor: "pointer", padding: 0 }}>✕</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── TRENDS ── */}
              {nutritionView === "trends" && (() => {
                const barH = 100;
                const calData = last7.map(d => ({ d, cals: (mealsByDate[d] || []).reduce((s, m) => s + m.calories, 0), water: waterLog[d] || 0 }));
                const maxCals = Math.max(...calData.map(x => x.cals), calorieGoal);
                const maxWater = Math.max(...calData.map(x => x.water), waterGoal);
                const avgCals = Math.round(calData.reduce((s, x) => s + x.cals, 0) / 7);
                const avgWater = Math.round(calData.reduce((s, x) => s + x.water, 0) / 7);
                const daysOnCalTarget = calData.filter(x => x.cals >= calorieGoal * 0.85 && x.cals <= calorieGoal * 1.15).length;
                const daysOnWaterTarget = calData.filter(x => x.water >= waterGoal * 0.9).length;

                return (
                  <div>
                    {/* Summary stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                      {[
                        { label: "Avg Calories", value: `${avgCals}`, unit: "kcal/day", color: COLORS.yellow, icon: "🔥" },
                        { label: "Avg Water", value: avgWater >= 1000 ? `${(avgWater/1000).toFixed(1)}L` : `${avgWater}ml`, unit: "per day", color: COLORS.blue, icon: "💧" },
                        { label: "Calorie Goals Hit", value: `${daysOnCalTarget}/7`, unit: "days on target", color: COLORS.accent, icon: "◎" },
                        { label: "Hydration Goals Hit", value: `${daysOnWaterTarget}/7`, unit: "days on target", color: COLORS.purple, icon: "✓" },
                      ].map(s => (
                        <div key={s.label} style={{ background: COLORS.card, borderRadius: 14, padding: 14, border: `1px solid ${COLORS.border}` }}>
                          <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'Space Mono',monospace" }}>{s.value}</div>
                          <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>{s.unit}</div>
                          <div style={{ fontSize: 11, color: COLORS.mutedLight, fontWeight: 600, marginTop: 4 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Calorie chart */}
                    <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Calories — Last 7 Days</p>
                        <span style={{ fontSize: 10, color: COLORS.yellow, fontWeight: 700 }}>Goal: {calorieGoal} kcal</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: barH + 24 }}>
                        {calData.map(({ d, cals }) => {
                          const h = maxCals > 0 ? Math.max(4, (cals / maxCals) * barH) : 4;
                          const goalH = (calorieGoal / maxCals) * barH;
                          const color = cals === 0 ? COLORS.border : (cals >= calorieGoal * 0.85 && cals <= calorieGoal * 1.15) ? COLORS.accent : cals > calorieGoal * 1.15 ? COLORS.warn : COLORS.yellow;
                          return (
                            <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, position: "relative" }}>
                              <div style={{ fontSize: 9, color: COLORS.muted, height: 14, display: "flex", alignItems: "center" }}>{cals > 0 ? `${Math.round(cals/100)*100}` : ""}</div>
                              <div style={{ width: "100%", position: "relative", height: barH }}>
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${h}px`, background: `${color}cc`, borderRadius: "4px 4px 0 0", transition: "height 0.4s ease" }} />
                                <div style={{ position: "absolute", bottom: goalH, left: 0, right: 0, height: 1, background: `${COLORS.yellow}66`, borderTop: `1px dashed ${COLORS.yellow}66` }} />
                              </div>
                              <div style={{ fontSize: 9, color: d === todayKey ? COLORS.accent : COLORS.muted, fontWeight: d === todayKey ? 700 : 400 }}>{fmtDay(d)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Water chart */}
                    <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>💧 Water — Last 7 Days</p>
                        <span style={{ fontSize: 10, color: COLORS.blue, fontWeight: 700 }}>Goal: {waterGoal >= 1000 ? `${waterGoal/1000}L` : `${waterGoal}ml`}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: barH + 24 }}>
                        {calData.map(({ d, water }) => {
                          const h = maxWater > 0 ? Math.max(4, (water / maxWater) * barH) : 4;
                          const goalH = (waterGoal / maxWater) * barH;
                          const color = water === 0 ? COLORS.border : water >= waterGoal * 0.9 ? COLORS.blue : COLORS.mutedLight;
                          return (
                            <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, position: "relative" }}>
                              <div style={{ fontSize: 9, color: COLORS.muted, height: 14, display: "flex", alignItems: "center" }}>{water > 0 ? (water >= 1000 ? `${(water/1000).toFixed(1)}L` : `${water}`) : ""}</div>
                              <div style={{ width: "100%", position: "relative", height: barH }}>
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${h}px`, background: `${color}cc`, borderRadius: "4px 4px 0 0", transition: "height 0.4s ease" }} />
                                <div style={{ position: "absolute", bottom: goalH, left: 0, right: 0, height: 1, background: `${COLORS.blue}66`, borderTop: `1px dashed ${COLORS.blue}66` }} />
                              </div>
                              <div style={{ fontSize: 9, color: d === todayKey ? COLORS.accent : COLORS.muted, fontWeight: d === todayKey ? 700 : 400 }}>{fmtDay(d)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Macro breakdown — last 7 days avg */}
                    {meals.length > 0 && (() => {
                      const recent = meals.filter(m => last7.includes(m.logged_date));
                      if (!recent.length) return null;
                      const avgP = Math.round(recent.reduce((s, m) => s + m.protein, 0) / 7);
                      const avgC = Math.round(recent.reduce((s, m) => s + m.carbs, 0) / 7);
                      const avgF = Math.round(recent.reduce((s, m) => s + m.fat, 0) / 7);
                      const totalMacroG = avgP + avgC + avgF || 1;
                      return (
                        <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, border: `1px solid ${COLORS.border}` }}>
                          <p style={{ margin: "0 0 14px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Avg Macro Split — 7-Day</p>
                          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                            {[{ l: "Protein", v: avgP, c: COLORS.accent, t: macroTargets.protein }, { l: "Carbs", v: avgC, c: COLORS.blue, t: macroTargets.carbs }, { l: "Fat", v: avgF, c: COLORS.orange, t: macroTargets.fat }].map(x => (
                              <div key={x.l} style={{ flex: 1, background: COLORS.bg, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: x.c, fontFamily: "'Space Mono',monospace" }}>{x.v}g</div>
                                <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>{x.l}</div>
                                <div style={{ fontSize: 9, color: x.v >= x.t * 0.9 ? COLORS.accent : COLORS.muted, marginTop: 2 }}>{Math.round((x.v / x.t) * 100)}% of goal</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ height: 8, borderRadius: 99, overflow: "hidden", display: "flex" }}>
                            <div style={{ flex: avgP, background: COLORS.accent, transition: "flex 0.5s" }} />
                            <div style={{ flex: avgC, background: COLORS.blue, transition: "flex 0.5s" }} />
                            <div style={{ flex: avgF, background: COLORS.orange, transition: "flex 0.5s" }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                            <span style={{ fontSize: 9, color: COLORS.accent }}>{Math.round((avgP * 4 / (avgP * 4 + avgC * 4 + avgF * 9 || 1)) * 100)}% P</span>
                            <span style={{ fontSize: 9, color: COLORS.blue }}>{Math.round((avgC * 4 / (avgP * 4 + avgC * 4 + avgF * 9 || 1)) * 100)}% C</span>
                            <span style={{ fontSize: 9, color: COLORS.orange }}>{Math.round((avgF * 9 / (avgP * 4 + avgC * 4 + avgF * 9 || 1)) * 100)}% F</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ── WORKOUT ── */}
        {tab === "workout" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono', monospace" }}>Workouts</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowQuickLog(true)} style={{ padding: "8px 12px", background: COLORS.bg, color: COLORS.mutedLight, border: `1px solid ${COLORS.border}`, borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Quick Log</button>
                <button onClick={() => setShowRunTracker(true)} style={{ padding: "8px 12px", background: COLORS.bg, color: COLORS.blue, border: `1px solid ${COLORS.border}`, borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>🏃 Run</button>
                <button onClick={() => { if (activeSession) return; if (todayRoutine?.exercises?.length > 0) { setShowSessionStart(true); } else { startActiveSession(); } }} disabled={!!activeSession} style={{ padding: "8px 14px", background: activeSession ? COLORS.accentDim : COLORS.accent, color: activeSession ? COLORS.accent : "#000", border: activeSession ? `1px solid ${COLORS.accentMid}` : "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: activeSession ? "default" : "pointer" }}>{activeSession ? "● Active" : "▶ Start"}</button>
              </div>
            </div>
            {/* Weekly Routine Planner */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Weekly Routine</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                {DAYS_MAP.map(({ key, label }) => {
                  const plan = weeklyRoutine[key];
                  const isToday = key === todayDayKey;
                  return (
                    <div key={key} onClick={() => setRoutineDay({ key, label })}
                      style={{ background: plan ? ROUTINE_TYPE_COLOR[plan.type] + "22" : COLORS.card, borderRadius: 10, padding: "8px 4px", textAlign: "center", border: `1px solid ${isToday ? (plan ? ROUTINE_TYPE_COLOR[plan.type] : COLORS.accent) : (plan ? ROUTINE_TYPE_COLOR[plan.type] + "44" : COLORS.border)}`, cursor: "pointer", position: "relative" }}>
                      {isToday && <div style={{ position: "absolute", top: 3, right: 3, width: 5, height: 5, borderRadius: "50%", background: COLORS.accent }} />}
                      <div style={{ fontSize: 9, color: isToday ? COLORS.accent : COLORS.muted, fontWeight: 700, marginBottom: 4 }}>{label}</div>
                      {plan ? (
                        <>
                          <div style={{ fontSize: 14 }}>{plan.type === "Rest" ? "😴" : plan.type === "Cardio" ? "🏃" : plan.type === "Mobility" ? "🧘" : plan.type === "HIIT" ? "⚡" : plan.type === "Sport" ? "⚽" : "💪"}</div>
                          <div style={{ fontSize: 8, color: ROUTINE_TYPE_COLOR[plan.type], fontWeight: 700, marginTop: 3, lineHeight: 1.2 }}>{plan.name.length > 8 ? plan.name.slice(0, 7) + "…" : plan.name}</div>
                          {(plan.exercises || []).length > 0 && <div style={{ fontSize: 8, color: COLORS.muted, marginTop: 2 }}>{plan.exercises.length} ex</div>}
                        </>
                      ) : (
                        <div style={{ fontSize: 16, color: COLORS.border }}>+</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Today's Exercise Checklist */}
            {todayRoutine && (todayRoutine.exercises || []).length > 0 && (() => {
              const checkKey = `${todayDayKey}_${todayKey}`;
              const done = routineChecks[checkKey] || [];
              const toggle = (id) => setRoutineChecks(prev => {
                const current = prev[checkKey] || [];
                const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
                return { ...prev, [checkKey]: next };
              });
              return (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Today&apos;s Exercises — {todayRoutine.name}</p>
                    <span style={{ fontSize: 11, color: COLORS.accent, fontWeight: 700 }}>{done.length}/{todayRoutine.exercises.length}</span>
                  </div>
                  {todayRoutine.exercises.map(ex => {
                    const isDone = done.includes(ex.id);
                    return (
                      <div key={ex.id} onClick={() => toggle(ex.id)}
                        style={{ display: "flex", alignItems: "center", gap: 12, background: COLORS.card, borderRadius: 12, padding: "12px 14px", marginBottom: 8, border: `1px solid ${isDone ? ROUTINE_TYPE_COLOR[todayRoutine.type] + "66" : COLORS.border}`, cursor: "pointer", opacity: isDone ? 0.7 : 1 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isDone ? ROUTINE_TYPE_COLOR[todayRoutine.type] : COLORS.border}`, background: isDone ? ROUTINE_TYPE_COLOR[todayRoutine.type] : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {isDone && <span style={{ fontSize: 13, color: "#000", fontWeight: 900 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, textDecoration: isDone ? "line-through" : "none" }}>{ex.name}</div>
                          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 1 }}>
                            {[ex.sets && `${ex.sets} sets`, ex.reps && `${ex.reps} reps`, ex.weight && `${ex.weight} kg`].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        {isDone && <span style={{ fontSize: 11, color: ROUTINE_TYPE_COLOR[todayRoutine.type], fontWeight: 700 }}>Done</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16, ...hl("workout-history") }}>
              {[{ label: "Sessions", value: workouts.length, unit: "logged" }, { label: "Total Time", value: workouts.reduce((s, w) => s + w.duration, 0), unit: "min" }, { label: "Cals Burned", value: workouts.reduce((s, w) => s + w.calories, 0), unit: "kcal" }].map(s => (
                <div key={s.label} style={{ background: COLORS.card, borderRadius: 12, padding: 12, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.blue, fontFamily: "'Space Mono',monospace" }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: COLORS.muted }}>{s.unit}</div>
                  <div style={{ fontSize: 10, color: COLORS.mutedLight, marginTop: 2, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {workouts.length === 0 ? (
              <div style={{ background: COLORS.card, borderRadius: 14, padding: 32, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>💪</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>No sessions logged yet</div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 6 }}>Tap ▶ Start to begin your first tracked session</div>
              </div>
            ) : workouts.map(w => {
              const isExpanded = expandedWorkouts.has(w.id);
              const toggle = () => setExpandedWorkouts(prev => {
                const next = new Set(prev);
                next.has(w.id) ? next.delete(w.id) : next.add(w.id);
                return next;
              });
              const hasExercises = w.exercises?.length > 0;
              return (
                <div key={w.id} style={{ background: COLORS.card, borderRadius: 14, marginBottom: 10, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
                  {/* Summary row — always visible, tappable */}
                  <div onClick={toggle} style={{ padding: 16, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 18 }}>{w.type === "Cardio" ? "🏃" : w.type === "Mobility" ? "🧘" : "💪"}</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{w.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Badge text={w.type} color={workoutTypeColor[w.type] || COLORS.mutedLight} />
                        <span style={{ fontSize: 11, color: COLORS.muted }}>{w.duration}m · {w.calories} kcal{w.sets ? ` · ${w.sets} sets` : ""}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0, marginLeft: 10 }}>
                      <span style={{ fontSize: 11, color: COLORS.muted }}>{w.date}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {hasExercises && (
                          <span style={{ fontSize: 10, color: COLORS.accent, fontWeight: 700 }}>
                            {isExpanded ? "Hide ▲" : `${w.exercises.length} ex ▼`}
                          </span>
                        )}
                        <button onClick={async e => { e.stopPropagation(); const r = await shareWorkout(buildShareText(w), w.name); if (r === "copied") { setShareToast(true); setTimeout(() => setShareToast(false), 2500); } }}
                          style={{ background: "none", border: "none", color: COLORS.blue, fontSize: 13, cursor: "pointer", padding: 0, lineHeight: 1 }} title="Share workout">↗</button>
                        <button onClick={e => { e.stopPropagation(); if (window.confirm("Delete this session?")) setWorkouts(prev => prev.filter(x => x.id !== w.id)); }}
                          style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 11, cursor: "pointer", padding: 0 }}>✕</button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded exercise detail */}
                  {isExpanded && hasExercises && (
                    <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: "12px 16px 14px" }}>
                      {w.exercises.map((ex, i) => (
                        <div key={i} style={{ marginBottom: i < w.exercises.length - 1 ? 12 : 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent, marginBottom: 6 }}>{ex.name}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {ex.sets.map((s, j) => (
                              <div key={j} style={{ background: COLORS.bg, borderRadius: 6, padding: "4px 10px", fontSize: 10, color: COLORS.text, fontFamily: "'Space Mono',monospace" }}>
                                <span style={{ color: COLORS.muted }}>S{j + 1} </span>{s.reps}<span style={{ color: COLORS.muted }}>×</span><span style={{ color: COLORS.yellow }}>{s.weight}kg</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Personal Records ── */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Personal Records</p>
                <button onClick={() => setShowAddPR(true)} style={{ padding: "6px 12px", background: COLORS.bg, color: COLORS.mutedLight, border: `1px solid ${COLORS.border}`, borderRadius: 9, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>+ Add</button>
              </div>

              {Object.keys(prs).length === 0 ? (
                <div style={{ background: COLORS.card, borderRadius: 12, padding: "20px 16px", textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>🏆</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>No records yet</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>Complete a session or tap + Add to log a record</div>
                </div>
              ) : Object.entries(prs).sort(([, a], [, b]) => (b.date || "").localeCompare(a.date || "")).map(([name, rec]) => (
                <div key={name} style={{ background: COLORS.card, borderRadius: 14, padding: "14px 16px", marginBottom: 10, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: rec.history?.length >= 2 ? 8 : 0 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 13 }}>🏆</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: COLORS.yellow, fontFamily: "'Space Mono',monospace" }}>{rec.best1rm}</span>
                        <span style={{ fontSize: 12, color: COLORS.muted }}>kg est. 1RM</span>
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                        {rec.bestWeight}kg × {rec.bestReps}{rec.bestReps === 1 ? " rep" : " reps"}
                        {rec.date && <span style={{ marginLeft: 8 }}>· {new Date(rec.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                      </div>
                    </div>
                    <button onClick={() => { if (window.confirm(`Delete PR for "${name}"?`)) setPrs(prev => { const n = { ...prev }; delete n[name]; return n; }); }}
                      style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 14, cursor: "pointer", padding: "0 0 0 8px", lineHeight: 1 }}>✕</button>
                  </div>
                  {rec.history?.length >= 2 && <PRSparkline history={rec.history} />}
                  {rec.history?.length >= 2 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.muted, marginTop: 4 }}>
                      <span>{new Date(rec.history[0].date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      <span>{rec.history.length} sessions</span>
                      <span>{new Date(rec.history[rec.history.length - 1].date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── COACH ── */}
        {tab === "coach" && (
          <AICoach
            onAddMeal={meal => {
              setMeals(prev => [...prev, meal]);
              if (supabase && authSession?.user?.id) supabase.from("meals").upsert({ ...meal, user_id: authSession.user.id });
            }}
            onAddWorkout={workout => setWorkouts(prev => [workout, ...prev])}
            onEditMeal={prefill => setEditMealPrefill(prefill)}
            onEditWorkout={prefill => setEditWorkoutPrefill(prefill)}
            todayMeals={todayMeals}
            recentWorkouts={workouts.slice(0, 5)}
            profile={profile}
            hkData={hkData}
            todayKey={todayKey}
          />
        )}

        {/* ── SUPPLEMENTS ── */}
        {tab === "supplements" && (() => {
          const suppLast7Keys = Array.from({ length: 7 }, (_, i) => {
            const dd = new Date(); dd.setDate(dd.getDate() - 6 + i);
            return localDateKey(dd);
          });
          const takenTodayCount = supplements.filter(s => (s.history?.[todayKey] === true ? 1 : (s.history?.[todayKey] || 0)) > 0).length;
          const totalCount = supplements.length;
          const todayPct = totalCount > 0 ? takenTodayCount / totalCount : 0;
          return (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono', monospace" }}>Supplements</h2>
              <button onClick={() => setShowAddSupp(true)} style={{ padding: "8px 14px", background: COLORS.accent, color: "#000", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>+ Add</button>
            </div>

            {/* Daily summary card — only shown when supplements exist */}
            {totalCount > 0 && (
              <div style={{ background: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Today&apos;s Stack</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: todayPct === 1 ? COLORS.accent : COLORS.yellow, fontFamily: "'Space Mono',monospace" }}>
                    {takenTodayCount}/{totalCount}
                  </span>
                </div>
                <div style={{ height: 6, background: COLORS.bg, borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${todayPct * 100}%`, background: todayPct === 1 ? COLORS.accent : `linear-gradient(90deg,${COLORS.yellow},${COLORS.accent})`, borderRadius: 99, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {supplements.map(s => {
                    const taken = !!(s.history?.[todayKey]);
                    return (
                      <div key={s.id} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: taken ? s.color + "22" : COLORS.bg, color: taken ? s.color : COLORS.muted, border: `1px solid ${taken ? s.color + "55" : COLORS.border}` }}>
                        {taken ? "✓ " : ""}{s.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ ...hl("supplements-list") }}>
            {supplements.length === 0 ? (
              <div style={{ background: COLORS.card, borderRadius: 14, padding: 32, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>❋</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>No supplements yet</div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 6 }}>Tap + Add to log your stack</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {supplements.map(s => {
                  // Doses: 0 = not taken, 1 = standard, 2+ = extra. Backwards-compat with old boolean values.
                  const getDoses = (val) => val === true ? 1 : (typeof val === "number" ? val : 0);
                  const dosesToday = getDoses(s.history?.[todayKey]);
                  const takenToday = dosesToday > 0;

                  const setDose = (dk, count) => setSupplements(prev => prev.map(sp =>
                    sp.id === s.id ? { ...sp, history: { ...sp.history, [dk]: Math.max(0, count) } } : sp
                  ));
                  const toggleDay = (dk) => {
                    const cur = getDoses(s.history?.[dk]);
                    setDose(dk, cur > 0 ? 0 : 1);
                  };

                  // Streak
                  let streak = 0;
                  const d = new Date();
                  for (let i = 0; i < 365; i++) {
                    const k = localDateKey(d);
                    if (!getDoses(s.history?.[k])) break;
                    streak++;
                    d.setDate(d.getDate() - 1);
                  }
                  // Rolling 7-day window
                  const last7 = Array.from({ length: 7 }, (_, i) => {
                    const dd = new Date(); dd.setDate(dd.getDate() - 6 + i);
                    return { key: localDateKey(dd), label: dd.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1) };
                  });

                  return (
                    <div key={s.id} style={{ background: COLORS.card, borderRadius: 14, padding: 14, border: `1px solid ${COLORS.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 26 }}>{s.emoji}</span>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{s.name}</div>
                            <div style={{ fontSize: 11, color: COLORS.muted }}>{s.dose} · {s.timing}</div>
                            {s.benefit && <div style={{ fontSize: 11, color: s.color, marginTop: 2 }}>{s.benefit}</div>}
                          </div>
                        </div>

                        {/* Dose counter for today */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0 }}>
                          <button onClick={() => setDose(todayKey, takenToday ? 0 : 1)}
                            style={{ width: 48, height: 48, borderRadius: "50%", border: `3px solid ${takenToday ? s.color : COLORS.border}`, background: takenToday ? s.color + "22" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                            <span style={{ fontSize: takenToday ? (dosesToday > 1 ? 13 : 16) : 11, color: takenToday ? s.color : COLORS.muted, fontWeight: 800 }}>
                              {dosesToday === 0 ? "TAKE" : dosesToday === 1 ? "✓" : `×${dosesToday}`}
                            </span>
                          </button>
                          {takenToday && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <button onClick={() => setDose(todayKey, dosesToday - 1)}
                                style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.muted, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>−</button>
                              <span style={{ fontSize: 10, color: COLORS.mutedLight, minWidth: 22, textAlign: "center", fontWeight: 700 }}>{dosesToday}×</span>
                              <button onClick={() => setDose(todayKey, dosesToday + 1)}
                                style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${s.color}`, background: s.color + "22", color: s.color, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>+</button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Rolling 7-day strip */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {last7.map(({ key: dk, label }) => {
                            const doses = getDoses(s.history?.[dk]);
                            const taken = doses > 0;
                            const isToday = dk === todayKey;
                            return (
                              <button key={dk} onClick={() => toggleDay(dk)}
                                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                                <div style={{ fontSize: 8, color: isToday ? s.color : COLORS.muted, fontWeight: isToday ? 800 : 500 }}>{label}</div>
                                <div style={{ width: 26, height: 26, borderRadius: 7, background: taken ? s.color : COLORS.bg, border: `2px solid ${isToday ? s.color : taken ? s.color + "88" : COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                                  <span style={{ fontSize: doses > 1 ? 9 : 11, color: "#000", fontWeight: 900 }}>
                                    {taken ? (doses > 1 ? `×${doses}` : "✓") : ""}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {streak > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 13 }}>🔥</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: s.color }}>{streak}d streak</span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Badge text={s.category} color={s.color} />
                        <span style={{ fontSize: 10, color: COLORS.mutedLight, fontWeight: 600 }}>
                          {suppLast7Keys.filter(k => getDoses(s.history?.[k]) > 0).length}/7 days this week
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>{/* end supplements-list highlight wrapper */}
          </div>
          );
        })()}

        {/* ── HEALTH ── */}
        {tab === "health" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono', monospace" }}>Health & Recovery</h2>
              <button onClick={() => setShowInjury(true)} style={{ padding: "8px 14px", background: COLORS.warn, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>+ Log Symptom</button>
            </div>
            {/* Sleep + Recovery row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              {/* Sleep card */}
              <div onClick={() => setShowSleep(true)}
                style={{ background: COLORS.card, borderRadius: 14, padding: 14, border: `1px solid ${COLORS.border}`, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sleep</div>
                  <span style={{ fontSize: 9, color: COLORS.blue, fontWeight: 700, background: `${COLORS.blue}18`, padding: "2px 6px", borderRadius: 99 }}>{sleepEntry ? "Edit" : "+ Log"}</span>
                </div>
                {sleepEntry ? (
                  <>
                    <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.blue, fontFamily: "'Space Mono',monospace", lineHeight: 1 }}>
                      {sleepEntry.hours}<span style={{ fontSize: 14, color: COLORS.muted }}>h</span>
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4, color: sleepQualityMeta?.color() || COLORS.muted }}>
                      {sleepQualityMeta?.emoji} {sleepQualityMeta?.label}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>{sleepDateLabel}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.muted, fontFamily: "'Space Mono',monospace", lineHeight: 1 }}>—</div>
                    <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6 }}>Tap to log sleep</div>
                  </>
                )}
              </div>

              {/* Recovery status mini card */}
              <div style={{ background: `${recoveryData.color()}18`, borderRadius: 14, padding: 14, border: `1px solid ${recoveryData.color()}44`, ...hl("recovery-card") }}>
                <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Recovery</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: recoveryData.color(), fontFamily: "'Space Mono',monospace", lineHeight: 1, marginBottom: 8 }}>
                  {recoveryData.label}
                </div>
                {/* 5-dot scale */}
                <div style={{ display: "flex", gap: 4 }}>
                  {[0,1,2,3,4].map(i => (
                    <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= recoveryData.score ? recoveryData.color() : COLORS.border, transition: "background 0.3s" }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Recovery detail card — full width */}
            <div style={{ background: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>What&apos;s driving this</div>
                <span style={{ fontSize: 11, color: recoveryData.color(), fontWeight: 700 }}>{recoveryData.label}</span>
              </div>
              <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>
                {recoveryData.rec}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {recoveryData.factors.map((f, i) => (
                  <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: f.bad ? `${COLORS.warn}18` : COLORS.bg, color: f.bad ? COLORS.warn : COLORS.mutedLight, border: `1px solid ${f.bad ? COLORS.warn + "44" : COLORS.border}` }}>
                    {f.text}
                  </span>
                ))}
              </div>
            </div>
            {/* Active injuries */}
            <p style={{ margin: "0 0 10px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Active Injuries & Symptoms</p>
            {injuries.filter(i => i.status !== "healed").length === 0 ? (
              <div style={{ background: COLORS.card, borderRadius: 14, padding: 24, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>All clear!</div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>No active injuries or symptoms</div>
              </div>
            ) : injuries.filter(i => i.status !== "healed").map(inj => (
              <div key={inj.id} style={{ background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10, border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${STATUS_COLOR[inj.status] || COLORS.warn}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>{inj.area}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Badge text={inj.severity} color={severityColor[inj.severity] || COLORS.warn} />
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: STATUS_COLOR[inj.status] }}>
                        {STATUS_ICON[inj.status]} {inj.status.charAt(0).toUpperCase() + inj.status.slice(1)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <span style={{ fontSize: 11, color: COLORS.muted }}>{inj.date}</span>
                    <button onClick={() => setEditingInjury(inj)} style={{ padding: "5px 10px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.mutedLight, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Update</button>
                  </div>
                </div>
                {inj.note && <p style={{ margin: "0 0 6px", fontSize: 12, color: COLORS.mutedLight, fontStyle: "italic" }}>"{inj.note}"</p>}
                {/* Mini progression trail */}
                {(inj.log || []).length > 1 && (
                  <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 6 }}>
                    {(inj.log || []).slice(-5).map((entry, i, arr) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[entry.status] }} title={entry.status} />
                        {i < arr.length - 1 && <div style={{ width: 12, height: 1, background: COLORS.border }} />}
                      </div>
                    ))}
                    <span style={{ fontSize: 10, color: COLORS.muted, marginLeft: 4 }}>{(inj.log || []).length} updates</span>
                  </div>
                )}
              </div>
            ))}

            {/* Healed injuries */}
            {injuries.filter(i => i.status === "healed").length > 0 && (
              <>
                <p style={{ margin: "16px 0 10px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Recovered</p>
                {injuries.filter(i => i.status === "healed").map(inj => (
                  <div key={inj.id} style={{ background: COLORS.card, borderRadius: 14, padding: 12, marginBottom: 8, border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${STATUS_COLOR.healed}`, opacity: 0.7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{inj.area}</div>
                        <div style={{ fontSize: 11, color: STATUS_COLOR.healed }}>✓ Healed · {(inj.log || []).length} updates logged</div>
                      </div>
                      <button onClick={() => setEditingInjury(inj)} style={{ padding: "4px 8px", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 7, color: COLORS.muted, cursor: "pointer", fontSize: 10 }}>View</button>
                    </div>
                  </div>
                ))}
              </>
            )}

          </div>
        )}

        {/* ── PROGRESS ── */}
        {tab === "progress" && (
          <div>
            <div style={{ display: "flex", background: COLORS.card, borderRadius: 12, padding: 4, marginBottom: 16 }}>
              {[{ id: "photos", label: "Photos" }, { id: "insights", label: "Insights" }].map(t => (
                <button key={t.id} onClick={() => setProgressSubTab(t.id)} style={{ flex: 1, padding: "8px 0", borderRadius: 9, background: progressSubTab === t.id ? COLORS.accent : "transparent", color: progressSubTab === t.id ? "#000" : COLORS.muted, fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", transition: "all 0.2s" }}>
                  {t.label}
                </button>
              ))}
            </div>
            {progressSubTab === "photos" && (
              <PhotoCalendarPage
                photos={progressPhotos}
                onAdd={meta => setProgressPhotos(prev => [meta, ...prev])}
                onDelete={id => { deletePhoto(id); setProgressPhotos(prev => prev.filter(p => p.id !== id)); }}
              />
            )}
            {progressSubTab === "insights" && (
              <InsightsView
                workouts={workouts}
                meals={meals}
                waterLog={waterLog}
                waterGoal={waterGoal}
                sleepLog={sleepLog}
                supplements={supplements}
                calorieGoal={calorieGoal}
                weightLog={weightLog}
                profile={profile}
                onLogWeight={() => setShowWeightModal(true)}
                period={insightsPeriod}
                onPeriodChange={setInsightsPeriod}
              />
            )}
          </div>
        )}

        {/* ── PROFILE ── */}
        {tab === "profile" && (
          <ProfilePage
            profile={profile}
            setProfile={setProfile}
            isDark={isDark}
            onToggleTheme={() => setIsDark(d => !d)}
            onShowTutorial={() => setShowOnboarding(true)}
            onSignOut={supabase ? async () => { await signOut(); setAuthSession(null); } : null}
            tourHL={tourHL}
            exportData={{ meals, workouts, waterLog, weightLog, sleepLog, supplements, prs }}
          />
        )}

      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, zIndex: 400, background: COLORS.surface, borderTop: `1px solid ${COLORS.border}`, padding: `8px 4px calc(8px + env(safe-area-inset-bottom, 0px))`, display: "flex", justifyContent: "space-around", alignItems: "flex-end", ...hl("bottom-nav") }}>
        {BOTTOM_NAV.map(n => {
          const isActive = n.group ? n.group.includes(tab) : tab === n.id;
          return (
            <button key={n.id} onClick={() => {
              if (n.id === "track") navigateTo(lastTrackTab);
              else if (n.id === "wellbeing") navigateTo(lastWellbeingTab);
              else navigateTo(n.id);
            }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 0", background: "none", border: "none", cursor: "pointer" }}>
              <span style={{ fontSize: 21, lineHeight: 1, color: isActive ? COLORS.accent : COLORS.muted, transition: "color 0.2s" }}>{n.icon}</span>
              <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, color: isActive ? COLORS.accent : COLORS.muted, letterSpacing: "0.01em", transition: "color 0.2s" }}>{n.label}</span>
              {isActive && <div style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.accent, marginTop: 1 }} />}
            </button>
          );
        })}
      </div>

      {showScanner && <AIPhotoScanner onClose={() => setShowScanner(false)} onScan={m => {
        const meal = { id: Date.now(), name: m.name, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat, img: "🍽️", logged_date: todayKey };
        setMeals(prev => [...prev, meal]);
        if (supabase && authSession?.user?.id) supabase.from("meals").upsert({ ...meal, user_id: authSession.user.id });
      }} />}
      {showManualMeal && <ManualMealModal onClose={() => setShowManualMeal(false)} onAdd={m => {
        const meal = { ...m, logged_date: todayKey };
        setMeals(prev => [...prev, meal]);
        if (supabase && authSession?.user?.id) supabase.from("meals").upsert({ ...meal, user_id: authSession.user.id });
      }} />}
      {showFoodSearch && <FoodSearchModal onClose={() => setShowFoodSearch(false)} onAdd={m => {
        const meal = { ...m, logged_date: todayKey };
        setMeals(prev => [...prev, meal]);
        if (supabase && authSession?.user?.id) supabase.from("meals").upsert({ ...meal, user_id: authSession.user.id });
      }} />}
      {showActiveWorkout && activeSession && <ActiveWorkoutSession session={activeSession} setSession={setActiveSession} sessionElapsed={sessionElapsed} restLeft={restLeft} resting={resting} onFinish={handleFinishSession} onClose={() => setShowActiveWorkout(false)} />}
      {showQuickLog && <QuickLogModal onClose={() => setShowQuickLog(false)} onAdd={w => setWorkouts(prev => [w, ...prev])} />}
      {editMealPrefill && <ManualMealModal initialValues={editMealPrefill} onClose={() => setEditMealPrefill(null)} onAdd={m => {
        const meal = { ...m, logged_date: todayKey };
        setMeals(prev => [...prev, meal]);
        if (supabase && authSession?.user?.id) supabase.from("meals").upsert({ ...meal, user_id: authSession.user.id });
        setEditMealPrefill(null);
      }} />}
      {editWorkoutPrefill && <QuickLogModal initialValues={editWorkoutPrefill} onClose={() => setEditWorkoutPrefill(null)} onAdd={w => { setWorkouts(prev => [w, ...prev]); setEditWorkoutPrefill(null); }} />}
      {showRunTracker && <RunTracker profile={profile} hkAvailable={hkAvailable} onClose={() => setShowRunTracker(false)} onSave={w => setWorkouts(prev => [w, ...prev])} />}
      {showWeightModal && (
        <LogWeightModal
          unit={profile.weightUnit || "kg"}
          lastWeight={(() => { const e = Object.entries(weightLog).sort(([a],[b]) => b.localeCompare(a)); return e.length ? e[0][1] : (parseFloat(profile.weight) || null); })()}
          todayStr={todayKey}
          onClose={() => setShowWeightModal(false)}
          onSave={(date, w) => setWeightLog(prev => ({ ...prev, [date]: w }))}
        />
      )}
      {showInjury && <AddInjuryModal onClose={() => setShowInjury(false)} onAdd={inj => setInjuries(prev => [inj, ...prev])} />}
      {showAddSupp && <AddSupplementModal onClose={() => setShowAddSupp(false)} onAdd={s => setSupplements(prev => [...prev, s])} />}
      {showAddPR && (
        <AddPRModal
          todayStr={todayKey}
          onClose={() => setShowAddPR(false)}
          onSave={(name, weight, reps, date, oneRM) => {
            setPrs(prev => {
              const cur = prev[name] || { best1rm: 0, history: [] };
              const entry = { date, weight, reps, oneRM };
              const history = [...(cur.history || []), entry].sort((a, b) => a.date.localeCompare(b.date));
              return { ...prev, [name]: { best1rm: Math.max(cur.best1rm, oneRM), bestWeight: weight, bestReps: reps, date, history } };
            });
          }}
        />
      )}

      {/* Share clipboard toast — shown when Web Share API is unavailable */}
      {shareToast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 700, background: COLORS.blue, color: "#fff", borderRadius: 14, padding: "10px 20px", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 24px #0005", display: "flex", alignItems: "center", gap: 8 }}>
          <span>✓</span><span>Copied to clipboard!</span>
        </div>
      )}

      {/* PR toast — appears top-center for 4 seconds after a session with new records */}
      {prToast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 700, background: COLORS.yellow, color: "#000", borderRadius: 14, padding: "10px 20px", fontWeight: 800, fontSize: 14, boxShadow: "0 4px 24px #0005", display: "flex", alignItems: "center", gap: 8, maxWidth: "90vw" }}>
          <span>🏆</span>
          <span>New PR{prToast.length > 1 ? "s" : ""}! {prToast.slice(0, 2).join(", ")}{prToast.length > 2 ? ` +${prToast.length - 2}` : ""}</span>
        </div>
      )}
      {editingInjury && <UpdateInjuryModal injury={editingInjury} onClose={() => setEditingInjury(null)} onUpdate={inj => { setInjuries(prev => prev.map(i => i.id === inj.id ? inj : i)); setEditingInjury(null); }} />}
      {routineDay && <RoutineDayModal day={routineDay.label} existing={weeklyRoutine[routineDay.key]} templates={routineTemplates} onSaveTemplate={t => setRoutineTemplates(prev => [...prev.filter(x => x.name !== t.name), t])} onDeleteTemplate={name => setRoutineTemplates(prev => prev.filter(t => t.name !== name))} onClose={() => setRoutineDay(null)} onSave={plan => { setWeeklyRoutine(r => ({ ...r, [routineDay.key]: plan })); setRoutineDay(null); }} />}
      {showSessionStart && todayRoutine && <SessionStartPrompt todayRoutine={todayRoutine} onClose={() => setShowSessionStart(false)} onUseRoutine={() => { setShowSessionStart(false); startActiveSession(todayRoutine.exercises, todayRoutine.name, todayRoutine.type); }} onFresh={() => { setShowSessionStart(false); startActiveSession(); }} />}
      {showOnboarding && <OnboardingModal onComplete={() => { localStorage.setItem("nf_onboarded", "1"); setShowOnboarding(false); }} />}

      {/* Guided renovation tour card — floats above bottom nav, walks user through the app */}
      {tourStep !== null && (() => {
        const step = TOUR_STEPS[tourStep];
        const isLast = tourStep === TOUR_STEPS.length - 1;
        return (
          <div style={{ position: "fixed", bottom: `calc(74px + env(safe-area-inset-bottom, 0px))`, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 448, zIndex: 600, background: COLORS.surface, border: `1px solid ${COLORS.accent}55`, borderRadius: 20, padding: "14px 16px 16px", boxShadow: `0 -4px 32px ${COLORS.accent}1a` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.accent }} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: COLORS.accent }}>Coach · {tourStep + 1} / {TOUR_STEPS.length}</span>
              </div>
              <button onClick={dismissTour} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Skip tour</button>
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {TOUR_STEPS.map((_, i) => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= tourStep ? COLORS.accent : COLORS.border, transition: "background 0.3s" }} />
              ))}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Space Mono',monospace", color: COLORS.text, marginBottom: 5, lineHeight: 1.3 }}>{step.title}</div>
            <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6, marginBottom: 14 }}>{step.body}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {tourStep > 0 && (
                <button onClick={backTour} style={{ padding: "9px 16px", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.muted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>← Back</button>
              )}
              <button onClick={advanceTour} style={{ padding: "9px 22px", background: COLORS.accent, border: "none", borderRadius: 10, color: "#000", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                {isLast ? "Done →" : "Next →"}
              </button>
            </div>
          </div>
        );
      })()}
      {showSleep && (
        <LogSleepModal
          existing={sleepLog[todayKey] || sleepLog[yesterdayKey] || null}
          onClose={() => setShowSleep(false)}
          onSave={entry => setSleepLog(prev => ({ ...prev, [todayKey]: entry }))}
        />
      )}
    </div>
  );
}
