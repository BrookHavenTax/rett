# RETT — New-Machine Setup (including the database)

Get this app running on a fresh laptop, with the Neon-backed **Saved Flows**
database working. Written to be followed step-by-step (by a person or an
automated coding session). Every command is run from the `rett-react/`
directory unless noted.

## What you need to know first

- The **Saved Flows** history + auto-save feature is backed by a **Neon
  Postgres** database. It is a single shared cloud database: every machine
  that points at the same `DATABASE_URL` reads and writes the **same** saved
  flows. You are not re-creating the database — you are connecting to it.
- The connection string is a **secret** and is intentionally **not in this
  repo** (this repo is public). You must obtain it out-of-band and put it in a
  local, gitignored `server/.env`. Without it the app still runs, but the
  Saved Flows tab shows a 503 and nothing syncs to the cloud.

## 1. Prerequisites — Node.js 20+

If `node --version` prints v20 or newer, skip to step 2. Otherwise install via
nvm (no admin/Homebrew needed):

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash
# open a new shell (or: export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh")
nvm install --lts
```

## 2. Clone and install

```bash
git clone https://github.com/BrookHavenTax/rett.git
cd rett/rett-react
npm install          # installs web deps AND server deps (incl. pg) via postinstall
```

## 3. Configure the database secret

```bash
cp server/.env.example server/.env
```

Then edit `server/.env` and set `DATABASE_URL` to the real Neon connection
string. Get it from the **Neon dashboard** (Project → Connect → pooled
connection string) or from whoever set up the database. It looks like:

```
DATABASE_URL=postgresql://<user>:<password>@<pooled-host>.neon.tech/neondb?sslmode=require&channel_binding=require
```

`server/.env` is gitignored — never commit it.

> No `DATABASE_URL` yet? The app still runs; the Saved Flows tab will report
> the database is unavailable and work is saved locally only.

## 4. Run it

```bash
npm run dev          # Vite on http://localhost:5173, Express API on :8787
```

Open http://localhost:5173 and enter the access PIN (`39281`, defined in
`server/access-config.js`).

## 5. Verify the database connection

The table (`rett_flows`) auto-creates on the first request. To confirm the
server is talking to Neon, unlock the app in the browser, open the **Saved
Flows** tab, and enter a client — it should appear in the list and survive a
hard refresh (and a different browser). Or from a shell:

```bash
# health check (no auth needed)
curl -s http://localhost:8787/api/health

# list flows (needs the access cookie — grab it by unlocking in the browser,
# or POST the PIN to /api/access/verify with a cookie jar first)
```

## Where the pieces live

| Concern | File |
| --- | --- |
| DB pool + schema bootstrap | `server/db.js` |
| REST routes (`/api/flows`) | `server/flows.js` |
| Route mount + access gate | `server/index.js` |
| Browser sync + Saved Flows UI | `public/rett-react-only/cloud-sync.js` |
| History page scaffold | `src/components/pages/PageHistory.tsx` |

Production deployment (env in `/etc/rett/server.env`, pm2, Nginx) is covered in
[DEPLOYMENT.md](DEPLOYMENT.md).
