// Client Inputs page. Verbatim port of upstream `<section id="page-inputs">`
// after the May 2026 multi-property overhaul. Major shape changes vs. the
// previous port (all sourced from upstream commits in the deaeb68..c9b9638
// sync range):
//   - Case Management section moved OUT of here and into PagePMQ.tsx
//     (commit 5451a94). The case-name-input, case-load-select, case-new-btn,
//     case-delete-btn IDs are unchanged so controls.js wires them by ID.
//   - Section 02 (Income Sources) adds Q7: a visible Long-Term Capital Gain
//     input (commit eab89d3). The legacy hidden #long-term-gain mirror is
//     removed; engine reads the visible field directly.
//   - Section 03 (Real Estate Sale Proceeds, formerly "Appreciated Asset
//     Sale") is now a multi-property scaffold (commits eab89d3, 6487f40,
//     799def7). Five property blocks, Property 1 visible by default and
//     2–5 hidden behind a "+ Additional Real Estate Sale" button. Each
//     block carries its own sale-price-N, cost-basis-N, accelerated-
//     depreciation-N, holding-period-N, implementation-date-N, strategy-
//     implementation-date-N, personal-use-yes-no-N, personal-use-amount-N.
//     Property 1 keeps the unsuffixed IDs for back-compat with legacy
//     direct-DOM readers.
//   - Old Section 04 "Sale Proceeds" block collapsed (commit 799def7). The
//     personal-use carve-out moved to per-property. Only the client-level
//     "Cover any tax bill from sale?" question remains as a visible row at
//     the bottom of Section 03. The legacy #withhold-yes-no, #withhold-
//     amount, #withhold-amount-group, #withhold-error elements stay as
//     HIDDEN MIRRORS — inputs-collector + _recomputeAvailableCapital +
//     engine consumers continue to read consistent aggregate values
//     synced from the per-property fields by controls.js.
//   - Section 05 renamed "Future Appreciated Asset Sale" -> "Proactive
//     Tax Savings" (commit 35ef872). Fields collapsed to a simple "How
//     much gain?" + "When will it be recognized?" pair backed by IDs
//     future-estimated-gain + future-sale-date. The legacy multi-field
//     form (future-sale-price, future-cost-basis, future-accelerated-
//     depreciation, future-long-term-gain) is gone upstream.
//   - structured-sale-duration-months default value bumped to "36"
//     (commit 9bd756a/eab89d3 from earlier; surfaced this round).
//   - Continue button text now "Continue to Tax Implications" since
//     Tab 2 renamed (commit 97ee7c9).
//
// React-only departure preserved: Section 02 keeps the W2Uploader at the
// top of its section-body (calls our same-origin Express proxy at
// /api/gemini/extract-w2 so the Gemini key stays server-side).
import W2Uploader from '../W2Uploader';

const STATES: ReadonlyArray<[string, string]> = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
  ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'],
  ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

function CurrencyInput({ id }: { id: string }) {
  return (
    <div className="currency-input">
      <input type="text" id={id} placeholder="0" inputMode="numeric" autoComplete="off" />
    </div>
  );
}

// Per-property block. Property 1 keeps the unsuffixed legacy IDs so
// direct-DOM readers in the calculator engine continue to work; properties
// 2–5 use -N suffixes and stay hidden until the user clicks the "+ Add" btn
// at the bottom of Section 03 (controls.js _showNextSlot reveals them).
function PropertyBlock({ n, hidden }: { n: number; hidden?: boolean }) {
  const suf = n === 1 ? '' : `-${n}`;
  return (
    <div className="property-block" id={`property-${n}`} data-property={n} hidden={hidden}>
      {n > 1 && (
        <div className="property-block-header">
          <h3 className="property-block-title">Property {n}</h3>
          <button type="button" className="property-remove-btn" data-remove-target={n} aria-label={`Remove Property ${n}`}>Remove</button>
        </div>
      )}
      <div className="input-row">
        <div className="label">Expected Sales Price</div>
        <CurrencyInput id={`sale-price${suf}`} />
      </div>
      <div className="input-row">
        <div className="label">Cost Basis (Original Sale Price)</div>
        <CurrencyInput id={`cost-basis${suf}`} />
      </div>
      <div className="input-row">
        <div className="label">Accelerated Depreciation Recapture</div>
        <CurrencyInput id={`accelerated-depreciation${suf}`} />
      </div>
      <div className="input-row">
        <div className="label">Has this property been held a year?</div>
        <select id={`holding-period-${n}`} className="yes-no" defaultValue="yes">
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
      <div className="input-row">
        <div className="label">Sale / Closing Date</div>
        <input type="date" id={`implementation-date${suf}`} />
      </div>
      <div className="input-row">
        <div className="label">Strategy Implementation Date</div>
        <input type="date" id={`strategy-implementation-date${suf}`} />
      </div>
      <div className="input-row">
        <div className="label">Any sale proceeds needed for personal use?</div>
        <select id={`personal-use-yes-no-${n}`} className="yes-no" defaultValue="no">
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </div>
      <div className="input-row" id={`personal-use-amount-group-${n}`} hidden>
        <div className="label">Amount</div>
        <CurrencyInput id={`personal-use-amount-${n}`} />
      </div>
    </div>
  );
}

export default function PageInputs() {
  return (
    <section id="page-inputs" className="page" role="tabpanel" aria-labelledby="nav-inputs">

      <h2 className="page-inputs-title page-inputs-title--banner">Client Financial Inputs</h2>

      <div className="inputs-2col">
        <div className="inputs-stack">
          {/* Section 01 — Custodian & Filing Information */}
          <div className="input-section">
            <div className="section-heading">
              <h2>Custodian &amp; Filing Information</h2>
              <span className="num">SECTION 01</span>
            </div>
            <div className="section-body">
              <div className="input-row">
                <div className="label">Custodian</div>
                {/* Options populated by controls.js _populateCustodian() from
                    js/00-data/custodians.js. No "-- Select --" placeholder
                    so the engine doesn't fall into the no-custodian
                    "variable" leverage path advisors don't want. */}
                <select id="custodian-select" required aria-required="true" defaultValue="">
                </select>
              </div>
              <div className="input-row">
                <div className="label">Tax Year</div>
                <select id="year1" defaultValue="2026">
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2025">2025</option>
                </select>
              </div>
              <div className="input-row">
                <div className="label">Filing Status</div>
                <select id="filing-status" defaultValue="mfj">
                  <option value="single">Single</option>
                  <option value="mfj">Married Filing Jointly</option>
                  <option value="mfs">Married Filing Separately</option>
                  <option value="hoh">Head of Household</option>
                </select>
              </div>
              <div className="input-row">
                <div className="label">State</div>
                <select id="state-code" defaultValue="NY">
                  {STATES.map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 02 — Income Sources. The Upload 1040 button at the top
              of the section body sends the file (in memory only — never
              persisted) to /api/gemini/extract-w2 on our same-origin
              Express proxy, which calls Gemini Flash with the JSON-
              extraction prompt. The returned fields are written to the
              income inputs below + the Section 01 filing-status and
              state-code selects. Each write dispatches synthetic input +
              change events so the upstream calculator immediately
              recomputes the Tax Baseline. (The /extract-w2 endpoint name
              is unchanged for back-compat; the underlying prompt has
              always handled 1040 + W-2 + 1099 + K-1.) */}
          <div className="input-section">
            <div className="section-heading">
              <h2>Income Sources</h2>
              <span className="num">SECTION 02</span>
            </div>
            <div className="section-body">
              <W2Uploader />
              <div className="input-row">
                <div className="label">W-2 Wages</div>
                <CurrencyInput id="w2-wages" />
              </div>
              <div className="input-row">
                <div className="label">Self-Employment Income</div>
                <CurrencyInput id="se-income" />
              </div>
              <div className="input-row">
                <div className="label">Business Income</div>
                <CurrencyInput id="biz-revenue" />
              </div>
              <div className="input-row">
                <div className="label">Rental Income</div>
                <CurrencyInput id="rental-income" />
              </div>
              <div className="input-row">
                <div className="label">Dividend / Interest</div>
                <CurrencyInput id="dividend-income" />
              </div>
              <div className="input-row">
                <div className="label">Retirement Distributions</div>
                <CurrencyInput id="retirement-distributions" />
              </div>
              <div className="input-row">
                <div className="label">Short-Term Capital Gain</div>
                <CurrencyInput id="short-term-gain" />
              </div>
              {/* Q7: non-property LT cap gain (stocks held >1yr, crypto,
                  partnership distributions, etc.). Engine treats this as
                  recurring annual LT income (parallels baseShortTermGain).
                  Property-derived LT gain flows separately via
                  cfg.salePrice − costBasis − depreciation. */}
              <div className="input-row">
                <div className="label">Long-Term Capital Gain</div>
                <CurrencyInput id="long-term-gain" />
              </div>
            </div>
          </div>
        </div>

        <div className="inputs-stack">
          {/* Section 03 — Real Estate Sale Proceeds (multi-property).
              Property 1 always visible; Properties 2-5 hidden behind the
              "+ Additional Real Estate Sale" button. Each block carries
              its own sale figures + closing date + holding period +
              personal-use carve-out. The Strategy Implementation Date is
              per-property too. inputs-collector aggregates per-property
              values; engine sees a single cfg.salePrice / costBasis /
              acceleratedDepreciation = sum across visible blocks. */}
          <div className="input-section">
            <div className="section-heading">
              <h2>Real Estate Sale Proceeds</h2>
              <span className="num">SECTION 03</span>
            </div>
            <div className="section-body">

              <PropertyBlock n={1} />
              <PropertyBlock n={2} hidden />
              <PropertyBlock n={3} hidden />
              <PropertyBlock n={4} hidden />
              <PropertyBlock n={5} hidden />

              {/* Cover-Tax question — single client-level decision applied to
                  the aggregate. Personal-use carve-out moved to per-property
                  (see "Any sale proceeds needed for personal use?" inside
                  each property block above). The legacy #withhold-yes-no and
                  #withhold-amount elements stay as HIDDEN MIRRORS below so
                  inputs-collector + _recomputeAvailableCapital + engine
                  consumers continue to read consistent aggregate values
                  synced from the per-property fields by controls.js. */}
              <div className="input-row property-proceeds-divider">
                <div className="label">Cover any tax bill from sale?</div>
                <select id="cover-taxes-yes-no" className="yes-no" defaultValue="yes">
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              {/* Hidden mirror fields (back-compat). Populated by JS from
                  the per-property personal-use inputs. */}
              <div hidden aria-hidden="true">
                <select id="withhold-yes-no" className="yes-no" defaultValue="no">
                  <option value="no">Yes</option>
                  <option value="yes">No</option>
                </select>
                <input type="text" id="withhold-amount" defaultValue="" />
                <div id="withhold-amount-group" hidden />
                <p id="withhold-error" className="error-text" role="alert" hidden />
              </div>

              {/* + Additional Real Estate Sale button — sits at the very
                  bottom of Section 03 so clicking it reads as "add another
                  property to this section" rather than appearing to insert
                  something inside Property 1. The next hidden property
                  block (P2-P5) is revealed by controls.js _showNextSlot.

                  HIDDEN TEMPORARILY (upstream commit 8b6fe99, 2026-05-17)
                  per advisor — the engine's per-property tranche routing
                  isn't built out yet (sales collapse to the earliest date,
                  Brooklyn opens at the earliest strategy date, minimum
                  checks are aggregate-only). Future Sale Loss Target
                  (Section 05) covers the "I'll have more gain later" case
                  in the meantime. Re-enable by removing the `hidden`
                  attribute below. The hidden property-2..5 blocks stay
                  mounted so re-enabling is a one-attribute flip. */}
              <div className="property-add-row" hidden>
                <button type="button" id="property-add-btn" className="property-add-btn">+ Additional Real Estate Sale</button>
              </div>

              {/* Multi-year-sale notice — only meaningful when multi-
                  property is exposed. Kept in the DOM (hidden) for the
                  future re-enable; controls.js's toggle logic still runs
                  against it but with no property-2..5 visible it stays
                  hidden permanently. */}
              <div id="multi-year-sale-notice" className="multi-year-sale-notice" hidden>
                <strong>Heads up:</strong> two or more properties have sale or strategy implementation dates
                in different calendar years. The engine treats the sale as one event at the EARLIEST sale date
                and opens Brooklyn at the EARLIEST strategy date &mdash; per-property year routing and
                per-tranche minimum checks are on the roadmap.
              </div>
            </div>
          </div>

          {/* Section 05 — Proactive Tax Savings (formerly "Future
              Appreciated Asset Sale"). Tells the optimizer there's a gain
              the client expects to recognize in the future. Engine treats
              it as additional absorbable gain and sizes Brooklyn / preserves
              carryforward so the loss generated by the strategy lands in
              the year the gain is recognized. Legacy IDs (future-sale-
              yes-no, future-sale-date) preserved; future-estimated-gain
              replaces the multi-field form. */}
          <div className="input-section">
            <div className="section-heading">
              <h2>Proactive Tax Savings</h2>
              <span className="num">SECTION 05</span>
            </div>
            <div className="section-body">
              <div className="input-row">
                <div className="label">Do you have gain you'll recognize in the future?</div>
                <select id="future-sale-yes-no" className="yes-no" defaultValue="no">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div id="future-sale-fields-group" hidden>
                <div className="input-row">
                  <div className="label">How much gain?</div>
                  <CurrencyInput id="future-estimated-gain" />
                </div>
                <div className="input-row">
                  <div className="label">When will it be recognized?</div>
                  <input type="date" id="future-sale-date" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Structured-sale duration default 36 months (regulatory minimum +
          common Vegas-spec default). Engine still reads the field; advisor
          can override once product terms become user-configurable again. */}
      <div hidden aria-hidden="true">
        <input type="text" id="structured-sale-duration-months" defaultValue="36" />
      </div>

      {/* Hidden legacy fields (projection horizon + leverage cap mirrors).
          Q7's #long-term-gain is now visible in Section 02 above; the old
          hidden mirror is removed (engine reads the visible field). */}
      <div hidden aria-hidden="true">
        <select id="projection-years" defaultValue="5">
          <option value="1">1 year</option>
          <option value="3">3 years</option>
          <option value="5">5 years</option>
          <option value="7">7 years</option>
        </select>
        <select id="leverage-cap-select" disabled defaultValue="">
          <option value="">-- choose custodian first --</option>
        </select>
      </div>

      <div className="page-actions">
        <div className="actions-left">
          <button type="button" id="reset-form" className="btn btn-secondary" aria-label="Reset all form inputs to defaults">
            Reset Form
          </button>
        </div>
        <div className="actions-right">
          <button type="button" id="continue-to-projection" className="btn btn-primary">
            Continue to Tax Implications &rarr;
          </button>
        </div>
      </div>
    </section>
  );
}
