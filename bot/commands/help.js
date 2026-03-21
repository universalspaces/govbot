import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all GovBot commands and features'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🏛️ GovBot — Command Reference')
      .setDescription('A comprehensive mock-government management bot. All commands use slash commands.')
      .addFields(
        {
          name: '⚙️ Setup (Admin)',
          value: '`/setup government` — Set government name\n`/setup channels` — Configure channels\n`/setup view` — View configuration',
          inline: false
        },
        {
          name: '🗳️ Elections',
          value: '`/election create` — Create an election\n`/election list` — List all elections\n`/election info` — View election details\n`/election register` — Run for office\n`/election open` — Open voting\n`/election close` — Force close\n`/vote` — Cast your vote',
          inline: false
        },
        {
          name: '🏛️ Political Parties',
          value: '`/party create` — Found a party\n`/party join` — Join a party\n`/party leave` — Leave your party\n`/party info` — View party details\n`/party list` — All parties\n`/party members` — Party members\n`/party promote` — Promote a member\n`/party disband` — Dissolve party',
          inline: false
        },
        {
          name: '⚖️ Judiciary',
          value: '`/court file` — File a case\n`/court assign` — Assign a judge\n`/court rule` — Issue ruling\n`/court info` — Case details\n`/court list` — Court docket',
          inline: false
        },
        {
          name: '📜 Legislature',
          value: '`/bill propose` — Propose a bill\n`/bill vote` — Vote on a bill\n`/bill pass` — Pass into law (Admin)\n`/bill reject` — Reject bill (Admin)\n`/bill info` — Bill details\n`/bill list` — All bills\n`/bill laws` — View enacted laws',
          inline: false
        },
        {
          name: '💼 Government',
          value: '`/office create` — Create an office\n`/office appoint` — Appoint someone\n`/office remove` — Remove from office\n`/office list` — All offices\n`/government` — Full government overview',
          inline: false
        },
        {
          name: '📖 Constitution',
          value: '`/constitution add` — Add an article\n`/constitution view` — Read articles\n`/constitution repeal` — Repeal an article',
          inline: false
        },
        {
          name: '🪪 Citizens',
          value: '`/citizen register` — Become a citizen\n`/citizen profile` — View profile\n`/citizen rep` — Adjust reputation (Admin)',
          inline: false
        }
      )
      .setFooter({ text: 'GovBot • Use /government for a live overview dashboard' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
