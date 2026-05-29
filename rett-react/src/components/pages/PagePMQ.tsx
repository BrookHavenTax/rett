// Pre-Meeting Questionnaire page. Verbatim port of upstream `<section
// id="page-pmq">`. The PMQ question host is populated by
// js/04-ui/pmq-questions.js; the four identity inputs + status are read by
// the upstream pmq-continue-btn handler in controls.js.
export default function PagePMQ() {
  return (
    <section id="page-pmq" className="page active" role="tabpanel" aria-labelledby="nav-pmq">
      {/* BOOTH HERO — lifts the trade-booth tagline into the app so the
          in-meeting narrative matches the marketing materials. */}
      <div className="rett-hero">
        <div className="rett-hero-tag">
          ONE PLAN. ONE PLACE. <span className="rett-hero-tag-em">A BETTER EXIT.</span>
        </div>
        <p className="rett-hero-sub">
          A tax-efficient strategy to reduce taxes, protect wealth, and maintain
          control through the sale of real estate.
        </p>
      </div>

      {/* Top row: Client identity card on the left. (Upstream's right-side
          slot for the Client Form compact dropzone is currently empty in
          the source HTML — the TAX DOC dropzone now lives on Client Inputs
          since that's the page it populates.) */}
      <div className="pmq-toprow">
        <div className="pmq-left-col">
          <button
            type="button"
            id="pmq-collapse-btn"
            className="pmq-collapse-btn"
            aria-label="Collapse Pre-Meeting tab"
            title="Collapse Pre-Meeting tab — leaves a small dash in the nav so you can reopen it"
          >
            Collapse &mdash;
          </button>
          {/* Client Information — consolidated per advisor 2026-05-17 (upstream
              commit 049d751). Previously two sections (Client identity +
              Case Management). Now one card holds the canonical name,
              contact info, the load-client combobox, and case actions.
              The legacy split-name inputs (pmq-first-name/pmq-last-name)
              are gone upstream; controls.js no longer reads them.
              All other IDs preserved (case-name-input, pmq-email,
              pmq-phone, case-load-select, case-new-btn, case-delete-btn)
              so controls.js / case-storage.js wiring stays intact.
              case-load-select is now an `<input list>` combobox backed by
              `<datalist id="case-load-options">` — the advisor can either
              click open the saved-client dropdown or just type the name. */}
          <div className="input-section pmq-client-section pmq-case-section">
            <div className="section-heading">
              <h2>Client Information</h2>
              <span className="num">SECTION 00</span>
            </div>
            <div className="section-body">
              <div className="input-row">
                <div className="label">Client Name</div>
                <input type="text" id="case-name-input" placeholder="e.g. John Smith" autoComplete="off" maxLength={80} />
              </div>
              <div className="input-row">
                <div className="label">Email</div>
                <input type="email" id="pmq-email" autoComplete="email" maxLength={120} placeholder="jane@example.com" />
              </div>
              <div className="input-row">
                <div className="label">Phone</div>
                <input type="tel" id="pmq-phone" autoComplete="tel" maxLength={32} placeholder="(555) 555-1234" />
              </div>
              <div className="input-row">
                <div className="label">Load Client</div>
                <input type="text" id="case-load-select" list="case-load-options" placeholder="Type or pick a saved client" autoComplete="off" maxLength={80} />
                <datalist id="case-load-options" />
              </div>
              {/* Custodian moved here from Tab 1 Section 01 per advisor
                  2026-05-26 (upstream commit ad2b96c). Options populated by
                  controls.js _populateCustodian() from custodians.js. */}
              <div className="input-row">
                <div className="label">Custodian</div>
                <select id="custodian-select" required aria-required="true" defaultValue="" />
              </div>
              <div className="input-row">
                <div className="label">Case Actions</div>
                <div className="case-actions-row">
                  <button type="button" className="btn btn-primary" id="case-new-btn">New Client</button>
                  <button type="button" className="btn btn-secondary" id="case-delete-btn">Delete</button>
                </div>
              </div>
              <div id="pmq-client-status" className="pmq-client-status" aria-live="polite" />
            </div>
          </div>

          {/* Filing Information — moved from Tab 1 Section 01 to Tab 0 per
              advisor 2026-05-27 (upstream commit 8064456). The canonical IDs
              year1, filing-status, state-code now live here. The State
              <option> list is populated at runtime by us-states.js — DO
              NOT hardcode it. */}
          <div className="input-section pmq-client-section">
            <div className="section-heading">
              <h2>Filing Information</h2>
              <span className="num">SECTION 01</span>
            </div>
            <div className="section-body">
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
                {/* Populated at runtime by us-states.js (upstream wires it
                    inline in index.html). Leaving children empty matches
                    upstream's bare `<select id="state-code"></select>`. */}
                <select id="state-code" defaultValue="" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PMQ question host — upstream 2026-05-27 (commit fa0f000-ish) gutted
          the question host: the sole question ("Do you own or run a
          business?") is retired. Element kept (hidden) so any
          renderPMQQuestions() probes by case-storage.js / controls.js no-op
          cleanly. */}
      <div id="pmq-question-host" className="pmq-question-host" hidden />

      <div className="page-actions">
        <div className="actions-left">
          <button type="button" id="pmq-reset-btn" className="btn btn-secondary" aria-label="Reset Pre-Meeting fields">
            Reset Form
          </button>
        </div>
        <div className="actions-right">
          <button type="button" id="pmq-continue-btn" className="btn btn-primary">
            Continue Forward &rarr;
          </button>
        </div>
      </div>
    </section>
  );
}
