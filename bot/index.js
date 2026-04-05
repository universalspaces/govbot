import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cron from 'node-cron';
import db, { startMaintenance } from './database.js';
import { checkElections } from './utils/electionScheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const { default: command } = await import(`./commands/${file}`);
  if (command && 'data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  }
}

client.once('ready', async () => {
  console.log(`✅ GovBot is online as ${client.user.tag}`);

  try {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    const commandData = client.commands.map(c => c.data.toJSON());
    console.log(`⏳ Refreshing ${commandData.length} global application (/) commands...`);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commandData });
    console.log('✅ Successfully reloaded global application (/) commands.');
  } catch (error) {
    console.error('❌ Failed to deploy commands on startup:', error);
  }

  console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);
  console.log(`🚀 Startup process complete.`);
  console.log(`successfully finished startup`);

  startMaintenance();
  cron.schedule('* * * * *', () => checkElections(client));
});

// ── Interaction handler ──────────────────────────────────────────────
client.on('interactionCreate', async interaction => {

  // Autocomplete
  if (interaction.isAutocomplete()) {
    if (!interaction.guildId) return;
    const cmd = client.commands.get(interaction.commandName);
    if (cmd?.autocomplete) {
      try { await cmd.autocomplete(interaction); } catch {}
    }
    return;
  }

  // Buttons — all use customId format "action:arg1:arg2..."
  if (interaction.isButton()) {
    if (!interaction.guildId) return;
    const [action, ...parts] = interaction.customId.split(':');
    const gid = interaction.guildId;
    const uid = interaction.user.id;

    // Ensure config row exists for button interactions too
    let config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(gid);
    if (!config) {
      db.prepare('INSERT OR IGNORE INTO server_config (guild_id) VALUES (?)').run(gid);
      db.prepare('INSERT OR IGNORE INTO treasury (guild_id) VALUES (?)').run(gid);
      config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(gid);
    }

    try {
      const { handle } = await import(`./handlers/${action}.js`);
      await handle(interaction, parts, config);
    } catch (e) {
      if (e.code === 'ERR_MODULE_NOT_FOUND') return; // unknown button — ignore
      console.error(`Button error [${action}]:`, e);
      const msg = { content: '❌ An error occurred.', flags: 64 };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
      else await interaction.reply(msg).catch(() => {});
    }
    return;
  }

  // Select menus
  if (interaction.isStringSelectMenu()) {
    if (!interaction.guildId) return;
    const [action, ...parts] = interaction.customId.split(':');
    const gid = interaction.guildId;

    let config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(gid);
    if (!config) {
      db.prepare('INSERT OR IGNORE INTO server_config (guild_id) VALUES (?)').run(gid);
      db.prepare('INSERT OR IGNORE INTO treasury (guild_id) VALUES (?)').run(gid);
      config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(gid);
    }

    try {
      const { handle } = await import(`./handlers/${action}.js`);
      await handle(interaction, parts, config);
    } catch (e) {
      if (e.code === 'ERR_MODULE_NOT_FOUND') return;
      console.error(`Select error [${action}]:`, e);
      const msg = { content: '❌ An error occurred.', flags: 64 };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
      else await interaction.reply(msg).catch(() => {});
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  // DM guard — all commands require a guild
  if (!interaction.guildId) {
    return interaction.reply({ content: '❌ GovBot commands can only be used inside a server.', flags: 64 });
  }

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  // Ensure server config row exists
  let config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(interaction.guildId);
  if (!config) {
    db.prepare('INSERT OR IGNORE INTO server_config (guild_id) VALUES (?)').run(interaction.guildId);
    db.prepare('INSERT OR IGNORE INTO treasury (guild_id) VALUES (?)').run(interaction.guildId);
    config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(interaction.guildId);
  }

  // Citizenship gate
  if (config?.require_citizenship) {
    const EXEMPT_COMMANDS = ['citizen', 'help', 'setup', 'government', 'admin', 'stats', 'treasury'];
    const EXEMPT_SUBS = ['register', 'profile', 'list', 'info', 'balance', 'wallet', 'transactions', 'richlist', 'judges'];
    const sub = interaction.options?.getSubcommand?.(false);
    const isExempt = EXEMPT_COMMANDS.includes(interaction.commandName)
      || (sub && EXEMPT_SUBS.includes(sub))
      || ['list', 'info', 'view', 'docket'].includes(sub);

    if (!isExempt) {
      const citizen = db.prepare('SELECT 1 FROM citizens WHERE guild_id = ? AND user_id = ?')
        .get(interaction.guildId, interaction.user.id);
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
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
    else await interaction.reply(msg);
  }
});

client.login(process.env.DISCORD_TOKEN);
export default client;
