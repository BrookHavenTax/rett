import RettLogoLockup from './RettLogoLockup';

export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        {/* Fused brand lockup — icon + wordmark sit directly on the header bar. */}
        <h1
          className="header-brand"
          title="Double-click to unlock admin mode • Triple-click to log out"
        >
          <RettLogoLockup />
          <p className="header-brand__product">Multi-Year Tax Strategy Projector</p>
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
