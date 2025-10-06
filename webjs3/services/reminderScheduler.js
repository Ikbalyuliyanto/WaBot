// services/reminderScheduler.js

// Daftar nomor penerima
const targets = [
  '628124885707@c.us',
  '6285179845620@c.us'  // Contoh nomor lain
];

// Nama personalisasi per nomor
const customNames = {
  '628124885707@c.us': 'Kak',
  '6285179845620@c.us': 'Buk'
};

// Fungsi kirim pesan ke semua nomor
function sendToAll(client, baseMessage) {
  for (const number of targets) {
    const namePrefix = customNames[number] || '';
    const personalizedMessage = namePrefix ? `${namePrefix}, ${baseMessage}` : baseMessage;

    client.sendMessage(number, personalizedMessage)
      .then(() => console.log(`✅ Pesan dikirim ke ${number}`))
      .catch(err => console.error(`❌ Gagal kirim ke ${number}:`, err.message));
  }
}

// Jadwal sholat manual (format HH:mm)
const prayerTimes = {
  subuh: '05:30',
  dzuhur: '12:20',
  ashar: '15:30',
  maghrib: '18:09',
  isya: '19:02'
};

// Fungsi cek waktu sholat dan kirim pesan jika waktunya tepat
function checkPrayerTime(client, sentFlags) {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // ambil format "HH:mm"

  Object.entries(prayerTimes).forEach(([name, time]) => {
    if (currentTime === time && !sentFlags[name]) {
      const message = `🕌 Waktu sholat ${name.charAt(0).toUpperCase() + name.slice(1)}. Jangan lupa sholat ya!`;
      sendToAll(client, message);
      sentFlags[name] = true; // tandai sudah kirim supaya gak duplikat selama menit itu
    }
    // Reset flag saat waktu sudah lewat supaya bisa kirim lagi hari berikutnya
    else if (currentTime !== time && sentFlags[name]) {
      sentFlags[name] = false;
    }
  });
}

// Fungsi utama untuk memulai pengingat sholat
function startSchedule(client) {
  // Object untuk menyimpan flag kirim pesan per waktu sholat
  const sentFlags = {
    subuh: false,
    dzuhur: false,
    ashar: false,
    maghrib: false,
    isya: false
  };

  // Cek setiap menit
  setInterval(() => {
    if (client && client.info && client.info.wid) {
      checkPrayerTime(client, sentFlags);
    }
  }, 60 * 1000); // 60000ms = 1 menit

  console.log('🕋 Jadwal pengingat sholat aktif tanpa node-schedule!');
}

module.exports = { startSchedule };
