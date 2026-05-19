// Strategy Selection. Verbatim port of the upstream `<section
// id="page-strategies">` block, including the three SVG lockup graphics
// (cash bag, handshake, lock) that visually anchor each card. Buttons keep
// the upstream data-pick-action / data-pick-target attributes so
// js/04-ui/controls.js wires them up without modification.
export default function PageStrategies() {
  return (
    <section id="page-strategies" className="page" role="tabpanel" aria-labelledby="nav-strategies">
      <div className="strategy-pick-page-header">
        <h2>Strategy Selection</h2>
        <p>Three tailor-made options for the client. Select what the client is interested in.</p>
      </div>

      <div id="strategy-pick-list" className="strategy-pick-grid">
        {/* Card 1 — Normal Sale (Cash in Hand is the keyaspect — the thing
            the strategy delivers, kept in the highlighted box below).
            Renamed from "Proceeds at Sale" -> "Normal Sale" upstream
            (commit 80b7533, 2026-05-18) to match the baseline label
            language Blake wanted advisors to use in front of clients. */}
        <div className="strategy-pick-card" data-strategy="A" id="strategy-pick-A">
          <div className="strategy-pick-card-header">
            <div className="strategy-pick-num">STRATEGY <span className="num-big">01</span></div>
          </div>
          <h3 className="strategy-pick-name">Normal Sale</h3>

          <div className="strategy-keyaspect">
            <div className="strategy-keyaspect-label">Cash In Hand</div>
            <p className="strategy-keyaspect-body">
              Receive the full sale proceeds &mdash; the cash is in your hand,
              with less time to plan.
            </p>
          </div>

          <div className="strategy-lockup-graphic" data-lockup-style="cash">
            <span className="strategy-lockup-icon" aria-hidden="true">
              {/* Money bag falling into an open cupped hand. */}
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M20 5 L28 5" />
                <path d="M21 5 L21 9" />
                <path d="M27 5 L27 9" />
                <path d="M21 9 Q14 12 14 17 Q14 24 24 24 Q34 24 34 17 Q34 12 27 9 Z" />
                <text x="24" y="20" textAnchor="middle" fontFamily="Georgia, serif" fontSize="10" fontWeight="700" stroke="none" fill="currentColor">$</text>
                <path d="M22 27 L24 30 L26 27" />
                <path d="M8 38 Q8 33 14 33 L34 33 Q40 33 40 38 L40 40 Q40 43 36 43 L12 43 Q8 43 8 40 Z" />
              </svg>
            </span>
            <div className="strategy-lockup-text">
              <span className="strategy-lockup-value">Cash In Hand</span>
            </div>
          </div>

          {/* Empty placeholder — reserves the same row as Card 2's default-
              risk toggle so the Interested/Not Interested button row lines
              up horizontally across all three cards. */}
          <div className="strategy-default-risk-row strategy-default-risk-row--spacer" aria-hidden="true" />

          <div className="strategy-pick-buttons">
            <button type="button" className="strategy-pick-btn" data-pick-action="interested"     data-pick-target="A">&#10003; Interested</button>
            <button type="button" className="strategy-pick-btn" data-pick-action="not-interested" data-pick-target="A">Not Interested</button>
          </div>
        </div>

        {/* Card 2 — Installment Sale (payment January 1st — lump) */}
        <div className="strategy-pick-card" data-strategy="B" id="strategy-pick-B">
          <div className="strategy-pick-card-header">
            <div className="strategy-pick-num">STRATEGY <span className="num-big">02</span></div>
          </div>
          <h3 className="strategy-pick-name">Installment Sale</h3>

          <div className="strategy-keyaspect">
            <div className="strategy-keyaspect-label">More Time To Plan</div>
            <p className="strategy-keyaspect-body">
              Negotiate with the buyer to receive payment on January 1 &mdash;
              more time to implement strategies, generating better returns.
            </p>
          </div>

          <div className="strategy-lockup-graphic" data-lockup-style="handshake">
            <span className="strategy-lockup-icon" aria-hidden="true">
              {/* Two hands shaking. */}
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M2 22 L14 22 L20 26 L24 28" />
                <path d="M2 30 L14 30 L20 30" />
                <path d="M46 22 L34 22 L28 26 L24 28" />
                <path d="M46 30 L34 30 L28 30" />
                <path d="M20 26 L28 26" />
                <path d="M19 30 L29 30" />
                <path d="M22 26 L22 30" />
                <path d="M26 26 L26 30" />
              </svg>
            </span>
            <div className="strategy-lockup-text">
              <span className="strategy-lockup-value">Default Risk</span>
              <span className="strategy-lockup-sub">Trust level of buyer</span>
            </div>
          </div>

          {/* Default-risk toggle — click to switch Yes/No. Yes reveals
              Card 3 (Structured Installment Sale) which distributes the
              payment across multiple years to mitigate the risk of buyer
              default. The hidden <select id="default-risk-yes-no"> is the
              original engine input; the toggle writes to it and dispatches
              "change" so all listeners fire. Using <div role="button">
              rather than <button> because a UA rule was beating every CSS
              approach to color the <button> background. */}
          <div className="strategy-default-risk-row">
            <span className="strategy-default-risk-label">Is default risk a concern?</span>
            <div role="button"
                 tabIndex={0}
                 id="default-risk-toggle"
                 className="strategy-default-risk-toggle"
                 data-state="no"
                 aria-pressed="false">No</div>
            <select id="default-risk-yes-no" className="yes-no" hidden aria-hidden="true" defaultValue="no">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          <div className="strategy-pick-buttons">
            <button type="button" className="strategy-pick-btn" data-pick-action="interested"     data-pick-target="B">&#10003; Interested</button>
            <button type="button" className="strategy-pick-btn" data-pick-action="not-interested" data-pick-target="B">Not Interested</button>
          </div>
        </div>

        {/* Card 3 — Structured Installment Sale — hidden by default. Revealed
            when EITHER:
              - the default-risk-yes-no toggle on Card 2 is set to "yes", OR
              - Card 3's net benefit is at least 5% higher than BOTH Card 1
                and Card 2 (engine eval runs on page-strategies entry).
            Layout shifts so Cards 1 + 2 center themselves when Card 3 is hidden. */}
        <div className="strategy-pick-card" data-strategy="C" id="strategy-pick-C" hidden>
          <div className="strategy-pick-card-header">
            <div className="strategy-pick-num">STRATEGY <span className="num-big">03</span></div>
          </div>
          <h3 className="strategy-pick-name">Structured Installment Sale</h3>

          <div className="strategy-keyaspect">
            <div className="strategy-keyaspect-label">Maximum Tax Reduction</div>
            <p className="strategy-keyaspect-body">
              Spread the recognized gain across multiple tax years &mdash;
              offers the highest flexibility.
            </p>
          </div>

          <div className="strategy-lockup-graphic" data-lockup-style="lock">
            <span className="strategy-lockup-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <rect x="10" y="22" width="28" height="20" rx="2.5" />
                <path d="M16 22 L16 16 Q16 8 24 8 Q32 8 32 16 L32 22" />
                <circle cx="24" cy="31" r="2.5" />
                <path d="M24 33.5 L24 37" />
              </svg>
            </span>
            <div className="strategy-lockup-text">
              <span className="strategy-lockup-value" data-lockup-display="C">36 Month Distribution Period</span>
            </div>
          </div>

          {/* Empty placeholder — same height as Card 2's default-risk
              toggle so the buttons line up across all three cards. */}
          <div className="strategy-default-risk-row strategy-default-risk-row--spacer" aria-hidden="true" />

          <div className="strategy-pick-buttons">
            <button type="button" className="strategy-pick-btn" data-pick-action="interested"     data-pick-target="C">&#10003; Interested</button>
            <button type="button" className="strategy-pick-btn" data-pick-action="not-interested" data-pick-target="C">Not Interested</button>
          </div>
        </div>
      </div>

      <div className="strategy-pick-actions">
        <button type="button" id="strategies-back" className="btn btn-secondary">
          &larr; Back to Inputs
        </button>
        <button type="button" id="strategies-continue" className="btn btn-primary">
          Continue to Projection &rarr;
        </button>
      </div>
    </section>
  );
}
