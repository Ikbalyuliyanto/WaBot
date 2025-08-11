// const { loginAndGetToken } = require('../utils/authApi');
// const config = require('../config/config.json');

// module.exports = async function verifyToken(req, res, next) {
//     const clientKey = req.headers['x-api-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');

//     try {
//         const validToken = await loginAndGetToken(); // dari config.json
//         if (clientKey === config.API_KEY || clientKey === validToken) {
//             return next();
//         } else {
//             return res.status(403).json({ message: '❌ Token tidak valid.' });
//         }
//     } catch (err) {
//         console.error('❌ Validasi token gagal:', err.message);
//         return res.status(500).json({ message: 'Kesalahan validasi token.' });
//     }
// }
