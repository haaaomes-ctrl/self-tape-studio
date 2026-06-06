/* Template 6 — Scannable dashboard.
 * A bento grid: a big score/verdict tile, the one fix, a snapshot of chips, and
 * compact cards for scores, brief, strengths, fixes, timeline and next steps.
 * Built to be read in about five seconds, then drilled into.
 */
(function () {
  if (!document.getElementById("t6-styles")) {
    const s = document.createElement("style");
    s.id = "t6-styles";
    s.textContent = `
      .t6grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px;align-items:start}
      .t6grid .s3{grid-column:span 3}.t6grid .s4{grid-column:span 4}.t6grid .s5{grid-column:span 5}
      .t6grid .s6{grid-column:span 6}.t6grid .s7{grid-column:span 7}.t6grid .s8{grid-column:span 8}.t6grid .s12{grid-column:span 12}
      @media(max-width:900px){.t6grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .t6grid .s3,.t6grid .s4,.t6grid .s5{grid-column:span 1}
        .t6grid .s6,.t6grid .s7,.t6grid .s8,.t6grid .s12{grid-column:span 2}}
      @media(max-width:560px){.t6grid{grid-template-columns:1fr}.t6grid>*{grid-column:span 1 !important}}
    `;
    document.head.appendChild(s);
  }

  function Tile({ children, style, className }) {
    return <div className={"tc-card " + (className || "")} style={{ padding: 18, ...style }}>{children}</div>;
  }
  function TileH({ icon, children, right, color }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
        {icon && <Icon name={icon} size={15} color={color || TC.royal} />}
        <span className="tc-eyebrow" style={{ fontSize: 11, color: TC.mid, whiteSpace: "nowrap" }}>{children}</span>
        {right && <span style={{ marginLeft: "auto", flexShrink: 0 }}>{right}</span>}
      </div>
    );
  }

  function Tpl6({ report: r }) {
    const v = verdictMeta(r.verdict.decision);
    const achieved = r.brief.requirements.filter((q) => q.status === "achieved").length;

    return (
      <div style={{ background: TC.offwhite, minHeight: "100%" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "26px 24px 90px" }}>
          {/* title row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              <h1 className="tc-serif" style={{ fontSize: 24, color: TC.navy, margin: 0 }}>{r.meta.role}</h1>
              <div className="tc-meta-row" style={{ marginTop: 5 }}>
                <span><b>{r.meta.project}</b></span><span>{r.meta.take}</span><span>{r.meta.judgedAgainst} · {r.meta.scoringBasis}</span>
              </div>
            </div>
            <button onClick={() => window.print()} className="tc-btn tc-btn-ghost" style={{ fontSize: 13 }}>
              <Icon name="printer" size={15} color={TC.mid} /> Print / PDF
            </button>
          </div>

          <div className="t6grid">
            {/* SCORE tile */}
            <div className="tc-card s4" style={{ gridRow: "span 2", padding: 0, overflow: "hidden", background: `linear-gradient(150deg, ${TC.navy}, ${TC.mid})`, color: "#fff", border: "none" }}>
              <div style={{ padding: "26px 22px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <ScoreRing value={r.score.overall} size={150} stroke={12} />
                <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 999, background: "rgba(255,255,255,.13)", border: "1px solid rgba(255,255,255,.2)", fontWeight: 800, fontSize: 13 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: "#FFD27A" }} />{r.verdict.label}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)", marginTop: 10 }}>{r.score.band}</div>
                <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,.14)", margin: "18px 0" }} />
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "rgba(255,255,255,.9)", margin: 0 }}>{r.verdict.explanation}</p>
              </div>
            </div>

            {/* FIX FIRST */}
            <Tile className="s8" style={{ border: `1px solid ${TC.warningLine}`, background: TC.warningBg }}>
              <TileH icon="wrench" color={TC.warning}>Fix this first · ~{r.fixFirst.minutes} min</TileH>
              <h3 className="tc-serif" style={{ fontSize: 20, color: TC.navy, margin: "0 0 7px" }}>{r.fixFirst.title}</h3>
              <p style={{ fontSize: 14.5, color: TC.dark, margin: 0, lineHeight: 1.6 }}>{r.fixFirst.action}</p>
              <div style={{ fontSize: 13, color: TC.warning, fontWeight: 700, marginTop: 10 }}>↑ {r.fixFirst.impact}</div>
            </Tile>

            {/* CATEGORY SCORES */}
            <Tile className="s8">
              <TileH icon="list">Category scores</TileH>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "11px 26px" }}>
                {r.categories.map((c) => (
                  <div key={c.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: TC.dark, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                      <span className="tc-tnum" style={{ flexShrink: 0, fontWeight: 800, fontSize: 13, color: scoreColor(c.score) }}>{c.score}</span>
                    </div>
                    <Bar value={c.score} height={6} />
                  </div>
                ))}
              </div>
            </Tile>

            {/* BRIEF FIT */}
            <Tile className="s4">
              <TileH icon="clip" color={TC.success} right={<span className="tc-tnum" style={{ fontSize: 12, fontWeight: 700, color: TC.success }}>{achieved}/{r.brief.requirements.length}</span>}>Brief fit</TileH>
              <div style={{ display: "grid", gap: 0 }}>
                {r.brief.requirements.map((q, i) => {
                  const m = statusMeta(q.status);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderTop: i ? `1px solid ${TC.borderSoft}` : "none" }}>
                      <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, background: m.bg, border: `1px solid ${m.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon name={m.icon} size={11} stroke={2.6} color={m.color} />
                      </span>
                      <span style={{ fontSize: 12.5, color: TC.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.name}</span>
                    </div>
                  );
                })}
              </div>
            </Tile>

            {/* PRIORITY FIXES */}
            <Tile className="s8">
              <TileH icon="arrow" color={TC.danger}>What to change — priority first</TileH>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                <div>
                  {r.fixes.priority.map((x, i) => (
                    <div key={i} style={{ display: "flex", gap: 9, marginBottom: 10 }}>
                      <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 999, background: TC.dangerBg, color: TC.danger, fontWeight: 800, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{i + 1}</span>
                      <div><b style={{ fontSize: 13, color: TC.dark }}>{x.title}.</b> <span style={{ fontSize: 13, color: TC.muted }}>{x.detail}</span></div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="tc-eyebrow" style={{ color: TC.warning, marginBottom: 7 }}>If you retake</div>
                  {r.fixes.improve.map((x, i) => (
                    <div key={i} style={{ display: "flex", gap: 9, marginBottom: 8 }}>
                      <Icon name="arrow" size={13} color={TC.warning} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 13, color: TC.dark }}>{x.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Tile>

            {/* STRENGTHS */}
            <Tile className="s4">
              <TileH icon="star" color={TC.success}>Strengths</TileH>
              {r.strengths.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 9 }}>
                  <Icon name="check" size={14} color={TC.success} stroke={2.4} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div><b style={{ fontSize: 13, color: TC.dark }}>{s.title}.</b> <span style={{ fontSize: 13, color: TC.muted }}>{s.detail}</span></div>
                </div>
              ))}
              <div className="tc-eyebrow" style={{ color: TC.violet, margin: "12px 0 7px" }}>Preserve</div>
              {r.fixes.preserve.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <Icon name="sparkle" size={13} color={TC.violet} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 13, color: TC.dark }}>{s.title}</span>
                </div>
              ))}
            </Tile>

            {/* NEXT STEPS */}
            <Tile className="s8">
              <TileH icon="target" color={TC.royal}>Your next take</TileH>
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
                <ol style={{ flex: 1, minWidth: 240, margin: 0, padding: 0, listStyle: "none" }}>
                  {r.nextAction.plan.map((p, i) => (
                    <li key={i} style={{ display: "flex", gap: 10, padding: "5px 0" }}>
                      <span className="tc-tnum" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 999, border: `1.5px solid ${TC.royal}`, color: TC.royal, fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                      <span style={{ fontSize: 13.5, color: TC.dark, paddingTop: 1 }}>{p}</span>
                    </li>
                  ))}
                </ol>
                <div style={{ flexShrink: 0, minWidth: 200, padding: "12px 14px", borderRadius: 10, background: TC.royalBg, border: "1px solid #CFE0FB" }}>
                  <div className="tc-eyebrow" style={{ color: TC.royal, marginBottom: 6 }}>Submit checklist</div>
                  {r.nextAction.checklist.map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: TC.dark, marginTop: 6 }}>
                      <span style={{ flexShrink: 0, width: 14, height: 14, border: `1.5px solid ${TC.royal}`, borderRadius: 4, marginTop: 1 }} />{c}
                    </div>
                  ))}
                </div>
              </div>
            </Tile>

            {/* TIMELINE strip */}
            <Tile className="s12">
              <TileH icon="clock">Moment by moment · {r.meta.runtime} runtime</TileH>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px,1fr))", gap: "4px 26px" }}>
                {r.timeline.map((t, i) => {
                  const c = t.kind === "strength" ? TC.success : t.kind === "issue" ? TC.danger : TC.warning;
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0", alignItems: "flex-start" }}>
                      <span className="tc-tnum tc-serif" style={{ flexShrink: 0, width: 38, fontWeight: 700, fontSize: 13, color: TC.mid }}>{t.time}</span>
                      <span style={{ flexShrink: 0, width: 8, height: 8, borderRadius: 999, background: c, marginTop: 5 }} />
                      <span style={{ fontSize: 13, color: TC.dark }}>{t.text}</span>
                    </div>
                  );
                })}
              </div>
            </Tile>
          </div>

          <p style={{ fontSize: 12.5, color: TC.muted, marginTop: 16, lineHeight: 1.6 }}>
            <Icon name="shield" size={13} color={TC.muted} style={{ verticalAlign: "-2px", marginRight: 5 }} />{r.limitations.join(" ")}
          </p>
        </div>
      </div>
    );
  }

  window.TPL6 = {
    n: 6, name: "Dashboard", tag: "dashboard",
    blurb: "An at-a-glance bento grid: score, verdict, chips and cards you can scan in five seconds, then drill into.",
    Comp: Tpl6,
  };
})();
