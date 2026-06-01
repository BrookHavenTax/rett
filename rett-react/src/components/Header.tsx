export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        {/* Official RETT wordmark + icon (replaces the CSS bar-chart
            ::before glyph and separate RETT™ + tagline text). The <h1>
            wrapper is kept so admin-math-panel.js can attach its double-
            click / triple-click unlock handler to
            `header.header .header-left h1`. */}
        <h1
          className="header-logo-wrap"
          title="Double-click to unlock admin mode • Triple-click to log out"
        >
          <img
            src="/assets/rett-logo.png"
            alt="RETT — Real Estate Transition Trust"
            className="header-logo-img"
            width={220}
            height={124}
            decoding="async"
          />
        </h1>
        <p className="header-product-sub">Multi-Year Tax Strategy Projector</p>
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
