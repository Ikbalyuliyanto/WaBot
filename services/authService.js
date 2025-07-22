const axios = require('axios');

let cachedToken = null;

async function loginAndGetToken() {
    if (cachedToken) return cachedToken;

    try {
        const response = await axios.post('http://160.20.104.98/api/Auth/login', {
            email: 'superadmin@admin.com',
            password: 'Abc12345!'
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
