// Client Inputs page — May 2026 sync (upstream 24b93fb..4efeb0f).
// Major shape changes vs. the previous port:
//
//   - Custodian + Filing Information (year1, filing-status, state-code)
//     moved to Tab 0 (PagePMQ.tsx). The old Section 01 here is GONE.
//   - Section 01 here is now Income Sources, reordered to follow Form
//     1040 line order with three new visible fields:
//       * Interest Income (#interest-income)         — 1040 Line 2b
//       * Social Security (#social-security)         — 1040 Line 6a
//       * Business Income (#business-income-amount)  — simplified single
//         amount, no Schedule C vs K-1 split
//     The previous Self-Employment Income + Business Income inputs
//     (#se-income, #biz-revenue) collapse into HIDDEN MIRRORS that engine
//     wiring still reading them sees as 0 until the engine bot reroutes
//     through the new business-income block. Dividends simplified — the
//     qualified-vs-ordinary split is dropped; the hidden #qualified-
//     dividends mirror stays at 0 for any wiring that still reads it.
//   - Section 02 here is now Real Estate Sale Proceeds (was Section 03).
//     The "Cost Basis (Original Sale Price)" subtext on each of the 5
//     property blocks is removed; label is now just "Cost Basis".
//   - NEW Section 03 — Additional Funds. Yes/No gate (mirrors Future
//     Sale's pattern) reveals a taxable-account block: account value,
//     LT + ST gain, derived cost basis (readonly), the contribution
//     ("Additional Funds") amount + auto-note span, and a live
//     proportional-realized-gain breakdown. Inert for now — engine
//     wiring is TBD; the only client-side behaviour is the derived
//     cost basis and the proportional realized-gain breakdown. The
//     Projection page "Include Additional Funds" toggle controls
//     whether the contribution becomes additional Brooklyn capital
//     once engine wiring lands.
//   - Section 04 here is Future Sale (was Section 05, "Proactive Tax
//     Savings"). Renamed by advisor 2026-05-27. The Yes/No question
//     reads "Do you have a large real estate, stock, or business
//     sale in the future?". Underlying field IDs (#future-sale-yes-
//     no, #future-estimated-gain, #future-sale-date,
//     #future-sale-fields-group) unchanged so existing engine wiring
//     keeps working.
//   - Continue button text "Continue to Tax Implications" preserved.
//
// React-only departure preserved: Section 01 (Income Sources) keeps the
// W2Uploader at the top of its section-body (calls our same-origin
// Express proxy at /api/gemini/extract-w2). NOTE: the W2Uploader's
// FIELD_MAP currently writes Self-Employment Income / Business Income
// to #se-income / #biz-revenue, which are now HIDDEN MIRRORS the engine
// no longer reads. Until the FIELD_MAP is rerouted to
// #business-income-amount, autofilled SE/Biz dollars will sit in dead
// inputs. Tracked in SYNC.md.
import W2Uploader from '../W2Uploader';

function CurrencyInput({ id }: { id: string }) {
  return (
    <div className="currency-input">
      <input type="text" id={id} placeholder="0" inputMode="numeric" autoComplete="off" />
    </div>
  );
}

// Per-property block. Property 1 keeps the unsuffixed legacy IDs so
// direct-DOM readers in the calculator engine continue to work; properties
// 2–5 use -N suffixes and stay hidden until the user clicks the "+ Add"
// btn at the bottom of Section 02 (currently HIDDEN per advisor — the
// multi-property feature is parked until per-property tranche routing
// lands in the engine).
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
        <div className="label">Cost Basis</div>
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

          {/* Section 01 — Income Sources (1040-aligned, 2026-05-27).
              The Upload 1040 scanner at the top of the section body sends
              the file (in memory only — never persisted) to
              /api/gemini/extract-w2 on our same-origin Express proxy,
              which calls Gemini Flash with the JSON-extraction prompt.
              The returned fields are written into the inputs below + the
              Section 01 (PMQ) Filing Status + State selects. Each write
              dispatches synthetic input + change events so the upstream
              calculator immediately recomputes the Tax Implications. */}
          <div className="input-section">
            <div className="section-heading">
              <h2>Income Sources</h2>
              <span className="num">SECTION 01</span>
            </div>
            <div className="section-body">
              <W2Uploader />

              {/* 1040 Line 1a */}
              <div className="input-row">
                <div className="label">W-2 Wages</div>
                <CurrencyInput id="w2-wages" />
              </div>
              {/* 1040 Line 2b — taxable interest. Ordinary brackets + NIIT base. */}
              <div className="input-row">
                <div className="label">Interest Income</div>
                <CurrencyInput id="interest-income" />
              </div>
              {/* Dividends (simplified 2026-05-27 — no qualified vs ordinary
                  split; engine treats this whole amount as ordinary
                  investment income for the baseline). Hidden
                  #qualified-dividends stays at 0 for back-compat. */}
              <div className="input-row">
                <div className="label">Dividends</div>
                <CurrencyInput id="dividend-income" />
              </div>
              <input type="hidden" id="qualified-dividends" defaultValue="" />
              {/* 1040 Line 4b/5b */}
              <div className="input-row">
                <div className="label">Retirement Distributions</div>
                <CurrencyInput id="retirement-distributions" />
              </div>
              {/* 1040 Line 6a (gross). Engine applies §86 provisional-
                  income worksheet to derive Line 6b (taxable portion). */}
              <div className="input-row">
                <div className="label">Social Security</div>
                <CurrencyInput id="social-security" />
              </div>
              {/* Schedule E Part I */}
              <div className="input-row">
                <div className="label">Rental Income</div>
                <CurrencyInput id="rental-income" />
              </div>
              {/* Schedule D Part I */}
              <div className="input-row">
                <div className="label">Short-Term Capital Gain</div>
                <CurrencyInput id="short-term-gain" />
              </div>
              {/* Schedule D Part II — non-property LT cap gain (stocks
                  held >1yr, crypto, fund distributions, etc.).
                  Property-derived LT gain from the real-estate sale
                  flows SEPARATELY via cfg.salePrice − costBasis −
                  depreciation and never touches this field. */}
              <div className="input-row">
                <div className="label">Long-Term Capital Gain</div>
                <CurrencyInput id="long-term-gain" />
              </div>
              {/* Business Income (simplified 2026-05-27 — single amount,
                  no Schedule C vs K-1 type dropdown). The engine should
                  treat this whole amount as ordinary income; SE-tax /
                  NIIT-routing distinctions deferred. */}
              <div className="input-row">
                <div className="label">Business Income</div>
                <CurrencyInput id="business-income-amount" />
              </div>
              {/* Legacy mirrors preserved (hidden) for any engine wiring
                  still reading them. Both stay at 0. */}
              <input type="hidden" id="se-income"   defaultValue="" />
              <input type="hidden" id="biz-revenue" defaultValue="" />
            </div>
          </div>

        </div>

        <div className="inputs-stack">

          {/* Section 02 — Real Estate Sale Proceeds (multi-property).
              Property 1 always visible; Properties 2-5 hidden behind the
              "+ Additional Real Estate Sale" button (which itself is
              hidden temporarily — the engine's per-property tranche
              routing isn't built out yet). */}
          <div className="input-section">
            <div className="section-heading">
              <h2>Real Estate Sale Proceeds</h2>
              <span className="num">SECTION 02</span>
            </div>
            <div className="section-body">

              <PropertyBlock n={1} />
              <PropertyBlock n={2} hidden />
              <PropertyBlock n={3} hidden />
              <PropertyBlock n={4} hidden />
              <PropertyBlock n={5} hidden />

              {/* Cover-Tax question — single client-level decision applied
                  to the aggregate. Personal-use carve-out moved to
                  per-property. The legacy #withhold-yes-no and
                  #withhold-amount elements stay as HIDDEN MIRRORS below. */}
              <div className="input-row property-proceeds-divider">
                <div className="label">Cover any tax bill from sale?</div>
                <select id="cover-taxes-yes-no" className="yes-no" defaultValue="yes">
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div hidden aria-hidden="true">
                <select id="withhold-yes-no" className="yes-no" defaultValue="no">
                  <option value="no">Yes</option>
                  <option value="yes">No</option>
                </select>
                <input type="text" id="withhold-amount" defaultValue="" />
                <div id="withhold-amount-group" hidden />
                <p id="withhold-error" className="error-text" role="alert" hidden />
              </div>

              {/* + Additional Real Estate Sale button — hidden temporarily
                  per advisor (upstream 8b6fe99). Re-enable is one
                  attribute flip; hidden property-2..5 blocks stay mounted. */}
              <div className="property-add-row" hidden>
                <button type="button" id="property-add-btn" className="property-add-btn">+ Additional Real Estate Sale</button>
              </div>

              {/* Multi-year-sale notice — only meaningful when multi-
                  property is exposed. Kept in the DOM (hidden). */}
              <div id="multi-year-sale-notice" className="multi-year-sale-notice" hidden>
                <strong>Heads up:</strong> two or more properties have sale or strategy implementation dates
                in different calendar years. The engine treats the sale as one event at the EARLIEST sale date
                and opens Brooklyn at the EARLIEST strategy date &mdash; per-property year routing and
                per-tranche minimum checks are on the roadmap.
              </div>
            </div>
          </div>

          {/* Section 03 — Additional Funds (NEW 2026-05-28, upstream
              commit ee948e3 + follow-ups). Captures a taxable investment
              account the client could tap. INERT for now (data-inert) —
              not wired into the engine yet. The only live behaviour is
              the derived cost basis (Account Value − LT gain − ST gain)
              and the proportional-realized-gain breakdown. The
              "Additional Funds" amount can be auto-populated by the
              optimizer (window.rettSuggestAdditionalFunds) when the
              additional-funds-ui module is wired. The Projection-tab
              toggle controls whether the contribution actually moves
              the projection. */}
          <div className="input-section">
            <div className="section-heading">
              <h2>Additional Funds</h2>
              <span className="num">SECTION 03</span>
            </div>
            <div className="section-body">
              {/* Gate question (mirrors the Future Sale yes/no). "No"
                  by default; flipping to "Yes" reveals the account
                  fields. */}
              <div className="input-row">
                <div className="label">Do you have additional funds to invest?</div>
                <select id="additional-funds-yes-no" className="yes-no" defaultValue="no">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div id="additional-funds-fields-group" hidden>
                <div className="input-row">
                  <div className="label">Account Value</div>
                  <CurrencyInput id="additional-account-value" />
                </div>
                <div className="input-row">
                  <div className="label">Long-Term Gain</div>
                  <CurrencyInput id="additional-lt-gain" />
                </div>
                <div className="input-row">
                  <div className="label">Short-Term Gain</div>
                  <CurrencyInput id="additional-st-gain" />
                </div>
                <div className="input-row">
                  <div className="label">Cost Basis</div>
                  <div className="currency-input">
                    <input type="text" id="additional-cost-basis-derived" placeholder="0" inputMode="numeric" autoComplete="off" readOnly tabIndex={-1} />
                  </div>
                </div>
                <div className="input-row">
                  <div className="label">Additional Funds</div>
                  <div className="currency-input">
                    <input type="text" id="additional-funds" placeholder="0" inputMode="numeric" autoComplete="off" />
                    <span id="additional-funds-auto-note" className="addfunds-auto-note" hidden />
                  </div>
                </div>
                {/* Live proportional realized-gain breakdown — liquidating
                    from the account triggers gains pro-rata to the account's
                    gain composition. Client-side display only. */}
                <div id="additional-funds-breakdown" className="addfunds-breakdown" hidden>
                  <div className="addfunds-breakdown-title">
                    Liquidating <span id="afb-amount">$0</span> realizes:
                  </div>
                  <div className="addfunds-breakdown-rows">
                    <div className="addfunds-bd-row"><span>Long-term gain</span><span id="afb-lt">$0</span></div>
                    <div className="addfunds-bd-row"><span>Short-term gain</span><span id="afb-st">$0</span></div>
                    <div className="addfunds-bd-row"><span>Return of basis (no tax)</span><span id="afb-basis">$0</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 04 — Future Sale (was Section 05, "Proactive Tax
              Savings"). Renamed 2026-05-27. The Yes/No question now reads
              "Do you have a large real estate, stock, or business sale in
              the future?". Underlying field IDs unchanged. */}
          <div className="input-section">
            <div className="section-heading">
              <h2>Future Sale</h2>
              <span className="num">SECTION 04</span>
            </div>
            <div className="section-body">
              <div className="input-row">
                <div className="label">Do you have a large real estate, stock, or business sale in the future?</div>
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

      {/* Structured-sale duration locked to 36 months (3 yearly Jan-1
          payments, 40/40/20 split) per advisor 2026-05-26. The engine
          ignores any value other than 36. */}
      <div hidden aria-hidden="true">
        <input type="text" id="structured-sale-duration-months" defaultValue="36" />
      </div>

      {/* Hidden legacy fields (projection horizon + leverage cap mirrors). */}
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
