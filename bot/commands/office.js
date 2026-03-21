import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import { errorEmbed, successEmbed, logActivity } from '../utils/helpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('office')
    .setDescription('Manage government offices and positions')
    .addSubcommand(s => s
      .setName('create')
      .setDescription('Create a government office (Admin only)')
      .addStringOption(o => o.setName('name').setDescription('Office name').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Office description'))
      .addRoleOption(o => o.setName('role').setDescription('Discord role for this office'))
      .addIntegerOption(o => o.setName('term_days').setDescription('Term length in days').setMinValue(1).setMaxValue(365))
      .addBooleanOption(o => o.setName('elected').setDescription('Is this an elected office?')))
    .addSubcommand(s => s
      .setName('appoint')
      .setDescription('Appoint someone to an office (Admin only)')
      .addStringOption(o => o.setName('office').setDescription('Office name').setRequired(true))
      .addUserOption(o => o.setName('user').setDescription('User to appoint').setRequired(true)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Remove someone from an office (Admin only)')
      .addStringOption(o => o.setName('office').setDescription('Office name').setRequired(true)))
    .addSubcommand(s => s
      .setName('list')
      .setDescription('List all government offices')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;
    const uid = interaction.user.id;

    if (sub === 'create') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ embeds: [errorEmbed('Administrator permissions required.')], ephemeral: true });
      }
      const name = interaction.options.getString('name');
      const description = interaction.options.getString('description') || '';
      const role = interaction.options.getRole('role');
      const termDays = interaction.options.getInteger('term_days') || 30;
      const isElected = interaction.options.getBoolean('elected') !== false;

      try {
        db.prepare('INSERT INTO offices (guild_id, name, description, role_id, term_length_days, is_elected) VALUES (?, ?, ?, ?, ?, ?)')
          .run(gid, name, description, role?.id || null, termDays, isElected ? 1 : 0);
      } catch (e) {
        return interaction.reply({ embeds: [errorEmbed(`Office **${name}** already exists.`)], ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🏛️ Office Created')
        .addFields(
          { name: '💼 Name', value: name, inline: true },
          { name: '📋 Type', value: isElected ? 'Elected' : 'Appointed', inline: true },
          { name: '⏱️ Term Length', value: `${termDays} days`, inline: true },
          { name: '🎭 Role', value: role ? `${role}` : 'None', inline: true },
          { name: '📝 Description', value: description || 'No description.' }
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'appoint') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('Manage Server permissions required.')], ephemeral: true });
      }
      const officeName = interaction.options.getString('office');
      const target = interaction.options.getUser('user');
      const office = db.prepare('SELECT * FROM offices WHERE guild_id = ? AND LOWER(name) = LOWER(?)').get(gid, officeName);
      if (!office) return interaction.reply({ embeds: [errorEmbed(`Office **${officeName}** not found.`)], ephemeral: true });

      const now = Math.floor(Date.now() / 1000);
      db.prepare('UPDATE offices SET holder_id = ?, assumed_at = ? WHERE id = ?').run(target.id, now, office.id);
      logActivity(gid, 'OFFICE_APPOINTED', uid, officeName, target.id);

      // Assign role if set
      if (office.role_id) {
        try {
          const member = await interaction.guild.members.fetch(target.id);
          await member.roles.add(office.role_id);
        } catch (e) {}
      }

      return interaction.reply({ embeds: [successEmbed('Appointment Made', `<@${target.id}> has been appointed as **${office.name}**.`, gid)] });
    }

    if (sub === 'remove') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('Manage Server permissions required.')], ephemeral: true });
      }
      const officeName = interaction.options.getString('office');
      const office = db.prepare('SELECT * FROM offices WHERE guild_id = ? AND LOWER(name) = LOWER(?)').get(gid, officeName);
      if (!office || !office.holder_id) return interaction.reply({ embeds: [errorEmbed(`Office **${officeName}** not found or is already vacant.`)], ephemeral: true });

      const prevHolder = office.holder_id;
      db.prepare('UPDATE offices SET holder_id = NULL, assumed_at = NULL WHERE id = ?').run(office.id);

      if (office.role_id) {
        try {
          const member = await interaction.guild.members.fetch(prevHolder);
          await member.roles.remove(office.role_id);
        } catch (e) {}
      }

      return interaction.reply({ embeds: [successEmbed('Office Vacated', `<@${prevHolder}> has been removed from **${office.name}**.`, gid)] });
    }

    if (sub === 'list') {
      const offices = db.prepare('SELECT * FROM offices WHERE guild_id = ?').all(gid);
      if (offices.length === 0) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🏛️ Government Offices').setDescription('No offices have been created yet. Use `/office create` to get started.')] });

      const list = offices.map(o => {
        const holder = o.holder_id ? `<@${o.holder_id}>` : '*Vacant*';
        const type = o.is_elected ? '🗳️' : '👑';
        return `${type} **${o.name}** — ${holder} *(${o.term_length_days}d term)*`;
      }).join('\n');

      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🏛️ Government Offices & Positions').setDescription(list)] });
    }
  }
};
