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
          <div className="input-section pmq-client-section">
            <div className="section-heading">
              <h2>Client</h2>
              <span className="num">SECTION 00</span>
            </div>
            <div className="section-body">
              <div className="input-row pmq-input-row-half">
                <div className="label">First name</div>
                <input type="text" id="pmq-first-name" autoComplete="given-name" maxLength={40} placeholder="Jane" />
              </div>
              <div className="input-row pmq-input-row-half">
                <div className="label">Last name</div>
                <input type="text" id="pmq-last-name" autoComplete="family-name" maxLength={40} placeholder="Smith" />
              </div>
              <div className="input-row">
                <div className="label">Email</div>
                <input type="email" id="pmq-email" autoComplete="email" maxLength={120} placeholder="jane@example.com" />
              </div>
              <div className="input-row">
                <div className="label">Phone</div>
                <input type="tel" id="pmq-phone" autoComplete="tel" maxLength={32} placeholder="(555) 555-1234" />
              </div>
              <div id="pmq-client-status" className="pmq-client-status" aria-live="polite" />
            </div>
          </div>
        </div>
      </div>

      {/* Pre-Meeting Questionnaire host — js/04-ui/pmq-questions.js renders
          its question set into this container. The slim hint card is the
          empty-state placeholder shown until the renderer hot-swaps in. */}
      <div id="pmq-question-host" className="pmq-question-host" aria-live="polite">
        <aside className="pmq-hint">
          <span className="pmq-hint-eyebrow">Pre-Meeting Questionnaire</span>
          <p className="pmq-hint-body">
            Answer the questions below to filter which supplemental strategies
            surface on the Strategy Summary, or move to <strong>Client Inputs</strong>{' '}
            to enter the case manually &mdash; the Tax Doc Import there
            pre-populates from a 1040.
          </p>
        </aside>
      </div>

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
