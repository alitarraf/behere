// Random-fire scheduling in waking-window time.
// All math is done in local time (container TZ must be set correctly).

// "07:00" -> minutes since midnight
export function parseHM(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function minutesIntoDay(d) {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

// Exponential inter-arrival with a hard floor, in window-minutes.
// mean = windowLength / bellsPerDay so the average rate holds.
export function drawGapMin(cfg, rand = Math.random) {
  const windowLen = parseHM(cfg.windowEnd) - parseHM(cfg.windowStart);
  const mean = windowLen / cfg.bellsPerDay;
  return Math.max(cfg.minGapMin, -Math.log(1 - rand()) * mean);
}

// Walk forward from `from`, consuming `gapMin` of waking-window time only,
// skipping nights. Returns the fire Date.
export function advanceWindowTime(from, gapMin, cfg) {
  const start = parseHM(cfg.windowStart);
  const end = parseHM(cfg.windowEnd);
  let cursor = new Date(from);
  let remaining = gapMin;

  for (let i = 0; i < 366; i++) {
    const into = minutesIntoDay(cursor);
    if (into < start) {
      cursor.setHours(0, 0, 0, 0);
      cursor.setMinutes(start);
    } else if (into >= end) {
      cursor.setHours(0, 0, 0, 0);
      cursor.setDate(cursor.getDate() + 1);
      cursor.setMinutes(start);
    }
    const avail = end - minutesIntoDay(cursor);
    if (remaining <= avail) {
      return new Date(cursor.getTime() + remaining * 60_000);
    }
    remaining -= avail;
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() + 1);
    cursor.setMinutes(start);
  }
  throw new Error('advanceWindowTime: gap too large');
}

export function drawNextFire(from, cfg, rand = Math.random) {
  return advanceWindowTime(from, drawGapMin(cfg, rand), cfg);
}

// Weighted manifestation pick. weights: { buzz, line, visual }
export function pickMode(weights, rand = Math.random) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [mode, w] of entries) {
    if ((r -= w) <= 0) return mode;
  }
  return entries[entries.length - 1][0];
}
