// Handler: referendum vote buttons
// customId format: ref_vote:<referendum_id>:<vote>
import { EmbedBuilder } from 'discord.js';
import db from '../database.js';
import { successEmbed, errorEmbed } from '../utils/helpers.js';

export async function handle(interaction, parts, config) {
  const [refId, vote] = parts;
  const id  = parseInt(refId, 10);
  const gid = interaction.guildId;
  const uid = interaction.user.id;

  const ref = db.prepare('SELECT * FROM referendums WHERE id = ? AND guild_id = ?').get(id, gid);
  if (!ref)                    return interaction.reply({ embeds: [errorEmbed(`Referendum #${id} not found.`)], flags: 64 });
  if (ref.status !== 'active') return interaction.reply({ embeds: [errorEmbed('This referendum is no longer open for voting.')], flags: 64 });

  const now = Math.floor(Date.now() / 1000);
  if (ref.ends_at && now > ref.ends_at) {
    db.prepare(`UPDATE referendums SET status = 'closed' WHERE id = ?`).run(id);
    return interaction.reply({ embeds: [errorEmbed('This referendum has already closed.')], flags: 64 });
  }

  const existing = db.prepare('SELECT * FROM referendum_votes WHERE referendum_id = ? AND voter_id = ?').get(id, uid);
  const voteEmoji = { yes: '✅', no: '❌', abstain: '⬛' };

  if (existing) {
    if (existing.vote === vote) {
      return interaction.reply({ embeds: [errorEmbed(`You already voted **${voteEmoji[vote]} ${vote.toUpperCase()}** on this referendum.`)], flags: 64 });
    }
    if (existing.vote === 'yes')     db.prepare('UPDATE referendums SET votes_yes = votes_yes - 1 WHERE id = ?').run(id);
    else if (existing.vote === 'no') db.prepare('UPDATE referendums SET votes_no = votes_no - 1 WHERE id = ?').run(id);
    else                             db.prepare('UPDATE referendums SET votes_abstain = votes_abstain - 1 WHERE id = ?').run(id);

    db.prepare('UPDATE referendum_votes SET vote = ? WHERE referendum_id = ? AND voter_id = ?').run(vote, id, uid);

    if (vote === 'yes')     db.prepare('UPDATE referendums SET votes_yes = votes_yes + 1 WHERE id = ?').run(id);
    else if (vote === 'no') db.prepare('UPDATE referendums SET votes_no = votes_no + 1 WHERE id = ?').run(id);
    else                    db.prepare('UPDATE referendums SET votes_abstain = votes_abstain + 1 WHERE id = ?').run(id);

    return interaction.reply({
      embeds: [successEmbed('Vote Changed',
        `Changed from **${voteEmoji[existing.vote]} ${existing.vote.toUpperCase()}** to **${voteEmoji[vote]} ${vote.toUpperCase()}** on Referendum #${id}: **${ref.title}**`,
        gid)],
      flags: 64
    });
  }

  db.prepare('INSERT INTO referendum_votes (referendum_id, voter_id, vote) VALUES (?, ?, ?)').run(id, uid, vote);
  if (vote === 'yes')     db.prepare('UPDATE referendums SET votes_yes = votes_yes + 1 WHERE id = ?').run(id);
  else if (vote === 'no') db.prepare('UPDATE referendums SET votes_no = votes_no + 1 WHERE id = ?').run(id);
  else                    db.prepare('UPDATE referendums SET votes_abstain = votes_abstain + 1 WHERE id = ?').run(id);

  // Live tally in response
  const updated = db.prepare('SELECT * FROM referendums WHERE id = ?').get(id);
  const total   = updated.votes_yes + updated.votes_no + updated.votes_abstain;
  const yPct    = total > 0 ? ((updated.votes_yes / total) * 100).toFixed(1) : '0.0';
  const nPct    = total > 0 ? ((updated.votes_no  / total) * 100).toFixed(1) : '0.0';

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🗳️ Vote Recorded')
      .setDescription(`You voted **${voteEmoji[vote]} ${vote.toUpperCase()}** on **${ref.title}**.`)
      .addFields(
        { name: '✅ Yes',  value: `${updated.votes_yes} (${yPct}%)`,  inline: true },
        { name: '❌ No',   value: `${updated.votes_no} (${nPct}%)`,   inline: true },
        { name: '⬛ Abstain', value: `${updated.votes_abstain}`,       inline: true }
      )
      .setFooter({ text: `${total} total vote${total !== 1 ? 's' : ''}` })],
    flags: 64
  });
}
