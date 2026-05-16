// Tax Implications (formerly "Tax Baseline"). The May 2026 sync replaced
// the long tax-breakdown table with the "Blake delta trio" layout: three
// tiles read left-to-right as the equation (without sale) + (from sale) =
// (total). The advisor-only breakdown table is gone upstream (commit
// 97ee7c9 "Tab 2: rename to 'Tax Baseline without Strategies' + drop
// advisor breakdown"). The page header itself reads "Tax Baseline without
// Strategies" — only the NAV TAB label is "2. Tax Implications".
//
// IDs (#bt-without, #bt-delta, #bt-total, etc.) are populated by
// js/04-ui/baseline-table.js whenever the inputs change. The per-property
// breakdown panel is revealed by double-clicking the middle tile when
// 2+ properties are active; baseline-table.js controls the show/hide.
export default function PageBaseline() {
  return (
    <section id="page-baseline" className="page" role="tabpanel" aria-labelledby="nav-baseline">
      <h2 className="page-inputs-title">Tax Baseline without Strategies</h2>

      {/* Three-block delta display per Blake's spec: headline is the
          additional tax due to the sale, not the total. Visual reads
          left-to-right as an equation: (without sale) + (from sale) = (total).
          Crescendo escalates to the right so the total has the most weight. */}
      <div className="baseline-trio" aria-live="polite">
        <div className="baseline-tile baseline-tile--without">
          <div className="baseline-tile-label">Without the Sale</div>
          <div className="baseline-tile-value" id="bt-without">$0</div>
          <div className="baseline-tile-sub" id="bt-without-sub">Federal &middot; State &middot; NIIT</div>
        </div>
        <div className="baseline-op" aria-hidden="true">+</div>
        <div className="baseline-tile baseline-tile--delta">
          <div className="baseline-tile-label">Tax Due to the Sale</div>
          <div className="baseline-tile-value" id="bt-delta">$0</div>
          <div className="baseline-tile-sub" id="bt-delta-sub">Recap &middot; LT &middot; NIIT &middot; State</div>
        </div>
        <div className="baseline-op" aria-hidden="true">=</div>
        <div className="baseline-tile baseline-tile--total">
          <div className="baseline-tile-label">Total Tax</div>
          <div className="baseline-tile-value" id="bt-total">$0</div>
          <div className="baseline-tile-sub" id="baseline-year-sub">Year 2026</div>
        </div>
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
