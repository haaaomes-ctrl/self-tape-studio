/* Template 3 — Colour-coded sections.
 * A navy hero, then a grid of cards where each area of feedback owns a colour
 * and icon (brief = green, fixes = amber/red, strengths = violet, technique =
 * blue…). The eye finds the part it wants by colour, not by reading headings.
 */
(function () {
  function CCard({ accent, icon, title, kicker, children, span = 1, style }) {
    return (
      <section style={{ gridColumn: `span ${span}`, background: "#fff", border: `1px solid ${TC.border}`, borderRadius: 16,
        boxShadow: "var(--shadow-soft)", overflow: "hidden", display: "flex", flexDirection: "column", ...style }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 20px", background: accent.bg, borderBottom: `1px solid ${accent.line}` }}>
          <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 9, background: "#fff", border: `1px solid ${accent.line}`,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={icon} size={17} color={accent.color} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 className="tc-serif" style={{ fontSize: 17, color: accent.color, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h3>
            {kicker && <div style={{ fontSize: 12, color: TC.muted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{kicker}</div>}
          </div>
        </header>
        <div style={{ padding: "18px 20px", flex: 1 }}>{children}</div>
      </section>
    );
  }

  function Tpl3({ report: r }) {
    const v = verdictMeta(r.verdict.decision);
    const A = {
      royal: { color: TC.royal, bg: TC.royalBg, line: "#CFE0FB" },
      green: { color: TC.success, bg: TC.successBg, line: TC.successLine },
      amber: { color: TC.warning, bg: TC.warningBg, line: TC.warningLine },
      red: { color: TC.danger, bg: TC.dangerBg, line: TC.dangerLine },
      violet: { color: TC.violet, bg: TC.violetBg, line: "#E0D6FF" },
      blue: { color: TC.mid, bg: "#EAF0F7", line: "#D3E0EE" },
    };

    return (
      <div style={{ background: TC.offwhite, minHeight: "100%" }}>
        {/* NAVY HERO */}
        <div style={{ background: `linear-gradient(135deg, ${TC.navy} 0%, ${TC.mid} 100%)`, color: "#fff" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 24px 34px" }}>
            <div className="tc-meta-row" style={{ color: "rgba(255,255,255,.7)", marginBottom: 16 }}>
              <span style={{ color: "rgba(255,255,255,.92)", fontWeight: 700 }}>{r.meta.project}</span>
              <span>{r.meta.role}</span><span>{r.meta.take}</span><span>{r.meta.judgedAgainst} level</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <ScoreRing value={r.score.overall} size={120} stroke={10} label="Readiness" />
                <div style={{ position: "absolute", inset: 0, borderRadius: 999, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 280 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999,
                  background: "rgba(255,255,255,.12)", color: "#fff", fontWeight: 700, fontSize: 12.5, border: `1px solid rgba(255,255,255,.18)` }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: v.color === TC.warning ? "#FFD27A" : "#fff" }} />{r.verdict.label}
                </span>
                <h1 className="tc-serif" style={{ color: "#fff", fontSize: 28, lineHeight: 1.2, margin: "12px 0 0", letterSpacing: "-.015em", textWrap: "balance" }}>{r.verdict.headline}</h1>
                <p style={{ color: "rgba(255,255,255,.82)", fontSize: 15, lineHeight: 1.6, margin: "10px 0 0", maxWidth: 640 }}>{r.verdict.explanation}</p>
              </div>
            </div>
          </div>
        </div>

        {/* COLOUR GRID */}
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 24px 90px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 18, alignItems: "start" }}>

            {/* fix first — full width, amber */}
            <CCard accent={A.amber} icon="wrench" title="Fix this first" kicker={`~${r.fixFirst.minutes} min · biggest single lift`} span={2}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <h4 className="tc-serif" style={{ fontSize: 18, color: TC.navy, margin: "0 0 6px" }}>{r.fixFirst.title}</h4>
                  <p style={{ fontSize: 14.5, color: TC.dark, margin: 0, lineHeight: 1.6 }}>{r.fixFirst.action}</p>
                </div>
                <div style={{ flexShrink: 0, padding: "12px 16px", borderRadius: 10, background: TC.warningBg, border: `1px solid ${TC.warningLine}`, maxWidth: 230 }}>
                  <div className="tc-eyebrow" style={{ color: TC.warning }}>Impact</div>
                  <div style={{ fontSize: 13.5, color: TC.dark, marginTop: 5 }}>{r.fixFirst.impact}</div>
                </div>
              </div>
            </CCard>

            {/* scores — royal */}
            <CCard accent={A.royal} icon="target" title="How it scores" kicker={`Overall ${r.score.overall} / 100`}>
              <div style={{ display: "grid", gap: 12 }}>
                {r.categories.map((c) => (
                  <div key={c.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5, color: TC.dark, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                      <span className="tc-tnum" style={{ flexShrink: 0, fontWeight: 800, fontSize: 13.5, color: scoreColor(c.score) }}>{c.score}</span>
                    </div>
                    <Bar value={c.score} height={7} />
                  </div>
                ))}
              </div>
            </CCard>

            {/* brief — green */}
            <CCard accent={A.green} icon="clip" title="Brief fit" kicker={`${r.brief.requirements.filter((q) => q.status === "achieved").length} of ${r.brief.requirements.length} achieved`}>
              <div style={{ display: "grid", gap: 0 }}>
                {r.brief.requirements.map((q, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${TC.borderSoft}` : "none" }}>
                    <span style={{ fontSize: 13.5, color: TC.dark, fontWeight: 500 }}>{q.name}</span>
                    <StatusChip status={q.status} small />
                  </div>
                ))}
              </div>
            </CCard>

            {/* changes — red */}
            <CCard accent={A.red} icon="arrow" title="What to change" kicker="Priority, then nice-to-have">
              <div className="tc-eyebrow" style={{ color: TC.danger, marginBottom: 7 }}>Priority</div>
              {r.fixes.priority.map((x, i) => (
                <div key={i} style={{ display: "flex", gap: 9, marginBottom: 9 }}>
                  <Icon name="arrow" size={15} color={TC.danger} style={{ flexShrink: 0, marginTop: 3 }} />
                  <div><b style={{ fontSize: 13.5, color: TC.dark }}>{x.title}.</b> <span style={{ fontSize: 13.5, color: TC.muted }}>{x.detail}</span></div>
                </div>
              ))}
              <div className="tc-eyebrow" style={{ color: TC.warning, margin: "12px 0 7px" }}>If you retake</div>
              {r.fixes.improve.map((x, i) => (
                <div key={i} style={{ display: "flex", gap: 9, marginBottom: 9 }}>
                  <Icon name="arrow" size={15} color={TC.warning} style={{ flexShrink: 0, marginTop: 3 }} />
                  <div><b style={{ fontSize: 13.5, color: TC.dark }}>{x.title}.</b> <span style={{ fontSize: 13.5, color: TC.muted }}>{x.detail}</span></div>
                </div>
              ))}
            </CCard>

            {/* strengths & preserve — violet */}
            <CCard accent={A.violet} icon="star" title="Keep doing this" kicker="Strengths & what to preserve">
              <div className="tc-eyebrow" style={{ color: TC.success, marginBottom: 7 }}>Strengths</div>
              {r.strengths.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 9, marginBottom: 9 }}>
                  <Icon name="check" size={15} color={TC.success} stroke={2.4} style={{ flexShrink: 0, marginTop: 3 }} />
                  <div><b style={{ fontSize: 13.5, color: TC.dark }}>{s.title}.</b> <span style={{ fontSize: 13.5, color: TC.muted }}>{s.detail}</span></div>
                </div>
              ))}
              <div className="tc-eyebrow" style={{ color: TC.violet, margin: "12px 0 7px" }}>Preserve</div>
              {r.fixes.preserve.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 9, marginBottom: 9 }}>
                  <Icon name="sparkle" size={14} color={TC.violet} style={{ flexShrink: 0, marginTop: 3 }} />
                  <div><b style={{ fontSize: 13.5, color: TC.dark }}>{s.title}.</b> <span style={{ fontSize: 13.5, color: TC.muted }}>{s.detail}</span></div>
                </div>
              ))}
            </CCard>

            {/* technique — blue */}
            <CCard accent={A.blue} icon="eye" title="Technique" kicker="Where the tape supports it">
              {r.technique.sections.map((s, i) => (
                <div key={i} style={{ marginBottom: i < r.technique.sections.length - 1 ? 14 : 0, paddingBottom: i < r.technique.sections.length - 1 ? 14 : 0, borderBottom: i < r.technique.sections.length - 1 ? `1px solid ${TC.borderSoft}` : "none" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: TC.navy }}>{s.area}</div>
                  <div style={{ fontSize: 13, color: TC.muted, margin: "2px 0 8px" }}>{s.headline}</div>
                  {s.working.map((w, j) => <div key={"w" + j} style={{ fontSize: 13, color: TC.dark, display: "flex", gap: 7, marginBottom: 3 }}><Icon name="check" size={13} color={TC.success} stroke={2.4} style={{ flexShrink: 0, marginTop: 2 }} />{w}</div>)}
                  {s.improve.map((w, j) => <div key={"i" + j} style={{ fontSize: 13, color: TC.dark, display: "flex", gap: 7, marginBottom: 3 }}><Icon name="arrow" size={13} color={TC.warning} style={{ flexShrink: 0, marginTop: 2 }} />{w}</div>)}
                </div>
              ))}
            </CCard>

            {/* timeline — royal, full width */}
            <CCard accent={A.royal} icon="clock" title="Moment by moment" kicker={`${r.timeline.length} timestamped notes`} span={2}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "6px 26px" }}>
                {r.timeline.map((t, i) => {
                  const c = t.kind === "strength" ? TC.success : t.kind === "issue" ? TC.danger : TC.warning;
                  return (
                    <div key={i} style={{ display: "flex", gap: 11, padding: "7px 0", alignItems: "flex-start" }}>
                      <span className="tc-tnum tc-serif" style={{ flexShrink: 0, width: 40, fontWeight: 700, fontSize: 13.5, color: TC.mid }}>{t.time}</span>
                      <span style={{ flexShrink: 0, width: 8, height: 8, borderRadius: 999, background: c, marginTop: 6 }} />
                      <span style={{ fontSize: 13.5, color: TC.dark }}>{t.text}</span>
                    </div>
                  );
                })}
              </div>
            </CCard>

            {/* next steps — green, full width */}
            <CCard accent={A.green} icon="arrow" title="Your next take" kicker="Do these, in order" span={2}>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <ol style={{ flex: 1, minWidth: 280, margin: 0, padding: 0, listStyle: "none" }}>
                  {r.nextAction.plan.map((p, i) => (
                    <li key={i} style={{ display: "flex", gap: 11, padding: "6px 0" }}>
                      <span className="tc-tnum" style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 999, background: TC.success, color: "#fff", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                      <span style={{ fontSize: 14, color: TC.dark, paddingTop: 1 }}>{p}</span>
                    </li>
                  ))}
                </ol>
                <div style={{ flexShrink: 0, width: 250, padding: "14px 16px", borderRadius: 10, background: TC.royalBg, border: "1px solid #CFE0FB" }}>
                  <div className="tc-eyebrow" style={{ color: TC.royal }}>Before you submit</div>
                  {r.nextAction.checklist.map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: TC.dark, marginTop: 8 }}>
                      <span style={{ flexShrink: 0, width: 15, height: 15, border: `1.5px solid ${TC.royal}`, borderRadius: 4, marginTop: 1 }} />{c}
                    </div>
                  ))}
                </div>
              </div>
            </CCard>
          </div>

          <p style={{ fontSize: 12.5, color: TC.muted, marginTop: 18, lineHeight: 1.6 }}>
            <Icon name="shield" size={13} color={TC.muted} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            {r.limitations.join(" ")}
          </p>
        </div>
      </div>
    );
  }

  window.TPL3 = {
    n: 3, name: "Colour-coded", tag: "colour",
    blurb: "Each area of feedback gets its own colour and icon, so the eye finds acting, audio, brief and next-steps instantly.",
    Comp: Tpl3,
  };
})();
