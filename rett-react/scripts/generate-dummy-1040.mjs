// Generates a synthetic 1040 PDF fixture covering every field the current
// Gemini extractor (server/index.js TAX_EXTRACT_PROMPT) is configured to
// pull. Upload the resulting PDF via the "Upload 1040 to autofill" button
// on the Client Inputs page and Section 02 Income Sources should fill in
// end-to-end. Filing Status (Section 01) and State are also populated.
//
// This is NOT a reproduction of the actual IRS Form 1040 layout — it's a
// clean synthetic summary with descriptive labels and round dollar values
// so the deterministic Gemini config (temperature 0, thinking disabled)
// extracts each value reliably.
//
// Run from the rett-react root:
//   node scripts/generate-dummy-1040.mjs [output-path]
// Default output: ~/Desktop/Rett/sample-1040.pdf
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = process.argv[2] || resolve(homedir(), 'Desktop', 'Rett', 'sample-1040.pdf');

// All values chosen to be round + memorable + non-trivial. Total taxable
// gross is ~$284,500 which gives an interesting baseline once you also
// add Section 03 property-sale data.
const DATA = {
  taxpayer: {
    name: 'John Q. Demo',
    spouse: 'Jane R. Demo',
    ssn: 'XXX-XX-1234',
    spouseSsn: 'XXX-XX-5678',
    address: '123 Main Street',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    taxYear: 2025,
  },
  filingStatus: 'Married Filing Jointly',
  income: {
    wages:                   165_000,  // line 1a
    taxableInterest:           2_400,  // line 2b
    ordinaryDividends:         5_600,  // line 3b
    iraDistributions:         18_000,  // line 4b
    pensionsAnnuities:             0,  // line 5b
    shortTermCapitalGain:     12_500,  // line 7 (from Sched D, short-term)
    longTermCapitalGain:      47_500,  // Sched D line 15 — securities only, NOT property
    selfEmploymentIncome:     22_000,  // Sched 1 line 3 (1099-NEC)
    businessIncome:           45_000,  // Sched 1 line 3 (Sched C / K-1)
    rentalRealEstate:         28_000,  // Sched 1 line 5 (Sched E)
  },
  payments: {
    federalTaxWithheld:       24_800,  // line 25a
  },
};

function fmt(n) {
  return '$' + n.toLocaleString('en-US');
}

const doc = new PDFDocument({
  size: 'LETTER',
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
  info: {
    Title:    `Form 1040 Summary — Tax Year ${DATA.taxpayer.taxYear} — DEMO`,
    Author:   'RETT Demo',
    Subject:  'Synthetic 1040 fixture for autofill testing',
    Keywords: 'demo, 1040, sample, tax',
  },
});
doc.pipe(createWriteStream(OUT_PATH));

// ---- Header -----------------------------------------------------------
doc.font('Helvetica-Bold').fontSize(20).text('Form 1040 — U.S. Individual Income Tax Return', { align: 'center' });
doc.moveDown(0.2);
doc.font('Helvetica').fontSize(12).text(`Tax Year ${DATA.taxpayer.taxYear}`, { align: 'center' });
doc.font('Helvetica-Oblique').fontSize(9).fillColor('#777')
   .text('— SAMPLE / DEMO DOCUMENT — NOT A REAL TAX FILING —', { align: 'center' })
   .fillColor('black');
doc.moveDown(1.5);

// Helper: draw a row of "Label .... value" with leader dots
function row(label, value, indent = 0) {
  const y = doc.y;
  const x = 50 + indent;
  const labelWidth = 350 - indent;
  doc.font('Helvetica').fontSize(11);
  doc.text(label, x, y, { width: labelWidth, continued: false });
  // Right-aligned amount on the same line
  const amtX = 400;
  const amtWidth = 110;
  doc.text(value, amtX, y, { width: amtWidth, align: 'right' });
  doc.moveDown(0.3);
}

function section(title) {
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(13).text(title, 50);
  doc.moveTo(50, doc.y).lineTo(560, doc.y).strokeColor('#999').lineWidth(0.5).stroke().strokeColor('black').lineWidth(1);
  doc.moveDown(0.3);
}

// ---- Taxpayer block ---------------------------------------------------
section('Taxpayer Information');
row('Name', DATA.taxpayer.name);
row('Spouse', DATA.taxpayer.spouse);
row('Social Security Number', DATA.taxpayer.ssn);
row('Spouse SSN', DATA.taxpayer.spouseSsn);
row('Home Address', DATA.taxpayer.address);
row('City, State ZIP', `${DATA.taxpayer.city}, ${DATA.taxpayer.state} ${DATA.taxpayer.zip}`);
row('State of Residence', DATA.taxpayer.state);

// ---- Filing status ----------------------------------------------------
section('Filing Status');
row('Filing Status', DATA.filingStatus);

// ---- Income -----------------------------------------------------------
section('Income (Form 1040, Lines 1–9)');
row('Line 1a — Wages, salaries, tips (W-2 Box 1)',                          fmt(DATA.income.wages));
row('Line 2b — Taxable interest',                                           fmt(DATA.income.taxableInterest));
row('Line 3b — Ordinary dividends',                                         fmt(DATA.income.ordinaryDividends));
row('Line 4b — IRA distributions (taxable amount)',                         fmt(DATA.income.iraDistributions));
row('Line 5b — Pensions and annuities (taxable amount)',                    fmt(DATA.income.pensionsAnnuities));
row('Line 7  — Capital gain (Schedule D, short-term portion)',              fmt(DATA.income.shortTermCapitalGain));
row('Line 7  — Capital gain (Schedule D line 15, long-term — securities)',  fmt(DATA.income.longTermCapitalGain));

doc.moveDown(0.4);
doc.font('Helvetica-Bold').fontSize(12).text('Schedule 1 — Additional Income', 50);
doc.moveDown(0.2);
row('Line 3 — Business income (Schedule C)',                                fmt(DATA.income.businessIncome), 12);
row('Line 5 — Rental real estate (Schedule E)',                             fmt(DATA.income.rentalRealEstate), 12);
row('Line 8  — Self-Employment Income (1099-NEC)',                          fmt(DATA.income.selfEmploymentIncome), 12);

// ---- Payments / withholding -------------------------------------------
section('Payments');
row('Line 25a — Federal income tax withheld (W-2)',                         fmt(DATA.payments.federalTaxWithheld));

// ---- Cheat sheet block ------------------------------------------------
section('Income-Source Summary (Autofill Reference)');
doc.font('Helvetica').fontSize(10).fillColor('#555')
   .text(
     'The block below lists each Section 02 field as a simple "Label = $Value" '
   + 'pair. This is the form the Gemini extractor handles most reliably, '
   + 'making this PDF a deterministic fixture for end-to-end autofill testing.',
     { width: 510 },
   ).fillColor('black');
doc.moveDown(0.4);

const summary = [
  ['Filing Status',            DATA.filingStatus],
  ['State',                    DATA.taxpayer.state],
  ['W-2 Wages',                fmt(DATA.income.wages)],
  ['Self-Employment Income',   fmt(DATA.income.selfEmploymentIncome)],
  ['Business Income',          fmt(DATA.income.businessIncome)],
  ['Rental Income',            fmt(DATA.income.rentalRealEstate)],
  ['Dividend / Interest',      fmt(DATA.income.taxableInterest + DATA.income.ordinaryDividends)],
  ['Retirement Distributions', fmt(DATA.income.iraDistributions + DATA.income.pensionsAnnuities)],
  ['Short-Term Capital Gain',  fmt(DATA.income.shortTermCapitalGain)],
  ['Long-Term Capital Gain',   fmt(DATA.income.longTermCapitalGain)],
];
doc.font('Courier').fontSize(11);
for (const [label, value] of summary) {
  doc.text(`${label.padEnd(28, ' ')} = ${value}`);
}
doc.font('Helvetica');

// ---- Footer disclaimer ------------------------------------------------
doc.moveDown(1.5);
doc.font('Helvetica-Oblique').fontSize(9).fillColor('#777')
   .text(
     'This document was generated synthetically for testing the RETT app\'s 1040 '
   + 'upload + Gemini autofill flow. Names, SSNs, and dollar amounts are not real.',
     { align: 'center', width: 510 },
   );

doc.end();

doc.on('end', () => {
  // pdfkit also emits 'end' on the underlying stream
});

console.log(`Generated dummy 1040 → ${OUT_PATH}`);
