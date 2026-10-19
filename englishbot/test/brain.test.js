/*
 * Test otak bot dengan bank & penilai asli dari app English 90 Hari.
 * APP_DIR=/path/ke/english-90-hari npm test   (tanpa APP_DIR: diunduh dari GitHub Pages ke folder sementara)
 */
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const { loadFromDir, loadRemote } = require('../src/bank');
const { createBrain, createState } = require('../src/brain');

const wib = (date, hhmm) => { const [h, m] = hhmm.split(':').map(Number); const [Y, M, D] = date.split('-').map(Number); return Date.UTC(Y, M - 1, D, h - 7, m); };
const MON = '2026-10-19';
let bank;
const brainOf = (opts = {}) => createBrain({ bank, name: 'Ikbal', getCurrentDay: () => 22, random: () => 0.5, ...opts });

before(async () => {
  bank = process.env.APP_DIR
    ? loadFromDir(process.env.APP_DIR)
    : (await loadRemote({ baseUrl: 'https://ikbalyuliyanto.github.io/english-90-hari/', cacheDir: path.join(os.tmpdir(), 'englishbot-test-cache') })).bank;
});

test('bank dimuat: soal + penilai', () => {
  assert.ok(bank.questions.length >= 50);
  assert.equal(bank.check(bank.byId('C-WAKE-03'), 'I woke up at 5.', 21).verdict, 'correct');
});

test('jadwal: soal pertama di window, sapaan + soal EN/ID', () => {
  const b = brainOf();
  const s = createState();
  assert.deepEqual(b.tick(s, wib(MON, '05:59')), [], 'di luar window');
  const [msg] = b.tick(s, wib(MON, '06:00'));
  assert.match(msg, /^🌅 Ikbal, \*(Let's eat|Have a good day|Be careful)\.\* _\(/);
  const q = bank.byId(s.active.qid);
  assert.ok(msg.includes(`*${q.en}*`) && msg.includes(`_${q.idn}_`));
  assert.ok(['wake', 'breakfast', 'prepare'].includes(q.context));
});

test('satu soal aktif: belum dijawab -> pengingat tiap 15 mnt, maks 3 per window, tidak ada soal baru', () => {
  const b = brainOf();
  const s = createState();
  b.tick(s, wib(MON, '07:00'));
  const qid = s.active.qid;
  assert.deepEqual(b.tick(s, wib(MON, '07:10')), []);
  for (const t of ['07:15', '07:30', '07:45']) assert.match(b.tick(s, wib(MON, t))[0], /Pengingat/, t);
  assert.deepEqual(b.tick(s, wib(MON, '08:00')), [], 'maks 3 pengingat per window');
  assert.equal(s.active.qid, qid);
  assert.equal(s.daily.sent, 1);
});

test('jawaban salah -> kisi-kisi bertahap, soal tetap; benar -> pujian + arti, soal ditutup', () => {
  const b = brainOf();
  const s = createState();
  b.onMessage(s, 'soal', wib(MON, '12:00'));
  s.active.qid = 'C-BREAK-03'; // What did you eat this morning?
  let r = b.onMessage(s, 'I am happy', wib(MON, '12:01'));
  assert.match(r, /❌ \*Perlu diperbaiki\*/); assert.match(r, /Kisi-kisi/);
  r = b.onMessage(s, 'Yes I do', wib(MON, '12:02'));
  assert.match(r, /Kata bantu: \*ate\*/);
  r = b.onMessage(s, 'I like cooking', wib(MON, '12:03'));
  assert.match(r, /Pola: \*I ate \.\.\.\*/);
  r = b.onMessage(s, 'Tomorrow maybe', wib(MON, '12:04'));
  assert.match(r, /Contoh: \*I ate bread\.\*/); assert.match(r, /🇮🇩 Saya makan roti\./);
  assert.equal(s.active.qid, 'C-BREAK-03');
  r = b.onMessage(s, 'I eat rice', wib(MON, '12:05'));
  assert.match(r, /⚠️ \*Hampir benar\*/); assert.match(r, /Lebih tepat: \*I ate rice\.\*/); assert.match(r, /🇮🇩 Saya makan nasi\./);
  assert.ok(s.active, 'almost -> soal tetap');
  r = b.onMessage(s, 'I ate rice and chicken.', wib(MON, '12:06'));
  assert.match(r, /✅ \*Benar\*/); assert.match(r, /🇮🇩 Saya makan nasi dan ayam\./); assert.match(r, /\*(See you later\.|That sounds good\.)\*/);
  assert.equal(s.active, null);
});

test('setelah benar: cooldown 10 mnt, kuota window, soal berikutnya', () => {
  const b = brainOf();
  const s = createState();
  b.tick(s, wib(MON, '11:30'));
  const q = bank.byId(s.active.qid);
  b.onMessage(s, q.sampleAnswers[0], wib(MON, '11:32'));
  assert.deepEqual(b.tick(s, wib(MON, '11:40')), [], 'cooldown');
  assert.equal(b.tick(s, wib(MON, '11:42')).length, 1, 'kuota lunch ke-2');
  b.onMessage(s, bank.byId(s.active.qid).sampleAnswers[0], wib(MON, '11:45'));
  assert.deepEqual(b.tick(s, wib(MON, '12:00')), [], 'kuota lunch (2) habis');
  assert.equal(b.tick(s, wib(MON, '16:30')).length, 1, 'window berikutnya');
});

test('weekend: window & sapaan sendiri; review mode Day 1-20', () => {
  const b = brainOf({ getCurrentDay: () => 120 });
  const s = createState();
  assert.deepEqual(b.tick(s, wib('2026-10-24', '07:30')), []);
  const [msg] = b.tick(s, wib('2026-10-24', '08:00'));
  assert.match(msg, /^☀️ Ikbal, \*(Let's eat\.|Have a nice day\.)\*/);
  for (let i = 0; i < 200; i++) {
    const st = createState();
    b.onMessage(st, 'soal', wib(MON, '20:00'));
    assert.ok(bank.byId(st.active.qid).minDay <= 20);
  }
});

test('perintah: bantuan, jeda/mulai, lewati, status; pesan tanpa soal aktif', () => {
  const b = brainOf();
  const s = createState();
  assert.match(b.onMessage(s, 'halo', wib(MON, '10:00')), /Belum ada soal aktif/);
  assert.match(b.onMessage(s, 'bantuan', wib(MON, '10:00')), /\*soal\*/);
  b.onMessage(s, 'jeda', wib(MON, '10:00'));
  assert.deepEqual(b.tick(s, wib(MON, '12:00')), [], 'dijeda');
  b.onMessage(s, 'mulai', wib(MON, '12:00'));
  assert.equal(b.tick(s, wib(MON, '12:00')).length, 1);
  assert.match(b.onMessage(s, 'status', wib(MON, '12:01')), /Soal aktif/);
  assert.match(b.onMessage(s, 'lewati', wib(MON, '12:02')), /dilewati/);
  assert.equal(s.active, null);
});

test('kalimat pembuka/penutup hanya dari materi yang sudah dipelajari', () => {
  const b2 = createBrain({ bank, name: 'Ikbal', getCurrentDay: () => 3, random: () => 0.99 });
  const s = createState();
  const [msg] = b2.tick(s, wib(MON, '06:00'));
  assert.match(msg, /\*Let's eat\.\* _\(Ayo makan\.\)_/, 'Day 3: hanya kalimat Day <= 3');
  const b1 = createBrain({ bank, name: 'Ikbal', getCurrentDay: () => 1, random: () => 0.5 });
  const s1 = createState();
  const [m1] = b1.tick(s1, wib(MON, '06:00'));
  assert.match(m1, /^🌅 Ikbal 👋/, 'Day 1: belum ada kalimat pembuka yang dipelajari');
  b1.onMessage(s1, 'lewati', wib(MON, '06:01'));
});

test('reset harian per tanggal WIB', () => {
  const b = brainOf();
  const s = createState();
  b.tick(s, wib(MON, '06:00'));
  b.onMessage(s, 'lewati', wib(MON, '06:05'));
  assert.deepEqual(b.tick(s, wib(MON, '06:30')), [], 'kuota pagi 1');
  assert.equal(b.tick(s, wib('2026-10-20', '06:00')).length, 1, 'besok kuota baru');
  assert.equal(s.daily.date, '2026-10-20');
});
