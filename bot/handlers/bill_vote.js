// Handler: bill vote buttons
// customId format: bill_vote:<bill_id>:<vote>
import { EmbedBuilder } from 'discord.js';
import db from '../database.js';
import { successEmbed, errorEmbed, requireCitizen } from '../utils/helpers.js';

export async function handle(interaction, parts, config) {
  const [billIdStr, vote] = parts;
  const billId = parseInt(billIdStr, 10);
  const gid    = interaction.guildId;
  const uid    = interaction.user.id;

  const bill = db.prepare('SELECT * FROM bills WHERE id = ? AND guild_id = ?').get(billId, gid);
  if (!bill)                       return interaction.reply({ embeds: [errorEmbed(`Bill #${billId} not found.`)], flags: 64 });
  if (bill.status !== 'proposed')  return interaction.reply({ embeds: [errorEmbed('This bill is no longer open for voting.')], flags: 64 });

  // Parliament role / citizenship check
  if (config?.parliament_role) {
    const member = await interaction.guild.members.fetch(uid).catch(() => null);
    if (!member?.roles.cache.has(config.parliament_role)) {
      return interaction.reply({ embeds: [errorEmbed(`Only members of <@&${config.parliament_role}> can vote on bills.`)], flags: 64 });
    }
  } else if (config?.require_citizenship) {
    if (!await requireCitizen(interaction)) return;
  }

  const emoji    = { yes: '✅', no: '❌', abstain: '⬛' };
  const existing = db.prepare('SELECT * FROM bill_votes WHERE bill_id = ? AND voter_id = ?').get(billId, uid);

  if (existing) {
    if (existing.vote === vote) {
      return interaction.reply({ embeds: [errorEmbed(`You already voted **${emoji[vote]} ${vote.toUpperCase()}** on this bill.`)], flags: 64 });
    }
    if (existing.vote === 'yes')     db.prepare('UPDATE bills SET votes_yes     = votes_yes     - 1 WHERE id = ?').run(billId);
    else if (existing.vote === 'no') db.prepare('UPDATE bills SET votes_no      = votes_no      - 1 WHERE id = ?').run(billId);
    else                             db.prepare('UPDATE bills SET votes_abstain = votes_abstain - 1 WHERE id = ?').run(billId);

    db.prepare('UPDATE bill_votes SET vote = ?, voted_at = ? WHERE bill_id = ? AND voter_id = ?')
      .run(vote, Math.floor(Date.now() / 1000), billId, uid);

    if (vote === 'yes')     db.prepare('UPDATE bills SET votes_yes     = votes_yes     + 1 WHERE id = ?').run(billId);
    else if (vote === 'no') db.prepare('UPDATE bills SET votes_no      = votes_no      + 1 WHERE id = ?').run(billId);
    else                    db.prepare('UPDATE bills SET votes_abstain = votes_abstain + 1 WHERE id = ?').run(billId);

    const msg = `Changed from **${emoji[existing.vote]} ${existing.vote.toUpperCase()}** to **${emoji[vote]} ${vote.toUpperCase()}** on Bill #${billId}: **${bill.title}**`;
    return interaction.reply({ embeds: [successEmbed('Vote Changed', msg, gid)], flags: 64 });
  }

  db.prepare('INSERT INTO bill_votes (bill_id, voter_id, vote) VALUES (?, ?, ?)').run(billId, uid, vote);
  if (vote === 'yes')     db.prepare('UPDATE bills SET votes_yes     = votes_yes     + 1 WHERE id = ?').run(billId);
  else if (vote === 'no') db.prepare('UPDATE bills SET votes_no      = votes_no      + 1 WHERE id = ?').run(billId);
  else                    db.prepare('UPDATE bills SET votes_abstain = votes_abstain + 1 WHERE id = ?').run(billId);

  const updated = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  const total   = updated.votes_yes + updated.votes_no + updated.votes_abstain;

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('📜 Vote Recorded')
      .setDescription(`You voted **${emoji[vote]} ${vote.toUpperCase()}** on Bill #${billId}: **${bill.title}**`)
      .addFields(
        { name: '✅ Yea',    value: `${updated.votes_yes}`,     inline: true },
        { name: '❌ Nay',    value: `${updated.votes_no}`,      inline: true },
        { name: '⬛ Abstain', value: `${updated.votes_abstain}`, inline: true }
      )
      .setFooter({ text: `${total} total vote${total !== 1 ? 's' : ''} cast` })],
    flags: 64
  });
}
