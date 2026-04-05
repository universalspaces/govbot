// Handler: impeachment vote buttons
// customId format: imp_vote:<impeachment_id>:<vote>
import { EmbedBuilder } from 'discord.js';
import db from '../database.js';
import { successEmbed, errorEmbed } from '../utils/helpers.js';

export async function handle(interaction, parts, config) {
  const [impId, vote] = parts;
  const id  = parseInt(impId, 10);
  const gid = interaction.guildId;
  const uid = interaction.user.id;

  const proceeding = db.prepare('SELECT * FROM impeachments WHERE id = ? AND guild_id = ?').get(id, gid);
  if (!proceeding)                       return interaction.reply({ embeds: [errorEmbed(`Impeachment #${id} not found.`)], flags: 64 });
  if (proceeding.status !== 'trial')     return interaction.reply({ embeds: [errorEmbed('This impeachment trial is no longer active.')], flags: 64 });
  if (proceeding.target_id === uid)      return interaction.reply({ embeds: [errorEmbed('You cannot vote in your own impeachment trial.')], flags: 64 });

  const existing = db.prepare('SELECT * FROM impeachment_votes WHERE impeachment_id = ? AND voter_id = ?').get(id, uid);
  if (existing) return interaction.reply({ embeds: [errorEmbed('You have already voted in this proceeding.')], flags: 64 });

  db.prepare('INSERT INTO impeachment_votes (impeachment_id, voter_id, vote) VALUES (?, ?, ?)').run(id, uid, vote);
  if (vote === 'convict')      db.prepare('UPDATE impeachments SET votes_convict = votes_convict + 1 WHERE id = ?').run(id);
  else if (vote === 'acquit')  db.prepare('UPDATE impeachments SET votes_acquit  = votes_acquit  + 1 WHERE id = ?').run(id);
  else                         db.prepare('UPDATE impeachments SET votes_abstain = votes_abstain + 1 WHERE id = ?').run(id);

  const updated  = db.prepare('SELECT * FROM impeachments WHERE id = ?').get(id);
  const decisive = updated.votes_convict + updated.votes_acquit;
  const cPct     = decisive > 0 ? ((updated.votes_convict / decisive) * 100).toFixed(1) : '0.0';
  const aPct     = decisive > 0 ? ((updated.votes_acquit  / decisive) * 100).toFixed(1) : '0.0';
  const voteLabel = { convict: '⚖️ CONVICT', acquit: '🛡️ ACQUIT', abstain: '⬛ ABSTAIN' };

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('⚖️ Vote Recorded')
      .setDescription(`You voted **${voteLabel[vote]}** in the impeachment trial of <@${proceeding.target_id}>.`)
      .addFields(
        { name: '⚖️ Convict', value: `${updated.votes_convict} (${cPct}%)`, inline: true },
        { name: '🛡️ Acquit',  value: `${updated.votes_acquit} (${aPct}%)`,  inline: true },
        { name: '⬛ Abstain',  value: `${updated.votes_abstain}`,             inline: true }
      )
      .setFooter({ text: `Use /impeach conclude to tally the final result` })],
    flags: 64
  });
}
