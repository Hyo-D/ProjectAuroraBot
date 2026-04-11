require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

// Aquí construimos la información que Discord va a leer
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
                .setRequired(true)),

    new ContextMenuCommandBuilder()
        .setName('Convertir a GIF')
        .setType(ApplicationCommandType.Message)
].map(command => command.toJSON());
