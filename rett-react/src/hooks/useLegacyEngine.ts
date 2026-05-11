import { useEffect, useState } from 'react';

// Mirrors the upstream `<script>` tags from index.html (the "Subsystem load
// order: 00 -> 01 -> 02 -> 03 -> 05 -> 04" block) byte-for-byte. Every
// upstream module is loaded so the React app behaves identically to the
// upstream HTML site — including pmq-handler.js (the W-2 / 1040 Gemini
// autofill) and pmq-questions.js (the Pre-Meeting Questionnaire).
const LEGACY_SCRIPTS: ReadonlyArray<string> = [
  // 01 (date-utils first so 00-data can use parseLocalDate)
  '01-brooklyn/date-utils.js',
  // 00
  '00-data/custodians.js',
  '00-data/schwab-strategies.js',
  // 01 (rest)
  '01-brooklyn/brooklyn-data.js',
  '01-brooklyn/time-weight.js',
  '01-brooklyn/brooklyn-interpolation.js',
  '01-brooklyn/variable-leverage.js',
  // 02
  '02-tax-engine/tax-data.js',
  '02-tax-engine/tax-loader.js',
  '02-tax-engine/tax-lookups.js',
  '02-tax-engine/tax-calc-federal.js',
  '02-tax-engine/tax-calc-state.js',
  '02-tax-engine/tax-comparison.js',
  '02-tax-engine/engine-self-test.js',
  // 03
  '03-solver/fees.js',
  '03-solver/fee-split.js',
  '03-solver/brookhaven-fees.js',
  '03-solver/single-year-solver.js',
  '03-solver/multi-year-solver.js',
  '03-solver/structured-sale.js',
  '03-solver/calc-oil-gas.js',
  '03-solver/calc-delphi.js',
  '03-solver/calc-supplemental-extra.js',
  '03-solver/decision-engine.js',
  '03-solver/master-solver.js',
  '03-solver/supplemental-defaults.js',
  '03-solver/supplemental-extra-registry.js',
  '03-solver/supplemental-investment-shims.js',
  // 05
  '05-projections/carryforward-tracker.js',
  '05-projections/projection-engine.js',
  // 04
  '04-ui/format-helpers.js',
  '04-ui/money-format.js',
  '04-ui/banner.js',
  '04-ui/number-animator.js',
  '04-ui/case-storage.js',
  '04-ui/pill-toggles.js',
  '04-ui/variable-leverage-ui.js',
  '04-ui/input-validation.js',
  '04-ui/inputs-collector.js',
  '04-ui/controls.js',
  '04-ui/recommendation-render.js',
  '04-ui/projection-dashboard-render.js',
  '04-ui/savings-ribbon.js',
  '04-ui/cashflow-schedule-render.js',
  '04-ui/narrative-render.js',
  '04-ui/strategy-summary-render.js',
  '04-ui/baseline-table.js',
  '04-ui/supplemental-render.js',
  '04-ui/supplemental-extra-render.js',
  // pmq-handler.js is intentionally NOT loaded — it ran the upstream's
  // <details>-buried "TAX DOC" Gemini dropzone, which was hard to discover
  // and required the advisor to paste their own Gemini key. Replaced by
  // the React `W2Uploader` component embedded directly inside Section 02
  // (Income Sources). The new component calls /api/gemini/extract-w2 on
  // the same-origin Express proxy, so the Gemini key stays server-side
  // and the advisor never has to think about it.
  '04-ui/pmq-questions.js',
  '04-ui/temp-page-render.js',
  // defaults LAST per upstream comment
  '01-brooklyn/defaults.js',
];

const SCRIPT_BASE = '/legacy/js/';

export type EngineStatus =
  | { state: 'loading'; loaded: number; total: number }
  | { state: 'ready' }
  | { state: 'error'; message: string };

let bootstrapPromise: Promise<void> | null = null;

function loadOne(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-rett-legacy="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = SCRIPT_BASE + src + `?v=${import.meta.env.MODE === 'development' ? Date.now() : '1'}`;
    el.async = false; // preserve insertion order
    el.dataset.rettLegacy = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(el);
  });
}

async function bootstrap(onProgress: (loaded: number) => void): Promise<void> {
  for (let i = 0; i < LEGACY_SCRIPTS.length; i++) {
    await loadOne(LEGACY_SCRIPTS[i]);
    onProgress(i + 1);
  }
  // Tax bracket JSON. The upstream loader fetches a relative URL; we hand
  // it an absolute one so it works regardless of the current React route.
  if (typeof window.loadTaxData === 'function') {
    await window.loadTaxData('/data/taxBrackets.json');
  } else {
    throw new Error('loadTaxData not on window after legacy bootstrap');
  }

  // Drop the un-named draft slot before controls.js's restoreOnPageLoad
  // runs. Upstream auto-saves the form to `rett_workingState` whenever no
  // Client Name has been typed, so a stray refresh used to leave the form
  // populated with the previous session's values. We clear it ONLY when
  // there isn't an active named case — named cases (rett_currentCase +
  // rett_cases[name]) are the production persistence path and still
  // auto-restore as the upstream intends.
  try {
    const current = window.localStorage.getItem('rett_currentCase') || '';
    if (!current.trim()) {
      window.localStorage.removeItem('rett_workingState');
    }
  } catch {
    /* private mode / quota / disabled storage — ignore */
  }

  // Upstream `controls.js` registers `bindControls` and `_syncPmqNameFromCase`
  // unconditionally on `DOMContentLoaded` (lines 1187 + 1782). Every other
  // upstream module guards with `if (document.readyState === 'loading')` and
  // self-inits otherwise, but controls.js doesn't — so when our loader
  // injects scripts after the page is already loaded, those listeners are
  // dead on arrival. Call them by hand. They're top-level function
  // declarations in a classic (non-module) script, so they're global on
  // window. Both are idempotent... ALMOST: bindControls re-attaches click
  // listeners on every call, so calling it twice produces duplicate
  // listeners (manifests as the "Reset Form" double-confirm bug). For that
  // reason we deliberately do NOT also dispatch a synthetic DOMContentLoaded
  // event — every other module has already self-initialized via the
  // readyState check before its <script> finished evaluating.
  const w = window as unknown as Record<string, () => void>;
  if (typeof w.bindControls === 'function') {
    w.bindControls();
  }
  if (typeof w._syncPmqNameFromCase === 'function') {
    w._syncPmqNameFromCase();
  }

  window.__rettEngineReady = true;
}

export function useLegacyEngine(): EngineStatus {
  const [status, setStatus] = useState<EngineStatus>({
    state: 'loading',
    loaded: 0,
    total: LEGACY_SCRIPTS.length,
  });

  useEffect(() => {
    if (!bootstrapPromise) {
      bootstrapPromise = bootstrap((loaded) =>
        setStatus({ state: 'loading', loaded, total: LEGACY_SCRIPTS.length }),
      );
    }
    let cancelled = false;
    bootstrapPromise
      .then(() => {
        if (!cancelled) setStatus({ state: 'ready' });
      })
      .catch((err: Error) => {
        if (!cancelled) setStatus({ state: 'error', message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
