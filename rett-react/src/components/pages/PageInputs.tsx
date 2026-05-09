// Client Inputs page. Verbatim port of upstream `<section id="page-inputs">`
// — every section, every input, every hidden mirror, in the same order with
// the same DOM ids. The one departure from upstream: Section 02 (Income
// Sources) now has a React-native "Upload W-2" button at the top that hits
// our same-origin Express proxy at /api/gemini/extract-w2, which holds the
// Gemini API key server-side. The upstream's <details>-buried "TAX DOC"
// dropzone has been removed (it was hard to discover and required the
// advisor to paste their own key).
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

export default function PageInputs() {
  return (
    <section id="page-inputs" className="page" role="tabpanel" aria-labelledby="nav-inputs">

      <h2 className="page-inputs-title">Client Financial Inputs</h2>

      {/* Client controls — case management strip above the 2-column form. */}
      <div className="input-section" style={{ marginTop: 12 }}>
        <div className="section-heading">
          <h2>Client</h2>
          <span className="num">SECTION 00</span>
        </div>
        <div className="section-body">
          <div className="input-row">
            <div className="label">Client Name</div>
            <input type="text" id="case-name-input" placeholder="e.g. John Smith" autoComplete="off" maxLength={80} />
          </div>
          <div className="input-row">
            <div className="label">Load Saved Client</div>
            <select id="case-load-select" defaultValue="">
              <option value="">-- Select a saved client --</option>
            </select>
          </div>
          <div className="input-row">
            <div className="label">Case Actions</div>
            <div className="case-actions-row">
              <button type="button" className="btn btn-primary" id="case-new-btn">New Client</button>
              <button type="button" className="btn btn-secondary" id="case-delete-btn">Delete</button>
            </div>
          </div>
        </div>
      </div>

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
                <select id="custodian-select" required aria-required="true" defaultValue="">
                  <option value="">-- Select Custodian --</option>
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

          {/* Section 02 — Income Sources. The Upload W-2 button at the top
              of the section body sends the file (in memory only — never
              persisted) to /api/gemini/extract-w2 on our same-origin
              Express proxy, which calls Gemini Flash with the JSON-
              extraction prompt. The returned fields are written to the
              seven income inputs below + the Section 01 filing-status and
              state-code selects. Each write dispatches synthetic input +
              change events so the upstream calculator immediately
              recomputes the Tax Baseline. */}
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
            </div>
          </div>
        </div>

        <div className="inputs-stack">
          {/* Section 03 — Appreciated Asset Sale */}
          <div className="input-section">
            <div className="section-heading">
              <h2>Appreciated Asset Sale</h2>
              <span className="num">SECTION 03</span>
            </div>
            <div className="section-body">
              <div className="input-row">
                <div className="label">Sale Price</div>
                <CurrencyInput id="sale-price" />
              </div>
              <div className="input-row">
                <div className="label">Cost Basis</div>
                <CurrencyInput id="cost-basis" />
              </div>
              <div className="input-row">
                <div className="label">Accelerated Depreciation</div>
                <CurrencyInput id="accelerated-depreciation" />
              </div>
              <div className="input-row">
                <div className="label">Long-Term Gain</div>
                <div className="currency-input">
                  <input
                    type="text"
                    id="computed-gain"
                    readOnly
                    placeholder="0"
                    aria-readonly="true"
                    aria-describedby="computed-gain-hint"
                  />
                </div>
                <span id="computed-gain-hint" className="visually-hidden">
                  Calculated as sale price minus cost basis minus accelerated depreciation.
                </span>
              </div>
              <div className="input-row">
                <div className="label">Sale / Closing Date</div>
                <input type="date" id="implementation-date" />
              </div>
              <div className="input-row">
                <div className="label">Strategy Implementation Date</div>
                <input type="date" id="strategy-implementation-date" />
              </div>
            </div>
          </div>

          {/* Section 04 — Sale Proceeds */}
          <div className="input-section">
            <div className="section-heading">
              <h2>Sale Proceeds</h2>
              <span className="num">SECTION 04</span>
            </div>
            <div className="section-body">
              <div className="input-row" id="payment-on-sale-date-group" hidden>
                <div className="label">Payment on sale date</div>
                <CurrencyInput id="payment-on-sale-date" />
              </div>
              <div className="input-row">
                <div className="label">Will the client be investing everything?</div>
                <select id="withhold-yes-no" className="yes-no" defaultValue="no">
                  <option value="no">Yes</option>
                  <option value="yes">No</option>
                </select>
              </div>
              <div className="input-row" id="withhold-amount-group" hidden>
                <div className="label">Amount to keep</div>
                <CurrencyInput id="withhold-amount" />
              </div>
              <p id="withhold-error" className="error-text" role="alert" hidden />
              <div className="input-row">
                <div className="label">Cover the tax bill from the sale?</div>
                <select id="cover-taxes-yes-no" className="yes-no" defaultValue="no">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 05 — Future Appreciated Asset Sale */}
          <div className="input-section">
            <div className="section-heading">
              <h2>Future Appreciated Asset Sale</h2>
              <span className="num">SECTION 05</span>
            </div>
            <div className="section-body">
              <div className="input-row">
                <div className="label">Are you considering selling any other appreciated assets?</div>
                <select id="future-sale-yes-no" className="yes-no" defaultValue="no">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div id="future-sale-fields-group" hidden>
                <div className="input-row">
                  <div className="label">Anticipated Sale Date</div>
                  <input type="date" id="future-sale-date" />
                </div>
                <div className="input-row">
                  <div className="label">Sale Price</div>
                  <CurrencyInput id="future-sale-price" />
                </div>
                <div className="input-row">
                  <div className="label">Cost Basis</div>
                  <CurrencyInput id="future-cost-basis" />
                </div>
                <div className="input-row">
                  <div className="label">Accelerated Depreciation</div>
                  <CurrencyInput id="future-accelerated-depreciation" />
                </div>
                <div className="input-row">
                  <div className="label">Long-Term Gain</div>
                  <div className="currency-input">
                    <input type="text" id="future-long-term-gain" readOnly placeholder="0" aria-readonly="true" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Structured-sale duration — hidden until product terms become
          user-configurable again. The engine still uses the field. */}
      <div hidden aria-hidden="true">
        <input type="text" id="structured-sale-duration-months" defaultValue="" />
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
        <input type="hidden" id="long-term-gain" defaultValue="0" />
      </div>

      <div className="page-actions">
        <div className="actions-left">
          <button type="button" id="reset-form" className="btn btn-secondary" aria-label="Reset all form inputs to defaults">
            Reset Form
          </button>
        </div>
        <div className="actions-right">
          <button type="button" id="continue-to-projection" className="btn btn-primary">
            Continue to Tax Baseline &rarr;
          </button>
        </div>
      </div>
    </section>
  );
}
