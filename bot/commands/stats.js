import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database.js';
import { getOfficeName } from './vote.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View government statistics and analytics')
    .addSubcommand(s => s
      .setName('turnout')
      .setDescription('Voter turnout report for an election')
      .addIntegerOption(o => o.setName('election_id').setDescription('Election ID').setRequired(true)))
    .addSubcommand(s => s
      .setName('member')
      .setDescription('Political activity stats for a citizen')
      .addUserOption(o => o.setName('user').setDescription('User to view (defaults to yourself)')))
    .addSubcommand(s => s
      .setName('legislature')
      .setDescription('Legislature activity breakdown'))
    .addSubcommand(s => s
      .setName('parties')
      .setDescription('Party comparison stats')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;
    const uid = interaction.user.id;

    if (sub === 'turnout') {
      const electionId = interaction.options.getInteger('election_id');
      const election = db.prepare('SELECT * FROM elections WHERE id = ? AND guild_id = ?').get(electionId, gid);
      if (!election) return interaction.reply({ embeds: [errorEmbed(`Election #${electionId} not found.`)], flags: 64 });

      const isRCV = election.office?.includes('|type:rcv');
      const officeName = getOfficeName(election);

      let totalVotes, candidates;
      if (isRCV) {
        totalVotes = db.prepare('SELECT COUNT(*) as cnt FROM rcv_votes WHERE election_id = ?').get(electionId).cnt;
        candidates = db.prepare('SELECT * FROM candidates WHERE election_id = ?').all(electionId);
      } else {
        candidates = db.prepare('SELECT * FROM candidates WHERE election_id = ? ORDER BY votes DESC').all(electionId);
        totalVotes = candidates.reduce((s, c) => s + c.votes, 0);
      }

      const totalCitizens = db.prepare('SELECT COUNT(*) as cnt FROM citizens WHERE guild_id = ?').get(gid).cnt;
      const turnoutPct = totalCitizens > 0 ? ((totalVotes / totalCitizens) * 100).toFixed(1) : '0.0';

      // Participation bar
      const filled = Math.round(parseFloat(turnoutPct) / 10);
      const bar = '█'.repeat(Math.min(10, filled)) + '░'.repeat(Math.max(0, 10 - filled));

      const candLines = candidates.map((c, i) => {
        const pct = totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(1) : '0.0';
        const medal = ['🥇', '🥈', '🥉'][i] || '▫️';
        return `${medal} <@${c.user_id}> — **${c.votes}** votes (${pct}%)`;
      }).join('\n') || '*No candidates.*';

      const statusColors = { registration: 0x5865f2, active: 0x57f287, closed: 0xfee75c };

      const embed = new EmbedBuilder()
        .setColor(statusColors[election.status] || 0x2f3136)
        .setTitle(`📊 Voter Turnout — ${election.title}`)
        .addFields(
          { name: '💼 Office', value: officeName, inline: true },
          { name: '🗳️ Voting System', value: isRCV ? 'Ranked Choice' : 'First Past the Post', inline: true },
          { name: '📋 Status', value: election.status.toUpperCase(), inline: true },
          { name: '🗳️ Votes Cast', value: `${totalVotes}`, inline: true },
          { name: '👥 Registered Citizens', value: `${totalCitizens}`, inline: true },
          { name: '📈 Turnout Rate', value: `${turnoutPct}%`, inline: true },
          { name: '📊 Participation', value: `\`${bar}\` ${turnoutPct}%` },
          { name: `👥 Results (${candidates.length} candidate${candidates.length !== 1 ? 's' : ''})`, value: candLines }
        );

      if (election.winner_id) {
        embed.addFields({ name: '🏆 Winner', value: `<@${election.winner_id}>`, inline: true });
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'member') {
      const target = interaction.options.getUser('user') || interaction.user;
      const citizen = db.prepare('SELECT * FROM citizens WHERE guild_id = ? AND user_id = ?').get(gid, target.id);

      const votesInElections = db.prepare('SELECT COUNT(*) as cnt FROM votes WHERE voter_id = ? AND election_id IN (SELECT id FROM elections WHERE guild_id = ?)').get(target.id, gid).cnt;
      const rcvVotes = db.prepare('SELECT COUNT(*) as cnt FROM rcv_votes WHERE voter_id = ? AND election_id IN (SELECT id FROM elections WHERE guild_id = ?)').get(target.id, gid).cnt;
      const totalVotesCast = votesInElections + rcvVotes;

      const electionsRun = db.prepare('SELECT COUNT(*) as cnt FROM candidates WHERE user_id = ? AND election_id IN (SELECT id FROM elections WHERE guild_id = ?)').get(target.id, gid).cnt;
      const electionsWon = db.prepare("SELECT COUNT(*) as cnt FROM elections WHERE guild_id = ? AND winner_id = ?").get(gid, target.id).cnt;
      const billsProposed = db.prepare('SELECT COUNT(*) as cnt FROM bills WHERE guild_id = ? AND sponsor_id = ?').get(gid, target.id).cnt;
      const billsPassed = db.prepare("SELECT COUNT(*) as cnt FROM bills WHERE guild_id = ? AND sponsor_id = ? AND status = 'passed'").get(gid, target.id).cnt;
      const billsCoSponsored = db.prepare('SELECT COUNT(*) as cnt FROM bill_cosponsors WHERE user_id = ? AND bill_id IN (SELECT id FROM bills WHERE guild_id = ?)').get(target.id, gid).cnt;
      const initiativesFiled = db.prepare('SELECT COUNT(*) as cnt FROM initiatives WHERE guild_id = ? AND creator_id = ?').get(gid, target.id).cnt;
      const initiativesFulfilled = db.prepare("SELECT COUNT(*) as cnt FROM initiatives WHERE guild_id = ? AND creator_id = ? AND status = 'fulfilled'").get(gid, target.id).cnt;
      const casesFiled = db.prepare('SELECT COUNT(*) as cnt FROM cases WHERE guild_id = ? AND plaintiff_id = ?').get(gid, target.id).cnt;
      const referendumVotes = db.prepare('SELECT COUNT(*) as cnt FROM referendum_votes WHERE voter_id = ? AND referendum_id IN (SELECT id FROM referendums WHERE guild_id = ?)').get(target.id, gid).cnt;
      const officesHeld = db.prepare('SELECT COUNT(*) as cnt FROM office_history WHERE guild_id = ? AND user_id = ?').get(gid, target.id).cnt;
      const currentOffices = db.prepare('SELECT * FROM offices WHERE guild_id = ? AND holder_id = ?').all(gid, target.id);

      const party = db.prepare('SELECT p.* FROM party_members pm JOIN parties p ON pm.party_id = p.id WHERE pm.guild_id = ? AND pm.user_id = ?').get(gid, target.id);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📊 Political Stats: ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '🪪 Citizen', value: citizen ? `#${citizen.citizen_number} · Rep: ${citizen.reputation >= 0 ? '+' : ''}${citizen.reputation}` : '*Not registered*', inline: true },
          { name: '🏛️ Party', value: party ? `${party.emoji} ${party.name}` : 'Independent', inline: true },
          { name: '💼 Current Offices', value: currentOffices.length > 0 ? currentOffices.map(o => o.name).join(', ') : 'None', inline: true },

          { name: '🗳️ Voting', value: [
            `Elections voted in: **${totalVotesCast}**`,
            `Referendums voted in: **${referendumVotes}**`,
          ].join('\n'), inline: true },

          { name: '🏆 Elected Office', value: [
            `Times ran: **${electionsRun}**`,
            `Elections won: **${electionsWon}**`,
            `Offices held (history): **${officesHeld}**`,
          ].join('\n'), inline: true },

          { name: '📜 Legislation', value: [
            `Bills proposed: **${billsProposed}**`,
            `Bills passed: **${billsPassed}**`,
            `Bills co-sponsored: **${billsCoSponsored}**`,
          ].join('\n'), inline: true },

          { name: '📣 Civic Activity', value: [
            `Initiatives filed: **${initiativesFiled}** (${initiativesFulfilled} fulfilled)`,
            `Court cases filed: **${casesFiled}**`,
          ].join('\n'), inline: false }
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'legislature') {
      const totalBills = db.prepare('SELECT COUNT(*) as cnt FROM bills WHERE guild_id = ?').get(gid).cnt;
      const passedBills = db.prepare("SELECT COUNT(*) as cnt FROM bills WHERE guild_id = ? AND status = 'passed'").get(gid).cnt;
      const rejectedBills = db.prepare("SELECT COUNT(*) as cnt FROM bills WHERE guild_id = ? AND status = 'rejected'").get(gid).cnt;
      const pendingBills = db.prepare("SELECT COUNT(*) as cnt FROM bills WHERE guild_id = ? AND status = 'proposed'").get(gid).cnt;
      const totalLaws = db.prepare("SELECT COUNT(*) as cnt FROM laws WHERE guild_id = ? AND is_active = 1").get(gid).cnt;
      const passRate = totalBills > 0 ? ((passedBills / totalBills) * 100).toFixed(1) : '0.0';

      // Top sponsors
      const topSponsors = db.prepare(`
        SELECT sponsor_id, COUNT(*) as total,
          SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed
        FROM bills WHERE guild_id = ?
        GROUP BY sponsor_id ORDER BY total DESC LIMIT 5
      `).all(gid);

      const sponsorText = topSponsors.length > 0
        ? topSponsors.map((s, i) => `**${i + 1}.** <@${s.sponsor_id}> — ${s.total} bill${s.total !== 1 ? 's' : ''} (${s.passed} passed)`)
            .join('\n')
        : '*No bills yet.*';

      // Most co-sponsored bills
      const topBills = db.prepare(`
        SELECT b.id, b.title, b.status, COUNT(bc.user_id) as cosignatures
        FROM bills b LEFT JOIN bill_cosponsors bc ON b.id = bc.bill_id
        WHERE b.guild_id = ?
        GROUP BY b.id ORDER BY cosignatures DESC LIMIT 3
      `).all(gid);

      const topBillsText = topBills.length > 0
        ? topBills.map(b => `**#${b.id}** ${b.title} — ${b.cosignatures} co-sponsor${b.cosignatures !== 1 ? 's' : ''}`).join('\n')
        : '*No bills yet.*';

      const passBar = Math.round(parseFloat(passRate) / 10);
      const bar = '█'.repeat(Math.min(10, passBar)) + '░'.repeat(Math.max(0, 10 - passBar));

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📋 Legislature Statistics')
        .addFields(
          { name: '📊 Bills Overview', value: [
            `Total bills: **${totalBills}**`,
            `Passed: **${passedBills}** · Rejected: **${rejectedBills}** · Pending: **${pendingBills}**`,
            `Pass rate: \`${bar}\` ${passRate}%`,
          ].join('\n') },
          { name: '📖 Laws on the Books', value: `**${totalLaws}**`, inline: true },
          { name: '🏆 Top Sponsors', value: sponsorText },
          { name: '✍️ Most Co-sponsored Bills', value: topBillsText }
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'parties') {
      const parties = db.prepare('SELECT * FROM parties WHERE guild_id = ? AND is_active = 1').all(gid);
      if (parties.length === 0) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🏛️ Party Stats').setDescription('No parties have been formed yet.')] });
      }

      // FIX: batch queries instead of N+1 loops
      const partyIds = parties.map(p => p.id);
      const placeholders = partyIds.map(() => '?').join(',');

      const memberCounts = db.prepare(`SELECT party_id, COUNT(*) as cnt FROM party_members WHERE party_id IN (${placeholders}) GROUP BY party_id`).all(...partyIds);
      const memberMap = Object.fromEntries(memberCounts.map(r => [r.party_id, r.cnt]));

      const winnerRows = db.prepare(`
        SELECT pm.party_id, COUNT(*) as cnt FROM elections e
        JOIN party_members pm ON e.winner_id = pm.user_id AND pm.party_id IN (${placeholders})
        WHERE e.guild_id = ? GROUP BY pm.party_id
      `).all(...partyIds, gid);
      const winsMap = Object.fromEntries(winnerRows.map(r => [r.party_id, r.cnt]));

      const billRows = db.prepare(`
        SELECT pm.party_id, COUNT(*) as cnt FROM bills b
        JOIN party_members pm ON b.sponsor_id = pm.user_id AND pm.party_id IN (${placeholders})
        WHERE b.guild_id = ? AND b.status = 'passed' GROUP BY pm.party_id
      `).all(...partyIds, gid);
      const billsMap = Object.fromEntries(billRows.map(r => [r.party_id, r.cnt]));

      const officeRows = db.prepare(`
        SELECT pm.party_id, COUNT(*) as cnt FROM offices o
        JOIN party_members pm ON o.holder_id = pm.user_id AND pm.party_id IN (${placeholders})
        WHERE o.guild_id = ? GROUP BY pm.party_id
      `).all(...partyIds, gid);
      const officesMap = Object.fromEntries(officeRows.map(r => [r.party_id, r.cnt]));

      const fields = parties.map(p => ({
        name: `${p.emoji} ${p.name} (${p.abbreviation})`,
        value: [
          `👥 Members: **${memberMap[p.id] || 0}**`,
          `🏆 Elections won: **${winsMap[p.id] || 0}**`,
          `📜 Bills passed: **${billsMap[p.id] || 0}**`,
          `💼 Offices held: **${officesMap[p.id] || 0}**`,
        ].join('\n'),
        inline: true
      }));

      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🏛️ Party Comparison Stats').addFields(fields)]
      });
    }
  }
};
