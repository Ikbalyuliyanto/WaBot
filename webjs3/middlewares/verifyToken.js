// Kunci API statis untuk Postman/server
const API_KEY = 'kynd_X2n91cA38Dz73k5Mf81aZLq8Ld_f9083da98dfd092a8c5';

// Token dinamis dari login frontend
let cachedToken = null;

// Middleware validasi API key/token
function authMiddleware(req, res, next) {
    const clientKey = req.headers['x-api-key'];

    // Biarkan request ke /login tanpa API key
    if (req.path === '/login') {
        return next();
    }

    // Jika pakai API_KEY statis (Postman)
    if (clientKey && clientKey === API_KEY) {
        return next();
    }

    // Jika pakai token dari login frontend
    if (clientKey && clientKey === cachedToken) {
        return next();
    }

    // Jika tidak lolos semua
    return res.status(403).json({ message: '❌ Harus login dulu atau API key tidak valid.' });
}
