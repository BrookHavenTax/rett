// React-only mirror of the inline <script> block at the bottom of upstream
// index.html (synced cd22150f). See useLegacyEngine.ts REACT_ONLY_SCRIPTS.
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

  var _afUserOverride = false;
  var _afProgrammatic = false;

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
    if (_afUserOverride) { if (note) note.hidden = true; _syncToggleVisibility(); return; }
    var sug = null;
    if (typeof window.rettSuggestAdditionalFunds === 'function') {
      try { sug = window.rettSuggestAdditionalFunds(); } catch (e) { sug = null; }
    }
    _afProgrammatic = true;
    if (sug != null && isFinite(sug) && sug > 0) {
      fundsEl.value = _fmtUSD(sug);
      if (note) { note.textContent = 'optimal — editable'; note.hidden = false; }
    } else {
      fundsEl.value = '';
      if (note) note.hidden = true;
    }
    fundsEl.dispatchEvent(new Event('change', { bubbles: true }));
    _afProgrammatic = false;
    _sync();
    _syncToggleVisibility();
  }

  function _syncToggleVisibility() {
    var label = document.querySelector('.proj-addfunds-toggle');
    var toggle = _el('additional-funds-toggle');
    if (!label || !toggle) return;
    if (window.__rettAFProbing) return;
    var qualifies = false;
    if (typeof window.rettAdditionalFundsBenefit === 'function') {
      try { qualifies = !!(window.rettAdditionalFundsBenefit() || {}).qualifies; }
      catch (e) { qualifies = false; }
    }
    if (qualifies) {
      label.hidden = false;
      label.style.display = '';
    } else {
      label.hidden = true;
      label.style.display = 'none';
      if (toggle.checked) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }
  window.rettSyncAFToggleVisibility = _syncToggleVisibility;

  var _afTimer = null;
  var _afGateTimer = null;
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
    if (on) {
      var _fEl = _el('additional-funds');
      _afUserOverride = !!(_fEl && String(_fEl.value).trim() !== '');
      _autoPopulateDebounced();
    }
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
        clearTimeout(_afGateTimer);
        _afGateTimer = setTimeout(_syncToggleVisibility, 450);
      });
    }

    _syncYesNo();
    _sync();
    _syncToggleVisibility();

    document.addEventListener('change', function (e) {
      if (e && e.target && /^(sale-price|cost-basis|accelerated-depreciation|short-term-gain|long-term-gain|w2-wages|interest-income|dividend-income|retirement-distributions|social-security|rental-income|business-income-amount|available-capital|invested-capital|strategy-select|leverage-cap-select|custodian-select|state-code|filing-status|additional-account-value|additional-lt-gain|additional-st-gain)$/.test(e.target.id)) {
        _autoPopulateDebounced();
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
