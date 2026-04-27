const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const { Shazam, s16LEToSamplesArray } = require('shazam-api');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shazam')
        .setDescription('Analiza un archivo multimedia para identificar la canción en reproducción.')
        .addAttachmentOption(option =>
            option.setName('archivo')
                .setDescription('Adjunta el video o audio a analizar (Recomendado: menos de 1 minuto)')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();

        const attachment = interaction.options.getAttachment('archivo');
        const validTypes = ['video/', 'audio/'];
        
        // Validación estricta de MIME type
        if (!attachment.contentType || !validTypes.some(type => attachment.contentType.startsWith(type))) {
            return interaction.editReply("Error de formato: El archivo adjunto debe ser de tipo video o audio.");
        }

        const baseName = `aurora_shazam_${Date.now()}`;
        const inputPath = path.join(__dirname, `${baseName}_input`);
        const pcmPath = path.join(__dirname, `${baseName}.pcm`);

        try {
            await interaction.editReply("Descargando archivo en servidor local...");
            const response = await axios({ method: 'GET', url: attachment.url, responseType: 'stream' });
            const writer = fs.createWriteStream(inputPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => { 
                writer.on('finish', resolve); 
                writer.on('error', reject); 
            });

            await interaction.editReply("Aislando y procesando...");
            
            // FFmpeg recorta los primeros 10 segundos, quita el video y convierte a PCM 16-bit 16000Hz mono
            const ffmpegCmd = `ffmpeg -i "${inputPath}" -t 10 -vn -acodec pcm_s16le -f s16le -ar 16000 -ac 1 "${pcmPath}" -y`;
            await new Promise((resolve, reject) => {
                exec(ffmpegCmd, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            await interaction.editReply("Consultando...");
            
            // Carga del audio crudo en memoria y envío a la API
            const shazam = new Shazam();
            const fileContents = fs.readFileSync(pcmPath);
            const samples = s16LEToSamplesArray(fileContents);
            const shazamResponse = await shazam.recognizeSong(samples);

            // Manejo de respuesta negativa
            if (!shazamResponse || !shazamResponse.track) {
                return interaction.editReply("Análisis completado: No se encontraron coincidencias.");
            }

            // Extracción de datos exitosa y construcción visual
            const track = shazamResponse.track;
            const embed = new EmbedBuilder()
                .setColor('#0088FF')
                .setAuthor({ 
                    name: 'Identificación Musical', 
                    iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Shazam_icon.svg/1200px-Shazam_icon.svg.png' 
                })
                .setTitle(track.title)
                .setDescription(`**Artista:** ${track.subtitle}`)
                .setFooter({ text: 'Project Aurora' });

            if (track.images && track.images.coverart) {
                embed.setThumbnail(track.images.coverart);
            }

            if (track.genres && track.genres.primary) {
                embed.addFields({ name: 'Género', value: track.genres.primary, inline: true });
            }

            if (track.url) {
                embed.addFields({ name: 'Enlace Oficial', value: `[Ver en Shazam](${track.url})`, inline: true });
            }

            await interaction.editReply({ content: "Análisis finalizado exitosamente.", embeds: [embed] });

        } catch (error) {
            console.error("[Error /shazam]:", error);
            await interaction.editReply("Ocurrió un error interno del servidor durante el análisis de audio.");
        } finally {
            // Limpieza estricta de archivos temporales
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(pcmPath)) fs.unlinkSync(pcmPath);
        }
    }
};