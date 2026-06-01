/** RETT wordmark — official icon raster + type, fused into the dark header. */
export default function RettLogoLockup() {
  return (
    <span className="rett-logo-lockup">
      <img
        src="/assets/rett-icon.png"
        alt=""
        className="rett-logo-lockup__icon"
        width={230}
        height={306}
        decoding="async"
        draggable={false}
        aria-hidden="true"
      />
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
