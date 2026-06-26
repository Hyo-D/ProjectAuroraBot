const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { AttachmentBuilder } = require('discord.js');

const limit8MB = 8 * 1024 * 1024; // 8MB en bytes

async function uploadOrAttachFile(filePath) {
    const stats = fs.statSync(filePath);

    if (stats.size <= limit8MB) {
        const attachment = new AttachmentBuilder(filePath);
        // Devolvemos el payload de Discord Y la ruta para borrarla después
        return { payload: { content: ` `, files: [attachment] }, actualFilePath: filePath };
    } else {
        try {
            const form = new FormData();
            form.append('reqtype', 'fileupload');
            form.append('time', '24h');
            form.append('fileToUpload', fs.createReadStream(filePath));

            const response = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                headers: form.getHeaders(),
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });

            return { payload: { content: `Archivo demasiado grande para adjuntar (Expira en 24h):\n${response.data}`, files: [] }, actualFilePath: filePath };
        } catch (error) {
            console.error("Error al subir a Catbox:", error.message);
            // Evitamos que el error 504 rompa el bot
            return { payload: { content: "El archivo excede los 8MB y el servidor temporal (Catbox) falló o está saturado.", files: [] }, actualFilePath: filePath };
        }
    }
}

module.exports = { uploadOrAttachFile };