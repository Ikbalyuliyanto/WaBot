const { MessageMedia } = require('whatsapp-web.js');

const perplexCityNumber = '18334363285@c.us';

// Simpan response terakhir agar bisa dikirim balik ke Postman
global.waitingResponse = null;

async function handleMessage(client, message) {
  const sender = message.from;

  // 💬 Jika balasan datang dari Perplex City
  if (sender === perplexCityNumber) {
    console.log('💬 Balasan dari Perplex City:', message.body);

    // Pastikan ada request yang menunggu balasan
    if (global.waitingResponse && global.waitingResponse.res) {
      const entry = global.waitingResponse;
      const replyText = message.body?.trim() || "";

      try {
        // Coba parse sebagai JSON agar Swagger tampil rapi
        const parsed = JSON.parse(replyText);
        entry.res.json(parsed);
      } catch {
        // Jika bukan JSON valid, kirim mentah sebagai teks biasa
        entry.res.json({ reply: replyText });
      }

      global.waitingResponse = null;
      console.log('📤 Balasan Perplex City dikirim ke Postman');
    }

    return;
  }

  // 🚀 Kalau pesan bukan dari Perplex City → relay ke sana
  const caption = message.body || '';
  if (message.hasMedia) {
    const media = await message.downloadMedia();
    if (media) {
      const mediaMsg = new MessageMedia(media.mimetype, media.data, media.filename);
      await client.sendMessage(perplexCityNumber, mediaMsg, { caption });
    } else {
      await client.sendMessage(perplexCityNumber, '[Media tidak bisa diunduh]');
    }
  } else {
    await client.sendMessage(perplexCityNumber, caption);
  }

  console.log('🚀 Pesan dikirim ke Perplex City');
}

module.exports = handleMessage;
