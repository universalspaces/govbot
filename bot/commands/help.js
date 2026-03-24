import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all GovBot commands and features'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🏛️ GovBot — Command Reference')
      .setDescription('A full mock-government management bot. All commands use slash commands.')
      .addFields(
        {
          name: '⚙️ Setup',
          value: '`/setup government` — Set government name\n`/setup channels` — Configure channels\n`/setup defaults` — Set default election hours & initiative signatures\n`/setup view` — View configuration',
          inline: false
        },
        {
          name: '🗳️ Elections',
          value: '`/election create` — Create election (FPTP or RCV, optional scheduled start)\n`/election list/info` — View elections\n`/election register` — Run for office (term limits enforced)\n`/election withdraw` — Withdraw your candidacy\n`/election open/close` — Control voting\n`/election cancel` — Cancel & delete an election\n`/vote` — Cast your vote (up to 5 ranked choices for RCV)',
          inline: false
        },
        {
          name: '📊 Polls',
          value: '`/poll create` — Create a multi-option informal poll (2–8 options, optional deadline & anonymous mode)\n`/poll vote` — Vote on a poll (changeable while open)\n`/poll info` — Live results with bar chart\n`/poll list` — All polls\n`/poll close` — Close early (creator or Admin)\n`/poll voters` — See who voted for what (non-anonymous only)',
          inline: false
        },
        {
          name: '📋 Recall Petitions',
          value: '`/recall file` — File a recall petition against a current officeholder\n`/recall sign` — Sign a petition to support it\n`/recall info` — Petition details and progress\n`/recall list` — All recall petitions\n`/recall trigger` — Call a recall election once qualified (Admin)\n`/recall withdraw` — Withdraw a petition (creator or Admin)',
          inline: false
        },
        {
          name: '📊 Referendums',
          value: '`/referendum create` — Call a yes/no referendum (auto-closes at deadline)\n`/referendum vote` — Vote yes / no / abstain\n`/referendum info/list` — View referendums\n`/referendum close` — Manually close',
          inline: false
        },
        {
          name: '📣 Citizen Initiatives',
          value: '`/initiative propose` — File an initiative\n`/initiative sign` — Sign to support\n`/initiative info/list` — View progress\n`/initiative withdraw` — Withdraw your initiative',
          inline: false
        },
        {
          name: '⚖️ Impeachment',
          value: '`/impeach file` — File articles of impeachment\n`/impeach vote` — Vote convict / acquit / abstain\n`/impeach conclude` — Tally & execute verdict\n`/impeach info/list` — View proceedings',
          inline: false
        },
        {
          name: '🏛️ Political Parties',
          value: '`/party create` — Found a party\n`/party join/leave` — Join or leave\n`/party info/list/members` — View parties\n`/party promote` — Promote a member\n`/party transfer` — Transfer leadership to another member\n`/party disband` — Dissolve party',
          inline: false
        },
        {
          name: '📜 Legislature',
          value: '`/bill propose` — Propose a bill (optional voting deadline & quorum)\n`/bill amend` — Amend a bill (resets votes)\n`/bill cosponsor` — Co-sponsor a bill\n`/bill vote` — Vote yea / nay / abstain (changeable while open)\n`/bill pass/reject` — Pass or reject (quorum enforced if set)\n`/bill repeal` — Repeal an enacted law\n`/bill info/list/laws` — View bills & laws',
          inline: false
        },
        {
          name: '💰 Treasury',
          value: '`/treasury balance` — View government balance & recent transactions\n`/treasury wallet` — View a citizen\'s wallet\n`/treasury transactions` — Full transaction ledger\n`/treasury richlist` — Wealthiest citizens\n`/treasury send` — Send funds to another citizen\n`/treasury configure` — Set currency name & symbol *(Admin)*\n`/treasury deposit/withdraw` — Manage treasury funds *(Admin)*\n`/treasury grant/pay` — Send funds to a citizen *(Admin)*\n`/treasury fine` — Deduct from a citizen\'s wallet *(Admin)*\n`/treasury transfer` — Move funds between citizens *(Admin)*',
          inline: false
        },
        {
          name: '📋 Term Limits',
          value: '`/termlimit set/remove` — Configure limits per office\n`/termlimit list` — All limits with current counts\n`/termlimit check` — View a citizen\'s term history',
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
          value: '`/constitution add/repeal` — Manage articles\n`/constitution view` — Read articles',
          inline: false
        },
        {
          name: '🪪 Citizens',
          value: '`/citizen register` — Become a citizen\n`/citizen profile` — View profile\n`/citizen rep` — Adjust reputation',
          inline: false
        },
        {
          name: '📊 Stats & Analytics',
          value: '`/stats turnout` — Voter turnout report\n`/stats member` — Full political activity profile\n`/stats legislature` — Pass rates & top sponsors\n`/stats parties` — Party comparison breakdown',
          inline: false
        },
        {
          name: '🔧 Admin Tools',
          value: '`/admin auditlog` — Admin action audit log\n`/admin announce` — Send official announcement\n`/admin server_stats` — Full server health check\n`/admin reset_citizen` — Remove a citizen registration\n`/admin remove_party_member` — Remove user from party\n`/admin dismiss_case` — Dismiss a court case\n`/admin close_referendum` — Force-close a referendum\n`/admin expire_initiative` — Expire an initiative\n`/admin set_reputation` — Set citizen reputation directly\n`/admin purge_elections` — Clean up old election data',
          inline: false
        },
        {
          name: '⏰ Reminders',
          value: '`/remind set` — DM reminder before an election closes\n`/remind cancel/list` — Manage your reminders',
          inline: false
        }
      )
      .setFooter({ text: 'GovBot • /government for a live overview • Dashboard at your server URL' });

    return interaction.reply({ embeds: [embed], flags: 64 });
  }
};