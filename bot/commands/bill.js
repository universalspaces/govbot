import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database.js';
import { errorEmbed, successEmbed, logActivity, requireCitizen } from '../utils/helpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bill')
    .setDescription('Manage legislation in the legislature')
    .addSubcommand(s => s
      .setName('propose')
      .setDescription('Propose a new bill')
      .addStringOption(o => o.setName('title').setDescription('Bill title').setRequired(true))
      .addStringOption(o => o.setName('content').setDescription('Bill content/text').setRequired(true))
      .addIntegerOption(o => o.setName('voting_hours').setDescription('Close voting after this many hours (omit for no deadline)').setMinValue(1).setMaxValue(720))
      .addIntegerOption(o => o.setName('quorum').setDescription('Minimum votes required before the bill can pass or fail').setMinValue(1).setMaxValue(500)))
    .addSubcommand(s => s
      .setName('amend')
      .setDescription('Amend a bill before it passes (sponsor only or Admin)')
      .addIntegerOption(o => o.setName('bill_id').setDescription('Bill ID').setRequired(true))
      .addStringOption(o => o.setName('new_content').setDescription('Updated bill text').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason for amendment')))
    .addSubcommand(s => s
      .setName('cosponsor')
      .setDescription('Co-sponsor an existing bill to show support')
      .addIntegerOption(o => o.setName('bill_id').setDescription('Bill ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('vote')
      .setDescription('Vote on a bill (you may change your vote while it is still open)')
      .addIntegerOption(o => o.setName('bill_id').setDescription('Bill ID').setRequired(true))
      .addStringOption(o => o.setName('vote').setDescription('Your vote').setRequired(true)
        .addChoices(
          { name: '✅ Yes (Yea)', value: 'yes' },
          { name: '❌ No (Nay)', value: 'no' },
          { name: '⬛ Abstain', value: 'abstain' }
        )))
    .addSubcommand(s => s
      .setName('pass')
      .setDescription('Pass a bill into law (Admin only)')
      .addIntegerOption(o => o.setName('bill_id').setDescription('Bill ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('reject')
      .setDescription('Reject a bill (Admin only)')
      .addIntegerOption(o => o.setName('bill_id').setDescription('Bill ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('repeal')
      .setDescription('Repeal an enacted law (Admin only)')
      .addIntegerOption(o => o.setName('law_id').setDescription('Law §ID').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason for repeal')))
    .addSubcommand(s => s
      .setName('info')
      .setDescription('View bill details')
      .addIntegerOption(o => o.setName('bill_id').setDescription('Bill ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all bills'))
    .addSubcommand(s => s
      .setName('laws')
      .setDescription('View all enacted laws')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;
    const uid = interaction.user.id;
    const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(gid);

    if (sub === 'propose') {
      const title = interaction.options.getString('title');
      const content = interaction.options.getString('content');
      const votingHours = interaction.options.getInteger('voting_hours');
      const quorum = interaction.options.getInteger('quorum');

      const result = db.prepare(`INSERT INTO bills (guild_id, title, content, sponsor_id, status) VALUES (?, ?, ?, ?, 'proposed')`)
        .run(gid, title, content, uid);
      db.prepare('INSERT OR IGNORE INTO bill_cosponsors (bill_id, user_id) VALUES (?, ?)').run(result.lastInsertRowid, uid);

      // Store deadline/quorum config if provided
      if (votingHours || quorum) {
        const deadline = votingHours ? Math.floor(Date.now() / 1000) + votingHours * 3600 : null;
        db.prepare('INSERT INTO bill_voting_config (bill_id, quorum, voting_deadline) VALUES (?, ?, ?)').run(result.lastInsertRowid, quorum || null, deadline);
      }

      logActivity(gid, 'BILL_PROPOSED', uid, title, '');

      const deadlineText = votingHours ? `<t:${Math.floor(Date.now() / 1000) + votingHours * 3600}:F>` : 'No deadline';
      const quorumText = quorum ? `${quorum} votes required` : 'No quorum';

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📜 Bill Proposed: ${title}`)
        .setDescription(content.length > 1000 ? content.substring(0, 1000) + '…' : content)
        .addFields(
          { name: '🆔 Bill ID', value: `#${result.lastInsertRowid}`, inline: true },
          { name: '👤 Sponsor', value: `<@${uid}>`, inline: true },
          { name: '📋 Status', value: 'PROPOSED', inline: true },
          { name: '⏰ Voting Deadline', value: deadlineText, inline: true },
          { name: '🗳️ Quorum', value: quorumText, inline: true }
        )
        .setFooter({ text: `Bill #${result.lastInsertRowid} · Use the buttons below to vote` })
        .setTimestamp();

      const voteRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bill_vote:${result.lastInsertRowid}:yes`).setLabel('Yea').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`bill_vote:${result.lastInsertRowid}:no`).setLabel('Nay').setEmoji('❌').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`bill_vote:${result.lastInsertRowid}:abstain`).setLabel('Abstain').setEmoji('⬛').setStyle(ButtonStyle.Secondary),
      );

      if (config?.legislature_channel) {
        const channel = await interaction.guild.channels.fetch(config.legislature_channel).catch(() => null);
        if (channel) {
          await channel.send({ embeds: [embed], components: [voteRow] });
          return interaction.reply({ content: `✅ Bill proposed and posted in ${channel}!`, flags: 64 });
        }
      }
      return interaction.reply({ embeds: [embed], components: [voteRow] });
    }

    if (sub === 'amend') {
      const billId = interaction.options.getInteger('bill_id');
      const newContent = interaction.options.getString('new_content');
      const reason = interaction.options.getString('reason') || 'No reason provided.';
      const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND guild_id = ?').get(billId, gid);

      if (!bill) return interaction.reply({ embeds: [errorEmbed(`Bill #${billId} not found.`)], flags: 64 });
      if (bill.status !== 'proposed') return interaction.reply({ embeds: [errorEmbed('Only proposed bills can be amended.')], flags: 64 });
      if (bill.sponsor_id !== uid && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('Only the bill sponsor or an admin can amend a bill.')], flags: 64 });
      }

      // Reset all votes on amendment — the bill has changed
      db.prepare('DELETE FROM bill_votes WHERE bill_id = ?').run(billId);
      db.prepare('UPDATE bills SET content = ?, votes_yes = 0, votes_no = 0, votes_abstain = 0 WHERE id = ?').run(newContent, billId);
      logActivity(gid, 'BILL_AMENDED', uid, bill.title, reason);

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle(`📝 Bill Amended: ${bill.title}`)
        .setDescription(newContent.length > 900 ? newContent.substring(0, 900) + '…' : newContent)
        .addFields(
          { name: '📝 Reason', value: reason },
          { name: '⚠️ Note', value: 'All previous votes have been reset due to this amendment.', inline: false }
        )
        .setTimestamp();

      if (config?.legislature_channel) {
        const channel = await interaction.guild.channels.fetch(config.legislature_channel).catch(() => null);
        if (channel) await channel.send({ embeds: [embed] });
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'cosponsor') {
      const billId = interaction.options.getInteger('bill_id');
      const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND guild_id = ?').get(billId, gid);
      if (!bill) return interaction.reply({ embeds: [errorEmbed(`Bill #${billId} not found.`)], flags: 64 });
      if (bill.status !== 'proposed') return interaction.reply({ embeds: [errorEmbed('You can only co-sponsor bills that are still under consideration.')], flags: 64 });
      if (bill.sponsor_id === uid) return interaction.reply({ embeds: [errorEmbed('You are already the primary sponsor of this bill.')], flags: 64 });

      try {
        db.prepare('INSERT INTO bill_cosponsors (bill_id, user_id) VALUES (?, ?)').run(billId, uid);
      } catch (e) {
        return interaction.reply({ embeds: [errorEmbed('You have already co-sponsored this bill.')], flags: 64 });
      }

      const coCount = db.prepare('SELECT COUNT(*) as cnt FROM bill_cosponsors WHERE bill_id = ?').get(billId).cnt;
      logActivity(gid, 'BILL_COSPONSORED', uid, bill.title, '');

      return interaction.reply({
        embeds: [successEmbed('Bill Co-sponsored', `You co-sponsored **${bill.title}**.\n\n📜 This bill now has **${coCount}** co-sponsor(s).`, gid)],
        flags: 64
      });
    }

    if (sub === 'vote') {
      const billId = interaction.options.getInteger('bill_id');
      const vote = interaction.options.getString('vote');
      const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND guild_id = ?').get(billId, gid);

      if (!bill) return interaction.reply({ embeds: [errorEmbed(`Bill #${billId} not found.`)], flags: 64 });
      if (bill.status !== 'proposed') return interaction.reply({ embeds: [errorEmbed('This bill is no longer open for voting.')], flags: 64 });

      // Parliament role check — if set, only members with that role can vote on bills
      if (config?.parliament_role) {
        const member = await interaction.guild.members.fetch(uid).catch(() => null);
        if (!member?.roles.cache.has(config.parliament_role)) {
          return interaction.reply({ embeds: [errorEmbed(`Only members of <@&${config.parliament_role}> can vote on bills in this government.`)], flags: 64 });
        }
      } else if (config?.require_citizenship) {
        if (!await requireCitizen(interaction)) return;
      }

      const existing = db.prepare('SELECT * FROM bill_votes WHERE bill_id = ? AND voter_id = ?').get(billId, uid);
      const emoji = { yes: '✅', no: '❌', abstain: '⬛' };

      if (existing) {
        // Allow vote change
        if (existing.vote === vote) {
          return interaction.reply({ embeds: [errorEmbed(`You already voted **${emoji[vote]} ${vote.toUpperCase()}** on this bill.`)], flags: 64 });
        }
        // Remove old vote from tally
        if (existing.vote === 'yes') db.prepare('UPDATE bills SET votes_yes = votes_yes - 1 WHERE id = ?').run(billId);
        else if (existing.vote === 'no') db.prepare('UPDATE bills SET votes_no = votes_no - 1 WHERE id = ?').run(billId);
        else db.prepare('UPDATE bills SET votes_abstain = votes_abstain - 1 WHERE id = ?').run(billId);
        db.prepare('UPDATE bill_votes SET vote = ?, voted_at = ? WHERE bill_id = ? AND voter_id = ?')
          .run(vote, Math.floor(Date.now() / 1000), billId, uid);
        const msg = `Changed vote from **${emoji[existing.vote]} ${existing.vote.toUpperCase()}** to **${emoji[vote]} ${vote.toUpperCase()}** on Bill #${billId}: **${bill.title}**`;
        // Add new vote to tally
        if (vote === 'yes') db.prepare('UPDATE bills SET votes_yes = votes_yes + 1 WHERE id = ?').run(billId);
        else if (vote === 'no') db.prepare('UPDATE bills SET votes_no = votes_no + 1 WHERE id = ?').run(billId);
        else db.prepare('UPDATE bills SET votes_abstain = votes_abstain + 1 WHERE id = ?').run(billId);
        return interaction.reply({ embeds: [successEmbed('Vote Changed', msg, gid)], flags: 64 });
      }

      db.prepare('INSERT INTO bill_votes (bill_id, voter_id, vote) VALUES (?, ?, ?)').run(billId, uid, vote);
      if (vote === 'yes') db.prepare('UPDATE bills SET votes_yes = votes_yes + 1 WHERE id = ?').run(billId);
      else if (vote === 'no') db.prepare('UPDATE bills SET votes_no = votes_no + 1 WHERE id = ?').run(billId);
      else db.prepare('UPDATE bills SET votes_abstain = votes_abstain + 1 WHERE id = ?').run(billId);

      return interaction.reply({
        embeds: [successEmbed('Vote Recorded', `You voted **${emoji[vote]} ${vote.toUpperCase()}** on Bill #${billId}: **${bill.title}**`, gid)],
        flags: 64
      });
    }

    if (sub === 'pass') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('You need Manage Server permissions.')], flags: 64 });
      }
      const billId = interaction.options.getInteger('bill_id');
      const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND guild_id = ?').get(billId, gid);
      if (!bill) return interaction.reply({ embeds: [errorEmbed(`Bill #${billId} not found.`)], flags: 64 });
      if (bill.status !== 'proposed') return interaction.reply({ embeds: [errorEmbed('This bill is not in a proposed state.')], flags: 64 });

      // Check quorum
      const votingConfig = db.prepare('SELECT * FROM bill_voting_config WHERE bill_id = ?').get(billId);
      if (votingConfig?.quorum) {
        const totalVotes = bill.votes_yes + bill.votes_no + bill.votes_abstain;
        if (totalVotes < votingConfig.quorum) {
          return interaction.reply({ embeds: [errorEmbed(`Quorum not met. This bill requires **${votingConfig.quorum}** votes before it can pass — only **${totalVotes}** cast so far.`)], flags: 64 });
        }
      }

      const now = Math.floor(Date.now() / 1000);
      db.prepare(`UPDATE bills SET status = 'passed', voted_at = ? WHERE id = ?`).run(now, billId);
      db.prepare('INSERT INTO laws (guild_id, title, content, bill_id, enacted_by, enacted_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(gid, bill.title, bill.content, billId, uid, now);
      logActivity(gid, 'BILL_PASSED', uid, bill.title, '');

      // FIX: single query for cosponsors
      const cosponsors = db.prepare('SELECT * FROM bill_cosponsors WHERE bill_id = ?').all(billId);
      const cosponsorText = cosponsors.map(c => `<@${c.user_id}>`).join(', ') || 'None';

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`✅ Bill Passed Into Law: ${bill.title}`)
        .setDescription(bill.content.length > 800 ? bill.content.substring(0, 800) + '…' : bill.content)
        .addFields(
          { name: '✅ Yea', value: `${bill.votes_yes}`, inline: true },
          { name: '❌ Nay', value: `${bill.votes_no}`, inline: true },
          { name: '⬛ Abstain', value: `${bill.votes_abstain}`, inline: true },
          { name: '👥 Co-sponsors', value: cosponsorText },
          { name: '👤 Enacted by', value: `<@${uid}>`, inline: true }
        ).setTimestamp();

      if (config?.legislature_channel) {
        const channel = await interaction.guild.channels.fetch(config.legislature_channel).catch(() => null);
        if (channel) await channel.send({ embeds: [embed] });
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'reject') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('You need Manage Server permissions.')], flags: 64 });
      }
      const billId = interaction.options.getInteger('bill_id');
      const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND guild_id = ?').get(billId, gid);
      if (!bill) return interaction.reply({ embeds: [errorEmbed(`Bill #${billId} not found.`)], flags: 64 });
      if (bill.status !== 'proposed') return interaction.reply({ embeds: [errorEmbed('This bill is not in a proposed state.')], flags: 64 });

      // Check quorum
      const votingConfig = db.prepare('SELECT * FROM bill_voting_config WHERE bill_id = ?').get(billId);
      if (votingConfig?.quorum) {
        const totalVotes = bill.votes_yes + bill.votes_no + bill.votes_abstain;
        if (totalVotes < votingConfig.quorum) {
          return interaction.reply({ embeds: [errorEmbed(`Quorum not met. This bill requires **${votingConfig.quorum}** votes before it can be rejected — only **${totalVotes}** cast so far.`)], flags: 64 });
        }
      }

      db.prepare(`UPDATE bills SET status = 'rejected', voted_at = ? WHERE id = ?`).run(Math.floor(Date.now() / 1000), billId);
      logActivity(gid, 'BILL_REJECTED', uid, bill.title, '');
      return interaction.reply({ embeds: [successEmbed('Bill Rejected', `Bill **#${billId} — ${bill.title}** has been rejected.`, gid)] });
    }

    if (sub === 'repeal') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('You need Manage Server permissions.')], flags: 64 });
      }
      const lawId = interaction.options.getInteger('law_id');
      const reason = interaction.options.getString('reason') || 'No reason provided.';
      const law = db.prepare('SELECT * FROM laws WHERE id = ? AND guild_id = ? AND is_active = 1').get(lawId, gid);
      if (!law) return interaction.reply({ embeds: [errorEmbed(`Law §${lawId} not found or already repealed.`)], flags: 64 });

      db.prepare('UPDATE laws SET is_active = 0 WHERE id = ?').run(lawId);
      logActivity(gid, 'LAW_REPEALED', uid, law.title, reason);

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`🗑️ Law Repealed: §${lawId} — ${law.title}`)
        .addFields({ name: '📝 Reason', value: reason }, { name: '👤 Repealed by', value: `<@${uid}>`, inline: true })
        .setTimestamp();

      if (config?.legislature_channel) {
        const channel = await interaction.guild.channels.fetch(config.legislature_channel).catch(() => null);
        if (channel) await channel.send({ embeds: [embed] });
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'info') {
      const billId = interaction.options.getInteger('bill_id');
      const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND guild_id = ?').get(billId, gid);
      if (!bill) return interaction.reply({ embeds: [errorEmbed(`Bill #${billId} not found.`)], flags: 64 });

      const cosponsors = db.prepare('SELECT * FROM bill_cosponsors WHERE bill_id = ?').all(billId);
      const cosponsorText = cosponsors.filter(c => c.user_id !== bill.sponsor_id).map(c => `<@${c.user_id}>`).join(', ') || 'None';
      const votingConfig = db.prepare('SELECT * FROM bill_voting_config WHERE bill_id = ?').get(billId);
      const statusColors = { proposed: 0x5865f2, passed: 0x57f287, rejected: 0xed4245 };
      const total = bill.votes_yes + bill.votes_no + bill.votes_abstain;

      const quorumMet = !votingConfig?.quorum || total >= votingConfig.quorum;
      const quorumText = votingConfig?.quorum
        ? `${total}/${votingConfig.quorum} ${quorumMet ? '✅ Met' : '⏳ Not yet met'}`
        : 'No quorum set';

      const embed = new EmbedBuilder()
        .setColor(statusColors[bill.status] || 0x2f3136)
        .setTitle(`📜 Bill #${billId}: ${bill.title}`)
        .setDescription(bill.content.length > 900 ? bill.content.substring(0, 900) + '…' : bill.content)
        .addFields(
          { name: '📋 Status', value: bill.status.toUpperCase(), inline: true },
          { name: '👤 Sponsor', value: `<@${bill.sponsor_id}>`, inline: true },
          { name: '📅 Proposed', value: `<t:${bill.proposed_at}:D>`, inline: true },
          { name: '✅ Yea', value: `${bill.votes_yes}`, inline: true },
          { name: '❌ Nay', value: `${bill.votes_no}`, inline: true },
          { name: '⬛ Abstain', value: `${bill.votes_abstain} / ${total} total`, inline: true },
          { name: '🗳️ Quorum', value: quorumText, inline: true },
          { name: '⏰ Voting Deadline', value: votingConfig?.voting_deadline ? `<t:${votingConfig.voting_deadline}:F>` : 'No deadline', inline: true },
          { name: '👥 Co-sponsors', value: cosponsorText }
        );
      if (bill.status === 'proposed') {
        const voteRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`bill_vote:${billId}:yes`).setLabel('Yea').setEmoji('✅').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`bill_vote:${billId}:no`).setLabel('Nay').setEmoji('❌').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`bill_vote:${billId}:abstain`).setLabel('Abstain').setEmoji('⬛').setStyle(ButtonStyle.Secondary),
        );
        return interaction.reply({ embeds: [embed], components: [voteRow] });
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      // FIX: single query with co-sponsor counts (no N+1)
      const bills = db.prepare(`
        SELECT b.*, COUNT(bc.user_id) as cosponsor_count
        FROM bills b
        LEFT JOIN bill_cosponsors bc ON b.id = bc.bill_id
        WHERE b.guild_id = ?
        GROUP BY b.id
        ORDER BY b.id DESC LIMIT 15
      `).all(gid);

      if (bills.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('📜 Bills').setDescription('No bills have been proposed yet.')] });

      const statusEmoji = { proposed: '🟡', passed: '🟢', rejected: '🔴' };
      const list = bills.map(b =>
        `${statusEmoji[b.status] || '⚪'} **#${b.id}** — ${b.title} *(${b.cosponsor_count} co-sponsor${b.cosponsor_count !== 1 ? 's' : ''})*`
      ).join('\n');

      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('📜 Legislature — Bills').setDescription(list)] });
    }

    if (sub === 'laws') {
      const laws = db.prepare("SELECT * FROM laws WHERE guild_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 15").all(gid);
      if (laws.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('📖 Laws').setDescription('No laws have been enacted yet.')] });
      const list = laws.map(l => `**§${l.id}** — ${l.title} *(enacted <t:${l.enacted_at}:D>)*`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('📖 Enacted Laws').setDescription(list)] });
    }
  }
};
