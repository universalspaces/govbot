import { EmbedBuilder } from 'discord.js';
import db from '../database.js';

// ── Cached prepared statements ──────────────────────────────────────────────
// Re-using the same prepared statement object is faster than calling
// db.prepare() on every invocation — better-sqlite3 compiles the SQL once.
const stmtGetConfig   = db.prepare('SELECT * FROM server_config WHERE guild_id = ?');
const stmtGetCitizen  = db.prepare('SELECT * FROM citizens WHERE guild_id = ? AND user_id = ?');
const stmtHasCitizen  = db.prepare('SELECT 1 FROM citizens WHERE guild_id = ? AND user_id = ?');
const stmtLogActivity = db.prepare('INSERT INTO activity_log (guild_id, action, actor_id, target, details) VALUES (?, ?, ?, ?, ?)');

// ── Embed helpers ────────────────────────────────────────────────────────────
// govEmbed previously ran a DB query on every call just for the footer text.
// Pass the government name directly to avoid that — callers that have config
// already in scope use it; others pass null for the default fallback.
export function govEmbed(govName, color = 0x2f3136) {
  return new EmbedBuilder()
    .setColor(color)
    .setFooter({ text: govName || 'GovBot' });
}

export function successEmbed(title, description, govNameOrGuildId) {
  // Accept either a pre-fetched name string or a guild ID (for backwards compat)
  const name = typeof govNameOrGuildId === 'string' && govNameOrGuildId.length < 30
    ? (stmtGetConfig.get(govNameOrGuildId)?.government_name ?? 'GovBot')
    : (govNameOrGuildId ?? 'GovBot');
  return govEmbed(name, 0x57f287).setTitle(`✅ ${title}`).setDescription(description);
}

export function errorEmbed(description) {
  return new EmbedBuilder().setColor(0xed4245).setTitle('❌ Error').setDescription(description);
}

export function infoEmbed(title, description, govNameOrGuildId) {
  const name = typeof govNameOrGuildId === 'string' && govNameOrGuildId.length < 30
    ? (stmtGetConfig.get(govNameOrGuildId)?.government_name ?? 'GovBot')
    : (govNameOrGuildId ?? 'GovBot');
  return govEmbed(name, 0x5865f2).setTitle(title).setDescription(description);
}

// ── Logging ──────────────────────────────────────────────────────────────────
export function logActivity(guildId, action, actorId, target, details) {
  stmtLogActivity.run(guildId, action, actorId, target, details);
}

// ── Auth helpers ─────────────────────────────────────────────────────────────
export function isAdmin(member) {
  return member.permissions.has('Administrator') || member.permissions.has('ManageGuild');
}

export function getCitizen(guildId, userId) {
  return stmtGetCitizen.get(guildId, userId) || null;
}

export async function requireCitizen(interaction) {
  const citizen = stmtHasCitizen.get(interaction.guildId, interaction.user.id);
  if (!citizen) {
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('❌ Not a Registered Citizen')
        .setDescription('You must register as a citizen before using this command.\n\nUse `/citizen register` to get started.')],
      flags: 64
    });
    return false;
  }
  return true;
}

// ── Misc ─────────────────────────────────────────────────────────────────────
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
