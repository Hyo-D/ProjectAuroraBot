require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, EmbedBuilder } = require('discord.js');
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
    // Si la interacción no es un slash command, la ignoramos
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'aurora') {
        // 1. Calculamos el tiempo activo (Uptime)
        const totalSeconds = interaction.client.uptime / 1000;
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const uptime = `${days}d ${hours}h ${minutes}m`;

        // 2. Extraemos la cantidad de servidores
        const serverCount = interaction.client.guilds.cache.size.toString();

        // 3. Formateamos la fecha de creación (Usamos el formato nativo de Discord)
        const creationTimestamp = Math.floor(interaction.client.user.createdTimestamp / 1000);
        const creationDate = `<t:${creationTimestamp}:D>`; // Se mostrará traducido al idioma del usuario

        // 4. Construimos el Embed con tus campos exactos
        const infoEmbed = new EmbedBuilder()
            .setColor('#2F3136') 
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .addFields(
                { name: '🤖 Nombre del Bot', value: interaction.client.user.username, inline: true },
                { name: '👑 Dev', value: 'Hyo', inline: true },
                { name: '⏱️ Tiempo Activo', value: uptime, inline: true },
                { name: '📅 Fecha de Creación', value: creationDate, inline: true },
                { name: '🌍 Cantidad de Servidores', value: serverCount, inline: true }
            )
            .setFooter({ 
                text: `Solicitado por ${interaction.user.username}`, 
                iconURL: interaction.user.displayAvatarURL() 
            });

        // 5. Enviamos la respuesta
        await interaction.reply({ embeds: [infoEmbed] });
    }
});

client.on('interactionCreate', async interaction => {
    // Si la interacción no es un slash command, la ignoramos
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'aurora') {
        const days = Math.floor(interaction.client.uptime / 86400000);
        const hours = Math.floor(interaction.client.uptime / 3600000) % 24;
        const minutes = Math.floor(interaction.client.uptime / 60000) % 60;
        const uptime = `${days}d ${hours}h ${minutes}m`;

        const infoEmbed = new EmbedBuilder()
            .setTitle('✨ Project Aurora | Sistema en Línea')
            .setColor('#2F3136') 
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setDescription('Asistente multipropósito especializado en extracción multimedia nativa y utilidades de servidor.')
            .addFields(
                { name: '📊 Estado del Servidor', value: `📡 Ping: \`${interaction.client.ws.ping}ms\`\n⏱️ Tiempo activo: \`${uptime}\`\n📚 discord.js: \`v${version}\``, inline: false },
                { name: '👑 Dev', value: 'Hyo', inline: true },
                { name: '📍 Base de Operaciones', value: 'Navojoa, Sonora', inline: true },
                { name: '\u200B', value: '\u200B', inline: true }, 
                { name: '⚙️ Hardware de Pruebas', value: '`Ryzen 7 5700X3D` | `RTX 5070 Ti`', inline: true },
                { name: '🛠️ Stack Principal', value: '`Node.js` `Java` `Unity` `Arduino`', inline: true },
                )
            .setFooter({ 
                text: `Solicitado por ${interaction.user.username}`, 
                iconURL: interaction.user.displayAvatarURL() 
            })
            .setTimestamp();

        await interaction.reply({ embeds: [infoEmbed] });
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