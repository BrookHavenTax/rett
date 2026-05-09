// Nav tab strip. The buttons match upstream `index.html` byte-for-byte —
// upstream's js/04-ui/controls.js attaches click handlers to each button by
// id and calls `showPage(...)` from there. We intentionally do NOT add React
// onClick handlers here; navigation state is owned by the legacy controls.
//
// One tab (`#nav-pmq`) is initially `.active` to match upstream's HTML so
// the page paints correctly during the brief window before `controls.js`
// runs `showPage(startPage)` on engine bootstrap.
export default function NavTabs() {
  return (
    <nav className="nav" role="tablist" aria-label="Workflow steps">
      <button id="nav-pmq"          className="nav-tab active" role="tab" aria-selected="true"  aria-controls="page-pmq"          type="button">0. Pre-Meeting</button>
      {/* Tiny dash that replaces the Pre-Meeting tab when collapsed.
          Hidden by default; shown when body.pmq-collapsed is set. Click
          reopens the Pre-Meeting tab. Wired in controls.js. */}
      <button id="nav-pmq-restore"  className="nav-pmq-restore" type="button" aria-label="Reopen Pre-Meeting" title="Reopen Pre-Meeting — leaves a small dash in the nav so you can reopen it" hidden>&minus;</button>
      <button id="nav-inputs"       className="nav-tab" role="tab" aria-selected="false" aria-controls="page-inputs"       type="button">1. Client Inputs</button>
      <button id="nav-baseline"     className="nav-tab" role="tab" aria-selected="false" aria-controls="page-baseline"     type="button">2. Tax Baseline</button>
      <button id="nav-strategies"   className="nav-tab" role="tab" aria-selected="false" aria-controls="page-strategies"   type="button">3. Strategies</button>
      <button id="nav-projection"   className="nav-tab" role="tab" aria-selected="false" aria-controls="page-projection"   type="button">4. Projection</button>
      <button id="nav-supplemental" className="nav-tab" role="tab" aria-selected="false" aria-controls="page-supplemental" type="button">5. Supplemental Strategies</button>
      <button id="nav-allocator"    className="nav-tab" role="tab" aria-selected="false" aria-controls="page-allocator"    type="button">6. Strategy Summary</button>
      <button id="nav-temp"         className="nav-tab" role="tab" aria-selected="false" aria-controls="page-temp"         type="button">7. Temporary</button>
    </nav>
  );
}
