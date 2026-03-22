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
          name: '⚙️ Setup',
          value: '`/setup government` — Set government name\n`/setup channels` — Configure channels\n`/setup view` — View configuration',
          inline: false
        },
        {
          name: '🗳️ Elections',
          value: '`/election create` — Create an election (FPTP or RCV)\n`/election list` — List all elections\n`/election info` — Details & live results\n`/election register` — Run for office\n`/election open/close` — Control voting\n`/vote` — Cast your vote (supports ranked choices)',
          inline: false
        },
        {
          name: '📊 Referendums',
          value: '`/referendum create` — Call a yes/no referendum\n`/referendum vote` — Vote on a referendum\n`/referendum info` — Live tally\n`/referendum close` — Close & record result\n`/referendum list` — All referendums',
          inline: false
        },
        {
          name: '📣 Citizen Initiatives',
          value: '`/initiative propose` — File an initiative\n`/initiative sign` — Sign an initiative\n`/initiative info` — Progress & signature bar\n`/initiative list` — All initiatives\n`/initiative withdraw` — Withdraw your initiative',
          inline: false
        },
        {
          name: '⚖️ Impeachment',
          value: '`/impeach file` — File articles of impeachment\n`/impeach vote` — Vote convict / acquit / abstain\n`/impeach conclude` — Tally verdict & execute outcome\n`/impeach info` — Trial details\n`/impeach list` — All proceedings',
          inline: false
        },
        {
          name: '🏛️ Political Parties',
          value: '`/party create` — Found a party\n`/party join/leave` — Join or leave a party\n`/party info/list` — View party details\n`/party members` — View membership\n`/party promote` — Promote a member (leader only)\n`/party disband` — Dissolve the party (leader only)',
          inline: false
        },
        {
          name: '📜 Legislature',
          value: '`/bill propose` — Propose a bill\n`/bill cosponsor` — Co-sponsor a bill\n`/bill vote` — Vote yea / nay / abstain\n`/bill pass/reject` — Pass or reject a bill\n`/bill info/list` — View bills\n`/bill laws` — View enacted laws',
          inline: false
        },
        {
          name: '📋 Term Limits',
          value: '`/termlimit set` — Set a term limit for an office\n`/termlimit remove` — Remove a term limit\n`/termlimit list` — All limits & current counts\n`/termlimit check` — Check a citizen\'s term history',
          inline: false
        },
        {
          name: '⚖️ Judiciary',
          value: '`/court file` — File a case\n`/court assign` — Assign a judge\n`/court rule` — Issue a ruling\n`/court info/list` — View cases & docket',
          inline: false
        },
        {
          name: '💼 Government & Offices',
          value: '`/office create/appoint/remove` — Manage offices\n`/office list` — All positions & holders\n`/government` — Live government overview',
          inline: false
        },
        {
          name: '📖 Constitution',
          value: '`/constitution add` — Ratify an article\n`/constitution view` — Read articles\n`/constitution repeal` — Repeal an article',
          inline: false
        },
        {
          name: '🪪 Citizens',
          value: '`/citizen register` — Become a citizen\n`/citizen profile` — View profile\n`/citizen rep` — Adjust reputation',
          inline: false
        },
        {
          name: '📊 Stats & Analytics',
          value: '`/stats turnout` — Voter turnout report for an election\n`/stats member` — Full political activity profile\n`/stats legislature` — Pass rates & top sponsors\n`/stats parties` — Party comparison breakdown',
          inline: false
        },
        {
          name: '⏰ Reminders',
          value: '`/remind set` — DM reminder before an election closes\n`/remind cancel` — Cancel a reminder\n`/remind list` — Your active reminders',
          inline: false
        }
      )
      .setFooter({ text: 'GovBot • Use /government for a live overview • Dashboard available at your server URL' });

    return interaction.reply({ embeds: [embed], flags: 64 });
  }
};
