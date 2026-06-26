const fs = require('fs');
const path = require('path');
const { create } = require('youtube-dl-exec');
const youtubedl = create('/usr/local/bin/yt-dlp');
const { uploadOrAttachFile } = require('../utils/fileUploader');

async function downloadAndPrepareSocialVideo(link) {
    const baseName = `aurora_social_${Date.now()}`;
    const outputTemplate = path.join(__dirname, `${baseName}.%(ext)s`);
    let actualFilePath = null;

    try {
        await youtubedl(link, { output: outputTemplate, noWarnings: true });

        const files = fs.readdirSync(__dirname);
        const downloadedFileName = files.find(file => file.startsWith(baseName));

        if (!downloadedFileName) throw new Error("Archivo no generado.");

        actualFilePath = path.join(__dirname, downloadedFileName);

        // Retornamos el objeto completo a interactionCreate. NO borramos el archivo aquí.
        return await uploadOrAttachFile(actualFilePath);

    } catch (error) {
        console.error(`[Error Descarga Extrayente] ${link}:`, error.message);
        // Si la descarga en sí falló, sí borramos los restos (si los hay)
        if (actualFilePath && fs.existsSync(actualFilePath)) fs.unlinkSync(actualFilePath);
        throw new Error("Fallo en la extracción del contenido provisto.");
    }
}

module.exports = { downloadAndPrepareSocialVideo };