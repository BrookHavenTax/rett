function RettMarkIcon() {
  return (
    <img
      src="/assets/rett-mark-icon.svg"
      alt=""
      className="header-brand__icon"
      width={42}
      height={56}
      decoding="async"
      aria-hidden="true"
    />
  );
}

export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        {/* Unified brand lockup: icon + RETT entity name + product subtitle.
            <h1> kept for admin-math-panel.js double/triple-click unlock. */}
        <h1
          className="header-brand"
          title="Double-click to unlock admin mode • Triple-click to log out"
        >
          <RettMarkIcon />
          <span className="header-brand__text">
            <span className="header-brand__primary">
              <span className="header-brand__name">
                RETT
                <sup className="header-brand__tm" aria-hidden="true">&trade;</sup>
                <span className="visually-hidden">, trademark</span>
              </span>
              <span className="header-brand__dash" aria-hidden="true">&mdash;</span>
              <span className="header-brand__entity">Real Estate Transition Trust</span>
            </span>
            <span className="header-brand__product">Multi-Year Tax Strategy Projector</span>
          </span>
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
