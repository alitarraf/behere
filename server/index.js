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
  // How far ahead to keep bells decided, so the phone can arm them and fire
  // offline. The phone stays covered for this long with no connectivity.
  bufferDays: Number(process.env.BUFFER_DAYS || 2),
};
const BUFFER_MS = cfg.bufferDays * 86400_000;

// Warn on Telegram only once the phone has been offline long enough that its
// buffer is nearly spent — not merely because it stepped off the tailnet.
const QUIET_MS = Math.max(6, cfg.bufferDays * 24 - 12) * 3600_000;
const REPING_MS = 12 * 3600_000;

// ---------- persistent state ----------
const statePath = path.join(DATA, 'state.json');
let state = { schedule: [], deviceSeenAt: null, lastQuietPingAt: null };
if (existsSync(statePath)) {
  try { state = { ...state, ...JSON.parse(await readFile(statePath, 'utf8')) }; }
  catch { /* corrupted state: start fresh */ }
}
const saveState = () => writeFile(statePath, JSON.stringify(state, null, 2));

// One bell = time + manifestation, decided up front. ts is the scheduled instant
// and doubles as the visual seed, so the phone's local render matches exactly.
function drawOne(from) {
  const ts = drawNextFire(from, cfg).getTime();
  const mode = pickMode(cfg.weights);
  const text = mode === 'line' ? pickLine()
             : mode === 'visual' ? distill(ts)
             : undefined;
  return { ts, mode, ...(text ? { text } : {}) };
}

// Keep a stable list of bells decided out to the buffer horizon. Past bells drop
// off; new ones are only ever APPENDED beyond the last decided time — so a bell,
// once decided, never moves, and the phone isn't re-arming shifting alarms.
async function fillSchedule(now = Date.now()) {
  if (!Array.isArray(state.schedule)) state.schedule = [];
  // migrate a legacy single 'next' (pre-buffer state.json) into the list
  if (state.schedule.length === 0 && state.next && state.next.ts > now) state.schedule.push(state.next);

  const sig = JSON.stringify(state.schedule);
  state.schedule = state.schedule.filter(b => b.ts > now).sort((a, b) => a.ts - b.ts);

  const horizon = now + BUFFER_MS;
  let from = state.schedule.length ? state.schedule[state.schedule.length - 1].ts : now;
  let guard = 0;
  while (from < horizon && guard++ < 500) {
    const b = drawOne(new Date(from));
    state.schedule.push(b);
    from = b.ts;
  }
  delete state.next;                 // shed the legacy field
  delete state.nextFireAt;

  if (JSON.stringify(state.schedule) !== sig) {
    await saveState();
    console.log('schedule:', state.schedule.length, 'bells thru', new Date(state.schedule[state.schedule.length - 1].ts).toString());
  }
}

function inWakingWindow(d) {
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= parseHM(cfg.windowStart) && m < parseHM(cfg.windowEnd);
}

// If the phone has been offline long enough that its buffer is nearly empty,
// ping once. Auto-rearms on recovery.
async function checkDeviceLiveness(now) {
  if (!state.deviceSeenAt) return;
  if (!inWakingWindow(new Date(now))) return;
  const quiet = now - state.deviceSeenAt;
  if (quiet > QUIET_MS) {
    if (!state.lastQuietPingAt || now - state.lastQuietPingAt > REPING_MS) {
      state.lastQuietPingAt = now;
      await saveState();
      await telegramPing(`the phone has been offline ${Math.round(quiet / 3600_000)}h — its bell buffer is nearly empty. Tailscale down, or the app got killed?`);
    }
  } else if (state.lastQuietPingAt) {
    state.lastQuietPingAt = null;
    await saveState();
  }
}

// Boot: fill out to the horizon (dropping anything missed while we were down).
await fillSchedule();
console.log('booted:', state.schedule.length, 'bells buffered');

// The server never fires — it just keeps the buffer topped up and watches the phone.
setInterval(async () => {
  const now = Date.now();
  await fillSchedule(now);
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
    const last = state.schedule[state.schedule.length - 1];
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({
      buffered: state.schedule.length,
      nextFireAt: state.schedule[0] ? new Date(state.schedule[0].ts).toString() : null,
      horizonThru: last ? new Date(last.ts).toString() : null,
      bufferDays: cfg.bufferDays,
      deviceSeenAt: state.deviceSeenAt ? new Date(state.deviceSeenAt).toString() : null,
      window: `${cfg.windowStart}-${cfg.windowEnd}`,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }));
  }

  // Native app: the whole upcoming buffer, so the phone can arm an exact alarm
  // for each and fire them all locally — covered for ~bufferDays with no network.
  if (req.method === 'GET' && url.pathname === '/next') {
    await fillSchedule();
    state.deviceSeenAt = Date.now();
    if (state.lastQuietPingAt) state.lastQuietPingAt = null;
    saveState();                         // fire-and-forget; a lost write just re-syncs
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' });
    return res.end(JSON.stringify(state.schedule));
  }

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

  // static app (landing page + web UI, still served for convenience)
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
  `bell-server on :${PORT} | window ${cfg.windowStart}-${cfg.windowEnd} | ~${cfg.bellsPerDay}/day | ${cfg.bufferDays}-day buffer | phone fires locally`
));
