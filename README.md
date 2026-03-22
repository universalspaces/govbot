# 🏛️ GovBot — Mock Government Discord Bot

A full-featured Discord bot for mock-government servers with a minimal web dashboard. Built with **discord.js v14**, **Express**, **SQLite (better-sqlite3)**, and vanilla JS. Runs on **Node.js 20**.

---

## ✨ Features

| Module | What it does |
|---|---|
| 🗳️ **Elections** | FPTP and Ranked Choice (instant-runoff), scheduled starts, candidate registration, auto-tally, winner announcement |
| 📊 **Referendums** | Yes/no questions put directly to citizens, auto-closes at deadline |
| 📣 **Citizen Initiatives** | Signature collection with configurable thresholds, auto-announces when fulfilled |
| ⚖️ **Impeachment** | File charges, hold trials, convict/acquit vote, automatic office removal on conviction |
| 🏛️ **Parties** | Found parties, manage members, promote officers, transfer leadership, automatic leader succession |
| 📜 **Legislature** | Propose bills, amendments, co-sponsorship, yea/nay/abstain voting (changeable while open), pass into law or reject, repeal laws |
| 📋 **Term Limits** | Per-office term limits enforced automatically at registration and appointment, full term history |
| ⚖️ **Judiciary** | File cases, assign judges, issue verdicts, court docket |
| 💼 **Offices** | Create positions, appoint/remove, Discord role sync, term history tracking |
| 📖 **Constitution** | Ratify and repeal articles |
| 🪪 **Citizens** | Registration, profiles, reputation system |
| 💰 **Treasury** | Government balance, citizen wallets, full transaction ledger, grants, fines, payments, citizen-to-citizen transfers |
| 🔧 **Admin Tools** | Audit log, announcements, bulk data management, server health stats |
| 📊 **Stats** | Voter turnout, member activity profiles, legislature analytics, party comparisons |
| ⏰ **Reminders** | Opt-in DM reminders before elections close |
| 🌐 **Dashboard** | Minimal web dashboard with Discord OAuth2 login |
| 📡 **Activity Log** | Every government action logged automatically |

---

## 🚀 Setup

### 1. Create your Discord Application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** and give it a name
3. Under **Bot**, click **Add Bot** and copy the token → `DISCORD_TOKEN`
4. On the **General Information** page, copy the **Application ID** → `CLIENT_ID`
5. Under **OAuth2**, copy the **Client Secret** → `CLIENT_SECRET`
6. Under **OAuth2 → Redirects**, add your callback URL (see step 3 below)
7. Under **Bot → Privileged Gateway Intents**, enable **Server Members Intent**
8. Invite the bot with OAuth2 scopes: `bot`, `applications.commands`
9. Required bot permissions: `Manage Roles`, `Send Messages`, `Embed Links`, `Read Message History`

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

**On Replit** — add these via the **Secrets** panel (not a `.env` file):

| Secret | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
| `CLIENT_ID` | Application ID from the Discord Developer Portal |
| `CLIENT_SECRET` | OAuth2 client secret (required for dashboard login) |
| `SESSION_SECRET` | Any random string for Express session security |
| `GUILD_ID` | *(Optional)* A specific server ID for faster command deployment |

The dashboard port is already set to `5000` in the Replit environment — you don't need to set `DASHBOARD_PORT`.

For the OAuth2 redirect, go back to your Discord application's **OAuth2 → Redirects** and add:
```
https://<your-replit-app-url>/auth/callback
```

**Running locally** — create a `.env` file in the project root:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
CLIENT_SECRET=your_client_secret
SESSION_SECRET=any_random_string
GUILD_ID=your_guild_id
DASHBOARD_PORT=3000
CALLBACK_URL=http://localhost:3000/auth/callback
```

### 4. Deploy slash commands

Run once, and again any time commands are added or changed:

```bash
npm run deploy
```

If `GUILD_ID` is set, commands deploy to that server instantly. Without it they deploy globally and can take up to an hour to appear.

### 5. Start the project

**On Replit** — press **Run**. This starts both the bot and dashboard in parallel.

**Locally** — two terminals:

```bash
# Terminal 1 — Dashboard
npm run dashboard

# Terminal 2 — Bot
npm start
```

Dashboard runs at `http://localhost:3000` (or port 5000 on Replit).

---

## 📋 All Slash Commands

### ⚙️ Setup
| Command | Who | Description |
|---|---|---|
| `/setup government name:` | Admin | Set your government's name |
| `/setup channels` | Admin | Configure elections, announcements, court, and legislature channels |
| `/setup defaults` | Admin | Set default election duration and initiative signature threshold |
| `/setup view` | Admin | View current server configuration |

### 🗳️ Elections
| Command | Who | Description |
|---|---|---|
| `/election create title: office: hours: type: start_in_hours:` | Admin | Create an election — choose FPTP or RCV, optionally schedule a future start |
| `/election list` | Anyone | List all elections |
| `/election info id:` | Anyone | View details and live vote counts (shows RCV round breakdown for ranked elections) |
| `/election register id: platform:` | Anyone | Register as a candidate (term limits enforced automatically) |
| `/election withdraw id:` | Anyone | Withdraw your candidacy before voting opens |
| `/election open id:` | Admin | Open voting immediately |
| `/election close id:` | Admin | Force close and tally results |
| `/election cancel id:` | Admin | Cancel an election and delete all associated data |
| `/vote election_id: candidate: rank2: rank3: rank4: rank5:` | Anyone | Cast your vote — use rank2–rank5 for RCV elections |

### 📊 Referendums
| Command | Who | Description |
|---|---|---|
| `/referendum create title: description: hours:` | Admin | Call a yes/no referendum (auto-closes at deadline) |
| `/referendum vote id: vote:` | Anyone | Vote yes / no / abstain |
| `/referendum info id:` | Anyone | Live vote tally |
| `/referendum list` | Anyone | All referendums |
| `/referendum close id:` | Admin | Manually close and record result |

### 📣 Citizen Initiatives
| Command | Who | Description |
|---|---|---|
| `/initiative propose title: description: action: type:` | Citizen | File a new initiative demanding government action |
| `/initiative sign id:` | Citizen | Sign to support — announces in channel when threshold is reached |
| `/initiative info id:` | Anyone | Details and signature progress bar |
| `/initiative list` | Anyone | All initiatives |
| `/initiative withdraw id:` | Creator / Admin | Withdraw an initiative |

### ⚖️ Impeachment
| Command | Who | Description |
|---|---|---|
| `/impeach file official: office: charges:` | Admin | File articles of impeachment against an officeholder |
| `/impeach vote id: vote:` | Anyone | Vote convict / acquit / abstain (the accused cannot vote) |
| `/impeach conclude id:` | Admin | Tally verdict — convicted officials are automatically removed from office and lose their role |
| `/impeach info id:` | Anyone | Trial details |
| `/impeach list` | Anyone | All proceedings |

### 🏛️ Political Parties
| Command | Who | Description |
|---|---|---|
| `/party create name: abbreviation: ideology:` | Anyone | Found a new party |
| `/party join name:` | Anyone | Join a party |
| `/party leave` | Anyone | Leave your party (auto-promotes next officer/member if you are leader) |
| `/party info name:` | Anyone | Party details |
| `/party list` | Anyone | All active parties |
| `/party members name:` | Anyone | Party membership |
| `/party promote member: role:` | Leader | Promote a member to officer |
| `/party transfer member:` | Leader | Transfer leadership to another member |
| `/party disband` | Leader | Dissolve the party |

### 📜 Legislature
| Command | Who | Description |
|---|---|---|
| `/bill propose title: content:` | Anyone | Propose a new bill |
| `/bill amend bill_id: new_content: reason:` | Sponsor / Admin | Amend a bill — all votes reset on amendment |
| `/bill cosponsor bill_id:` | Anyone | Co-sponsor a bill |
| `/bill vote bill_id: vote:` | Anyone | Vote yea / nay / abstain — you can change your vote while the bill is still open |
| `/bill pass bill_id:` | Admin | Pass the bill into law |
| `/bill reject bill_id:` | Admin | Reject the bill |
| `/bill repeal law_id: reason:` | Admin | Repeal an enacted law |
| `/bill info bill_id:` | Anyone | Bill details including all co-sponsors |
| `/bill list` | Anyone | All bills with co-sponsor counts |
| `/bill laws` | Anyone | All enacted laws |

### 💰 Treasury
| Command | Who | Description |
|---|---|---|
| `/treasury balance` | Anyone | Government balance and last 5 transactions |
| `/treasury wallet user:` | Anyone | View a citizen's wallet balance |
| `/treasury transactions limit:` | Anyone | Full transaction ledger |
| `/treasury richlist` | Anyone | Top 10 wealthiest citizens |
| `/treasury send to: amount: description:` | Anyone | Send funds from your wallet to another citizen |
| `/treasury configure` | Admin | Set currency name, symbol, or starting balance |
| `/treasury deposit amount: description:` | Admin | Add funds to the treasury |
| `/treasury withdraw amount: description:` | Admin | Withdraw funds from the treasury |
| `/treasury grant citizen: amount: description:` | Admin | Give treasury funds to a citizen's wallet |
| `/treasury pay citizen: amount: description:` | Admin | Pay a citizen from the treasury |
| `/treasury fine citizen: amount: description:` | Admin | Fine a citizen — funds flow back into the treasury |
| `/treasury transfer from: to: amount: description:` | Admin | Move funds between two citizen wallets |

### 📋 Term Limits
| Command | Who | Description |
|---|---|---|
| `/termlimit set office: max_terms:` | Admin | Set a term limit for an office |
| `/termlimit remove office:` | Admin | Remove a term limit |
| `/termlimit list` | Anyone | All limits with current holder term counts |
| `/termlimit check user: office:` | Anyone | Full term history for a citizen in a given office |

### ⚖️ Judiciary
| Command | Who | Description |
|---|---|---|
| `/court file title: description: defendant:` | Anyone | File a new case |
| `/court assign case_id: judge:` | Admin | Assign a judge |
| `/court rule case_id: verdict: ruling:` | Judge | Issue a ruling |
| `/court info case_id:` | Anyone | Case details |
| `/court list status:` | Anyone | Court docket, filterable by status |

### 💼 Government & Offices
| Command | Who | Description |
|---|---|---|
| `/office create name:` | Admin | Create a government office |
| `/office appoint office: user:` | Admin | Appoint someone (term limits enforced, previous holder archived) |
| `/office remove office:` | Admin | Remove the current holder |
| `/office list` | Anyone | All offices and current holders |
| `/government` | Anyone | Full live government overview — elections, referendums, initiatives, treasury, officials |

### 📖 Constitution
| Command | Who | Description |
|---|---|---|
| `/constitution add article: title: content:` | Admin | Ratify or replace an article |
| `/constitution view article:` | Anyone | Read articles (omit number to list all) |
| `/constitution repeal article:` | Admin | Repeal an article |

### 🪪 Citizens
| Command | Who | Description |
|---|---|---|
| `/citizen register` | Anyone | Register as a citizen |
| `/citizen profile user:` | Anyone | View a citizen's profile |
| `/citizen rep user: amount:` | Admin | Adjust a citizen's reputation |

### 📊 Stats & Analytics
| Command | Who | Description |
|---|---|---|
| `/stats turnout election_id:` | Anyone | Voter turnout report with participation bar |
| `/stats member user:` | Anyone | Full political activity profile |
| `/stats legislature` | Anyone | Pass rates, top sponsors, most co-sponsored bills |
| `/stats parties` | Anyone | Side-by-side party comparison |

### 🔧 Admin Tools
| Command | Who | Description |
|---|---|---|
| `/admin auditlog limit: filter_admin:` | Admin | Filterable admin action audit log |
| `/admin announce title: message: color: ping_everyone:` | Admin | Send an official announcement with optional @everyone |
| `/admin server_stats` | Admin | Full server health dashboard |
| `/admin reset_citizen user: reason:` | Admin | Remove a citizen's registration |
| `/admin remove_party_member user: reason:` | Admin | Remove a user from their party |
| `/admin dismiss_case case_id: reason:` | Admin | Dismiss a court case |
| `/admin close_referendum id: reason:` | Admin | Force-close a referendum |
| `/admin expire_initiative id: reason:` | Admin | Mark an initiative as expired |
| `/admin set_reputation user: value: reason:` | Admin | Set a citizen's reputation to an exact value |
| `/admin purge_elections days:` | Admin | Delete all closed elections older than N days |

### ⏰ Reminders
| Command | Who | Description |
|---|---|---|
| `/remind set election_id: hours_before:` | Anyone | Schedule a DM reminder before an election closes |
| `/remind cancel election_id:` | Anyone | Cancel a reminder |
| `/remind list` | Anyone | Your active reminders |

---

## 🌐 Dashboard

A minimal single-page app. Log in with Discord OAuth2 to view your server's government data.

**Pages:** Dashboard overview · Elections (live vote bars) · Referendums · Initiatives · Parties · Bills · Laws · Court docket · Impeachments · Offices · Constitution · Citizens · Treasury (ledger + richlist) · Admin Log · Activity log

---

## 🔒 Permissions

| Level | Commands |
|---|---|
| **Administrator** | `/setup`, `/office create`, `/constitution add/repeal`, `/termlimit set/remove` |
| **Manage Server** | `/election create/open/close/cancel`, `/office appoint/remove`, `/bill pass/reject/repeal`, `/court assign`, `/referendum create/close`, `/impeach file/conclude`, `/treasury` admin subcommands, `/admin` all subcommands |
| **Registered Citizen** | `/initiative propose/sign` (requires `/citizen register` first) |
| **Anyone** | All voting commands, info/list commands, `/party create/join/leave`, `/court file`, `/bill propose/cosponsor/vote`, `/treasury balance/wallet/transactions/richlist/send`, `/stats`, `/remind`, `/government` |

---

## 🗂️ Project Structure

```
govbot/
├── bot/
│   ├── index.js                    # Bot entry point
│   ├── database.js                 # SQLite schema & connection (auto-creates tables)
│   ├── deploy-commands.js          # Slash command deployment script
│   ├── commands/
│   │   ├── setup.js
│   │   ├── election.js
│   │   ├── vote.js                 # FPTP + RCV instant-runoff algorithm
│   │   ├── referendum.js
│   │   ├── initiative.js
│   │   ├── impeach.js
│   │   ├── party.js
│   │   ├── bill.js
│   │   ├── termlimit.js
│   │   ├── court.js
│   │   ├── office.js
│   │   ├── citizen.js
│   │   ├── constitution.js
│   │   ├── government.js
│   │   ├── treasury.js
│   │   ├── admin.js
│   │   ├── stats.js
│   │   ├── remind.js
│   │   └── help.js
│   └── utils/
│       ├── helpers.js              # Embed builders, logging, permission helpers
│       └── electionScheduler.js   # Cron: election auto-close, RCV tally, referendum auto-close, DM reminders, initiative expiry
├── dashboard/
│   ├── server.js                   # Express API, Discord OAuth2, Socket.IO
│   └── public/
│       └── index.html              # Single-page dashboard (vanilla JS)
├── data/
│   └── govbot.db                   # SQLite database (auto-created on first run)
├── package.json
└── README.md
```

---

## 📦 Tech Stack

| Package | Purpose |
|---|---|
| `discord.js` v14 | Discord bot framework |
| `better-sqlite3` | Fast synchronous SQLite database |
| `express` | Dashboard web server |
| `passport` + `passport-discord` | Discord OAuth2 authentication |
| `express-session` | Session management |
| `socket.io` | Real-time dashboard updates |
| `node-cron` | Election auto-close, referendum auto-close, DM reminders, initiative expiry (runs every minute) |
| `chart.js` | Party distribution chart on dashboard |
| `dotenv` | Local `.env` support |