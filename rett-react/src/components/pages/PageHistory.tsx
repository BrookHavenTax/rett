// Saved Flows history — populated by rett-react-only/cloud-sync.js.
// Lists every RETT workflow saved to the shared database (completed and
// in-progress), with Open/Delete per row. React renders the scaffold only;
// the cloud-sync module owns the data and the DOM inside #history-list-host,
// matching the legacy-renderer pattern used by every other page.
//
// NOTE: `page-history` is intentionally NOT in controls.js PAGE_IDS (that
// file is an upstream rsync mirror). cloud-sync.js wraps window.showPage to
// hide this section on normal navigation and provides
// window.__rettShowHistoryPage() to activate it.
export default function PageHistory() {
  return (
    <section id="page-history" className="page" role="tabpanel" aria-labelledby="nav-history">
      <div className="history-page-header">
        <h2 className="page-inputs-title">Saved Flows</h2>
        <p className="history-page-sub">
          Every RETT workflow auto-saves here as you work — in progress and
          completed. Open any flow to pick up exactly where it left off.
        </p>
        <div className="history-toolbar">
          <button id="history-refresh-btn" className="btn btn-secondary" type="button">
            Refresh
          </button>
          <span id="history-sync-status" className="history-sync-status" aria-live="polite" />
        </div>
      </div>
      <div id="history-list-host" className="history-list-host" aria-live="polite" />
    </section>
  );
}
