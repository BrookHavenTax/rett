import { useEffect, useState } from 'react';

// Mirrors the upstream `<script>` tags from index.html (the "Subsystem load
// order: 00 -> 01 -> 02 -> 03 -> 05 -> 04" block) byte-for-byte. Every
// upstream module is loaded so the React app behaves identically to the
// upstream HTML site.
//
// 2026-05-29 sync notes:
// - Added 03-solver/additional-funds.js (new Section 03 optimizer).
// - Added 04-ui/us-states.js (state list + helpers, used by Tab 0 state
//   selector now that filing info moved to PMQ).
// - Added 8 new admin-math-page-*.js modules + admin-math-panel.js for
//   the triple-click-logo "admin reveal mode".
// - pmq-questions.js was dropped from upstream's script list this round
//   (the PMQ host is now populated by pmq-handler.js + admin-math hooks
//   instead). We drop it from our loader to match.
// - pmq-handler.js stays NOT loaded — it runs upstream's <details>-buried
//   "TAX DOC" Gemini dropzone, which required the advisor to paste their
//   own Gemini key. Replaced by the React `W2Uploader` component which
//   calls /api/gemini/extract-w2 on our same-origin Express proxy.
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
  '03-solver/additional-funds.js',
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
  '04-ui/us-states.js',
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
  '04-ui/temp-page-render.js',
  // Admin math reveal mode — triple-click logo to unlock, then per-tab
  // hidden math panels populate from each renderer. admin-math-panel.js
  // is the host + lock/unlock + storage; the 7 admin-math-page-*.js
  // modules each render one tab's reveal panel.
  '04-ui/admin-math-panel.js',
  // Admin-only "Export Key Points" PDF (preview modal + per-tab button).
  // Self-injects a hidden button into #page-allocator .print-cta-row and a
  // generated row on #page-temp; shown only when admin mode is unlocked.
  // Must load after admin-math-panel.js (which calls back into
  // __rettRefreshKeyPointsButtons on unlock), matching upstream order.
  '04-ui/key-points-export.js',
  '04-ui/admin-math-page-inputs.js',
  '04-ui/admin-math-page-baseline.js',
  '04-ui/admin-math-page-strategies.js',
  '04-ui/admin-math-page-projection.js',
  '04-ui/admin-math-page-supplemental.js',
  '04-ui/admin-math-page-allocator.js',
  '04-ui/admin-math-page-temp.js',
  // defaults LAST per upstream comment
  '01-brooklyn/defaults.js',
];

const SCRIPT_BASE = '/legacy/js/';

export type EngineStatus =
  | { state: 'loading'; loaded: number; total: number }
  | { state: 'ready' }
  | { state: 'error'; message: string };

let bootstrapPromise: Promise<void> | null = null;

// One transient blip used to abort the whole bootstrap: a single <script>
// onerror would reject and surface "Failed to load <module>.js". The most
// common trigger is a keep-alive socket race — Node closes an idle HTTP/1.1
// keep-alive connection (default 5s) right as the browser reuses it for the
// next sequential /legacy/js/*.js request, yielding ECONNRESET with no
// browser-level retry. A momentary 403 right at unlock has the same effect.
// With ~55 scripts loaded one-by-one on every refresh, even a tiny per-request
// failure rate compounds. So each load gets a few bounded retries with
// exponential backoff + jitter; only a persistent failure aborts the boot.
const MAX_LOAD_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 150;

const cacheBuster = () =>
  `?v=${import.meta.env.MODE === 'development' ? Date.now() : '1'}`;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// A single injection attempt. Resolves on load. On error it removes the failed
// element BEFORE rejecting, so the dedup guard doesn't short-circuit the retry
// to a (false) success on the dead <script> still sitting in the DOM.
function injectScriptOnce(url: string, attr: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[${attr}="${key}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = url + cacheBuster();
    el.async = false; // preserve insertion order
    el.setAttribute(attr, key);
    el.onload = () => resolve();
    el.onerror = () => {
      el.remove();
      reject(new Error('Failed to load ' + key));
    };
    document.head.appendChild(el);
  });
}

async function loadWithRetry(url: string, attr: string, key: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_LOAD_ATTEMPTS; attempt++) {
    try {
      await injectScriptOnce(url, attr, key);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_LOAD_ATTEMPTS) {
        await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 100);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Failed to load ' + key);
}

function loadOne(src: string): Promise<void> {
  return loadWithRetry(SCRIPT_BASE + src, 'data-rett-legacy', src);
}

// React-only legacy mirrors — files that upstream embeds as INLINE
// <script> blocks in index.html, which we can't host the same way in
// a Vite build. Each one is a verbatim copy of the inline script body
// with the inner DOMContentLoaded handler rewrapped behind a
// readyState-guard. They live OUTSIDE public/legacy/js/ on purpose —
// the sync-from-upstream rsync mirror uses --delete on those subfolders.
const REACT_ONLY_SCRIPTS: ReadonlyArray<string> = [
  '/rett-react-only/additional-funds-ui.js',
];

function loadReactOnly(absSrc: string): Promise<void> {
  return loadWithRetry(absSrc, 'data-rett-react-only', absSrc);
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

  // React-only inline-script mirrors (Additional Funds UI etc.). Loaded
  // AFTER tax data + all upstream modules so they can call back into
  // window.rettSuggestAdditionalFunds (defined in additional-funds.js).
  for (const src of REACT_ONLY_SCRIPTS) {
    await loadReactOnly(src);
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
