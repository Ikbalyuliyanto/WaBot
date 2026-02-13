const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// ===== INIT SERVER =====
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*'
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== ROUTES & HANDLER =====
const { router: apiRoutes, setClient } = require('./routes/apiRoutes');
const handleMessage = require('./handlers/messageHandler');

app.use('/', apiRoutes);

// ===== WHATSAPP CONFIG =====
let client = null;
let isInitializing = false;

// ===== CREATE CLIENT (SATU KALI) =====
function createClient() {
  if (client) return;

  console.log('✨ Membuat client WhatsApp...');

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: 'wa-main' // stabil & konsisten
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    }
  });

  setClient(client);
  registerClientEvents();
  safeInitialize();
}

// ===== SAFE INITIALIZE =====
async function safeInitialize() {
  if (isInitializing || !client) return;

  isInitializing = true;
  try {
    await client.initialize();
    console.log('✅ WA Client berhasil diinisialisasi');
  } catch (err) {
    console.error('❌ Gagal initialize:', err.message);
  } finally {
    isInitializing = false;
  }
}

// ===== REGISTER EVENTS =====
function registerClientEvents() {
  client.on('qr', (qr) => {
    console.log('📲 QR Code tersedia');
    io.emit('qr', qr);
  });

  client.on('authenticated', () => {
    console.log('🔐 Autentikasi berhasil');
    io.emit('message', '🔐 Autentikasi berhasil');
  });

  client.on('ready', () => {
    console.log('✅ Client WA siap!');
    io.emit('ready', 'Client ready');
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Auth failure:', msg);
    io.emit('message', '❌ Autentikasi gagal, scan ulang QR');
  });

  client.on('disconnected', (reason) => {
    console.warn('⚠️ WA disconnected:', reason);

    if (reason === 'LOGOUT') {
      // ❌ JANGAN auto recreate
      io.emit('message', '❌ WhatsApp logout. Silakan scan QR ulang.');
      client = null;
      return;
    }

    // reconnect HALUS
    setTimeout(() => {
      console.log('🔁 Re-initialize client...');
      safeInitialize();
    }, 5000);
  });

  client.on('message', async (msg) => {
    try {
      await handleMessage(client, msg);
    } catch (err) {
      console.error('❌ Error handle message:', err.message);
    }
  });
}

// ===== SOCKET FRONTEND =====
io.on('connection', (socket) => {
  console.log('🧠 Frontend terhubung');

  socket.emit('message', '👋 Selamat datang');

  if (client && client.info?.wid) {
    socket.emit('ready', 'Client ready');
  }

  socket.on('logout', async () => {
    if (!client) return;

    console.log('🔴 Logout diminta dari frontend');
    try {
      await client.logout();
      await client.destroy();
      client = null;

      io.emit('message', '🔴 Logout berhasil, scan QR ulang');

      setTimeout(() => {
        createClient();
      }, 3000);

    } catch (err) {
      console.error('❌ Logout error:', err.message);
    }
  });
});

// ===== START SERVER =====
const PORT = 3005;
server.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  createClient();
});
