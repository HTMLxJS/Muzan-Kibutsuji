// Import necessary classes from discord.js
import { Client, GatewayIntentBits, Events } from 'discord.js';
import * as dotenv from 'dotenv';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';


// Load environment variables (like your BOT_TOKEN and CLIENT_ID)
dotenv.config();

// Define the slash commands your bot will support
const commands = [
    {
        name: 'ping',
        description: 'Replies with Pong!',
    },
    {
        name: 'hello',
        description: 'The bot greets you!',
    },
];

// Create a new client instance and specify the required Intents
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, // For guild-related events (essential)
    ] 
});

// --- 1. Bot Ready Event ---
client.once(Events.ClientReady, async readyClient => {
    console.log(`✅ Success! Logged in as ${readyClient.user.tag}`);
    
    // --- Register Slash Commands ---
    // We use the REST API to register the commands globally.
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    
    try {
        console.log('Started refreshing application (/) commands.');

        // Deploy commands globally (this can take up to an hour)
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands globally.');
    } catch (error) {
        console.error('Error during command registration:', error);
    }
});

// --- 2. Interaction Handler Event ---
client.on(Events.InteractionCreate, async interaction => {
    // Only handle chat input (slash commands)
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        if (commandName === 'ping') {
            await interaction.reply({ content: 'Pong!', ephemeral: true }); // ephemeral means only the user sees it
        } else if (commandName === 'hello') {
            await interaction.reply({ content: `Hello, ${interaction.user.username}! I am your friendly bot.`, ephemeral: false });
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        // Fallback for errors
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

// Log in to Discord using the token from the .env file
client.login(process.env.BOT_TOKEN);