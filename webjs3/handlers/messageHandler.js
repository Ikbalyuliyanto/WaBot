// handlers/messageHandler.js
const perplexCityNumber = '18334363285@c.us'; // Nomor AI pusat
const pendingQueue = []; // Antrian pesan menunggu balasan AI

// Kirim pesan ke AI
async function relayToPerplex(client, sender, messageBody, withInstruction = true) {
    const prefix = withInstruction
        ? "Kamu adalah Seseorang. Tanggapi semua pesan seolah-olah kamu adalah Seseorang dan siap membantu pasien. "
        : "";
    const textToSend = prefix + messageBody;

    // Masukkan pengirim ke antrian
    pendingQueue.push(sender);

    // Kirim ke AI
    await client.sendMessage(perplexCityNumber, textToSend);
}

// Handler utama
async function handleMessage(client, message) {
    const sender = message.from;
    const text = message.body.trim();

    // Jika pesan dari AI
    if (sender === perplexCityNumber) {
        if (pendingQueue.length > 0) {
            const targetUser = pendingQueue.shift(); // Ambil user paling depan di antrian
            await client.sendMessage(targetUser, text);
        } else {
            console.warn("⚠ Balasan AI datang tapi tidak ada user di antrian.");
        }
        return;
    }

    // Jika pesan dari user biasa → kirim ke AI
    await relayToPerplex(client, sender, text);
}

module.exports = handleMessage;
