import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cron from 'node-cron';
import db from './database.js';
import { checkElections } from './utils/electionScheduler.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ]
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const { default: command } = await import(`./commands/${file}`);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  }
}

// Event: Ready
client.once('ready', () => {
  console.log(`✅ GovBot is online as ${client.user.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);

  // Schedule election checks every minute
  cron.schedule('* * * * *', () => checkElections(client));
});

// Event: Interaction
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  // Ensure server config exists
  const existing = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(interaction.guildId);
  if (!existing) {
    db.prepare('INSERT OR IGNORE INTO server_config (guild_id) VALUES (?)').run(interaction.guildId);
    db.prepare('INSERT OR IGNORE INTO treasury (guild_id) VALUES (?)').run(interaction.guildId);
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
