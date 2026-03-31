import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
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
      .setName('defaults')
      .setDescription('Set default values for elections and signatures')
      .addIntegerOption(o => o.setName('election_hours').setDescription('Default election duration in hours').setMinValue(1).setMaxValue(720))
      .addIntegerOption(o => o.setName('initiative_signatures').setDescription('Default signatures required for citizen initiatives').setMinValue(1).setMaxValue(500)))
    .addSubcommand(s => s
      .setName('parliament')
      .setDescription('Set which Discord role can vote on bills (parliament membership)')
      .addRoleOption(o => o.setName('role').setDescription('Role required to vote on bills — omit to allow any citizen')))
    .addSubcommand(s => s
      .setName('oath')
      .setDescription('Set a citizenship oath shown when citizens register')
      .addStringOption(o => o.setName('text').setDescription('Oath text — omit to clear the oath')))
    .addSubcommand(s => s
      .setName('citizenship')
      .setDescription('Require citizenship registration before using civic commands')
      .addBooleanOption(o => o.setName('required').setDescription('If true, citizens must register before voting, joining parties, etc.').setRequired(true)))
    .addSubcommand(s => s
      .setName('view')
      .setDescription('View current server configuration')),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('You need Administrator permissions.')], flags: 64 });
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

    if (sub === 'defaults') {
      const electionHours = interaction.options.getInteger('election_hours');
      const initSigs = interaction.options.getInteger('initiative_signatures');
      const changes = [];

      if (electionHours) {
        db.prepare('UPDATE server_config SET election_duration_hours = ? WHERE guild_id = ?').run(electionHours, gid);
        changes.push(`⏱️ Default election duration: **${electionHours} hours**`);
      }
      if (initSigs) {
        db.prepare('UPDATE server_config SET default_initiative_signatures = ? WHERE guild_id = ?').run(initSigs, gid);
        changes.push(`✍️ Default initiative signatures: **${initSigs}**`);
      }
      if (changes.length === 0) return interaction.reply({ embeds: [errorEmbed('No changes provided.')], flags: 64 });
      return interaction.reply({ embeds: [successEmbed('Defaults Updated', changes.join('\n'), gid)] });
    }

    if (sub === 'parliament') {
      const role = interaction.options.getRole('role');
      if (role) {
        db.prepare('UPDATE server_config SET parliament_role = ? WHERE guild_id = ?').run(role.id, gid);
        return interaction.reply({ embeds: [successEmbed('Parliament Role Set', `Only members with ${role} can now vote on bills.`, gid)] });
      } else {
        db.prepare('UPDATE server_config SET parliament_role = NULL WHERE guild_id = ?').run(gid);
        return interaction.reply({ embeds: [successEmbed('Parliament Role Cleared', 'Any registered citizen can now vote on bills.', gid)] });
      }
    }

    if (sub === 'oath') {
      const text = interaction.options.getString('text');
      if (text) {
        db.prepare('UPDATE server_config SET citizenship_oath = ? WHERE guild_id = ?').run(text, gid);
        return interaction.reply({ embeds: [successEmbed('Citizenship Oath Set', `New citizens will see this oath when registering:\n\n*${text}*`, gid)] });
      } else {
        db.prepare('UPDATE server_config SET citizenship_oath = NULL WHERE guild_id = ?').run(gid);
        return interaction.reply({ embeds: [successEmbed('Citizenship Oath Cleared', 'No oath will be shown on registration.', gid)] });
      }
    }

    if (sub === 'citizenship') {
      const required = interaction.options.getBoolean('required');
      db.prepare('UPDATE server_config SET require_citizenship = ? WHERE guild_id = ?').run(required ? 1 : 0, gid);
      return interaction.reply({ embeds: [successEmbed('Citizenship Requirement Updated',
        required
          ? 'Citizens must now register with `/citizen register` before using any civic commands.'
          : 'Citizenship registration is now optional.',
        gid)] });
    }

    if (sub === 'view') {
      const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(gid);
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`⚙️ Server Configuration — ${config.government_name}`)
        .addFields(
          { name: '🗳️ Elections Channel', value: config.election_channel ? `<#${config.election_channel}>` : 'Not set', inline: true },
          { name: '📢 Announcements Channel', value: config.announcement_channel ? `<#${config.announcement_channel}>` : 'Not set', inline: true },
          { name: '⚖️ Court Channel', value: config.court_channel ? `<#${config.court_channel}>` : 'Not set', inline: true },
          { name: '🏛️ Legislature Channel', value: config.legislature_channel ? `<#${config.legislature_channel}>` : 'Not set', inline: true },
          { name: '⏱️ Default Election Duration', value: `${config.election_duration_hours} hours`, inline: true },
          { name: '✍️ Default Initiative Signatures', value: `${config.default_initiative_signatures || 10}`, inline: true },
          { name: '🏛️ Parliament Role', value: config.parliament_role ? `<@&${config.parliament_role}>` : 'Any citizen', inline: true },
          { name: '🪪 Citizenship Required', value: config.require_citizenship ? '✅ Yes' : '❌ No', inline: true },
          { name: '📜 Citizenship Oath', value: config.citizenship_oath ? `*${config.citizenship_oath.substring(0, 150)}${config.citizenship_oath.length > 150 ? '…' : ''}*` : 'None set', inline: false }
        );
      return interaction.reply({ embeds: [embed], flags: 64 });
    }
  }
};
