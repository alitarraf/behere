// M0 spike: send one bell manually.
// usage: node send.js [buzz|line|visual] ["text"]
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data');
const vapid = JSON.parse(await readFile(path.join(DATA, 'vapid.json'), 'utf8'));
webpush.setVapidDetails('mailto:ali.tarraf@gmail.com', vapid.publicKey, vapid.privateKey);

const sub = JSON.parse(await readFile(path.join(DATA, 'subscription.json'), 'utf8'));

const mode = process.argv[2] || 'buzz';
const text = process.argv[3] ||
  (mode === 'line' ? 'The moment you notice you are elsewhere, you are back.' :
   mode === 'visual' ? 'slow amber field, drifting west' : undefined);

const payload = JSON.stringify({ mode, text, ts: Date.now() });
try {
  const r = await webpush.sendNotification(sub, payload, { TTL: 600 });
  console.log('sent', mode, '→', r.statusCode);
} catch (e) {
  console.error('send failed:', e.statusCode || '', e.body || e.message);
  process.exit(1);
}
