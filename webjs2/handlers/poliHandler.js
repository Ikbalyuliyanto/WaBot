const axios = require('axios');
const { loginAndGetToken } = require('../services/authService');

async function handlePoliInfo(keyword, chatId, client, session) {
    try {
        const token = await loginAndGetToken();
        console.log('✅ Token berhasil diambil untuk POLI');

        const response = await axios.get('http://160.20.104.98/api/Poliklinik/paged', {
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

        const poliList = response.data?.data?.rows || [];
        // Simpan ke session
        session.poliList = poliList;
        // Simpan ke session End
        const filtered = poliList.filter(poli =>
            poli.namaPoliklinik?.toLowerCase().includes(keyword.toLowerCase())
        );

        if (filtered.length === 0) {
            await client.sendMessage(chatId, `🏥 Tidak ditemukan data untuk poli *${keyword}*.`);
            return;
        }

        let reply = `📋 Daftar Poli:\n\n`;

        filtered.forEach((item, index) => {
            reply += `${index + 1}. 🏥 *${item.namaPoliklinik}*\n`;
        });

        await client.sendMessage(chatId, reply);

    } catch (err) {
        console.error('❌ Gagal mengambil data poliklinik:', err.message);
        await client.sendMessage(chatId, '❌ Terjadi kesalahan saat mengambil data poliklinik.');
    }
}

module.exports = { handlePoliInfo };
