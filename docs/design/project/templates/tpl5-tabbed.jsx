/* Template 5 — Tabbed.
 * A persistent header (score + verdict + headline) and four tabs:
 * Overview · Brief & tape · Performance · Next steps. Only one slice of the
 * report is visible at a time, so nothing competes for attention.
 */
(function () {
  const { useState } = React;

  const TABS = [
    { id: "overview", label: "Overview", icon: "target" },
    { id: "brief", label: "Brief & tape", icon: "clip" },
    { id: "performance", label: "Performance", icon: "star" },
    { id: "next", label: "Next steps", icon: "arrow" },
  ];

  function Block({ icon, title, sub, children, color }) {
    return (
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: sub ? 4 : 12 }}>
          {icon && <Icon name={icon} size={16} color={color || TC.royal} />}
          <h3 className="tc-serif" style={{ fontSize: 18, color: TC.navy }}>{title}</h3>
        </div>
        {sub && <p style={{ fontSize: 13.5, color: TC.muted, margin: "0 0 12px" }}>{sub}</p>}
        {children}
      </div>
    );
  }

  function Tpl5({ report: r, print }) {
    const v = verdictMeta(r.verdict.decision);
    const [tab, setTab] = useState("overview");

    return (
      <div style={{ background: TC.offwhite, minHeight: "100%" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "30px 24px 90px" }}>

          {/* PERSISTENT HEADER */}
          <div className="tc-card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "24px 26px 22px", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <ScoreRing value={r.score.overall} size={116} stroke={10} />
              <div style={{ flex: 1, minWidth: 280 }}>
                <div className="tc-meta-row" style={{ marginBottom: 9 }}>
                  <span><b>{r.meta.project}</b></span><span>{r.meta.role}</span><span>{r.meta.take} · {r.meta.judgedAgainst}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, background: v.bg, border: `1px solid ${v.line}`, color: v.color, fontWeight: 800, fontSize: 12.5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: v.color }} />{r.verdict.label}
                  </span>
                  <span style={{ fontSize: 12.5, color: TC.muted }}>{r.score.band}</span>
                </div>
                <h1 className="tc-serif" style={{ fontSize: 24, lineHeight: 1.22, color: TC.navy, margin: 0, letterSpacing: "-.015em", textWrap: "balance" }}>{r.verdict.headline}</h1>
              </div>
            </div>
            {/* TAB BAR */}
            {!print && (
            <div style={{ display: "flex", borderTop: `1px solid ${TC.borderSoft}`, background: TC.offwhite, overflowX: "auto" }} className="tc-scroll">
              {TABS.map((t) => {
                const on = tab === t.id;
                return (
                  <button key={t.id} onClick={() => setTab(t.id)} className="tc-sans"
                    style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 16px",
                      border: "none", borderBottom: `3px solid ${on ? TC.royal : "transparent"}`, background: on ? "#fff" : "transparent",
                      color: on ? TC.navy : TC.muted, fontWeight: on ? 700 : 600, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", transition: ".12s" }}>
                    <Icon name={t.icon} size={15} color={on ? TC.royal : TC.muted} />{t.label}
                  </button>
                );
              })}
            </div>
            )}
          </div>

          {/* TAB PANELS */}
          <div className="tc-card" style={{ padding: "26px 28px" }}>
            {(print || tab === "overview") && (
              <div>
                <p style={{ fontSize: 16, color: TC.dark, lineHeight: 1.65, margin: "0 0 22px" }}>{r.verdict.explanation}</p>
                <div style={{ padding: "20px 22px", borderRadius: 14, border: `1px solid ${TC.warningLine}`, background: TC.warningBg, display: "flex", gap: 15, marginBottom: 26 }}>
                  <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 10, background: "#fff", border: `1px solid ${TC.warningLine}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="wrench" size={19} color={TC.warning} />
                  </div>
                  <div>
                    <div className="tc-eyebrow" style={{ color: TC.warning }}>Fix this first · ~{r.fixFirst.minutes} min</div>
                    <h4 className="tc-serif" style={{ fontSize: 18, color: TC.navy, margin: "4px 0 6px" }}>{r.fixFirst.title}</h4>
                    <p style={{ fontSize: 14, color: TC.dark, margin: 0, lineHeight: 1.6 }}>{r.fixFirst.action}</p>
                  </div>
                </div>
                <Block icon="list" title="Why this verdict">
                  {r.verdict.rationale.map((x, i) => (
                    <div key={i} style={{ display: "flex", gap: 11, padding: "7px 0" }}>
                      <span style={{ flexShrink: 0, width: 21, height: 21, borderRadius: 6, background: TC.royalBg, color: TC.royal, fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{i + 1}</span>
                      <span><b style={{ fontSize: 14.5, color: TC.dark }}>{x.title}.</b> <span style={{ fontSize: 14.5, color: TC.muted }}>{x.detail}</span></span>
                    </div>
                  ))}
                </Block>
                <Block icon="target" title="How it scores" sub="Judged at Professional level.">
                  <div style={{ display: "grid", gap: 15 }}>
                    {r.categories.map((c) => (
                      <div key={c.key}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 5 }}>
                          <span style={{ fontWeight: 600, fontSize: 14.5, color: TC.dark }}>{c.label}</span>
                          <span className="tc-tnum" style={{ flexShrink: 0, fontWeight: 800, fontSize: 14.5, color: scoreColor(c.score) }}>{c.score}</span>
                        </div>
                        <Bar value={c.score} />
                        <p style={{ fontSize: 12.5, color: TC.muted, margin: "6px 0 0" }}>{c.note}</p>
                      </div>
                    ))}
                  </div>
                </Block>
              </div>
            )}

            {(print || tab === "brief") && (
              <div>
                <Block icon="clip" title="Brief fit" sub={r.brief.summary} color={TC.success}>
                  <div style={{ border: `1px solid ${TC.border}`, borderRadius: 12, overflow: "hidden" }}>
                    {r.brief.requirements.map((q, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "13px 16px", borderTop: i ? `1px solid ${TC.borderSoft}` : "none" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14.5, color: TC.dark }}>{q.name}</div>
                          <div style={{ fontSize: 12.5, color: TC.muted, marginTop: 2 }}>{q.category} · {q.importance} — {q.evidence}</div>
                        </div>
                        <span style={{ flexShrink: 0 }}><StatusChip status={q.status} small /></span>
                      </div>
                    ))}
                  </div>
                </Block>
                <Block icon="film" title="What we saw in the tape" sub="The observed sequence, kept separate from what the brief requested." color={TC.mid}>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {r.observed.map((o, i) => (
                      <li key={i} style={{ display: "flex", gap: 14, padding: "11px 0", borderBottom: i < r.observed.length - 1 ? `1px solid ${TC.borderSoft}` : "none" }}>
                        <span className="tc-tnum tc-serif" style={{ flexShrink: 0, width: 84, fontWeight: 700, fontSize: 13.5, color: TC.mid }}>{o.time}</span>
                        <div><div style={{ fontWeight: 600, fontSize: 14.5, color: TC.dark }}>{o.label}</div><div style={{ fontSize: 13, color: TC.muted, marginTop: 1 }}>{o.note}</div></div>
                      </li>
                    ))}
                  </ul>
                </Block>
              </div>
            )}

            {(print || tab === "performance") && (
              <div>
                <Block icon="star" title="Strengths & preserve" sub="What's working — and what not to lose in a retake." color={TC.violet}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div style={{ border: `1px solid ${TC.successLine}`, background: TC.successBg, borderRadius: 12, padding: "16px 18px" }}>
                      <div className="tc-eyebrow" style={{ color: TC.success, marginBottom: 10 }}>Strengths</div>
                      {r.strengths.map((s, i) => (
                        <div key={i} style={{ display: "flex", gap: 9, marginBottom: i < r.strengths.length - 1 ? 11 : 0 }}>
                          <Icon name="check" size={16} color={TC.success} stroke={2.4} style={{ flexShrink: 0, marginTop: 2 }} />
                          <div><b style={{ fontSize: 13.5, color: TC.dark }}>{s.title}.</b> <span style={{ fontSize: 13.5, color: TC.muted }}>{s.detail}</span></div>
                        </div>
                      ))}
                    </div>
                    <div style={{ border: `1px solid ${TC.border}`, borderRadius: 12, padding: "16px 18px" }}>
                      <div className="tc-eyebrow" style={{ color: TC.violet, marginBottom: 10 }}>Preserve</div>
                      {r.fixes.preserve.map((s, i) => (
                        <div key={i} style={{ display: "flex", gap: 9, marginBottom: 11 }}>
                          <Icon name="sparkle" size={15} color={TC.violet} style={{ flexShrink: 0, marginTop: 2 }} />
                          <div><b style={{ fontSize: 13.5, color: TC.dark }}>{s.title}.</b> <span style={{ fontSize: 13.5, color: TC.muted }}>{s.detail}</span></div>
                        </div>
                      ))}
                      {r.fixes.doNotOverfix.map((s, i) => (
                        <div key={"d" + i} style={{ display: "flex", gap: 9 }}>
                          <Icon name="alert" size={14} color={TC.muted} style={{ flexShrink: 0, marginTop: 2 }} />
                          <div><b style={{ fontSize: 13.5, color: TC.dark }}>{s.title}.</b> <span style={{ fontSize: 13.5, color: TC.muted }}>{s.detail}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Block>
                <Block icon="eye" title="Technique" sub={r.technique.summary}>
                  {r.technique.sections.map((s, i) => (
                    <div key={i} style={{ marginBottom: 16, paddingBottom: i < r.technique.sections.length - 1 ? 16 : 0, borderBottom: i < r.technique.sections.length - 1 ? `1px solid ${TC.borderSoft}` : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <h4 className="tc-serif" style={{ fontSize: 16, color: TC.navy }}>{s.area}</h4>
                        <span className="tc-chip" style={{ fontSize: 11, padding: "2px 8px" }}>{s.status}</span>
                      </div>
                      <p style={{ fontSize: 14, color: TC.muted, margin: "5px 0 9px" }}>{s.headline}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <div><div className="tc-eyebrow" style={{ color: TC.success, marginBottom: 6 }}>Working</div>{s.working.map((w, j) => <div key={j} style={{ fontSize: 13.5, color: TC.dark, display: "flex", gap: 7, marginBottom: 5 }}><Icon name="check" size={14} color={TC.success} stroke={2.4} style={{ flexShrink: 0, marginTop: 2 }} />{w}</div>)}</div>
                        <div><div className="tc-eyebrow" style={{ color: TC.warning, marginBottom: 6 }}>Improve</div>{s.improve.map((w, j) => <div key={j} style={{ fontSize: 13.5, color: TC.dark, display: "flex", gap: 7, marginBottom: 5 }}><Icon name="arrow" size={14} color={TC.warning} style={{ flexShrink: 0, marginTop: 2 }} />{w}</div>)}</div>
                      </div>
                    </div>
                  ))}
                </Block>
                <Block icon="clock" title="Moment by moment">
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {r.timeline.map((t, i) => {
                      const c = t.kind === "strength" ? TC.success : t.kind === "issue" ? TC.danger : TC.warning;
                      return (
                        <li key={i} style={{ display: "flex", gap: 14, padding: "9px 0", borderBottom: i < r.timeline.length - 1 ? `1px solid ${TC.borderSoft}` : "none" }}>
                          <span className="tc-tnum tc-serif" style={{ flexShrink: 0, width: 44, fontWeight: 700, fontSize: 14, color: TC.mid }}>{t.time}</span>
                          <span style={{ flexShrink: 0, width: 9, height: 9, borderRadius: 999, background: c, marginTop: 6 }} />
                          <span style={{ fontSize: 14.5, color: TC.dark }}>{t.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Block>
              </div>
            )}

            {(print || tab === "next") && (
              <div>
                <Block icon="wrench" title="What to change" sub="Ordered by submission impact." color={TC.danger}>
                  <div className="tc-eyebrow" style={{ color: TC.danger, marginBottom: 8 }}>Priority</div>
                  {r.fixes.priority.map((x, i) => (
                    <div key={i} style={{ display: "flex", gap: 11, padding: "9px 0", borderBottom: `1px solid ${TC.borderSoft}` }}>
                      <Icon name="arrow" size={16} color={TC.danger} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div><b style={{ fontSize: 15, color: TC.dark }}>{x.title}.</b> <span style={{ fontSize: 15, color: TC.muted }}>{x.detail}</span></div>
                    </div>
                  ))}
                  <div className="tc-eyebrow" style={{ color: TC.warning, margin: "16px 0 8px" }}>If you retake</div>
                  {r.fixes.improve.map((x, i) => (
                    <div key={i} style={{ display: "flex", gap: 11, padding: "9px 0", borderBottom: i < r.fixes.improve.length - 1 ? `1px solid ${TC.borderSoft}` : "none" }}>
                      <Icon name="arrow" size={16} color={TC.warning} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div><b style={{ fontSize: 15, color: TC.dark }}>{x.title}.</b> <span style={{ fontSize: 15, color: TC.muted }}>{x.detail}</span></div>
                    </div>
                  ))}
                </Block>
                <Block icon="arrow" title="Your next take" sub="A finite plan.">
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                    <ol style={{ flex: 1, minWidth: 280, margin: 0, padding: 0, listStyle: "none" }}>
                      {r.nextAction.plan.map((p, i) => (
                        <li key={i} style={{ display: "flex", gap: 12, padding: "8px 0" }}>
                          <span className="tc-tnum" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 999, border: `1.5px solid ${TC.royal}`, color: TC.royal, fontWeight: 800, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                          <span style={{ fontSize: 15, color: TC.dark, paddingTop: 1 }}>{p}</span>
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
                  <div style={{ marginTop: 16, padding: "13px 16px", borderRadius: 10, background: TC.lightgrey, fontSize: 14, color: TC.mid, display: "flex", gap: 10 }}>
                    <Icon name="clock" size={16} color={TC.mid} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span><b>On a tight deadline?</b> {r.nextAction.ifShort}</span>
                  </div>
                </Block>
                <p style={{ fontSize: 12.5, color: TC.muted, lineHeight: 1.6, margin: 0 }}>
                  <Icon name="shield" size={13} color={TC.muted} style={{ verticalAlign: "-2px", marginRight: 5 }} />{r.limitations.join(" ")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  window.TPL5 = {
    n: 5, name: "Tabbed", tag: "tabbed",
    blurb: "Four tabs — Overview, Brief & tape, Performance, Next steps — so nothing competes for attention at once.",
    Comp: Tpl5,
  };
})();
