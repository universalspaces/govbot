import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cron from 'node-cron';
import db from './database.js';
import { checkElections } from './utils/electionScheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Start the dashboard server
import('../dashboard/server.js').catch(e => console.error('Dashboard failed to start:', e));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ]
});

client.commands = new Collection();

// 1. Load commands into the Collection
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const { default: command } = await import(`./commands/${file}`);
  if (command && 'data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  }
}

// Event: Ready (Standard event is 'ready')
client.once('ready', async () => {
  console.log(`✅ GovBot is online as ${client.user.tag}`);
  
  // 2. Deployment Logic: Register commands globally
  try {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    const commandData = client.commands.map(command => command.data.toJSON());

    console.log(`⏳ Refreshing ${commandData.length} global application (/) commands...`);

    // This registers commands to every server the bot is in automatically
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commandData }
    );

    console.log('✅ Successfully reloaded global application (/) commands.');
  } catch (error) {
    console.error('❌ Failed to deploy commands on startup:', error);
  }

  console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
  console.log(`🚀 Startup process complete.`);

  cron.schedule('* * * * *', () => checkElections(client));
});

// Event: Interaction (Rest of your code remains the same)
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  // Server config logic
  const existing = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(interaction.guildId);
  if (!existing) {
    db.prepare('INSERT OR IGNORE INTO server_config (guild_id) VALUES (?)').run(interaction.guildId);
    db.prepare('INSERT OR IGNORE INTO treasury (guild_id) VALUES (?)').run(interaction.guildId);
  }

  // Citizenship gate
  const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(interaction.guildId);
  if (config?.require_citizenship) {
    const EXEMPT_COMMANDS = ['citizen', 'help', 'setup', 'government', 'admin', 'stats', 'treasury'];
    const EXEMPT_SUBS = ['register', 'profile', 'list', 'info', 'balance', 'wallet', 'transactions', 'richlist', 'judges'];
    const sub = interaction.options?.getSubcommand?.(false);
    const isExempt = EXEMPT_COMMANDS.includes(interaction.commandName)
      || (sub && EXEMPT_SUBS.includes(sub))
      || ['list', 'info', 'view', 'docket'].includes(sub);

    if (!isExempt) {
      const citizen = db.prepare('SELECT 1 FROM citizens WHERE guild_id = ? AND user_id = ?').get(interaction.guildId, interaction.user.id);
      if (!citizen) {
        const { EmbedBuilder } = await import('discord.js');
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('❌ Citizenship Required')
            .setDescription(`**${config.government_name || 'This government'}** requires you to register as a citizen before participating.\n\nUse \`/citizen register\` to get started.`)],
          flags: 64
        });
      }
    }
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Error in command ${interaction.commandName}:`, error);
    const msg = { content: '❌ An error occurred while executing this command.', flags: 64 };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

export default client;
