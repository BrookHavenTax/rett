// Tax Implications page (page header: "Tax Baseline without Strategies").
// 2026-05-27 sync (upstream commit 5148dd5 + leader-line follow-ups):
// the old 3-tile equation row is replaced with a redesigned 3-card row.
//   - Left  — red "Tax Due from the Sale" hero tile (bt-delta).
//   - Middle — blue "Cash Kept from Sale" tile (bt-cash-kept).
//   - Right — donut showing share of GAIN kept vs lost. Denominator is
//             salePrice − basis (economic gain on the property). Blue
//             slice = gain kept, red slice = gain lost. Center =
//             percent of gain lost to tax. Leader lines carry the
//             $ amounts + percents next to each slice — no separate
//             legend block.
// Legacy IDs (#bt-without, #bt-without-sub, #bt-total, #baseline-year-
// sub, #bt-pie-keep-amt, #bt-pie-tax-amt, #bt-pie-keep-pct,
// #bt-pie-tax-pct) are PRESERVED as hidden spans so baseline-table.js
// writes don't throw.
export default function PageBaseline() {
  return (
    <section id="page-baseline" className="page" role="tabpanel" aria-labelledby="nav-baseline">
      <h2 className="page-inputs-title">Tax Baseline without Strategies</h2>

      {/* 3-card row redesign 2026-05-27 (upstream 5148dd5). */}
      <div className="baseline-pie-row" aria-live="polite">
        <div className="baseline-tile baseline-tile--delta baseline-tile--hero">
          <div className="baseline-tile-label">Tax Due from the Sale</div>
          <div className="baseline-tile-value" id="bt-delta">$0</div>
          <div className="baseline-tile-sub" id="bt-delta-sub">Recap &middot; LT &middot; NIIT &middot; State</div>
        </div>
        <div className="baseline-tile baseline-tile--cash-kept">
          <div className="baseline-tile-label">Cash Kept from Sale</div>
          <div className="baseline-tile-value" id="bt-cash-kept">$0</div>
          <div className="baseline-tile-sub">Sale price &minus; tax</div>
        </div>
        <div className="baseline-pie-card">
          <div className="baseline-pie-label">Breakdown of Gain</div>
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
