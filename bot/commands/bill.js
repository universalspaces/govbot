import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import { errorEmbed, successEmbed, logActivity } from '../utils/helpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('bill')
    .setDescription('Manage legislation in the legislature')
    .addSubcommand(s => s
      .setName('propose')
      .setDescription('Propose a new bill')
      .addStringOption(o => o.setName('title').setDescription('Bill title').setRequired(true))
      .addStringOption(o => o.setName('content').setDescription('Bill content/text').setRequired(true)))
    .addSubcommand(s => s
      .setName('cosponsor')
      .setDescription('Co-sponsor an existing bill to show support')
      .addIntegerOption(o => o.setName('bill_id').setDescription('Bill ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('vote')
      .setDescription('Vote on a bill')
      .addIntegerOption(o => o.setName('bill_id').setDescription('Bill ID').setRequired(true))
      .addStringOption(o => o.setName('vote').setDescription('Your vote').setRequired(true)
        .addChoices(
          { name: 'Yes (Yea)', value: 'yes' },
          { name: 'No (Nay)', value: 'no' },
          { name: 'Abstain', value: 'abstain' }
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

      const result = db.prepare(`INSERT INTO bills (guild_id, title, content, sponsor_id, status) VALUES (?, ?, ?, ?, 'proposed')`)
        .run(gid, title, content, uid);

      // Sponsor auto-cosigns
      db.prepare('INSERT OR IGNORE INTO bill_cosponsors (bill_id, user_id) VALUES (?, ?)').run(result.lastInsertRowid, uid);
      logActivity(gid, 'BILL_PROPOSED', uid, title, '');

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📜 Bill Proposed: ${title}`)
        .setDescription(content.length > 1000 ? content.substring(0, 1000) + '…' : content)
        .addFields(
          { name: '🆔 Bill ID', value: `#${result.lastInsertRowid}`, inline: true },
          { name: '👤 Sponsor', value: `<@${uid}>`, inline: true },
          { name: '📋 Status', value: 'PROPOSED', inline: true }
        )
        .setFooter({ text: `Co-sponsor with /bill cosponsor bill_id:${result.lastInsertRowid} · Vote with /bill vote` })
        .setTimestamp();

      if (config?.legislature_channel) {
        const channel = await interaction.guild.channels.fetch(config.legislature_channel).catch(() => null);
        if (channel) {
          await channel.send({ embeds: [embed] });
          return interaction.reply({ content: `✅ Bill proposed and posted in ${channel}!`, ephemeral: true });
        }
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'cosponsor') {
      const billId = interaction.options.getInteger('bill_id');
      const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND guild_id = ?').get(billId, gid);
      if (!bill) return interaction.reply({ embeds: [errorEmbed(`Bill #${billId} not found.`)], ephemeral: true });
      if (bill.status !== 'proposed') return interaction.reply({ embeds: [errorEmbed('You can only co-sponsor bills that are still under consideration.')], ephemeral: true });
      if (bill.sponsor_id === uid) return interaction.reply({ embeds: [errorEmbed('You are already the primary sponsor of this bill.')], ephemeral: true });

      try {
        db.prepare('INSERT INTO bill_cosponsors (bill_id, user_id) VALUES (?, ?)').run(billId, uid);
      } catch (e) {
        return interaction.reply({ embeds: [errorEmbed('You have already co-sponsored this bill.')], ephemeral: true });
      }

      const coCount = db.prepare('SELECT COUNT(*) as cnt FROM bill_cosponsors WHERE bill_id = ?').get(billId).cnt;
      logActivity(gid, 'BILL_COSPONSORED', uid, bill.title, '');

      return interaction.reply({
        embeds: [successEmbed('Bill Co-sponsored',
          `You co-sponsored **${bill.title}**.\n\n📜 This bill now has **${coCount}** co-sponsor(s).`,
          gid
        )],
        ephemeral: true
      });
    }

    if (sub === 'vote') {
      const billId = interaction.options.getInteger('bill_id');
      const vote = interaction.options.getString('vote');
      const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND guild_id = ?').get(billId, gid);

      if (!bill) return interaction.reply({ embeds: [errorEmbed(`Bill #${billId} not found.`)], ephemeral: true });
      if (bill.status !== 'proposed') return interaction.reply({ embeds: [errorEmbed('This bill is no longer open for voting.')], ephemeral: true });

      const existing = db.prepare('SELECT * FROM bill_votes WHERE bill_id = ? AND voter_id = ?').get(billId, uid);
      if (existing) return interaction.reply({ embeds: [errorEmbed('You have already voted on this bill.')], ephemeral: true });

      db.prepare('INSERT INTO bill_votes (bill_id, voter_id, vote) VALUES (?, ?, ?)').run(billId, uid, vote);
      if (vote === 'yes') db.prepare('UPDATE bills SET votes_yes = votes_yes + 1 WHERE id = ?').run(billId);
      else if (vote === 'no') db.prepare('UPDATE bills SET votes_no = votes_no + 1 WHERE id = ?').run(billId);
      else db.prepare('UPDATE bills SET votes_abstain = votes_abstain + 1 WHERE id = ?').run(billId);

      const emoji = { yes: '✅', no: '❌', abstain: '⬛' };
      return interaction.reply({
        embeds: [successEmbed('Vote Recorded',
          `You voted **${emoji[vote]} ${vote.toUpperCase()}** on Bill #${billId}: **${bill.title}**`, gid
        )],
        ephemeral: true
      });
    }

    if (sub === 'pass') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('You need Manage Server permissions.')], ephemeral: true });
      }
      const billId = interaction.options.getInteger('bill_id');
      const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND guild_id = ?').get(billId, gid);
      if (!bill) return interaction.reply({ embeds: [errorEmbed(`Bill #${billId} not found.`)], ephemeral: true });

      const now = Math.floor(Date.now() / 1000);
      db.prepare(`UPDATE bills SET status = 'passed', voted_at = ? WHERE id = ?`).run(now, billId);
      db.prepare('INSERT INTO laws (guild_id, title, content, bill_id, enacted_by, enacted_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(gid, bill.title, bill.content, billId, uid, now);
      logActivity(gid, 'BILL_PASSED', uid, bill.title, '');

      const cosponsors = db.prepare('SELECT * FROM bill_cosponsors WHERE bill_id = ?').all(billId);
      const cosponsorText = cosponsors.length > 0
        ? cosponsors.map(c => `<@${c.user_id}>`).join(', ')
        : 'None';

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
        return interaction.reply({ embeds: [errorEmbed('You need Manage Server permissions.')], ephemeral: true });
      }
      const billId = interaction.options.getInteger('bill_id');
      const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND guild_id = ?').get(billId, gid);
      if (!bill) return interaction.reply({ embeds: [errorEmbed(`Bill #${billId} not found.`)], ephemeral: true });

      db.prepare(`UPDATE bills SET status = 'rejected', voted_at = ? WHERE id = ?`).run(Math.floor(Date.now() / 1000), billId);
      logActivity(gid, 'BILL_REJECTED', uid, bill.title, '');
      return interaction.reply({ embeds: [successEmbed('Bill Rejected', `Bill **#${billId} — ${bill.title}** has been rejected.`, gid)] });
    }

    if (sub === 'info') {
      const billId = interaction.options.getInteger('bill_id');
      const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND guild_id = ?').get(billId, gid);
      if (!bill) return interaction.reply({ embeds: [errorEmbed(`Bill #${billId} not found.`)], ephemeral: true });

      const cosponsors = db.prepare('SELECT * FROM bill_cosponsors WHERE bill_id = ?').all(billId);
      const cosponsorText = cosponsors
        .filter(c => c.user_id !== bill.sponsor_id)
        .map(c => `<@${c.user_id}>`).join(', ') || 'None';

      const statusColors = { proposed: 0x5865f2, passed: 0x57f287, rejected: 0xed4245 };
      const total = bill.votes_yes + bill.votes_no + bill.votes_abstain;

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
          { name: '👥 Co-sponsors', value: cosponsorText }
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const bills = db.prepare('SELECT * FROM bills WHERE guild_id = ? ORDER BY id DESC LIMIT 15').all(gid);
      if (bills.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('📜 Bills').setDescription('No bills have been proposed yet.')] });

      const statusEmoji = { proposed: '🟡', passed: '🟢', rejected: '🔴' };
      const list = bills.map(b => {
        const coCount = db.prepare('SELECT COUNT(*) as cnt FROM bill_cosponsors WHERE bill_id = ?').get(b.id).cnt;
        return `${statusEmoji[b.status] || '⚪'} **#${b.id}** — ${b.title} *(${coCount} co-sponsor${coCount !== 1 ? 's' : ''})*`;
      }).join('\n');

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
