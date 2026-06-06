/* App shell: sticky template switcher + the selected report template.
 * Each template registers itself on window as TPL1..TPL6 with { n, name, tag, blurb, Comp }.
 */
const { useState, useEffect } = React;

function TemplateSwitcher() {
  const templates = [window.TPL1, window.TPL2, window.TPL3, window.TPL4, window.TPL5, window.TPL6].filter(Boolean);
  const [active, setActive] = useState(() => {
    const v = parseInt(localStorage.getItem("tc-active-tpl") || "0", 10);
    return Number.isFinite(v) && v >= 0 && v < templates.length ? v : 0;
  });
  useEffect(() => { localStorage.setItem("tc-active-tpl", String(active)); }, [active]);

  const cur = templates[active];
  const Comp = cur && cur.Comp;

  return (
    <div className="tc-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#EEF1F5" }}>
      {/* switcher bar */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,.86)", backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${TC.border}`, boxShadow: "0 1px 0 rgba(9,30,66,.04)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "10px 22px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Logo height={24} />
            <span style={{ width: 1, height: 22, background: TC.border }} />
            <span style={{ fontSize: 12.5, color: TC.muted, fontWeight: 600, whiteSpace: "nowrap" }}>
              Report view · <span style={{ color: TC.dark }}>6 directions</span>
            </span>
          </div>
          <nav className="tc-scroll" style={{ display: "flex", gap: 7, overflowX: "auto", flex: 1, padding: "2px 0", marginLeft: "auto" }}>
            {templates.map((t, i) => {
              const on = i === active;
              return (
                <button key={t.n} onClick={() => setActive(i)}
                  style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, cursor: "pointer",
                    fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, padding: "7px 13px 7px 9px", borderRadius: 9,
                    border: `1px solid ${on ? TC.royal : TC.border}`, background: on ? TC.royal : "#fff",
                    color: on ? "#fff" : TC.mid, transition: ".15s", whiteSpace: "nowrap" }}>
                  <span className="tc-tnum" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 19, height: 19, borderRadius: 6, fontSize: 11, fontWeight: 800,
                    background: on ? "rgba(255,255,255,.22)" : TC.lightgrey, color: on ? "#fff" : TC.muted }}>{t.n}</span>
                  {t.name}
                </button>
              );
            })}
          </nav>
        </div>
        {/* direction caption */}
        {cur && (
          <div style={{ borderTop: `1px solid ${TC.borderSoft}`, background: "rgba(248,249,251,.7)" }}>
            <div style={{ maxWidth: 1240, margin: "0 auto", padding: "7px 22px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="tc-chip" style={{ borderColor: TC.royalBg, background: TC.royalBg, color: TC.royal }}>
                <Icon name="sparkle" size={12} color={TC.royal} /> Direction {cur.n}
              </span>
              <span style={{ fontSize: 13, color: TC.muted }}>
                <b style={{ color: TC.dark, fontWeight: 700 }}>{cur.name}.</b> {cur.blurb}
              </span>
            </div>
          </div>
        )}
      </header>

      {/* the report */}
      <main style={{ flex: 1 }}>
        {Comp ? <Comp key={cur.n} report={window.REPORT} /> : <div style={{ padding: 60 }}>Loading…</div>}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<TemplateSwitcher />);
