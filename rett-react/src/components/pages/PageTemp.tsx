// CPA Verification View — populated by js/04-ui/temp-page-render.js.
// Side-by-side per-year layout. Each year shows: relevance tag (LEFT),
// tax-baseline mini table (CENTER), activity table (RIGHT, phase 2).
export default function PageTemp() {
  return (
    <section id="page-temp" className="page" role="tabpanel" aria-labelledby="nav-temp">
      <div className="temp-page-header">
        <h2 className="page-inputs-title">CPA Verification View</h2>
        <p className="temp-page-sub">
          Per-year tax baselines paired with the strategy activity that
          produced the Strategy Summary numbers. Use this to walk a CPA
          through the math year by year.
        </p>
        <div className="temp-strategy-badge" id="temp-strategy-badge" aria-live="polite" />
      </div>
      <div id="temp-baselines" className="temp-baselines" />
    </section>
  );
}
