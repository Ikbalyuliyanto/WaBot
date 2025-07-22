const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { MessageMedia } = require('whatsapp-web.js');
const { kirimEmailWithAttachment } = require('../services/emailService');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Ambil client dari parameter fungsi ekspor nanti
let client;

// API: Kirim pesan teks
router.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    if (!number || !message) return res.status(400).json({ message: 'Nomor dan pesan harus diisi' });

    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
    try {
        await client.sendMessage(chatId, message);
        res.json({ message: '✅ Pesan berhasil dikirim' });
    } catch (error) {
        console.error('❌ Gagal kirim pesan:', error);
        res.status(500).json({ message: 'Gagal mengirim pesan' });
    }
});

// API: Kirim file ke WhatsApp
router.post('/upload-and-send', upload.single('pdf'), async (req, res) => {
    const { number } = req.body;
    if (!number || !req.file) return res.status(400).json({ message: 'Nomor dan file wajib diisi.' });

    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
    const filePath = path.resolve(req.file.path);
    const mimeType = req.file.mimetype;
    const base64Data = fs.readFileSync(filePath).toString('base64');

    const media = new MessageMedia(mimeType, base64Data, req.file.originalname);
    try {
        await client.sendMessage(chatId, media, { sendMediaAsDocument: true });
        res.json({ message: '✅ File berhasil dikirim ke WhatsApp.' });
    } catch (error) {
        console.error('❌ Gagal kirim file:', error);
        res.status(500).json({ message: 'Gagal mengirim file' });
    }
});

// API: Kirim file via email
router.post('/upload-and-send-mail', upload.single('pdf'), async (req, res) => {
    const { email, subject, text } = req.body;

    const filePath = path.resolve(req.file.path);
    const mimeType = req.file.mimetype;
    const originalName = req.file.originalname;

    try {
        await kirimEmailWithAttachment({
            to: email,
            subject,
            text,
            attachments: [{
                filename: originalName,
                path: filePath,
                contentType: mimeType,
            }]
        });

        res.json({ message: '✅ Email dengan file berhasil dikirim.' });
    } catch (error) {
        console.error('❌ Gagal kirim email:', error);
        res.status(500).json({ message: '❌ Gagal mengirim email.' });
    }
});

// Fungsi untuk menyetel client WhatsApp dari luar
function setClient(whatsappClient) {
    client = whatsappClient;
}

module.exports = { router, setClient };
