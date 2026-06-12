# Deploying the RETT React app on AWS EC2

This document is a runbook for getting the React frontend + Express Gemini
proxy onto an Ubuntu 24.04 EC2 instance, fronted by Nginx, and reachable
over HTTPS at a domain you control.

## 0. Architecture

```
                 ┌──────────────────────────────────────────┐
                 │ EC2 (t3.small or t3.micro is enough)     │
                 │                                          │
  Internet ───▶ Nginx :443 ──┬─▶ /            (static)      │
                             │   /var/www/rett-react/dist/  │
                             │                              │
                             └─▶ /api/...     (proxy)       │
                                 → http://127.0.0.1:8787    │
                                   pm2-managed Node:        │
                                   server/index.js          │
                                   (holds GEMINI_API_KEY)   │
                 └──────────────────────────────────────────┘
```

Two key benefits of this setup:

- **The Gemini API key never leaves the server.** It's in
  `/etc/rett/server.env`, readable only by the `rett` user.
- **HTTP/2 + gzip on Nginx** for the static bundle; Node only handles the
  one `/api/*` route. Easy to scale, easy to debug.

---

## 1. Pre-flight (do this on your laptop)

1. **Rotate the Gemini API key you sent in chat.** Do this *before* you put
   anything on EC2. <https://aistudio.google.com/apikey>.
2. Buy or repoint a domain (e.g. `rett.yourdomain.com`) to the EC2
   instance's elastic IP. Without a domain you can't get a free TLS cert
   from Let's Encrypt.
3. Build the React bundle locally to make sure it builds:
   ```bash
   cd rett-react && npm install && npm run build
   ls dist/   # should contain index.html, assets/, legacy/, data/
   ```

## 2. Launch the EC2 instance

| Setting              | Value                                                       |
| -------------------- | ----------------------------------------------------------- |
| AMI                  | `Ubuntu 24.04 LTS (HVM), SSD Volume Type` (ARM64 or x86_64) |
| Instance type        | `t3.small` (2 vCPU, 2 GB) — `t3.micro` works for low traffic |
| Storage              | 20 GB gp3                                                   |
| Security group       | Inbound 22 (your IP), 80, 443 (0.0.0.0/0). Outbound: all.   |
| Key pair             | One you have local access to                                |
| Elastic IP           | Allocate + associate so the IP doesn't change on reboot     |

SSH in:

```bash
ssh -i ~/.ssh/your-key.pem ubuntu@<elastic-ip>
```

## 3. System bootstrap

```bash
# Latest packages and the basics.
sudo apt update && sudo apt -y upgrade
sudo apt -y install nginx git curl ufw

# Node 20 LTS via NodeSource.
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs

# pm2 globally for managing the Express proxy as a service.
sudo npm i -g pm2

# Firewall — only Nginx + SSH.
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Dedicated runtime user (no sudo, no home write outside /var/lib/rett).
sudo useradd -r -m -d /var/lib/rett -s /usr/sbin/nologin rett
```

## 4. Get the code onto the box

```bash
sudo mkdir -p /var/www/rett-react
sudo chown -R ubuntu:ubuntu /var/www/rett-react

# Option A — push from laptop with rsync (recommended for iteration):
#   on your laptop, after `npm run build`:
#     rsync -avz --delete rett-react/dist/        ubuntu@HOST:/var/www/rett-react/dist/
#     rsync -avz --delete rett-react/server/      ubuntu@HOST:/var/www/rett-react/server/
#     rsync -avz --delete rett-react/package.json ubuntu@HOST:/var/www/rett-react/

# Option B — clone on the box if you've pushed it to a private repo:
#   cd /var/www && sudo -u ubuntu git clone git@github.com:you/rett.git rett-react
#   cd rett-react && npm install && npm run build

# Either way, install the proxy's deps:
cd /var/www/rett-react/server
npm install --omit=dev
```

## 5. Configure the API key (the only secret on the box)

```bash
sudo mkdir -p /etc/rett
sudo tee /etc/rett/server.env > /dev/null <<'EOF'
GEMINI_API_KEY=PASTE_THE_NEW_ROTATED_KEY_HERE
GEMINI_MODEL=gemini-2.5-flash
PORT=8787
ALLOWED_ORIGINS=https://rett.yourdomain.com
RATE_LIMIT_WINDOW_MS=600000
RATE_LIMIT_MAX=30
EOF

sudo chown root:rett /etc/rett/server.env
sudo chmod 640 /etc/rett/server.env  # only root + rett group can read it
```

## 6. Run the proxy under pm2

```bash
# Start the proxy as the rett user, loading env from the file above.
sudo -u rett env $(cat /etc/rett/server.env | xargs) \
  pm2 start /var/www/rett-react/server/index.js --name rett-api

# Persist across reboots.
sudo -u rett pm2 save
sudo env PATH=$PATH pm2 startup systemd -u rett --hp /var/lib/rett

# Smoke test:
curl -s http://127.0.0.1:8787/api/health | jq
# {"ok":true,"keyConfigured":true,"defaultModel":"gemini-2.5-flash",...}
```

## 7. Configure Nginx

```bash
sudo tee /etc/nginx/sites-available/rett.conf > /dev/null <<'EOF'
server {
  listen 80;
  server_name rett.yourdomain.com;

  # Static React bundle.
  root /var/www/rett-react/dist;
  index index.html;

  # gzip everything that compresses well.
  gzip on;
  gzip_types text/plain application/javascript application/json text/css image/svg+xml;
  gzip_min_length 1024;

  # SPA fallback — every URL that isn't a real file goes to index.html so
  # client-side routing works.
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Proxy /api/* to the Express server holding the Gemini key.
  location /api/ {
    proxy_pass         http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    client_max_body_size 12m;   # matches multer's 10 MB cap + slack
    proxy_read_timeout   120s; # Gemini extraction can take ~20s on big PDFs
  }

  # Long-cache the hashed Vite assets; never cache index.html.
  location /assets/ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
  }
  location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
  }
}
EOF

sudo ln -sf /etc/nginx/sites-available/rett.conf /etc/nginx/sites-enabled/rett.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Open `http://rett.yourdomain.com` and confirm it loads.

## 8. HTTPS via Let's Encrypt

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d rett.yourdomain.com --non-interactive \
  --agree-tos -m you@yourdomain.com --redirect
```

Certbot rewrites the Nginx config to add the 443 server block and an
HTTP→HTTPS redirect, and installs an auto-renew systemd timer.

## 9. Updating the site

**Simple deploy (git + pm2 — same as always):**

```bash
cd ~/rett-react
git pull origin main
cd rett-react
npm ci
npm run build
pm2 restart rett
```

The site PIN lives in `server/access-config.js` in the repo — no new env
vars on EC2. Your existing `server/.env` (Gemini key only) is unchanged.

Smoke test:

```bash
curl -s http://127.0.0.1:8787/api/health
curl -s http://127.0.0.1:8787/api/access/status
```

When the upstream calculator changes:

```bash
# locally
cd rett-react && npm run sync:upstream && npm run build
rsync -avz --delete dist/ ubuntu@HOST:/var/www/rett-react/dist/
```

## 10. Operational checklist

- [ ] Rotated the Gemini key that was leaked in chat? (do this first)
- [ ] `/etc/rett/server.env` is `0640 root:rett`?
- [ ] `pm2 status` shows `rett-api` `online`?
- [ ] `curl https://rett.yourdomain.com/api/health` returns `keyConfigured: true`?
- [ ] `Nginx access log` shows `/api/gemini/extract-w2` `200`s when you upload a W-2?
- [ ] `pm2 logs rett-api --lines 200` is clean?
- [ ] Cloudwatch / billing alarm set on the AWS account so a leaked endpoint
      doesn't surprise you with a bill?
- [ ] Gemini per-key budget cap configured in Google AI Studio? (separate
      from AWS — limits the API spend specifically.)

## 11. Cost notes

- `t3.small` on-demand: ~$15/mo. Reserved 1-year: ~$9/mo.
- Outbound data: first 1 GB/mo is free, then $0.09/GB. The whole bundle is
  ~250 KB gzipped; serving 100k page views ≈ 25 GB out ≈ $2.25.
- Gemini 2.5 Flash: ~$0.075 per million input tokens, ~$0.30 per million
  output. A W-2 extraction is roughly 2–4k input tokens + ~200 output, so
  ~$0.0005/extraction.
