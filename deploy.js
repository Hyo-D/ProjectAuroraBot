require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

// Aquí construimos la información que Discord va a leer
const commands = [
    new SlashCommandBuilder()
        .setName('aurora')
        .setDescription('Muestra la información técnica del bot y el perfil del creador.')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Empezando a registrar los comandos (/) en la API de Discord...');

        // Registramos el comando globalmente (para que funcione en cualquier server donde esté el bot)
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('¡Comandos (/) registrados exitosamente!');
    } catch (error) {
        console.error('Hubo un error al registrar:', error);
    }
})();