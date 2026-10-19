/*
 * English Companion WhatsApp bot.
 * - Login: buka http://SERVER:PORT/qr?token=ADMIN_TOKEN lalu scan QR (sekali; sesi disimpan di data/).
 * - Hanya membalas OWNER_NUMBER. Soal dikirim terjadwal (lihat brain.js); jawaban dinilai dengan
 *   penilai app English 90 Hari (bank.js).
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { loadRemote } = require('./bank');
const { createBrain, createState } = require('./brain');

(function main() {
const env = (k, d) => (process.env[k] ?? '').trim() || d;
const CFG = {
  owner: env('OWNER_NUMBER', '').replace(/\D/g, ''),
  name: env('OWNER_NAME', ''),
  token: env('ADMIN_TOKEN', ''),
  port: Number(env('PORT', '3100')),
  appBaseUrl: env('APP_BASE_URL', 'https://ikbalyuliyanto.github.io/english-90-hari/'),
  workerBaseUrl: env('WORKER_BASE_URL', ''),
  reviewMaxDay: Number(env('REVIEW_MAX_DAY', '20')),
  interval: Number(env('REMINDER_INTERVAL_MIN', '15')),
  cooldown: Number(env('COOLDOWN_MIN', '10')),
  dataDir: env('DATA_DIR', path.join(__dirname, '..', 'data'))
};
// Konfigurasi belum lengkap: jangan crash-loop (bisa mengganggu deploy service lain); tampilkan di /health saja.
const missing = [!CFG.owner && 'OWNER_NUMBER', !CFG.token && 'ADMIN_TOKEN'].filter(Boolean);
if (missing.length) {
  console.error(`[config] belum diisi: ${missing.join(', ')} — bot menunggu konfigurasi (lihat .env.example)`);
  express().get('/health', (req, res) => res.status(503).json({ ok: false, missing })).listen(CFG.port);
  return;
}
fs.mkdirSync(CFG.dataDir, { recursive: true });

// ---------- State (file JSON, ditulis atomik) ----------
const STATE_FILE = path.join(CFG.dataDir, 'state.json');
let state = createState();
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch { /* mulai baru */ }
function saveState() {
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

// ---------- Current day dari Worker (opsional) ----------
let currentDay = CFG.reviewMaxDay;
async function refreshCurrentDay() {
  if (!CFG.workerBaseUrl) return;
  try {
    const res = await fetch(new URL('/state', CFG.workerBaseUrl), { signal: AbortSignal.timeout(10000) });
    const day = (await res.json())?.state?.currentDay;
    if (Number.isInteger(day)) currentDay = day;
  } catch (err) { console.warn('[day] gagal membaca Worker:', err.message); }
}

// ---------- WhatsApp ----------
// Versi WhatsApp Web yang dikenal cocok dengan whatsapp-web.js (arsip wppconnect-team/wa-version).
// WA_WEB_VERSION=2.3000.xxxx-alpha untuk mengunci versi; kosong = currentVersion terbaru dari arsip.
const WA_VERSIONS = 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main';
async function resolveWebVersion() {
  const pinned = env('WA_WEB_VERSION', '');
  if (pinned === 'none') return null; // pakai versi bawaan library
  if (pinned) return pinned;
  try {
    const res = await fetch(`${WA_VERSIONS}/versions.json`, { signal: AbortSignal.timeout(10000) });
    return (await res.json()).currentVersion || null;
  } catch { return null; }
}

const status = { ready: false, qr: null, lastError: null, bank: null, webVersion: null };
let client = null;
function createClient(webVersion) {
  return new Client({
  authStrategy: new LocalAuth({ clientId: 'englishbot', dataPath: path.join(CFG.dataDir, 'session') }),
  ...(webVersion ? { webVersionCache: { type: 'remote', remotePath: `${WA_VERSIONS}/html/${webVersion}.html` } } : {}),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote']
  }
  });
}
const ownerChatId = `${CFG.owner}@c.us`;

async function isOwner(msg) {
  if (msg.fromMe || msg.isStatus) return false;
  if (msg.from === ownerChatId) return true;
  try { return (await msg.getContact())?.number === CFG.owner; } catch { return false; }
}

async function send(text) {
  if (!status.ready) return false;
  try { await client.sendMessage(ownerChatId, text); return true; } catch (err) { console.warn('[send] gagal:', err.message); return false; }
}

function registerEvents() {
client.on('qr', (qr) => { status.qr = qr; status.ready = false; console.log('[wa] QR baru — buka /qr?token=... untuk scan'); });
client.on('ready', () => { status.ready = true; status.qr = null; console.log('[wa] siap'); });
client.on('auth_failure', (m) => { status.lastError = 'auth_failure: ' + m; console.error('[wa]', status.lastError); });
client.on('disconnected', (reason) => {
  status.ready = false;
  status.lastError = 'disconnected: ' + reason;
  console.warn('[wa]', status.lastError, '— mencoba lagi dalam 15 detik');
  setTimeout(startWhatsApp, 15000);
});
client.on('message', onIncoming);
}

// Inisialisasi dengan percobaan ulang (WhatsApp Web kadang reload halaman saat start).
async function startWhatsApp(attempt = 1) {
  try { if (client) await client.destroy(); } catch { /* sudah mati */ }
  client = createClient(status.webVersion);
  registerEvents();
  try {
    await client.initialize();
  } catch (e) {
    status.lastError = e.message;
    const wait = Math.min(60, 5 * attempt);
    console.error(`[wa] init gagal (percobaan ${attempt}): ${e.message} — ulang dalam ${wait} detik`);
    setTimeout(() => startWhatsApp(attempt + 1), wait * 1000);
  }
}

let brain = null;
async function onIncoming(msg) {
  if (!brain || msg.type !== 'chat' || !(await isOwner(msg))) {
    if (brain && msg.type === 'ptt' && (await isOwner(msg))) await send('🎙️ Pesan suara belum didukung. Ketik jawabanmu ya.');
    return;
  }
  const reply = brain.onMessage(state, msg.body, Date.now());
  saveState();
  if (reply) await send(reply);
}

// ---------- Web (QR & health) ----------
const app = express();
const auth = (req, res, next) => (req.query.token === CFG.token ? next() : res.status(401).send('Unauthorized'));
app.get('/health', (req, res) => res.json({ ok: true, ready: status.ready, bank: status.bank, webVersion: status.webVersion, lastError: status.lastError, currentDay, day: brain?.dayLimit() ?? null }));
app.get('/qr', auth, async (req, res) => {
  if (status.ready) return res.send('<h2>✅ WhatsApp sudah terhubung.</h2>');
  if (!status.qr) return res.send('<meta http-equiv="refresh" content="3"><p>Menunggu QR…</p>');
  const img = await QRCode.toDataURL(status.qr, { width: 320 });
  res.send(`<meta http-equiv="refresh" content="20"><h3>Scan dengan WhatsApp nomor bot (Perangkat tertaut)</h3><img src="${img}" alt="QR">`);
});

// ---------- Start ----------
(async () => {
  const { bank, source, error } = await loadRemote({ baseUrl: CFG.appBaseUrl, cacheDir: path.join(CFG.dataDir, 'bank-cache') });
  status.bank = { source, questions: bank.questions.length, error: error || null };
  console.log(`[bank] ${bank.questions.length} soal (${source}${error ? ', ' + error : ''})`);
  await refreshCurrentDay();
  brain = createBrain({ bank, name: CFG.name, interval: CFG.interval, cooldown: CFG.cooldown, reviewMaxDay: CFG.reviewMaxDay, getCurrentDay: () => currentDay });

  setInterval(async () => {
    const messages = brain.tick(state, Date.now());
    if (!messages.length) return;
    saveState();
    for (const m of messages) await send(m);
  }, 60000);
  setInterval(refreshCurrentDay, 30 * 60000);

  app.listen(CFG.port, () => console.log(`[web] http://0.0.0.0:${CFG.port}  (QR: /qr?token=...)`));
  status.webVersion = await resolveWebVersion();
  console.log('[wa] versi WhatsApp Web:', status.webVersion || '(bawaan library)');
  startWhatsApp();
})().catch((e) => { console.error('Gagal start:', e); process.exit(1); });

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { try { saveState(); await client?.destroy(); } finally { process.exit(0); } });
})();
