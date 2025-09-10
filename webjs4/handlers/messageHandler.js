// handlers/messageHandler.js
const { MessageMedia } = require('whatsapp-web.js');

const perplexCityNumber = '18334363285@c.us';
const userSessionMap = {};
const relayMap = {};

function isInactiveTooLong(lastActivityTime) {
    return (Date.now() - lastActivityTime) > 3600000; // 1 jam
}

function createRelayMessage(sender, body, prefix = '') {
    const id = Math.random().toString(36).substring(2, 8);
    relayMap[id] = { sender, timestamp: Date.now() };
    return `${id}: ${prefix}${body}`;
}

async function relayToPerplex(client, sender, messageBody, withInstruction = true) {
    const prefix = withInstruction
        ? "Kamu adalah admin dari RS MMC. Tanggapi semua pesan seolah-olah kamu adalah admin rumah sakit MMC dan siap bantu pasien. "
        : "";
    const textToSend = createRelayMessage(sender, messageBody, prefix);
    await client.sendMessage(perplexCityNumber, textToSend);
}

async function handleMessage(client, message) {
    const sender = message.from;
    const now = Date.now();
    const text = message.body.trim();
    const lowerText = text.toLowerCase();

    if (sender === perplexCityNumber) {
        const matchedId = Object.keys(relayMap).find(id => lowerText.includes(id));
        if (matchedId) {
            const target = relayMap[matchedId].sender;
            const cleanedBody = message.body.replace(new RegExp(`^${matchedId}:\\s*`, 'i'), '').trim();
            await client.sendMessage(target, cleanedBody);
            delete relayMap[matchedId];
        }
        return;
    }

    if (userSessionMap[sender]?.lastActivityTime && isInactiveTooLong(userSessionMap[sender].lastActivityTime)) {
        delete userSessionMap[sender];
    }

    const session = userSessionMap[sender] || {
        phase: 'welcome',
        lastActivityTime: now
    };
    userSessionMap[sender] = session;
    session.lastActivityTime = now;

    if (session.phase === 'welcome') {
        await client.sendMessage(sender, 'Halo selamat datang di RS MMC, saya admin RS MMC. Ada yang bisa kami bantu?');
        session.phase = 'ai';
        return;
    }

    const keywords = ['jadwal', 'dokter', 'poli', 'poliklinik'];
    if (keywords.some(k => lowerText.includes(k))) {
        session.phase = 'menu_awal';
        await client.sendMessage(sender, 'Berikut pilihan yang tersedia:\n\n1. Jadwal Dokter\n2. Poli\n3. Registrasi\n\nSilakan balas dengan angka 1, 2 atau 3.');
        return;
    }

    if (session.phase === 'menu_awal') {
        if (text === '1') {
            session.phase = 'memilih_dokter';
            await client.sendMessage(sender, 'Silakan pilih hari:\n\n1. Senin\n2. Selasa\n3. Rabu\n4. Kamis\n5. Jumat\n6. Sabtu\n7. Minggu');
        } else if (text === '2') {
            session.phase = 'memilih_poli';
            const { handlePoliInfo } = require('./poliHandler');
            await handlePoliInfo('', sender, client, session); 
        } else if (text === '3') {
            session.phase = 'menu_awal';
            await client.sendMessage(sender, 'Pendaftaran Masih dalam Proses Pengembangan');
        } else {
            // Jika input tidak valid, tetap kirim ke Perplex
            session.phase = 'menu_awal';
            await relayToPerplex(client, sender, text);
        }
        return;
    }

    if (session.phase === 'memilih_dokter') {
        const hariMap = {
            '1': 'Senin', '2': 'Selasa', '3': 'Rabu',
            '4': 'Kamis', '5': 'Jumat', '6': 'Sabtu', '7': 'Minggu'
        };
        const hari = hariMap[text];

        session.phase = 'memilih_dokter';
        if (hari) {
            await client.sendMessage(sender, `Anda memilih hari *${hari}*. Mohon tunggu informasi jadwal dokter...`);

            // Panggil handler pencarian jadwal
            const { handleJadwalPraktek } = require('./jadwalPraktekHandler');
             // sesuaikan path-nya

            await handleJadwalPraktek(hari, sender, client);

            // Opsional: jika ingin tetap kirim ke AI setelah itu
            // await relayToPerplex(client, sender, `JADWAL: ${hari}`, false);
        } else {
            session.phase = 'memilih_dokter';
            await relayToPerplex(client, sender, text);
        }
        return;
    }


   if (session.phase === 'memilih_poli') {
        const selectedIndex = parseInt(text) - 1;
        const selectedPoli = session.poliList?.[selectedIndex];

        if (selectedPoli) {
            session.selectedPoliId = selectedPoli.poliklinikId;
            session.selectedPoliNama = selectedPoli.namaPoliklinik;

            // Langsung cari jadwal dokter berdasarkan ID Poli
            const { handlePoliDokterById } = require('./handlePoliDokterById');
            await client.sendMessage(sender, `🔍 Mencari jadwal dokter untuk poli *${selectedPoli.namaPoliklinik}*...`);
            await handlePoliDokterById(session.selectedPoliNama, sender, client);

        } else {
            session.phase = 'ai'; // atau reset ke fase awal jika ingin mengulang
            await client.sendMessage(sender, `❌ Pilihan tidak valid. Silakan pilih angka dari daftar poli.`);
        }
        return;
    }

    await relayToPerplex(client, sender, text);
}

module.exports = handleMessage;
