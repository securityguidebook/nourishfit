import { useState, useRef, useEffect } from "react";

const COLORS = {
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

const NAV = [
  { id: "dashboard", icon: "⊞", label: "Home" },
  { id: "nutrition", icon: "◎", label: "Nutrition" },
  { id: "workout", icon: "△", label: "Workout" },
  { id: "coach", icon: "✦", label: "Coach" },
  { id: "supplements", icon: "❋", label: "Supps" },
  { id: "health", icon: "♡", label: "Health" },
  { id: "profile", icon: "◉", label: "Profile" },
];

function genHistory(rate = 0.8) {
  return Array.from({ length: 28 }, (_, i) => ({ day: i, taken: Math.random() < rate }));
}

const DEFAULT_SUPPLEMENTS = [
  { id: 1, name: "Fish Oil", dose: "2g", timing: "With breakfast", emoji: "🐟", color: COLORS.blue, category: "Omega-3", benefit: "Heart & brain health", history: genHistory(0.85) },
  { id: 2, name: "Creatine", dose: "5g", timing: "Post-workout", emoji: "⚡", color: COLORS.accent, category: "Performance", benefit: "Strength & muscle", history: genHistory(0.9) },
  { id: 3, name: "Vitamin C", dose: "1000mg", timing: "Morning", emoji: "🍊", color: COLORS.orange, category: "Vitamin", benefit: "Immune support", history: genHistory(0.75) },
  { id: 4, name: "Extra Virgin Olive Oil", dose: "1 tbsp", timing: "With meals", emoji: "🫒", color: COLORS.yellow, category: "Healthy Fat", benefit: "Anti-inflammatory", history: genHistory(0.7) },
  { id: 5, name: "Vitamin D3", dose: "2000 IU", timing: "Morning", emoji: "☀️", color: COLORS.yellow, category: "Vitamin", benefit: "Bone & immune health", history: genHistory(0.8) },
  { id: 6, name: "Magnesium", dose: "400mg", timing: "Before bed", emoji: "🌙", color: COLORS.purple, category: "Mineral", benefit: "Sleep & recovery", history: genHistory(0.65) },
];

const SAMPLE_MEALS = [
  { id: 1, name: "Grilled Chicken Bowl", time: "8:30 AM", calories: 520, protein: 42, carbs: 48, fat: 14, img: "🍗" },
  { id: 2, name: "Protein Smoothie", time: "11:00 AM", calories: 310, protein: 28, carbs: 36, fat: 6, img: "🥤" },
  { id: 3, name: "Salmon & Veggies", time: "1:30 PM", calories: 480, protein: 38, carbs: 22, fat: 22, img: "🐟" },
];

const WORKOUTS = [
  { id: 1, type: "Strength", name: "Upper Body Push", duration: 52, calories: 340, sets: 18, date: "Today" },
  { id: 2, type: "Cardio", name: "5K Morning Run", duration: 28, calories: 280, distance: "5.2km", date: "Yesterday" },
  { id: 3, type: "Mobility", name: "Yoga Flow", duration: 40, calories: 120, date: "Mon" },
];

const INJURIES = [
  { id: 1, area: "Left Knee", severity: "mild", status: "improving", note: "Slight pain on deep squats", date: "Mar 18" },
  { id: 2, area: "Right Shoulder", severity: "moderate", status: "stable", note: "Rotator cuff tightness", date: "Mar 10" },
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
            <div style={{ fontSize: 14, color: COLORS.mutedLight }}>Analysing macronutrients…</div>
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

// ─── Add Workout Modal ────────────────────────────────────────────────────────

function AddWorkoutModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ type: "Strength", name: "", duration: "", calories: "", distance: "", sets: "" });
  const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, width: "100%", outline: "none", marginTop: 6 };
  const handle = () => {
    if (!form.name.trim()) return;
    onAdd({ id: Date.now(), type: form.type, name: form.name, duration: parseInt(form.duration)||0, calories: parseInt(form.calories)||0, ...(form.distance ? { distance: form.distance } : {}), ...(form.sets ? { sets: parseInt(form.sets) } : {}), date: "Today" });
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Log Session</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        {[["Workout Name", "name", "text"], ["Duration (min)", "duration", "number"], ["Calories Burned", "calories", "number"], ["Distance (optional)", "distance", "text"], ["Sets (optional)", "sets", "number"]].map(([label, key, type]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>{label}</label>
            <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inputStyle} />
          </div>
        ))}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Type</label>
          <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={{ ...inputStyle }}>
            {["Strength","Cardio","HIIT","Mobility","Sport","Other"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={handle} style={{ width: "100%", padding: 13, background: COLORS.blue, border: "none", borderRadius: 14, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Save Session</button>
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
    onAdd({ id: Date.now(), ...form, date: "Today" });
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
        {loading && <div style={{ alignSelf: "flex-start", background: COLORS.card, borderRadius: "16px 16px 16px 4px", padding: "10px 14px", fontSize: 13, color: COLORS.muted, border: `1px solid ${COLORS.border}` }}>Thinking…</div>}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask your coach…" style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 14px", color: COLORS.text, fontSize: 13, outline: "none" }} />
        <button onClick={send} style={{ padding: "10px 16px", background: COLORS.accent, border: "none", borderRadius: 12, color: "#000", fontWeight: 800, cursor: "pointer" }}>↑</button>
      </div>
    </div>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

function ProfilePage({ profile, setProfile }) {
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
    </div>
  );
}

// ─── Exercise Log Modal ───────────────────────────────────────────────────────

function ExerciseLogModal({ onClose, onAdd }) {
  const [sessionName, setSessionName] = useState("Full Body");
  const [exercises, setExercises] = useState([{ name: "", sets: [{ reps: "", weight: "" }] }]);

  const addExercise = () => setExercises(prev => [...prev, { name: "", sets: [{ reps: "", weight: "" }] }]);
  const addSet = (eIdx) => setExercises(prev => prev.map((ex, i) => i === eIdx ? { ...ex, sets: [...ex.sets, { reps: "", weight: "" }] } : ex));
  const updateExercise = (eIdx, field, val) => setExercises(prev => prev.map((ex, i) => i === eIdx ? { ...ex, [field]: val } : ex));
  const updateSet = (eIdx, sIdx, field, val) => setExercises(prev => prev.map((ex, i) => i === eIdx ? { ...ex, sets: ex.sets.map((s, j) => j === sIdx ? { ...s, [field]: val } : s) } : ex));
  const removeExercise = (eIdx) => setExercises(prev => prev.filter((_, i) => i !== eIdx));

  const handleSave = () => {
    const valid = exercises.filter(e => e.name.trim());
    if (!valid.length) return;
    onAdd({ id: Date.now(), date: "Today", sessionName, exercises: valid.map(e => ({ ...e, sets: e.sets.filter(s => s.reps || s.weight).map(s => ({ reps: parseInt(s.reps) || 0, weight: parseFloat(s.weight) || 0 })) })) });
    onClose();
  };

  const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 10px", color: COLORS.text, fontSize: 13, width: "100%", outline: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, margin: "0 auto", padding: 20, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, fontFamily: "'Space Mono',monospace" }}>Log Workout Session</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Session Name</label>
          <input value={sessionName} onChange={e => setSessionName(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} placeholder="e.g. Full Body, Push Day..." />
        </div>
        {exercises.map((ex, eIdx) => (
          <div key={eIdx} style={{ background: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 12, border: `1px solid ${COLORS.border}` }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
              <input value={ex.name} onChange={e => updateExercise(eIdx, "name", e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Exercise name (e.g. Bicep Curl)" />
              {exercises.length > 1 && (
                <button onClick={() => removeExercise(eIdx)} style={{ background: COLORS.warn + "22", border: "none", color: COLORS.warn, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 13 }}>✕</button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 32px", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Reps</span>
              <span style={{ fontSize: 10, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase" }}>Weight (kg)</span>
              <span />
            </div>
            {ex.sets.map((s, sIdx) => (
              <div key={sIdx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 32px", gap: 6, marginBottom: 6 }}>
                <input value={s.reps} onChange={e => updateSet(eIdx, sIdx, "reps", e.target.value)} style={inputStyle} placeholder="12" type="number" />
                <input value={s.weight} onChange={e => updateSet(eIdx, sIdx, "weight", e.target.value)} style={inputStyle} placeholder="20" type="number" />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>S{sIdx + 1}</div>
              </div>
            ))}
            <button onClick={() => addSet(eIdx)} style={{ background: COLORS.accentDim, border: "none", color: COLORS.accent, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, marginTop: 4 }}>+ Add Set</button>
          </div>
        ))}
        <button onClick={addExercise} style={{ width: "100%", padding: "10px", background: COLORS.bg, border: `1px dashed ${COLORS.border}`, borderRadius: 12, color: COLORS.mutedLight, cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>+ Add Exercise</button>
        <button onClick={handleSave} style={{ width: "100%", padding: "13px", background: COLORS.accent, border: "none", borderRadius: 14, color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Save Session</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [showScanner, setShowScanner] = useState(false);
  const [showWorkout, setShowWorkout] = useState(false);
  const [showInjury, setShowInjury] = useState(false);
  const [meals, setMeals] = useState(SAMPLE_MEALS);
  const [workouts, setWorkouts] = useState(WORKOUTS);
  const [injuries, setInjuries] = useState(INJURIES);
  const [supplements, setSupplements] = useState(DEFAULT_SUPPLEMENTS);
  const [profile, setProfile] = useState({
    name: "", age: "", gender: "male",
    weight: "", weightUnit: "kg",
    height: "", heightUnit: "cm",
    goal: "maintain", activityLevel: "moderate",
    cheatDays: 1,
  });
  const [exerciseLogs, setExerciseLogs] = useState([
    {
      id: 1, date: "Today", sessionName: "Full Body",
      exercises: [
        { name: "Bicep Curl", sets: [{ reps: 12, weight: 15 }, { reps: 10, weight: 17.5 }, { reps: 8, weight: 20 }] },
        { name: "Bench Press", sets: [{ reps: 10, weight: 60 }, { reps: 8, weight: 65 }] },
      ],
    },
    {
      id: 2, date: "Yesterday", sessionName: "Upper Body Push",
      exercises: [
        { name: "Bicep Curl", sets: [{ reps: 12, weight: 15 }, { reps: 10, weight: 15 }] },
        { name: "Shoulder Press", sets: [{ reps: 10, weight: 30 }] },
      ],
    },
  ]);
  const [showExerciseLog, setShowExerciseLog] = useState(false);

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

  const suppsTakenToday = supplements.filter(s => s.history[s.history.length - 1]?.taken).length;
  const workoutTypeColor = { Strength: COLORS.accent, Cardio: COLORS.blue, HIIT: COLORS.warn, Mobility: COLORS.yellow, Sport: COLORS.purple, Other: COLORS.mutedLight };
  const severityColor = { mild: COLORS.yellow, moderate: COLORS.orange, severe: COLORS.warn };
  const statusColor = { new: COLORS.blue, stable: COLORS.mutedLight, improving: COLORS.accent, worsening: COLORS.warn };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: 480, margin: "0 auto", paddingBottom: 84 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        select option { background: #1a1a24; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>NourishFit</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Space Mono', monospace", color: COLORS.text }}>
            {profile.name ? `Hey, ${profile.name.split(" ")[0]} 👋` : "Good morning 👋"}
          </div>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: "50%", background: COLORS.accentDim, border: `2px solid ${COLORS.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer" }} onClick={() => setTab("profile")}>
          {profile.gender === "female" ? "👩" : "🧑"}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ padding: "16px 20px 0" }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Calories", value: totalCals, unit: "kcal", color: COLORS.yellow, icon: "⚡" },
                { label: "Workouts", value: workouts.filter(w => w.date === "Today").length, unit: "today", color: COLORS.accent, icon: "△" },
                { label: "Supps", value: `${suppsTakenToday}/${supplements.length}`, unit: "taken", color: COLORS.purple, icon: "❋" },
                { label: "Goal", value: calorieGoal, unit: "target", color: COLORS.blue, icon: "◎" },
              ].map(s => (
                <div key={s.label} style={{ background: COLORS.card, borderRadius: 12, padding: "10px 8px", textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 14, marginBottom: 2 }}>{s.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: s.color, fontFamily: "'Space Mono',monospace" }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: COLORS.muted }}>{s.unit}</div>
                  <div style={{ fontSize: 9, color: COLORS.mutedLight, marginTop: 1, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <p style={{ margin: "0 0 10px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Today's Calories</p>
            <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
              <CalorieBar consumed={totalCals} goal={calorieGoal} />
            </div>

            <p style={{ margin: "0 0 10px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Today's Supplements</p>
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
            {workouts.slice(0, 3).map((w, idx) => (
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

            <p style={{ margin: "14px 0 10px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Today's Meals</p>
            {meals.map(m => (
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
              <button onClick={() => setShowScanner(true)} style={{ padding: "8px 14px", background: COLORS.accent, color: "#000", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>📸 Scan Meal</button>
            </div>
            <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
              <CalorieBar consumed={totalCals} goal={calorieGoal} />
              <div style={{ display: "flex", justifyContent: "space-around", marginTop: 16 }}>
                <MacroRing label="Protein" value={totalProtein} max={macroTargets.protein} color={COLORS.accent} size={72} />
                <MacroRing label="Carbs"   value={totalCarbs}   max={macroTargets.carbs}   color={COLORS.blue}   size={72} />
                <MacroRing label="Fat"     value={totalFat}     max={macroTargets.fat}      color={COLORS.orange} size={72} />
              </div>
            </div>

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

            <p style={{ margin: "0 0 10px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Today's Meals</p>
            {meals.map(m => (
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
              <button onClick={() => setShowWorkout(true)} style={{ padding: "8px 14px", background: COLORS.blue, color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>+ Log Session</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
              {[{ label: "Sessions", value: workouts.length, unit: "this week" }, { label: "Total Time", value: workouts.reduce((s,w)=>s+w.duration,0), unit: "min" }, { label: "Cals Burned", value: workouts.reduce((s,w)=>s+w.calories,0), unit: "kcal" }].map(s => (
                <div key={s.label} style={{ background: COLORS.card, borderRadius: 12, padding: 12, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.blue, fontFamily: "'Space Mono',monospace" }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: COLORS.muted }}>{s.unit}</div>
                  <div style={{ fontSize: 10, color: COLORS.mutedLight, marginTop: 2, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {workouts.map(w => (
              <div key={w.id} style={{ background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10, border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{w.type === "Cardio" ? "🏃" : w.type === "Mobility" ? "🧘" : "💪"}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{w.name}</span>
                    </div>
                    <Badge text={w.type} color={workoutTypeColor[w.type]||COLORS.mutedLight} />
                  </div>
                  <span style={{ fontSize: 11, color: COLORS.muted }}>{w.date}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ v: `${w.duration}m`, l: "Duration", c: COLORS.text }, { v: w.calories, l: "kcal", c: COLORS.yellow }, ...(w.distance ? [{ v: w.distance, l: "Distance", c: COLORS.blue }] : []), ...(w.sets ? [{ v: w.sets, l: "Sets", c: COLORS.accent }] : [])].map((x, i) => (
                    <div key={i} style={{ flex: 1, background: COLORS.bg, borderRadius: 8, padding: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: x.c }}>{x.v}</div>
                      <div style={{ fontSize: 10, color: COLORS.muted }}>{x.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <p style={{ margin: "16px 0 10px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Exercise Progress</p>
            <button onClick={() => setShowExerciseLog(true)} style={{ width: "100%", padding: "10px", background: COLORS.accentDim, border: `1px solid ${COLORS.accentMid}`, borderRadius: 12, color: COLORS.accent, cursor: "pointer", fontSize: 13, fontWeight: 700, marginBottom: 14 }}>+ Log Exercises for a Session</button>
            {exerciseLogs.map(log => (
              <div key={log.id} style={{ background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10, border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>💪 {log.sessionName}</span>
                  <span style={{ fontSize: 11, color: COLORS.muted }}>{log.date}</span>
                </div>
                {log.exercises.map((ex, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.accent, marginBottom: 5 }}>{ex.name}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {ex.sets.map((s, j) => (
                        <div key={j} style={{ background: COLORS.bg, borderRadius: 8, padding: "5px 10px", fontSize: 11, color: COLORS.text, fontFamily: "'Space Mono',monospace" }}>
                          <span style={{ color: COLORS.mutedLight }}>S{j + 1} </span>{s.reps}<span style={{ color: COLORS.muted }}>×</span><span style={{ color: COLORS.yellow }}>{s.weight}kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── COACH ── */}
        {tab === "coach" && <AICoach />}

        {/* ── SUPPLEMENTS ── */}
        {tab === "supplements" && (
          <div>
            <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono', monospace" }}>Supplements</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
              {supplements.map(s => (
                <div key={s.id} style={{ background: COLORS.card, borderRadius: 14, padding: 14, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontSize: 28 }}>{s.emoji}</span>
                    <Badge text={s.category} color={s.color} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text, marginBottom: 2 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>{s.dose} · {s.timing}</div>
                  <div style={{ fontSize: 11, color: s.color }}>{s.benefit}</div>
                  <div style={{ display: "flex", gap: 2, marginTop: 8, flexWrap: "wrap" }}>
                    {s.history.slice(-14).map((h, i) => (
                      <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: h.taken ? s.color : COLORS.border }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
              <div style={{ background: COLORS.card, borderRadius: 14, padding: 14, border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sleep</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.blue, fontFamily: "'Space Mono',monospace" }}>7.5<span style={{ fontSize: 14, color: COLORS.muted }}>h</span></div>
                <div style={{ fontSize: 11, color: COLORS.accent }}>↑ Good quality</div>
              </div>
              <div style={{ background: COLORS.card, borderRadius: 14, padding: 14, border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Recovery</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.accent, fontFamily: "'Space Mono',monospace" }}>78<span style={{ fontSize: 14, color: COLORS.muted }}>%</span></div>
                <div style={{ fontSize: 11, color: COLORS.yellow }}>Moderate load</div>
              </div>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Active Injuries & Symptoms</p>
            {injuries.length === 0 ? (
              <div style={{ background: COLORS.card, borderRadius: 14, padding: 24, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>All clear!</div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>No active injuries logged</div>
              </div>
            ) : injuries.map(inj => (
              <div key={inj.id} style={{ background: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10, border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${severityColor[inj.severity]||COLORS.warn}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>{inj.area}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Badge text={inj.severity} color={severityColor[inj.severity]||COLORS.warn} />
                      <Badge text={inj.status} color={statusColor[inj.status]||COLORS.mutedLight} />
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: COLORS.muted }}>{inj.date}</span>
                </div>
                {inj.note && <p style={{ margin: 0, fontSize: 12, color: COLORS.mutedLight, fontStyle: "italic" }}>"{inj.note}"</p>}
              </div>
            ))}
          </div>
        )}

        {/* ── PROFILE ── */}
        {tab === "profile" && (
          <ProfilePage profile={profile} setProfile={setProfile} />
        )}

      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: COLORS.surface, borderTop: `1px solid ${COLORS.border}`, display: "flex", padding: "10px 0 16px", backdropFilter: "blur(20px)" }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
            <span style={{ fontSize: 17, filter: tab === n.id ? "none" : "grayscale(1) opacity(0.4)", transition: "all 0.2s" }}>{n.icon}</span>
            <span style={{ fontSize: 9, fontWeight: tab === n.id ? 700 : 500, color: tab === n.id ? COLORS.accent : COLORS.muted, transition: "color 0.2s" }}>{n.label}</span>
            {tab === n.id && <div style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.accent }} />}
          </button>
        ))}
      </div>

      {showScanner && <AIPhotoScanner onClose={() => setShowScanner(false)} onScan={m => setMeals(prev => [...prev, { id: Date.now(), name: m.name, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat, img: "🍽️" }])} />}
      {showWorkout && <AddWorkoutModal onClose={() => setShowWorkout(false)} onAdd={w => setWorkouts(prev => [w, ...prev])} />}
      {showInjury && <AddInjuryModal onClose={() => setShowInjury(false)} onAdd={inj => setInjuries(prev => [inj, ...prev])} />}
      {showExerciseLog && (
        <ExerciseLogModal
          onClose={() => setShowExerciseLog(false)}
          onAdd={log => setExerciseLogs(prev => [log, ...prev])}
        />
      )}
    </div>
  );
}
