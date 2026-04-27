const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios'); // Lo necesitamos para el traductor

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        
        // --------------------------------------------------
        // 1. MANEJO DE SLASH COMMANDS Y MENÚS DE CONTEXTO
        // --------------------------------------------------
        if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand()) {
            // Buscamos el comando en la "memoria" (Collection) que creamos en index.js
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No se encontró ningún comando que coincida con ${interaction.commandName}.`);
                return;
            }

            try {
                // Ejecutamos el archivo del comando correspondiente
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error ejecutando ${interaction.commandName}`);
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
                }
            }
        }

        // --------------------------------------------------
        // 2. MANEJO DE BOTONES (El Traductor)
        // --------------------------------------------------
        if (interaction.isButton()) {
            if (interaction.customId === 'translate_post') {
                await interaction.deferUpdate(); 

                try {
                    const originalEmbed = interaction.message.embeds[0];
                    if (!originalEmbed || !originalEmbed.description) return;

                    const originalText = originalEmbed.description.replace(/^> /, '');

                    // API de Google Translate
                    const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(originalText)}`;
                    const response = await axios.get(translateUrl);
                    
                    const translatedText = response.data[0].map(item => item[0]).join('');

                    const updatedEmbed = EmbedBuilder.from(originalEmbed)
                        .setDescription(`> ${translatedText}\n\n*(Traducido por Google)*`);

                    const disabledButtonRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('translate_done')
                            .setLabel('Traducido')
                            .setEmoji('✅')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(true)
                    );

                    await interaction.editReply({ 
                        embeds: [updatedEmbed], 
                        components: [disabledButtonRow] 
                    });

                } catch (error) {
                    console.error("Error al traducir:", error.message);
                    await interaction.followUp({ 
                        content: "Hubo un error al intentar traducir el texto. Intenta de nuevo más tarde.", 
                        ephemeral: true 
                    });
                }
            }
        }

    },
};