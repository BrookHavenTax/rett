import { useRef, useState } from 'react';

// Maps the JSON keys Gemini returns to the DOM input ids the upstream
// calculator reads from. Gemini's prompt + schema are defined server-side
// in server/index.js (TAX_EXTRACT_PROMPT). When the proxy returns a value
// for a key listed here, we write it into the matching DOM input and
// dispatch synthetic input + change events so every upstream listener
// (controls.js, baseline-table.js, projection-dashboard-render.js, etc.)
// recomputes immediately — same handshake the upstream pmq-handler.js used.
//
// The first seven entries are the Section 02 (Income Sources) fields. The
// last two (filing-status, state-code) belong to Section 01 but a W-2 /
// 1040 reliably reveals them, so we autofill those too — same fields the
// upstream extractor populated.
const FIELD_MAP: ReadonlyArray<{ id: string; key: string; label: string }> = [
  { id: 'w2-wages',                 key: 'wages',                   label: 'W-2 Wages' },
  { id: 'se-income',                key: 'seIncome',                label: 'Self-Employment Income' },
  { id: 'biz-revenue',              key: 'businessRevenue',         label: 'Business Income' },
  { id: 'rental-income',            key: 'rentalIncome',            label: 'Rental Income' },
  { id: 'dividend-income',          key: 'dividendIncome',          label: 'Dividend / Interest' },
  { id: 'retirement-distributions', key: 'retirementDistributions', label: 'Retirement Distributions' },
  { id: 'short-term-gain',          key: 'shortTermGain',           label: 'Short-Term Capital Gain' },
  { id: 'filing-status',            key: 'filingStatus',            label: 'Filing Status' },
  { id: 'state-code',               key: 'state',                   label: 'State' },
];

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; text: string }
  | { kind: 'success'; text: string }
  | { kind: 'error'; text: string };

function setInput(id: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return false;
  const el = document.getElementById(id) as
    | HTMLInputElement
    | HTMLSelectElement
    | null;
  if (!el) return false;
  el.value = String(value);
  // Critical handshake: the upstream calculator listens to `input` and
  // `change` events on every form field, NOT to value writes. Without these
  // dispatches, the autofilled values would sit in the DOM but the Tax
  // Baseline / Projection / Solver would all still see zeros.
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  // Also fire a blur for the few inputs that only commit value on blur
  // (case-storage's autosave is the main one).
  el.dispatchEvent(new Event('blur',   { bubbles: true }));
  return true;
}

export default function W2Uploader() {
  const inputRef            = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setStatus({ kind: 'error', text: 'File is larger than 10 MB. Please use a smaller scan.' });
      return;
    }
    setStatus({ kind: 'busy', text: `Scanning ${file.name} with Gemini Flash…` });

    try {
      const fd = new FormData();
      fd.append('file', file);
      const resp = await fetch('/api/gemini/extract-w2', { method: 'POST', body: fd });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(
          (data && data.error) ||
          `Server returned ${resp.status}. Make sure the Express proxy is running and GEMINI_API_KEY is set in server/.env.`,
        );
      }
      const fields = (data && data.fields) || {};

      const filled: string[] = [];
      for (const { id, key, label } of FIELD_MAP) {
        const v = (fields as Record<string, unknown>)[key];
        if (setInput(id, v as string | number | null | undefined)) {
          filled.push(label);
        }
      }

      if (filled.length === 0) {
        setStatus({
          kind: 'error',
          text: 'Gemini scanned the document but no income fields were found. Try a clearer scan or fill the fields manually.',
        });
      } else {
        setStatus({
          kind: 'success',
          text: `Filled ${filled.length} field${filled.length === 1 ? '' : 's'}: ${filled.join(', ')}. Review the values below.`,
        });
      }
    } catch (err) {
      setStatus({
        kind: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    // Reset so the same file can be selected again after an error.
    e.target.value = '';
  }

  function onClickUpload() {
    inputRef.current?.click();
  }

  const busy = status.kind === 'busy';

  return (
    <div className="w2-uploader" aria-busy={busy}>
      <button
        type="button"
        className="w2-uploader__btn"
        onClick={onClickUpload}
        disabled={busy}
      >
        <span className="w2-uploader__icon" aria-hidden="true">📄</span>
        <span className="w2-uploader__btn-text">
          {busy ? 'Scanning…' : 'Upload tax document to autofill'}
        </span>
      </button>
      <span className="w2-uploader__hint">
        W-2, 1040, 1099, K-1, or a client income summary sheet. PDF, JPEG, or PNG.
        The file is processed in memory and never stored.
      </span>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        className="w2-uploader__file-input"
        onChange={onChange}
      />
      {status.kind !== 'idle' && (
        <div
          className={`w2-uploader__status w2-uploader__status--${status.kind}`}
          role={status.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {status.text}
        </div>
      )}
    </div>
  );
}
