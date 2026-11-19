const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { create } = require('youtube-dl-exec');
const youtubedl = create('/usr/local/bin/yt-dlp');
const { downloadAndPrepareSocialVideo } = require('./videoService');

const downloadButton = () => new ButtonBuilder()
    .setCustomId('download_social_content')
    .setLabel('Descargar')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('📥');

/**
 * Devuelve { payload, cleanupPath } listo para interaction.editReply().
 * Devuelve null si el enlace no es compatible.
 */
async function buildSocialReply(rawLink) {
    const link = rawLink.replace(/[.,;!?)]+$/, '');

    const isTwitter = /(?:twitter|x)\.com/i.test(link);
    const isTikTok = /tiktok\.com/i.test(link);
    const isInstagram = /instagram\.com/i.test(link);
    const isFacebook = /facebook\.com/i.test(link);
    const isPinterest = /pinterest\.[a-z.]+\/pin\/|pin\.it\//i.test(link);

    // ---------- X / TWITTER ----------
    if (isTwitter) {
        const cleanLink = link.split('?')[0]; // también evita pasar de 100 chars en customId
        const fallbackLink = cleanLink.replace(/(?:www\.)?(twitter|x)\.com/gi, 'fxtwitter.com');
        let hasVideo = false;

        try {
            const apiUrl = cleanLink.replace(/(?:www\.)?(?:twitter|x)\.com/gi, 'api.fxtwitter.com');
            const res = await axios.get(apiUrl);
            const tweetData = res.data.tweet || res.data;
            const media = tweetData?.media?.all || [];
            hasVideo = media.some(m => m.type === 'video' || m.type === 'gif');
        } catch {
            hasVideo = true; // mismo fallback seguro que en messageCreate
        }

        const buttons = [
            new ButtonBuilder()
                .setCustomId(`translate_fx|${cleanLink}`)
                .setLabel('Traducir')
                .setStyle(ButtonStyle.Secondary)
        ];
        if (hasVideo) buttons.push(downloadButton());

        return {
            payload: { content: fallbackLink, embeds: [], components: [new ActionRowBuilder().addComponents(buttons)] },
            cleanupPath: null
        };
    }

    // ---------- TIKTOK / INSTAGRAM ----------
    if (isTikTok || isInstagram) {
        const fallbackLink = isTikTok
            ? link.replace(/(?:www\.)?(?:vm\.|vt\.|v\.)?tiktok\.com/gi, 'tnktok.com')
            : link.replace(/(?:www\.)?instagram\.com/gi, 'vxinstagram.com');

        let metadata = null;
        let hasVideo = false;
        try {
            metadata = await youtubedl(link, { dumpJson: true, noWarnings: true });
            hasVideo = metadata.duration > 0 || (metadata.vcodec && metadata.vcodec !== 'none');
        } catch {
            console.log(`[Aviso] yt-dlp no pudo extraer metadatos de ${link}.`);
        }

        const components = hasVideo ? [new ActionRowBuilder().addComponents(downloadButton())] : [];

        if (isInstagram && metadata) {
            const embed = new EmbedBuilder()
                .setColor('#E1306C')
                .setAuthor({ name: `${metadata.uploader || metadata.creator || 'Usuario'} en Instagram` })
                .setURL(fallbackLink)
                .setDescription(`> ${(metadata.title || metadata.description || 'Sin descripción').substring(0, 4000)}`)
                .setFooter({ text: 'Project Aurora' });
            if (metadata.thumbnail) embed.setImage(metadata.thumbnail);

            return { payload: { content: ' ', embeds: [embed], components }, cleanupPath: null };
        }

        return { payload: { content: fallbackLink, embeds: [], components }, cleanupPath: null };
    }

    // ---------- FACEBOOK ----------
    if (isFacebook) {
        const downloadable = ['/reels/', '/share/v/', '/share/r/', '/watch/', 'video.php'].some(p => link.includes(p));
        if (!downloadable || (link.includes('/watch/') && !link.includes('?v='))) return null;

        const result = await downloadAndPrepareSocialVideo(link);
        return { payload: result.payload, cleanupPath: result.actualFilePath };
    }

    // ---------- PINTEREST ----------
    if (isPinterest) {
        const pinLink = link.split('?')[0];
        try {
            const result = await downloadAndPrepareSocialVideo(pinLink);
            return { payload: result.payload, cleanupPath: result.actualFilePath };
        } catch {
            // Fallback: imagen estática
            const page = await axios.get(pinLink, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
            });
            const img = page.data.match(/https:\/\/i\.pinimg\.com\/(?:originals|736x|564x)\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\/[a-f0-9]+\.(?:jpg|png|webp)/i);
            if (!img) return null;
            return { payload: { content: ' ', files: [img[0]] }, cleanupPath: null };
        }
    }

    return null;
}

module.exports = { buildSocialReply };