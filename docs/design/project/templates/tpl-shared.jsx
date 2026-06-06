/* Shared TapeCoach brand tokens + report primitives, used by all 6 templates.
 * Injects one <style> with brand variables + reusable classes, and exports a
 * small set of React primitives (icons, status chips, score ring, bars, logo).
 */

if (!document.getElementById("tc-shared-styles")) {
  const s = document.createElement("style");
  s.id = "tc-shared-styles";
  s.textContent = `
  :root{
    --navy:#091E42; --mid:#19457C; --royal:#2F80ED; --violet:#7B4DFF;
    --offwhite:#F8F9FB; --lightgrey:#ECEFF4; --dark:#1F2933; --muted:#5B6B7F;
    --border:#E3E8EF; --border-soft:#EDF1F6; --card:#FFFFFF;
    --success:#2F855A; --success-bg:#E7F3EC; --success-line:#CBE6D5;
    --warning:#B7791F; --warning-bg:#FBF3E3; --warning-line:#F0E0BD;
    --danger:#C53030; --danger-bg:#FBEAEA; --danger-line:#F2CFCF;
    --royal-bg:#EAF1FD; --violet-bg:#F0EBFF;
    --serif:"Merriweather","Libre Baskerville",ui-serif,Georgia,serif;
    --sans:"Inter",ui-sans-serif,system-ui,sans-serif;
    --shadow-soft:0 1px 2px rgba(9,30,66,.06),0 4px 16px -4px rgba(9,30,66,.10);
    --shadow-elev:0 2px 4px rgba(9,30,66,.08),0 14px 36px -10px rgba(9,30,66,.18);
    --radius:14px;
  }
  .tc-root,.tc-root *{box-sizing:border-box}
  .tc-root{font-family:var(--sans);color:var(--dark);line-height:1.6;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
  .tc-root h1,.tc-root h2,.tc-root h3,.tc-root h4{font-family:var(--serif);color:var(--mid);letter-spacing:-.015em;margin:0;font-weight:700}
  .tc-serif{font-family:var(--serif)}
  .tc-sans{font-family:var(--sans)}
  .tc-eyebrow{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
  .tc-tnum{font-variant-numeric:tabular-nums}
  .tc-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-soft)}
  .tc-divider{height:1px;background:var(--border-soft);border:0}
  .tc-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;
    padding:4px 10px;border-radius:999px;border:1px solid var(--border);background:#fff;color:var(--muted);line-height:1.2;white-space:nowrap}
  .tc-link{color:var(--royal);font-weight:600;text-decoration:none}
  .tc-btn{display:inline-flex;align-items:center;gap:8px;font-family:var(--sans);font-size:14px;font-weight:600;
    padding:11px 18px;border-radius:10px;border:1px solid transparent;cursor:pointer;transition:.15s;line-height:1}
  .tc-btn-primary{background:var(--royal);color:#fff}
  .tc-btn-primary:hover{background:#2369c9}
  .tc-btn-ghost{background:#fff;color:var(--mid);border-color:var(--border)}
  .tc-btn-ghost:hover{background:var(--lightgrey)}
  .tc-meta-row{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px;color:var(--muted)}
  .tc-meta-row b{color:var(--dark);font-weight:600}
  @keyframes tc-ring{from{stroke-dashoffset:var(--from)}to{stroke-dashoffset:var(--to)}}
  .tc-fade{}
  `;
  document.head.appendChild(s);
}

const TC = {
  navy: "#091E42", mid: "#19457C", royal: "#2F80ED", violet: "#7B4DFF",
  offwhite: "#F8F9FB", lightgrey: "#ECEFF4", dark: "#1F2933", muted: "#5B6B7F",
  border: "#E3E8EF", borderSoft: "#EDF1F6", card: "#FFFFFF",
  success: "#2F855A", successBg: "#E7F3EC", successLine: "#CBE6D5",
  warning: "#B7791F", warningBg: "#FBF3E3", warningLine: "#F0E0BD",
  danger: "#C53030", dangerBg: "#FBEAEA", dangerLine: "#F2CFCF",
  royalBg: "#EAF1FD", violetBg: "#F0EBFF",
};

// ── status semantics ───────────────────────────────────────────
function statusMeta(status) {
  switch (status) {
    case "achieved": return { label: "Achieved", color: TC.success, bg: TC.successBg, line: TC.successLine, icon: "check" };
    case "partial": return { label: "Partial", color: TC.warning, bg: TC.warningBg, line: TC.warningLine, icon: "minus" };
    case "missing": return { label: "Missing", color: TC.danger, bg: TC.dangerBg, line: TC.dangerLine, icon: "x" };
    case "mostly_achieved": return { label: "Mostly achieved", color: TC.success, bg: TC.successBg, line: TC.successLine, icon: "check" };
    default: return { label: status, color: TC.muted, bg: "#fff", line: TC.border, icon: "dot" };
  }
}
function verdictMeta(decision) {
  switch (decision) {
    case "submit": return { color: TC.success, bg: TC.successBg, line: TC.successLine, word: "Submit" };
    case "review_carefully": return { color: TC.warning, bg: TC.warningBg, line: TC.warningLine, word: "Review" };
    case "submit_if_close": return { color: TC.royal, bg: TC.royalBg, line: "#CFE0FB", word: "Submit if close" };
    case "retake": return { color: TC.danger, bg: TC.dangerBg, line: TC.dangerLine, word: "Re-record" };
    default: return { color: TC.muted, bg: "#fff", line: TC.border, word: decision };
  }
}
function scoreColor(v) {
  if (v >= 80) return TC.success;
  if (v >= 70) return TC.royal;
  if (v >= 55) return TC.warning;
  return TC.danger;
}

// ── icons ──────────────────────────────────────────────────────
function Icon({ name, size = 16, stroke = 1.8, color = "currentColor", style }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round", style };
  const paths = {
    check: <polyline points="20 6 9 17 4 12" />,
    x: <g><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></g>,
    minus: <line x1="5" y1="12" x2="19" y2="12" />,
    dot: <circle cx="12" cy="12" r="3" fill={color} stroke="none" />,
    arrow: <g><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></g>,
    arrowDown: <g><line x1="12" y1="5" x2="12" y2="19" /><polyline points="5 12 12 19 19 12" /></g>,
    chevron: <polyline points="6 9 12 15 18 9" />,
    chevronR: <polyline points="9 6 15 12 9 18" />,
    star: <polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" fill={color} stroke="none" />,
    alert: <g><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></g>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    target: <g><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill={color} /></g>,
    film: <g><rect x="2.5" y="4" width="19" height="16" rx="2" /><line x1="8" y1="4" x2="8" y2="20" /><line x1="16" y1="4" x2="16" y2="20" /></g>,
    eye: <g><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></g>,
    mic: <g><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></g>,
    clip: <g><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 4v4h6V4M8 12h8M8 16h5" /></g>,
    clock: <g><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></g>,
    wrench: <path d="M14.7 6.3a4 4 0 0 0-5.2 5.2L3 18l3 3 6.5-6.5a4 4 0 0 0 5.2-5.2l-2.4 2.4-2.6-.6-.6-2.6 2.4-2.4Z" />,
    sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" fill={color} stroke="none" />,
    list: <g><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="3.5" cy="6" r="1" fill={color} /><circle cx="3.5" cy="12" r="1" fill={color} /><circle cx="3.5" cy="18" r="1" fill={color} /></g>,
    printer: <g><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></g>,
  };
  return <svg {...p}>{paths[name] || paths.dot}</svg>;
}

// ── status chip / dot ──────────────────────────────────────────
function StatusChip({ status, small }) {
  const m = statusMeta(status);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: small ? 11 : 12, fontWeight: 700,
      padding: small ? "2px 8px" : "3px 10px", borderRadius: 999, color: m.color, background: m.bg, border: `1px solid ${m.line}`, lineHeight: 1.3, whiteSpace: "nowrap" }}>
      <Icon name={m.icon} size={small ? 11 : 12} stroke={2.4} color={m.color} />
      {m.label}
    </span>
  );
}

// ── circular score ring ────────────────────────────────────────
function ScoreRing({ value, size = 132, stroke = 11, label = "Readiness", animate = true }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const col = scoreColor(value);
  const off = c * (1 - value / 100);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TC.lightgrey} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span className="tc-serif tc-tnum" style={{ fontSize: size * 0.34, fontWeight: 800, color: col, lineHeight: 1 }}>{value}</span>
        <span className="tc-eyebrow" style={{ fontSize: 9.5, marginTop: 3 }}>{label}</span>
      </div>
    </div>
  );
}

// ── horizontal score bar ───────────────────────────────────────
function Bar({ value, color, height = 8, track = TC.lightgrey }) {
  const col = color || scoreColor(value);
  return (
    <div style={{ height, background: track, borderRadius: 999, overflow: "hidden", width: "100%" }}>
      <div style={{ height: "100%", width: `${value}%`, background: col, borderRadius: 999, transition: "width .9s cubic-bezier(.2,.7,.3,1)" }} />
    </div>
  );
}

// ── brand logo lockup ──────────────────────────────────────────
function Logo({ height = 26, light = false }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <img src="../assets/tapecoach-logo.png" alt="" style={{ height, width: height, objectFit: "contain", display: "block" }} />
      <span className="tc-serif" style={{ fontSize: height * 0.7, fontWeight: 800, color: light ? "#fff" : TC.navy, letterSpacing: "-.02em" }}>
        Tape<span style={{ color: light ? "#fff" : TC.royal }}>Coach</span>
      </span>
    </span>
  );
}

Object.assign(window, { TC, statusMeta, verdictMeta, scoreColor, Icon, StatusChip, ScoreRing, Bar, Logo });
