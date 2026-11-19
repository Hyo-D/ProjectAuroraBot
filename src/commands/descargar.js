const {
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    ApplicationIntegrationType,
    InteractionContextType,
    MessageFlags
} = require('discord.js');
const fs = require('fs');
const { downloadAndPrepareSocialVideo } = require('../services/videoService');

const supportedRegex = /https?:\/\/(?:[a-z0-9-]+\.)*(?:tiktok\.com|twitter\.com|x\.com|fxtwitter\.com|vxtwitter\.com|instagram\.com|vxinstagram\.com|facebook\.com|pinterest\.[a-z.]+|pin\.it)\/[^\s]+/i;

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Descargar')
        .setType(ApplicationCommandType.Message)
        // Dónde se puede instalar: en servidores y en cuentas de usuario
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        // Dónde aparece: servidores, DM con el bot y DMs/grupos privados
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ),

    async execute(interaction) {
        // Efímero: solo lo ve quien lo usó (cámbialo si quieres que lo vea el otro usuario)
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const target = interaction.targetMessage;

        // Buscar el link en el contenido y, si no hay, en los embeds
        let link = target.content?.match(supportedRegex)?.[0];
        if (!link) {
            const embedUrl = target.embeds?.find(e => e.url && supportedRegex.test(e.url))?.url;
            if (embedUrl) link = embedUrl;
        }

        if (!link) {
            return interaction.editReply("No encontré ningún enlace compatible (TikTok, X, Instagram, Facebook o Pinterest) en este mensaje.");
        }

        link = link.replace(/[.,;!?)]+$/, '');

        let pathToClean = null;
        try {
            await interaction.editReply("📥 Extrayendo y descargando el archivo multimedia...");
            const result = await downloadAndPrepareSocialVideo(link);
            pathToClean = result.actualFilePath;
            await interaction.editReply(result.payload);
        } catch (error) {
            console.error("[Error /Descargar]:", error.message);
            await interaction.editReply("No pude descargar el contenido de ese enlace.");
        } finally {
            if (pathToClean && fs.existsSync(pathToClean)) {
                try { fs.unlinkSync(pathToClean); } catch {}
            }
        }
    },
};