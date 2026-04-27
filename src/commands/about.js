const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('Muestra la información general del bot y del creador.'),
    async execute(interaction) {
        // 1. Cálculos del Bot
        const totalSeconds = interaction.client.uptime / 1000;
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const uptime = `${days}d ${hours}h ${minutes}m`;
        const serverCount = interaction.client.guilds.cache.size.toString();

        const botCreationTimestamp = Math.floor(interaction.client.user.createdTimestamp / 1000);
        const botCreationDate = `<t:${botCreationTimestamp}:D>`;

        // 2. Información Visual del Usuario
        const userAvatar = interaction.user.displayAvatarURL({ dynamic: true, size: 512 });

        // 3. GIF Personalizado
        const gifPersonalizadoUrl = 'https://media.discordapp.net/attachments/1454490078918217903/1454650610816126997/cd11a6b1bd039316e1139721a55e96ca.gif?ex=69b01fb3&is=69aece33&hm=7bbab78553b360fa4768b79b455db5e9cbfad02d64d5f58260cabdd33d6d9fc4&';

        // 4. CONSTRUCCIÓN DEL EMBED 
        const infoEmbed = new EmbedBuilder()
            .setColor('#2F3136')
            .setAuthor({
                name: `${interaction.user.username}`,
                iconURL: userAvatar
            })
            .setThumbnail(interaction.client.user.displayAvatarURL())
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

        // 5. CREACIÓN DE LOS BOTONES
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
                    .setDisabled(true)
            );

        // 6. ENVÍO DE RESPUESTA
        await interaction.reply({
            embeds: [infoEmbed],
            components: [buttonsRow]
        });
    },
};