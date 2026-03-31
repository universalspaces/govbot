import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commands = [];

// 1. Load your commands
const commandFiles = readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const { default: command } = await import(`./commands/${file}`);
  if (command && 'data' in command) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🚀 Started refreshing ${commands.length} global application (/) commands.`);

    // 2. Deploy GLOBALLY
    // This makes the commands available in EVERY server the bot is in.
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('✅ Successfully reloaded all global commands!');
    console.log('💡 Note: Global commands can take a few minutes to propagate to all servers.');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
