// Projection. All visible content is rendered by upstream JS modules into
// the host divs below — js/04-ui/projection-dashboard-render.js builds the
// scenario comparison + multi-year snapshot, narrative-render.js fills the
// narrative card, savings-ribbon.js fills the ribbon, and
// cashflow-schedule-render.js fills the year-by-year cashflow table. The
// always-hidden #full-projection-region holds the legacy hidden fields
// inputs-collector reads from.
export default function PageProjection() {
  return (
    <section id="page-projection" className="page" role="tabpanel" aria-labelledby="nav-projection">
      {/* Projection head row 2026-05-28 (upstream commit ee948e3): the
          headline + the Additional Funds toggle live side-by-side. When
          ON, the Additional Funds contribution from Tab 1 Section 03
          becomes additional available capital for Brooklyn / strategies.

          Toggle HIDDEN as of 2026-06-22 (upstream commit 2fe5c20) alongside
          the Tab 1 Additional Funds section. Kept in the DOM (collector reads
          it) but never shown. Remove `hidden` to restore. */}
      <div className="page-projection-head">
        <h2>Projection</h2>
        <label className="proj-addfunds-toggle" htmlFor="additional-funds-toggle" title="Include the Additional Funds contribution from Client Inputs as extra available capital" hidden>
          <input type="checkbox" id="additional-funds-toggle" />
          <span>Include additional funds</span>
        </label>
      </div>

      {/* Minimal Page-3 view: filtered to scenarios the user marked
          Interested on Page 2. Each card shows net benefit with a
          click-to-expand details panel for math verification. The
          Structured-Sale card additionally shows a payment schedule. */}
      <div id="interested-cards-host" aria-live="polite" />

      {/* All legacy KPI dashboards / chart / comparison-table content lives
          inside the always-hidden #full-projection-region. The hidden fields
          it contains (#available-capital, #strategy-select,
          #recognition-start-select, etc.) are still read by inputs-collector
          + the calc engines, so the region must stay in the DOM even
          though it never renders on screen. */}
      <div id="full-projection-region" hidden>
        {/* Plain-English narrative card — Holistiplan-style "client
            observation" that frames the strategy in one short paragraph. */}
        <div id="narrative-host" hidden />

        {/* Sticky savings ribbon — pattern from Instead (formerly Corvee).
            Always-visible 3-number summary that anchors decisions. */}
        <div id="savings-ribbon" className="savings-ribbon" hidden aria-live="polite" />

        <div className="subnav" role="tablist" aria-label="Projection views">
          <button id="subnav-summary" className="subnav-tab active" role="tab" aria-selected="true" aria-controls="subpage-summary" type="button">Summary</button>
          <button id="subnav-details" className="subnav-tab" role="tab" aria-selected="false" aria-controls="subpage-details" type="button">Details</button>
        </div>

        {/* ----- Sub-tab: SUMMARY ----- */}
        <div id="subpage-summary" className="subpage active" role="tabpanel" aria-labelledby="subnav-summary">
          {/* Strategy comparison panel — three real-world planning options.
              Sits at the very top of Summary. Rendered by
              projection-dashboard-render.js. */}
          <div id="scenario-comparison-host" aria-live="polite" />

          <h3 className="section-title">Brooklyn Configuration</h3>
          <p className="subtitle">
            Available Capital is carried over from the Sale Price on the
            previous page. Edit if you&rsquo;d like to invest a different amount.
          </p>
          <div className="input-grid">
            <div className="input-group">
              <label htmlFor="available-capital">Available Capital</label>
              <input type="text" id="available-capital" placeholder="$5,000,000" inputMode="numeric" autoComplete="off" />
            </div>
            <div className="input-group">
              <label htmlFor="strategy-select">Strategy</label>
              <select id="strategy-select" defaultValue="beta1">
                <option value="beta1">RIA - Brooklyn Beta 1</option>
                <option value="beta0">CASH - Brooklyn Beta 0</option>
                <option value="beta05">Brooklyn Beta 0.5</option>
                <option value="advisorManaged">Brooklyn Advisor-Managed</option>
              </select>
              {/* Schwab is Beta 1-only — locked label hidden until controls.js
                  unhides it for that custodian. */}
              <p id="strategy-locked-label" className="strategy-locked" hidden>
                Brooklyn Beta 1 <span className="muted">(Schwab is Beta 1 only)</span>
              </p>
            </div>
          </div>

          {/* Hidden legacy fields. The whole Available Capital amount is
              treated as the Brooklyn investment, so #invested-capital is no
              longer user-facing. The #beta1 input was a placeholder that no
              solver actually consumed. Both stay in the DOM with safe
              defaults. */}
          <div hidden aria-hidden="true">
            <input type="hidden" id="invested-capital" defaultValue="0" />
            <input type="hidden" id="beta1" defaultValue="50" />
          </div>

          {/* Hidden state mirrors. The slider/dropdowns in earlier versions
              were the visible UI; these elements remain the source of truth
              that inputs-collector reads from. use-variable-leverage stays
              checked permanently now that the slider IS the leverage UI. */}
          <div hidden aria-hidden="true">
            <select id="recognition-start-select" defaultValue="1">
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
            <input type="checkbox" id="use-variable-leverage" defaultChecked />
            <input type="number" id="custom-short-pct" min={0} max={225} step={1} defaultValue={100} inputMode="numeric" />
            <output id="custom-long-readout">200%</output>
            <output id="custom-tier-readout">200/100</output>
            <output id="custom-fee-readout">59.0% / 1.96%</output>
            <p id="custom-leverage-hint" />
          </div>

          {/* Recommendation panel — populated by recommendation-render.js,
              hidden by default since the user-facing summary lives in the
              narrative card / ribbon / KPI tiles above. */}
          <div id="recommendation-panel" style={{ display: 'none' }} aria-live="polite" />

          <h3 className="section-title" style={{ marginTop: 24 }}>Multi-Year Snapshot</h3>
          <div id="projection-summary-host" aria-live="polite" />

          {/* Year-by-year cashflow schedule. */}
          <div id="cashflow-schedule-host" aria-live="polite" />
        </div>

        {/* ----- Sub-tab: DETAILS ----- */}
        <div id="subpage-details" className="subpage" role="tabpanel" aria-labelledby="subnav-details" hidden>
          <h3 className="section-title">Year-by-Year Tax Projection</h3>
          <p className="subtitle">
            Full year-by-year detail. Brooklyn losses are generated every year
            the position is open, but only $3,000/yr can offset ordinary
            income &mdash; the rest <strong>carries forward</strong>. When
            deferred recognition is in play, the bulk of the savings
            concentrates in the recognition year as the stockpiled losses
            absorb the gain. Scroll horizontally on small screens.
          </p>
          <div id="projection-details-host" aria-live="polite" />
        </div>
      </div>
    </section>
  );
}
