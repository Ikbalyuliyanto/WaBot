// utils/resetSession.js
const fs = require('fs');
const path = require('path');

function deleteFolderRecursive(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file) => {
            const curPath = path.join(folderPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                try {
                    fs.unlinkSync(curPath);
                } catch (e) {
                    console.warn(`⚠️ Gagal hapus file ${curPath}: ${e.message}`);
                }
            }
        });

        try {
            fs.rmdirSync(folderPath);
        } catch (e) {
            console.warn(`⚠️ Gagal hapus folder ${folderPath}: ${e.message}`);
        }
    }
}

function resetSession() {
    const sessionPath = path.join(__dirname, '../.wwebjs_auth');
    console.log('🧨 Reset session WhatsApp...');

    deleteFolderRecursive(sessionPath);
    console.log('✅ Folder session dibersihkan.');
}

module.exports = { resetSession };
