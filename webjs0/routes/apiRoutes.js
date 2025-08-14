const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { MessageMedia } = require('whatsapp-web.js');
const { kirimEmailWithAttachment } = require('../services/emailService');
const verifyToken = require('../middlewares/verifyToken');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Ambil client dari parameter fungsi ekspor nanti
let client;

// Endpoint untuk login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email dan password wajib diisi.' });
    }

    try {
        // Cek konfigurasi lokal terlebih dahulu
        const configPath = path.join(__dirname, '../config/config.json');
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(configData);

            // Validasi login lokal
            if (email === config.userapi && password === config.passwordapi) {
                return res.json({
                    message: '✅ Login berhasil dengan konfigurasi lokal.',
                    method: 'local',
                    token: config.apikey, // Anda bisa mengubahnya sesuai kebutuhan
                });
            }
        }

        // Jika login lokal gagal, coba login ke API eksternal
        const response = await fetch("http://160.20.104.98/api/Auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            return res.status(401).json({ message: 'Login gagal di API eksternal.' });
        }

        const apiData = await response.json();
        return res.json({
            message: '✅ Login berhasil melalui API eksternal.',
            method: 'api',
            token: apiData.token, // Menyimpan token dari API eksternal
        });

    } catch (err) {
        console.error('❌ Gagal login:', err);
        res.status(500).json({ message: 'Gagal melakukan login.', error: err.message });
    }
});
// menampilkan semua chat
// GET: Ambil semua pesan dari semua chat
router.get('/messages', async (req, res) => {
    try {
        if (!client) {
            return res.status(503).json({ message: '❌ Client belum siap.' });
        }

        const chats = await client.getChats();
        const result = [];

        for (const chat of chats) {
            const messages = await chat.fetchMessages({ limit: 20 }); // Bisa diubah jumlahnya
            result.push({
                chatName: chat.name || chat.id.user || 'Unknown',
                chatId: chat.id._serialized,
                messages: messages.map(msg => ({
                    fromMe: msg.fromMe,
                    sender: msg.author || msg.from,
                    body: msg.body,
                    timestamp: msg.timestamp,
                    hasMedia: msg.hasMedia || false
                }))
            });
        }

        res.json(result);
    } catch (error) {
        console.error('❌ Gagal ambil pesan:', error.message);
        res.status(500).json({ message: 'Gagal mengambil pesan', error: error.message });
    }
});
// GET: Ambil riwayat pesan dari 1 chat tertentu berdasarkan chatId
router.get('/messages/:chatId', async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({ message: '❌ Client belum siap.' });
    }

    const chatId = req.params.chatId;

    const chat = await client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: 50 }); // ambil 50 pesan terakhir

    res.json({
      messages: messages.map(msg => ({
        fromMe: msg.fromMe,
        sender: msg.author || msg.from,
        body: msg.body,
        timestamp: msg.timestamp,
        hasMedia: msg.hasMedia || false
      }))
    });
  } catch (error) {
    console.error('❌ Gagal ambil chat:', error.message);
    res.status(500).json({ message: 'Gagal mengambil detail chat', error: error.message });
  }
});

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

const configPath = path.join(__dirname, '../config/config.json');

// GET: Ambil konfigurasi
router.get('/config', (req, res) => {
    try {
        if (!fs.existsSync(configPath)) return res.json({});
        const data = fs.readFileSync(configPath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('❌ Gagal membaca config:', err);
        res.status(500).json({ message: 'Gagal membaca konfigurasi' });
    }
});

// ✅ POST: Simpan konfigurasi (dengan pengecekan folder)
router.post('/config', express.json(), (req, res) => {
    try {
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
        res.json({ message: '✅ Konfigurasi berhasil disimpan' });
    } catch (err) {
        console.error('❌ Gagal menyimpan config:', err);
        res.status(500).json({ message: 'Gagal menyimpan konfigurasi' });
    }
});
router.post('/config', express.json(), (req, res) => {
    try {
        console.log('📥 Data diterima:', req.body);

        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            console.log('📁 Folder belum ada, membuat folder...');
            fs.mkdirSync(configDir, { recursive: true });
        }

        fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
        console.log('✅ Konfigurasi berhasil disimpan ke:', configPath);

        res.json({ message: '✅ Konfigurasi berhasil disimpan' });
    } catch (err) {
        console.error('❌ Gagal menyimpan config:', err);
        res.status(500).json({ message: 'Gagal menyimpan konfigurasi', error: err.message });
    }
});

module.exports = { router, setClient };
