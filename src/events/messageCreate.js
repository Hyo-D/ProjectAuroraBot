const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { exec } = require('child_process');
const { create } = require('youtube-dl-exec');
const youtubedl = create('/usr/local/bin/yt-dlp');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;

        const content = message.content;

        // --------------------------------------------------
        // 1. SISTEMA CLÁSICO: !togif
        // --------------------------------------------------
        if (content.toLowerCase() === '!togif') {
            let videoUrl = null;
            const processingMsg = await message.reply("Analizando solicitud...");

            if (message.reference && message.reference.messageId) {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                const attachment = repliedMessage.attachments.find(att => att.contentType && att.contentType.startsWith('video/'));
                if (attachment) videoUrl = attachment.url;

                if (!videoUrl) {
                    const urlMatch = repliedMessage.content.match(/https?:\/\/[^\s]+/);
                    if (urlMatch) videoUrl = urlMatch[0];
                }
            } else {
                const recentMessages = await message.channel.messages.fetch({ limit: 20 });
                for (const msg of recentMessages.values()) {
                    const attachment = msg.attachments.find(att => att.contentType && att.contentType.startsWith('video/'));
                    if (attachment) {
                        videoUrl = attachment.url;
                        break;
                    }
                    const urlMatch = msg.content.match(/https?:\/\/[^\s]+/);
                    if (urlMatch) {
                        videoUrl = urlMatch[0];
                        break;
                    }
                }
            }

            if (!videoUrl) {
                return processingMsg.edit("Error: No se encontró ningún archivo de video o enlace válido en el contexto actual.");
            }

            const inputPath = path.join(__dirname, `input_pref_${Date.now()}_video.mp4`);
            const outputPath = path.join(__dirname, `aurora_pref_${Date.now()}.gif`);

            try {
                await processingMsg.edit("Descargando archivo multimedia...");

                if (videoUrl.includes('discordapp.com') || videoUrl.includes('discord.net')) {
                    const response = await axios({ method: 'GET', url: videoUrl, responseType: 'stream' });
                    const writer = fs.createWriteStream(inputPath);
                    response.data.pipe(writer);
                    await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });
                } else {
                    await youtubedl(videoUrl, { output: inputPath, format: 'w', noWarnings: true });
                }

                await processingMsg.edit("Procesando fotogramas y optimizando formato...");

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
                    await processingMsg.edit({
                        content: "Conversión finalizada.",
                        files: [finalAttachment]
                    });
                } else {
                    await processingMsg.edit("El archivo resultante excede el límite de 8MB. Transfiriendo a servidor temporal...");

                    const form = new FormData();
                    form.append('reqtype', 'fileupload');
                    form.append('time', '24h');
                    form.append('fileToUpload', fs.createReadStream(outputPath));

                    const uploadRes = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                        headers: form.getHeaders(),
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity
                    });

                    await processingMsg.edit(`El archivo generado es demasiado pesado para ser adjuntado. Enlace de descarga disponible:\n${uploadRes.data}`);
                }

            } catch (error) {
                console.error("[Error !togif]:", error.message);
                await processingMsg.edit("Ocurrió un error interno al intentar procesar el archivo multimedia.");
            } finally {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            }

            return;
        }

       // --------------------------------------------------
        // 2. MÓDULO UNIVERSAL: TIKTOK, X, INSTAGRAM (Botón Dinámico)
        // --------------------------------------------------
        const socialRegex = /https?:\/\/(?:www\.)?(?:vm\.|vt\.|v\.)?(?:tiktok\.com|twitter\.com|x\.com|instagram\.com)\/[^\s]+/gi;
        const socialMatches = content.match(socialRegex);

        if (socialMatches) {
            const link = socialMatches[0];
            const processingMsg = await message.reply("Analizando contenido...");

            try {
                const buttons = [];
                let isTwitter = link.includes('twitter.com') || link.includes('x.com');
                let isTikTok = link.includes('tiktok.com');
                let isInstagram = link.includes('instagram.com');

                // 1. CASO DE X / TWITTER
                if (isTwitter) {
                    const fallbackLink = link.replace(/(?:www\.)?(twitter|x)\.com/gi, 'fxtwitter.com');
                    let hasVideo = false;

                    try {
                        // Consulta rápida a la API de fxTwitter para verificar multimedia
                        const apiUrl = link.replace(/(?:www\.)?(?:twitter|x)\.com/gi, 'api.fxtwitter.com').split('?')[0];
                        const res = await axios.get(apiUrl);
                        const tweetData = res.data.tweet || res.data;

                        if (tweetData) {
                            const media = tweetData.media?.all || [];
                            // Verificamos si hay algún elemento tipo video o gif
                            hasVideo = media.some(m => m.type === 'video' || m.type === 'gif');
                        }
                    } catch (apiError) {
                        console.error("[Aviso] Falló la API de fxTwitter al comprobar video:", apiError.message);
                        // Fallback seguro: si la API falla, asumimos que podría ser video para no romper el flujo
                        hasVideo = true; 
                    }

                    buttons.push(
                        new ButtonBuilder()
                            .setCustomId(`translate_fx|${link}`)
                            .setLabel('Traducir')
                            .setStyle(ButtonStyle.Secondary)
                    );

                    if (hasVideo) {
                        buttons.push(
                            new ButtonBuilder()
                                .setCustomId('download_social_content')
                                .setLabel('Descargar')
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji('📥')
                        );
                    }

                    const actionRow = new ActionRowBuilder().addComponents(buttons);
                    await processingMsg.edit({ content: fallbackLink, components: [actionRow] });
                }

                // 2. CASOS DE TIKTOK E INSTAGRAM
                if (isTikTok || isInstagram) {
                    let fallbackLink = link;
                    if (isTikTok) fallbackLink = link.replace(/(?:www\.)?(?:vm\.|vt\.|v\.)?tiktok\.com/gi, 'tnktok.com');
                    else if (isInstagram) fallbackLink = link.replace(/(?:www\.)?instagram\.com/gi, 'vxinstagram.com');

                    // Obtenemos los metadatos JSON rápidamente a través de yt-dlp
                    const metadata = await youtubedl(link, { dumpJson: true, noWarnings: true });
                    
                    // yt-dlp define de forma clara si tiene codecs de video asignados o una duración real
                    const hasVideo = metadata.duration > 0 || (metadata.vcodec && metadata.vcodec !== 'none');

                    if (hasVideo) {
                        buttons.push(
                            new ButtonBuilder()
                                .setCustomId('download_social_content')
                                .setLabel('Descargar')
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji('📥')
                        );
                    }

                    // Si es Instagram, seguimos usando tu estructura de Embed tradicional
                    if (isInstagram) {
                        const socialEmbed = new EmbedBuilder()
                            .setColor('#E1306C')
                            .setAuthor({ name: `${metadata.uploader || metadata.creator || 'Usuario'} en Instagram` })
                            .setURL(fallbackLink)
                            .setDescription(`> ${(metadata.title || metadata.description || 'Sin descripción').substring(0, 4000)}`)
                            .setFooter({ text: 'Project Aurora' });

                        if (metadata.thumbnail) socialEmbed.setImage(metadata.thumbnail);

                        if (buttons.length > 0) {
                            const actionRow = new ActionRowBuilder().addComponents(buttons);
                            await processingMsg.edit({ content: ` `, embeds: [socialEmbed], components: [actionRow] });
                        } else {
                            await processingMsg.edit({ content: ` `, embeds: [socialEmbed], components: [] }); // Sin botones si es solo foto
                        }
                    } 
                    // Si es TikTok, enviamos el enlace limpio de tiktxk
                    else if (isTikTok) {
                        if (buttons.length > 0) {
                            const actionRow = new ActionRowBuilder().addComponents(buttons);
                            await processingMsg.edit({ content: fallbackLink, components: [actionRow] });
                        } else {
                            await processingMsg.edit({ content: fallbackLink, components: [] }); // Sin botones si es una galería de fotos estática
                        }
                    }
                }

                // Ocultar previsualización original del usuario
                setTimeout(() => message.suppressEmbeds(true).catch(() => { }), 1500);
                return;

            } catch (error) {
                console.error(`[Error Comprobación Multimedia] ${link}:`, error.message);
                await processingMsg.edit("Fallo al verificar el contenido del enlace provisto.").catch(() => { });
                setTimeout(() => processingMsg.delete().catch(() => { }), 3000);
            }
        }

        // --------------------------------------------------
        // 3. MÓDULO DE EXTRACCIÓN: FACEBOOK
        // --------------------------------------------------
        const fbRegex = /https?:\/\/(?:www\.)?facebook\.com\/[^\s]+/gi;
        const fbMatches = content.match(fbRegex);

        if (fbMatches) {
            // Limpiamos puntuación accidental al final del enlace, pero conservamos los parámetros query
            let fbLink = fbMatches[0].replace(/[.,;!?]$/, '');

            const isDownloadable = fbLink.includes('/reels/') ||
                fbLink.includes('/share/v/') ||
                fbLink.includes('/share/r/') ||
                fbLink.includes('/watch/') ||
                fbLink.includes('video.php');

            if (!isDownloadable) return;

            // Si es un enlace de Watch, validamos estrictamente que contenga un ID de video
            if (fbLink.includes('/watch/') && !fbLink.includes('?v=')) {
                return; // Ignoramos silenciosamente si es la página principal de Watch sin video
            }

            const processingMsg = await message.reply("Procesando enlace de Facebook...");
            const fileName = `aurora_fb_${Date.now()}.mp4`;
            const filePath = path.join(__dirname, fileName);

            try {
                await youtubedl(fbLink, { output: filePath, format: 'w' });

                const stats = fs.statSync(filePath);
                const fileSizeInMB = stats.size / (1024 * 1024);

                if (fileSizeInMB <= 8) {
                    const attachment = new AttachmentBuilder(filePath);
                    await processingMsg.edit({ content: ` `, files: [attachment] });
                    await message.suppressEmbeds(true).catch(() => {});
                } else {
                    await processingMsg.edit("El archivo excede los 8MB. Transfiriendo a servidor temporal...");
                    const form = new FormData();
                    form.append('reqtype', 'fileupload');
                    form.append('time', '24h');
                    form.append('fileToUpload', fs.createReadStream(filePath));

                    const response = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                        headers: form.getHeaders(),
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity
                    });

                    await processingMsg.edit(`Archivo extraído con éxito (Expira en 24h):\n${response.data}`);
                    await message.suppressEmbeds(true).catch(() => {});
                }
            } catch (error) {
                console.error("[Error Facebook]:", error.message);
                await processingMsg.delete().catch(() => { });
            } finally {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
        }

        // --------------------------------------------------
        // 4. MÓDULO DE EXTRACCIÓN: PINTEREST
        // --------------------------------------------------
        const pinRegex = /https?:\/\/(?:[a-z0-9-]+\.)*(?:pinterest\.[a-z.]+\/pin\/|pin\.it\/)[^\s]+/gi;
        const pinMatches = content.match(pinRegex);

        if (pinMatches) {
            const pinLink = pinMatches[0].split('?')[0];
            const processingMsg = await message.reply("Procesando enlace de Pinterest...");

            const baseName = `aurora_pin_${Date.now()}`;
            const outputTemplate = path.join(__dirname, `${baseName}.%(ext)s`);
            let actualFilePath = null;

            try {
                await youtubedl(pinLink, {
                    output: outputTemplate,
                    mergeOutputFormat: 'mp4',
                    noWarnings: true
                });

                const files = fs.readdirSync(__dirname);
                const downloadedFileName = files.find(file => file.startsWith(baseName));

                if (!downloadedFileName) throw new Error("Archivo no generado correctamente.");

                actualFilePath = path.join(__dirname, downloadedFileName);

                const stats = fs.statSync(actualFilePath);
                const fileSizeInMB = stats.size / (1024 * 1024);

                if (fileSizeInMB <= 8) {
                    const attachment = new AttachmentBuilder(actualFilePath);
                    await processingMsg.edit({ content: ` `, files: [attachment] });
                    await message.suppressEmbeds(true).catch(() => {});
                } else {
                    await processingMsg.edit("El archivo excede los 8MB. Transfiriendo a servidor temporal...");
                    const form = new FormData();
                    form.append('reqtype', 'fileupload');
                    form.append('time', '24h');
                    form.append('fileToUpload', fs.createReadStream(actualFilePath));

                    const response = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                        headers: form.getHeaders(),
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity
                    });

                    await processingMsg.edit(`Archivo extraído con éxito (Expira en 24h):\n${response.data}`);
                    await message.suppressEmbeds(true).catch(() => {});
                }

            } catch (error) {
                console.log("[Aviso Pinterest] Fallo en yt-dlp, intentando extracción de imagen estática.");
                try {
                    const pageResponse = await axios.get(pinLink, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                        }
                    });

                    const imageRegex = /https:\/\/i\.pinimg\.com\/(?:originals|736x|564x)\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9a-f]+\.(?:jpg|png|webp)/i;
                    const imageMatch = pageResponse.data.match(imageRegex);

                    if (imageMatch && imageMatch[0]) {
                        await processingMsg.edit({ content: ` `, files: [imageMatch[0]] });
                        await message.suppressEmbeds(true).catch(() => {});
                    } else {
                        console.log("[Error Pinterest] Axios no encontró enlaces de imágenes válidos.");
                        await processingMsg.delete().catch(() => { });
                    }
                } catch (fallbackError) {
                    console.error("[Error Fatal Pinterest]:", fallbackError.message);
                    await processingMsg.delete().catch(() => { });
                }
            } finally {
                if (actualFilePath && fs.existsSync(actualFilePath)) fs.unlinkSync(actualFilePath);
            }
        }
    }
};