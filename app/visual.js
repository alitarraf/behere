// Ephemeral visual: a seeded flow field, alive ~10 seconds, then gone.
// Deterministic from the bell's timestamp — and never stored anywhere.
import { seedParams } from './seed.js';

const LIFE_MS = 10_000;
const FADE_IN = 1200, FADE_OUT = 2500;

// Seeded value-noise (2 octaves) — enough texture, tiny code.
function makeNoise(rand) {
  const g = new Float32Array(512 * 512).map(() => rand());
  const at = (x, y) => g[((y & 511) << 9) | (x & 511)];
  const smooth = t => t * t * (3 - 2 * t);
  function base(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }
  return (x, y) => 0.65 * base(x, y) + 0.35 * base(x * 2.7 + 41.3, y * 2.7 + 17.7);
}

export function renderBell(ts, onDone) {
  const p = seedParams(ts);
  const noise = makeNoise(p.rand);

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:#0d0d10;z-index:10;opacity:0;transition:opacity 1.2s';
  document.body.appendChild(canvas);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = canvas.width = innerWidth * dpr;
  const H = canvas.height = innerHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d0d10';
  ctx.fillRect(0, 0, W, H);

  const parts = Array.from({ length: p.density }, () => ({
    x: p.rand() * W, y: p.rand() * H,
    hue: p.palette.hue + (p.rand() - 0.5) * 2 * p.palette.spread,
    light: 45 + p.rand() * 25,
  }));

  const drift = p.direction.angle;
  const speed = p.tempo.speed * 1.4 * dpr;
  const start = performance.now();
  requestAnimationFrame(function frame(now) {
    const t = now - start;
    if (t >= LIFE_MS) {
      canvas.style.opacity = '0';
      setTimeout(() => { canvas.remove(); onDone && onDone(); }, 1300);
      return;
    }
    canvas.style.opacity = '1';
    // global fade envelope
    const env = Math.min(1, t / FADE_IN) * Math.min(1, (LIFE_MS - t) / FADE_OUT);
    // slow veil so trails dissolve rather than accumulate forever
    ctx.fillStyle = 'rgba(13,13,16,0.045)';
    ctx.fillRect(0, 0, W, H);
    const time = t * 0.00008;
    for (const q of parts) {
      const a = noise(q.x * p.scale + time * 40, q.y * p.scale) * Math.PI * 4;
      const ang = a * 0.55 + drift;                 // field bent toward the drift
      q.x += Math.cos(ang) * speed;
      q.y += Math.sin(ang) * speed;
      if (q.x < 0) q.x += W; if (q.x >= W) q.x -= W;
      if (q.y < 0) q.y += H; if (q.y >= H) q.y -= H;
      ctx.fillStyle = `hsla(${q.hue},55%,${q.light}%,${0.16 * env})`;
      ctx.fillRect(q.x, q.y, 1.6 * dpr, 1.6 * dpr);
    }
    requestAnimationFrame(frame);
  });
}
