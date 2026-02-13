const axios = require('axios');

const KOTA_ID = 1203; // Kab. Bekasi (Cikarang)
const TIMEZONE = 'Asia/Jakarta';

const groupTargets = [
  '120363403796776086@g.us'
];

const watchUsers = {
  '628124885707@c.us': 'Buk',
  '6285179845620@c.us': 'Kak'
};

const photoRequiredTimes = ['subuh', 'maghrib', 'isya'];
let photoCheckStatus = {};
let prayerTimes = {};
let prayerOrder = [];

/* =========================
   HELPER KIRIM PESAN + SEEN
========================= */
async function sendMessageWithSeen(client, chatId, message) {
  try {
    const chat = await client.getChatById(chatId);
    await chat.sendSeen(); // kirim tanda dibaca
    await client.sendMessage(chatId, message);
  } catch (err) {
    console.error('❌ Gagal kirim pesan:', err);
  }
}

/* =========================
   AMBIL JADWAL SHOLAT
========================= */
async function fetchPrayerTimes() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();

  const url = `https://api.myquran.com/v1/sholat/jadwal/${KOTA_ID}/${y}/${m}/${d}`;
  const res = await axios.get(url);
  const jadwal = res.data.data.jadwal;

  prayerTimes = {
    subuh: jadwal.subuh,
    dzuhur: jadwal.dzuhur,
    ashar: jadwal.ashar,
    maghrib: jadwal.maghrib,
    isya: jadwal.isya
  };

  prayerOrder = Object.keys(prayerTimes);
  console.log('🕋 Jadwal sholat hari ini:', prayerTimes);
}

/* =========================
   UTIL
========================= */
function sendToAllGroups(client, message) {
  groupTargets.forEach(id => {
    sendMessageWithSeen(client, id, message);
  });
}

function getCurrentTime() {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE
  });
}

function getNextPrayer(prayerName) {
  const idx = prayerOrder.indexOf(prayerName);
  return prayerOrder[idx + 1];
}

/* =========================
   CEK WAKTU SHOLAT
========================= */
function checkPrayerTime(client, sentFlags) {
  const now = getCurrentTime();

  for (const [name, time] of Object.entries(prayerTimes)) {
    if (now === time && !sentFlags[name]) {

      sendToAllGroups(
        client,
        `⏰ Kak sama Buk, waktunya sholat ${name.toUpperCase()}. Jangan lupa foto ke grup.`
      );

      sentFlags[name] = true;

      if (photoRequiredTimes.includes(name)) {
        startPhotoWatch(client, name);
      }
    }
  }
}

/* =========================
   PANTAU FOTO
========================= */
function startPhotoWatch(client, prayerName) {

  photoCheckStatus[prayerName] = {
    Buk: false,
    Kak: false
  };

  console.log(`⏳ Pantau foto sholat ${prayerName}`);

  // 30 menit → reminder grup
  setTimeout(() => {
    const status = photoCheckStatus[prayerName];
    if (!status) return;

    const missing = Object.keys(status).filter(k => !status[k]);

    if (missing.length) {
      sendToAllGroups(
        client,
        `❗ ${missing.join(' dan ')} belum kirim foto sholat ${prayerName}`
      );
    }
  }, 30 * 60 * 1000);

  // 10 menit sebelum sholat berikutnya → DM
  const nextPrayer = getNextPrayer(prayerName);
  if (!nextPrayer) return;

  const [h, m] = prayerTimes[nextPrayer].split(':').map(Number);
  const notifyTime = new Date();
  notifyTime.setHours(h, m - 10, 0);

  const delay = notifyTime - new Date();

  if (delay > 0) {
    setTimeout(() => {
      const status = photoCheckStatus[prayerName];
      if (!status) return;

      Object.entries(watchUsers).forEach(([jid, name]) => {
        if (!status[name]) {
          sendMessageWithSeen(
            client,
            jid,
            `${name}, apakah sudah sholat ${prayerName}?`
          );
        }
      });

      delete photoCheckStatus[prayerName];

    }, delay);
  }
}

/* =========================
   HANDLE PESAN MASUK
========================= */
async function handleIncomingMessage(msg) {

  try {
    const chat = await msg.getChat();
    await chat.sendSeen(); // otomatis seen saat ada pesan masuk
  } catch (err) {
    console.log('Seen gagal:', err);
  }

  if (!msg.hasMedia) return;
  if (!watchUsers[msg.from]) return;
  if (!msg.to.endsWith('@g.us')) return;

  const sender = watchUsers[msg.from];

  Object.values(photoCheckStatus).forEach(status => {
    if (!status[sender]) {
      status[sender] = true;
      console.log(`📷 ${sender} sudah kirim foto`);
    }
  });
}

/* =========================
   START
========================= */
async function startSchedule(client) {

  await fetchPrayerTimes();

  const sentFlags = {};
  Object.keys(prayerTimes).forEach(k => (sentFlags[k] = false));

  setInterval(() => {
    checkPrayerTime(client, sentFlags);
  }, 60 * 1000);

  client.on('message', handleIncomingMessage);

  console.log('✅ Reminder sholat + foto + DM + sendSeen aktif');
}

module.exports = { startSchedule };
