import { EmbedBuilder } from 'discord.js';
import db from '../database.js';
import { getElectionType, getOfficeName, runRCV } from '../commands/vote.js';

export async function checkElections(client) {
  const now = Math.floor(Date.now() / 1000);

  const toStart = db.prepare(`SELECT * FROM elections WHERE status = 'scheduled' AND starts_at <= ?`).all(now);
  for (const election of toStart) {
    db.prepare(`UPDATE elections SET status = 'active' WHERE id = ?`).run(election.id);
    await announceElectionStart(client, election);
  }

  const toEnd = db.prepare(`SELECT * FROM elections WHERE status = 'active' AND ends_at <= ?`).all(now);
  for (const election of toEnd) {
    await closeElection(client, election);
  }

  // Fire DM reminders
  const dueReminders = db.prepare('SELECT * FROM election_reminders WHERE sent = 0 AND remind_at <= ?').all(now);
  for (const reminder of dueReminders) {
    try {
      const election = db.prepare('SELECT * FROM elections WHERE id = ?').get(reminder.election_id);
      if (!election || election.status === 'closed') {
        db.prepare('UPDATE election_reminders SET sent = 1 WHERE guild_id = ? AND user_id = ? AND election_id = ?')
          .run(reminder.guild_id, reminder.user_id, reminder.election_id);
        continue;
      }
      const user = await client.users.fetch(reminder.user_id).catch(() => null);
      if (user) {
        const { EmbedBuilder } = await import('discord.js');
        await user.send({
          embeds: [new EmbedBuilder()
            .setColor(0xfee75c)
            .setTitle('⏰ Election Closing Soon!')
            .setDescription(`**${election.title}** is closing soon — don't forget to vote!`)
            .addFields(
              { name: '💼 Office', value: election.office.replace(/\|type:\w+/, '').trim(), inline: true },
              { name: '⏰ Closes', value: `<t:${election.ends_at}:R>`, inline: true }
            )
            .setFooter({ text: 'Use /vote in the server to cast your ballot.' })]
        });
      }
    } catch (e) { /* user may have DMs disabled */ }
    db.prepare('UPDATE election_reminders SET sent = 1 WHERE guild_id = ? AND user_id = ? AND election_id = ?')
      .run(reminder.guild_id, reminder.user_id, reminder.election_id);
  }
}

async function announceElectionStart(client, election) {
  const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(election.guild_id);
  if (!config?.election_channel) return;
  try {
    const guild = await client.guilds.fetch(election.guild_id);
    const channel = await guild.channels.fetch(config.election_channel);
    const candidates = db.prepare('SELECT * FROM candidates WHERE election_id = ?').all(election.id);
    const type = getElectionType(election);
    const officeName = getOfficeName(election);
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(`🗳️ Voting Has Begun: ${election.title}`)
      .setDescription(`**Office:** ${officeName}\n\nVoting is now open! Use \`/vote\` to cast your ballot.`)
      .addFields(
        { name: '🗳️ Voting System', value: type === 'rcv' ? '📊 Ranked Choice (RCV)' : '🥇 First Past the Post', inline: true },
        { name: '📋 Candidates', value: candidates.length > 0 ? candidates.map(c => `<@${c.user_id}>`).join('\n') : 'No candidates', inline: false },
        { name: '⏰ Ends', value: `<t:${election.ends_at}:F>`, inline: true }
      ).setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (e) { console.error('Failed to announce election start:', e); }
}

export async function closeElection(client, election) {
  const type = getElectionType(election);
  const officeName = getOfficeName(election);
  let winnerUserId = null;
  let resultsText = '';
  let totalVotes = 0;

  if (type === 'rcv') {
    const { winner, rounds } = runRCV(election.id);
    winnerUserId = winner;
    totalVotes = db.prepare('SELECT COUNT(*) as cnt FROM rcv_votes WHERE election_id = ?').get(election.id).cnt;
    if (rounds.length === 0) {
      resultsText = '*No votes were cast.*';
    } else {
      const finalRound = rounds[rounds.length - 1];
      resultsText = `**Round ${rounds.length} (Final):**\n`;
      resultsText += finalRound.map((c, i) => {
        const pct = totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(1) : '0.0';
        const medal = ['🥇','🥈','🥉'][i] || '▫️';
        return `${medal} <@${c.user_id}> — **${c.votes}** votes (${pct}%)`;
      }).join('\n');
      if (rounds.length > 1) resultsText += `\n\n*Decided after ${rounds.length} rounds of instant-runoff.*`;
    }
  } else {
    const candidates = db.prepare('SELECT * FROM candidates WHERE election_id = ? ORDER BY votes DESC').all(election.id);
    totalVotes = candidates.reduce((s, c) => s + c.votes, 0);
    winnerUserId = candidates[0]?.user_id || null;
    resultsText = candidates.length > 0
      ? candidates.map((c, i) => {
          const pct = totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(1) : '0.0';
          const medal = ['🥇','🥈','🥉'][i] || '▫️';
          return `${medal} <@${c.user_id}> — **${c.votes}** votes (${pct}%)`;
        }).join('\n')
      : 'No candidates ran.';
  }

  db.prepare(`UPDATE elections SET status = 'closed', winner_id = ? WHERE id = ?`).run(winnerUserId || null, election.id);

  const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(election.guild_id);
  if (!config?.election_channel) return;

  try {
    const guild = await client.guilds.fetch(election.guild_id);
    const channel = await guild.channels.fetch(config.election_channel);
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(`📊 Election Results: ${election.title}`)
      .setDescription(`**Office:** ${officeName}\n\n${winnerUserId ? `🏆 **Winner: <@${winnerUserId}>**` : '⚠️ No winner.'}`)
      .addFields(
        { name: '📋 Final Results', value: resultsText },
        { name: '🗳️ Total Votes', value: `${totalVotes}`, inline: true },
        { name: '⚙️ System', value: type === 'rcv' ? 'Ranked Choice' : 'First Past the Post', inline: true }
      ).setTimestamp();
    await channel.send({ embeds: [embed] });

    if (winnerUserId) {
      const office = db.prepare('SELECT * FROM offices WHERE guild_id = ? AND name = ?').get(election.guild_id, officeName);
      if (office?.role_id) {
        try { const member = await guild.members.fetch(winnerUserId); await member.roles.add(office.role_id); } catch (e) {}
      }
      // Archive previous holder
      if (office?.holder_id && office.holder_id !== winnerUserId && office.assumed_at) {
        db.prepare('INSERT INTO office_history (guild_id, office_name, user_id, assumed_at, vacated_at, reason) VALUES (?, ?, ?, ?, ?, ?)')
          .run(election.guild_id, officeName, office.holder_id, office.assumed_at, Math.floor(Date.now() / 1000), 'election_loss');
        if (office.role_id) {
          try { const oldMember = await guild.members.fetch(office.holder_id); await oldMember.roles.remove(office.role_id); } catch (e) {}
        }
      }
      db.prepare('UPDATE offices SET holder_id = ?, assumed_at = ? WHERE guild_id = ? AND name = ?')
        .run(winnerUserId, Math.floor(Date.now() / 1000), election.guild_id, officeName);
    }
  } catch (e) { console.error('Failed to close election:', e); }
}
