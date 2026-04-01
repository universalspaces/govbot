import { EmbedBuilder } from 'discord.js';
import db from '../database.js';
import { getElectionType, getOfficeName, runRCV } from '../commands/vote.js';

export async function checkElections(client) {
  const now = Math.floor(Date.now() / 1000);

  // Start scheduled elections
  const toStart = db.prepare(`SELECT * FROM elections WHERE status = 'scheduled' AND starts_at <= ?`).all(now);
  for (const election of toStart) {
    db.prepare(`UPDATE elections SET status = 'active' WHERE id = ?`).run(election.id);
    await announceElectionStart(client, election);
  }

  // Close active elections
  const toEnd = db.prepare(`SELECT * FROM elections WHERE status = 'active' AND ends_at <= ?`).all(now);
  for (const election of toEnd) {
    await closeElection(client, election);
  }

  // FIX: Auto-close expired referendums
  const expiredRefs = db.prepare(`SELECT * FROM referendums WHERE status = 'active' AND ends_at <= ?`).all(now);
  for (const ref of expiredRefs) {
    await closeReferendum(client, ref);
  }

  // Fire DM reminders for elections closing soon
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

  // Expire overdue initiatives
  db.prepare(`UPDATE initiatives SET status = 'expired' WHERE status = 'collecting' AND expires_at <= ?`).run(now);

  // Auto-reject bills past their voting deadline
  const expiredBills = db.prepare(`
    SELECT b.* FROM bills b
    JOIN bill_voting_config bvc ON b.id = bvc.bill_id
    WHERE b.status = 'proposed' AND bvc.voting_deadline <= ? AND bvc.voting_deadline IS NOT NULL
  `).all(now);

  for (const bill of expiredBills) {
    db.prepare(`UPDATE bills SET status = 'rejected', voted_at = ? WHERE id = ?`).run(now, bill.id);
    const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(bill.guild_id);
    if (config?.legislature_channel) {
      try {
        const guild = await client.guilds.fetch(bill.guild_id);
        const channel = await guild.channels.fetch(config.legislature_channel);
        await channel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle(`⏰ Bill Expired: ${bill.title}`)
            .setDescription(`Bill **#${bill.id}** was automatically rejected — the voting deadline passed with no action taken.`)
            .addFields(
              { name: '✅ Yea', value: `${bill.votes_yes}`, inline: true },
              { name: '❌ Nay', value: `${bill.votes_no}`, inline: true },
              { name: '⬛ Abstain', value: `${bill.votes_abstain}`, inline: true }
            ).setTimestamp()]
        });
      } catch (e) { /* channel may not exist */ }
    }
  }

  // Expire overdue recall petitions
  db.prepare(`UPDATE recalls SET status = 'failed' WHERE status IN ('collecting','qualified') AND expires_at <= ?`).run(now);

  // Auto-close polls past their deadline
  const expiredPolls = db.prepare(`SELECT * FROM polls WHERE status = 'active' AND ends_at <= ? AND ends_at IS NOT NULL`).all(now);
  for (const poll of expiredPolls) {
    db.prepare(`UPDATE polls SET status = 'closed' WHERE id = ?`).run(poll.id);
    // Update the original poll message if we stored it
    if (poll.message_id && poll.channel_id) {
      try {
        const guild = await client.guilds.fetch(poll.guild_id);
        const channel = await guild.channels.fetch(poll.channel_id);
        const msg = await channel.messages.fetch(poll.message_id);
        const votes = db.prepare('SELECT * FROM poll_votes WHERE poll_id = ?').all(poll.id);
        const options = JSON.parse(poll.options);
        const totalVotes = votes.length;
        const counts = new Array(options.length).fill(0);
        for (const v of votes) counts[v.option_index]++;
        const NUM_EMOJI = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
        const lines = options.map((opt, i) => {
          const pct = totalVotes > 0 ? ((counts[i] / totalVotes) * 100).toFixed(1) : '0.0';
          const filled = Math.round(parseFloat(pct) / 10);
          const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
          return `${NUM_EMOJI[i]} **${opt}**\n\`${bar}\` ${counts[i]} votes (${pct}%)`;
        }).join('\n\n');
        await msg.edit({
          embeds: [new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle(`📊 Poll Closed: ${poll.title}`)
            .setDescription((poll.description ? poll.description + '\n\n' : '') + lines)
            .addFields({ name: '🗳️ Total Votes', value: `${totalVotes}`, inline: true }, { name: '📋 Status', value: 'CLOSED', inline: true })
            .setTimestamp()]
        });
      } catch (e) { /* message may have been deleted */ }
    }
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
        { name: '📋 Candidates', value: candidates.length > 0 ? candidates.map(c => `<@${c.user_id}>`).join('\n') : 'No candidates registered', inline: false },
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
      if (office?.holder_id && office.holder_id !== winnerUserId && office.assumed_at) {
        db.prepare('INSERT INTO office_history (guild_id, office_name, user_id, assumed_at, vacated_at, reason) VALUES (?, ?, ?, ?, ?, ?)')
          .run(election.guild_id, officeName, office.holder_id, office.assumed_at, Math.floor(Date.now() / 1000), 'election_loss');
        if (office.role_id) {
          try { const oldMember = await guild.members.fetch(office.holder_id); await oldMember.roles.remove(office.role_id); } catch (e) {}
        }
      }
      db.prepare('UPDATE offices SET holder_id = ?, assumed_at = ? WHERE guild_id = ? AND name = ?')
        .run(winnerUserId, Math.floor(Date.now() / 1000), election.guild_id, officeName);

      // Announce new officeholder in announcement channel if different from election channel
      if (config?.announcement_channel && config.announcement_channel !== config.election_channel) {
        try {
          const announceChan = await guild.channels.fetch(config.announcement_channel);
          await announceChan.send({
            embeds: [new EmbedBuilder()
              .setColor(0x57f287)
              .setTitle(`💼 New Officeholder: ${officeName}`)
              .setDescription(`<@${winnerUserId}> has been elected as **${officeName}** and has assumed office.`)
              .setTimestamp()]
          });
        } catch (e) {}
      }
    }
  } catch (e) { console.error('Failed to close election:', e); }
}

async function closeReferendum(client, ref) {
  const total = ref.votes_yes + ref.votes_no + ref.votes_abstain;
  const result = ref.votes_yes > ref.votes_no ? 'passed' : ref.votes_yes === ref.votes_no ? 'tied' : 'failed';
  db.prepare(`UPDATE referendums SET status = 'closed', result = ? WHERE id = ?`).run(result, ref.id);

  const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(ref.guild_id);
  const channelId = config?.election_channel;
  if (!channelId) return;

  try {
    const guild = await client.guilds.fetch(ref.guild_id);
    const channel = await guild.channels.fetch(channelId);
    const yPct = total > 0 ? ((ref.votes_yes / total) * 100).toFixed(1) : '0.0';
    const nPct = total > 0 ? ((ref.votes_no / total) * 100).toFixed(1) : '0.0';
    const resultLabel = { passed: '✅ PASSED', failed: '❌ FAILED', tied: '🟡 TIED' };
    const resultColor = { passed: 0x57f287, failed: 0xed4245, tied: 0xfee75c };

    const embed = new EmbedBuilder()
      .setColor(resultColor[result] || 0x2f3136)
      .setTitle(`📊 Referendum Closed: ${ref.title}`)
      .setDescription(`**Result: ${resultLabel[result]}**`)
      .addFields(
        { name: '✅ Yes', value: `${ref.votes_yes} (${yPct}%)`, inline: true },
        { name: '❌ No', value: `${ref.votes_no} (${nPct}%)`, inline: true },
        { name: '🗳️ Total', value: `${total}`, inline: true }
      ).setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (e) { console.error('Failed to announce referendum close:', e); }
}
