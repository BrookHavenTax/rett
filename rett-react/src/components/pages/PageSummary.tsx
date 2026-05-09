// Strategy Summary. js/04-ui/strategy-summary-render.js populates
// #strategy-fee-summary-host. The Print / Save-as-PDF button is wired by
// js/04-ui/controls.js (window.print() with body.print-mode toggling) and
// the Agreement Letter is a static .docx download served from /assets/.
export default function PageSummary() {
  return (
    <section id="page-allocator" className="page" role="tabpanel" aria-labelledby="nav-allocator">
      {/* Print-only header. Hidden on screen; populated by
          strategy-summary-render at render time with the client name +
          state + tax year so the printout has a proper title block. */}
      <div className="print-header" id="print-header" aria-hidden="true">
        <div className="print-header-brand">
          <span className="print-header-logo">BROOKHAVEN</span>
          <span className="print-header-rett">RETT<sup>&trade;</sup></span>
        </div>
        <div className="print-header-meta">
          <div className="print-header-client" id="print-header-client">&mdash;</div>
          <div className="print-header-sub" id="print-header-sub">&mdash;</div>
        </div>
      </div>

      <div id="strategy-fee-summary-host" aria-live="polite" />

      {/* Single Download PDF button at the BOTTOM of the page (per advisor
          spec). Triggers the browser's native print dialog where the
          destination dropdown offers "Save as PDF". body.print-mode is
          toggled around the render so the print-mode CSS rules apply during
          the snapshot. Native Cmd/Ctrl-P also works as a fallback — same
          body.print-mode flips on beforeprint. */}
      <div className="print-cta-row no-print">
        <button type="button" className="cta-btn" id="print-summary-btn">
          &#128424; Print / Save as PDF
        </button>
        <a
          href="/assets/BrookHaven_Engagement_Agreement.docx"
          className="cta-btn cta-btn-secondary"
          id="agreement-letter-btn"
          download="BrookHaven Engagement Agreement.docx"
        >
          &#128221; Agreement Letter
        </a>
      </div>
    </section>
  );
}
