import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import db from '../database.js';
import { successEmbed, errorEmbed, isAdmin } from '../utils/helpers.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure GovBot for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s
      .setName('government')
      .setDescription('Set your government name')
      .addStringOption(o => o.setName('name').setDescription('Name of your government').setRequired(true)))
    .addSubcommand(s => s
      .setName('channels')
      .setDescription('Configure bot channels')
      .addChannelOption(o => o.setName('elections').setDescription('Elections channel').addChannelTypes(ChannelType.GuildText))
      .addChannelOption(o => o.setName('announcements').setDescription('Announcements channel').addChannelTypes(ChannelType.GuildText))
      .addChannelOption(o => o.setName('court').setDescription('Court channel').addChannelTypes(ChannelType.GuildText))
      .addChannelOption(o => o.setName('legislature').setDescription('Legislature channel').addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s
      .setName('view')
      .setDescription('View current server configuration')),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('You need Administrator permissions.')], ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;

    if (sub === 'government') {
      const name = interaction.options.getString('name');
      db.prepare('UPDATE server_config SET government_name = ? WHERE guild_id = ?').run(name, gid);
      return interaction.reply({ embeds: [successEmbed('Government Name Set', `Your government is now **${name}**.`, gid)] });
    }

    if (sub === 'channels') {
      const elections = interaction.options.getChannel('elections');
      const announcements = interaction.options.getChannel('announcements');
      const court = interaction.options.getChannel('court');
      const legislature = interaction.options.getChannel('legislature');

      if (elections) db.prepare('UPDATE server_config SET election_channel = ? WHERE guild_id = ?').run(elections.id, gid);
      if (announcements) db.prepare('UPDATE server_config SET announcement_channel = ? WHERE guild_id = ?').run(announcements.id, gid);
      if (court) db.prepare('UPDATE server_config SET court_channel = ? WHERE guild_id = ?').run(court.id, gid);
      if (legislature) db.prepare('UPDATE server_config SET legislature_channel = ? WHERE guild_id = ?').run(legislature.id, gid);

      const lines = [];
      if (elections) lines.push(`📊 Elections: ${elections}`);
      if (announcements) lines.push(`📢 Announcements: ${announcements}`);
      if (court) lines.push(`⚖️ Court: ${court}`);
      if (legislature) lines.push(`🏛️ Legislature: ${legislature}`);

      return interaction.reply({ embeds: [successEmbed('Channels Updated', lines.join('\n') || 'No channels changed.', gid)] });
    }

    if (sub === 'view') {
      const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(gid);
      const { EmbedBuilder } = await import('discord.js');
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`⚙️ Server Configuration — ${config.government_name}`)
        .addFields(
          { name: '🗳️ Elections Channel', value: config.election_channel ? `<#${config.election_channel}>` : 'Not set', inline: true },
          { name: '📢 Announcements Channel', value: config.announcement_channel ? `<#${config.announcement_channel}>` : 'Not set', inline: true },
          { name: '⚖️ Court Channel', value: config.court_channel ? `<#${config.court_channel}>` : 'Not set', inline: true },
          { name: '🏛️ Legislature Channel', value: config.legislature_channel ? `<#${config.legislature_channel}>` : 'Not set', inline: true },
          { name: '⏱️ Default Election Duration', value: `${config.election_duration_hours} hours`, inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }
  }
};
