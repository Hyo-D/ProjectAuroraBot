const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { exec } = require('child_process');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nobg')
        .setDescription('Elimina el fondo de una imagen en alta calidad usando IA local.')
        .addAttachmentOption(option =>
            option.setName('imagen')
                .setDescription('Sube la imagen a procesar (JPG, PNG o WEBP)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('modelo')
                .setDescription('Selecciona el motor de IA (Por defecto: General)')
                .setRequired(false) // No es obligatorio, si no lo ponen, usa el general
                .addChoices(
                    { name: '✨ General (Mejor balance para objetos/fotos)', value: 'isnet-general-use' },
                    { name: '🌸 Anime (Ilustraciones 2D)', value: 'isnet-anime' },
                    { name: '👤 Humanos ', value: 'u2net_human_seg' }
                )),

    async execute(interaction) {
        await interaction.deferReply();

        const imageAttachment = interaction.options.getAttachment('imagen');
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];

        // 1. Validación de formato
        if (!imageAttachment.contentType || !validTypes.includes(imageAttachment.contentType)) {
            return interaction.editReply("Error: El archivo adjunto no es una imagen válida (requerido: jpg, png, webp).");
        }

        // 2. Nombres de archivos temporales
        const timestamp = Date.now();
        // rembg detecta automáticamente el formato por la extensión, así que forzamos entrada y salida
        const inputPath = path.join(__dirname, `input_nobg_${timestamp}.tmp`);
        const outputPath = path.join(__dirname, `aurora_nobg_${timestamp}.png`);

        try {
            await interaction.editReply("Descargando imagen original...");

            // 3. Descargar la imagen
            const response = await axios({
                method: 'GET',
                url: imageAttachment.url,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(inputPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            await interaction.editReply("Procesando (esto puede tardar unos segundos)...");

            // 4. Ejecutar rembg
            // Capturamos el modelo elegido, o usamos el general por defecto
            const selectedModel = interaction.options.getString('modelo') || 'isnet-general-use';

            // Inyectamos la variable directamente en el comando de la terminal
            const rembgCmd = `/home/jesus/.local/bin/rembg i -a -m ${selectedModel} "${inputPath}" "${outputPath}"`;

            await new Promise((resolve, reject) => {
                exec(rembgCmd, (error, stdout, stderr) => {
                    if (error) {
                        console.error("[Error rembg stderr]:", stderr);
                        return reject(error);
                    }
                    resolve();
                });
            });

            // 5. Validación de peso y envío (Reutilizando tu lógica de Catbox/Litterbox)
            const stats = fs.statSync(outputPath);
            const fileSizeInMB = stats.size / (1024 * 1024);

            if (fileSizeInMB <= 8) {
                const finalAttachment = new AttachmentBuilder(outputPath);

                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setDescription('✨ Fondo eliminado con éxito')
                    .setImage(`attachment://${path.basename(outputPath)}`)
                    .setFooter({ text: 'Project Aurora | IA Humilde' });

                await interaction.editReply({
                    content: " ",
                    embeds: [embed],
                    files: [finalAttachment]
                });
            } else {
                await interaction.editReply("El resultado PNG excede los 8MB de Discord. Transfiriendo a servidor temporal...");

                const form = new FormData();
                form.append('reqtype', 'fileupload');
                form.append('time', '24h');
                form.append('fileToUpload', fs.createReadStream(outputPath));

                const uploadRes = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                    headers: form.getHeaders(),
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                });

                await interaction.editReply(`La imagen en alta resolución excede el límite de Discord. Enlace de descarga (Expira en 24h):\n${uploadRes.data}`);
            }

        } catch (error) {
            console.error("[Error /nobg]:", error);
            await interaction.editReply("Ocurrió un error interno al intentar quitar el fondo de la imagen.");
        } finally {
            // 6. Limpieza garantizada de archivos temporales
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
    },
};