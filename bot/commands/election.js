import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import db from '../database.js';
import { successEmbed, errorEmbed, infoEmbed, logActivity } from '../utils/helpers.js';
import { closeElection } from '../utils/electionScheduler.js';

export default {
  data: new SlashCommandBuilder()
    .setName('election')
    .setDescription('Manage elections')
    .addSubcommand(s => s
      .setName('create')
      .setDescription('Create a new election')
      .addStringOption(o => o.setName('title').setDescription('Election title').setRequired(true))
      .addStringOption(o => o.setName('office').setDescription('Office being contested').setRequired(true))
      .addIntegerOption(o => o.setName('hours').setDescription('Voting duration in hours (default: 48)').setMinValue(1).setMaxValue(720))
      .addStringOption(o => o.setName('description').setDescription('Election description'))
      .addStringOption(o => o.setName('type').setDescription('Voting system').addChoices(
        { name: 'First Past the Post (default)', value: 'fptp' },
        { name: 'Ranked Choice Voting (RCV)', value: 'rcv' }
      )))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('View all elections'))
    .addSubcommand(s => s
      .setName('info')
      .setDescription('View election details')
      .addIntegerOption(o => o.setName('id').setDescription('Election ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('open')
      .setDescription('Open an election for voting immediately')
      .addIntegerOption(o => o.setName('id').setDescription('Election ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('close')
      .setDescription('Force-close an election and tally results')
      .addIntegerOption(o => o.setName('id').setDescription('Election ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('register')
      .setDescription('Register as a candidate in an election')
      .addIntegerOption(o => o.setName('id').setDescription('Election ID').setRequired(true))
      .addStringOption(o => o.setName('platform').setDescription('Your campaign platform/manifesto'))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;
    const uid = interaction.user.id;

    if (sub === 'create') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('You need Manage Server permissions.')], ephemeral: true });
      }

      const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(gid);
      const hours = interaction.options.getInteger('hours') || config?.election_duration_hours || 48;
      const title = interaction.options.getString('title');
      const office = interaction.options.getString('office');
      const description = interaction.options.getString('description') || '';
      const type = interaction.options.getString('type') || 'fptp';

      const now = Math.floor(Date.now() / 1000);
      const endsAt = now + (hours * 3600);

      const result = db.prepare(`
        INSERT INTO elections (guild_id, title, office, description, status, starts_at, ends_at, created_by)
        VALUES (?, ?, ?, ?, 'registration', ?, ?, ?)
      `).run(gid, title, `${office}|type:${type}`, description, now, endsAt, uid);

      logActivity(gid, 'ELECTION_CREATED', uid, title, `Office: ${office}, Type: ${type.toUpperCase()}`);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🗳️ New Election Created!')
        .setDescription(`**${title}**\n${description}`)
        .addFields(
          { name: '🏛️ Office', value: office, inline: true },
          { name: '🆔 Election ID', value: `#${result.lastInsertRowid}`, inline: true },
          { name: '🗳️ Voting System', value: type === 'rcv' ? '📊 Ranked Choice' : '🥇 First Past the Post', inline: true },
          { name: '📋 Status', value: '`Registration Open`', inline: true },
          { name: '⏰ Voting Ends', value: `<t:${endsAt}:F>`, inline: false }
        )
        .setFooter({ text: `Use /election register id:${result.lastInsertRowid} to run for office!` })
        .setTimestamp();

      const channel = config?.election_channel
        ? await interaction.guild.channels.fetch(config.election_channel).catch(() => null)
        : null;

      if (channel && channel.id !== interaction.channelId) {
        await channel.send({ embeds: [embed] });
        return interaction.reply({ content: `✅ Election created and announced in ${channel}!`, ephemeral: true });
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const elections = db.prepare(`SELECT * FROM elections WHERE guild_id = ? ORDER BY id DESC LIMIT 15`).all(gid);

      if (elections.length === 0) {
        return interaction.reply({ embeds: [infoEmbed('🗳️ Elections', 'No elections have been created yet.', gid)] });
      }

      const statusEmoji = { registration: '📋', scheduled: '📅', active: '🟢', closed: '🔴' };
      const list = elections.map(e => `${statusEmoji[e.status] || '❓'} **#${e.id}** — ${e.title} *(${e.office})*`).join('\n');

      return interaction.reply({ embeds: [infoEmbed('🗳️ All Elections', list, gid)] });
    }

    if (sub === 'info') {
      const id = interaction.options.getInteger('id');
      const election = db.prepare('SELECT * FROM elections WHERE id = ? AND guild_id = ?').get(id, gid);
      if (!election) return interaction.reply({ embeds: [errorEmbed(`Election #${id} not found.`)], ephemeral: true });

      const candidates = db.prepare('SELECT * FROM candidates WHERE election_id = ? ORDER BY votes DESC').all(id);
      const totalVotes = candidates.reduce((s, c) => s + c.votes, 0);

      const candText = candidates.length > 0
        ? candidates.map(c => {
            const pct = totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(1) : '0.0';
            return `<@${c.user_id}> — ${c.votes} vote(s) (${pct}%)`;
          }).join('\n')
        : '*No candidates yet. Use `/election register` to run!*';

      const statusColors = { registration: 0x5865f2, scheduled: 0xfee75c, active: 0x57f287, closed: 0xed4245 };

      const embed = new EmbedBuilder()
        .setColor(statusColors[election.status] || 0x2f3136)
        .setTitle(`🗳️ Election #${id}: ${election.title}`)
        .setDescription(election.description || '*No description.*')
        .addFields(
          { name: '🏛️ Office', value: election.office, inline: true },
          { name: '📋 Status', value: election.status.toUpperCase(), inline: true },
          { name: '🗳️ Total Votes', value: `${totalVotes}`, inline: true },
          { name: '📅 Voting Ends', value: `<t:${election.ends_at}:F>`, inline: false },
          { name: '👥 Candidates', value: candText, inline: false }
        );

      if (election.winner_id) embed.addFields({ name: '🏆 Winner', value: `<@${election.winner_id}>`, inline: false });
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'open') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('You need Manage Server permissions.')], ephemeral: true });
      }
      const id = interaction.options.getInteger('id');
      const election = db.prepare('SELECT * FROM elections WHERE id = ? AND guild_id = ?').get(id, gid);
      if (!election) return interaction.reply({ embeds: [errorEmbed(`Election #${id} not found.`)], ephemeral: true });
      if (election.status === 'active') return interaction.reply({ embeds: [errorEmbed('Election is already active.')], ephemeral: true });

      db.prepare(`UPDATE elections SET status = 'active', starts_at = ? WHERE id = ?`).run(Math.floor(Date.now() / 1000), id);
      return interaction.reply({ embeds: [successEmbed('Election Opened', `Election **#${id} — ${election.title}** is now open for voting! Use \`/vote ${id}\` to cast your ballot.`, gid)] });
    }

    if (sub === 'close') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('You need Manage Server permissions.')], ephemeral: true });
      }
      const id = interaction.options.getInteger('id');
      const election = db.prepare('SELECT * FROM elections WHERE id = ? AND guild_id = ?').get(id, gid);
      if (!election) return interaction.reply({ embeds: [errorEmbed(`Election #${id} not found.`)], ephemeral: true });
      if (election.status === 'closed') return interaction.reply({ embeds: [errorEmbed('Election is already closed.')], ephemeral: true });

      await interaction.deferReply();
      await closeElection(client, election);
      return interaction.editReply({ embeds: [successEmbed('Election Closed', `Election **#${id}** has been closed and results tallied.`, gid)] });
    }

    if (sub === 'register') {
      const id = interaction.options.getInteger('id');
      const platform = interaction.options.getString('platform') || 'No platform statement provided.';
      const election = db.prepare('SELECT * FROM elections WHERE id = ? AND guild_id = ?').get(id, gid);

      if (!election) return interaction.reply({ embeds: [errorEmbed(`Election #${id} not found.`)], ephemeral: true });
      if (!['registration', 'active'].includes(election.status)) {
        return interaction.reply({ embeds: [errorEmbed('Registration is not open for this election.')], ephemeral: true });
      }

      // Term limit check
      const officeName = election.office.replace(/\|type:\w+/, '').trim();
      const limit = db.prepare('SELECT * FROM term_limits WHERE guild_id = ? AND LOWER(office_name) = LOWER(?)').get(gid, officeName);
      if (limit) {
        const termsServed = db.prepare('SELECT COUNT(*) as cnt FROM office_history WHERE guild_id = ? AND office_name = ? AND user_id = ?')
          .get(gid, officeName, uid).cnt;
        if (termsServed >= limit.max_terms) {
          return interaction.reply({ embeds: [errorEmbed(`You have served the maximum **${limit.max_terms}** term(s) as **${officeName}** and are ineligible to run again.`)], ephemeral: true });
        }
      }

      const party = db.prepare('SELECT p.* FROM party_members pm JOIN parties p ON pm.party_id = p.id WHERE pm.guild_id = ? AND pm.user_id = ?').get(gid, uid);

      try {
        db.prepare(`INSERT INTO candidates (election_id, user_id, party_id, platform) VALUES (?, ?, ?, ?)`)
          .run(id, uid, party?.id || null, platform);
      } catch (e) {
        return interaction.reply({ embeds: [errorEmbed('You are already registered in this election.')], ephemeral: true });
      }

      logActivity(gid, 'CANDIDATE_REGISTERED', uid, `Election #${id}`, platform);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🎉 Candidacy Registered!')
        .setDescription(`<@${uid}> is now running for **${election.office}** in **${election.title}**!`)
        .addFields(
          { name: '📜 Platform', value: platform },
          { name: '🏛️ Party', value: party ? `${party.emoji} ${party.name}` : 'Independent' }
        );

      return interaction.reply({ embeds: [embed] });
    }
  }
};
