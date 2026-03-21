# 🏛️ GovBot — Mock Government Discord Bot

A full-featured Discord bot for mock-government servers with a web dashboard. Built with **discord.js v14**, **Express**, **SQLite**, and vanilla JS.

---

## ✨ Features

| Module | Features |
|---|---|
| 🗳️ **Elections** | Create elections, candidate registration, live voting, auto-close & tally |
| 🏛️ **Parties** | Found parties, member management, ideology, leadership |
| ⚖️ **Judiciary** | File cases, assign judges, verdicts, court docket |
| 📜 **Legislature** | Propose bills, vote, pass into law or reject |
| 📖 **Laws** | View all enacted legislation |
| 💼 **Offices** | Create positions, appoint/remove, role integration |
| 📜 **Constitution** | Ratify articles, repeal amendments |
| 🪪 **Citizens** | Registration, profiles, reputation |
| 🌐 **Dashboard** | Full web dashboard with Discord OAuth2 login |
| 📡 **Activity Log** | All government actions logged automatically |

---

## 🚀 Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
CLIENT_SECRET=your_client_secret   # For dashboard OAuth
GUILD_ID=your_guild_id             # Optional: faster command deploy
SESSION_SECRET=any_random_string
DASHBOARD_URL=http://localhost:3000
CALLBACK_URL=http://localhost:3000/auth/callback
DASHBOARD_PORT=3000
```

### 3. Create your Discord Application

1. Go to [discord.com/developers](https://discord.com/developers/applications)
2. Create a new application
3. Under **Bot**, create a bot and copy the token → `DISCORD_TOKEN`
4. Copy the **Application ID** → `CLIENT_ID`
5. Copy the **Client Secret** → `CLIENT_SECRET`
6. Under **OAuth2 → Redirects**, add: `http://localhost:3000/auth/callback`
7. Enable these **Privileged Gateway Intents**: `Server Members Intent`
8. Invite the bot with scopes: `bot`, `applications.commands`
9. Bot needs these permissions: `Manage Roles`, `Send Messages`, `Embed Links`, `Read Message History`

### 4. Deploy slash commands

```bash
npm run deploy
```

### 5. Start the bot

```bash
npm start
```

### 6. Start the dashboard

In a second terminal:

```bash
npm run dashboard
```

Dashboard at: **http://localhost:3000**

---

## 📋 All Slash Commands

### ⚙️ Setup (Admin)
| Command | Description |
|---|---|
| `/setup government name:` | Set your government's name |
| `/setup channels` | Configure elections/court/legislature channels |
| `/setup view` | View current configuration |

### 🗳️ Elections
| Command | Description |
|---|---|
| `/election create title: office: hours: description:` | Create election (Admin) |
| `/election list` | List all elections |
| `/election info id:` | View election details & live results |
| `/election register id: platform:` | Register as candidate |
| `/election open id:` | Open voting immediately (Admin) |
| `/election close id:` | Force close & tally (Admin) |
| `/vote election_id: candidate:` | Cast your vote (ephemeral) |

### 🏛️ Political Parties
| Command | Description |
|---|---|
| `/party create name: abbreviation: ideology:` | Found a party |
| `/party join name:` | Join a party |
| `/party leave` | Leave your party |
| `/party info name:` | View party details |
| `/party list` | All active parties |
| `/party members name:` | View members |
| `/party promote member: role:` | Promote member (leader only) |
| `/party disband` | Dissolve party (leader only) |

### ⚖️ Judiciary
| Command | Description |
|---|---|
| `/court file title: description: defendant:` | File a case |
| `/court assign case_id: judge:` | Assign a judge (Admin) |
| `/court rule case_id: verdict: ruling:` | Issue ruling (judge) |
| `/court info case_id:` | Case details |
| `/court list status:` | Court docket |

### 📋 Legislature
| Command | Description |
|---|---|
| `/bill propose title: content:` | Propose a bill |
| `/bill vote bill_id: vote:` | Vote yes/no/abstain |
| `/bill pass bill_id:` | Pass into law (Admin) |
| `/bill reject bill_id:` | Reject bill (Admin) |
| `/bill info bill_id:` | Bill details |
| `/bill list` | All bills |
| `/bill laws` | All enacted laws |

### 💼 Government
| Command | Description |
|---|---|
| `/office create name:` | Create an office (Admin) |
| `/office appoint office: user:` | Appoint to office (Admin) |
| `/office remove office:` | Remove from office (Admin) |
| `/office list` | All offices |
| `/government` | Full government overview |

### 📜 Constitution
| Command | Description |
|---|---|
| `/constitution add article: title: content:` | Add/replace article (Admin) |
| `/constitution view article:` | Read articles |
| `/constitution repeal article:` | Repeal article (Admin) |

### 🪪 Citizens
| Command | Description |
|---|---|
| `/citizen register` | Register as citizen |
| `/citizen profile user:` | View profile |
| `/citizen rep user: amount:` | Adjust reputation (Admin) |

### 🆘 Help
| Command | Description |
|---|---|
| `/help` | Full command reference |

---

## 🌐 Dashboard Features

- **Discord OAuth2 Login** — Log in with your Discord account
- **Server Selector** — Switch between all your servers
- **Government Overview** — Live stats, party distribution chart, recent elections
- **Elections** — Live vote counts with progress bars
- **Parties** — Party cards with ideology, leader, member count
- **Bills** — Vote tallies with visual vote bars
- **Laws** — Full text of enacted legislation
- **Court** — Complete docket view
- **Offices** — All positions and current holders
- **Constitution** — All ratified articles
- **Citizens** — Full citizen registry
- **Activity Log** — All government events

---

## 🗂️ Project Structure

```
govbot/
├── bot/
│   ├── index.js              # Bot entry point
│   ├── database.js           # SQLite schema & connection
│   ├── deploy-commands.js    # Command deployment
│   ├── commands/
│   │   ├── setup.js
│   │   ├── election.js
│   │   ├── vote.js
│   │   ├── party.js
│   │   ├── court.js
│   │   ├── bill.js
│   │   ├── office.js
│   │   ├── citizen.js
│   │   ├── government.js
│   │   ├── constitution.js
│   │   └── help.js
│   └── utils/
│       ├── helpers.js
│       └── electionScheduler.js
├── dashboard/
│   ├── server.js             # Express API + auth server
│   └── public/
│       └── index.html        # Single-page dashboard
├── data/
│   └── govbot.db             # SQLite database (auto-created)
├── .env.example
├── package.json
└── README.md
```

---

## 🔒 Permissions Model

- **Administrator** — `/setup`, `/office create`, `/constitution add/repeal`
- **Manage Server** — `/election create/open/close`, `/office appoint/remove`, `/bill pass/reject`, `/court assign`
- **Any Member** — `/citizen register`, `/party join/leave/create`, `/election register`, `/vote`, `/court file`, `/bill propose`, `/bill vote`

---

## 📦 Tech Stack

- **Discord.js v14** — Bot framework
- **better-sqlite3** — Fast synchronous SQLite
- **Express** — Dashboard API server
- **Passport + passport-discord** — OAuth2 authentication
- **socket.io** — Live updates (ready for extension)
- **node-cron** — Scheduled election checking
- **Chart.js** — Dashboard charts
