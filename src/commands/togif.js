const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { exec } = require('child_process');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('togif')
        .setDescription('Convierte un video corto en un archivo GIF optimizado.')
        .addAttachmentOption(option =>
            option.setName('video')
                .setDescription('Sube el archivo de video que quieres convertir')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply(); 

        const videoAttachment = interaction.options.getAttachment('video');

        if (!videoAttachment.contentType || !videoAttachment.contentType.startsWith('video/')) {
            return interaction.editReply("Error: El archivo adjunto no es un formato de video válido (requerido: mp4, webm, mov).");
        }

        const inputPath = path.join(__dirname, `input_slash_${Date.now()}_${videoAttachment.name}`);
        const outputPath = path.join(__dirname, `aurora_slash_${Date.now()}.gif`);

        try {
            const response = await axios({
                method: 'GET',
                url: videoAttachment.url,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(inputPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

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
            console.error("[Error /togif]:", error);
            await interaction.editReply("Ocurrió un error interno al procesar el archivo.");
        } finally {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
    },
};