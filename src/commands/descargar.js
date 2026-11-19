const {
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    ApplicationIntegrationType,
    InteractionContextType,
    MessageFlags
} = require('discord.js');
const fs = require('fs');
const { buildSocialReply } = require('../services/socialService');

const supportedRegex = /https?:\/\/(?:[a-z0-9-]+\.)*(?:tiktok\.com|twitter\.com|x\.com|fxtwitter\.com|vxtwitter\.com|instagram\.com|vxinstagram\.com|facebook\.com|pinterest\.[a-z.]+|pin\.it)\/[^\s]+/i;

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Procesar Enlace')
        .setType(ApplicationCommandType.Message)
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

    async execute(interaction) {
        // Público: así el resultado (embed + botones) lo ven ambos en el DM
        await interaction.deferReply();

        const target = interaction.targetMessage;
        let link = target.content?.match(supportedRegex)?.[0]
            || target.embeds?.find(e => e.url && supportedRegex.test(e.url))?.url;

        if (!link) {
            return interaction.editReply({
                content: "No encontré ningún enlace compatible en este mensaje.",
                flags: MessageFlags.Ephemeral
            });
        }

        // Si ya venía como fxtwitter/vxtwitter/etc., lo normalizamos al dominio original
        link = link
            .replace(/(?:fx|vx)twitter\.com/i, 'twitter.com')
            .replace(/vxinstagram\.com/i, 'instagram.com')
            .replace(/tnktok\.com/i, 'tiktok.com');

        let cleanupPath = null;
        try {
            const result = await buildSocialReply(link);
            if (!result) {
                return interaction.editReply("Ese enlace no tiene contenido que pueda procesar.");
            }
            cleanupPath = result.cleanupPath;
            await interaction.editReply(result.payload);
        } catch (error) {
            console.error("[Error Descargar]:", error.message);
            await interaction.editReply("No pude procesar el contenido de ese enlace.");
        } finally {
            if (cleanupPath && fs.existsSync(cleanupPath)) {
                try { fs.unlinkSync(cleanupPath); } catch {}
            }
        }
    },
};