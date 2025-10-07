// services/reminderScheduler.js

const groupTargets = [
  '120363403796776086@g.us'  // ID grup
];

const watchUsers = {
  '628124885707@c.us': 'Buk',
  '6285179845620@c.us': 'Kak'
};

// Waktu-waktu yang wajib kirim foto
const photoRequiredTimes = ['subuh', 'maghrib', 'isya'];

// Untuk melacak status kirim foto
let photoCheckStatus = {}; // Akan berisi: { subuh: { Buk: false, Kak: false, timer: ... } }

function sendToAllGroups(client, message) {
  for (const groupId of groupTargets) {
    client.sendMessage(groupId, message)
      .then(() => console.log(`✅ Pesan dikirim ke grup ${groupId}`))
      .catch(err => console.error(`❌ Gagal kirim ke grup ${groupId}:`, err.message));
  }
}

// Fungsi cek waktu sholat
function checkPrayerTime(client, sentFlags) {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);

  Object.entries(prayerTimes).forEach(([name, time]) => {
    if (currentTime === time && !sentFlags[name]) {
      const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
      const message = `Kak sama Buk Waktunya sholat ${capitalized}. Di Foto ke grup jangan lupa.`;
      sendToAllGroups(client, message);
      sentFlags[name] = true;

      if (photoRequiredTimes.includes(name)) {
        startPhotoWatch(client, name);
      }
    } else if (currentTime !== time && sentFlags[name]) {
      sentFlags[name] = false;
    }
  });
}

// Mulai pantau apakah "Buk" dan "Kak" mengirim foto
function startPhotoWatch(client, prayerName) {
  photoCheckStatus[prayerName] = {
    Buk: false,
    Kak: false,
    timer: setTimeout(() => {
      const status = photoCheckStatus[prayerName];
      const notSent = [];

      if (!status.Buk) notSent.push('Buk');
      if (!status.Kak) notSent.push('Kak');

      if (notSent.length > 0) {
        const message = `❗ Pengingat: ${notSent.join(' dan ')} belum mengirim foto untuk sholat ${prayerName}.`;
        sendToAllGroups(client, message);
      }

      delete photoCheckStatus[prayerName];
    }, 30 * 60 * 1000) // 30 menit
  };

  console.log(`⏳ Memantau foto dari Buk dan Kak untuk sholat ${prayerName}...`);
}

// Tangani pesan masuk dan cek apakah itu foto dari Buk/Kak
function handleIncomingMessage(msg) {
  if (!msg.hasMedia) return;
  if (!msg.from || !watchUsers[msg.from]) return;
  if (!msg.to.endsWith('@g.us')) return; // harus ke grup

  // Cek apakah sedang ada pemantauan foto
  Object.keys(photoCheckStatus).forEach(prayerName => {
    const status = photoCheckStatus[prayerName];
    const senderName = watchUsers[msg.from];

    if (!status[senderName]) {
      status[senderName] = true;
      console.log(`📷 ${senderName} sudah kirim foto untuk sholat ${prayerName}`);
    }
  });
}

// Jadwal sholat (manual)
const prayerTimes = {
  subuh: '05:30',
  dzuhur: '10:42',
  ashar: '10:43',
  maghrib: '18:09',
  isya: '19:02'
};

function startSchedule(client) {
  const sentFlags = {
    subuh: false,
    dzuhur: false,
    ashar: false,
    maghrib: false,
    isya: false
  };

  setInterval(() => {
    if (client && client.info && client.info.wid) {
      checkPrayerTime(client, sentFlags);
    }
  }, 60 * 1000);

  // Tangkap pesan masuk untuk cek media dari Buk/Kak
  client.on('message', handleIncomingMessage);

  console.log('🕋 Jadwal pengingat sholat & pemantauan foto aktif (khusus ke grup)');
}

module.exports = { startSchedule };