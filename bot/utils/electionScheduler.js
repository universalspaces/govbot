import { EmbedBuilder } from 'discord.js';
import db from '../database.js';

export async function checkElections(client) {
  const now = Math.floor(Date.now() / 1000);

  // Start elections that are scheduled
  const toStart = db.prepare(`
    SELECT * FROM elections WHERE status = 'scheduled' AND starts_at <= ?
  `).all(now);

  for (const election of toStart) {
    db.prepare(`UPDATE elections SET status = 'active' WHERE id = ?`).run(election.id);
    await announceElectionStart(client, election);
  }

  // End active elections
  const toEnd = db.prepare(`
    SELECT * FROM elections WHERE status = 'active' AND ends_at <= ?
  `).all(now);

  for (const election of toEnd) {
    await closeElection(client, election);
  }
}

async function announceElectionStart(client, election) {
  const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(election.guild_id);
  if (!config?.election_channel) return;

  try {
    const guild = await client.guilds.fetch(election.guild_id);
    const channel = await guild.channels.fetch(config.election_channel);

    const candidates = db.prepare('SELECT * FROM candidates WHERE election_id = ?').all(election.id);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(`🗳️ Voting Has Begun: ${election.title}`)
      .setDescription(`**Office:** ${election.office}\n\nThe voting period is now open! Use \`/vote\` to cast your ballot.`)
      .addFields(
        { name: '📋 Candidates', value: candidates.length > 0 ? candidates.map(c => `<@${c.user_id}>`).join('\n') : 'No candidates', inline: false },
        { name: '⏰ Ends', value: `<t:${election.ends_at}:F>`, inline: true }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('Failed to announce election start:', e);
  }
}

export async function closeElection(client, election) {
  const candidates = db.prepare(`
    SELECT c.*, u.user_id FROM candidates c WHERE c.election_id = ? ORDER BY c.votes DESC
  `).all(election.id);

  const winner = candidates[0];
  db.prepare(`UPDATE elections SET status = 'closed', winner_id = ? WHERE id = ?`)
    .run(winner?.user_id || null, election.id);

  const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(election.guild_id);
  if (!config?.election_channel) return;

  try {
    const guild = await client.guilds.fetch(election.guild_id);
    const channel = await guild.channels.fetch(config.election_channel);

    const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);

    const resultsText = candidates.length > 0
      ? candidates.map((c, i) => {
          const pct = totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(1) : '0.0';
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▫️';
          return `${medal} <@${c.user_id}> — **${c.votes}** votes (${pct}%)`;
        }).join('\n')
      : 'No candidates ran.';

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(`📊 Election Results: ${election.title}`)
      .setDescription(`**Office:** ${election.office}\n\n${winner ? `🏆 **Winner: <@${winner.user_id}>**` : '⚠️ No winner — no candidates ran.'}`)
      .addFields(
        { name: '📋 Final Results', value: resultsText },
        { name: '🗳️ Total Votes Cast', value: `${totalVotes}`, inline: true }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    // Assign office if configured
    if (winner) {
      const office = db.prepare('SELECT * FROM offices WHERE guild_id = ? AND name = ?').get(election.guild_id, election.office);
      if (office?.role_id) {
        try {
          const member = await guild.members.fetch(winner.user_id);
          await member.roles.add(office.role_id);
        } catch (e) { /* role might not exist */ }
      }
      db.prepare('UPDATE offices SET holder_id = ?, assumed_at = ? WHERE guild_id = ? AND name = ?')
        .run(winner.user_id, Math.floor(Date.now() / 1000), election.guild_id, election.office);
    }
  } catch (e) {
    console.error('Failed to close election:', e);
  }
}
