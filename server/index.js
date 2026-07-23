import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawNextFire, pickMode, parseHM } from './schedule.js';
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
  weights: {
    buzz: Number(process.env.W_BUZZ ?? 1),
    line: Number(process.env.W_LINE ?? 1),
    visual: Number(process.env.W_VISUAL ?? 0),
  },
};

// Warn on Telegram if the phone stops syncing for this long during waking hours —
// the poll model's replacement for the old web-push "subscription expired" alert.
const QUIET_MS = 6 * 3600_000;
const REPING_MS = 12 * 3600_000;

// ---------- persistent state ----------
const statePath = path.join(DATA, 'state.json');
let state = { nextFireAt: null, next: null, deviceSeenAt: null, lastQuietPingAt: null };
if (existsSync(statePath)) {
  try { state = { ...state, ...JSON.parse(await readFile(statePath, 'utf8')) }; }
  catch { /* corrupted state: start fresh */ }
}
const saveState = () => writeFile(statePath, JSON.stringify(state, null, 2));

// Pick the WHOLE next bell — time AND manifestation — up front, so the phone can
// be handed it ahead of time (GET /next) and fire it itself via a local exact
// alarm. ts is the scheduled instant and doubles as the visual seed, so the
// phone's local render matches. The server no longer delivers bells — the phone
// does; the server only owns the schedule and watches for a silent phone.
async function reschedule(from = new Date()) {
  const ts = drawNextFire(from, cfg).getTime();
  const mode = pickMode(cfg.weights);
  const text = mode === 'line' ? pickLine()
             : mode === 'visual' ? distill(ts)
             : undefined;
  state.nextFireAt = ts;
  state.next = { ts, mode, ...(text ? { text } : {}) };
  await saveState();
  console.log('next bell:', mode, '@', new Date(ts).toString());
}

function inWakingWindow(d) {
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= parseHM(cfg.windowStart) && m < parseHM(cfg.windowEnd);
}

// One coarse safety net: if the phone hasn't polled /next in a long while during
// waking hours, something's wrong (Tailscale down, app killed, battery). Ping once.
async function checkDeviceLiveness(now) {
  if (!state.deviceSeenAt) return;                 // no phone has ever registered
  if (!inWakingWindow(new Date(now))) return;
  const quiet = now - state.deviceSeenAt;
  if (quiet > QUIET_MS) {
    if (!state.lastQuietPingAt || now - state.lastQuietPingAt > REPING_MS) {
      state.lastQuietPingAt = now;
      await saveState();
      await telegramPing(`the phone has been quiet ${Math.round(quiet / 3600_000)}h — no bell sync. Tailscale down, or the app got killed?`);
    }
  } else if (state.lastQuietPingAt) {
    state.lastQuietPingAt = null;                   // recovered — re-arm the warning
    await saveState();
  }
}

// Boot: a nextFireAt missed while the server was down simply evaporates.
if (!state.nextFireAt || state.nextFireAt < Date.now() || !state.next) await reschedule();
else console.log('next bell (restored):', state.next.mode, '@', new Date(state.nextFireAt).toString());

// The server no longer fires — it just keeps the schedule ahead of the clock so
// /next is always in the future, and watches for a silent phone.
setInterval(async () => {
  const now = Date.now();
  if (state.nextFireAt && now >= state.nextFireAt) await reschedule();
  await checkDeviceLiveness(now);
}, 30_000);

// ---------- http ----------
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.css': 'text/css',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({
      next: state.next,
      nextFireAt: state.nextFireAt ? new Date(state.nextFireAt).toString() : null,
      deviceSeenAt: state.deviceSeenAt ? new Date(state.deviceSeenAt).toString() : null,
      window: `${cfg.windowStart}-${cfg.windowEnd}`,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }));
  }

  // Native app: the upcoming bell, handed over ahead of time so the phone can set
  // a local exact alarm and fire it itself. Lazily advance so a poll right after a
  // bell fires never gets a past time.
  if (req.method === 'GET' && url.pathname === '/next') {
    if (state.nextFireAt && Date.now() >= state.nextFireAt) await reschedule();
    state.deviceSeenAt = Date.now();     // the phone is alive; note it for liveness
    if (state.lastQuietPingAt) state.lastQuietPingAt = null;
    saveState();                         // fire-and-forget; a lost write just re-syncs
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' });
    return res.end(JSON.stringify(state.next || null));
  }

  // Native app identity — poll-based, no token needed. Marks the device present.
  if (req.method === 'POST' && url.pathname === '/register') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let dev = {};
    try { dev = body ? JSON.parse(body) : {}; } catch { /* empty registration is fine */ }
    dev.registeredAt = Date.now();
    await writeFile(path.join(DATA, 'device.json'), JSON.stringify(dev, null, 2));
    state.deviceSeenAt = Date.now();
    state.lastQuietPingAt = null;
    await saveState();
    console.log('device registered:', dev.kind || 'native');
    res.writeHead(204);
    return res.end();
  }

  // static app (landing page + the web UI, still served for convenience)
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
  `bell-server on :${PORT} | window ${cfg.windowStart}-${cfg.windowEnd} | ~${cfg.bellsPerDay}/day, min gap ${cfg.minGapMin}m | phone fires locally`
));
