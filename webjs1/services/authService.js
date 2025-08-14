const axios = require('axios');
const config = require('../config/config.json'); // Ambil data dari config.json
let cachedToken = null;

async function loginAndGetToken() {
    if (cachedToken) return cachedToken;

    try {
        const response = await axios.post('http://160.20.104.98/api/Auth/login', {
            email: config.userapi,
            password: config.passwordapi
        });

        const token = response.data.token;
        cachedToken = token;
        return token;
    } catch (err) {
        console.error('❌ Gagal login API:', err.message);
        throw new Error('Gagal autentikasi ke API');
    }
}

module.exports = { loginAndGetToken };
