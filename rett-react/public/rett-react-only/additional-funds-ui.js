// React-only mirror of the inline <script> block at the bottom of upstream
// index.html (after the additional-funds.js solver was added, 2026-05-28).
// Upstream runs it as an inline <script>; we can't host inline <script>s
// the same way in a React/Vite build, so this is a verbatim copy of the
// IIFE body with two adjustments:
//
//   1. The DOMContentLoaded handler is rewrapped with a `readyState ===
//      "loading"` guard so it self-inits when our loader injects it after
//      the document has already loaded.
//   2. Comments updated to call out (1) and the file location.
//
// IMPORTANT: this file lives outside public/legacy/js/ on purpose — the
// sync-from-upstream rsync mirror uses --delete on those subfolders, and
// would wipe this file on every sync. Keep it under
// public/rett-react-only/.
//
// Wires the Additional Funds (Tab 1 Section 03) UI:
//   - Yes/No gate reveals/hides the field group (mirrors Future Sale).
//   - Derived Cost Basis = Account Value − LT gain − ST gain (live).
//   - Proportional realized-gain breakdown when an Additional Funds
//     amount is entered (lt = X × lt/av, st = X × st/av, basis returned
//     = rest).
//   - Auto-populates the "Additional Funds" field with the optimal
//     liquidation amount from window.rettSuggestAdditionalFunds()
//     (additional-funds.js). The advisor can type their own number to
//     override; clearing the field resumes auto-population.
//   - Debounces re-population on any income / sale / strategy /
//     custodian / state input change.
(function () {
  function _el(id) { return document.getElementById(id); }
  function _num(v) {
    if (typeof window.parseUSD === 'function') return window.parseUSD(v) || 0;
    var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }
  function _fmtUSD(n) {
    if (typeof window.fmtUSD === 'function') return window.fmtUSD(n);
    var sign = n < 0 ? '-' : '';
    return sign + '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
  }

  var _afUserOverride = false;   // advisor typed their own Additional Funds amount
  var _afProgrammatic = false;   // guard while we write the field ourselves

  function _sync() {
    var av = _el('additional-account-value'), cb = _el('additional-cost-basis-derived');
    if (!av || !cb) return;
    var avV = _num(av.value),
        ltV = _num((_el('additional-lt-gain') || {}).value),
        stV = _num((_el('additional-st-gain') || {}).value);
    cb.value = (avV === 0 && ltV === 0 && stV === 0) ? '' : _fmtUSD(avV - ltV - stV);
    _syncBreakdown(avV, ltV, stV);
  }
  function _syncBreakdown(avV, ltV, stV) {
    var bd = _el('additional-funds-breakdown'), fundsEl = _el('additional-funds');
    if (!bd || !fundsEl) return;
    var contribution = _num(fundsEl.value);
    if (contribution <= 0 || avV <= 0) { bd.hidden = true; return; }
    var capped = Math.min(contribution, avV);
    var ltRe = capped * (ltV / avV), stRe = capped * (stV / avV), basisRe = capped - ltRe - stRe;
    _el('afb-amount').textContent = _fmtUSD(capped);
    _el('afb-lt').textContent = _fmtUSD(ltRe);
    _el('afb-st').textContent = _fmtUSD(stRe);
    _el('afb-basis').textContent = _fmtUSD(basisRe);
    bd.hidden = false;
  }

  function _autoPopulate() {
    var fundsEl = _el('additional-funds'), note = _el('additional-funds-auto-note');
    if (!fundsEl) return;
    if (_afUserOverride) { if (note) note.hidden = true; return; }
    var sug = null;
    if (typeof window.rettSuggestAdditionalFunds === 'function') {
      try { sug = window.rettSuggestAdditionalFunds(); } catch (e) { sug = null; }
    }
    _afProgrammatic = true;
    if (sug != null && isFinite(sug) && sug > 0) {
      fundsEl.value = _fmtUSD(sug);
      if (note) { note.textContent = 'optimal \u00b7 editable'; note.hidden = false; }
    } else {
      fundsEl.value = '';
      if (note) note.hidden = true;
    }
    fundsEl.dispatchEvent(new Event('change', { bubbles: true }));
    _afProgrammatic = false;
    _sync();
  }
  var _afTimer = null;
  function _autoPopulateDebounced() {
    if ((_el('additional-funds-yes-no') || {}).value !== 'yes') return;
    clearTimeout(_afTimer);
    _afTimer = setTimeout(_autoPopulate, 400);
  }

  function _syncYesNo() {
    var yn = _el('additional-funds-yes-no'), grp = _el('additional-funds-fields-group');
    if (!yn || !grp) return;
    var on = (yn.value === 'yes');
    grp.hidden = !on;
    if (on) { _afUserOverride = false; _autoPopulateDebounced(); }
  }

  function _init() {
    var yn = _el('additional-funds-yes-no');
    if (yn) { yn.addEventListener('change', _syncYesNo); yn.addEventListener('input', _syncYesNo); }

    ['additional-account-value', 'additional-lt-gain', 'additional-st-gain'].forEach(function (id) {
      var el = _el(id);
      if (!el) return;
      el.addEventListener('input',  function () { _sync(); _autoPopulateDebounced(); });
      el.addEventListener('change', function () { _sync(); _autoPopulateDebounced(); });
    });

    var fundsEl = _el('additional-funds');
    if (fundsEl) {
      fundsEl.addEventListener('input', function () {
        if (_afProgrammatic) return;
        _afUserOverride = (String(fundsEl.value).trim() !== '');
        _sync();
      });
    }

    _syncYesNo();
    _sync();

    document.addEventListener('change', function (e) {
      if (e && e.target && /^(sale-price|cost-basis|accelerated-depreciation|short-term-gain|long-term-gain|w2-wages|interest-income|dividend-income|retirement-distributions|social-security|rental-income|business-income-amount|available-capital|invested-capital|strategy-select|leverage-cap-select|custodian-select|state-code|filing-status|additional-account-value|additional-lt-gain|additional-st-gain)$/.test(e.target.id)) {
        _autoPopulateDebounced();
      }
    }, true);
  }

  // (1) Self-init guard — upstream relies on inline-script timing (parsed
  // before DOMContentLoaded); we run this module via dynamic <script>
  // injection from useLegacyEngine.ts AFTER the document has loaded, so
  // listening for DOMContentLoaded would no-op forever.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
