/* Template 2 — Collapsible summary bars.
 * A compact header, then every section is a one-line summary row with a status
 * accent. Tap a row to expand its detail. Solves the wall-of-text directly:
 * the report is fully skimmable closed, fully detailed open.
 */
(function () {
  const { useState } = React;

  function Row({ icon, accent, title, summary, status, open, onToggle, children, count }) {
    return (
      <div style={{ borderBottom: `1px solid ${TC.borderSoft}` }}>
        <button onClick={onToggle} className="tc-sans"
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: open ? TC.offwhite : "#fff",
            border: "none", cursor: "pointer", textAlign: "left", transition: "background .12s" }}>
          <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 10, background: accent.bg, border: `1px solid ${accent.line || TC.border}`,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={icon} size={18} color={accent.color} />
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span className="tc-serif" style={{ fontSize: 16.5, fontWeight: 700, color: TC.navy, whiteSpace: "nowrap", lineHeight: 1.25 }}>{title}</span>
              {count != null && <span className="tc-tnum" style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: TC.muted, background: TC.lightgrey, borderRadius: 999, padding: "1px 8px" }}>{count}</span>}
            </span>
            <span style={{ display: "block", fontSize: 13.5, color: TC.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: open ? "normal" : "nowrap" }}>{summary}</span>
          </span>
          {status && <span style={{ flexShrink: 0 }}><StatusChip status={status} small /></span>}
          <Icon name="chevron" size={18} color={TC.muted} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
        </button>
        {open && <div style={{ padding: "4px 20px 22px 72px" }}>{children}</div>}
      </div>
    );
  }

  function MiniList({ items, marker, color }) {
    return (
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((x, i) => (
          <li key={i} style={{ display: "flex", gap: 10, padding: "7px 0" }}>
            <span style={{ flexShrink: 0, marginTop: 1, color }}>{marker}</span>
            <span><b style={{ fontSize: 14, color: TC.dark }}>{x.title}.</b>{x.detail ? <span style={{ fontSize: 14, color: TC.muted }}> {x.detail}</span> : null}</span>
          </li>
        ))}
      </ul>
    );
  }

  function Tpl2({ report: r, print }) {
    const v = verdictMeta(r.verdict.decision);
    const keys = ["verdict", "fix", "scores", "brief", "changes", "keep", "technique", "timeline", "next", "limits"];
    const allKeys = Object.fromEntries(keys.map((k) => [k, true]));
    const [open, setOpen] = useState(print ? allKeys : { verdict: true, fix: true });
    const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
    const [allOpen, setAllOpen] = useState(!!print);
    const expandAll = () => { const next = !allOpen; setAllOpen(next); const m = {}; keys.forEach((k) => (m[k] = next)); setOpen(m); };

    const A = {
      warn: { color: TC.warning, bg: TC.warningBg, line: TC.warningLine },
      royal: { color: TC.royal, bg: TC.royalBg, line: "#CFE0FB" },
      green: { color: TC.success, bg: TC.successBg, line: TC.successLine },
      danger: { color: TC.danger, bg: TC.dangerBg, line: TC.dangerLine },
      violet: { color: TC.violet, bg: TC.violetBg, line: "#E0D6FF" },
      grey: { color: TC.muted, bg: TC.lightgrey, line: TC.border },
    };

    return (
      <div style={{ background: TC.offwhite, minHeight: "100%" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "34px 24px 90px" }}>
          {/* compact header */}
          <div className="tc-card" style={{ padding: "22px 24px", marginBottom: 18, display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
            <ScoreRing value={r.score.overall} size={108} stroke={9} />
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999,
                  background: v.bg, border: `1px solid ${v.line}`, color: v.color, fontWeight: 800, fontSize: 12.5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: v.color }} />{r.verdict.label}
                </span>
                <span style={{ fontSize: 12.5, color: TC.muted }}>{r.score.band}</span>
              </div>
              <h2 className="tc-serif" style={{ fontSize: 22, color: TC.navy, margin: "10px 0 0", lineHeight: 1.25 }}>{r.verdict.headline}</h2>
              <div className="tc-meta-row" style={{ marginTop: 10 }}>
                <span><b>{r.meta.project}</b> · {r.meta.role}</span>
                <span>{r.meta.take}</span>
                <span>{r.meta.judgedAgainst}</span>
              </div>
            </div>
          </div>

          {/* expand-all control */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px 10px", gap: 12 }}>
            <span className="tc-eyebrow" style={{ whiteSpace: "nowrap" }}>Tap any row for detail</span>
            <button onClick={expandAll} className="tc-sans"
              style={{ flexShrink: 0, border: "none", background: "transparent", color: TC.royal, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <Icon name={allOpen ? "chevron" : "list"} size={14} color={TC.royal} />{allOpen ? "Collapse all" : "Expand all"}
            </button>
          </div>

          {/* the accordion */}
          <div className="tc-card" style={{ overflow: "hidden", padding: 0 }}>
            <Row icon="target" accent={A.warn} title="The verdict" status={null} summary={r.verdict.short + " — review before sending."} open={!!open.verdict} onToggle={() => toggle("verdict")}>
              <p style={{ fontSize: 15, color: TC.dark, margin: "0 0 14px", lineHeight: 1.6 }}>{r.verdict.explanation}</p>
              {r.verdict.rationale.map((x, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0" }}>
                  <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 6, background: TC.royalBg, color: TC.royal, fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{i + 1}</span>
                  <span><b style={{ fontSize: 14, color: TC.dark }}>{x.title}.</b> <span style={{ fontSize: 14, color: TC.muted }}>{x.detail}</span></span>
                </div>
              ))}
            </Row>

            <Row icon="wrench" accent={A.warn} title="Fix this first" summary={r.fixFirst.title + ` · ~${r.fixFirst.minutes} min`} open={!!open.fix} onToggle={() => toggle("fix")}>
              <p style={{ fontSize: 15, color: TC.dark, margin: 0, lineHeight: 1.6 }}>{r.fixFirst.action}</p>
              <div style={{ fontSize: 13, color: TC.warning, fontWeight: 600, marginTop: 8 }}>↑ {r.fixFirst.impact}</div>
            </Row>

            <Row icon="list" accent={A.royal} title="How it scores" summary={`Overall ${r.score.overall}. Acting ${r.categories[0].score}, audio ${r.categories[4].score}.`} open={!!open.scores} onToggle={() => toggle("scores")}>
              <div style={{ display: "grid", gap: 13 }}>
                {r.categories.map((c) => (
                  <div key={c.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: TC.dark }}>{c.label}</span>
                      <span className="tc-tnum" style={{ fontWeight: 800, fontSize: 14, color: scoreColor(c.score) }}>{c.score}</span>
                    </div>
                    <Bar value={c.score} height={7} />
                  </div>
                ))}
              </div>
            </Row>

            <Row icon="clip" accent={A.green} title="Brief fit" count={`${r.brief.requirements.filter((q) => q.status === "achieved").length}/${r.brief.requirements.length}`}
              summary={r.brief.summary} open={!!open.brief} onToggle={() => toggle("brief")}>
              <div style={{ display: "grid", gap: 0 }}>
                {r.brief.requirements.map((q, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 0", borderTop: i ? `1px solid ${TC.borderSoft}` : "none" }}>
                    <div><div style={{ fontWeight: 600, fontSize: 14, color: TC.dark }}>{q.name}</div><div style={{ fontSize: 12.5, color: TC.muted, marginTop: 1 }}>{q.evidence}</div></div>
                    <StatusChip status={q.status} small />
                  </div>
                ))}
              </div>
            </Row>

            <Row icon="arrow" accent={A.danger} title="What to change" count={r.fixes.priority.length + r.fixes.improve.length}
              summary={r.fixes.priority.map((x) => x.title).join("; ") + "…"} open={!!open.changes} onToggle={() => toggle("changes")}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: TC.danger, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".08em" }}>Priority</div>
              <MiniList items={r.fixes.priority} marker={<Icon name="arrow" size={15} color={TC.danger} />} color={TC.danger} />
              <div style={{ fontWeight: 700, fontSize: 12.5, color: TC.warning, margin: "12px 0 4px", textTransform: "uppercase", letterSpacing: ".08em" }}>If you retake</div>
              <MiniList items={r.fixes.improve} marker={<Icon name="arrow" size={15} color={TC.warning} />} color={TC.warning} />
            </Row>

            <Row icon="star" accent={A.green} title="Keep doing this" count={r.strengths.length + r.fixes.preserve.length}
              summary={r.strengths.map((s) => s.title).join("; ")} open={!!open.keep} onToggle={() => toggle("keep")}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: TC.success, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".08em" }}>Strengths</div>
              <MiniList items={r.strengths} marker={<Icon name="check" size={15} color={TC.success} stroke={2.4} />} color={TC.success} />
              <div style={{ fontWeight: 700, fontSize: 12.5, color: TC.violet, margin: "12px 0 4px", textTransform: "uppercase", letterSpacing: ".08em" }}>Preserve</div>
              <MiniList items={r.fixes.preserve} marker={<Icon name="sparkle" size={14} color={TC.violet} />} color={TC.violet} />
            </Row>

            <Row icon="eye" accent={A.violet} title="Technique" summary={r.technique.sections.map((s) => s.area).join(" · ")} open={!!open.technique} onToggle={() => toggle("technique")}>
              {r.technique.sections.map((s, i) => (
                <div key={i} style={{ marginBottom: i < r.technique.sections.length - 1 ? 16 : 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: TC.dark }}>{s.area}</div>
                  <div style={{ fontSize: 13.5, color: TC.muted, margin: "2px 0 8px" }}>{s.headline}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><div className="tc-eyebrow" style={{ color: TC.success, marginBottom: 5 }}>Working</div>{s.working.map((w, j) => <div key={j} style={{ fontSize: 13, color: TC.dark, display: "flex", gap: 7, marginBottom: 4 }}><Icon name="check" size={13} color={TC.success} stroke={2.4} style={{ flexShrink: 0, marginTop: 2 }} />{w}</div>)}</div>
                    <div><div className="tc-eyebrow" style={{ color: TC.warning, marginBottom: 5 }}>Improve</div>{s.improve.map((w, j) => <div key={j} style={{ fontSize: 13, color: TC.dark, display: "flex", gap: 7, marginBottom: 4 }}><Icon name="arrow" size={13} color={TC.warning} style={{ flexShrink: 0, marginTop: 2 }} />{w}</div>)}</div>
                  </div>
                </div>
              ))}
            </Row>

            <Row icon="clock" accent={A.royal} title="Moment by moment" count={r.timeline.length} summary={`${r.timeline.length} timestamped notes across the take.`} open={!!open.timeline} onToggle={() => toggle("timeline")}>
              {r.timeline.map((t, i) => {
                const c = t.kind === "strength" ? TC.success : t.kind === "issue" ? TC.danger : TC.warning;
                return (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "7px 0", borderBottom: i < r.timeline.length - 1 ? `1px solid ${TC.borderSoft}` : "none" }}>
                    <span className="tc-tnum tc-serif" style={{ flexShrink: 0, width: 42, fontWeight: 700, fontSize: 13.5, color: TC.mid }}>{t.time}</span>
                    <span style={{ flexShrink: 0, width: 8, height: 8, borderRadius: 999, background: c, marginTop: 6 }} />
                    <span style={{ fontSize: 14, color: TC.dark }}>{t.text}</span>
                  </div>
                );
              })}
            </Row>

            <Row icon="arrow" accent={A.royal} title="Your next take" count={r.nextAction.plan.length} summary={r.nextAction.plan[0]} open={!!open.next} onToggle={() => toggle("next")}>
              <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {r.nextAction.plan.map((p, i) => (
                  <li key={i} style={{ display: "flex", gap: 11, padding: "6px 0" }}>
                    <span className="tc-tnum" style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 999, border: `1.5px solid ${TC.royal}`, color: TC.royal, fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                    <span style={{ fontSize: 14.5, color: TC.dark, paddingTop: 1 }}>{p}</span>
                  </li>
                ))}
              </ol>
            </Row>

            <Row icon="shield" accent={A.grey} title="What we couldn't fully assess" summary={r.limitations[0]} open={!!open.limits} onToggle={() => toggle("limits")}>
              <ul style={{ margin: 0, paddingLeft: 18, color: TC.muted, fontSize: 13.5 }}>{r.limitations.map((l, i) => <li key={i} style={{ marginBottom: 5 }}>{l}</li>)}</ul>
            </Row>
          </div>
        </div>
      </div>
    );
  }

  window.TPL2 = {
    n: 2, name: "Collapsible", tag: "collapsible",
    blurb: "Every section is a one-line summary bar with a status — tap to expand the detail you actually want.",
    Comp: Tpl2,
  };
})();
