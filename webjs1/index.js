const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Import modular
// const { router: apiRoutes, setClient } = require('./routes/apiRoutes');
const handleMessage = require('./handlers/messageHandler');

// Key 
// Import API_KEY dari constants
// const { API_KEY } = require('./config/constants');

// // Middleware API Key
// app.use((req, res, next) => {
//   const clientKey = req.headers['x-api-key'];
//   if (!clientKey || clientKey !== API_KEY  || clientKey !== cachedToken ) {
//     return res.status(403).json({ message: '❌ API Key tidak valid.' });
//   }
//   next();
// });

// Modular route
// app.use('/', apiRoutes);
// Key End

const SESSION_PATH = './.wwebjs_auth';
let client = null;
let isInitializing = false;

// Membuat ulang client WhatsApp
function createClient() {
  console.log("✨ Membuat client baru...");
  client = new Client({
    authStrategy: new LocalAuth({
      clientId: 'default',
      dataPath: SESSION_PATH
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-zygote',
        '--single-process',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu'
      ]
    }
  });

  // setClient(client); // Kirim ke routes/apiRoutes
  registerClientEvents();
  safeInitialize();
}

// Inisialisasi aman
async function safeInitialize() {
  if (isInitializing) return;
  isInitializing = true;
  try {
    await client.initialize();
    console.log('✅ WA Client berhasil diinisialisasi');
  } catch (err) {
    console.error('❌ Gagal initialize client:', err.message);
  } finally {
    isInitializing = false;
  }
}

// Hapus session + reset browser
async function forceCleanRestart() {
  try {
    if (client) {
      await client.destroy();
      client = null;
      console.log('🧹 Client destroyed');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    const sessionDir = path.join(SESSION_PATH, 'session', 'Default');
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log('🗑️ Session folder berhasil dihapus');
    }
  } catch (err) {
    console.error('❌ Gagal saat force reset:', err.message);
  }

  console.log('🔁 Membuat ulang client...');
  setTimeout(() => createClient(), 1000);
}

// Event WA Client
function registerClientEvents() {
  client.on('qr', (qr) => {
    console.log('📲 QR Code tersedia');
    io.emit('qr', qr);
    io.emit('message', '📱 Silakan scan QR!');
  });

  client.on('ready', () => {
    console.log('✅ Client WA siap!');
    io.emit('ready', 'Client is ready');
  });

  client.on('authenticated', () => {
    console.log('🔐 Autentikasi berhasil');
    io.emit('message', '🔐 Autentikasi berhasil');
  });

  client.on('auth_failure', () => {
    console.error('❌ Autentikasi gagal');
    io.emit('message', '❌ Autentikasi gagal, reset...');
    forceCleanRestart();
  });

  client.on('disconnected', async (reason) => {
    console.warn('⚠️ Terputus dari WhatsApp:', reason);
    io.emit('message', '❌ Terputus, reset ulang...');
    await forceCleanRestart();
  });

  client.on('message', async (msg) => {
    try {
      await handleMessage(client, msg);
    } catch (err) {
      console.error('❌ Error saat handle pesan:', err.message);
    }
  });
}

// Socket frontend (Web UI)
io.on('connection', (socket) => {
  console.log('🧠 Frontend terhubung ke Socket.io');
  socket.emit('message', '👋 Silakan scan QR jika belum login');

  if (client && client.info && client.info.wid) {
    socket.emit('ready', 'Client is ready');
  }

  socket.on('logout', async () => {
    console.log('🔴 Logout diminta dari frontend');
    try {
      await client.logout();
      await client.destroy();
      client = null;

      setTimeout(() => {
        const sessionPath = path.join(SESSION_PATH, 'session', 'Default');
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          console.log('🗑️ Session lama dihapus');
        } catch (err) {
          console.warn('⚠️ Gagal hapus session:', err.message);
        }
        createClient();
      }, 1000);
    } catch (err) {
      console.error('❌ Gagal saat logout:', err.message);
      socket.emit('message', '❌ Logout gagal');
    }
  });
});

// Start server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  createClient();
});;