const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const axios = require('axios');
const translationCache = new Map();
const fs = require('fs');

// Importamos el servicio que creamos (Ajusta la ruta si es necesario)
const { downloadAndPrepareSocialVideo } = require('../services/videoService');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {

        // --------------------------------------------------
        // 1. MANEJO DE SLASH COMMANDS
        // --------------------------------------------------
        if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`No se encontró ningún comando: ${interaction.commandName}.`);
                return;
            }
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error ejecutando ${interaction.commandName}`, error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Hubo un error al ejecutar este comando.', flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ content: 'Hubo un error al ejecutar este comando.', flags: MessageFlags.Ephemeral });
                }
            }
        }

        // --------------------------------------------------
        // 2. MANEJO DE BOTONES
        // --------------------------------------------------
        if (interaction.isButton()) {

            // --- BOTÓN: ALTERNAR ENTRE FXTWITTER <-> VXTWITTER ---
            if (interaction.customId === 'switch_embed_twitter') {
                await interaction.deferUpdate();

                try {
                    const currentContent = interaction.message.content;
                    const usingFx = currentContent.includes('fxtwitter.com');

                    // Cambiamos el dominio en el mensaje
                    const newContent = usingFx
                        ? currentContent.replace('fxtwitter.com', 'vxtwitter.com')
                        : currentContent.replace('vxtwitter.com', 'fxtwitter.com');

                    // Reconstruimos los botones: solo cambiamos el nuestro y conservamos los demás
                    const updatedComponents = interaction.message.components[0].components.map(button => {
                        if (button.customId === 'switch_embed_twitter') {
                            return new ButtonBuilder()
                                .setCustomId('switch_embed_twitter')
                                .setLabel(usingFx ? 'Usar fxtwitter' : 'Usar vxtwitter')
                                .setStyle(usingFx ? ButtonStyle.Primary : ButtonStyle.Secondary)
                                .setEmoji('🔄');
                        }
                        return ButtonBuilder.from(button);
                    });

                    await interaction.editReply({
                        content: newContent,
                        components: [new ActionRowBuilder().addComponents(updatedComponents)]
                    });

                } catch (error) {
                    console.error("Error al alternar el embed de Twitter:", error.message);
                    await interaction.followUp({ content: "No pude cambiar el enlace.", flags: MessageFlags.Ephemeral });
                }
                return;
            }

            // --- NUEVO TRADUCTOR BAJO DEMANDA PARA FXTWITTER ---
            if (interaction.customId.startsWith('translate_fx')) {
                // DeferReply efímero para que la traducción sea privada y no ensucie el canal
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                try {
                    // Recuperamos el enlace original que guardamos en el customId (ej: translate_fx|URL)
                    const [, originalLink] = interaction.customId.split('|');

                    // Hacemos la consulta a la API de fxtwitter solo si el usuario pidió traducir
                    const apiUrl = originalLink.replace(/(?:www\.)?(?:twitter|x)\.com/gi, 'api.fxtwitter.com').split('?')[0];
                    const res = await axios.get(apiUrl);
                    const tweetData = res.data.tweet || res.data;

                    if (!tweetData || !tweetData.text) {
                        return interaction.editReply("No pude extraer el texto de esta publicación para traducirlo.");
                    }

                    const originalText = tweetData.text;

                    // Traducir mediante la API de Google Translate
                    const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(originalText)}`;
                    const response = await axios.get(translateUrl);
                    const translatedText = response.data[0].map(item => item[0]).join('');

                    // Construimos un embed elegante y privado con el resultado
                    const translationEmbed = new EmbedBuilder()
                        .setColor('#1DA1F2')
                        .setAuthor({ name: `${tweetData.author?.name || 'Usuario'} (@${tweetData.author?.screen_name || ''})` })
                        .setTitle('Traducción de la publicación')
                        .setDescription(`> ${translatedText}\n\n*(Traducido automáticamente al español)*`)
                        .setFooter({ text: 'Project Aurora' });

                    await interaction.editReply({ embeds: [translationEmbed] });

                } catch (error) {
                    console.error("Error en traducción fxTwitter:", error.message);
                    await interaction.editReply("Hubo un error al intentar traducir el contenido de la publicación.");
                }
                return;
            }

            // --- NUEVO: BOTÓN DE DESCARGA ---
            if (interaction.customId === 'download_social_content') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                let finalPathToClean = null;

                try {
                    const originalEmbed = interaction.message.embeds[0];
                    const link = originalEmbed?.url || interaction.message.content.match(/https?:\/\/[^\s]+/)[0];

                    if (!link) {
                        return interaction.editReply("No pude encontrar el enlace original de esta publicación.");
                    }

                    await interaction.editReply("📥 Extrayendo y descargando el archivo multimedia...");

                    const cleanLink = link.replace(/(?:fx|vx)twitter\.com/gi, 'x.com');
                    const result = await downloadAndPrepareSocialVideo(cleanLink);
                    


                    // 1. Enviamos a Discord (Esto lee el disco)
                    await interaction.editReply(result.payload);

                    // 2. Guardamos la ruta para limpiarla después
                    finalPathToClean = result.actualFilePath;

                } catch (error) {
                    console.error("Error en botón de descarga:", error);
                    await interaction.editReply("Hubo un error al intentar descargar el contenido.");
                } finally {
                    // 3. LIMPIEZA SEGURA: Ahora sí borramos el archivo, una vez que Discord ya terminó de usarlo
                    if (finalPathToClean && fs.existsSync(finalPathToClean)) {
                        try {
                            fs.unlinkSync(finalPathToClean);
                        } catch (err) {
                            console.error(`No se pudo borrar el archivo residual ${finalPathToClean}`, err.message);
                        }
                    }
                }
                return;
            }

            // --- SISTEMA DE TRADUCCIÓN 
            if (interaction.customId === 'translate_post' || interaction.customId === 'untranslate_post') {
                await interaction.deferUpdate();

                try {
                    const originalEmbed = interaction.message.embeds[0];
                    if (!originalEmbed || !originalEmbed.description) return;

                    let updatedText = "";
                    let newButtonId = "";
                    let newButtonLabel = "";
                    let newButtonStyle = ButtonStyle.Secondary;

                    if (interaction.customId === 'translate_post') {
                        const originalText = originalEmbed.description.replace(/^> /, '');
                        if (!translationCache.has(interaction.message.id)) {
                            translationCache.set(interaction.message.id, originalText);
                        }

                        const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(originalText)}`;
                        const response = await axios.get(translateUrl);
                        const translatedText = response.data[0].map(item => item[0]).join('');

                        updatedText = `> ${translatedText}\n\n*(Traducido por Google)*`;
                        newButtonId = 'untranslate_post';
                        newButtonLabel = 'Ver Original';
                        newButtonStyle = ButtonStyle.Primary;
                    } else {
                        const originalText = translationCache.get(interaction.message.id) || "Error: Texto original no encontrado.";
                        updatedText = `> ${originalText}`;
                        newButtonId = 'translate_post';
                        newButtonLabel = 'Traducir';
                        newButtonStyle = ButtonStyle.Secondary;
                    }

                    const updatedEmbed = EmbedBuilder.from(originalEmbed).setDescription(updatedText);


                    const currentComponents = interaction.message.components[0].components;

                    const updatedComponents = currentComponents.map(button => {
                        // Si es el botón del traductor, lo actualizamos
                        if (button.customId === 'translate_post' || button.customId === 'untranslate_post') {
                            return new ButtonBuilder()
                                .setCustomId(newButtonId)
                                .setLabel(newButtonLabel)
                                .setStyle(newButtonStyle);
                        }

                        return ButtonBuilder.from(button);
                    });

                    const toggleButtonRow = new ActionRowBuilder().addComponents(updatedComponents);

                    await interaction.editReply({
                        embeds: [updatedEmbed],
                        components: [toggleButtonRow]
                    });

                    setTimeout(() => translationCache.delete(interaction.message.id), 86400000);

                } catch (error) {
                    console.error("Error al traducir/destraducir:", error.message);
                    await interaction.followUp({ content: "Hubo un error con la traducción.", flags: MessageFlags.Ephemeral });
                }
            }
        }
    },
};