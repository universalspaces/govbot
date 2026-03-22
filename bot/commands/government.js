import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database.js';

export default {
  data: new SlashCommandBuilder()
    .setName('government')
    .setDescription('View government statistics and overview'),

  async execute(interaction) {
    const gid = interaction.guildId;
    const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(gid);
    db.prepare('INSERT OR IGNORE INTO treasury (guild_id) VALUES (?)').run(gid);
    const treasury = db.prepare('SELECT * FROM treasury WHERE guild_id = ?').get(gid);

    const citizens          = db.prepare('SELECT COUNT(*) as cnt FROM citizens WHERE guild_id = ?').get(gid).cnt;
    const parties           = db.prepare('SELECT COUNT(*) as cnt FROM parties WHERE guild_id = ? AND is_active = 1').get(gid).cnt;
    const laws              = db.prepare("SELECT COUNT(*) as cnt FROM laws WHERE guild_id = ? AND is_active = 1").get(gid).cnt;
    const activeElections   = db.prepare("SELECT COUNT(*) as cnt FROM elections WHERE guild_id = ? AND status = 'active'").get(gid).cnt;
    const scheduledElections= db.prepare("SELECT COUNT(*) as cnt FROM elections WHERE guild_id = ? AND status = 'scheduled'").get(gid).cnt;
    const openCases         = db.prepare("SELECT COUNT(*) as cnt FROM cases WHERE guild_id = ? AND status != 'closed'").get(gid).cnt;
    const pendingBills      = db.prepare("SELECT COUNT(*) as cnt FROM bills WHERE guild_id = ? AND status = 'proposed'").get(gid).cnt;
    const totalOffices      = db.prepare('SELECT COUNT(*) as cnt FROM offices WHERE guild_id = ?').get(gid).cnt;
    const filledOffices     = db.prepare('SELECT COUNT(*) as cnt FROM offices WHERE guild_id = ? AND holder_id IS NOT NULL').get(gid).cnt;
    const activeRefs        = db.prepare("SELECT COUNT(*) as cnt FROM referendums WHERE guild_id = ? AND status = 'active'").get(gid).cnt;
    const activeInits       = db.prepare("SELECT COUNT(*) as cnt FROM initiatives WHERE guild_id = ? AND status = 'collecting'").get(gid).cnt;
    const activeImpeach     = db.prepare("SELECT COUNT(*) as cnt FROM impeachments WHERE guild_id = ? AND status = 'trial'").get(gid).cnt;

    const offices = db.prepare('SELECT * FROM offices WHERE guild_id = ? AND holder_id IS NOT NULL ORDER BY name ASC LIMIT 6').all(gid);
    const officeText = offices.length > 0
      ? offices.map(o => `**${o.name}:** <@${o.holder_id}>`).join('\n')
      : '*No positions filled.*';

    const electionParts = [];
    if (activeElections > 0) electionParts.push(`🟢 ${activeElections} active`);
    if (scheduledElections > 0) electionParts.push(`📅 ${scheduledElections} scheduled`);
    const electionValue = electionParts.length > 0 ? electionParts.join(' · ') : '—';

    const civicParts = [];
    if (activeRefs > 0) civicParts.push(`📊 ${activeRefs} referendum${activeRefs !== 1 ? 's' : ''}`);
    if (activeInits > 0) civicParts.push(`📣 ${activeInits} initiative${activeInits !== 1 ? 's' : ''}`);
    if (activeImpeach > 0) civicParts.push(`⚖️ ${activeImpeach} impeachment${activeImpeach !== 1 ? 's' : ''}`);
    const civicValue = civicParts.length > 0 ? civicParts.join(' · ') : '—';

    const sym = treasury?.currency_symbol || '₡';
    const cur = treasury?.currency_name || 'Credits';
    const bal = treasury?.balance ?? 0;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🏛️ ${config?.government_name || 'The Republic'} — Government Overview`)
      .setDescription(`*Welcome to the official government dashboard of **${config?.government_name || 'The Republic'}**.*`)
      .addFields(
        { name: '👥 Citizens',         value: `${citizens}`,                           inline: true },
        { name: '🏛️ Parties',          value: `${parties}`,                            inline: true },
        { name: '📜 Laws Enacted',     value: `${laws}`,                               inline: true },
        { name: '🗳️ Elections',        value: electionValue,                           inline: true },
        { name: '⚖️ Open Cases',       value: `${openCases}`,                          inline: true },
        { name: '📋 Pending Bills',    value: `${pendingBills}`,                       inline: true },
        { name: '💼 Offices Filled',   value: `${filledOffices}/${totalOffices}`,      inline: true },
        { name: `${sym} Treasury`,     value: `${sym}${bal.toLocaleString()} ${cur}`,  inline: true },
        { name: '🗳️ Civic Activity',   value: civicValue,                              inline: true },
        { name: '⚡ Current Officials', value: officeText,                             inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'GovBot • Mock Government System' });

    return interaction.reply({ embeds: [embed] });
  }
};
