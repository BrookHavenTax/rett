// Session access gate for the RETT React app.
//
// The browser never receives the PIN — verification happens server-side and
// issues an httpOnly session cookie. Legacy calculator scripts and /api/*
// routes (except verify/status/health) are blocked without a valid cookie,
// so removing the React overlay in DevTools cannot unlock the engine or
// Gemini proxy.

import crypto from 'node:crypto';
import { ACCESS_PIN, ACCESS_COOKIE_SECRET } from './access-config.js';

const COOKIE_NAME = 'rett_access';
const PUBLIC_API_PATHS = new Set([
  '/api/access/verify',
  '/api/access/status',
  '/api/health',
]);

function parseCookies(req) {
  const raw = req.headers.cookie;
  if (!raw) return {};
  const out = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
}

function signToken(ts) {
  return crypto
    .createHmac('sha256', ACCESS_COOKIE_SECRET)
    .update(String(ts))
    .digest('base64url');
}

function issueAccessCookie(res, req) {
  const ts = Date.now();
  const sig = signToken(ts);
  const value = `${ts}.${sig}`;
  const secure = process.env.NODE_ENV === 'production' || req?.secure;
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearAccessCookie(res, req) {
  const secure = process.env.NODE_ENV === 'production' || req?.secure;
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function isAccessGranted(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const ts = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(ts) || !sig) return false;
  const expected = signToken(ts);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyPin(pin) {
  const submitted = String(pin ?? '').trim();
  const expected = ACCESS_PIN;
  try {
    const a = Buffer.from(submitted);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Only the calculator LOGIC is gated — the engine JS (tax math, solvers) and
// the tax-bracket data. The upstream stylesheet and other static assets are
// NOT gated: index.html requests /legacy/css/styles.css via a static <link>
// during the initial (still-locked) page load, so gating it would 403 the
// base stylesheet and leave the app unstyled. CSS is presentation, not IP;
// the engine JS is loaded dynamically only AFTER unlock, so those requests
// always carry the session cookie.
function isGatedAsset(path) {
  return path.startsWith('/legacy/js/') || path.startsWith('/data/');
}

export function createAccessGateMiddleware() {
  return (req, res, next) => {
    const path = req.path || req.url?.split('?')[0] || '';
    if (PUBLIC_API_PATHS.has(path)) return next();
    if (path.startsWith('/api/') && !isAccessGranted(req)) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Access required. Enter the access code to continue.' }));
      return;
    }
    if (isGatedAsset(path) && !isAccessGranted(req)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Access denied');
      return;
    }
    next();
  };
}

export function registerAccessRoutes(app, { verifyLimiter } = {}) {
  app.get('/api/access/status', (req, res) => {
    res.json({ unlocked: isAccessGranted(req) });
  });

  const verifyHandler = (req, res) => {
    const pin = req.body?.pin;
    if (!verifyPin(pin)) {
      return res.status(401).json({
        error: 'Incorrect access code. Please try again.',
      });
    }
    issueAccessCookie(res, req);
    return res.json({ unlocked: true });
  };

  if (verifyLimiter) {
    app.post('/api/access/verify', verifyLimiter, verifyHandler);
  } else {
    app.post('/api/access/verify', verifyHandler);
  }

  app.post('/api/access/logout', (req, res) => {
    clearAccessCookie(res, req);
    res.json({ unlocked: false });
  });
}
