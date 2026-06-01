/** RETT wordmark — traced icon + type, fused into the dark header (no white card). */
function RettMarkIcon() {
  return (
    <svg
      className="rett-logo-lockup__icon"
      viewBox="0 0 43 56"
      width={33}
      height={44}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#8DD4F2"
        d="M 0.594 17.018 L 8.707 17.018 L 9.498 30.869 L 18.205 39.774 L 17.413 55.604 L 9.102 55.604 L 0 23.943 Z"
      />
      <path
        fill="#8DD4F2"
        d="M 12.466 8.707 L 21.173 8.707 L 21.371 29.484 L 30.078 44.325 L 30.078 55.208 L 20.382 55.208 L 12.269 15.791 Z"
      />
      <path
        fill="#8DD4F2"
        d="M 26.12 0 L 32.452 0 L 33.442 31.661 L 41.951 48.481 L 41.951 55.406 L 32.452 55.406 L 23.943 2.968 Z"
      />
    </svg>
  );
}

export default function RettLogoLockup() {
  return (
    <span className="rett-logo-lockup">
      <RettMarkIcon />
      <span className="rett-logo-lockup__type">
        <span className="rett-logo-lockup__name">
          RETT
          <sup className="rett-logo-lockup__tm" aria-hidden="true">
            &trade;
          </sup>
        </span>
        <span className="rett-logo-lockup__tag">Real Estate Transition Trust</span>
      </span>
    </span>
  );
}
