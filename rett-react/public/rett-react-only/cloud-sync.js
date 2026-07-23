// FILE: rett-react-only/cloud-sync.js
// Cloud persistence + History tab for RETT flows (React-only module).
//
// case-storage.js already auto-saves every edit to localStorage — its header
// comment reserves this exact seam: "this layer becomes the local cache and a
// sync function pushes/pulls cases to a backend." This module is that sync
// function. It never replaces the local layer; it mirrors it to Postgres via
// the Express routes in server/flows.js so every workflow — completed or
// in-progress — survives the browser and shows up for every advisor.
//
// Integration points (all patch-in-place, no legacy file edits):
//   * RETTCaseStorage.autoSaveCurrent — after each (already-debounced) local
//     autosave, schedule a debounced cloud push of captureFormState().
//   * RETTCaseStorage.deleteCase / renameCase / loadCase / saveCase /
//     activateCaseName / startNewCase — keep the cloud row + id map in step.
//   * window.showPage — track last_page, deactivate the History tab, and
//     detect completion: reaching Strategy Summary (page-allocator) with a
//     chosen strategy marks the flow completed (sticky server-side).
//   * visibilitychange/pagehide — flush pending changes with keepalive.
//
// Identity model: named cases are keyed by client name server-side (the same
// name-anchored model case-storage.js uses); un-named drafts are keyed by a
// UUID this browser mints and remembers, so a refresh keeps writing the same
// draft row. localStorage keys owned here:
//   rett_cloud_ids      — { lowercased client name: flow uuid }
//   rett_cloud_draft_id — uuid of this browser's current un-named draft
//
// Lives OUTSIDE public/legacy/js/ on purpose: that tree is an rsync mirror of
// upstream (sync-from-upstream.sh --delete) and edits there get clobbered.

(function (root) {
  'use strict';

  var IDS_KEY   = 'rett_cloud_ids';
  var DRAFT_KEY = 'rett_cloud_draft_id';

  var SYNC_DEBOUNCE_MS = 1200;
  var RETRY_DELAY_MS   = 15000;

  var LEGACY_PAGE_IDS = [
    'page-pmq', 'page-inputs', 'page-baseline', 'page-strategies',
    'page-projection', 'page-supplemental', 'page-allocator', 'page-temp',
  ];
  var HISTORY_PAGE_ID = 'page-history';
  var HISTORY_TAB_ID  = 'nav-history';

  var STRATEGY_LABELS = {
    A: 'Traditional Sale',
    B: 'Installment Sale',
    C: 'Structured Installment Sale',
  };

  var store = root.RETTCaseStorage;
  if (!store || typeof store.captureFormState !== 'function') {
    if (console && console.warn) console.warn('[cloud-sync] RETTCaseStorage missing — cloud sync disabled.');
    return;
  }

  // ---- Small helpers -----------------------------------------------------
  function _getJson(key, fallback) {
    try {
      var raw = root.localStorage && root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function _setJson(key, value) {
    try { if (root.localStorage) root.localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { /* private mode / quota */ }
  }
  function _uuid() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') {
      return root.crypto.randomUUID();
    }
    // RFC-4122-ish fallback for very old browsers.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function _getIdMap()        { return _getJson(IDS_KEY, {}) || {}; }
  function _idForName(name)   { return _getIdMap()[String(name).toLowerCase()] || null; }
  function _setIdForName(name, id) {
    if (!name) return;
    var map = _getIdMap();
    map[String(name).toLowerCase()] = id;
    _setJson(IDS_KEY, map);
  }
  function _removeIdForName(name) {
    var map = _getIdMap();
    delete map[String(name).toLowerCase()];
    _setJson(IDS_KEY, map);
  }
  function _moveIdForName(oldName, newName) {
    var map = _getIdMap();
    var key = String(oldName).toLowerCase();
    if (map[key]) {
      map[String(newName).toLowerCase()] = map[key];
      delete map[key];
      _setJson(IDS_KEY, map);
    }
  }
  function _getDraftId() {
    try { return (root.localStorage && root.localStorage.getItem(DRAFT_KEY)) || ''; }
    catch (e) { return ''; }
  }
  function _setDraftId(id) {
    try { if (root.localStorage) root.localStorage.setItem(DRAFT_KEY, id || ''); }
    catch (e) { /* */ }
  }
  function _clearDraftId() { _setDraftId(''); }

  // ---- Sync engine ---------------------------------------------------------
  var _timer = null;
  var _inflight = false;
  var _runAgain = false;
  var _dirty = false;
  var _errorShown = false;
  var _currentPage = 'page-inputs';
  var _lastSyncedAt = null;

  // True once THIS SESSION performed a real case action (edit, load, save,
  // rename, activate, open-from-history). Gates every cloud push. Two reasons:
  //   1. A pristine visit navigates via showPage during boot — without the
  //      gate, every visit would push an empty "Untitled draft" row.
  //   2. Stale-clobber: a browser whose localStorage holds an OLD copy of a
  //      named case restores it on boot; pushing that restore would silently
  //      overwrite newer edits another advisor already synced. Boot restores
  //      must never write to the cloud — only deliberate actions do.
  var _userEdited = false;

  // Set at the moment the user promotes an un-named draft into a named case
  // (activateCaseName). The next named sync carries this id so the server
  // renames the draft row in place — or absorbs it when the name already
  // exists — instead of leaving a ghost "Untitled draft" behind. One-shot.
  var _promoteDraftId = '';

  // Completion claim, scoped to the flow that earned it. Reaching the
  // Strategy Summary sets the flag TOGETHER WITH the identity of the flow
  // that was active at that moment; _buildPayload only attaches
  // completed:true when the outgoing payload is for that same flow. Without
  // the scoping, a claim could survive a case switch and permanently mark
  // the WRONG flow completed (server-side status is sticky by design).
  var _completedPending = false;
  var _completedForName = '';
  var _completedForDraft = '';

  function _clearCompletionClaim() {
    _completedPending = false;
    _completedForName = '';
    _completedForDraft = '';
  }

  function _cancelPendingSync() {
    if (_timer) { clearTimeout(_timer); _timer = null; }
    _dirty = false;
    _runAgain = false;
  }

  function _setStatus(text, isError) {
    var el = document.getElementById('history-sync-status');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', !!isError);
  }

  function scheduleSync() {
    _dirty = true;
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(function () { _timer = null; doSync(false); }, SYNC_DEBOUNCE_MS);
  }

  function _activeName() {
    var name = (store.getCurrentCaseName() || '').trim();
    // Mirror autoSaveCurrent's phantom-save rule: 1-char names are treated
    // as the draft slot, so local and cloud route edits the same way.
    return name.length >= 2 ? name : '';
  }

  // Returns null when there is nothing that should be pushed, else
  // { body, name, draftIdUsed, promoted, claimedCompleted }.
  function _buildSyncPlan() {
    // No real case action this session — never push (see _userEdited note).
    if (!_userEdited) return null;
    var name = _activeName();
    var id;
    var promoted = false;
    if (name) {
      id = _idForName(name);
      if (!id && _promoteDraftId) {
        id = _promoteDraftId;
        promoted = true;
      }
    } else {
      id = _getDraftId();
      if (!id) {
        id = _uuid();
        _setDraftId(id);
      }
    }
    var claimedCompleted = false;
    if (_completedPending) {
      claimedCompleted = name
        ? name === _completedForName
        : (!_completedForName && !!id && id === _completedForDraft);
    }
    return {
      body: {
        id: id || undefined,
        clientName: name,
        formState: store.captureFormState(),
        page: _currentPage,
        completed: claimedCompleted,
      },
      name: name,
      draftIdUsed: name ? '' : id,
      promoted: promoted,
      claimedCompleted: claimedCompleted,
    };
  }

  function doSync(useKeepalive) {
    if (!_dirty) return;
    // Never capture mid-restore: the DOM is churning under applyFormState /
    // boot restore, and a snapshot now could push a half-applied case. On a
    // keepalive flush (page going away) there is nothing safe to do — skip;
    // localStorage still holds the data and the next session pushes it.
    if (root.__rettApplyingState || root.__rettSuppressAutoSave) {
      if (useKeepalive) return;
      if (_timer) clearTimeout(_timer);
      _timer = setTimeout(function () { _timer = null; doSync(false); }, 1000);
      return;
    }
    // A keepalive flush proceeds even while a normal sync is in flight: the
    // in-flight request dies with the page and its completion callbacks
    // never run, so deferring to _runAgain would silently drop the final
    // edits. The server upsert is idempotent, so a parallel push is safe.
    if (_inflight && !useKeepalive) { _runAgain = true; return; }

    var plan;
    try { plan = _buildSyncPlan(); }
    catch (e) {
      if (console && console.warn) console.warn('[cloud-sync] capture failed:', e);
      return;
    }
    if (!plan) { _dirty = false; return; }

    _inflight = true;
    _dirty = false;
    fetch('/api/flows/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan.body),
      keepalive: !!useKeepalive,
    })
      .then(function (resp) {
        if (resp.status === 401) {
          // Session cookie expired. Retrying can't heal this (re-auth
          // happens through the access gate on reload) — keep the snapshot
          // owed and say so instead of showing a stale "saved" status.
          _dirty = true;
          _setStatus('Cloud sync: session locked — reload and re-enter the access code.', true);
          return null;
        }
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      })
      .then(function (data) {
        _inflight = false;
        if (data && data.id) {
          if (plan.name) {
            _setIdForName(plan.name, data.id);
            if (plan.promoted) {
              // The draft row was renamed in place (data.id === promote id)
              // or absorbed server-side into the existing named row. Either
              // way the draft slot is spent. Re-check before clearing — the
              // user may have started a new draft mid-flight.
              if (_getDraftId() === _promoteDraftId) _clearDraftId();
              _promoteDraftId = '';
            }
          } else {
            // Adopt the server id only if the draft slot hasn't changed
            // mid-flight (New Client clears it; opening another draft from
            // History replaces it — neither must be undone here).
            if (_getDraftId() === plan.draftIdUsed) _setDraftId(data.id);
          }
          if (plan.claimedCompleted) _clearCompletionClaim();
          _errorShown = false;
          _lastSyncedAt = new Date();
          _setStatus('Cloud sync: saved ' + _lastSyncedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), false);
        }
        if (_runAgain) { _runAgain = false; scheduleSync(); }
      })
      .catch(function (err) {
        _inflight = false;
        _dirty = true; // keep the snapshot owed to the cloud
        _setStatus('Cloud sync: offline — retrying…', true);
        if (!_errorShown) {
          _errorShown = true;
          if (typeof root.showBanner === 'function') {
            root.showBanner('warning', 'Cloud save is unreachable — your work is still saved in this browser and will sync when the connection returns.');
          }
        }
        if (console && console.warn) console.warn('[cloud-sync] push failed:', err && err.message);
        if (_timer) clearTimeout(_timer);
        _timer = setTimeout(function () { _timer = null; doSync(false); }, RETRY_DELAY_MS);
      });
  }

  function _flushNow() {
    if (!_dirty) return;
    if (_timer) { clearTimeout(_timer); _timer = null; }
    doSync(true);
  }

  // ---- Patch RETTCaseStorage ----------------------------------------------
  var _origAutoSave  = store.autoSaveCurrent;
  var _origDelete    = store.deleteCase;
  var _origRename    = store.renameCase;
  var _origLoad      = store.loadCase;
  var _origSave      = store.saveCase;
  var _origActivate  = store.activateCaseName;
  var _origStartNew  = store.startNewCase;

  store.autoSaveCurrent = function () {
    var result = _origAutoSave.apply(this, arguments);
    _userEdited = true;
    scheduleSync();
    return result;
  };

  store.deleteCase = function (name) {
    var wasActive = (store.getCurrentCaseName() || '') === name;
    var ok = _origDelete.apply(this, arguments);
    if (ok) {
      if (wasActive) {
        // The active flow is gone — a pending debounced push (or a stale
        // completion claim) must not fire afterwards and resurrect the
        // deleted client's data as a ghost row.
        _cancelPendingSync();
        _clearCompletionClaim();
        _userEdited = false;
      }
      var id = _idForName(name);
      _removeIdForName(name);
      var doDelete = function (flowId) {
        if (!flowId) return;
        fetch('/api/flows/' + encodeURIComponent(flowId), { method: 'DELETE' })
          .catch(function () { /* row lingers in history; deletable there */ });
      };
      if (id) {
        doDelete(id);
      } else {
        // Fresh browser without an id map — resolve by name from the list.
        fetch('/api/flows')
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            if (!data || !data.flows) return;
            var match = data.flows.filter(function (f) {
              return (f.client_name || '').toLowerCase() === String(name).toLowerCase();
            })[0];
            if (match) doDelete(match.id);
          })
          .catch(function () { /* ignore */ });
      }
    }
    return ok;
  };

  store.renameCase = function (oldName, newName) {
    var ok = _origRename.apply(this, arguments);
    if (ok && oldName !== newName) {
      var oldId = _idForName(oldName);
      var existingNewId = _idForName(newName);
      if (oldId && existingNewId && existingNewId !== oldId) {
        // The cloud already holds a flow under the new name (map is primed
        // from the server at boot). The rename merges our flow into that
        // row (last write wins, same as every name collision); our old row
        // must go too or it lingers as a ghost the server won't absorb.
        _removeIdForName(oldName);
        fetch('/api/flows/' + encodeURIComponent(oldId), { method: 'DELETE' })
          .catch(function () { /* ghost stays deletable from History */ });
      } else {
        _moveIdForName(oldName, newName);
      }
      _userEdited = true;
      scheduleSync(); // server renames the row in place via the mapped id
    }
    return ok;
  };

  store.loadCase = function () {
    var ok = _origLoad.apply(this, arguments);
    if (ok) {
      _clearCompletionClaim(); // any pending claim belonged to the old flow
      _promoteDraftId = '';
      _userEdited = true;
      scheduleSync();
    }
    return ok;
  };

  store.saveCase = function () {
    var ok = _origSave.apply(this, arguments);
    if (ok) {
      _clearCompletionClaim();
      _userEdited = true;
      scheduleSync();
    }
    return ok;
  };

  store.activateCaseName = function () {
    // Snapshot BEFORE the original runs — it may migrate the local draft
    // into the named slot; the cloud draft row gets promoted by the next
    // sync carrying this id (see _promoteDraftId).
    var draftId = _getDraftId();
    var ok = _origActivate.apply(this, arguments);
    if (ok) {
      if (draftId) _promoteDraftId = draftId;
      _userEdited = true;
      scheduleSync();
    }
    return ok;
  };

  store.startNewCase = function () {
    // A brand-new client: nothing pending from the old flow may leak into
    // it — not the debounced push, not a completion claim, not the draft
    // row id, and not the edited-this-session flag (the fresh form is
    // pristine; pushing it would litter history with blank drafts).
    _cancelPendingSync();
    _clearCompletionClaim();
    _clearDraftId();
    _promoteDraftId = '';
    _userEdited = false;
    return _origStartNew.apply(this, arguments);
  };

  // ---- Patch showPage: page tracking, completion, History deactivation ----
  function _hasChosenStrategy() {
    if (root.__rettChosenStrategy) return true;
    // Mirror the Strategy Summary's implicit-choice fallback: exactly one
    // Interested, or exactly one strategy not ruled out.
    var interest = root.__rettStrategyInterest || {};
    var yes = 0, no = 0;
    ['A', 'B', 'C'].forEach(function (k) {
      if (interest[k] === true) yes++;
      else if (interest[k] === false) no++;
    });
    if (yes === 1) return true;
    if (yes === 0 && no === 2) return true;
    return false;
  }

  function _deactivateHistoryTab() {
    var sec = document.getElementById(HISTORY_PAGE_ID);
    if (sec) { sec.classList.remove('active'); sec.style.display = 'none'; }
    var tab = document.getElementById(HISTORY_TAB_ID);
    if (tab) { tab.classList.remove('active'); tab.setAttribute('aria-selected', 'false'); }
  }

  var _origShowPage = root.showPage;
  if (typeof _origShowPage === 'function') {
    root.showPage = function (id) {
      var result = _origShowPage.apply(this, arguments);
      if (LEGACY_PAGE_IDS.indexOf(id) !== -1) _currentPage = id;
      _deactivateHistoryTab();
      if (id === 'page-allocator' && _hasChosenStrategy()) {
        // Claim completion for the flow that is active RIGHT NOW — the
        // claim is validated against the payload identity at send time.
        _completedPending = true;
        _completedForName = _activeName();
        _completedForDraft = _completedForName ? '' : _getDraftId();
      }
      scheduleSync(); // keeps last_page (and any completion) fresh
      return result;
    };
  }

  // ---- Flush on tab hide / close -------------------------------------------
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') _flushNow();
  });
  root.addEventListener('pagehide', _flushNow);

  // ---- History page ---------------------------------------------------------
  function _fmtWhen(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function _el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderHistoryPage() {
    var host = document.getElementById('history-list-host');
    if (!host) return;
    host.textContent = '';
    host.appendChild(_el('p', 'history-loading', 'Loading saved flows…'));

    fetch('/api/flows')
      .then(function (r) {
        if (!r.ok) return r.json().then(function (b) {
          throw new Error((b && b.error) || ('HTTP ' + r.status));
        });
        return r.json();
      })
      .then(function (data) {
        var flows = (data && data.flows) || [];
        var total = (data && typeof data.total === 'number') ? data.total : flows.length;
        host.textContent = '';
        if (!flows.length) {
          var empty = _el('div', 'history-empty');
          empty.appendChild(_el('p', null, 'No saved flows yet.'));
          empty.appendChild(_el('p', 'history-empty-sub',
            'Start entering client details and every change auto-saves here — in progress and completed alike.'));
          host.appendChild(empty);
          return;
        }

        var counts = flows.reduce(function (acc, f) {
          acc[f.status === 'completed' ? 'done' : 'wip']++;
          return acc;
        }, { done: 0, wip: 0 });
        var summaryText = flows.length + ' saved flow' + (flows.length === 1 ? '' : 's') + ' — ' +
          counts.done + ' completed, ' + counts.wip + ' in progress';
        if (total > flows.length) {
          summaryText += ' (showing the ' + flows.length + ' most recently edited of ' + total + ')';
        }
        host.appendChild(_el('p', 'history-summary', summaryText));

        var wrap = _el('div', 'history-table-wrap');
        var table = _el('table', 'history-table');
        var thead = _el('thead');
        var hrow = _el('tr');
        ['Client', 'Status', 'Strategy', 'Tax year', 'Last edited', 'Created', ''].forEach(function (h) {
          hrow.appendChild(_el('th', null, h));
        });
        thead.appendChild(hrow);
        table.appendChild(thead);

        var tbody = _el('tbody');
        flows.forEach(function (f) {
          var tr = _el('tr');

          var nameCell = _el('td', 'history-client');
          if (f.client_name) {
            nameCell.appendChild(_el('span', null, f.client_name));
          } else {
            nameCell.appendChild(_el('span', 'history-draft-name', 'Untitled draft'));
          }
          if (f.state_code) nameCell.appendChild(_el('span', 'history-state-code', f.state_code));
          tr.appendChild(nameCell);

          var statusCell = _el('td');
          var done = f.status === 'completed';
          statusCell.appendChild(_el('span',
            'history-pill ' + (done ? 'history-pill-done' : 'history-pill-wip'),
            done ? 'Completed' : 'In progress'));
          tr.appendChild(statusCell);

          tr.appendChild(_el('td', null, STRATEGY_LABELS[f.chosen_strategy] || '—'));
          tr.appendChild(_el('td', null, f.tax_year || '—'));
          tr.appendChild(_el('td', 'history-when', _fmtWhen(f.updated_at)));
          tr.appendChild(_el('td', 'history-when', _fmtWhen(f.created_at)));

          var actions = _el('td', 'history-actions');
          var openBtn = _el('button', 'btn btn-primary history-open-btn', 'Open');
          openBtn.type = 'button';
          openBtn.addEventListener('click', function () { openFlow(f.id, openBtn); });
          actions.appendChild(openBtn);

          var delBtn = _el('button', 'btn btn-secondary history-delete-btn', 'Delete');
          delBtn.type = 'button';
          delBtn.addEventListener('click', function () {
            var label = f.client_name || 'this untitled draft';
            if (!root.confirm('Delete "' + label + '" from saved flows? This removes it for everyone.')) return;
            fetch('/api/flows/' + encodeURIComponent(f.id), { method: 'DELETE' })
              .then(function (r) {
                if (!r.ok && r.status !== 404) throw new Error('HTTP ' + r.status);
                if (f.client_name) {
                  var wasActive = (store.getCurrentCaseName() || '').toLowerCase() ===
                    f.client_name.toLowerCase();
                  _removeIdForName(f.client_name);
                  _origDelete.call(store, f.client_name); // keep local mirror in step
                  if (wasActive) {
                    // The deleted flow was the one on the form: stop any
                    // pending push from resurrecting it, and blank the
                    // Client Name input — otherwise the next blur/edit
                    // quietly recreates the case under the same name.
                    _cancelPendingSync();
                    _clearCompletionClaim();
                    _userEdited = false;
                    var nameInput = document.getElementById('case-name-input');
                    if (nameInput) nameInput.value = '';
                  }
                } else if (_getDraftId() === f.id) {
                  _clearDraftId();
                  if (!_activeName()) {
                    _cancelPendingSync();
                    _clearCompletionClaim();
                    _userEdited = false;
                  }
                }
                renderHistoryPage();
              })
              .catch(function () {
                if (typeof root.showBanner === 'function') {
                  root.showBanner('error', 'Could not delete the saved flow — try again.');
                }
              });
          });
          actions.appendChild(delBtn);
          tr.appendChild(actions);

          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        host.appendChild(wrap);
      })
      .catch(function (err) {
        host.textContent = '';
        var errBox = _el('div', 'history-error');
        errBox.appendChild(_el('p', null, 'Could not load saved flows: ' + (err && err.message ? err.message : 'unknown error')));
        var retry = _el('button', 'btn btn-secondary', 'Retry');
        retry.type = 'button';
        retry.addEventListener('click', renderHistoryPage);
        errBox.appendChild(retry);
        host.appendChild(errBox);
      });
  }

  function openFlow(id, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Opening…'; }
    fetch('/api/flows/' + encodeURIComponent(id))
      .then(function (r) {
        if (!r.ok) return r.json().then(function (b) {
          throw new Error((b && b.error) || ('HTTP ' + r.status));
        });
        return r.json();
      })
      .then(function (data) {
        var flow = data && data.flow;
        if (!flow || !flow.form_state) throw new Error('Flow payload is empty.');

        var name = (flow.client_name || '').trim();
        var state = flow.form_state;

        // Same suppression dance controls.js does around case loads: the
        // synthetic change/input storm from applyFormState must not re-save.
        root.__rettSuppressAutoSave = true;
        _cancelPendingSync();       // anything pending belonged to the old flow
        _clearCompletionClaim();
        _promoteDraftId = '';

        if (name) {
          _setIdForName(name, flow.id);
          _origSave.call(store, name, state); // mirror locally + set current
        } else {
          _setDraftId(flow.id);
          store.setCurrentCaseName('');
        }
        store.applyFormState(state);
        if (!name) store.saveWorkingState();

        // Keep the PMQ Client Name input in step with the loaded case.
        // (Value only, no events — dispatching input here would arm the
        // upstream rename debounce against the very flow we just opened.)
        var nameInput = document.getElementById('case-name-input');
        if (nameInput) nameInput.value = name;

        // The form now holds exactly what the cloud row holds, so pushes
        // from this session can't clobber anything newer.
        _userEdited = true;

        var target = LEGACY_PAGE_IDS.indexOf(flow.last_page) !== -1
          ? flow.last_page
          : 'page-inputs';
        if (typeof root.showPage === 'function') root.showPage(target);

        setTimeout(function () { root.__rettSuppressAutoSave = false; }, 800);

        if (typeof root.showBanner === 'function') {
          root.showBanner('info', name
            ? 'Loaded "' + name + '" from saved flows.'
            : 'Loaded untitled draft from saved flows.');
        }
      })
      .catch(function (err) {
        root.__rettSuppressAutoSave = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Open'; }
        if (typeof root.showBanner === 'function') {
          root.showBanner('error', 'Could not open the saved flow: ' + (err && err.message ? err.message : 'unknown error'));
        }
      });
  }

  function showHistoryPage() {
    document.querySelectorAll('section.page').forEach(function (sec) {
      if (sec.id === HISTORY_PAGE_ID) return;
      sec.classList.remove('active');
      sec.style.display = 'none';
    });
    document.querySelectorAll('.nav-tab').forEach(function (tab) {
      tab.classList.remove('active');
      if (tab.getAttribute('role') === 'tab') tab.setAttribute('aria-selected', 'false');
    });
    var sec = document.getElementById(HISTORY_PAGE_ID);
    if (sec) { sec.classList.add('active'); sec.style.display = ''; }
    var tab = document.getElementById(HISTORY_TAB_ID);
    if (tab) { tab.classList.add('active'); tab.setAttribute('aria-selected', 'true'); }
    renderHistoryPage();
  }

  root.__rettShowHistoryPage = showHistoryPage;
  root.renderHistoryPage = renderHistoryPage;

  var refreshBtn = document.getElementById('history-refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', renderHistoryPage);

  // ---- Boot: prime the name→id map so renames/deletes hit existing rows ----
  fetch('/api/flows')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.flows) return;
      data.flows.forEach(function (f) {
        if (f.client_name) _setIdForName(f.client_name, f.id);
      });
    })
    .catch(function () { /* offline boot — map fills in as syncs succeed */ });
})(window);
