/*
 * Bank pertanyaan + penilai jawaban diambil dari app English 90 Hari (GitHub Pages),
 * dijalankan di sandbox vm, dan disimpan sebagai cache di disk (dipakai bila Pages tidak bisa diakses).
 * Hasil: { questions, contexts, check(q, answer, day), hintFor(q, wrongCount, day), meaningFor(q, result, answer) }
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = ['data/conversation/questions.js', 'js/core/answer-check.js'];

function evaluate(sources) {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const [name, code] of sources) vm.runInContext(code, sandbox, { filename: name });
  const E90 = sandbox.E90;
  if (!E90?.CONVERSATION?.questions?.length || !E90?.answerCheck?.check) throw new Error('bank tidak valid');
  const { questions, contexts } = E90.CONVERSATION;
  const ac = E90.answerCheck;
  return {
    questions,
    contexts,
    byId: (id) => questions.find((q) => q.id === id) || null,
    check: ac.check,
    hintFor: ac.hintFor,
    meaningFor: ac.meaningFor
  };
}

// Dari folder lokal (dipakai test / bila app ada di disk).
function loadFromDir(dir) {
  return evaluate(FILES.map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
}

async function loadRemote({ baseUrl, cacheDir, fetchImpl = fetch }) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const cachePath = (f) => path.join(cacheDir, f.replace(/\//g, '__'));
  try {
    const sources = [];
    for (const f of FILES) {
      const res = await fetchImpl(new URL(f, baseUrl), { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`${f}: HTTP ${res.status}`);
      sources.push([f, await res.text()]);
    }
    const bank = evaluate(sources); // validasi dulu, baru simpan cache
    for (const [f, code] of sources) fs.writeFileSync(cachePath(f), code);
    return { bank, source: 'remote' };
  } catch (err) {
    const cached = FILES.map((f) => [f, fs.existsSync(cachePath(f)) ? fs.readFileSync(cachePath(f), 'utf8') : null]);
    if (cached.some(([, c]) => !c)) throw new Error(`Bank pertanyaan tidak bisa dimuat (${err.message}) dan cache belum ada`);
    return { bank: evaluate(cached), source: 'cache', error: err.message };
  }
}

module.exports = { loadFromDir, loadRemote };
