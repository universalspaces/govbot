import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database.js';

// Single query that fetches all government counts in one pass
const stmtCounts = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM citizens        WHERE guild_id = @g)                          AS citizens,
    (SELECT COUNT(*) FROM parties         WHERE guild_id = @g AND is_active = 1)        AS parties,
    (SELECT COUNT(*) FROM laws            WHERE guild_id = @g AND is_active = 1)        AS laws,
    (SELECT COUNT(*) FROM elections       WHERE guild_id = @g AND status = 'active')    AS active_elections,
    (SELECT COUNT(*) FROM elections       WHERE guild_id = @g AND status = 'scheduled') AS scheduled_elections,
    (SELECT COUNT(*) FROM cases           WHERE guild_id = @g AND status != 'closed')   AS open_cases,
    (SELECT COUNT(*) FROM bills           WHERE guild_id = @g AND status = 'proposed')  AS pending_bills,
    (SELECT COUNT(*) FROM offices         WHERE guild_id = @g)                          AS total_offices,
    (SELECT COUNT(*) FROM offices         WHERE guild_id = @g AND holder_id IS NOT NULL) AS filled_offices,
    (SELECT COUNT(*) FROM referendums     WHERE guild_id = @g AND status = 'active')    AS active_refs,
    (SELECT COUNT(*) FROM initiatives     WHERE guild_id = @g AND status = 'collecting') AS active_inits,
    (SELECT COUNT(*) FROM impeachments    WHERE guild_id = @g AND status = 'trial')     AS active_impeach
`);

export default {
  data: new SlashCommandBuilder()
    .setName('government')
    .setDescription('View government statistics and overview'),

  async execute(interaction) {
    const gid = interaction.guildId;
    const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(gid);
    db.prepare('INSERT OR IGNORE INTO treasury (guild_id) VALUES (?)').run(gid);
    const treasury = db.prepare('SELECT * FROM treasury WHERE guild_id = ?').get(gid);

    // Single aggregated query instead of 16 separate COUNT queries
    const c = stmtCounts.get({ g: gid });

    const offices = db.prepare('SELECT name, holder_id FROM offices WHERE guild_id = ? AND holder_id IS NOT NULL ORDER BY name ASC LIMIT 6').all(gid);
    const officeText = offices.length > 0
      ? offices.map(o => `**${o.name}:** <@${o.holder_id}>`).join('\n')
      : '*No positions filled.*';

    const electionParts = [];
    if (c.active_elections > 0)    electionParts.push(`🟢 ${c.active_elections} active`);
    if (c.scheduled_elections > 0) electionParts.push(`📅 ${c.scheduled_elections} scheduled`);
    const electionValue = electionParts.length > 0 ? electionParts.join(' · ') : '—';

    const civicParts = [];
    if (c.active_refs > 0)    civicParts.push(`📊 ${c.active_refs} referendum${c.active_refs !== 1 ? 's' : ''}`);
    if (c.active_inits > 0)   civicParts.push(`📣 ${c.active_inits} initiative${c.active_inits !== 1 ? 's' : ''}`);
    if (c.active_impeach > 0) civicParts.push(`⚖️ ${c.active_impeach} impeachment${c.active_impeach !== 1 ? 's' : ''}`);
    const civicValue = civicParts.length > 0 ? civicParts.join(' · ') : '—';

    const sym = treasury?.currency_symbol || '₡';
    const cur = treasury?.currency_name || 'Credits';
    const bal = treasury?.balance ?? 0;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🏛️ ${config?.government_name || 'The Republic'} — Government Overview`)
      .setDescription(`*Welcome to the official government dashboard of **${config?.government_name || 'The Republic'}**.*`)
      .addFields(
        { name: '👥 Citizens',          value: `${c.citizens}`,                         inline: true },
        { name: '🏛️ Parties',           value: `${c.parties}`,                          inline: true },
        { name: '📜 Laws Enacted',      value: `${c.laws}`,                             inline: true },
        { name: '🗳️ Elections',         value: electionValue,                           inline: true },
        { name: '⚖️ Open Cases',        value: `${c.open_cases}`,                       inline: true },
        { name: '📋 Pending Bills',     value: `${c.pending_bills}`,                    inline: true },
        { name: '💼 Offices Filled',    value: `${c.filled_offices}/${c.total_offices}`, inline: true },
        { name: `${sym} Treasury`,      value: `${sym}${bal.toLocaleString()} ${cur}`,  inline: true },
        { name: '🗳️ Civic Activity',    value: civicValue,                              inline: true },
        { name: '⚡ Current Officials', value: officeText,                              inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'GovBot • Mock Government System' });

    return interaction.reply({ embeds: [embed] });
  }
};
