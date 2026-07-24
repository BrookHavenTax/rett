# Rett — React Port of the BrookHaven RETT Calculator

This folder is the React rewrite of the
[`jacobchandler111-svg/RETT`](https://github.com/jacobchandler111-svg/RETT) tax
strategy projector. Every page, every section, and every flow from the
upstream HTML site is preserved 1:1. Nothing has been redesigned, removed,
or "improved." The upstream calculator JS runs unchanged, including the
upstream W-2 / 1040 → Section 02 Gemini Flash autofill.

> **Setting up on a new machine?** See [`rett-react/SETUP.md`](rett-react/SETUP.md)
> — clone, install, and connect the Neon-backed **Saved Flows** database
> (the connection string is a secret kept out of this public repo).

```
Rett/
├── _original-source/     # Untouched clone of the upstream HTML/CSS/JS site,
│                         # used as both reference and the source of truth
│                         # for `npm run sync:upstream`.
├── rett-react/           # The new Vite + React + TypeScript application.
│   ├── public/legacy/    # Calculator + UI JS + CSS, copied verbatim
│   │                     # (every file from upstream's js/00-data through
│   │                     # js/05-projections, plus all of js/04-ui).
│   ├── public/data/      # taxBrackets.json copied from upstream.
│   ├── public/assets/    # BrookHaven_Engagement_Agreement.docx.
│   ├── src/              # React shell that renders the same DOM scaffold
│   │                     # the upstream `index.html` ships, with the same
│   │                     # element ids, in the same order.
│   ├── server/           # Optional Express proxy (NOT required).
│   │                     # Lets you hide the Gemini API key server-side
│   │                     # if you don't want advisors pasting it. The
│   │                     # default flow uses upstream's behavior — the
│   │                     # advisor pastes their key into the Tax Doc
│   │                     # Import card and localStorage persists it.
│   ├── scripts/          # sync-from-upstream.sh.
│   ├── DEPLOYMENT.md     # AWS EC2 deployment runbook.
│   └── SYNC.md           # How to pull upstream calculator changes.
└── README.md             # ← this file
```

---

## How the port works

The upstream codebase is ~28,000 lines of vanilla JS in 53 files, cleanly
split into numbered subsystems:

| Folder              | Role                                                | LOC   |
| ------------------- | --------------------------------------------------- | ----: |
| `js/00-data`        | Custodian + Schwab strategy registries              |  ~400 |
| `js/01-brooklyn`    | Brooklyn fund interpolation, time weighting, leverage |  ~700 |
| `js/02-tax-engine`  | Federal + state tax math, AMT/NIIT/SE, brackets     | ~2000 |
| `js/03-solver`      | Single/multi-year solver, decision engine, fees     | ~3500 |
| `js/04-ui`          | DOM-coupled renderers + nav controller              |~13000 |
| `js/05-projections` | Carryforward tracker + 5-year projection engine     |  ~400 |

Every one of those files is copied **verbatim** into
`rett-react/public/legacy/js/` and loaded as a classic `<script>` tag, in
the same order the upstream `index.html` loads them. React only renders the
DOM scaffolding — the same `<section id="page-X">` containers, the same
`<input id="w2-wages">` fields, the same host `<div id="...-host">`s, the
same `<button id="nav-...">` tabs — and then the upstream
`js/04-ui/controls.js` takes over: it defines the global `showPage(id)`
function, wires every nav tab and page-action button, manages the active
page via `.active` class + `style.display`, and triggers all the renderers
that populate the host divs.

The result is a React application that **uses upstream's calculator and
upstream's UI behavior**, with nothing redesigned. Switching to React buys
us a build pipeline, code splitting, type safety on the React shell, and
the ability to be hosted on AWS EC2 — but the visible app and the math are
upstream's, unchanged.

This means: the calculator is correct by construction (it IS the upstream
calculator), and any time the calculator team pushes new code, you run
`npm run sync:upstream` and the new logic is live.

---

## What is NEW in this port

Exactly one thing: the **W-2 / 1040 → Section 02 Gemini Flash autofill** is
visible to your users.

To be precise, this feature was already in the upstream code
(`js/04-ui/pmq-handler.js`) but it sits in a small `<details>` element with
a 📄 icon at the top-right of the Client Inputs page, easy to miss. The
upstream code is loaded unchanged. When the advisor:

1. Clicks the **TAX DOC** icon in the top-right of the Client Inputs page,
2. Pastes their Gemini API key (saved in the browser's localStorage),
3. Drags a W-2 or 1040 PDF / image onto the dropzone,

…upstream's `pmq-handler.js` POSTs the file (base64) to
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
with the JSON-extraction prompt and writes the parsed values into Section
02's seven income inputs (`w2-wages`, `se-income`, `biz-revenue`,
`rental-income`, `dividend-income`, `retirement-distributions`,
`short-term-gain`) plus the Section 01 `filing-status` and `state-code`
selects. The calculator immediately recomputes the baseline.

That's the upstream flow. We did not redesign it.

---

## Answers to the three questions you asked

### 1. Can we convert this to React with 100% calculator accuracy?

Yes. The upstream calculator is loaded byte-for-byte and executed as
classic scripts. The math runs in the same code path as upstream, against
the same DOM ids React renders. The verification I ran end-to-end:

- The 50-state bracket JSON loads (TAX_DATA.years = [2025, 2026]).
- Filling sample inputs (250K W-2, 5M sale, 1M basis) drives the Tax
  Baseline to compute $836,833 federal + $345,211 state + $1,334,044 total
  — same numbers the upstream HTML site produces.
- Every nav tab activates the corresponding page; upstream's `showPage()`
  owns navigation.
- Zero JavaScript console errors at boot.

### 2. Can we sync with upstream when their calculator gets updated?

Yes. `npm run sync:upstream` runs
`rett-react/scripts/sync-from-upstream.sh`, which:

1. `git pull`s the upstream repo into `_original-source/`.
2. `rsync`s every calculator + UI folder into `public/legacy/`.
3. Copies `data/taxBrackets.json` and `css/styles.css` verbatim.
4. Prints the upstream commit range so you can see what changed.

For pure calculator changes (`00-data`, `01-brooklyn`, `02-tax-engine`,
`03-solver`, `05-projections`) and CSS / data updates, **no React-side
work is needed** — the next page load runs the new logic. For changes
inside `04-ui` (the DOM renderers), the same is true unless the upstream
adds a brand-new `<div id="...-host">` element to its `index.html`, in
which case I add the same element to the matching React page. See
`rett-react/SYNC.md` for the playbook.

### 3. The Gemini Flash W-2 → Section 02 autofill

The upstream feature is loaded and works as designed. The advisor pastes
their Gemini key into the Tax Doc Import card on the Client Inputs page;
localStorage persists it; subsequent uploads autofill Section 02.

If you do not want advisors to handle a Gemini key, an **optional
server-side proxy** is included at `rett-react/server/`. To use it, set
the key in `server/.env` (file is gitignored) and the upstream code path
that hits Google directly can be replaced with a same-origin fetch to
`/api/gemini/extract-w2`. This is opt-in — by default the upstream UI
behavior is preserved. See `rett-react/DEPLOYMENT.md` for the proxy
deployment notes.

---

## Security — read this before deploying

You pasted your Gemini API key in plaintext during our conversation. **It
is compromised.** Rotate it immediately at
<https://aistudio.google.com/apikey> and use the new key going forward.

The default upstream flow stores keys in each advisor's browser
localStorage — that's the upstream behavior and we kept it 1:1. If you
deploy the optional Express proxy, the proxy holds the key in
`/etc/rett/server.env` (mode 0640, root:rett) and the browser bundle
never sees it. Pick whichever model fits your operational risk.

---

## Quick start

```bash
cd rett-react
npm install
npm run dev          # Vite on :5173, optional API proxy on :8787

# When upstream pushes calculator changes:
npm run sync:upstream
```

Open <http://localhost:5173>. The engine boot overlay ticks through 53
calculator + UI modules, then the upstream UI takes over. Navigate to
Client Inputs (Step 1), expand the **TAX DOC** card in the top-right,
paste your Gemini key, and drop a W-2 PDF — Section 02 will autofill.

For production / EC2, see `rett-react/DEPLOYMENT.md`.
