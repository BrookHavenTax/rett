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
        <div className="header-bh-mark">BrookHaven</div>
        <div className="header-bh-sub">Integrated Wealth Solutions</div>
        <div className="header-bh-tag">A Multi-Family Office</div>
      </div>
    </header>
  );
}
