import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../database.js';
import { errorEmbed, successEmbed, logActivity } from '../utils/helpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('citizen')
    .setDescription('Citizen management')
    .addSubcommand(s => s
      .setName('register')
      .setDescription('Register as a citizen of this government'))
    .addSubcommand(s => s
      .setName('profile')
      .setDescription('View a citizen profile')
      .addUserOption(o => o.setName('user').setDescription('User to view (defaults to yourself)')))
    .addSubcommand(s => s
      .setName('rep')
      .setDescription('Give or take reputation from a citizen (Admin only)')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount (positive or negative)').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;
    const uid = interaction.user.id;

    if (sub === 'register') {
      const existing = db.prepare('SELECT * FROM citizens WHERE guild_id = ? AND user_id = ?').get(gid, uid);
      if (existing) return interaction.reply({ embeds: [errorEmbed('You are already a registered citizen.')], flags: 64 });

      const count = db.prepare('SELECT COUNT(*) as cnt FROM citizens WHERE guild_id = ?').get(gid).cnt;
      db.prepare('INSERT INTO citizens (guild_id, user_id, citizen_number) VALUES (?, ?, ?)').run(gid, uid, count + 1);
      logActivity(gid, 'CITIZEN_REGISTERED', uid, null, `Citizen #${count + 1}`);

      const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(gid);
      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🎉 Welcome, Citizen!')
        .setDescription(`You are now **Citizen #${count + 1}** of **${config?.government_name || 'the Republic'}**.`)
        .addFields(
          { name: '🗳️ Your Rights', value: '• Vote in elections\n• Join a political party\n• Propose citizens\' initiatives\n• File court cases' }
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'profile') {
      const target = interaction.options.getUser('user') || interaction.user;
      const citizen = db.prepare('SELECT * FROM citizens WHERE guild_id = ? AND user_id = ?').get(gid, target.id);

      if (!citizen) return interaction.reply({ embeds: [errorEmbed(`${target.username} is not a registered citizen.`)], flags: 64 });

      const party = db.prepare('SELECT p.* FROM party_members pm JOIN parties p ON pm.party_id = p.id WHERE pm.guild_id = ? AND pm.user_id = ?').get(gid, target.id);
      const offices = db.prepare('SELECT * FROM offices WHERE guild_id = ? AND holder_id = ?').all(gid, target.id);
      const electionsWon = db.prepare('SELECT COUNT(*) as cnt FROM elections WHERE guild_id = ? AND winner_id = ?').get(gid, target.id).cnt;
      const billsSponsored = db.prepare("SELECT COUNT(*) as cnt FROM bills WHERE guild_id = ? AND sponsor_id = ? AND status = 'passed'").get(gid, target.id).cnt;

      const member = await interaction.guild.members.fetch(target.id).catch(() => null);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🪪 Citizen Profile: ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '🆔 Citizen Number', value: `#${citizen.citizen_number}`, inline: true },
          { name: '⭐ Reputation', value: `${citizen.reputation}`, inline: true },
          { name: '📅 Registered', value: `<t:${citizen.registered_at}:D>`, inline: true },
          { name: '🏛️ Party', value: party ? `${party.emoji} ${party.name}` : 'Independent', inline: true },
          { name: '🏆 Elections Won', value: `${electionsWon}`, inline: true },
          { name: '📜 Bills Passed', value: `${billsSponsored}`, inline: true }
        );

      if (offices.length > 0) {
        embed.addFields({ name: '💼 Current Offices', value: offices.map(o => `• ${o.name}`).join('\n') });
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'rep') {
      if (!interaction.member.permissions.has('ManageGuild')) {
        return interaction.reply({ embeds: [errorEmbed('You need Manage Server permissions.')], flags: 64 });
      }
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const citizen = db.prepare('SELECT * FROM citizens WHERE guild_id = ? AND user_id = ?').get(gid, target.id);
      if (!citizen) return interaction.reply({ embeds: [errorEmbed(`${target.username} is not a registered citizen.`)], flags: 64 });

      db.prepare('UPDATE citizens SET reputation = reputation + ? WHERE guild_id = ? AND user_id = ?').run(amount, gid, target.id);
      const newRep = citizen.reputation + amount;
      const sign = amount > 0 ? '+' : '';
      return interaction.reply({ embeds: [successEmbed('Reputation Updated', `<@${target.id}>'s reputation is now **${newRep}** (${sign}${amount}).`, gid)] });
    }
  }
};
