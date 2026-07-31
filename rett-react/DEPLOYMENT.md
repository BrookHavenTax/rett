# Production deployment — RETT React app on AWS EC2

This is the runbook for the **live** deployment. Everything below was verified
against the running box on **2026-07-30**; where this doc and your memory
disagree, re-verify with the smoke tests in §6 before changing anything.

> **Read §1 before anything else.** A previous version of this doc described an
> architecture that was never deployed (Nginx serving static files out of
> `/var/www`, a pm2 app called `rett-api`, a placeholder domain). That cost a
> real deploy real time. The facts below are the ones that matter.

---

## 1. Production facts (the whole point of this document)

| Thing | Value |
| --- | --- |
| **Public URL** | <https://18.222.239.106.sslip.io> |
| **Host** | `ubuntu@18.222.239.106` (EC2 `i-068c00424e3cead53`, `t3.micro`, `us-east-2`) |
| **SSH key** | `~/.ssh/rett-ec2.pem` |
| **OS / runtime** | Ubuntu 26.04 LTS, Node v22.22.2, npm 10.9.7, pm2 7.0.1 |
| **Deploy dir** | `~/rett-react` — a git clone of `BrookHavenTax/rett`, branch `main` |
| **App dir** | `~/rett-react/rett-react` (the repo has the app one level down) |
| **pm2 app name** | **`rett`** (running as the `ubuntu` user) |
| **App port** | `127.0.0.1:8787` (loopback only; not exposed publicly) |
| **Live env file** | `~/rett-react/rett-react/server/.env` (mode `0600`) |
| **Nginx site** | `/etc/nginx/sites-available/rett.conf` → symlinked into `sites-enabled/` |
| **TLS cert** | `/etc/letsencrypt/live/18.222.239.106.sslip.io/`, auto-renewing |

SSH in:

```bash
ssh -i ~/.ssh/rett-ec2.pem ubuntu@18.222.239.106
```

Note on the key: `~/.ssh/rett-ec2.pem` and `~/Downloads/rettnew.pem` are the
**same key** (both `SHA256:C0Ufo6QU1599fxlQGdYvG8mgt2meMCxIKzjFPQmQddE`).
`~/.ssh/rett-ec2.pem` is the canonical path — use it.

There is **no custom domain**. The hostname is
`18.222.239.106.sslip.io`, which is [sslip.io](https://sslip.io) resolving the
embedded IP back to itself. That is what makes a free Let's Encrypt cert
possible without owning a domain. If the elastic IP ever changes, the hostname,
the cert, and the Nginx `server_name` all change with it — see §8.

---

## 2. Deploying an update

This is the whole deploy. Run it on the box:

```bash
cd ~/rett-react
git fetch origin
git reset --hard origin/main
cd rett-react
npm ci
npm run build
pm2 restart rett --update-env
pm2 save
```

Then run the smoke tests in §6. As a one-liner:

```bash
ssh -i ~/.ssh/rett-ec2.pem ubuntu@18.222.239.106 \
  'cd ~/rett-react && git fetch origin && git reset --hard origin/main && cd rett-react && npm ci && npm run build && pm2 restart rett --update-env && pm2 save'
```

Why each step:

- **`git reset --hard origin/main`**, not `git pull`. The working tree on the
  box has untracked cruft in it (§9) and a merge/rebase on a production box is
  a failure mode nobody wants at 11pm. Reset makes the checkout exactly
  `origin/main`. Untracked files survive a reset — see §9 for the cleanup.
- **`npm ci` in `rett-react/`, not the repo root.** There is no package
  manifest at the repo root. `npm ci` here also runs the `postinstall` hook
  (`cd server && npm install --omit=dev`), so the Express server's own
  dependencies are installed as part of this step — you do **not** need a
  separate install in `server/`.
- **`npm run build`** = `tsc -b && vite build`, writing `rett-react/dist/`.
  This is what actually gets served (§3). Builds run **on the box**; a failure
  here leaves the previous `dist/` in place and the site still up, which is
  why the restart comes after the build and not before.
- **`pm2 restart rett --update-env`** re-reads `server/.env`. Without
  `--update-env`, pm2 reuses the environment captured at first start, so an
  env change appears to do nothing.
- **`pm2 save`** rewrites the pm2 dump so the app comes back after a reboot.

**Deploys do not touch Nginx, TLS, or `server/.env`.** The site PIN lives in
`server/access-config.js` in the repo, so rotating it is a normal code change
that ships through the sequence above with no server-side env edit.

### When the upstream calculator changes

Run the sync locally, commit, push, then deploy normally:

```bash
# on your laptop
cd rett-react && npm run sync:upstream && npm run build   # verify it builds
git add -A && git commit && git push origin main
# then run the deploy sequence above on the box
```

There is no `rsync` step. Nothing is copied from your laptop to the box — the
box builds from git. (See `SYNC.md` for what `sync:upstream` actually does.)

---

## 3. Architecture (what actually runs)

```
                 ┌────────────────────────────────────────────────────┐
                 │ EC2 t3.micro — ubuntu@18.222.239.106               │
                 │                                                    │
  Internet ──▶ Nginx :443 (TLS terminator ONLY)                       │
               server_name 18.222.239.106.sslip.io                    │
                 │                                                    │
                 │  location /  →  proxy_pass 127.0.0.1:8787          │
                 │  ALL paths. No `root`. No static files in Nginx.   │
                 │                     │                              │
                 │                     ▼                              │
                 │  pm2 app "rett"  →  node server/index.js           │
                 │    cwd  /home/ubuntu/rett-react/rett-react         │
                 │                                                    │
                 │    ├─ express.static('../dist')  ← the React build │
                 │    ├─ SPA catch-all → dist/index.html              │
                 │    ├─ /api/gemini/*   (holds GEMINI_API_KEY)       │
                 │    ├─ /api/flows/*    (Neon Postgres)              │
                 │    └─ /api/access/*   (PIN gate)                   │
                 └────────────────────────────────────────────────────┘
```

**One Node process serves everything** — the static bundle *and* the API. Nginx
is a TLS terminator and reverse proxy, nothing more. `server/index.js` mounts
`express.static(resolve(__dirname, '..', 'dist'))` plus an SPA catch-all, which
is why `location /` can proxy the whole site to `:8787`.

Consequences worth internalizing:

- **A stale `dist/` is a stale site.** If you `git reset` but skip
  `npm run build`, Nginx happily serves the old bundle; there is no separate
  static root to inspect. `pm2 restart` alone does not rebuild anything.
- **`/var/www` is irrelevant.** Nothing reads from it. If you find yourself
  rsyncing into `/var/www/rett-react/dist`, you are following the old, wrong
  runbook.
- **The app trusts one proxy hop** (`app.set('trust proxy', 1)`) so `req.ip` is
  the real client for rate limiting and `req.secure` reflects
  `X-Forwarded-Proto` so the access cookie gets its `Secure` flag. That is
  correct *because* Nginx is in front and sets those headers. Do not expose
  `:8787` directly.

### The live Nginx config

`/etc/nginx/sites-available/rett.conf`, symlinked into `sites-enabled/`
(it is the only enabled site — the stock `default` site is gone):

```nginx
server {
  server_name 18.222.239.106.sslip.io;

  client_max_body_size 12m;   # matches multer 10MB cap + slack

  location / {
    proxy_pass         http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;   # Gemini extraction can take ~20s
  }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/18.222.239.106.sslip.io/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/18.222.239.106.sslip.io/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = 18.222.239.106.sslip.io) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

  listen 80;
  listen [::]:80;
  server_name 18.222.239.106.sslip.io;
    return 404; # managed by Certbot
}
```

Certbot wrote the `listen 443`/`ssl_*` lines and the port-80 block. Reload
after any edit with `sudo nginx -t && sudo systemctl reload nginx`.

### `http://18.222.239.106/` returning 404 is correct, not an outage

Read this before you page yourself. Hitting the box by **bare IP over plain
HTTP** returns **404**, by design:

- The port-80 server block redirects to HTTPS **only when `$host` is
  `18.222.239.106.sslip.io`**.
- A bare-IP request has `$host = 18.222.239.106`, matches no `server_name`,
  falls through to Certbot's catch-all, and gets `return 404`.

So the expected results are:

| Request | Expected | Meaning |
| --- | --- | --- |
| `http://18.222.239.106/` | **404** | By design. Not an outage. |
| `http://18.222.239.106.sslip.io/` | **301** → `https://…` | Certbot redirect. |
| `https://18.222.239.106.sslip.io/` | **200** | The app. |

Diagnose outages against the **hostname over HTTPS**, never the bare IP.

---

## 4. Secrets and env on the box

The live env file is **`~/rett-react/rett-react/server/.env`**, mode `0600`,
owned by `ubuntu`. It is gitignored and must never be committed — this repo is
public. It currently sets:

```
GEMINI_API_KEY   # W-2 / 1040 autofill proxy
GEMINI_MODEL     # gemini-2.5-flash
PORT             # 8787
ALLOWED_ORIGINS
DATABASE_URL     # Neon Postgres — saved flows
```

`server/.env.example` is the annotated template; copy it and fill in real
values from the Neon dashboard / password manager, out of band.

`server/index.js` loads env from `/etc/rett/server.env` **first**, then
`server/.env`, with `override: false` — so if `/etc/rett/server.env` ever
exists it silently wins. **On this box `/etc/rett/` exists but is empty**, so
`server/.env` is the file in effect. If the app comes up with the wrong key
after you edited `server/.env`, check that nobody dropped a file into
`/etc/rett/` — and remember `pm2 restart` needs `--update-env` to pick up env
changes at all.

Because env lives in the deploy dir, **`git reset --hard` does not touch it**
(it is untracked/ignored), and neither does `npm ci`. Env changes are a
separate, manual, deliberate act.

---

## 5. pm2

```bash
pm2 list                      # app "rett" should be "online"
pm2 describe rett             # script path, cwd, restart count
pm2 logs rett --lines 200     # recent output
pm2 restart rett --update-env
pm2 save                      # persist for reboot
```

Facts as deployed:

- Name **`rett`**. (Older docs said `rett-api`; there has never been a process
  by that name here. `pm2 restart rett-api` just errors.)
- Runs as the **`ubuntu`** user, not a dedicated service account. Older docs
  described a locked-down `rett` system user with env in `/etc/rett` — that was
  never built. Worth doing someday; it is not what is running today.
- Script `/home/ubuntu/rett-react/rett-react/server/index.js`, interpreter
  `node`, cwd `/home/ubuntu/rett-react/rett-react`, fork mode.
- Boot persistence: the `pm2-ubuntu` systemd unit is **enabled**, and the
  process list is saved via `pm2 save`.

---

## 6. Smoke tests

On the box (bypasses Nginx — isolates "is the app up?"):

```bash
curl -s http://127.0.0.1:8787/api/health
curl -s http://127.0.0.1:8787/api/access/status
```

`/api/health` should return `{"ok":true,"keyConfigured":true,"defaultModel":"gemini-2.5-flash",...}`.
`keyConfigured:false` means the Gemini key did not load — see §4.

From anywhere (exercises DNS + TLS + Nginx + app):

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://18.222.239.106.sslip.io/
curl -sS https://18.222.239.106.sslip.io/api/health
```

Both endpoints are outside the PIN gate, so they answer without a session
cookie. Loading the app itself in a browser prompts for the PIN — that is the
access gate working, not a failure.

A green deploy is: `pm2 list` shows `rett` online, both local curls succeed,
the public URL returns 200, and the browser loads past the PIN.

---

## 7. TLS certificates

- Cert lives at `/etc/letsencrypt/live/18.222.239.106.sslip.io/`, issued by
  Let's Encrypt for CN `18.222.239.106.sslip.io`.
- Current cert: issued 2026-07-24, **valid to 2026-10-22**.
- Renewal is automatic — `certbot.timer` is enabled and active. Certbot
  renews within 30 days of expiry and reloads Nginx itself.

Check or dry-run:

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

---

## 8. If the elastic IP changes

The IP is baked into the hostname, so an IP change breaks the hostname, the
cert, and the Nginx `server_name` at once. Re-point everything to the new
`<new-ip>.sslip.io`:

```bash
sudo sed -i 's/18\.222\.239\.106/<NEW-IP>/g' /etc/nginx/sites-available/rett.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d <NEW-IP>.sslip.io --agree-tos -m you@example.com --redirect
```

Then update §1 of this doc, and `ALLOWED_ORIGINS` in `server/.env` if it names
the old hostname. Better: keep the elastic IP associated so this never happens.

---

## 9. Known drift on the box (untracked files)

`git status` in `~/rett-react` is **not** clean. Two untracked files:

| File | What it is |
| --- | --- |
| `package-lock.json` (repo root) | Stray. Left by an `npm install` run at the repo root, where there is no `package.json`. Harmless but confusing — nothing reads it. |
| `rett-react/server/.env.bak.1784854323` | An env backup sitting next to the live `server/.env`. |

**The `.env.bak` file should be removed.** It contains a `GEMINI_API_KEY` line
(it predates the Neon work — no `DATABASE_URL`), and unlike the live `.env`
(mode `0600`) it is mode **`0664` — readable by every user on the box**. That
is a real, if small, credential-exposure gap, and the key in it is stale enough
to be worth rotating rather than preserving.

Neither file affects the running app, and neither is removed by the deploy
sequence (`git reset --hard` leaves untracked files alone). Cleanup, when
someone decides to do it:

```bash
rm ~/rett-react/rett-react/server/.env.bak.1784854323
rm ~/rett-react/package-lock.json
```

Deliberately **not** part of the deploy runbook — deleting a file that might be
the only copy of a working key belongs to a human, not to a script.

---

## 10. Rebuilding this box from scratch

Only needed if the instance is lost. This reflects what is actually deployed,
not an aspiration.

```bash
# --- 1. Launch: Ubuntu 26.04 LTS, t3.micro, 8 GB gp3, us-east-2.
#        Security group: inbound 22 (your IP), 80, 443 (0.0.0.0/0). Outbound all.
#        Allocate + associate an elastic IP.

# --- 2. Bootstrap
sudo apt update && sudo apt -y upgrade
sudo apt -y install nginx git curl ufw
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs
sudo npm i -g pm2

sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# --- 3. Code
cd ~ && git clone https://github.com/BrookHavenTax/rett.git rett-react
cd ~/rett-react/rett-react
npm ci          # postinstall also installs server/ deps
npm run build

# --- 4. Secrets  (see §4 for the key list; get real values out of band)
cp server/.env.example server/.env
chmod 600 server/.env
${EDITOR:-nano} server/.env

# --- 5. pm2
pm2 start server/index.js --name rett
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu   # run the sudo line it prints

# --- 6. Nginx — plain HTTP first; certbot adds the TLS block in step 7.
sudo tee /etc/nginx/sites-available/rett.conf > /dev/null <<'EOF'
server {
  listen 80;
  server_name <NEW-IP>.sslip.io;

  client_max_body_size 12m;

  location / {
    proxy_pass         http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
  }
}
EOF
sudo ln -sf /etc/nginx/sites-available/rett.conf /etc/nginx/sites-enabled/rett.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# --- 7. TLS
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d <NEW-IP>.sslip.io --non-interactive \
  --agree-tos -m you@example.com --redirect
```

Then run §6's smoke tests and update §1 with the new IP.

---

## 11. Operational checklist

- [ ] `pm2 list` shows **`rett`** `online`?
- [ ] `curl http://127.0.0.1:8787/api/health` returns `keyConfigured: true`?
- [ ] `curl https://18.222.239.106.sslip.io/api/health` returns the same from outside?
- [ ] Browser loads `https://18.222.239.106.sslip.io/` and prompts for the PIN?
- [ ] `pm2 logs rett --lines 200` clean?
- [ ] `git status` in `~/rett-react` shows only the two known untracked files (§9)?
- [ ] `sudo certbot certificates` shows > 30 days remaining?
- [ ] `server/.env` still mode `0600`?
- [ ] AWS billing alarm set, and a Gemini per-key budget cap in Google AI Studio?

## 12. Cost notes

- `t3.micro` on-demand in `us-east-2`: ~$7.50/mo, plus ~$0.80/mo for the 8 GB
  gp3 volume. An idle elastic IP costs extra only when *not* associated.
- Outbound data: first 1 GB/mo free, then ~$0.09/GB. The bundle is ~250 KB
  gzipped, so 100k page views ≈ 25 GB out ≈ $2.25.
- Gemini 2.5 Flash: ~$0.075 per million input tokens, ~$0.30 per million
  output. A W-2 extraction is ~2–4k input + ~200 output ≈ $0.0005 each.
- The box is small: ~900 MB RAM and ~3 GB free disk. `npm ci && npm run build`
  runs on it comfortably today, but it is the tightest part of the deploy — if
  a build ever dies mid-way, check `df -h` and memory before blaming the code.
