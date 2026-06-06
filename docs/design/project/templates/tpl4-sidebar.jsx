/* Template 4 — Two-pane sidebar nav.
 * A sticky contents rail (score ring, verdict, jump-links with live mini-scores)
 * on the left; the report reads as a focused document on the right. A scrollspy
 * keeps the rail in sync. Desktop-document feel.
 */
(function () {
  const { useState, useEffect, useRef } = React;

  const NAV = [
    { id: "overview", label: "Overview", icon: "target" },
    { id: "scores", label: "Scores", icon: "list" },
    { id: "brief", label: "Brief fit", icon: "clip" },
    { id: "fixes", label: "What to change", icon: "wrench" },
    { id: "keep", label: "Keep doing this", icon: "star" },
    { id: "technique", label: "Technique", icon: "eye" },
    { id: "timeline", label: "Moment by moment", icon: "clock" },
    { id: "next", label: "Your next take", icon: "arrow" },
  ];

  function SecH({ icon, children, sub }) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Icon name={icon} size={16} color={TC.royal} />
          <h3 className="tc-serif" style={{ fontSize: 20, color: TC.navy }}>{children}</h3>
        </div>
        {sub && <p style={{ fontSize: 13.5, color: TC.muted, margin: "6px 0 0" }}>{sub}</p>}
      </div>
    );
  }

  function Tpl4({ report: r }) {
    const v = verdictMeta(r.verdict.decision);
    const [active, setActive] = useState("overview");
    const obsRef = useRef(null);

    useEffect(() => {
      const opts = { root: null, rootMargin: "-120px 0px -55% 0px", threshold: 0 };
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      }, opts);
      NAV.forEach((n) => { const el = document.getElementById("s4-" + n.id); if (el) io.observe(el); });
      obsRef.current = io;
      return () => io.disconnect();
    }, []);

    const jump = (id) => {
      const el = document.getElementById("s4-" + id);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 104, behavior: "smooth" });
    };

    return (
      <div style={{ background: TC.offwhite, minHeight: "100%" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", display: "grid", gridTemplateColumns: "256px minmax(0,1fr)", gap: 44, alignItems: "start" }}>

          {/* RAIL */}
          <aside style={{ position: "sticky", top: 104, paddingTop: 30, paddingBottom: 30, alignSelf: "start" }}>
            <div className="tc-card" style={{ padding: 18, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <ScoreRing value={r.score.overall} size={120} stroke={10} />
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999,
                  background: v.bg, border: `1px solid ${v.line}`, color: v.color, fontWeight: 800, fontSize: 12.5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: v.color }} />{r.verdict.label}
                </span>
              </div>
              <div style={{ textAlign: "center", fontSize: 12.5, color: TC.muted, lineHeight: 1.45 }}>
                <b style={{ color: TC.dark }}>{r.meta.role}</b><br />{r.meta.take} · {r.meta.judgedAgainst}
              </div>
            </div>

            <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {NAV.map((n) => {
                const on = active === n.id;
                return (
                  <button key={n.id} onClick={() => jump(n.id)} className="tc-sans"
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, cursor: "pointer",
                      border: "none", textAlign: "left", background: on ? "#fff" : "transparent", boxShadow: on ? "var(--shadow-soft)" : "none",
                      color: on ? TC.navy : TC.muted, fontWeight: on ? 700 : 600, fontSize: 13.5, transition: ".12s" }}>
                    <span style={{ flexShrink: 0, width: 3, height: 16, borderRadius: 2, background: on ? TC.royal : "transparent" }} />
                    <Icon name={n.icon} size={15} color={on ? TC.royal : TC.muted} />
                    <span style={{ whiteSpace: "nowrap" }}>{n.label}</span>
                  </button>
                );
              })}
            </nav>

            <button onClick={() => window.print()} className="tc-btn tc-btn-ghost" style={{ width: "100%", marginTop: 14, justifyContent: "center", fontSize: 13 }}>
              <Icon name="printer" size={15} color={TC.mid} /> Print / Save PDF
            </button>
          </aside>

          {/* DOCUMENT */}
          <article style={{ padding: "30px 0 100px", minWidth: 0 }}>
            {/* overview */}
            <section id="s4-overview" style={{ scrollMarginTop: 110 }}>
              <div className="tc-meta-row" style={{ marginBottom: 14 }}>
                <span><b>{r.meta.project}</b></span><span>{r.meta.scoringBasis}</span><span>Runtime {r.meta.runtime}</span>
              </div>
              <h1 className="tc-serif" style={{ fontSize: 34, lineHeight: 1.15, color: TC.navy, letterSpacing: "-.02em", textWrap: "balance", margin: 0 }}>{r.verdict.headline}</h1>
              <p style={{ fontSize: 16.5, color: TC.muted, lineHeight: 1.65, marginTop: 14 }}>{r.verdict.explanation}</p>

              <div style={{ marginTop: 22, padding: "20px 22px", borderRadius: 14, border: `1px solid ${TC.warningLine}`, background: TC.warningBg, display: "flex", gap: 15 }}>
                <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 10, background: "#fff", border: `1px solid ${TC.warningLine}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="wrench" size={19} color={TC.warning} />
                </div>
                <div>
                  <div className="tc-eyebrow" style={{ color: TC.warning }}>Fix this first · ~{r.fixFirst.minutes} min</div>
                  <h4 className="tc-serif" style={{ fontSize: 18, color: TC.navy, margin: "4px 0 6px" }}>{r.fixFirst.title}</h4>
                  <p style={{ fontSize: 14, color: TC.dark, margin: 0, lineHeight: 1.6 }}>{r.fixFirst.action}</p>
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <div className="tc-eyebrow" style={{ marginBottom: 10 }}>Why this verdict</div>
                {r.verdict.rationale.map((x, i) => (
                  <div key={i} style={{ display: "flex", gap: 11, padding: "7px 0" }}>
                    <span style={{ flexShrink: 0, width: 21, height: 21, borderRadius: 6, background: TC.royalBg, color: TC.royal, fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{i + 1}</span>
                    <span><b style={{ fontSize: 14.5, color: TC.dark }}>{x.title}.</b> <span style={{ fontSize: 14.5, color: TC.muted }}>{x.detail}</span></span>
                  </div>
                ))}
              </div>
            </section>

            <hr className="tc-divider" style={{ margin: "34px 0" }} />

            {/* scores */}
            <section id="s4-scores" style={{ scrollMarginTop: 110 }}>
              <SecH icon="list" sub="Judged at Professional level. Each line shows where the points are.">How it scores</SecH>
              <div style={{ display: "grid", gap: 16 }}>
                {r.categories.map((c) => (
                  <div key={c.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: TC.dark }}>{c.label}</span>
                      <span className="tc-tnum" style={{ flexShrink: 0, fontWeight: 800, fontSize: 15, color: scoreColor(c.score) }}>{c.score}</span>
                    </div>
                    <Bar value={c.score} />
                    <p style={{ fontSize: 13, color: TC.muted, margin: "7px 0 0" }}>{c.note}</p>
                  </div>
                ))}
              </div>
            </section>

            <hr className="tc-divider" style={{ margin: "34px 0" }} />

            {/* brief */}
            <section id="s4-brief" style={{ scrollMarginTop: 110 }}>
              <SecH icon="clip" sub={r.brief.summary}>Brief fit</SecH>
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
            </section>

            <hr className="tc-divider" style={{ margin: "34px 0" }} />

            {/* fixes */}
            <section id="s4-fixes" style={{ scrollMarginTop: 110 }}>
              <SecH icon="wrench" sub="Ordered by how much they move submission readiness.">What to change</SecH>
              <div className="tc-eyebrow" style={{ color: TC.danger, marginBottom: 8 }}>Priority</div>
              {r.fixes.priority.map((x, i) => (
                <div key={i} style={{ display: "flex", gap: 11, padding: "9px 0", borderBottom: `1px solid ${TC.borderSoft}` }}>
                  <Icon name="arrow" size={16} color={TC.danger} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div><b style={{ fontSize: 15, color: TC.dark }}>{x.title}.</b> <span style={{ fontSize: 15, color: TC.muted }}>{x.detail}</span></div>
                </div>
              ))}
              <div className="tc-eyebrow" style={{ color: TC.warning, margin: "16px 0 8px" }}>Worth improving if you retake</div>
              {r.fixes.improve.map((x, i) => (
                <div key={i} style={{ display: "flex", gap: 11, padding: "9px 0", borderBottom: i < r.fixes.improve.length - 1 ? `1px solid ${TC.borderSoft}` : "none" }}>
                  <Icon name="arrow" size={16} color={TC.warning} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div><b style={{ fontSize: 15, color: TC.dark }}>{x.title}.</b> <span style={{ fontSize: 15, color: TC.muted }}>{x.detail}</span></div>
                </div>
              ))}
            </section>

            <hr className="tc-divider" style={{ margin: "34px 0" }} />

            {/* keep */}
            <section id="s4-keep" style={{ scrollMarginTop: 110 }}>
              <SecH icon="star" sub="The choices that are already working — protect them.">Keep doing this</SecH>
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
                    <div key={i} style={{ display: "flex", gap: 9, marginBottom: i < r.fixes.preserve.length - 1 ? 11 : 0 }}>
                      <Icon name="sparkle" size={15} color={TC.violet} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div><b style={{ fontSize: 13.5, color: TC.dark }}>{s.title}.</b> <span style={{ fontSize: 13.5, color: TC.muted }}>{s.detail}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <hr className="tc-divider" style={{ margin: "34px 0" }} />

            {/* technique */}
            <section id="s4-technique" style={{ scrollMarginTop: 110 }}>
              <SecH icon="eye" sub={r.technique.summary}>Technique</SecH>
              {r.technique.sections.map((s, i) => (
                <div key={i} style={{ marginBottom: 18 }}>
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
            </section>

            <hr className="tc-divider" style={{ margin: "34px 0" }} />

            {/* timeline */}
            <section id="s4-timeline" style={{ scrollMarginTop: 110 }}>
              <SecH icon="clock" sub="Where the tape supports an exact moment.">Moment by moment</SecH>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {r.timeline.map((t, i) => {
                  const c = t.kind === "strength" ? TC.success : t.kind === "issue" ? TC.danger : TC.warning;
                  return (
                    <li key={i} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: i < r.timeline.length - 1 ? `1px solid ${TC.borderSoft}` : "none" }}>
                      <span className="tc-tnum tc-serif" style={{ flexShrink: 0, width: 44, fontWeight: 700, fontSize: 14, color: TC.mid }}>{t.time}</span>
                      <span style={{ flexShrink: 0, width: 9, height: 9, borderRadius: 999, background: c, marginTop: 6 }} />
                      <span style={{ fontSize: 14.5, color: TC.dark }}>{t.text}</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <hr className="tc-divider" style={{ margin: "34px 0" }} />

            {/* next */}
            <section id="s4-next" style={{ scrollMarginTop: 110 }}>
              <SecH icon="arrow" sub="A finite plan for your next take.">Your next take</SecH>
              <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {r.nextAction.plan.map((p, i) => (
                  <li key={i} style={{ display: "flex", gap: 12, padding: "9px 0" }}>
                    <span className="tc-tnum" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 999, border: `1.5px solid ${TC.royal}`, color: TC.royal, fontWeight: 800, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                    <span style={{ fontSize: 15, color: TC.dark, paddingTop: 1 }}>{p}</span>
                  </li>
                ))}
              </ol>
              <div style={{ marginTop: 14, padding: "13px 16px", borderRadius: 10, background: TC.royalBg, border: "1px solid #CFE0FB", fontSize: 14, color: TC.mid, display: "flex", gap: 10 }}>
                <Icon name="clock" size={16} color={TC.royal} style={{ flexShrink: 0, marginTop: 2 }} />
                <span><b>On a tight deadline?</b> {r.nextAction.ifShort}</span>
              </div>
              <p style={{ fontSize: 12.5, color: TC.muted, marginTop: 18, lineHeight: 1.6 }}>
                <Icon name="shield" size={13} color={TC.muted} style={{ verticalAlign: "-2px", marginRight: 5 }} />{r.limitations.join(" ")}
              </p>
            </section>
          </article>
        </div>
      </div>
    );
  }

  window.TPL4 = {
    n: 4, name: "Sidebar nav", tag: "sidebar",
    blurb: "A sticky contents rail with the score and verdict; the report reads as a focused document on the right.",
    Comp: Tpl4,
  };
})();
