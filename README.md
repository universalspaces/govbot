# 🏛️ GovBot

A Discord bot for running mock governments.  
Includes elections, laws, courts, parties, and a small web dashboard.

Built with discord.js v14, Express, and SQLite.

---

## Features

- Elections (FPTP + Ranked Choice)
- Bills, laws, and voting
- Offices, term limits, appointments
- Courts and impeachment
- Referendums & citizen initiatives
- Citizens, parties, profiles
- Treasury system (virtual currency)
- Stats and activity tracking
- Optional reminders
- Simple web dashboard (OAuth2 login)

---

## Setup

1. Create a Discord App
- https://discord.com/developers/applications
- Create app → add bot
- Copy DISCORD_TOKEN, CLIENT_ID, CLIENT_SECRET
- Enable Server Members Intent
- Add redirect:
  http://localhost:3000/auth/callback

2. Install
npm install

3. Environment (.env)

```
DISCORD_TOKEN=your_token
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
SESSION_SECRET=random_string
GUILD_ID=optional_test_server
DASHBOARD_PORT=3000
CALLBACK_URL=http://localhost:3000/auth/callback
```

4. Deploy commands
npm run deploy

5. Run

# Bot
npm start

# Dashboard
npm run dashboard

Open: http://localhost:3000 (doesn't apply on servers)

---

## Commands

see ```/help``` for a detailed list.

---

## Permissions

Admins → setup, config  
Mods → elections, treasury  
Citizens → initiatives  
Everyone → vote, view  

---

## Dashboard

Login with Discord to view:
elections, laws, treasury, citizens, logs

---

## Structure

- bot/        → Discord bot
- dashboard/  → Web Dashboard
- data/       → SQLite database

---

## Notes

- Roleplay tool only
- No real-world meaning
- Provided as-is

---

## Contact

unidev@iwanto.cyou
(No guarantee of response)
