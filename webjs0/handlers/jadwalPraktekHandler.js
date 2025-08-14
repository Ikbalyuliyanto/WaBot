const axios = require('axios');
const { loginAndGetToken } = require('../services/authService');

async function handleJadwalPraktek(keyword, chatId, client) {
    try {
        // Step 1: Login dan ambil token
        const token = await loginAndGetToken();
        console.log('✅ Token berhasil diambil');

        // Step 2: Ambil data jadwal dari API
        const response = await axios.get(`http://160.20.104.98/api/JadwalPraktek/paged`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            params: {
                page: 1,
                perPage: 1000, // ambil cukup banyak untuk memastikan semua data terambil
                orderBy: 'CreateDateTime',
                sortDirection: 'desc'
            }
        });

        const resultList = response.data?.data?.rows;

        if (!resultList || resultList.length === 0) {
            console.log('❌ Tidak ada data dikembalikan dari API');
            await client.sendMessage(chatId, `📅 Tidak ditemukan jadwal praktek sama sekali dari server.`);
            return;
        }

        console.log(`📥 Jumlah total data dari API: ${resultList.length}`);

        // Step 3: Filter berdasarkan hari praktek
        const filtered = resultList.filter(item =>
            item.hariPraktek?.toLowerCase() === keyword.toLowerCase()
        );

        if (filtered.length === 0) {
            await client.sendMessage(chatId, `📅 Tidak ditemukan jadwal praktek pada hari *${keyword}*.`);
            return;
        }

        // Step 4: Kirim ke WhatsApp
        let reply = `📋 Jadwal Praktek untuk hari *${keyword}*:\n\n`;

        filtered.forEach((item, index) => {
            reply += `${index + 1}. 👨‍⚕️ *${item.namaDokter}*\n`;
            reply += `   🕑 ${item.jamMulai} - ${item.jamBerakhir}\n`;
            reply += `   🏥 ${item.namaPoliklinik || '-'}\n\n`;
        });

        await client.sendMessage(chatId, reply);

    } catch (err) {
        console.error('❌ Gagal mengambil jadwal praktek:', err.message);
        await client.sendMessage(chatId, '❌ Terjadi kesalahan saat mengambil jadwal praktek. Silakan coba lagi nanti.');
    }
}

module.exports = { handleJadwalPraktek };
