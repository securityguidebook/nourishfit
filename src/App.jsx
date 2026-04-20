import { useState, useRef, useEffect, useCallback } from "react";
import imageCompression from "browser-image-compression";
import { savePhoto, loadPhoto, deletePhoto } from "./db.js";

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
  { icon: "💪", title: "Hey, Coach here.", body: "Welcome to NourishFit — I'll help you eat smarter, train harder, and track your transformation. Let me show you around real quick." },
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
  const [phase, setPhase] = useState("idle");
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileRef = useRef();

  async function analyzeImage(base64Data) {
    setPhase("scanning");
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-opus-4-5", max_tokens: 600,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Data } },
            { type: "text", text: "You are a nutrition expert. Analyze this food image and estimate: 1) Food name/description 2) Calories 3) Protein (g) 4) Carbs (g) 5) Fat (g). Reply in JSON: {\"name\":\"...\",\"description\":\"...\",\"calories\":0,\"protein\":0,\"carbs\":0,\"fat\":0}" }
          ]}]
        })
      });
      const data = await resp.json();
      const text = data.content[0].text;
      const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
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
      analyzeImage(base64);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📸 AI Meal Scanner</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: COLORS.muted }}>Upload a food photo to estimate macros instantly</p>
        {phase === "idle" && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current.click()}
            style={{ border: `2px dashed ${dragOver ? COLORS.accent : COLORS.border}`, borderRadius: 16, padding: 32, textAlign: "center", cursor: "pointer", background: dragOver ? COLORS.accentDim : "transparent" }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>🍽️</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Drop a food photo here</div>
            <div style={{ fontSize: 11, color: COLORS.muted }}>or click to browse · JPG, PNG, WEBP</div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
          </div>
        )}
        {phase === "scanning" && (
          <div style={{ textAlign: "center", padding: 32 }}>
            {imagePreview && <img src={imagePreview} alt="preview" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12, marginBottom: 16 }} />}
            <div style={{ fontSize: 14, color: COLORS.mutedLight }}>Analysing macronutrients . . .</div>
          </div>
        )}
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
            <button onClick={() => { onScan(result); onClose(); }} style={{ width: "100%", padding: 14, background: COLORS.accent, border: "none", borderRadius: 14, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Log This Meal</button>
          </div>
        )}
        {phase === "error" && (
          <div style={{ textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 14, color: COLORS.warn }}>Could not analyse image. Try another photo.</div>
            <button onClick={() => setPhase("idle")} style={{ marginTop: 16, padding: "10px 24px", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, color: COLORS.text, cursor: "pointer" }}>Try Again</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quick Log Modal (cardio / manual entry) ──────────────────────────────────

function QuickLogModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ type: "Cardio", name: "", duration: "", calories: "", distance: "" });
  const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, width: "100%", outline: "none", marginTop: 6 };
  const handle = () => {
    if (!form.name.trim()) return;
    onAdd({ id: Date.now(), type: form.type, name: form.name, duration: parseInt(form.duration) || 0, calories: parseInt(form.calories) || 0, ...(form.distance ? { distance: form.distance } : {}), date: new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) });
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: 20 }}>
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
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: 20 }}>
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
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: 20, maxHeight: "88vh", overflowY: "auto" }}>
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
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: 20, maxHeight: "90vh", overflowY: "auto" }}>
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

function AICoach() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-opus-4-5", max_tokens: 500,
          system: "You are NourishFit Coach, an expert fitness and nutrition AI. Give concise, practical advice. Use emojis sparingly.",
          messages: [...messages, userMsg]
        })
      });
      const data = await resp.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.content[0].text }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't connect. Please try again." }]);
    }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono', monospace" }}>✦ AI Coach</h2>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: COLORS.muted }}>Ask anything · Log what you learn</p>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
        {messages.length === 0 && (
          <div style={{ background: COLORS.card, borderRadius: 14, padding: 16, border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 13, color: COLORS.mutedLight }}>Ask about any exercise, form tip, or training question</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {["Best pre-workout meal?", "How to fix squat form?", "How much protein do I need?"].map(q => (
                <button key={q} onClick={() => setInput(q)} style={{ fontSize: 11, padding: "5px 10px", background: COLORS.accentDim, border: `1px solid ${COLORS.accentMid}`, borderRadius: 99, color: COLORS.accent, cursor: "pointer" }}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.role === "user" ? COLORS.accent : COLORS.card, color: m.role === "user" ? "#000" : COLORS.text, borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 14px", fontSize: 13, border: m.role === "assistant" ? `1px solid ${COLORS.border}` : "none" }}>
            {m.content}
          </div>
        ))}
        {loading && <div style={{ alignSelf: "flex-start", background: COLORS.card, borderRadius: "16px 16px 16px 4px", padding: "10px 14px", fontSize: 13, color: COLORS.muted, border: `1px solid ${COLORS.border}` }}>Thinking . . .</div>}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask your coach . . ." style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 14px", color: COLORS.text, fontSize: 13, outline: "none" }} />
        <button onClick={send} style={{ padding: "10px 16px", background: COLORS.accent, border: "none", borderRadius: 12, color: "#000", fontWeight: 800, cursor: "pointer" }}>↑</button>
      </div>
    </div>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

function ProfilePage({ profile, setProfile, isDark, onToggleTheme, onShowTutorial }) {
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

      {/* Help */}
      <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
        <p style={{ margin: "0 0 14px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Help</p>
        <button onClick={onShowTutorial}
          style={{ width: "100%", padding: "11px 0", background: `${COLORS.blue}18`, border: `1px solid ${COLORS.blue}44`, borderRadius: 12, color: COLORS.blue, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          View App Tutorial
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
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: 20, maxHeight: "90vh", overflowY: "auto" }}>
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

// ─── Manual Meal Modal ────────────────────────────────────────────────────────

function ManualMealModal({ onClose, onAdd }) {
  const EMOJI_OPTIONS = ["🍗","🥩","🐟","🥗","🍝","🥣","🥤","🍳","🥙","🍱","🫐","🍎","🥑","🍌","🍽️"];
  const [form, setForm] = useState({ name: "", img: "🍽️", calories: "", protein: "", carbs: "", fat: "" });
  const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, width: "100%", outline: "none", marginTop: 6 };
  const handle = () => {
    if (!form.name.trim() || !form.calories) return;
    onAdd({ id: Date.now(), name: form.name, img: form.img, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), calories: parseInt(form.calories) || 0, protein: parseInt(form.protein) || 0, carbs: parseInt(form.carbs) || 0, fat: parseInt(form.fat) || 0 });
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: 20, maxHeight: "88vh", overflowY: "auto" }}>
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
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: 20, maxHeight: "92vh", overflowY: "auto" }}>
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
          <button onClick={() => onFinish({ durationMin, estCals, validExercises, totalSets })} style={{ flex: 2, padding: 13, background: COLORS.accent, border: "none", borderRadius: 14, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Save Session</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: 20, maxHeight: "92vh", overflowY: "auto" }}>

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
                  <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 34px", gap: 6, marginBottom: 4 }}>
                    <div /><div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 700, textAlign: "center" }}>REPS</div>
                    <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 700, textAlign: "center" }}>KG</div><div />
                  </div>
                  {ex.sets.map((set, si) => {
                    const isActive = si === nextIdx;
                    const isDone = set.done;
                    const isLocked = !isDone && !isActive;
                    return (
                      <div key={set.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 34px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                        <div style={{ fontSize: 10, color: isDone ? COLORS.accent : COLORS.muted, fontWeight: 700, textAlign: "center" }}>S{si+1}</div>
                        <input type="number" value={set.reps} onChange={e => updateSetField(idx, set.id, "reps", e.target.value)} disabled={isDone}
                          style={{ ...cellInput, border: `1px solid ${isDone ? COLORS.accent + "44" : COLORS.border}`, color: isDone ? COLORS.muted : COLORS.text, opacity: isLocked ? 0.45 : 1 }} placeholder="—" />
                        <input type="number" value={set.weight} onChange={e => updateSetField(idx, set.id, "weight", e.target.value)} disabled={isDone}
                          style={{ ...cellInput, border: `1px solid ${isDone ? COLORS.accent + "44" : COLORS.border}`, color: isDone ? COLORS.muted : COLORS.text, opacity: isLocked ? 0.45 : 1 }} placeholder="—" />
                        <button disabled={!isActive} onClick={() => isActive && completeSet(idx, set.id)}
                          style={{ width: 32, height: 32, borderRadius: 8, border: `2px solid ${isDone ? COLORS.accent : isActive ? COLORS.accent : COLORS.border}`, background: isDone ? COLORS.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: isActive ? "pointer" : "default", opacity: isLocked ? 0.3 : 1 }}>
                          {isDone && <span style={{ color: "#000", fontSize: 14, fontWeight: 900 }}>✓</span>}
                        </button>
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
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: 20 }}>
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

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── Theme ──────────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("nf_theme");
    if (saved) return saved === "dark";
    return !window.matchMedia("(prefers-color-scheme: light)").matches;
  });
  // Sync COLORS before any child renders (must be in render body, not effect)
  Object.assign(COLORS, isDark ? DARK_COLORS : LIGHT_COLORS);

  // ── Onboarding ─────────────────────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("nf_onboarded"));

  const [tab, setTab] = useState("dashboard");
  const [viewMode, setViewMode] = useState("mobile"); // "mobile" | "webapp" — button hidden, kept for future web layout
  const [showScanner, setShowScanner] = useState(false);
  const [showActiveWorkout, setShowActiveWorkout] = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showInjury, setShowInjury] = useState(false);
  const [showManualMeal, setShowManualMeal] = useState(false);
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
    try { return JSON.parse(localStorage.getItem("nf_meals")) || []; }
    catch { return []; }
  });

  const [workouts, setWorkouts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nf_workouts")) || []; }
    catch { return []; }
  });

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
      return JSON.parse(localStorage.getItem("nf_profile")) || {
        name: "", age: "", gender: "male",
        weight: "", weightUnit: "kg",
        height: "", heightUnit: "cm",
        goal: "maintain", activityLevel: "moderate",
        cheatDays: 1,
      };
    } catch {
      return {
        name: "", age: "", gender: "male",
        weight: "", weightUnit: "kg",
        height: "", heightUnit: "cm",
        goal: "maintain", activityLevel: "moderate",
        cheatDays: 1,
      };
    }
  });

  const totalCals = meals.reduce((s, m) => s + m.calories, 0);
  const totalProtein = meals.reduce((s, m) => s + m.protein, 0);
  const totalCarbs = meals.reduce((s, m) => s + m.carbs, 0);
  const totalFat = meals.reduce((s, m) => s + m.fat, 0);

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
  const todayKey = new Date().toISOString().slice(0, 10); // "2026-04-08"
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
  useEffect(() => { localStorage.setItem("nf_profile", JSON.stringify(profile)); }, [profile]);
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
  const [progressPhotos, setProgressPhotos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nf_photos")) || []; } catch { return []; }
  });

  useEffect(() => { localStorage.setItem("nf_sleep", JSON.stringify(sleepLog)); }, [sleepLog]);
  useEffect(() => { localStorage.setItem("nf_water", JSON.stringify(waterLog)); }, [waterLog]);
  useEffect(() => { localStorage.setItem("nf_photos", JSON.stringify(progressPhotos)); }, [progressPhotos]);

  const waterToday = waterLog[todayKey] || 0;

  // ── Greeting ────────────────────────────────────────────────────────────────
  const greetingHour = new Date().getHours();
  const greeting = greetingHour >= 5  && greetingHour < 12 ? { text: "Good morning",    emoji: "🌅" }
                 : greetingHour >= 12 && greetingHour < 17 ? { text: "Good afternoon",   emoji: "☀️" }
                 : greetingHour >= 17 && greetingHour < 21 ? { text: "Good evening",     emoji: "🌆" }
                 :                                           { text: "Late night grind",  emoji: "🌙" };

  // ── Sleep ───────────────────────────────────────────────────────────────────
  const yesterdayKey = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const sleepEntry = sleepLog[todayKey] || sleepLog[yesterdayKey] || null;
  const sleepDateLabel = sleepLog[todayKey] ? "Today" : sleepLog[yesterdayKey] ? "Last night" : null;
  const sleepQualityMeta = sleepEntry ? SLEEP_QUALITY.find(q => q.id === sleepEntry.quality) : null;

  // ── Recovery (from workout timestamps) ─────────────────────────────────────
  const sortedByRecent = [...workouts].sort((a, b) => b.id - a.id);
  const lastWorkoutId = sortedByRecent[0]?.id ?? null;
  const hoursSinceWorkout = lastWorkoutId ? (Date.now() - lastWorkoutId) / 3600000 : null;
  const recoveryData = (() => {
    if (hoursSinceWorkout === null) return { pct: null, label: "Log a workout to track recovery", color: COLORS.muted };
    if (hoursSinceWorkout < 16)    return { pct: 42,   label: "Active recovery recommended",     color: COLORS.warn   };
    if (hoursSinceWorkout < 30)    return { pct: 65,   label: "Still recovering",                color: COLORS.yellow };
    if (hoursSinceWorkout < 48)    return { pct: 82,   label: "Ready to train",                  color: COLORS.accent };
    if (hoursSinceWorkout < 72)    return { pct: 95,   label: "Fully recovered",                 color: COLORS.accent };
    return                                { pct: 100,  label: "Peak readiness",                  color: COLORS.blue   };
  })();
  const waterGoal = profile.waterGoal || 2500;

  const maxW = viewMode === "webapp" ? 960 : 480;
  const fmtSec = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ background: COLORS.bg, minHeight: "100dvh", color: COLORS.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: maxW, margin: "0 auto", paddingBottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        body { color-scheme: ${isDark ? "dark" : "light"}; }
        select option { background: ${COLORS.card}; color: ${COLORS.text}; }
        ::placeholder { color: ${COLORS.muted}; opacity: 0.7; }
        @keyframes spin { to { transform: rotate(360deg); } }
        button { touch-action: manipulation; }
        input, textarea, select { touch-action: manipulation; -webkit-user-select: text !important; user-select: text !important; }
      `}</style>

      {/* Header — padded for iOS status bar */}
      <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 16px) 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>NourishFit</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Space Mono', monospace", color: COLORS.text }}>
            {profile.name ? `${greeting.text}, ${profile.name.split(" ")[0]} ${greeting.emoji}` : `${greeting.text} ${greeting.emoji}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setShowOnboarding(true)}
            style={{ width: 30, height: 30, borderRadius: "50%", background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.muted, fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            ?
          </button>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: COLORS.accentDim, border: `2px solid ${COLORS.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer" }} onClick={() => setTab("profile")}>
            {profile.gender === "female" ? "👩" : "🧑"}
          </div>
        </div>
      </div>

      {/* Active session banner */}
      {activeSession && !showActiveWorkout && (
        <div onClick={() => setShowActiveWorkout(true)}
          style={{ margin: "12px 20px 0", background: COLORS.accentDim, border: `1px solid ${COLORS.accentMid}`, borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.accent }} />
            <span style={{ fontSize: 12, color: COLORS.accent, fontWeight: 700 }}>Session in progress</span>
          </div>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 14, fontWeight: 800, color: COLORS.accent }}>{fmtSec(sessionElapsed)}</span>
        </div>
      )}

      {/* Tab Content */}
      <div style={{ padding: "16px 20px 0", minHeight: "calc(100dvh - 168px)" }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
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
            {meals.length === 0 ? (
              <div style={{ background: COLORS.card, borderRadius: 12, padding: 20, marginBottom: 8, border: `1px solid ${COLORS.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>◎</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>No meals logged yet</div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Tap Nutrition to scan or log a meal</div>
              </div>
            ) : meals.map(m => (
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
        {tab === "nutrition" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono', monospace" }}>Nutrition</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowManualMeal(true)} style={{ padding: "8px 12px", background: COLORS.bg, color: COLORS.mutedLight, border: `1px solid ${COLORS.border}`, borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ Manual</button>
                <button onClick={() => setShowScanner(true)} style={{ padding: "8px 14px", background: COLORS.accent, color: "#000", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>📸 Scan</button>
              </div>
            </div>
            <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
              <CalorieBar consumed={totalCals} goal={calorieGoal} />
              <div style={{ display: "flex", justifyContent: "space-around", marginTop: 16 }}>
                <MacroRing label="Protein" value={totalProtein} max={macroTargets.protein} color={COLORS.accent} size={72} />
                <MacroRing label="Carbs"   value={totalCarbs}   max={macroTargets.carbs}   color={COLORS.blue}   size={72} />
                <MacroRing label="Fat"     value={totalFat}     max={macroTargets.fat}      color={COLORS.orange} size={72} />
              </div>
            </div>

            <WaterCard
              waterToday={waterToday}
              waterGoal={waterGoal}
              onAdd={ml => setWaterLog(prev => ({ ...prev, [todayKey]: (prev[todayKey] || 0) + ml }))}
              onReset={() => setWaterLog(prev => ({ ...prev, [todayKey]: 0 }))}
            />

            <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Daily Targets</p>
                <span style={{ fontSize: 10, color: COLORS.accent, fontWeight: 700 }}>{profile.goal === "lose" ? "Cut 🔥" : profile.goal === "gain" ? "Bulk 💪" : "Maintain ⚖️"}</span>
              </div>
              {[
                { label: "Calories",  value: `${calorieGoal} kcal`,       sub: `TDEE ${tdee} kcal`,                               color: COLORS.yellow },
                { label: "Protein",   value: `${macroTargets.protein}g`,  sub: `${Math.round(macroTargets.protein * 4)} kcal · 30%`, color: COLORS.accent },
                { label: "Carbs",     value: `${macroTargets.carbs}g`,    sub: `${Math.round(macroTargets.carbs * 4)} kcal · 40%`,   color: COLORS.blue },
                { label: "Fat",       value: `${macroTargets.fat}g`,      sub: `${Math.round(macroTargets.fat * 9)} kcal · 30%`,     color: COLORS.orange },
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
            {meals.length === 0 ? (
              <div style={{ background: COLORS.card, borderRadius: 14, padding: 24, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>No meals logged</div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>Tap 📸 Scan Meal to analyse a photo, or log manually</div>
              </div>
            ) : meals.map(m => (
              <div key={m.id} style={{ background: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 28 }}>{m.img}</span>
                    <div><div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{m.name}</div><div style={{ fontSize: 11, color: COLORS.muted }}>{m.time}</div></div>
                  </div>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 16, fontWeight: 700, color: COLORS.yellow }}>{m.calories}<span style={{ fontSize: 11, color: COLORS.muted }}> kcal</span></div>
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
          </div>
        )}

        {/* ── WORKOUT ── */}
        {tab === "workout" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono', monospace" }}>Workouts</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowQuickLog(true)} style={{ padding: "8px 12px", background: COLORS.bg, color: COLORS.mutedLight, border: `1px solid ${COLORS.border}`, borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Quick Log</button>
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
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
            ) : workouts.map(w => (
              <div key={w.id} style={{ background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10, border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{w.type === "Cardio" ? "🏃" : w.type === "Mobility" ? "🧘" : "💪"}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{w.name}</span>
                    </div>
                    <Badge text={w.type} color={workoutTypeColor[w.type] || COLORS.mutedLight} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 11, color: COLORS.muted }}>{w.date}</span>
                    <button onClick={() => { if (window.confirm("Delete this session?")) setWorkouts(prev => prev.filter(x => x.id !== w.id)); }} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 11, cursor: "pointer", padding: 0 }}>✕ delete</button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: w.exercises?.length ? 10 : 0 }}>
                  {[{ v: `${w.duration}m`, l: "Duration", c: COLORS.text }, { v: w.calories, l: "kcal", c: COLORS.yellow }, ...(w.distance ? [{ v: w.distance, l: "Distance", c: COLORS.blue }] : []), ...(w.sets ? [{ v: w.sets, l: "Sets", c: COLORS.accent }] : [])].map((x, i) => (
                    <div key={i} style={{ flex: 1, background: COLORS.bg, borderRadius: 8, padding: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: x.c }}>{x.v}</div>
                      <div style={{ fontSize: 10, color: COLORS.muted }}>{x.l}</div>
                    </div>
                  ))}
                </div>
                {w.exercises?.length > 0 && (
                  <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                    {w.exercises.map((ex, i) => (
                      <div key={i} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent, marginBottom: 4 }}>{ex.name}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {ex.sets.map((s, j) => (
                            <div key={j} style={{ background: COLORS.bg, borderRadius: 6, padding: "3px 8px", fontSize: 10, color: COLORS.text, fontFamily: "'Space Mono',monospace" }}>
                              <span style={{ color: COLORS.muted }}>S{j + 1} </span>{s.reps}<span style={{ color: COLORS.muted }}>×</span><span style={{ color: COLORS.yellow }}>{s.weight}kg</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── COACH ── */}
        {tab === "coach" && <AICoach />}

        {/* ── SUPPLEMENTS ── */}
        {tab === "supplements" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono', monospace" }}>Supplements</h2>
              <button onClick={() => setShowAddSupp(true)} style={{ padding: "8px 14px", background: COLORS.accent, color: "#000", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>+ Add</button>
            </div>
            {supplements.length === 0 ? (
              <div style={{ background: COLORS.card, borderRadius: 14, padding: 32, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>❋</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>No supplements yet</div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 6 }}>Tap + Add to log your stack</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {supplements.map(s => {
                  const takenToday = !!(s.history?.[todayKey]);
                  // Streak: count consecutive days taken going backwards
                  let streak = 0;
                  const d = new Date();
                  for (let i = 0; i < 365; i++) {
                    const k = d.toISOString().slice(0, 10);
                    if (!s.history?.[k]) break;
                    streak++;
                    d.setDate(d.getDate() - 1);
                  }
                  // Last 7 days strip
                  const last7 = Array.from({ length: 7 }, (_, i) => {
                    const dd = new Date();
                    dd.setDate(dd.getDate() - 6 + i);
                    return dd.toISOString().slice(0, 10);
                  });
                  return (
                    <div key={s.id} style={{ background: COLORS.card, borderRadius: 14, padding: 14, border: `1px solid ${COLORS.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <span style={{ fontSize: 26 }}>{s.emoji}</span>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{s.name}</div>
                            <div style={{ fontSize: 11, color: COLORS.muted }}>{s.dose} · {s.timing}</div>
                            {s.benefit && <div style={{ fontSize: 11, color: s.color, marginTop: 2 }}>{s.benefit}</div>}
                          </div>
                        </div>
                        {/* Ring toggle */}
                        <button onClick={() => setSupplements(prev => prev.map(sp => sp.id === s.id ? { ...sp, history: { ...sp.history, [todayKey]: !takenToday } } : sp))}
                          style={{ width: 48, height: 48, borderRadius: "50%", border: `3px solid ${takenToday ? s.color : COLORS.border}`, background: takenToday ? s.color + "22" : "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                          <span style={{ fontSize: takenToday ? 16 : 11, color: takenToday ? s.color : COLORS.muted, fontWeight: 800, lineHeight: 1 }}>{takenToday ? "✓" : "TAKE"}</span>
                        </button>
                      </div>
                      {/* 7-day strip + streak */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {last7.map((dk, i) => {
                            const taken = !!(s.history?.[dk]);
                            const isToday = dk === todayKey;
                            return (
                              <div key={i} title={dk}
                                style={{ width: 22, height: 22, borderRadius: 5, background: taken ? s.color : COLORS.bg, border: `1px solid ${isToday ? s.color : COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {isToday && !taken && <div style={{ width: 5, height: 5, borderRadius: "50%", background: COLORS.border }} />}
                              </div>
                            );
                          })}
                        </div>
                        {streak > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 13 }}>🔥</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: s.color }}>{streak}d</span>
                          </div>
                        )}
                      </div>
                      <Badge text={s.category} color={s.color} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── HEALTH ── */}
        {tab === "health" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono', monospace" }}>Health & Recovery</h2>
              <button onClick={() => setShowInjury(true)} style={{ padding: "8px 14px", background: COLORS.warn, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>+ Log Symptom</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
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

              {/* Recovery card */}
              <div style={{ background: COLORS.card, borderRadius: 14, padding: 14, border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Recovery</div>
                {recoveryData.pct !== null ? (
                  <>
                    <div style={{ fontSize: 28, fontWeight: 800, color: recoveryData.color, fontFamily: "'Space Mono',monospace", lineHeight: 1 }}>
                      {recoveryData.pct}<span style={{ fontSize: 14, color: COLORS.muted }}>%</span>
                    </div>
                    <div style={{ height: 4, background: COLORS.border, borderRadius: 99, marginTop: 8, marginBottom: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${recoveryData.pct}%`, background: recoveryData.color, borderRadius: 99, transition: "width 1s ease" }} />
                    </div>
                    <div style={{ fontSize: 11, color: recoveryData.color }}>{recoveryData.label}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.muted, fontFamily: "'Space Mono',monospace", lineHeight: 1 }}>—</div>
                    <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6, lineHeight: 1.4 }}>{recoveryData.label}</div>
                  </>
                )}
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

        {/* ── PROGRESS PHOTOS ── */}
        {tab === "progress" && (
          <PhotoCalendarPage
            photos={progressPhotos}
            onAdd={meta => setProgressPhotos(prev => [meta, ...prev])}
            onDelete={id => { deletePhoto(id); setProgressPhotos(prev => prev.filter(p => p.id !== id)); }}
          />
        )}

        {/* ── PROFILE ── */}
        {tab === "profile" && (
          <ProfilePage
            profile={profile}
            setProfile={setProfile}
            isDark={isDark}
            onToggleTheme={() => setIsDark(d => !d)}
            onShowTutorial={() => setShowOnboarding(true)}
          />
        )}

      </div>

      <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
  <p style={{ margin: "0 0 12px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Data</p>
  <button
    onClick={() => {
      if (window.confirm("Reset all app data? This cannot be undone.")) {
        localStorage.clear();
        window.location.reload();
      }
    }}
    style={{ width: "100%", padding: "10px", background: COLORS.warn + "22", border: `1px solid ${COLORS.warn}`, borderRadius: 12, color: COLORS.warn, cursor: "pointer", fontSize: 13, fontWeight: 700 }}
  >
    🗑️ Reset All Data
  </button>
</div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: COLORS.surface, borderTop: `1px solid ${COLORS.border}`, display: "flex", padding: `10px 0 max(16px, env(safe-area-inset-bottom, 16px))`, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
            <span style={{ fontSize: 17, filter: tab === n.id ? "none" : "grayscale(1) opacity(0.4)", transition: "all 0.2s" }}>{n.icon}</span>
            <span style={{ fontSize: 9, fontWeight: tab === n.id ? 700 : 500, color: tab === n.id ? COLORS.accent : COLORS.muted, transition: "color 0.2s" }}>{n.label}</span>
            {tab === n.id && <div style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.accent }} />}
          </button>
        ))}
      </div>

      {showScanner && <AIPhotoScanner onClose={() => setShowScanner(false)} onScan={m => setMeals(prev => [...prev, { id: Date.now(), name: m.name, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat, img: "🍽️" }])} />}
      {showManualMeal && <ManualMealModal onClose={() => setShowManualMeal(false)} onAdd={m => setMeals(prev => [...prev, m])} />}
      {showActiveWorkout && activeSession && <ActiveWorkoutSession session={activeSession} setSession={setActiveSession} sessionElapsed={sessionElapsed} restLeft={restLeft} resting={resting} onFinish={handleFinishSession} onClose={() => setShowActiveWorkout(false)} />}
      {showQuickLog && <QuickLogModal onClose={() => setShowQuickLog(false)} onAdd={w => setWorkouts(prev => [w, ...prev])} />}
      {showInjury && <AddInjuryModal onClose={() => setShowInjury(false)} onAdd={inj => setInjuries(prev => [inj, ...prev])} />}
      {showAddSupp && <AddSupplementModal onClose={() => setShowAddSupp(false)} onAdd={s => setSupplements(prev => [...prev, s])} />}
      {editingInjury && <UpdateInjuryModal injury={editingInjury} onClose={() => setEditingInjury(null)} onUpdate={inj => { setInjuries(prev => prev.map(i => i.id === inj.id ? inj : i)); setEditingInjury(null); }} />}
      {routineDay && <RoutineDayModal day={routineDay.label} existing={weeklyRoutine[routineDay.key]} templates={routineTemplates} onSaveTemplate={t => setRoutineTemplates(prev => [...prev.filter(x => x.name !== t.name), t])} onDeleteTemplate={name => setRoutineTemplates(prev => prev.filter(t => t.name !== name))} onClose={() => setRoutineDay(null)} onSave={plan => { setWeeklyRoutine(r => ({ ...r, [routineDay.key]: plan })); setRoutineDay(null); }} />}
      {showSessionStart && todayRoutine && <SessionStartPrompt todayRoutine={todayRoutine} onClose={() => setShowSessionStart(false)} onUseRoutine={() => { setShowSessionStart(false); startActiveSession(todayRoutine.exercises, todayRoutine.name, todayRoutine.type); }} onFresh={() => { setShowSessionStart(false); startActiveSession(); }} />}
      {showOnboarding && <OnboardingModal onComplete={() => { localStorage.setItem("nf_onboarded", "1"); setShowOnboarding(false); }} />}
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
