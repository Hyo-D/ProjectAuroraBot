require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs'); // Para leer archivos y ver su peso
const path = require('path'); // Para manejar las rutas de los archivos
const youtubedl = require('youtube-dl-exec'); // El extractor pesado
const axios = require('axios'); // Para subir a Litterbox
const FormData = require('form-data'); // Para empaquetar el archivo al subirlo

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

// Escuchar cada mensaje que se envía
client.on('messageCreate', async message => {
    // Si el mensaje lo envió un bot, lo ignoramos
    if (message.author.bot) return;

    const content = message.content;
    let linksToFix = [];

    // --- MÓDULO RÁPIDO: TIKTOK, X, INSTAGRAM ---
    const tiktokRegex = /https?:\/\/(?:www\.)?(?:vm\.)?tiktok\.com\/[^\s]+/gi;
    const twitterRegex = /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s]+/gi;
    const instaRegex = /https?:\/\/(?:www\.)?instagram\.com\/[^\s]+/gi;

    // 1. TikTok -> tnktok.com
    const tiktokMatches = content.match(tiktokRegex);
    if (tiktokMatches) {
        tiktokMatches.forEach(link => {
            linksToFix.push(link.replace(/tiktok\.com/gi, 'tnktok.com'));
        });
    }

    // 2. Twitter/X -> vxtwitter.com
    const twitterMatches = content.match(twitterRegex);
    if (twitterMatches) {
        twitterMatches.forEach(link => {
            linksToFix.push(link.replace(/(twitter|x)\.com/gi, 'vxtwitter.com'));
        });
    }

    // 3. Instagram -> vxinstagram.com
    const instaMatches = content.match(instaRegex);
    if (instaMatches) {
        instaMatches.forEach(link => {
            const cleanLink = link.split('?')[0];
            linksToFix.push(cleanLink.replace(/instagram\.com/gi, 'vxinstagram.com'));
        });
    }

    // Si encontramos al menos un link rápido para arreglar, lo enviamos de inmediato
    if (linksToFix.length > 0) {
        try {
            await message.suppressEmbeds(true);
            const finalLinks = linksToFix.join('\n');
            await message.reply({ 
                content: finalLinks, 
                allowedMentions: { repliedUser: false } 
            });
        } catch (error) {
            console.error('Error al procesar los mensajes rápidos:', error);
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
                output: `"${filePath}"`, 
                format: 'w', 
            });

            const stats = fs.statSync(filePath);
            const fileSizeInMB = stats.size / (1024 * 1024);

            if (fileSizeInMB <= 8) {
                const attachment = new AttachmentBuilder(filePath);
                await processingMsg.edit({ 
                    content: `Extraído por **${message.author.username}**:`, 
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
                await processingMsg.edit(`Archivo pesado extraído por **${message.author.username}**:\n${litterboxUrl}`);
                await message.suppressEmbeds(true);
            }

        } catch (error) {
            // Si falla a pesar de ser un video (por ser privado), borramos el mensaje de "Procesando"
            console.error("Error:", error.message);
            await processingMsg.delete().catch(() => {}); 
        } finally {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    }
    });

// Iniciar sesión con el token oculto
client.login(process.env.DISCORD_TOKEN);