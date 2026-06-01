// Generates a synthetic 1040 PDF fixture covering every Income Sources field
// on the Client Inputs page (plus Filing Status + State on Tab 0).
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

// Round dollar values — each maps 1:1 to a visible RETT Income Sources input.
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
    socialSecurityBenefits:   32_000,  // line 6a (gross)
    shortTermCapitalGain:     12_500,
    longTermCapitalGain:      47_500,
    selfEmploymentIncome:     22_000,  // Sched 1 / 1099-NEC
    businessIncome:           45_000,  // Sched C / K-1
    rentalRealEstate:         28_000,  // Sched E
  },
  payments: {
    federalTaxWithheld:       24_800,
  },
};

/** Single Business Income amount shown on the RETT form (SE + Sched C). */
const businessIncomeTotal =
  DATA.income.selfEmploymentIncome + DATA.income.businessIncome;

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

doc.font('Helvetica-Bold').fontSize(20).text('Form 1040 — U.S. Individual Income Tax Return', { align: 'center' });
doc.moveDown(0.2);
doc.font('Helvetica').fontSize(12).text(`Tax Year ${DATA.taxpayer.taxYear}`, { align: 'center' });
doc.font('Helvetica-Oblique').fontSize(9).fillColor('#777')
   .text('— SAMPLE / DEMO DOCUMENT — NOT A REAL TAX FILING —', { align: 'center' })
   .fillColor('black');
doc.moveDown(1.5);

function row(label, value, indent = 0) {
  const y = doc.y;
  const x = 50 + indent;
  const labelWidth = 350 - indent;
  doc.font('Helvetica').fontSize(11);
  doc.text(label, x, y, { width: labelWidth, continued: false });
  doc.text(value, 400, y, { width: 110, align: 'right' });
  doc.moveDown(0.3);
}

function section(title) {
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(13).text(title, 50);
  doc.moveTo(50, doc.y).lineTo(560, doc.y).strokeColor('#999').lineWidth(0.5).stroke().strokeColor('black').lineWidth(1);
  doc.moveDown(0.3);
}

section('Taxpayer Information');
row('Name', DATA.taxpayer.name);
row('Spouse', DATA.taxpayer.spouse);
row('Home Address', DATA.taxpayer.address);
row('City, State ZIP', `${DATA.taxpayer.city}, ${DATA.taxpayer.state} ${DATA.taxpayer.zip}`);
row('State of Residence', DATA.taxpayer.state);

section('Filing Status');
row('Filing Status', DATA.filingStatus);

section('Income (Form 1040, Lines 1–9)');
row('Line 1a — Wages, salaries, tips (W-2 Box 1)',                          fmt(DATA.income.wages));
row('Line 2b — Taxable interest',                                           fmt(DATA.income.taxableInterest));
row('Line 3b — Ordinary dividends',                                         fmt(DATA.income.ordinaryDividends));
row('Line 4b — IRA distributions (taxable amount)',                         fmt(DATA.income.iraDistributions));
row('Line 5b — Pensions and annuities (taxable amount)',                    fmt(DATA.income.pensionsAnnuities));
row('Line 6a — Social security benefits (gross)',                           fmt(DATA.income.socialSecurityBenefits));
row('Line 7  — Capital gain (Schedule D, short-term portion)',              fmt(DATA.income.shortTermCapitalGain));
row('Line 7  — Capital gain (Schedule D line 15, long-term — securities)', fmt(DATA.income.longTermCapitalGain));

doc.moveDown(0.4);
doc.font('Helvetica-Bold').fontSize(12).text('Schedule 1 — Additional Income', 50);
doc.moveDown(0.2);
row('Line 3 — Business income (Schedule C)',                                fmt(DATA.income.businessIncome), 12);
row('Line 5 — Rental real estate (Schedule E)',                             fmt(DATA.income.rentalRealEstate), 12);
row('Line 8  — Self-Employment Income (1099-NEC)',                          fmt(DATA.income.selfEmploymentIncome), 12);

section('Payments');
row('Line 25a — Federal income tax withheld (W-2)',                         fmt(DATA.payments.federalTaxWithheld));

section('RETT Income Sources — Autofill Reference');
doc.font('Helvetica').fontSize(10).fillColor('#555')
   .text(
     'Each line below matches a field on the RETT Client Inputs → Income Sources '
   + 'form. Gemini should extract these literal dollar amounts.',
     { width: 510 },
   ).fillColor('black');
doc.moveDown(0.4);

const summary = [
  ['Filing Status',            DATA.filingStatus],
  ['State',                    DATA.taxpayer.state],
  ['W-2 Wages',                fmt(DATA.income.wages)],
  ['Interest Income',          fmt(DATA.income.taxableInterest)],
  ['Dividends',                fmt(DATA.income.ordinaryDividends)],
  ['Retirement Distributions', fmt(DATA.income.iraDistributions + DATA.income.pensionsAnnuities)],
  ['Social Security',          fmt(DATA.income.socialSecurityBenefits)],
  ['Rental Income',            fmt(DATA.income.rentalRealEstate)],
  ['Short-Term Capital Gain',  fmt(DATA.income.shortTermCapitalGain)],
  ['Long-Term Capital Gain',   fmt(DATA.income.longTermCapitalGain)],
  ['Self-Employment Income',   fmt(DATA.income.selfEmploymentIncome)],
  ['Business Income',          fmt(DATA.income.businessIncome)],
  ['Business Income (Total)',  fmt(businessIncomeTotal)],
];
doc.font('Courier').fontSize(11);
for (const [label, value] of summary) {
  doc.text(`${label.padEnd(28, ' ')} = ${value}`);
}
doc.font('Helvetica');

doc.moveDown(1.5);
doc.font('Helvetica-Oblique').fontSize(9).fillColor('#777')
   .text(
     'Synthetic document for RETT 1040 upload + Gemini autofill testing only.',
     { align: 'center', width: 510 },
   );

doc.end();
console.log(`Generated dummy 1040 → ${OUT_PATH}`);
