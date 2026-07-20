// Shared seed → parameters → words. Imported by BOTH the browser renderer
// and the bell-server, so the notification's teaser always honestly
// describes the exact visual that timestamp will produce.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  { name: 'amber',  hue: 38,  spread: 22 },
  { name: 'indigo', hue: 232, spread: 28 },
  { name: 'moss',   hue: 110, spread: 24 },
  { name: 'rose',   hue: 345, spread: 20 },
  { name: 'slate',  hue: 205, spread: 14 },
  { name: 'violet', hue: 275, spread: 26 },
];

const TEMPI = [
  { name: 'still',     speed: 0.25 },
  { name: 'slow',      speed: 0.55 },
  { name: 'drifting',  speed: 1.0 },
  { name: 'restless',  speed: 1.8 },
];

const DIRECTIONS = [
  { name: 'north', angle: -Math.PI / 2 },
  { name: 'northeast', angle: -Math.PI / 4 },
  { name: 'east', angle: 0 },
  { name: 'southeast', angle: Math.PI / 4 },
  { name: 'south', angle: Math.PI / 2 },
  { name: 'southwest', angle: 3 * Math.PI / 4 },
  { name: 'west', angle: Math.PI },
  { name: 'northwest', angle: -3 * Math.PI / 4 },
];

export function seedParams(ts) {
  const rand = mulberry32(Math.floor(ts / 1000));
  return {
    palette: PALETTES[Math.floor(rand() * PALETTES.length)],
    tempo: TEMPI[Math.floor(rand() * TEMPI.length)],
    direction: DIRECTIONS[Math.floor(rand() * DIRECTIONS.length)],
    density: 400 + Math.floor(rand() * 500),   // particle count
    scale: 0.0012 + rand() * 0.0022,           // noise field scale
    rand,                                       // continue the stream for the renderer
  };
}

// "still amber field, leaning west" — the honest teaser.
export function distill(ts) {
  const p = seedParams(ts);
  const verb = p.tempo.name === 'still' ? 'leaning' : 'drifting';
  return `${p.tempo.name} ${p.palette.name} field, ${verb} ${p.direction.name}`;
}
