import { useState } from 'react';

// Nav tab strip. The buttons match upstream `index.html` byte-for-byte —
// upstream's js/04-ui/controls.js attaches click handlers to each button by
// id and calls `showPage(...)` from there. We intentionally do NOT add React
// onClick handlers to those tabs; navigation state is owned by the legacy
// controls.
//
// One tab (`#nav-pmq`) is initially `.active` to match upstream's HTML so
// the page paints correctly during the brief window before `controls.js`
// runs `showPage(startPage)` on engine bootstrap.
//
// ─── React-only addition: Tab 7 reveal toggle ───────────────────────────
// Tab 7 ("7. Temporary" / CPA Verification View) is hidden by default. A
// small "+" toggle button sits to the right of tab 6 (Strategy Summary).
// Clicking it reveals tab 7, jumps to it, and flips itself to "−" so the
// advisor can dismiss tab 7 again (which navigates back to tab 6). The
// state is intentionally NOT persisted to localStorage — every refresh
// returns to the hidden default, matching the user's spec. The visual
// styling mirrors the upstream `.nav-pmq-restore` dash so the two toggles
// feel like the same family.
export default function NavTabs() {
  const [tempVisible, setTempVisible] = useState<boolean>(false);

  function showTab7() {
    setTempVisible(true);
    const w = window as unknown as { showPage?: (id: string) => void };
    if (typeof w.showPage === 'function') {
      w.showPage('page-temp');
    } else {
      // Fallback: click the now-revealed tab so controls.js handles it.
      document.getElementById('nav-temp')?.click();
    }
  }

  function hideTab7() {
    setTempVisible(false);
    const w = window as unknown as { showPage?: (id: string) => void };
    if (typeof w.showPage === 'function') {
      w.showPage('page-allocator');
    } else {
      document.getElementById('nav-allocator')?.click();
    }
  }

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
      {/* React-only toggle pair. "+" sits to the right of tab 6 and is
          shown when tab 7 is hidden; clicking it reveals tab 7 and
          navigates to it. "−" sits to the right of tab 7 and is shown
          only when tab 7 is visible; clicking it hides tab 7 and returns
          to tab 6. State resets to hidden on refresh by design. */}
      <button
        id="nav-temp-show"
        className="nav-tab nav-temp-toggle"
        type="button"
        aria-label="Show CPA Verification View"
        title="Reveal Tab 7 — CPA Verification View"
        onClick={showTab7}
        hidden={tempVisible}
      >+</button>
      <button
        id="nav-temp"
        className="nav-tab"
        role="tab"
        aria-selected="false"
        aria-controls="page-temp"
        type="button"
        hidden={!tempVisible}
      >7. Temporary</button>
      <button
        id="nav-temp-hide"
        className="nav-tab nav-temp-toggle"
        type="button"
        aria-label="Hide CPA Verification View"
        title="Hide CPA Verification View — returns to Strategy Summary"
        onClick={hideTab7}
        hidden={!tempVisible}
      >{'\u2212'}</button>
    </nav>
  );
}
