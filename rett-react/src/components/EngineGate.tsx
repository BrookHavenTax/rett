import type { EngineStatus } from '../hooks/useLegacyEngine';

interface Props { status: EngineStatus }

export default function EngineGate({ status }: Props) {
  if (status.state === 'ready') return null;

  if (status.state === 'error') {
    return (
      <div className="engine-overlay engine-overlay--error" role="alertdialog">
        <div className="engine-overlay__card">
          <h2 className="engine-overlay__title">Calculator failed to load</h2>
          <p className="engine-overlay__sub">{status.message}</p>
          <p className="engine-overlay__sub" style={{ marginTop: 8 }}>
            Check the browser console for details, then reload the page.
          </p>
        </div>
      </div>
    );
  }

  const pct = Math.round((status.loaded / status.total) * 100);
  return (
    <div className="engine-overlay" role="status" aria-live="polite">
      <div className="engine-overlay__card">
        <h2 className="engine-overlay__title">Loading tax engine</h2>
        <p className="engine-overlay__sub">
          Bootstrapping calculator subsystems and 50-state bracket data.
        </p>
        <div className="engine-overlay__bar"><div style={{ width: `${pct}%` }} /></div>
        <div className="engine-overlay__pct">
          {status.loaded} / {status.total} modules &middot; {pct}%
        </div>
      </div>
    </div>
  );
}
