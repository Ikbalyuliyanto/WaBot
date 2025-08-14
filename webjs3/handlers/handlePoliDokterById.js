const axios = require('axios');
const { loginAndGetToken } = require('../services/authService');

async function handlePoliDokterById(keyword, chatId, client) {
    try {
        const token = await loginAndGetToken();
        console.log('✅ Token berhasil diambil');

        const response = await axios.get(`http://160.20.104.98/api/JadwalPraktek/paged`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            params: {
                page: 1,
                perPage: 1000,
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

        console.log(`📥 Jumlah total data dari API Poli: ${resultList.length}`);

        const filtered = resultList.filter(item =>
            item.namaPoliklinik?.toLowerCase() === keyword.toLowerCase()
        );

        if (filtered.length === 0) {
            await client.sendMessage(chatId, `📅 Tidak ditemukan jadwal praktek pada *${keyword}*.`);
            return;
        }

        // 🗓️ Urutkan berdasarkan hari
        const dayOrder = {
            'Senin': 1,
            'Selasa': 2,
            'Rabu': 3,
            'Kamis': 4,
            'Jumat': 5,
            'Sabtu': 6,
            'Minggu': 7
        };
        filtered.sort((a, b) => {
            return (dayOrder[a.hariPraktek] || 999) - (dayOrder[b.hariPraktek] || 999);
        });

        let reply = `📋 Jadwal Praktek untuk *${keyword}*:\n\n`;

        filtered.forEach((item, index) => {
            reply += `${index + 1}. 👨‍⚕️ *${item.namaDokter}*\n`;
            reply += `   🕑 ${item.hariPraktek}, ${item.jamMulai} - ${item.jamBerakhir}\n\n`;
        });

        await client.sendMessage(chatId, reply);

    } catch (err) {
        console.error('❌ Gagal mengambil jadwal praktek:', err.message);
        await client.sendMessage(chatId, '❌ Terjadi kesalahan saat mengambil jadwal praktek. Silakan coba lagi nanti.');
    }
}

module.exports = { handlePoliDokterById };
