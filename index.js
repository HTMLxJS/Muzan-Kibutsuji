// Import necessary classes from discord.js
import { 
    Client, 
    GatewayIntentBits, 
    Events, 
    ActivityType, 
    ApplicationCommandOptionType, 
    PermissionsBitField 
} from 'discord.js';
import * as dotenv from 'dotenv';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';


// Load environment variables (like your BOT_TOKEN and CLIENT_ID)
dotenv.config();

// Define the slash commands your bot will support
const commands = [
    // --- Utility Commands (Existing) ---
    {
        name: 'ping',
        description: 'Replies with Pong!',
    },
    {
        name: 'hello',
        description: 'The bot greets you!',
    },
    {
        name: 'motivate',
        description: 'Sends a custom motivational message.',
        options: [
            {
                name: 'target_user',
                description: 'The user you want to send the motivational message to.',
                type: ApplicationCommandOptionType.User,
                required: true,
            },
        ],
    },
    
    // --- MODERATION COMMANDS (NEW) ---
    {
        name: 'kick',
        description: 'Kicks a specified user from the server.',
        options: [
            {
                name: 'target', 
                description: 'The member to kick.',
                type: ApplicationCommandOptionType.User,
                required: true,
            },
            {
                name: 'reason',
                description: 'Reason for the kick.',
                type: ApplicationCommandOptionType.String,
                required: false,
            }
        ],
    },
    {
        name: 'ban',
        description: 'Bans a specified user from the server.',
        options: [
            {
                name: 'target', 
                description: 'The user to ban.',
                type: ApplicationCommandOptionType.User,
                required: true,
            },
            {
                name: 'reason',
                description: 'Reason for the ban.',
                type: ApplicationCommandOptionType.String,
                required: false,
            }
        ],
    },
    {
        name: 'timeout',
        description: 'Timeouts a user for a specific duration (max 28 days).',
        options: [
            {
                name: 'target', 
                description: 'The member to timeout.',
                type: ApplicationCommandOptionType.User,
                required: true,
            },
            {
                name: 'duration_minutes', 
                description: 'Duration of the timeout in minutes.',
                type: ApplicationCommandOptionType.Number,
                required: true,
            },
            {
                name: 'reason',
                description: 'Reason for the timeout.',
                type: ApplicationCommandOptionType.String,
                required: false,
            }
        ],
    },
];

// Create a new client instance and specify the required Intents
// Note: We need GatewayIntentBits.GuildMembers for kick/ban/timeout to work properly.
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers // Required to fetch member data for mod commands
    ] 
});

// --- 1. Bot Ready Event ---
client.once(Events.ClientReady, async readyClient => {
    console.log(`✅ Success! Logged in as ${readyClient.user.tag}`);

    // Set bot presence (status)
    readyClient.user.setPresence({
        activities: [{ 
            name: '/kick, /ban, /timeout', // New custom status
            type: ActivityType.Watching 
        }],
        status: 'dnd', // Do Not Disturb
    });
    
    // Register Slash Commands
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    
    try {
        console.log('Started refreshing application (/) commands.');
        // Deploy commands globally 
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
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        if (commandName === 'ping') {
            await interaction.reply({ content: 'Pong!', ephemeral: true });
        } else if (commandName === 'hello') {
            await interaction.reply({ content: `Hello, ${interaction.user.username}! I am your friendly bot.`, ephemeral: false });
        } else if (commandName === 'motivate') {
            const targetUser = interaction.options.getUser('target_user');
            const message = `Hey ${targetUser}, just a reminder that **you are doing amazing!** Keep pushing through. Your effort is noticed by ${interaction.user.username}. 🎉`;
            await interaction.reply({ content: message, ephemeral: false });

        } else if (commandName === 'kick') {
            // Check if the user has permission to kick
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                return interaction.reply({ content: '🛑 You need the "Kick Members" permission to use this command.', ephemeral: true });
            }

            const targetUser = interaction.options.getUser('target');
            const reason = interaction.options.getString('reason') || 'No reason provided.';
            // Get the member object to use the kickable property
            const targetMember = interaction.guild.members.cache.get(targetUser.id);
            
            if (!targetMember) {
                return interaction.reply({ content: 'User is not a member of this server.', ephemeral: true });
            }

            // Check if the bot can kick the user (role hierarchy)
            if (!targetMember.kickable) {
                return interaction.reply({ content: `❌ I cannot kick ${targetUser.username}. They might have a higher role or be the server owner.`, ephemeral: true });
            }

            await targetMember.kick(reason);
            await interaction.reply({ content: `✅ Successfully kicked **${targetUser.username}**. Reason: *${reason}*`, ephemeral: false });

        } else if (commandName === 'ban') {
            // Check if the user has permission to ban
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return interaction.reply({ content: '🛑 You need the "Ban Members" permission to use this command.', ephemeral: true });
            }

            const targetUser = interaction.options.getUser('target');
            const reason = interaction.options.getString('reason') || 'No reason provided.';
            
            // Check bot's permission (ban is on the guild, not the member object)
            if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return interaction.reply({ content: '❌ I do not have the "Ban Members" permission to perform this action.', ephemeral: true });
            }

            await interaction.guild.members.ban(targetUser.id, { reason: reason });
            await interaction.reply({ content: `✅ Successfully banned **${targetUser.username}**. Reason: *${reason}*`, ephemeral: false });

        } else if (commandName === 'timeout') {
            // Check if the user has permission to moderate
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                return interaction.reply({ content: '🛑 You need the "Moderate Members" permission to use this command.', ephemeral: true });
            }

            const targetUser = interaction.options.getUser('target');
            const durationMinutes = interaction.options.getNumber('duration_minutes');
            const reason = interaction.options.getString('reason') || 'No reason provided.';
            
            const targetMember = interaction.guild.members.cache.get(targetUser.id);

            if (!targetMember) {
                return interaction.reply({ content: 'User is not a member of this server.', ephemeral: true });
            }

            // Convert minutes to milliseconds (Discord API expects milliseconds)
            const durationMs = durationMinutes * 60 * 1000;

            // Check bot's permission
            if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                return interaction.reply({ content: '❌ I do not have the "Moderate Members" permission to perform this action.', ephemeral: true });
            }

            await targetMember.timeout(durationMs, reason);
            await interaction.reply({ 
                content: `✅ Successfully timed out **${targetUser.username}** for **${durationMinutes} minutes**. Reason: *${reason}*`, 
                ephemeral: false 
            });
        }

    } catch (error) {
        console.error('Error handling interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'An unexpected error occurred while executing this command!', ephemeral: true });
        }
    }
});

// Log in to Discord using the token from the .env file
client.login(process.env.BOT_TOKEN);
