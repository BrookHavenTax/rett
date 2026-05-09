// Supplemental Strategies. Cards are rendered by
// js/04-ui/supplemental-render.js (2 cards) and supplemental-extra-render.js
// (8 cards) into the two host divs below. The single shared
// .supp-all-grid wrapper makes them flow continuously instead of breaking
// into two grids — both inner hosts use display:contents.
export default function PageSupplemental() {
  return (
    <section id="page-supplemental" className="page" role="tabpanel" aria-labelledby="nav-supplemental">
      <header className="page-supplemental-header">
        <h2>Supplemental Strategies</h2>
        <div className="supp-header-actions">
          <button
            type="button"
            className="btn btn-secondary supp-reset-btn"
            id="supp-reset-selections-btn"
            title="Clear every Interested / Not Interested pick on this page"
          >
            Reset Selections
          </button>
          <button
            type="button"
            className="btn btn-primary supp-advance-btn"
            onClick={() => document.getElementById('nav-allocator')?.click()}
          >
            Advance to Strategy Summary &rarr;
          </button>
        </div>
      </header>

      <div className="supp-all-grid">
        <div id="supplemental-strategies-host" aria-live="polite" />
        <div id="supplemental-extra-host" aria-live="polite" />
      </div>

      <div className="page-supplemental-actions">
        <button type="button" id="supplemental-continue" className="btn btn-primary">
          Continue to Summary &rarr;
        </button>
      </div>
    </section>
  );
}
