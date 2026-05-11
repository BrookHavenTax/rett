// Tax Baseline. The bt-* table cells are populated by
// js/04-ui/baseline-table.js whenever Section 02–05 inputs change.
export default function PageBaseline() {
  return (
    <section id="page-baseline" className="page" role="tabpanel" aria-labelledby="nav-baseline">
      <h2 className="page-inputs-title">Tax Baseline</h2>
      <div className="baseline-page-wrap">
        <div className="baseline-table-wrapper" id="baseline-table-wrapper">
          <div className="section-heading">
            <h2>Total Tax If You Did Nothing</h2>
            <span className="num" id="baseline-year-tag">2026 PROJECTION</span>
          </div>
          <table className="baseline-table">
            <tbody>
              <tr><td>Ordinary Income</td><td id="bt-ord">$0</td></tr>
              <tr className="indent"><td>W-2 + SE + Business + Rental + Dividend + Retirement</td><td id="bt-ord-sub">$0</td></tr>
              <tr><td>Short-Term Capital Gain</td><td id="bt-stg">$0</td></tr>
              <tr><td>Long-Term Capital Gain</td><td id="bt-ltg">$0</td></tr>
              <tr className="indent"><td>From the property sale (sale &minus; basis &minus; depr)</td><td id="bt-ltg-sub">$0</td></tr>
              <tr><td>Depreciation Recapture</td><td id="bt-recap">$0</td></tr>
              <tr className="indent" style={{ display: 'none' }}><td>&sect;1211(b) capital-loss offset (applied)</td><td id="bt-loss-off">$0</td></tr>
              <tr className="indent" style={{ display: 'none' }}><td>Carried forward to next year</td><td id="bt-loss-cfy">$0</td></tr>
              <tr className="subtotal"><td>Total Taxable Income</td><td id="bt-taxable">$0</td></tr>
              <tr><td>Federal Income Tax</td><td id="bt-fed">$0</td></tr>
              <tr className="indent" style={{ display: 'none' }}><td>&nbsp;&nbsp;Ordinary Income Tax (W-2 + STG)</td><td id="bt-fed-ord">$0</td></tr>
              <tr className="indent" style={{ display: 'none' }}><td>&nbsp;&nbsp;Depreciation Recapture Tax (&sect;1250, capped at 25%)</td><td id="bt-fed-recap">$0</td></tr>
              <tr className="indent" style={{ display: 'none' }}><td>&nbsp;&nbsp;Long-Term Capital Gains Tax</td><td id="bt-fed-lt">$0</td></tr>
              <tr className="indent" style={{ display: 'none' }}><td>&nbsp;&nbsp;AMT Top-up (if applicable)</td><td id="bt-amt">$0</td></tr>
              <tr><td>State Income Tax</td><td id="bt-state">$0</td></tr>
              <tr><td>NIIT (3.8%)</td><td id="bt-niit">$0</td></tr>
              <tr><td>Additional Medicare (0.9%)</td><td id="bt-addmed">$0</td></tr>
              <tr style={{ display: 'none' }}><td>Self-Employment Tax (SECA)</td><td id="bt-setax">$0</td></tr>
              <tr className="total"><td>Total Tax If You Did Nothing</td><td id="bt-tot">$0</td></tr>
            </tbody>
          </table>
        </div>
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
