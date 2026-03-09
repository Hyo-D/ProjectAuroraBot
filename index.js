require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
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
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'aurora') {
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
            await processingMsg.delete().catch(() => {}); 
        } finally {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    }

   // --- MÓDULO DE EXTRACCIÓN: PINTEREST ---
    const pinRegex = /https?:\/\/(?:www\.)?(?:pinterest\.[a-z]+\/pin\/|pin\.it\/)[^\s]+/gi;
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
                    await processingMsg.delete().catch(() => {});
                }
            } catch (fallbackError) {
                console.error("❌ Fallo total en la conexión de Axios:", fallbackError.message);
                await processingMsg.delete().catch(() => {});
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