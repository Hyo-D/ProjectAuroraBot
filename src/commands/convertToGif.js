const { ContextMenuCommandBuilder, ApplicationCommandType, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { exec } = require('child_process');
const { create } = require('youtube-dl-exec');
const youtubedl = create('/usr/local/bin/yt-dlp');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Convertir a GIF')
        .setType(ApplicationCommandType.Message),
    async execute(interaction) {
        await interaction.deferReply(); 

        const targetMessage = interaction.targetMessage;
        let videoUrl = null;

        const attachment = targetMessage.attachments.find(att => att.contentType && att.contentType.startsWith('video/'));
        if (attachment) videoUrl = attachment.url;
        
        if (!videoUrl) {
            const urlMatch = targetMessage.content.match(/https?:\/\/[^\s]+/);
            if (urlMatch) videoUrl = urlMatch[0];
        }

        if (!videoUrl) {
            return interaction.editReply("Error: No se encontró ningún video o enlace válido en este mensaje.");
        }

        const inputPath = path.join(__dirname, `input_ctx_${Date.now()}_video.mp4`);
        const outputPath = path.join(__dirname, `aurora_ctx_${Date.now()}.gif`);

        try {
            await interaction.editReply("Descargando archivo multimedia...");

            if (videoUrl.includes('discordapp.com') || videoUrl.includes('discord.net')) {
                const response = await axios({ method: 'GET', url: videoUrl, responseType: 'stream' });
                const writer = fs.createWriteStream(inputPath);
                response.data.pipe(writer);
                await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });
            } else {
                await youtubedl(videoUrl, { output: inputPath, format: 'w', noWarnings: true });
            }

            await interaction.editReply("Procesando fotogramas y optimizando formato...");

            const ffmpegCmd = `ffmpeg -i "${inputPath}" -vf "fps=15,scale=500:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -c:v gif "${outputPath}" -y`;
            
            await new Promise((resolve, reject) => {
                exec(ffmpegCmd, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            const stats = fs.statSync(outputPath);
            const fileSizeInMB = stats.size / (1024 * 1024);

            if (fileSizeInMB <= 8) {
                const finalAttachment = new AttachmentBuilder(outputPath);
                await interaction.editReply({ 
                    content: "Conversión finalizada.", 
                    files: [finalAttachment] 
                });
            } else {
                await interaction.editReply("Transfiriendo archivo pesado a servidor temporal...");
                
                const form = new FormData();
                form.append('reqtype', 'fileupload');
                form.append('time', '24h');
                form.append('fileToUpload', fs.createReadStream(outputPath));

                const uploadRes = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                    headers: form.getHeaders(),
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                });

                await interaction.editReply(`El archivo excede el límite de Discord. Enlace de descarga temporal:\n${uploadRes.data}`);
            }

        } catch (error) {
            console.error("[Error ContextMenu ConvertToGif]:", error);
            await interaction.editReply("Ocurrió un error interno al procesar el archivo.");
        } finally {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
    },
};