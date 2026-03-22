import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import { errorEmbed, successEmbed, logActivity } from '../utils/helpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('court')
    .setDescription('Manage the judicial system')
    .addSubcommand(s => s
      .setName('file')
      .setDescription('File a court case')
      .addStringOption(o => o.setName('title').setDescription('Case title').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Full description of the case').setRequired(true))
      .addUserOption(o => o.setName('defendant').setDescription('The defendant (if any)')))
    .addSubcommand(s => s
      .setName('assign')
      .setDescription('Assign a judge to a case (Admin only)')
      .addIntegerOption(o => o.setName('case_id').setDescription('Case ID').setRequired(true))
      .addUserOption(o => o.setName('judge').setDescription('The judge to assign').setRequired(true)))
    .addSubcommand(s => s
      .setName('rule')
      .setDescription('Issue a ruling on a case (assigned judge only)')
      .addIntegerOption(o => o.setName('case_id').setDescription('Case ID').setRequired(true))
      .addStringOption(o => o.setName('verdict').setDescription('Verdict').setRequired(true)
        .addChoices({ name: 'Guilty / In Favor of Plaintiff', value: 'guilty' }, { name: 'Not Guilty / In Favor of Defendant', value: 'not_guilty' }, { name: 'Dismissed', value: 'dismissed' }, { name: 'Settled', value: 'settled' }))
      .addStringOption(o => o.setName('ruling').setDescription('Full ruling/opinion text').setRequired(true)))
    .addSubcommand(s => s
      .setName('info')
      .setDescription('View case details')
      .addIntegerOption(o => o.setName('case_id').setDescription('Case ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all court cases')
      .addStringOption(o => o.setName('status').setDescription('Filter by status')
        .addChoices({ name: 'Filed', value: 'filed' }, { name: 'In Progress', value: 'in_progress' }, { name: 'Closed', value: 'closed' }, { name: 'All', value: 'all' }))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;
    const uid = interaction.user.id;
    const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(gid);

    if (sub === 'file') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const defendant = interaction.options.getUser('defendant');

      const result = db.prepare(`INSERT INTO cases (guild_id, title, description, plaintiff_id, defendant_id, status) VALUES (?, ?, ?, ?, ?, 'filed')`)
        .run(gid, title, description, uid, defendant?.id || null);

      logActivity(gid, 'CASE_FILED', uid, title, `Defendant: ${defendant?.id || 'None'}`);

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle(`⚖️ Case Filed: ${title}`)
        .setDescription(description)
        .addFields(
          { name: '🆔 Case ID', value: `#${result.lastInsertRowid}`, inline: true },
          { name: '👤 Plaintiff', value: `<@${uid}>`, inline: true },
          { name: '🎯 Defendant', value: defendant ? `<@${defendant.id}>` : 'N/A', inline: true },
          { name: '📋 Status', value: 'FILED — Awaiting judge assignment', inline: false }
        )
        .setTimestamp();

      // Announce in court channel if set
      if (config?.court_channel) {
        const channel = await interaction.guild.channels.fetch(config.court_channel).catch(() => null);
        if (channel) await channel.send({ embeds: [embed] });
      }

      return interaction.reply({ embeds: [embed], ephemeral: !config?.court_channel });
    }

    if (sub === 'assign') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('You need Manage Server permissions.')], flags: 64 });
      }
      const caseId = interaction.options.getInteger('case_id');
      const judge = interaction.options.getUser('judge');
      const courtCase = db.prepare('SELECT * FROM cases WHERE id = ? AND guild_id = ?').get(caseId, gid);
      if (!courtCase) return interaction.reply({ embeds: [errorEmbed(`Case #${caseId} not found.`)], flags: 64 });

      db.prepare(`UPDATE cases SET judge_id = ?, status = 'in_progress' WHERE id = ?`).run(judge.id, caseId);
      logActivity(gid, 'JUDGE_ASSIGNED', uid, `Case #${caseId}`, judge.id);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`⚖️ Judge Assigned — Case #${caseId}`)
        .setDescription(`**${courtCase.title}** has been assigned to <@${judge.id}>.`)
        .addFields({ name: '👨‍⚖️ Judge', value: `<@${judge.id}>`, inline: true });

      if (config?.court_channel) {
        const channel = await interaction.guild.channels.fetch(config.court_channel).catch(() => null);
        if (channel) await channel.send({ content: `<@${judge.id}>`, embeds: [embed] });
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'rule') {
      const caseId = interaction.options.getInteger('case_id');
      const verdict = interaction.options.getString('verdict');
      const ruling = interaction.options.getString('ruling');
      const courtCase = db.prepare('SELECT * FROM cases WHERE id = ? AND guild_id = ?').get(caseId, gid);

      if (!courtCase) return interaction.reply({ embeds: [errorEmbed(`Case #${caseId} not found.`)], flags: 64 });
      if (courtCase.judge_id !== uid && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('Only the assigned judge can issue a ruling.')], flags: 64 });
      }
      if (courtCase.status === 'closed') return interaction.reply({ embeds: [errorEmbed('This case is already closed.')], flags: 64 });

      const now = Math.floor(Date.now() / 1000);
      db.prepare(`UPDATE cases SET status = 'closed', verdict = ?, ruling = ?, ruled_at = ? WHERE id = ?`)
        .run(verdict, ruling, now, caseId);
      logActivity(gid, 'CASE_RULED', uid, `Case #${caseId}`, verdict);

      const verdictLabel = { guilty: '✅ Guilty / In Favor of Plaintiff', not_guilty: '❌ Not Guilty / In Favor of Defendant', dismissed: '🚫 Dismissed', settled: '🤝 Settled' };
      const verdictColor = { guilty: 0xed4245, not_guilty: 0x57f287, dismissed: 0xfee75c, settled: 0x5865f2 };

      const embed = new EmbedBuilder()
        .setColor(verdictColor[verdict] || 0x2f3136)
        .setTitle(`⚖️ Ruling Issued — Case #${caseId}: ${courtCase.title}`)
        .addFields(
          { name: '⚖️ Verdict', value: verdictLabel[verdict], inline: false },
          { name: '📜 Ruling', value: ruling },
          { name: '👨‍⚖️ Judge', value: `<@${uid}>`, inline: true },
          { name: '📅 Date', value: `<t:${now}:F>`, inline: true }
        )
        .setTimestamp();

      if (config?.court_channel) {
        const channel = await interaction.guild.channels.fetch(config.court_channel).catch(() => null);
        if (channel) await channel.send({ embeds: [embed] });
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'info') {
      const caseId = interaction.options.getInteger('case_id');
      const courtCase = db.prepare('SELECT * FROM cases WHERE id = ? AND guild_id = ?').get(caseId, gid);
      if (!courtCase) return interaction.reply({ embeds: [errorEmbed(`Case #${caseId} not found.`)], flags: 64 });

      const statusColors = { filed: 0xfee75c, in_progress: 0x5865f2, closed: 0x57f287 };
      const embed = new EmbedBuilder()
        .setColor(statusColors[courtCase.status] || 0x2f3136)
        .setTitle(`⚖️ Case #${caseId}: ${courtCase.title}`)
        .setDescription(courtCase.description)
        .addFields(
          { name: '📋 Status', value: courtCase.status.toUpperCase().replace('_', ' '), inline: true },
          { name: '👤 Plaintiff', value: `<@${courtCase.plaintiff_id}>`, inline: true },
          { name: '🎯 Defendant', value: courtCase.defendant_id ? `<@${courtCase.defendant_id}>` : 'N/A', inline: true },
          { name: '👨‍⚖️ Judge', value: courtCase.judge_id ? `<@${courtCase.judge_id}>` : 'Not assigned', inline: true },
          { name: '📅 Filed', value: `<t:${courtCase.filed_at}:D>`, inline: true }
        );

      if (courtCase.verdict) {
        embed.addFields(
          { name: '⚖️ Verdict', value: courtCase.verdict.replace('_', ' ').toUpperCase(), inline: true },
          { name: '📜 Ruling', value: courtCase.ruling || 'N/A' }
        );
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const status = interaction.options.getString('status') || 'all';
      const query = status === 'all'
        ? db.prepare('SELECT * FROM cases WHERE guild_id = ? ORDER BY id DESC LIMIT 15').all(gid)
        : db.prepare('SELECT * FROM cases WHERE guild_id = ? AND status = ? ORDER BY id DESC LIMIT 15').all(gid, status);

      if (query.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('⚖️ Court Cases').setDescription('No cases found.')] });

      const statusEmoji = { filed: '🟡', in_progress: '🔵', closed: '🟢' };
      const list = query.map(c => `${statusEmoji[c.status] || '⚪'} **#${c.id}** — ${c.title} *(${c.status.replace('_', ' ')})*`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('⚖️ Court Docket').setDescription(list)] });
    }
  }
};
