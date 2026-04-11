require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');

// 1. Construimos los "planos" de los comandos (Tu código)
const commands = [
    new SlashCommandBuilder()
        .setName('about')
        .setDescription('Muestra la información general del bot y del creador.'),

    new SlashCommandBuilder()
        .setName('togif')
        .setDescription('Convierte un video corto en un archivo GIF optimizado.')
        .addAttachmentOption(option =>
            option.setName('video')
                .setDescription('Sube el archivo de video que quieres convertir')
                .setRequired(true)
        ),

    new ContextMenuCommandBuilder()
        .setName('Convertir a GIF')
        .setType(ApplicationCommandType.Message)
].map(command => command.toJSON());

// 2. Preparamos el módulo de conexión con el Token de Project Aurora
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// 3. Ejecutamos la subida de los comandos a la API de Discord
(async () => {
    try {
        console.log(`⏳ Empezando a actualizar ${commands.length} comandos (Slash y Menú de Contexto)...`);

        // Usamos applicationCommands para registrar los comandos GLOBALMENTE
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ ¡Éxito absoluto! ${data.length} comandos registrados correctamente en Discord.`);
    } catch (error) {
        console.error("❌ Hubo un error crítico al registrar los comandos:", error);
    }
})();