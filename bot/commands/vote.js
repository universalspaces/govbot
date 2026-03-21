import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database.js';
import { errorEmbed, successEmbed, logActivity } from '../utils/helpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Cast your vote in an active election')
    .addIntegerOption(o => o.setName('election_id').setDescription('The election ID').setRequired(true))
    .addUserOption(o => o.setName('candidate').setDescription('The candidate you want to vote for').setRequired(true)),

  async execute(interaction) {
    const gid = interaction.guildId;
    const uid = interaction.user.id;
    const electionId = interaction.options.getInteger('election_id');
    const candidateUser = interaction.options.getUser('candidate');

    const election = db.prepare('SELECT * FROM elections WHERE id = ? AND guild_id = ?').get(electionId, gid);
    if (!election) return interaction.reply({ embeds: [errorEmbed(`Election #${electionId} not found.`)], ephemeral: true });
    if (election.status !== 'active') return interaction.reply({ embeds: [errorEmbed('This election is not currently open for voting.')], ephemeral: true });

    const candidate = db.prepare('SELECT * FROM candidates WHERE election_id = ? AND user_id = ?').get(electionId, candidateUser.id);
    if (!candidate) return interaction.reply({ embeds: [errorEmbed(`${candidateUser.username} is not a candidate in this election.`)], ephemeral: true });

    const existingVote = db.prepare('SELECT * FROM votes WHERE election_id = ? AND voter_id = ?').get(electionId, uid);
    if (existingVote) return interaction.reply({ embeds: [errorEmbed('You have already voted in this election.')], ephemeral: true });

    db.prepare('INSERT INTO votes (election_id, voter_id, candidate_id) VALUES (?, ?, ?)').run(electionId, uid, candidate.id);
    db.prepare('UPDATE candidates SET votes = votes + 1 WHERE id = ?').run(candidate.id);
    logActivity(gid, 'VOTE_CAST', uid, `Election #${electionId}`, `Voted for ${candidateUser.id}`);

    const party = candidate.party_id
      ? db.prepare('SELECT * FROM parties WHERE id = ?').get(candidate.party_id)
      : null;

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🗳️ Vote Cast!')
      .setDescription(`You voted for **${candidateUser.username}** in **${election.title}**.`)
      .addFields({ name: '🏛️ Party', value: party ? `${party.emoji} ${party.name}` : 'Independent', inline: true })
      .setFooter({ text: 'Your vote has been recorded anonymously.' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
