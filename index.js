// Import necessary classes from discord.js
import { 
    Client, 
    GatewayIntentBits, 
    Events, 
    ActivityType, 
    ApplicationCommandOptionType, 
    PermissionsBitField,
    time 
} from 'discord.js';
import * as dotenv from 'dotenv';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';


// Load environment variables (like your BOT_TOKEN and CLIENT_ID)
dotenv.config();

// Define the slash commands your bot will support
const commands = [
    // --- Utility Commands ---
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
    
    // --- MODERATION COMMANDS (UPDATED WITH PERMISSION FLAGS) ---
    {
        name: 'kick',
        description: 'Kicks a specified user from the server.',
        // Only users with KickMembers permission will see/use this command
        default_member_permissions: PermissionsBitField.Flags.KickMembers.toString(),
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
        // Only users with BanMembers permission will see/use this command
        default_member_permissions: PermissionsBitField.Flags.BanMembers.toString(),
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
        // Only users with ModerateMembers permission will see/use this command
        default_member_permissions: PermissionsBitField.Flags.ModerateMembers.toString(),
        options: [
            {
                name: 'target', 
                description: 'The member to timeout.',
                type: ApplicationCommandOptionType.User,
                required: true,
            },
            {
                name: 'duration_minutes', 
                description: 'Duration of the timeout in minutes (max 40320).',
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
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers 
    ] 
});

// --- 1. Bot Ready Event ---
client.once(Events.ClientReady, async readyClient => {
    console.log(`✅ Success! Logged in as ${readyClient.user.tag}`);

    // Set bot presence (status)
    readyClient.user.setPresence({
        activities: [{ 
            name: '/kick, /ban, /timeout',
            type: ActivityType.Watching 
        }],
        status: 'dnd',
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

    // Fetch the guild member for the target and the bot itself
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided.';
    const targetMember = targetUser ? interaction.guild.members.cache.get(targetUser.id) : null;
    
    // Helper function to check member existence and hierarchy
    const checkMember = async (action) => {
        if (!targetMember) {
            return await interaction.reply({ content: 'User is not a member of this server or not found in cache.', ephemeral: true });
        }
        // Check if the target is the bot itself
        if (targetMember.id === interaction.client.user.id) {
            return await interaction.reply({ content: `You can't ${action} me! That's not very nice.`, ephemeral: true });
        }
        // Check if the target can be moderated by the bot (role hierarchy check)
        if (!targetMember.manageable) {
            return await interaction.reply({ content: `❌ I cannot ${action} **${targetUser.username}**. They might have a higher role or be the server owner.`, ephemeral: true });
        }
        return true;
    };


    try {
        if (interaction.commandName === 'ping') {
            await interaction.reply({ content: 'Pong!', ephemeral: true });
        } else if (interaction.commandName === 'hello') {
            await interaction.reply({ content: `Hello, ${interaction.user.username}! I am your friendly bot.`, ephemeral: false });
        } else if (interaction.commandName === 'motivate') {
            const target = interaction.options.getUser('target_user');
            const message = `Hey ${target}, just a reminder that **you are doing amazing!** Keep pushing through. Your effort is noticed by ${interaction.user.username}. 🎉`;
            await interaction.reply({ content: message, ephemeral: false });

        } else if (interaction.commandName === 'kick') {
            if (await checkMember('kick') !== true) return; 

            // Final check on kickable property (should be covered by manageable but good practice)
            if (!targetMember.kickable) {
                return await interaction.reply({ content: `❌ I cannot kick ${targetUser.username}. They have a higher role.`, ephemeral: true });
            }

            await targetMember.kick(reason);
            await interaction.reply({ content: `✅ Successfully kicked **${targetUser.username}**. Reason: *${reason}*`, ephemeral: false });

        } else if (interaction.commandName === 'ban') {
            if (await checkMember('ban') !== true) return;
            
            // Check if the bot can ban (hierarchy check for ban)
            if (!targetMember.bannable) {
                return await interaction.reply({ content: `❌ I cannot ban ${targetUser.username}. They have a higher role.`, ephemeral: true });
            }

            await interaction.guild.members.ban(targetUser.id, { reason: reason });
            await interaction.reply({ content: `✅ Successfully banned **${targetUser.username}**. Reason: *${reason}*`, ephemeral: false });

        } else if (interaction.commandName === 'timeout') {
            if (await checkMember('timeout') !== true) return;

            const durationMinutes = interaction.options.getNumber('duration_minutes');
            // Discord timeout expects milliseconds, max 28 days (40320 minutes)
            const durationMs = Math.min(durationMinutes, 40320) * 60 * 1000;
            const durationDisplay = durationMs === 40320 * 60 * 1000 ? '28 days (max allowed)' : `${durationMinutes} minutes`;
            
            // Check if user is already timed out or has timeout permission
            if (targetMember.communicationDisabledUntilTimestamp) {
                return await interaction.reply({ 
                    content: `**${targetUser.username}** is already timed out until ${time(targetMember.communicationDisabledUntilTimestamp / 1000, 'F')}.`, 
                    ephemeral: true 
                });
            }

            // Perform the timeout
            await targetMember.timeout(durationMs, reason);
            await interaction.reply({ 
                content: `✅ Successfully timed out **${targetUser.username}** for **${durationDisplay}**. Reason: *${reason}*`, 
                ephemeral: false 
            });
        }

    } catch (error) {
        // Log errors that might occur during the operation (e.g., failed to fetch member)
        console.error(`Error executing ${interaction.commandName} command:`, error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: 'An unexpected error occurred. Ensure the target user is a member and the bot\'s role is high enough.', 
                ephemeral: true 
            });
        }
    }
});

// Log in to Discord using the token from the .env file
client.login(process.env.BOT_TOKEN);
