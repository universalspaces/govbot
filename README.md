# 🏛️ GovBot — Mock Government Discord Bot

A full-featured Discord bot for mock-government servers with a minimal web dashboard. Built with **discord.js v14**, **Express**, **SQLite (better-sqlite3)**, and vanilla JS. Runs on **Node.js 20**.

---

## ✨ Features

| Module | What it does |
|---|---|
| 🗳️ **Elections** | Full lifecycle — create, registration, live voting, auto-tally & winner announcement |
| 🏛️ **Parties** | Found parties, manage members, promote officers, leadership transfers |
| ⚖️ **Judiciary** | File cases, assign judges, issue verdicts, full court docket |
| 📜 **Legislature** | Propose bills, yea/nay/abstain voting, pass into law or reject |
| 📖 **Laws** | Registry of all enacted legislation |
| 💼 **Offices** | Create government positions, appoint/remove holders, Discord role sync |
| 📋 **Constitution** | Ratify articles, repeal amendments |
| 🪪 **Citizens** | Registration, profiles, reputation system |
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
8. Invite the bot using these OAuth2 scopes: `bot`, `applications.commands`
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

The dashboard port is already set to `5000` in the Replit environme
