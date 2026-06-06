/* Template 1 — Verdict-led single scroll.
 * The answer first: a large plain-language verdict, the one fix that matters,
 * then progressively quieter detail down a single calm reading column.
 * Score is present but secondary to the verdict.
 */
(function () {
  const { useState } = React;

  function Eyebrow({ icon, children, color }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        {icon && <Icon name={icon} size={15} color={color || TC.royal} />}
        <span className="tc-eyebrow" style={{ color: color || TC.royal, fontSize: 11.5, whiteSpace: "nowrap" }}>{children}</span>
        <span style={{ flex: 1, height: 1, background: TC.borderSoft }} />
      </div>
    );
  }

  function Sec({ children, style }) {
    return <section style={{ padding: "34px 0", borderTop: `1px solid ${TC.borderSoft}`, ...style }}>{children}</section>;
  }

  function FixRow({ item, marker, color }) {
    return (
      <li style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: `1px solid ${TC.borderSoft}` }}>
        <span style={{ flexShrink: 0, marginTop: 2, color }}>{marker}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: TC.dark }}>{item.title}</div>
          {item.detail && <div style={{ fontSize: 14, color: TC.muted, marginTop: 2 }}>{item.detail}</div>}
        </div>
      </li>
    );
  }

  function Tpl1({ report: r }) {
    const v = verdictMeta(r.verdict.decision);
    const [showAllBrief, setShowAllBrief] = useState(false);
    const briefRows = showAllBrief ? r.brief.requirements : r.brief.requirements.slice(0, 4);

    return (
      <div style={{ background: TC.offwhite, minHeight: "100%" }}>
        <div style={{ maxWidth: 768, margin: "0 auto", padding: "40px 24px 90px" }}>
          {/* meta strip */}
          <div className="tc-meta-row" style={{ marginBottom: 26 }}>
            <span><Icon name="film" size={14} color={TC.muted} style={{ verticalAlign: "-2px", marginRight: 6 }} /><b>{r.meta.project}</b></span>
            <span>{r.meta.role}</span>
            <span>{r.meta.take} · {r.meta.version}</span>
          </div>

          {/* HERO VERDICT */}
          <div className="tc-fade">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999,
              background: v.bg, border: `1px solid ${v.line}`, color: v.color, fontWeight: 800, fontSize: 13, letterSpacing: ".02em" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: v.color }} />
              {r.verdict.label}
            </div>
            <h1 className="tc-serif" style={{ fontSize: 40, lineHeight: 1.12, color: TC.navy, margin: "18px 0 0", letterSpacing: "-.02em", textWrap: "balance" }}>
              {r.verdict.headline}
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.65, color: TC.muted, marginTop: 16, maxWidth: 620 }}>{r.verdict.explanation}</p>

            {/* score + context, secondary */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 26, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                <span className="tc-serif tc-tnum" style={{ fontSize: 34, fontWeight: 800, color: scoreColor(r.score.overall) }}>{r.score.overall}</span>
                <span style={{ fontSize: 13, color: TC.muted, fontWeight: 600 }}>/ 100 readiness</span>
              </div>
              <span style={{ width: 1, height: 26, background: TC.border }} />
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <span className="tc-chip"><Icon name="target" size={13} color={TC.muted} /> {r.meta.judgedAgainst}</span>
                <span className="tc-chip"><Icon name="clip" size={13} color={TC.muted} /> {r.meta.scoringBasis}</span>
              </div>
            </div>
          </div>

          {/* FIX FIRST */}
          <div style={{ marginTop: 34, borderRadius: 16, border: `1px solid ${TC.warningLine}`, background: TC.warningBg, padding: "22px 24px",
            display: "flex", gap: 16 }}>
            <div style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 11, background: "#fff", border: `1px solid ${TC.warningLine}`,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="wrench" size={20} color={TC.warning} />
            </div>
            <div>
              <div className="tc-eyebrow" style={{ color: TC.warning }}>Fix this first · ~{r.fixFirst.minutes} min</div>
              <h3 className="tc-serif" style={{ fontSize: 21, color: TC.navy, margin: "5px 0 0" }}>{r.fixFirst.title}</h3>
              <p style={{ fontSize: 14.5, color: TC.dark, marginTop: 8, lineHeight: 1.6 }}>{r.fixFirst.action}</p>
              <div style={{ fontSize: 13, color: TC.warning, fontWeight: 600, marginTop: 8 }}>↑ {r.fixFirst.impact}</div>
            </div>
          </div>

          {/* WHY */}
          <Sec>
            <Eyebrow icon="list">Why this verdict</Eyebrow>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {r.verdict.rationale.map((x, i) => (
                <li key={i} style={{ display: "flex", gap: 12, padding: "9px 0" }}>
                  <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, background: TC.royalBg, color: TC.royal,
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, marginTop: 1 }}>{i + 1}</span>
                  <div>
                    <span style={{ fontWeight: 700, color: TC.dark, fontSize: 15 }}>{x.title}.</span>{" "}
                    <span style={{ color: TC.muted, fontSize: 15 }}>{x.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Sec>

          {/* SCORES */}
          <Sec>
            <Eyebrow icon="target">How it scores</Eyebrow>
            <div style={{ display: "grid", gap: 16 }}>
              {r.categories.map((c) => (
                <div key={c.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 15, color: TC.dark }}>{c.label}</span>
                    <span className="tc-tnum" style={{ fontWeight: 800, fontSize: 15, color: scoreColor(c.score) }}>{c.score}</span>
                  </div>
                  <Bar value={c.score} />
                  <p style={{ fontSize: 13, color: TC.muted, margin: "7px 0 0" }}>{c.note}</p>
                </div>
              ))}
            </div>
          </Sec>

          {/* BRIEF */}
          <Sec>
            <Eyebrow icon="clip">Brief fit</Eyebrow>
            <p style={{ fontSize: 15, color: TC.muted, margin: "0 0 16px", lineHeight: 1.6 }}>{r.brief.summary}</p>
            <div style={{ display: "grid", gap: 0, border: `1px solid ${TC.border}`, borderRadius: 12, overflow: "hidden" }}>
              {briefRows.map((q, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "13px 16px",
                  borderTop: i ? `1px solid ${TC.borderSoft}` : "none", background: "#fff" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5, color: TC.dark }}>{q.name}</div>
                    <div style={{ fontSize: 12.5, color: TC.muted, marginTop: 2 }}>{q.category} · {q.importance} — {q.evidence}</div>
                  </div>
                  <StatusChip status={q.status} small />
                </div>
              ))}
              {r.brief.requirements.length > 4 && (
                <button onClick={() => setShowAllBrief((s) => !s)} className="tc-sans"
                  style={{ border: "none", borderTop: `1px solid ${TC.borderSoft}`, background: TC.offwhite, color: TC.royal, fontWeight: 600,
                    fontSize: 13.5, padding: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {showAllBrief ? "Show fewer" : `Show all ${r.brief.requirements.length} requirements`}
                  <Icon name={showAllBrief ? "chevron" : "chevronR"} size={14} color={TC.royal} />
                </button>
              )}
            </div>
          </Sec>

          {/* FIXES */}
          <Sec>
            <Eyebrow icon="wrench">What to change</Eyebrow>
            <div style={{ marginBottom: 8, fontWeight: 700, fontSize: 13.5, color: TC.danger }}>Priority</div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px" }}>
              {r.fixes.priority.map((x, i) => <FixRow key={i} item={x} marker={<Icon name="arrow" size={16} color={TC.danger} />} color={TC.danger} />)}
            </ul>
            <div style={{ marginBottom: 8, fontWeight: 700, fontSize: 13.5, color: TC.warning }}>Worth improving if you retake</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {r.fixes.improve.map((x, i) => <FixRow key={i} item={x} marker={<Icon name="arrow" size={16} color={TC.warning} />} color={TC.warning} />)}
            </ul>
          </Sec>

          {/* STRENGTHS & PRESERVE */}
          <Sec>
            <Eyebrow icon="star" color={TC.success}>Keep doing this</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ border: `1px solid ${TC.successLine}`, background: TC.successBg, borderRadius: 12, padding: "16px 18px" }}>
                <div className="tc-eyebrow" style={{ color: TC.success, marginBottom: 10 }}>Strengths</div>
                {r.strengths.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 9, marginBottom: i < r.strengths.length - 1 ? 11 : 0 }}>
                    <Icon name="check" size={16} color={TC.success} stroke={2.4} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div><b style={{ fontSize: 14, color: TC.dark }}>{s.title}.</b> <span style={{ fontSize: 14, color: TC.muted }}>{s.detail}</span></div>
                  </div>
                ))}
              </div>
              <div style={{ border: `1px solid ${TC.border}`, background: "#fff", borderRadius: 12, padding: "16px 18px" }}>
                <div className="tc-eyebrow" style={{ color: TC.violet, marginBottom: 10 }}>Preserve — don't lose these</div>
                {r.fixes.preserve.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 9, marginBottom: i < r.fixes.preserve.length - 1 ? 11 : 0 }}>
                    <Icon name="sparkle" size={15} color={TC.violet} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div><b style={{ fontSize: 14, color: TC.dark }}>{s.title}.</b> <span style={{ fontSize: 14, color: TC.muted }}>{s.detail}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </Sec>

          {/* TIMELINE */}
          <Sec>
            <Eyebrow icon="clock">Moment by moment</Eyebrow>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {r.timeline.map((t, i) => {
                const c = t.kind === "strength" ? TC.success : t.kind === "issue" ? TC.danger : TC.warning;
                return (
                  <li key={i} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: i < r.timeline.length - 1 ? `1px solid ${TC.borderSoft}` : "none" }}>
                    <span className="tc-tnum" style={{ flexShrink: 0, width: 44, fontFamily: "var(--serif)", fontWeight: 700, fontSize: 14, color: TC.mid }}>{t.time}</span>
                    <span style={{ flexShrink: 0, width: 9, height: 9, borderRadius: 999, background: c, marginTop: 6 }} />
                    <span style={{ fontSize: 14.5, color: TC.dark }}>{t.text}</span>
                  </li>
                );
              })}
            </ul>
          </Sec>

          {/* NEXT STEPS */}
          <Sec>
            <Eyebrow icon="arrow">Your next take</Eyebrow>
            <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", counterReset: "step" }}>
              {r.nextAction.plan.map((p, i) => (
                <li key={i} style={{ display: "flex", gap: 12, padding: "9px 0" }}>
                  <span className="tc-tnum" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 999, border: `1.5px solid ${TC.royal}`,
                    color: TC.royal, fontWeight: 800, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  <span style={{ fontSize: 15, color: TC.dark, paddingTop: 1 }}>{p}</span>
                </li>
              ))}
            </ol>
            <div style={{ marginTop: 16, padding: "13px 16px", borderRadius: 10, background: TC.royalBg, border: `1px solid #CFE0FB`,
              fontSize: 14, color: TC.mid, display: "flex", gap: 10 }}>
              <Icon name="clock" size={16} color={TC.royal} style={{ flexShrink: 0, marginTop: 2 }} />
              <span><b>On a tight deadline?</b> {r.nextAction.ifShort}</span>
            </div>
          </Sec>

          {/* LIMITATIONS */}
          <Sec style={{ paddingBottom: 0 }}>
            <Eyebrow icon="shield" color={TC.muted}>What we couldn't fully assess</Eyebrow>
            <ul style={{ margin: 0, paddingLeft: 18, color: TC.muted, fontSize: 13.5 }}>
              {r.limitations.map((l, i) => <li key={i} style={{ marginBottom: 5 }}>{l}</li>)}
            </ul>
          </Sec>
        </div>
      </div>
    );
  }

  window.TPL1 = {
    n: 1, name: "Verdict-led", tag: "verdict",
    blurb: "The plain-language answer and the one fix that matters come first; everything else gets quieter as you scroll.",
    Comp: Tpl1,
  };
})();
