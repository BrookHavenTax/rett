export default function Footer() {
  return (
    <footer className="app-compliance" role="contentinfo">
      <div className="compliance-brand">
        <div className="compliance-brand-mark">A BrookHaven Multi-Family Office Strategy</div>
        <ul className="compliance-services" aria-label="BrookHaven service lines">
          <li>
            <span className="compliance-service-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19h16M4 19V8l8-4 8 4v11M9 19v-6h6v6" />
              </svg>
            </span>
            <span className="compliance-service-label">CPA</span>
          </li>
          <li>
            <span className="compliance-service-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v18M5 7h14M3 21h18M6 7v14M18 7v14" />
              </svg>
            </span>
            <span className="compliance-service-label">Law</span>
          </li>
          <li>
            <span className="compliance-service-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l5-6 4 4 8-9M14 6h6v6" />
              </svg>
            </span>
            <span className="compliance-service-label">Investment Management</span>
          </li>
          <li>
            <span className="compliance-service-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
              </svg>
            </span>
            <span className="compliance-service-label">Insurance</span>
          </li>
          <li>
            <span className="compliance-service-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              </svg>
            </span>
            <span className="compliance-service-label">Trustee Services</span>
          </li>
        </ul>
      </div>
      <p className="compliance-line">Information provided should not be considered as tax advice.</p>
      <p className="compliance-attrib">
        RETT&trade; &middot; Real Estate Transition Trust &middot; Trust Company South Dakota (Coming Soon)
      </p>
    </footer>
  );
}
