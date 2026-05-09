# Syncing with the upstream RETT repo

The upstream calculator at
[`jacobchandler111-svg/RETT`](https://github.com/jacobchandler111-svg/RETT)
is still being refined. This React app loads the upstream calculator code
verbatim from `public/legacy/`, so updating to a new upstream commit is a
single command:

```bash
npm run sync:upstream
```

That runs `scripts/sync-from-upstream.sh`, which:

1. `git pull`s the upstream repo into `../_original-source/` (cloning it
   fresh if it doesn't exist).
2. `rsync`s `js/00-data` … `js/05-projections` and `js/04-ui` into
   `public/legacy/js/`. `--delete` is on, so files removed upstream
   disappear locally too.
3. Copies `data/taxBrackets.json` and `css/styles.css` verbatim.
4. Prints the upstream commit range so you can see exactly which commits
   were absorbed.

## What kinds of upstream changes need React-side work?

| Where the upstream change is             | What you need to do                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `js/00-data` (custodians, strategies)    | Nothing — calculator picks it up.                                           |
| `js/01-brooklyn` (Brooklyn math)         | Nothing.                                                                    |
| `js/02-tax-engine` (tax math, brackets)  | Nothing.                                                                    |
| `js/03-solver` (solvers, decision)       | Nothing.                                                                    |
| `js/05-projections` (projection engine)  | Nothing.                                                                    |
| `data/taxBrackets.json`                  | Nothing.                                                                    |
| `css/styles.css`                         | Nothing.                                                                    |
| `js/04-ui` *renderers* (`*-render.js`)   | Confirm the host `<div id="...-host">` still exists in the matching React page. |
| `js/04-ui/pmq-handler.js`                | Skipped intentionally — replaced by `W2Uploader.tsx`.                       |
| `js/04-ui/pmq-questions.js`              | Skipped intentionally — to be ported in a future pass.                      |
| New top-level HTML element added upstream | Add the matching JSX to the relevant `src/components/pages/*.tsx` page.    |

## How to tell what kind of change happened

After running the sync, the script prints the list of upstream commits it
absorbed. Scan that list for:

- File paths under `js/04-ui/` — those are the only ones likely to need a
  React-side change.
- Words like "new field", "new section", "added id" in the commit message —
  those almost always mean a new DOM element needs to be reflected in JSX.

If you're unsure, you can always diff the upstream `index.html` against
`rett-react/index.html` plus `src/components/pages/*.tsx`:

```bash
diff -u ../_original-source/index.html rett-react/index.html | less
```

The differences should be:

1. The `<head>` block (we use Vite's index.html for the React entry).
2. The `<script src="...">` load order (we load via `useLegacyEngine`).
3. The page bodies, which are now JSX in `src/components/pages/`.

Anything other than those three categories is probably an upstream change
you need to mirror.

## Tagging upstream-known-good versions

Before pulling a major upstream change, tag the working tree:

```bash
cd ../_original-source
git tag rett-react-known-good-$(date +%Y%m%d)
cd ../rett-react
git add -A && git commit -m "snapshot: pre-sync $(date +%Y-%m-%d)"
```

If a sync goes badly, you can `git reset --hard` and `git checkout` the
upstream tag to roll everything back.
