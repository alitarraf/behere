import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';
import { drawNextFire, pickMode } from './schedule.js';
import { pickLine } from './lines.js';
import { distill } from '../app/seed.js';
import { telegramPing } from './telegram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(__dirname, '..', 'app');
const DATA = path.join(__dirname, 'data');
const PORT = process.env.PORT || 8090;

const cfg = {
  windowStart: process.env.WINDOW_START || '07:00',
  windowEnd: process.env.WINDOW_END || '23:00',
  bellsPerDay: Number(process.env.BELLS_PER_DAY || 4),
  minGapMin: Number(process.env.MIN_GAP_MIN || 90),
  // visual stays 0 until M3 ships the renderer
  weights: {
    buzz: Number(process.env.W_BUZZ ?? 1),
    line: Number(process.env.W_LINE ?? 1),
    visual: Number(process.env.W_VISUAL ?? 0),
  },
  ttlSec: Number(process.env.PUSH_TTL_SEC || 600),
};

// ---------- persistent state ----------
const statePath = path.join(DATA, 'state.json');
let state = { nextFireAt: null, next: null, failures: 0, dead: false, deviceSeenAt: null };
if (existsSync(statePath)) {
  try { state = { ...state, ...JSON.parse(await readFile(statePath, 'utf8')) }; }
  catch { /* corrupted state: start fresh */ }
}
const saveState = () => writeFile(statePath, JSON.stringify(state, null, 2));

// ---------- vapid ----------
const vapidPath = path.join(DATA, 'vapid.json');
if (!existsSync(vapidPath)) {
  await writeFile(vapidPath, JSON.stringify(webpush.generateVAPIDKeys(), null, 2));
}
const vapid = JSON.parse(await readFile(vapidPath, 'utf8'));
webpush.setVapidDetails('mailto:ali.tarraf@gmail.com', vapid.publicKey, vapid.privateKey);

// ---------- bell ----------
const subPath = path.join(DATA, 'subscription.json');

// Pick the WHOLE next bell — time AND manifestation — up front, so the phone
// can be handed it ahead of time and fire it locally (see /next). ts is the
// scheduled instant and doubles as the visual seed, so the phone's local render
// and any web-push fallback are identical.
async function reschedule(from = new Date()) {
  const ts = drawNextFire(from, cfg).getTime();
  const mode = pickMode(cfg.weights);
  const text = mode === 'line' ? pickLine()
             : mode === 'visual' ? distill(ts)
             : undefined;
  state.nextFireAt = ts;                 // kept for the web-push tick + restore
  state.next = { ts, mode, ...(text ? { text } : {}) };
  await saveState();
  console.log('next bell:', mode, '@', new Date(ts).toString());
}

async function fireBell() {
  if (!existsSync(subPath)) { console.log('no subscription yet'); return; }
  const sub = JSON.parse(await readFile(subPath, 'utf8'));
  // Use the manifestation chosen at schedule time (state.next), so a web-push
  // bell and a native local-alarm bell for the same moment are identical.
  const { mode, ts, text } = state.next || { mode: pickMode(cfg.weights), ts: Date.now() };
  const payload = { mode, ts };
  if (text) payload.text = text;

  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: cfg.ttlSec });
    state.failures = 0;
    console.log('bell sent:', mode);
  } catch (e) {
    const code = e.statusCode || 0;
    console.error('bell failed:', code, e.body || e.message);
    if (code === 404 || code === 410) {
      state.dead = true;
      await telegramPing('the bell is dead — subscription expired. Open BeHereNow on the phone and tap begin again.');
    } else if (++state.failures === 5) {
      await telegramPing(`the bell has failed ${state.failures} times in a row (last: HTTP ${code}).`);
    }
  }
  await saveState();
}

// Boot: a nextFireAt missed while the server was down simply evaporates.
// Also regenerate if the manifestation (state.next) is missing — older state.json
// predates it.
if (!state.nextFireAt || state.nextFireAt < Date.now() || !state.next) await reschedule();
else console.log('next bell (restored):', state.next.mode, '@', new Date(state.nextFireAt).toString());

setInterval(async () => {
  if (state.dead || !state.nextFireAt) return;
  if (Date.now() >= state.nextFireAt) {
    await fireBell();
    if (!state.dead) await reschedule();
  }
}, 30_000);

// ---------- http ----------
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.css': 'text/css',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');

  if (req.method === 'GET' && url.pathname === '/vapid') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ key: vapid.publicKey }));
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({
      subscribed: existsSync(subPath),
      dead: state.dead,
      failures: state.failures,
      nextFireAt: state.nextFireAt ? new Date(state.nextFireAt).toString() : null,
      window: `${cfg.windowStart}-${cfg.windowEnd}`,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }));
  }

  // Native app: the upcoming bell, handed over ahead of time so the phone can
  // set a local exact alarm and fire it itself (no push in the critical path).
  if (req.method === 'GET' && url.pathname === '/next') {
    state.deviceSeenAt = Date.now();     // the phone is alive; note it for liveness
    saveState();                         // fire-and-forget; a lost write just re-syncs
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' });
    return res.end(JSON.stringify(state.next || null));
  }

  // Native app identity. Poll-based needs no token; a token may be sent later if
  // we add an FCM re-sync nudge. Either way this marks the device present.
  if (req.method === 'POST' && url.pathname === '/register') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let dev = {};
    try { dev = body ? JSON.parse(body) : {}; } catch { /* empty registration is fine */ }
    dev.registeredAt = Date.now();
    await writeFile(path.join(DATA, 'device.json'), JSON.stringify(dev, null, 2));
    state.deviceSeenAt = Date.now();
    state.dead = false;
    state.failures = 0;
    await saveState();
    console.log('device registered:', dev.kind || 'native', dev.token ? '(token)' : '(poll)');
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'POST' && url.pathname === '/subscribe') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const sub = JSON.parse(body);
      if (!sub.endpoint) throw new Error('no endpoint');
      await writeFile(subPath, JSON.stringify(sub, null, 2));
      state.dead = false;
      state.failures = 0;
      await reschedule();
      console.log('subscribed:', sub.endpoint.slice(0, 60) + '…');
      res.writeHead(204);
    } catch {
      res.writeHead(400);
    }
    return res.end();
  }

  // static app
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = path.join(APP, path.normalize(file));
  if (!full.startsWith(APP) || !existsSync(full)) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(full)] || 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  res.end(await readFile(full));
});

server.listen(PORT, () => console.log(
  `bell-server on :${PORT} | window ${cfg.windowStart}-${cfg.windowEnd} | ~${cfg.bellsPerDay}/day, min gap ${cfg.minGapMin}m`
));
