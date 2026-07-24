// Client-side PDF export of a full RETT flow.
//
// Bundled by Vite (jsPDF is an npm dep, NOT a CDN script) so it works offline
// and in prod with no external request. Exposes a global the classic
// cloud-sync.js history UI calls:
//
//   window.__rettDownloadFlowPdf(formState, meta)
//
// `formState` is exactly what RETTCaseStorage.captureFormState() produces (the
// canonical persisted field set, schema v4) — for the live flow it's the
// current capture, for a saved flow it's the row's stored form_state. The PDF
// lists every field the advisor entered, grouped into the same sections as the
// app, so it is a faithful paper record of "all the data from the form/flow."

import { jsPDF } from 'jspdf';

type FormState = Record<string, unknown>;

interface FlowMeta {
  clientName?: string;
  status?: string;
  taxYear?: string;
  stateCode?: string;
  updatedAt?: string;
}

interface FieldSpec {
  id: string;
  label: string;
}

interface Section {
  title: string;
  fields: FieldSpec[];
}

// Human-readable label + section map over the persisted field IDs. Kept in
// sync with case-storage.js FIELD_IDS. Anything not listed still exports via
// the "Other entered values" catch-all with a humanized key.
const SECTIONS: Section[] = [
  {
    title: 'Client & Filing',
    fields: [
      { id: 'custodian-select', label: 'Custodian' },
      { id: 'year1', label: 'Tax year' },
      { id: 'filing-status', label: 'Filing status' },
      { id: 'state-code', label: 'State' },
    ],
  },
  {
    title: 'Income Sources',
    fields: [
      { id: 'w2-wages', label: 'W-2 wages' },
      { id: 'interest-income', label: 'Interest income' },
      { id: 'dividend-income', label: 'Dividends' },
      { id: 'qualified-dividends', label: 'Qualified dividends' },
      { id: 'retirement-distributions', label: 'Retirement distributions' },
      { id: 'social-security', label: 'Social Security' },
      { id: 'rental-income', label: 'Rental income' },
      { id: 'business-income-amount', label: 'Business income' },
      { id: 'short-term-gain', label: 'Short-term capital gain' },
      { id: 'long-term-gain', label: 'Long-term capital gain' },
    ],
  },
  {
    title: 'Sale Proceeds',
    fields: [
      { id: 'withhold-yes-no', label: 'Withhold from proceeds?' },
      { id: 'withhold-amount', label: 'Withholding amount' },
      { id: 'cover-taxes-yes-no', label: 'Cover taxes from proceeds?' },
    ],
  },
  {
    title: 'Additional Funds',
    fields: [
      { id: 'additional-funds-yes-no', label: 'Additional funds?' },
      { id: 'additional-funds', label: 'Additional funds amount' },
      { id: 'additional-account-value', label: 'Account value' },
      { id: 'additional-lt-gain', label: 'Embedded long-term gain' },
      { id: 'additional-st-gain', label: 'Embedded short-term gain' },
    ],
  },
  {
    title: 'Future Sale',
    fields: [
      { id: 'future-sale-yes-no', label: 'Planned future sale?' },
      { id: 'future-sale-date', label: 'Future sale date' },
      { id: 'future-estimated-gain', label: 'Estimated future gain' },
    ],
  },
  {
    title: 'Implementation & Projection',
    fields: [
      { id: 'implementation-date', label: 'Implementation date' },
      { id: 'strategy-implementation-date', label: 'Strategy implementation date' },
      { id: 'structured-sale-duration-months', label: 'Structured sale duration (months)' },
      { id: 'projection-years', label: 'Projection years' },
      { id: 'leverage-cap-select', label: 'Leverage cap' },
      { id: 'available-capital', label: 'Available capital' },
      { id: 'invested-capital', label: 'Invested capital' },
      { id: 'recognition-start-select', label: 'Recognition start' },
      { id: 'strategy-select', label: 'Strategy (engine)' },
    ],
  },
];

// Per-property real-estate blocks (1..5). Only rendered when the block has data.
function propertyFields(n: number): FieldSpec[] {
  const suf = n === 1 ? '' : '-' + n;
  const holdSuf = '-' + n; // holding-period is suffixed for all n incl. 1
  return [
    { id: 'sale-price' + suf, label: 'Sale price' },
    { id: 'cost-basis' + suf, label: 'Cost basis' },
    { id: 'accelerated-depreciation' + suf, label: 'Accelerated depreciation' },
    { id: 'holding-period' + holdSuf, label: 'Held long-term?' },
    { id: 'implementation-date' + (n === 1 ? '' : suf), label: 'Sale / implementation date' },
    { id: 'strategy-implementation-date' + (n === 1 ? '' : suf), label: 'Strategy implementation date' },
    { id: 'amount-owed-yes-no' + holdSuf, label: 'Debt owed on property?' },
    { id: 'amount-owed-amount' + holdSuf, label: 'Amount owed' },
    { id: 'personal-use-yes-no' + holdSuf, label: 'Personal use?' },
    { id: 'personal-use-amount' + holdSuf, label: 'Personal-use amount' },
  ];
}

const FILING_LABELS: Record<string, string> = {
  single: 'Single',
  mfj: 'Married Filing Jointly',
  mfs: 'Married Filing Separately',
  hoh: 'Head of Household',
};

const STRATEGY_LABELS: Record<string, string> = {
  A: 'Traditional Sale',
  B: 'Installment Sale',
  C: 'Structured Installment Sale',
};

const SUPP_LABELS: Record<string, string> = {
  oilGas: 'Oil & Gas',
  delphi: 'Delphi',
};

const PMQ_LABELS: Record<string, string> = {
  businessOwner: 'Business owner',
  passThrough: 'Pass-through entity',
  realEstate: 'Real estate',
  charitable: 'Charitable intent',
  altInvestments: 'Alternative investments',
};

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' || t === '$0' || t === '0' || t === '$';
  }
  return false;
}

function fmtValue(id: string, v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const s = String(v);
  if (id === 'filing-status') return FILING_LABELS[s] || s;
  const low = s.toLowerCase();
  if (low === 'yes') return 'Yes';
  if (low === 'no') return 'No';
  return s;
}

function humanize(key: string): string {
  return key
    .replace(/^_/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function tri(v: unknown): string {
  if (v === true) return 'Interested';
  if (v === false) return 'Not interested';
  return '—';
}

function sanitizeFilename(name: string): string {
  return (name || 'draft').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'draft';
}

// ---- Renderer -----------------------------------------------------------
function buildPdf(formState: FormState, meta: FlowMeta): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const contentW = pageW - marginX * 2;
  let y = 56;

  const INK = [35, 31, 85] as const;
  const MUTE = [90, 96, 120] as const;

  function ensureSpace(needed: number) {
    if (y + needed > pageH - 48) {
      doc.addPage();
      y = 56;
    }
  }

  // Header band
  doc.setFillColor(INK[0], INK[1], INK[2]);
  doc.rect(0, 0, pageW, 84, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('RETT — Real Estate Transition Trust', marginX, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Multi-Year Tax Strategy Projector  ·  BrookHaven Integrated Wealth Solutions', marginX, 60);
  y = 108;

  // Title block
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(meta.clientName ? meta.clientName : 'Untitled draft', marginX, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTE[0], MUTE[1], MUTE[2]);
  const statusText = meta.status === 'completed' ? 'Completed' : 'In progress';
  const chosen = formState['_chosenStrategy'];
  const bits = [
    'Status: ' + statusText,
    chosen ? 'Strategy: ' + (STRATEGY_LABELS[String(chosen)] || String(chosen)) : null,
    meta.taxYear ? 'Tax year: ' + meta.taxYear : null,
    'Generated: ' + new Date().toLocaleString(),
  ].filter(Boolean) as string[];
  doc.text(bits.join('     '), marginX, y);
  y += 10;
  doc.setDrawColor(220, 226, 240);
  doc.line(marginX, y, pageW - marginX, y);
  y += 20;

  function sectionHeading(title: string) {
    ensureSpace(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(title, marginX, y);
    y += 6;
    doc.setDrawColor(220, 226, 240);
    doc.line(marginX, y, pageW - marginX, y);
    y += 16;
  }

  function row(label: string, value: string) {
    ensureSpace(20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(MUTE[0], MUTE[1], MUTE[2]);
    doc.text(label, marginX, y);
    doc.setTextColor(30, 30, 40);
    const valX = marginX + 240;
    const lines = doc.splitTextToSize(value, contentW - 240);
    doc.text(lines, valX, y);
    y += Math.max(16, lines.length * 14);
  }

  // Returns number of rows rendered.
  function renderFields(fields: FieldSpec[]): number {
    let count = 0;
    for (const f of fields) {
      if (!(f.id in formState)) continue;
      const raw = formState[f.id];
      if (isEmpty(raw)) continue;
      row(f.label, fmtValue(f.id, raw));
      count++;
    }
    return count;
  }

  const renderedIds = new Set<string>();
  function markRendered(fields: FieldSpec[]) {
    fields.forEach((f) => renderedIds.add(f.id));
  }

  // Standard sections
  for (const sec of SECTIONS) {
    markRendered(sec.fields);
    const hasAny = sec.fields.some((f) => f.id in formState && !isEmpty(formState[f.id]));
    if (!hasAny) continue;
    sectionHeading(sec.title);
    renderFields(sec.fields);
    y += 6;
  }

  // Real-estate properties. A block only renders when it has SUBSTANTIVE
  // data — mirrors case-storage.js's visibility rule (sale price / basis /
  // depreciation / dates / amounts), NOT the holding-period select, which
  // carries a default "yes" even for untouched properties and would
  // otherwise print five near-empty blocks.
  const SUBSTANTIVE = (n: number): string[] => {
    const suf = n === 1 ? '' : '-' + n;
    const s = '-' + n;
    return [
      'sale-price' + suf, 'cost-basis' + suf, 'accelerated-depreciation' + suf,
      'implementation-date' + (n === 1 ? '' : suf),
      'strategy-implementation-date' + (n === 1 ? '' : suf),
      'amount-owed-amount' + s, 'personal-use-amount' + s,
    ];
  };
  for (let n = 1; n <= 5; n++) {
    const fields = propertyFields(n);
    markRendered(fields);
    const active = SUBSTANTIVE(n).some((id) => id in formState && !isEmpty(formState[id]));
    if (!active) continue;
    sectionHeading('Real Estate Sale — Property ' + n);
    renderFields(fields);
    y += 6;
  }

  // Strategy selection (meta)
  const interest = (formState['_strategyInterest'] || {}) as Record<string, unknown>;
  const stratRows: Array<[string, string]> = [];
  if (formState['_chosenStrategy']) {
    stratRows.push(['Chosen strategy', STRATEGY_LABELS[String(formState['_chosenStrategy'])] || String(formState['_chosenStrategy'])]);
  }
  (['A', 'B', 'C'] as const).forEach((k) => {
    if (k in interest && interest[k] != null) {
      stratRows.push([STRATEGY_LABELS[k] + ' interest', tri(interest[k])]);
    }
  });
  if (stratRows.length) {
    sectionHeading('Strategy Selection');
    stratRows.forEach(([l, v]) => row(l, v));
    y += 6;
  }

  // Supplemental interest (meta)
  const supp = (formState['_supplementalInterest'] || {}) as Record<string, unknown>;
  const suppRows: Array<[string, string]> = [];
  Object.keys(supp).forEach((k) => {
    if (supp[k] != null) suppRows.push([SUPP_LABELS[k] || humanize(k), tri(supp[k])]);
  });
  const suppExtra = (formState['_supplementalExtraInterest'] || {}) as Record<string, unknown>;
  Object.keys(suppExtra).forEach((k) => {
    if (suppExtra[k] != null) suppRows.push([humanize(k), tri(suppExtra[k])]);
  });
  if (suppRows.length) {
    sectionHeading('Supplemental Strategies');
    suppRows.forEach(([l, v]) => row(l, v));
    y += 6;
  }

  // PMQ answers (meta)
  const pmq = (formState['_pmqAnswers'] || {}) as Record<string, unknown>;
  const pmqRows: Array<[string, string]> = [];
  Object.keys(pmq).forEach((k) => {
    const v = pmq[k];
    if (v == null) return;
    pmqRows.push([PMQ_LABELS[k] || humanize(k), v === true ? 'Yes' : v === false ? 'No' : String(v)]);
  });
  if (pmqRows.length) {
    sectionHeading('Pre-Meeting Questionnaire');
    pmqRows.forEach(([l, v]) => row(l, v));
    y += 6;
  }

  // Catch-all: any other non-empty entered value not already shown, so the
  // export is genuinely complete even if the field map drifts from the app.
  const skipKeys = new Set(['_schemaVersion', '_savedAt', '_strategyInterest', '_chosenStrategy',
    '_supplementalInterest', '_supplementalConfig', '_supplementalExtraInterest',
    '_supplementalExtraConfig', '_pmqAnswers']);
  const otherRows: Array<[string, string]> = [];
  Object.keys(formState).forEach((k) => {
    if (renderedIds.has(k) || skipKeys.has(k)) return;
    const raw = formState[k];
    if (isEmpty(raw) || typeof raw === 'object') return;
    otherRows.push([humanize(k), fmtValue(k, raw)]);
  });
  if (otherRows.length) {
    sectionHeading('Other Entered Values');
    otherRows.forEach(([l, v]) => row(l, v));
  }

  // Footer with page numbers
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 156, 176);
    doc.text(
      'RETT flow export' + (meta.clientName ? ' — ' + meta.clientName : '') + '   ·   Page ' + p + ' of ' + total,
      marginX,
      pageH - 24,
    );
    doc.text('Confidential — for advisor & client use only', pageW - marginX, pageH - 24, { align: 'right' });
  }

  return doc;
}

function downloadFlowPdf(formState: unknown, meta: FlowMeta = {}) {
  try {
    if (!formState || typeof formState !== 'object') {
      throw new Error('No flow data to export.');
    }
    const doc = buildPdf(formState as FormState, meta || {});
    const stamp = new Date().toISOString().slice(0, 10);
    const fname = 'RETT-' + sanitizeFilename(meta.clientName || 'draft') + '-' + stamp + '.pdf';
    doc.save(fname);
    return true;
  } catch (err) {
    const w = window as unknown as { showBanner?: (level: string, msg: string) => void };
    const msg = err instanceof Error ? err.message : String(err);
    if (typeof w.showBanner === 'function') {
      w.showBanner('error', 'Could not generate the PDF: ' + msg);
    } else {
      // eslint-disable-next-line no-alert
      alert('Could not generate the PDF: ' + msg);
    }
    return false;
  }
}

// Register the global the classic cloud-sync.js history UI calls.
(window as unknown as { __rettDownloadFlowPdf?: typeof downloadFlowPdf }).__rettDownloadFlowPdf =
  downloadFlowPdf;

export { downloadFlowPdf };
