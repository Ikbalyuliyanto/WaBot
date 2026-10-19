/*
 * Otak bot (murni, tanpa WhatsApp/IO -> mudah dites):
 *   tick(state, now)            -> pesan terjadwal (soal baru / pengingat soal yang belum dijawab)
 *   onMessage(state, text, now) -> balasan untuk pesan dari pemilik (jawaban / perintah)
 * Aturan sama dengan app & Worker English 90 Hari:
 *   - learning window WIB (Senin-Jumat & Sabtu-Minggu) + kuota per window, maks 10/12 per hari;
 *   - satu soal aktif; jawaban almost/wrong -> soal tetap sama (kisi-kisi bertahap);
 *   - soal berikutnya setelah jawaban benar + cooldown; soal belum dijawab diingatkan ulang tiap `interval`
 *     menit (maks 3 per window);
 *   - review mode: soal hanya minDay <= min(currentDay, reviewMaxDay).
 */
const MIN = 60000;
const TZ = 7 * 60 * MIN; // WIB

const WEEKDAY = [
  { id: 'morning', start: '06:00', end: '07:00', limit: 1, contexts: ['wake', 'breakfast', 'prepare'], greeting: '🌅 {name}, wake up. Good morning.' },
  { id: 'commuteMorning', start: '07:00', end: '09:30', limit: 2, contexts: ['prepare', 'station', 'train'], greeting: "🚆 {name}, it's time to work." },
  { id: 'lunch', start: '11:30', end: '13:30', limit: 2, contexts: ['lunch'], greeting: '🍱 {name}, lunch time.' },
  { id: 'commuteHome', start: '16:30', end: '19:00', limit: 2, contexts: ['afterwork', 'home'], greeting: '🏠 {name}, time to go home.' },
  { id: 'evening', start: '19:00', end: '21:30', limit: 3, contexts: ['evening', 'bedtime'], greeting: '🌙 {name}, good evening.' }
];
const WEEKEND = [
  { id: 'weekendMorning', start: '08:00', end: '11:00', limit: 3, contexts: ['weekend', 'wake', 'breakfast'], greeting: '☀️ {name}, good morning. Happy weekend!' },
  { id: 'weekendMidday', start: '11:00', end: '14:00', limit: 3, contexts: ['weekend', 'lunch'], greeting: '🍱 {name}, lunch time.' },
  { id: 'weekendAfternoon', start: '14:00', end: '17:00', limit: 2, contexts: ['weekend', 'evening'], greeting: '🌤️ {name}, good afternoon.' },
  { id: 'weekendEvening', start: '17:00', end: '21:00', limit: 4, contexts: ['weekend', 'evening', 'bedtime'], greeting: '🌙 {name}, good evening.' }
];
const DAILY_LIMIT = { weekday: 10, weekend: 12 };
const MAX_REMINDERS_PER_WINDOW = 3;

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
function wib(ms) {
  const d = new Date(ms + TZ);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), weekday: d.getUTCDay() };
}
const isWeekend = (weekday) => weekday === 0 || weekday === 6;
function windowAt(ms) {
  const j = wib(ms);
  const list = isWeekend(j.weekday) ? WEEKEND : WEEKDAY;
  return list.find((w) => j.minutes >= toMin(w.start) && j.minutes < toMin(w.end)) || null;
}

function createState() {
  return { active: null, daily: { date: null, sent: 0, windows: {} }, lastCorrectAt: 0, lastSentAt: 0, pausedUntil: 0, recent: [], stats: {} };
}

function createBrain({ bank, name = '', interval = 15, cooldown = 10, reviewMaxDay = 20, getCurrentDay = () => reviewMaxDay, random = Math.random }) {
  const nm = (t) => (name ? t.replace('{name}', name) : t.replace('{name}, ', '').replace(/^(\S+ )(.)/, (m, e, c) => e + c.toUpperCase()));
  const dayLimit = () => Math.max(1, Math.min(Number(getCurrentDay()) || reviewMaxDay, reviewMaxDay));

  function daily(state, ms) {
    const { date } = wib(ms);
    if (state.daily.date !== date) state.daily = { date, sent: 0, windows: {} };
    return state.daily;
  }

  function pick(state, contexts) {
    const limit = dayLimit();
    const eligible = bank.questions.filter((q) => q.minDay <= limit);
    let pool = eligible.filter((q) => contexts.includes(q.context));
    if (!pool.length) pool = eligible;
    const fresh = pool.filter((q) => !state.recent.includes(q.id));
    if (fresh.length) pool = fresh;
    if (!pool.length) return null;
    const score = (q) => (Math.min(state.stats[q.id]?.wrong || 0, 5) * 15) + random();
    return pool.reduce((best, q) => (score(q) > score(best) ? q : best), pool[0]);
  }

  const questionText = (q, w, reminder) => [
    reminder ? `⏰ *Pengingat* — soal ini belum dijawab.` : nm(w ? w.greeting : '📘 {name}, English time.'),
    '',
    `*${q.en}*`,
    `_${q.idn}_`,
    '',
    reminder ? 'Balas dengan jawaban English kamu 👇' : 'Balas pesan ini dengan jawaban English kamu 👇'
  ].join('\n');

  function startQuestion(state, q, w, ms) {
    const d = daily(state, ms);
    state.active = { qid: q.id, askedAt: ms, lastPromptAt: ms, reminders: 0, wrong: 0, attempts: 0, windowId: w?.id || null };
    state.lastSentAt = ms;
    d.sent += 1;
    if (w) d.windows[w.id] = (d.windows[w.id] || 0) + 1;
    state.recent = [...state.recent.filter((id) => id !== q.id), q.id].slice(-8);
    return questionText(q, w, false);
  }

  // Dipanggil berkala (mis. tiap menit). -> [teks pesan]
  function tick(state, ms = Date.now()) {
    if (state.pausedUntil > ms) return [];
    const w = windowAt(ms);
    if (!w) return [];
    const d = daily(state, ms);
    if (state.active) {
      const q = bank.byId(state.active.qid);
      if (!q) { state.active = null; return []; }
      const a = state.active;
      if (a.reminderWindow !== w.id) { a.reminderWindow = w.id; a.reminders = 0; }
      if (ms - a.lastPromptAt >= interval * MIN && a.reminders < MAX_REMINDERS_PER_WINDOW) {
        a.lastPromptAt = ms;
        a.reminders += 1;
        return [questionText(q, w, true)];
      }
      return [];
    }
    const sinceEvent = ms - Math.max(state.lastCorrectAt, state.lastSentAt);
    if (sinceEvent < cooldown * MIN) return [];
    if ((d.windows[w.id] || 0) >= w.limit) return [];
    if (d.sent >= DAILY_LIMIT[isWeekend(wib(ms).weekday) ? 'weekend' : 'weekday']) return [];
    const q = pick(state, w.contexts);
    return q ? [startQuestion(state, q, w, ms)] : [];
  }

  const VERDICT = { correct: '✅ *Benar*', almost: '⚠️ *Hampir benar*', wrong: '❌ *Perlu diperbaiki*' };
  const PRAISE = ['Good job, {name}!', 'Nice work, {name}!', "That's correct!", 'Great job!'];
  const HELP = [
    '🤖 *English Companion*',
    'Balas soal dengan jawaban English kamu.',
    '',
    '*soal* — minta soal sekarang',
    '*lewati* — lewati soal ini',
    '*jeda* — berhenti sementara (sampai *mulai*)',
    '*mulai* — aktifkan lagi',
    '*status* — lihat ringkasan hari ini'
  ].join('\n');

  function answer(state, text, ms) {
    const q = bank.byId(state.active.qid);
    const a = state.active;
    const limit = dayLimit();
    const r = bank.check(q, text, limit);
    a.attempts += 1;
    const lines = [VERDICT[r.verdict]];
    if (r.verdict === 'wrong') {
      a.wrong += 1;
      state.stats[q.id] = { wrong: (state.stats[q.id]?.wrong || 0) + 1 };
      const h = bank.hintFor(q, a.wrong, limit);
      lines.push(`💡 ${h.hintLabel}: *${h.hintText}*`);
      if (h.hintLevel === 4 && h.hintIdn) lines.push(`🇮🇩 ${h.hintIdn}`);
      lines.push('', 'Coba jawab lagi 👇');
      a.lastPromptAt = ms;
      return lines.join('\n');
    }
    const m = bank.meaningFor(q, r, text) || {};
    if (r.verdict === 'almost') {
      lines.push(`Lebih tepat: *${r.correction}*`);
      if (m.meaningIdn) lines.push(m.meaningSource === 'sample' ? `Contoh: *${m.meaningEn}*\n🇮🇩 ${m.meaningIdn}` : `🇮🇩 ${m.meaningIdn}`);
      lines.push('', 'Almost. Ketik ulang kalimat yang lebih tepat 👇');
      a.lastPromptAt = ms;
      return lines.join('\n');
    }
    // correct
    if (m.meaningIdn) lines.push(m.meaningSource === 'sample' ? `Contoh yang benar: *${m.meaningEn}*\n🇮🇩 ${m.meaningIdn}` : `🇮🇩 ${m.meaningIdn}`);
    lines.push('', nm(PRAISE[Math.floor(random() * PRAISE.length)]), `Soal berikutnya datang paling cepat ${cooldown} menit lagi.`);
    state.active = null;
    state.lastCorrectAt = ms;
    return lines.join('\n');
  }

  // Pesan dari pemilik -> balasan (string) atau null bila tidak perlu dibalas.
  function onMessage(state, text, ms = Date.now()) {
    const t = String(text || '').trim();
    const cmd = t.toLowerCase();
    if (!t) return null;
    if (['bantuan', 'help', 'menu', '?'].includes(cmd)) return HELP;
    if (['jeda', 'pause', 'stop'].includes(cmd)) { state.pausedUntil = Number.MAX_SAFE_INTEGER; return '⏸️ Dijeda. Ketik *mulai* untuk aktif lagi.'; }
    if (['mulai', 'start', 'lanjut'].includes(cmd)) { state.pausedUntil = 0; return '▶️ Aktif lagi. Soal berikutnya datang di jam belajar.'; }
    if (cmd === 'status') {
      const d = daily(state, ms);
      const q = state.active && bank.byId(state.active.qid);
      return [`📊 Hari ini: ${d.sent} soal`, q ? `Soal aktif: *${q.en}*` : 'Tidak ada soal aktif.', `Materi: Day 1–${dayLimit()}`, state.pausedUntil > ms ? '⏸️ Sedang dijeda' : '▶️ Aktif'].join('\n');
    }
    if (['lewati', 'skip'].includes(cmd)) {
      if (!state.active) return 'Tidak ada soal aktif. Ketik *soal* untuk minta soal.';
      state.active = null;
      state.lastCorrectAt = ms;
      return '⏭️ Soal dilewati. Soal berikutnya datang nanti.';
    }
    if (['soal', 'next', 'lagi'].includes(cmd)) {
      if (state.active) { const q = bank.byId(state.active.qid); return questionText(q, null, true); }
      const w = windowAt(ms);
      const q = pick(state, w ? w.contexts : bank.contexts.map((c) => c.id));
      return q ? startQuestion(state, q, w, ms) : 'Belum ada soal untuk materi saat ini.';
    }
    if (!state.active) return 'Belum ada soal aktif 🙂 Ketik *soal* untuk mulai, atau *bantuan* untuk menu.';
    return answer(state, t, ms);
  }

  return { tick, onMessage, windowAt, dayLimit };
}

module.exports = { createBrain, createState, windowAt, WEEKDAY, WEEKEND };
