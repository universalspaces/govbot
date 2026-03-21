import { EmbedBuilder } from 'discord.js';
import db from '../database.js';

export function govEmbed(guildId, color = 0x2f3136) {
  const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(guildId);
  return new EmbedBuilder()
    .setColor(color)
    .setFooter({ text: config?.government_name || 'GovBot' });
}

export function successEmbed(title, description, guildId) {
  return govEmbed(guildId, 0x57f287).setTitle(`✅ ${title}`).setDescription(description);
}

export function errorEmbed(description) {
  return new EmbedBuilder().setColor(0xed4245).setTitle('❌ Error').setDescription(description);
}

export function infoEmbed(title, description, guildId) {
  return govEmbed(guildId, 0x5865f2).setTitle(title).setDescription(description);
}

export function logActivity(guildId, action, actorId, target, details) {
  db.prepare(`INSERT INTO activity_log (guild_id, action, actor_id, target, details) VALUES (?, ?, ?, ?, ?)`)
    .run(guildId, action, actorId, target, details);
}

export function isAdmin(member) {
  return member.permissions.has('Administrator') || member.permissions.has('ManageGuild');
}

export function formatTimestamp(unixTime) {
  return `<t:${unixTime}:F>`;
}

export function getPartyEmbed(party) {
  return new EmbedBuilder()
    .setColor(parseInt(party.color.replace('#', ''), 16) || 0x5865f2)
    .setTitle(`${party.emoji} ${party.name} (${party.abbreviation})`)
    .setDescription(party.description || '*No description set.*')
    .addFields(
      { name: '🧭 Ideology', value: party.ideology || 'Unspecified', inline: true },
      { name: '📅 Founded', value: `<t:${party.founded_at}:D>`, inline: true }
    );
}
