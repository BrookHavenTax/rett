// Tax Implications page (upstream title: "Sale and Tax Baseline").
// 2026-06-03 sync (cd22150f): proceeds bar + click-to-reveal before the
// 3-tile row. baseline-table.js drives #baseline-proceeds-* and
// .baseline-reveal-target visibility.
export default function PageBaseline() {
  return (
    <section id="page-baseline" className="page" role="tabpanel" aria-labelledby="nav-baseline">
      <h2 className="page-inputs-title">Sale and Tax Baseline</h2>

      {/* Proceeds bar — sale anatomy (2026-06-03 upstream Tab 2). */}
      <div id="baseline-proceeds-wrap" className="proceeds-wrap" hidden>
        <div className="proceeds-eyebrow">How the Sale Price Breaks Down</div>
        <div className="proceeds-frame">
          <div className="bracket top" id="baseline-bracket-top" />
          <div className="proceeds-bar" id="baseline-proceeds-bar" />
          <div className="bracket bottom" id="baseline-bracket-bottom" />
        </div>
        <div className="proceeds-key" id="baseline-proceeds-key" />
      </div>

      <div id="baseline-reveal-spacer" className="baseline-reveal-spacer" />
      <div id="baseline-reveal-btn-wrap" className="baseline-reveal-btn-wrap">
        <button type="button" id="baseline-reveal-btn" className="baseline-reveal-btn">
          Show Tax Breakdown <span className="chev" aria-hidden="true">&darr;</span>
        </button>
      </div>

      {/* 3-card row — hidden until reveal click (.baseline-reveal-target). */}
      <div className="baseline-pie-row baseline-reveal-target" aria-live="polite">
        <div className="baseline-tile baseline-tile--delta baseline-tile--hero">
          <div className="baseline-tile-label">Tax Due from the Sale</div>
          <div className="baseline-tile-value" id="bt-delta">$0</div>
          <div className="baseline-tile-sub" id="bt-delta-sub">Recap — LT — NIIT — State</div>
        </div>
        <div className="baseline-tile baseline-tile--cash-kept">
          <div className="baseline-tile-label">Cash Kept from Sale</div>
          <div className="baseline-tile-value" id="bt-cash-kept">$0</div>
          <div className="baseline-tile-sub">Sale price &minus; tax</div>
        </div>
        <div className="baseline-pie-card">
          <div className="baseline-pie-label">Breakdown of Sale</div>
          <div className="baseline-pie-wrap">
            {/* Donut SVG. Slices + leader lines are drawn by
                baseline-table.js into #bt-pie-slices / #bt-pie-leaders.
                viewBox is widened so leader labels fit inside the
                canvas. */}
            <svg className="baseline-pie-svg" viewBox="-160 -10 520 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <g id="bt-pie-slices" />
              <g id="bt-pie-leaders" />
              <text id="bt-pie-center" x="110" y="110" textAnchor="middle" dominantBaseline="central" className="baseline-pie-center">&mdash;</text>
            </svg>
            {/* Legacy span IDs retained (hidden) so legacy _set calls don't throw. */}
            <span id="bt-pie-keep-amt" hidden>$0</span>
            <span id="bt-pie-tax-amt" hidden>$0</span>
            <span id="bt-pie-keep-pct" hidden>0%</span>
            <span id="bt-pie-tax-pct" hidden>0%</span>
          </div>
        </div>
        {/* Legacy IDs preserved (hidden) so baseline-table.js writes to
            bt-without / bt-total don't error. Values aren't displayed. */}
        <span id="bt-without" hidden>$0</span>
        <span id="bt-without-sub" hidden />
        <span id="bt-total" hidden>$0</span>
        <span id="baseline-year-sub" hidden />
      </div>

      {/* Per-property tax breakdown panel — revealed by double-click on the
          middle "Tax Due to the Sale" tile when 2+ properties are active.
          Hidden by default; baseline-table.js populates the rows. */}
      <div id="baseline-breakdown-panel" className="baseline-breakdown-panel" hidden>
        <div className="baseline-breakdown-title">Tax Due — by Property</div>
        <div id="baseline-breakdown-list" className="baseline-breakdown-list" />
      </div>

      <div className="page-actions">
        <div className="actions-left">
          <button type="button" id="baseline-back-btn" className="btn btn-secondary">
            &larr; Back to Client Inputs
          </button>
        </div>
        <div className="actions-right">
          <button type="button" id="baseline-continue-btn" className="btn btn-primary">
            Continue to Strategies &rarr;
          </button>
        </div>
      </div>
    </section>
  );
}
