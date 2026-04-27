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
        // 2. MÓDULO UNIVERSAL: TIKTOK, X, INSTAGRAM
        // --------------------------------------------------
        const socialRegex = /https?:\/\/(?:www\.)?(?:vm\.|vt\.|v\.)?(?:tiktok\.com|twitter\.com|x\.com|instagram\.com)\/[^\s]+/gi;
        const socialMatches = content.match(socialRegex);

        if (socialMatches) {
            const link = socialMatches[0];
            const processingMsg = await message.reply("Procesando enlace...");
            let actualFilePath = null;

            try {
                let embedColor = '#2F3136'; 
                let platformName = 'Red Social';
                let postText = 'Sin descripción';
                let authorName = 'Usuario desconocido';
                let authorAvatar = null;
                let thumbnailUrl = null;
                let hasVideoToDownload = true;
                let isTwitterGif = false; 

                let fallbackLink = link;
                if (link.includes('tiktok.com')) fallbackLink = link.replace(/(?:www\.)?(?:vm\.|vt\.|v\.)?tiktok\.com/gi, 'tnktok.com');
                else if (link.includes('twitter.com') || link.includes('x.com')) fallbackLink = link.replace(/(?:www\.)?(twitter|x)\.com/gi, 'vxtwitter.com');
                else if (link.includes('instagram.com')) fallbackLink = link.replace(/(?:www\.)?instagram\.com/gi, 'vxinstagram.com');

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
                        isTwitterGif = true;
                        hasVideoToDownload = false;
                    } else if (!videoMedia && media.length > 0) {
                        hasVideoToDownload = false; 
                        thumbnailUrl = media[0].url; 
                    } else if (!videoMedia && media.length === 0) {
                        hasVideoToDownload = false;
                    }
                } else {
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

                const socialEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setAuthor({ 
                        name: `${authorName} en ${platformName}`, 
                        iconURL: authorAvatar || undefined 
                    })
                    .setDescription(`> ${postText.substring(0, 4000)}`) 
                    .setFooter({ text: 'Project Aurora' });

                if (thumbnailUrl) socialEmbed.setImage(thumbnailUrl);

                const translateRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('translate_post')
                        .setLabel('Traducir')
                        .setStyle(ButtonStyle.Secondary)
                );

                if (!hasVideoToDownload) {
                    if (isTwitterGif) {
                        await processingMsg.edit({ content: fallbackLink, embeds: [], components: [] });
                    } else {
                        await processingMsg.edit({ content: ` `, embeds: [socialEmbed], components: [translateRow] });
                    }
                    setTimeout(() => message.suppressEmbeds(true).catch(() => {}), 1500); 
                    return; 
                }

                const baseName = `aurora_social_${Date.now()}`;
                const outputTemplate = path.join(__dirname, `${baseName}.%(ext)s`);

                await youtubedl(link, { output: outputTemplate, noWarnings: true });

                const files = fs.readdirSync(__dirname);
                const downloadedFileName = files.find(file => file.startsWith(baseName));

                if (!downloadedFileName) throw new Error("Error en la descarga del archivo de video.");

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
                    const form = new FormData();
                    form.append('reqtype', 'fileupload');
                    form.append('time', '24h');
                    form.append('fileToUpload', fs.createReadStream(actualFilePath));

                    const response = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', form, {
                        headers: form.getHeaders(),
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity
                    });

                    await processingMsg.edit({
                        content: `${fallbackLink}\n\nEnlace de descarga original:\n${response.data}`,
                        embeds: [],
                        components: []
                    });
                    
                    setTimeout(() => message.suppressEmbeds(true).catch(() => {}), 1500);
                }

            } catch (error) {
                console.error(`[Error Universal] ${link}:`, error.message);
                await processingMsg.edit("Fallo en la extracción del contenido provisto.").catch(() => { });
                setTimeout(() => processingMsg.delete().catch(() => { }), 3000); 
            } finally {
                if (actualFilePath && fs.existsSync(actualFilePath)) fs.unlinkSync(actualFilePath);
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
                    await message.suppressEmbeds(true);
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
                    await message.suppressEmbeds(true);
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
                    await message.suppressEmbeds(true);
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
                    await message.suppressEmbeds(true);
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
                        await message.suppressEmbeds(true);
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