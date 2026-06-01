import RettLogoLockup from './RettLogoLockup';

export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        {/* Official RETT wordmark (icon + RETT™ + entity) on white, matching
            the brand PNG. <h1> kept for admin-math-panel.js unlock clicks. */}
        <h1
          className="header-brand"
          title="Double-click to unlock admin mode • Triple-click to log out"
        >
          <div className="header-brand__stack">
            <div className="header-brand__lockup">
              <RettLogoLockup />
            </div>
            <p className="header-brand__product">Multi-Year Tax Strategy Projector</p>
          </div>
        </h1>
      </div>
      <div className="header-right">
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
