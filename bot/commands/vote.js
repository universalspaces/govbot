import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database.js';
import { errorEmbed, logActivity } from '../utils/helpers.js';

export function getElectionType(election) {
  if (election.office?.includes('|type:rcv')) return 'rcv';
  return 'fptp';
}

export function getOfficeName(election) {
  return (election.office || '').replace(/\|type:\w+/, '').trim();
}

// Instant-runoff RCV tallying
export function runRCV(electionId) {
  const candidates = db.prepare('SELECT * FROM candidates WHERE election_id = ?').all(electionId);
  const allVotes = db.prepare('SELECT * FROM rcv_votes WHERE election_id = ?').all(electionId);
  if (allVotes.length === 0 || candidates.length === 0) return { winner: null, rounds: [] };

  const active = new Set(candidates.map(c => c.id));
  const rounds = [];
  const totalVoters = allVotes.length;

  while (active.size > 1) {
    const tally = {};
    active.forEach(id => (tally[id] = 0));

    for (const ballot of allVotes) {
      const prefs = JSON.parse(ballot.preferences);
      const top = prefs.find(p => active.has(p));
      if (top !== undefined) tally[top] = (tally[top] || 0) + 1;
    }

    const roundResult = candidates
      .filter(c => active.has(c.id))
      .map(c => ({ id: c.id, user_id: c.user_id, votes: tally[c.id] || 0 }))
      .sort((a, b) => b.votes - a.votes);

    rounds.push(roundResult);

    if (roundResult[0].votes > totalVoters / 2) {
      return { winner: roundResult[0].user_id, winnerId: roundResult[0].id, rounds };
    }

    const minVotes = roundResult[roundResult.length - 1].votes;
    roundResult.filter(r => r.votes === minVotes).forEach(r => active.delete(r.id));

    if (active.size === 1) {
      const lastId = [...active][0];
      const last = candidates.find(c => c.id === lastId);
      return { winner: last.user_id, winnerId: lastId, rounds };
    }
  }

  const lastId = [...active][0];
  const last = candidates.find(c => c.id === lastId);
  return { winner: last?.user_id || null, winnerId: lastId, rounds };
}

export default {
  data: new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Cast your vote in an active election')
    .addIntegerOption(o => o.setName('election_id').setDescription('The election ID').setRequired(true))
    .addUserOption(o => o.setName('candidate').setDescription('Candidate to vote for (FPTP) or 1st choice (RCV)').setRequired(true))
    .addUserOption(o => o.setName('rank2').setDescription('2nd choice (RCV only)'))
    .addUserOption(o => o.setName('rank3').setDescription('3rd choice (RCV only)'))
    .addUserOption(o => o.setName('rank4').setDescription('4th choice (RCV only)'))
    .addUserOption(o => o.setName('rank5').setDescription('5th choice (RCV only)')),

  async execute(interaction) {
    const gid = interaction.guildId;
    const uid = interaction.user.id;
    const electionId = interaction.options.getInteger('election_id');

    const election = db.prepare('SELECT * FROM elections WHERE id = ? AND guild_id = ?').get(electionId, gid);
    if (!election) return interaction.reply({ embeds: [errorEmbed(`Election #${electionId} not found.`)], ephemeral: true });
    if (election.status !== 'active') return interaction.reply({ embeds: [errorEmbed('This election is not currently open for voting.')], ephemeral: true });

    const type = getElectionType(election);
    const candidate1 = interaction.options.getUser('candidate');

    if (type === 'fptp') {
      const existing = db.prepare('SELECT * FROM votes WHERE election_id = ? AND voter_id = ?').get(electionId, uid);
      if (existing) return interaction.reply({ embeds: [errorEmbed('You have already voted in this election.')], ephemeral: true });

      const candidate = db.prepare('SELECT * FROM candidates WHERE election_id = ? AND user_id = ?').get(electionId, candidate1.id);
      if (!candidate) return interaction.reply({ embeds: [errorEmbed(`${candidate1.username} is not a candidate in this election.`)], ephemeral: true });

      db.prepare('INSERT INTO votes (election_id, voter_id, candidate_id) VALUES (?, ?, ?)').run(electionId, uid, candidate.id);
      db.prepare('UPDATE candidates SET votes = votes + 1 WHERE id = ?').run(candidate.id);
      logActivity(gid, 'VOTE_CAST', uid, `Election #${electionId}`, `Voted for ${candidate1.id}`);

      const party = candidate.party_id ? db.prepare('SELECT * FROM parties WHERE id = ?').get(candidate.party_id) : null;

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('🗳️ Vote Cast!')
          .setDescription(`You voted for **${candidate1.username}** in **${election.title}**.`)
          .addFields({ name: '🏛️ Party', value: party ? `${party.emoji} ${party.name}` : 'Independent', inline: true })
          .setFooter({ text: 'Your vote has been recorded.' })],
        ephemeral: true
      });
    }

    // RCV
    const existing = db.prepare('SELECT * FROM rcv_votes WHERE election_id = ? AND voter_id = ?').get(electionId, uid);
    if (existing) return interaction.reply({ embeds: [errorEmbed('You have already voted in this election.')], ephemeral: true });

    const allCandidates = db.prepare('SELECT * FROM candidates WHERE election_id = ?').all(electionId);
    const candidateMap = new Map(allCandidates.map(c => [c.user_id, c]));

    const rankInputs = [
      candidate1,
      interaction.options.getUser('rank2'),
      interaction.options.getUser('rank3'),
      interaction.options.getUser('rank4'),
      interaction.options.getUser('rank5'),
    ].filter(Boolean);

    const seen = new Set();
    const preferences = [];
    for (const user of rankInputs) {
      if (!candidateMap.has(user.id)) return interaction.reply({ embeds: [errorEmbed(`${user.username} is not a candidate.`)], ephemeral: true });
      if (seen.has(user.id)) return interaction.reply({ embeds: [errorEmbed(`You ranked ${user.username} more than once.`)], ephemeral: true });
      seen.add(user.id);
      preferences.push(candidateMap.get(user.id).id);
    }

    db.prepare('INSERT INTO rcv_votes (election_id, voter_id, preferences) VALUES (?, ?, ?)').run(electionId, uid, JSON.stringify(preferences));
    logActivity(gid, 'RCV_VOTE_CAST', uid, `Election #${electionId}`, `${preferences.length} preferences`);

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('📊 Ranked Choice Vote Cast!')
        .setDescription(`Your ballot for **${election.title}** has been recorded.`)
        .addFields({ name: '🏆 Your Rankings', value: rankInputs.map((u, i) => `**${i + 1}.** ${u.username}`).join('\n') })
        .setFooter({ text: 'Results use instant-runoff to find the majority winner.' })],
      ephemeral: true
    });
  }
};
