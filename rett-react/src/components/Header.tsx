export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <h1>
          RETT<sup className="rett-tm" aria-hidden="true">&trade;</sup>
          <span className="visually-hidden">, trademark</span>
        </h1>
        <span className="header-dash" aria-hidden="true">&mdash;</span>
        <div className="header-tagline">
          <div className="header-line-1">Real Estate Transition Trust</div>
          <div className="header-line-2">Multi-Year Tax Strategy Projector</div>
        </div>
      </div>
      <div className="header-right">
        {/* ADMIN badge (upstream 2026-05-25 commit a7e6b0e + 8bee451).
            Hidden by default; shown when admin mode is unlocked via
            triple-click on the RETT logo. Click to lock. NOT a security
            boundary — the panel content is computed in-page and viewable
            via devtools regardless. js/04-ui/admin-math-panel.js wires
            this button. */}
        <button
          type="button"
          id="rett-admin-badge"
          className="rett-admin-badge"
          hidden
          aria-label="Admin mode unlocked - click to lock"
          title="Admin mode unlocked. Click to lock."
        >
          ADMIN
        </button>
        <div className="header-bh-mark">BrookHaven</div>
        <div className="header-bh-sub">Integrated Wealth Solutions</div>
        <div className="header-bh-tag">A Multi-Family Office</div>
      </div>
    </header>
  );
}
