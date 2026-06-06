/* Print app — renders all six report-view directions stacked, each starting on
 * a new page with a label band. Interactive templates are forced to their full
 * static state via the `print` prop. Used only by Report Templates-print.html.
 */
(function () {
  const TPLS = [window.TPL1, window.TPL2, window.TPL3, window.TPL4, window.TPL5, window.TPL6].filter(Boolean);

  function PrintApp() {
    return (
      <div className="tc-root">
        {TPLS.map((t) => (
          <section className="print-tpl" key={t.n}>
            <div className="print-band">
              <span className="print-num tc-tnum">{t.n}</span>
              <div style={{ minWidth: 0 }}>
                <div className="print-nm tc-serif">{t.name}</div>
                <div className="print-bl">{t.blurb}</div>
              </div>
              <span className="print-brand">TapeCoach · report view</span>
            </div>
            <t.Comp report={window.REPORT} print={true} />
          </section>
        ))}
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(<PrintApp />);

  // Auto-print once fonts + first paint settle.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(() => window.print(), 700));
  } else {
    setTimeout(() => window.print(), 1200);
  }
})();
