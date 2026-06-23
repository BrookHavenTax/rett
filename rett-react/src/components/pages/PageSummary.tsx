// Strategy Summary. js/04-ui/strategy-summary-render.js populates
// #strategy-fee-summary-host. The Print / Save-as-PDF button is wired by
// js/04-ui/controls.js (window.print() with body.print-mode toggling).
//
// The Agreement Letter button was removed 2026-06-15 (upstream index.html)
// — the engagement agreement is handled outside this tool now. The single
// Print / Save-as-PDF control renders the one-page client leave-behind.
// key-points-export.js also self-injects an admin-only "Export Key Points"
// button into this .print-cta-row when admin mode is unlocked.
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
      </div>
    </section>
  );
}
