require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder} = require('discord.js');
const fs = require('fs'); // Para leer archivos y ver su peso
const path = require('path'); // Para manejar las rutas de los archivos
const axios = require('axios'); // Para subir a Litterbox
const FormData = require('form-data'); // Para empaquetar el archivo al subirlo
const { exec } = require('child_process');
const { create } = require('youtube-dl-exec');
const youtubedl = create('/usr/local/bin/yt-dlp'); // Asegúrate de que yt-dlp esté instalado y en esta ruta

// Configurar los permisos del bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Cuando el bot encienda, nos avisará en la terminal
client.once('clientReady', () => {
    console.log(`🚂 ¡Project Aurora encendido e iniciado sesión como ${client.user.tag}!`);
});



client.on('interactionCreate', async interaction => {
    
if (interaction.isChatInputCommand()) {
    
    

    if (interaction.commandName === 'about') {
        // 1. Cálculos del Bot
        const totalSeconds = interaction.client.uptime / 1000;
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const uptime = `${days}d ${hours}h ${minutes}m`;
        const serverCount = interaction.client.guilds.cache.size.toString();

        const botCreationTimestamp = Math.floor(interaction.client.user.createdTimestamp / 1000);
        const botCreationDate = `<t:${botCreationTimestamp}:D>`;

        // 2. Información Visual del Usuario (Solicitante)
        const userAvatar = interaction.user.displayAvatarURL({ dynamic: true, size: 512 });

        // 3. TU GIF PERSONALIZADO 🎁
        const gifPersonalizadoUrl = 'https://media.discordapp.net/attachments/1454490078918217903/1454650610816126997/cd11a6b1bd039316e1139721a55e96ca.gif?ex=69b01fb3&is=69aece33&hm=7bbab78553b360fa4768b79b455db5e9cbfad02d64d5f58260cabdd33d6d9fc4&';

        // 4. CONSTRUCCIÓN DEL EMBED 
        const infoEmbed = new EmbedBuilder()
            .setColor('#2F3136') // Gris oscuro elegante
            .setAuthor({
                name: `${interaction.user.username}`,
                iconURL: userAvatar
            })
            // El Thumbnail a la derecha es la foto del Bot
            .setThumbnail(interaction.client.user.displayAvatarURL())
            // Usamos el GIF personalizado en grande
            .setImage(gifPersonalizadoUrl)
            .setDescription(
                `**<:Miku1:1480703103274586222> Desarrollador**\n` +
                `└ \`Hyo_d\`\n\n` +

                `**<:waos:1480704308218695850> Cumpleaños**\n` +
                `└ ${botCreationDate}\n\n` +

                `**⏱️ Tiempo Activo**\n` +
                `└ \`${uptime}\`\n\n` +

                `**<:abacho:1195591404534112376> Servidores**\n` +
                `└ \`${serverCount}\` servers\n\n`

            );

        // 5. CREACIÓN DE LOS BOTONES (ActionRow)
        const buttonsRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('GitHub Profile')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🔗')
                    .setURL('https://github.com/Hyo-D'),

                new ButtonBuilder()
                    .setLabel('Sitio Web (Próximamente)')
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId('portfolio_pending')
                    .setDisabled(true) // Desactivado por ahora
            );

        // 6. ENVIAMOS LA RESPUESTA
        await interaction.reply({
            embeds: [infoEmbed],
            components: [buttonsRow]
        });
    }

    if (interaction.commandName === 'togif') {
            // Le pedimos tiempo a Discord porque convertir videos tarda unos segundos
            await interaction.deferReply(); 

            // Obtenemos el archivo que el usuario subió
            const videoAttachment = interaction.options.getAttachment('video');

            // Filtro de seguridad: ¿Es realmente un video?
            if (!videoAttachment.contentType || !videoAttachment.contentType.startsWith('video/')) {
                return interaction.editReply("❌ Por favor, adjunta un archivo de video válido (mp4, webm, mov).");
            }

            const inputPath = path.join(__dirname, `input_${Date.now()}_${videoAttachment.name}`);
            const outputPath = path.join(__dirname, `aurora_output_${Date.now()}.gif`);

            try {
                // 1. Descargamos el video del mensaje de Discord a nuestro servidor Linux
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

                await interaction.editReply("⏳ Procesando fotogramas y optimizando...");

                // 2. LA MAGIA DE FFMPEG
                // fps=15 (fluido para gifs), scale=500:-1 (ancho de 500px para no exceder los 8MB)
                const ffmpegCmd = `ffmpeg -i "${inputPath}" -vf "fps=15,scale=500:-1:flags=lanczos" -c:v gif "${outputPath}" -y`;
                
                await new Promise((resolve, reject) => {
                    exec(ffmpegCmd, (error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });

                // 3. Pesamos el GIF resultante
                const stats = fs.statSync(outputPath);
                const fileSizeInMB = stats.size / (1024 * 1024);

                if (fileSizeInMB <= 8) {
                    const finalAttachment = new AttachmentBuilder(outputPath);
                    await interaction.editReply({ 
                        content: "Gif Generado", 
                        files: [finalAttachment] 
                    });
                } else {
                    // Si el GIF sigue siendo muy pesado, aplicamos el plan de respaldo de Litterbox
                    await interaction.editReply("Subiendo a la nube temporal...");
                    
                    const form = new FormData();
                    form.append('reqtype', 'fileupload');
                    form.append('time', '24h');
                    form.append('fileToUpload', fs.createReadStream(outputPath));

                    const uploadRes = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                        headers: form.getHeaders(),
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity
                    });

                    await interaction.editReply(`GIF muy pesado, pero puedes descargarlo aquí:\n${uploadRes.data}`);
                }

            } catch (error) {
                console.error("Error al crear GIF:", error);
                await interaction.editReply("Error al intentar procesar el GIF.");
            } finally {
                // 4. Limpieza absoluta del servidor (borramos el mp4 y el gif original)
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            }
        }

        if (interaction.isMessageContextMenuCommand()) {
        if (interaction.commandName === 'Convertir a GIF') {
            await interaction.deferReply(); 

            // Atrapamos el mensaje completo al que el usuario le dio clic derecho
            const targetMessage = interaction.targetMessage;

            // Buscamos si ese mensaje tiene algún archivo adjunto que sea un video
            const videoAttachment = targetMessage.attachments.find(att => att.contentType && att.contentType.startsWith('video/'));

            if (!videoAttachment) {
                return interaction.editReply("No video adjunto valido");
            }

            const inputPath = path.join(__dirname, `input_ctx_${Date.now()}_${videoAttachment.name}`);
            const outputPath = path.join(__dirname, `aurora_ctx_${Date.now()}.gif`);

            try {
                await interaction.editReply("Extrayendo.");

                // 1. Descargamos el video del mensaje original
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

                await interaction.editReply("Convirtiendo.");

                // 2. LA MAGIA DE FFMPEG (Igual que en el slash command)
                const ffmpegCmd = `ffmpeg -i "${inputPath}" -vf "fps=15,scale=500:-1:flags=lanczos" -c:v gif "${outputPath}" -y`;
                
                await new Promise((resolve, reject) => {
                    exec(ffmpegCmd, (error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });

                // 3. Revisión de peso y envío
                const stats = fs.statSync(outputPath);
                const fileSizeInMB = stats.size / (1024 * 1024);

                if (fileSizeInMB <= 8) {
                    const finalAttachment = new AttachmentBuilder(outputPath);
                    await interaction.editReply({ 
                        content: "Gif Procesado", 
                        files: [finalAttachment] 
                    });
                } else {
                    await interaction.editReply("Subiendo a servidor temporal...");
                    
                    const form = new FormData();
                    form.append('reqtype', 'fileupload');
                    form.append('time', '24h');
                    form.append('fileToUpload', fs.createReadStream(outputPath));

                    const uploadRes = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                        headers: form.getHeaders(),
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity
                    });

                    await interaction.editReply(`GIF muy pesado, descargalo: \n${uploadRes.data}`);
                }

            } catch (error) {
                console.error("Error al crear GIF desde contexto:", error);
                await interaction.editReply("Ocurrió un error al procesar el video.");
            } finally {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            }
        }
    }

    }

    // --- SISTEMA DE BOTONES INTERACTIVOS ---
    if (interaction.isButton()) {
        if (interaction.customId === 'translate_post') {
            // Le decimos a Discord "Espérame, estoy procesando el clic"
            await interaction.deferUpdate(); 

            try {
                // Sacamos el texto original del Embed al que le hicieron clic
                const originalEmbed = interaction.message.embeds[0];
                if (!originalEmbed || !originalEmbed.description) return;

                // Le quitamos el "> " que le pusimos para citar
                const originalText = originalEmbed.description.replace(/^> /, '');

                // Hacemos una petición "ninja" a la API gratuita de Google Translate
                const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(originalText)}`;
                const response = await axios.get(translateUrl);
                
                // Armamos el texto traducido que nos devuelve Google
                const translatedText = response.data[0].map(item => item[0]).join('');

                // Reconstruimos el Embed pero con el texto en español
                const updatedEmbed = EmbedBuilder.from(originalEmbed)
                    .setDescription(`> ${translatedText}\n\n*(Traducido por Google)*`);

                // Desactivamos el botón y lo ponemos en verde para mostrar éxito
                const disabledButtonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('translate_done')
                        .setLabel('Traducido')
                        .setEmoji('✅')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)
                );

                // Actualizamos el mensaje original con el nuevo Embed y el botón verde
                await interaction.editReply({ 
                    embeds: [updatedEmbed], 
                    components: [disabledButtonRow] 
                });

            } catch (error) {
                console.error("Error al traducir:", error.message);
                // Si falla, le mandamos un mensaje invisible solo al usuario que dio clic
                await interaction.followUp({ 
                    content: "Hubo un error al intentar traducir el texto. Intenta de nuevo más tarde.", 
                    ephemeral: true 
                });
            }
        }
    }

});



// Escuchar cada mensaje que se envía
client.on('messageCreate', async message => {
    // Si el mensaje lo envió un bot, lo ignoramos
    if (message.author.bot) return;

    const content = message.content;
    let linksToFix = [];

    // --- SISTEMA CLÁSICO: !togif ---
    if (content.toLowerCase() === '!togif') {
        let videoAttachment = null;
        const processingMsg = await message.reply("Buscando video...");

        // CASO 1: El usuario le dio "Responder" a un mensaje
        if (message.reference && message.reference.messageId) {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            videoAttachment = repliedMessage.attachments.find(att => att.contentType && att.contentType.startsWith('video/'));
        } 
        // CASO 2: El usuario solo escribió !togif (Buscamos en los últimos 20 mensajes)
        else {
            const recentMessages = await message.channel.messages.fetch({ limit: 20 });
            // Buscamos el primer mensaje que contenga un video
            const msgWithVideo = recentMessages.find(msg => 
                msg.attachments.some(att => att.contentType && att.contentType.startsWith('video/'))
            );
            
            if (msgWithVideo) {
                videoAttachment = msgWithVideo.attachments.find(att => att.contentType && att.contentType.startsWith('video/'));
            }
        }

        // Si después de buscar en ambos casos no hay video, cancelamos
        if (!videoAttachment) {
            return processingMsg.edit("No video adjunto valido.");
        }

        const inputPath = path.join(__dirname, `input_pref_${Date.now()}_${videoAttachment.name}`);
        const outputPath = path.join(__dirname, `aurora_pref_${Date.now()}.gif`);

        try {
            await processingMsg.edit("Extrayendo");

            // 1. Descargamos el video
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

            // 2. MAGIA DE FFMPEG
            const ffmpegCmd = `ffmpeg -i "${inputPath}" -vf "fps=15,scale=500:-1:flags=lanczos" -c:v gif "${outputPath}" -y`;
            
            await new Promise((resolve, reject) => {
                exec(ffmpegCmd, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            // 3. Revisión de peso
            const stats = fs.statSync(outputPath);
            const fileSizeInMB = stats.size / (1024 * 1024);

            if (fileSizeInMB <= 8) {
                const finalAttachment = new AttachmentBuilder(outputPath);
                await processingMsg.edit({ 
                    content: "Gif Generado", 
                    files: [finalAttachment] 
                });
            } else {
                await processingMsg.edit("Subiendo a servidor temporal...");
                
                const form = new FormData();
                form.append('reqtype', 'fileupload');
                form.append('time', '24h');
                form.append('fileToUpload', fs.createReadStream(outputPath));

                const uploadRes = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                    headers: form.getHeaders(),
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                });

                await processingMsg.edit(`GIF muy pesado, descargalo:\n${uploadRes.data}`);
            }

        } catch (error) {
            console.error("Error al crear GIF con !togif:", error);
            await processingMsg.edit("Ocurrió un error.");
        } finally {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
        
        // Ponemos un return aquí para que el bot no intente buscar enlaces de redes sociales en el texto "!togif"
        return; 
    }

    // --- MÓDULO UNIVERSAL: TIKTOK, X, INSTAGRAM ---
    const socialRegex = /https?:\/\/(?:www\.)?(?:vm\.|vt\.|v\.)?(?:tiktok\.com|twitter\.com|x\.com|instagram\.com)\/[^\s]+/gi;
    const socialMatches = content.match(socialRegex);

    if (socialMatches) {
        // Para no saturar el bot, procesamos solo el primer enlace que encuentre en el mensaje
        const link = socialMatches[0];
        const processingMsg = await message.reply("Espere...");
        let actualFilePath = null;

        try {
            // 1. VARIABLES BASE
            let embedColor = '#2F3136'; 
            let platformName = 'Red Social';
            let postText = 'Sin descripción';
            let authorName = 'Usuario desconocido';
            let authorAvatar = null;
            let thumbnailUrl = null;
            let hasVideoToDownload = true;
            let isTwitterGif = false; // Variable para detectar si es un GIF

            // Preparamos el link convertido (fallback) por si lo necesitamos para GIFs o Videos Pesados
            let fallbackLink = link;
            if (link.includes('tiktok.com')) fallbackLink = link.replace(/(?:www\.)?(?:vm\.|vt\.|v\.)?tiktok\.com/gi, 'tnktok.com');
            else if (link.includes('twitter.com') || link.includes('x.com')) fallbackLink = link.replace(/(?:www\.)?(twitter|x)\.com/gi, 'vxtwitter.com');
            else if (link.includes('instagram.com')) fallbackLink = link.replace(/(?:www\.)?instagram\.com/gi, 'vxinstagram.com');

            // 2. EXTRACCIÓN A LA VELOCIDAD DE LA LUZ (Bypass para Twitter/X)
            if (link.includes('twitter.com') || link.includes('x.com')) {
                embedColor = '#1DA1F2'; 
                platformName = 'X (Twitter)';
                
                const apiUrl = link.replace(/(?:www\.)?(?:twitter|x)\.com/gi, 'api.vxtwitter.com').split('?')[0];
                const res = await axios.get(apiUrl);
                const data = res.data;

                postText = data.text || postText;
                authorName = `${data.user_name} (@${data.user_screen_name})`;
                authorAvatar = data.user_profile_image_url;

                const media = data.media_extended || [];
                const videoMedia = media.find(m => m.type === 'video' || m.type === 'gif');

                if (videoMedia && videoMedia.type === 'gif') {
                    // ¡Es un GIF!
                    isTwitterGif = true;
                    hasVideoToDownload = false;
                } else if (!videoMedia && media.length > 0) {
                    // ¡Es solo una imagen estática!
                    hasVideoToDownload = false; 
                    thumbnailUrl = media[0].url; 
                } else if (!videoMedia && media.length === 0) {
                    // ¡Es solo texto!
                    hasVideoToDownload = false;
                }
            } else {
                // Para TikTok e Instagram, yt-dlp sigue extrayendo metadatos
                const metadata = await youtubedl(link, { dumpJson: true, noWarnings: true });
                postText = metadata.title || metadata.description || postText;
                authorName = metadata.uploader || metadata.creator || authorName;
                thumbnailUrl = metadata.thumbnail;

                if (link.includes('tiktok.com')) {
                    embedColor = '#000000'; platformName = 'TikTok';
                } else if (link.includes('instagram.com')) {
                    embedColor = '#E1306C'; platformName = 'Instagram';
                }
            }

            // 3. ARMAMOS EL EMBED DE ALTA CALIDAD (Para fotos/textos o videos ligeros)
            const socialEmbed = new EmbedBuilder()
                .setColor(embedColor)
                .setAuthor({ 
                    name: `👤 ${authorName} en ${platformName}`, 
                    iconURL: authorAvatar || undefined 
                })
                .setDescription(`> ${postText.substring(0, 4000)}`) 
                .setFooter({ text: 'Project Aurora ✨' });

            if (thumbnailUrl) socialEmbed.setImage(thumbnailUrl);

            // CREAMOS EL BOTÓN DE TRADUCCIÓN
            const translateRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('translate_post')
                    .setLabel('Traducir')
                    .setStyle(ButtonStyle.Secondary)
            );

            // 4. EVALUACIÓN RÁPIDA: ¿Modo Revista, GIF o Video?
            if (!hasVideoToDownload) {
                if (isTwitterGif) {
                    // MODO GIF: Solo el link de vxtwitter, sin nada más
                    await processingMsg.edit({ content: fallbackLink, embeds: [], components: [] });
                } else {
                    // MODO REVISTA: (Solo foto o texto) Mandamos el Embed de Aurora
                    await processingMsg.edit({ content: ` `, embeds: [socialEmbed], components: [translateRow] });
                }
                // Ocultamos el link del usuario con un pequeño retraso
                setTimeout(() => message.suppressEmbeds(true).catch(() => {}), 1500); 
                return; // ¡TERMINAMOS AQUÍ!
            }

            // 5. MODO VIDEO: Si llegamos aquí, sí hay video. Lo descargamos.
            const baseName = `aurora_social_${Date.now()}`;
            const outputTemplate = path.join(__dirname, `${baseName}.%(ext)s`);

            await youtubedl(link, {
                output: outputTemplate,
                noWarnings: true
            });

            const files = fs.readdirSync(__dirname);
            const downloadedFileName = files.find(file => file.startsWith(baseName));

            if (!downloadedFileName) throw new Error("Video no encontrado tras descarga.");

            actualFilePath = path.join(__dirname, downloadedFileName);
            const stats = fs.statSync(actualFilePath);
            const fileSizeInMB = stats.size / (1024 * 1024);

            if (fileSizeInMB <= 8) {
                socialEmbed.setImage(null);

                const attachment = new AttachmentBuilder(actualFilePath);
                await processingMsg.edit({
                    content: ` `,
                    embeds: [socialEmbed],
                    files: [attachment],
                    components: [translateRow] 
                });
                await message.suppressEmbeds(true);
            } else {
                // MODO VIDEO PESADO: Mandamos el link convertido + link de Litterbox (Sin Embed)
                const form = new FormData();
                form.append('reqtype', 'fileupload');
                form.append('time', '24h');
                form.append('fileToUpload', fs.createReadStream(actualFilePath));

                const response = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                    headers: form.getHeaders(),
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                });

                const litterboxUrl = response.data;

                await processingMsg.edit({
                    content: `${fallbackLink}\n\n📥 **Descargar original:** ${litterboxUrl}`,
                    embeds: [],
                    components: []
                });
                
                // Retraso para que Discord alcance a leer el fallbackLink antes de ocultar el original
                setTimeout(() => message.suppressEmbeds(true).catch(() => {}), 1500);
            }

        } catch (error) {
            console.error(`Error crítico en módulo universal (${link}):`, error.message);
            await processingMsg.edit("No se pudo extraer el contenido.").catch(() => { });
            setTimeout(() => processingMsg.delete().catch(() => { }), 3000); 
        } finally {
            if (actualFilePath && fs.existsSync(actualFilePath)) {
                fs.unlinkSync(actualFilePath);
            }
        } 
    }

    // --- MÓDULO DE EXTRACCIÓN: FACEBOOK ---
    const fbRegex = /https?:\/\/(?:www\.)?facebook\.com\/[^\s]+/gi;
    const fbMatches = content.match(fbRegex);

    if (fbMatches) {
        const fbLink = fbMatches[0].split('?')[0];

        // VALIDACIÓN: Si es un post (/p/), una foto o algo privado, IGNORAMOS COMPLETAMENTE.
        // Solo dejamos pasar Reels (/r/), Videos (/v/) o enlaces de Watch.
        const isDownloadable = fbLink.includes('/reels/') ||
            fbLink.includes('/share/v/') ||
            fbLink.includes('/share/r/') ||
            fbLink.includes('/watch/') ||
            fbLink.includes('video.php');

        if (!isDownloadable) return; // Si no es un video claro, Aurora no hace nada.

        const processingMsg = await message.reply("Procesando video...");
        const fileName = `aurora_fb_${Date.now()}.mp4`;
        const filePath = path.join(__dirname, fileName);

        try {
            await youtubedl(fbLink, {
                output: filePath,
                format: 'w',

            });

            const stats = fs.statSync(filePath);
            const fileSizeInMB = stats.size / (1024 * 1024);

            if (fileSizeInMB <= 8) {
                const attachment = new AttachmentBuilder(filePath);
                await processingMsg.edit({
                    content: ` `,
                    files: [attachment]
                });
                await message.suppressEmbeds(true);
            } else {
                //Es pesado. Subir a Litterbox
                await processingMsg.edit("** Archivo mayor a 8MB. Subiendo a servidor temporal...");

                const form = new FormData();
                form.append('reqtype', 'fileupload');
                form.append('time', '24h'); // El video se autodestruirá en 24 horas
                form.append('fileToUpload', fs.createReadStream(filePath));


                const response = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                    headers: form.getHeaders(),
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                });

                const litterboxUrl = response.data;
                await processingMsg.edit(`Archivo pesado extraído:\n${litterboxUrl}`);
                await message.suppressEmbeds(true);
            }

        } catch (error) {
            // Si falla a pesar de ser un video (por ser privado), borramos el mensaje de "Procesando"
            console.error("Error:", error.message);
            await processingMsg.delete().catch(() => { });
        } finally {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    }

    // --- MÓDULO DE EXTRACCIÓN: PINTEREST ---
    const pinRegex = /https?:\/\/(?:[a-z0-9-]+\.)*(?:pinterest\.[a-z.]+\/pin\/|pin\.it\/)[^\s]+/gi;
    const pinMatches = content.match(pinRegex);

    if (pinMatches) {
        const pinLink = pinMatches[0].split('?')[0];
        const processingMsg = await message.reply("Extrayendo Pin...");

        // 1. Creamos un nombre base ÚNICO, sin extensión
        const baseName = `aurora_pin_${Date.now()}`;
        // 2. Le decimos a yt-dlp que use el nombre base y le ponga la extensión real del archivo
        const outputTemplate = path.join(__dirname, `${baseName}.%(ext)s`);

        let actualFilePath = null; // Variable para guardar la ruta real y poder borrarla al final

        try {
            // 3. Descargamos totalmente libres, sin formato
            await youtubedl(pinLink, {
                output: outputTemplate,

                mergeOutputFormat: 'mp4',
                noWarnings: true
            });

            // 4. EL TRUCO: Escaneamos la carpeta actual buscando el archivo que acabamos de crear
            const files = fs.readdirSync(__dirname);
            const downloadedFileName = files.find(file => file.startsWith(baseName));

            if (!downloadedFileName) throw new Error("Archivo no generado");

            // 5. ¡Lo atrapamos! Armamos la ruta real
            actualFilePath = path.join(__dirname, downloadedFileName);

            const stats = fs.statSync(actualFilePath);
            const fileSizeInMB = stats.size / (1024 * 1024);

            if (fileSizeInMB <= 8) {
                const attachment = new AttachmentBuilder(actualFilePath);
                await processingMsg.edit({
                    content: `📌`,
                    files: [attachment]
                });
                await message.suppressEmbeds(true);
            } else {
                await processingMsg.edit("Pin pesado. Subiendo a servidor temporal...");

                const form = new FormData();
                form.append('reqtype', 'fileupload');
                form.append('time', '24h');
                form.append('fileToUpload', fs.createReadStream(actualFilePath));

                const response = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                    headers: form.getHeaders(),
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                });

                const litterboxUrl = response.data;
                await processingMsg.edit(`📌 Pin extraído (Expira en 24h):\n${litterboxUrl}`);
                await message.suppressEmbeds(true);
            }

        } catch (error) {
            // EL PLAN B: Rescate de imágenes estáticas
            console.log("yt-dlp falló (probablemente sea imagen).");
            try {
                // 1. Nos disfrazamos de navegador real para engañar a Pinterest
                const pageResponse = await axios.get(pinLink, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                    }
                });

                // 2. FUERZA BRUTA: Buscamos cualquier enlace directo a imágenes de Pinterest en alta calidad (originals o 736x)
                const imageRegex = /https:\/\/i\.pinimg\.com\/(?:originals|736x|564x)\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9a-f]+\.(?:jpg|png|webp)/i;
                const imageMatch = pageResponse.data.match(imageRegex);

                if (imageMatch && imageMatch[0]) {
                    const imageUrl = imageMatch[0];
                    console.log("¡Imagen encontrada en el código fuente! ->", imageUrl);

                    await processingMsg.edit({
                        content: `📌`,
                        files: [imageUrl]
                    });
                    await message.suppressEmbeds(true);
                } else {
                    console.log("❌ Axios descargó la página, pero no encontró enlaces de imágenes válidos.");
                    await processingMsg.delete().catch(() => { });
                }
            } catch (fallbackError) {
                console.error("❌ Fallo total en la conexión de Axios:", fallbackError.message);
                await processingMsg.delete().catch(() => { });
            }
        } finally {
            if (actualFilePath && fs.existsSync(actualFilePath)) {
                fs.unlinkSync(actualFilePath);
            }
        }
    }

});

// Iniciar sesión con el token oculto
client.login(process.env.DISCORD_TOKEN);