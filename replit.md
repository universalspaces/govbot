# GovBot — Mock Government Discord Bot

## Project Overview

A full-featured Discord bot for mock-government servers with a web dashboard. Built with **discord.js v14**, **Express**, **SQLite (better-sqlite3)**, and vanilla JS.

## Architecture

- **`bot/`** — Discord bot entry point, command handlers, database schema, utilities
- **`dashboard/`** — Express web server with Discord OAuth2, REST API, Socket.IO, and static frontend
- **`data/`** — SQLite database file (`govbot.db`), auto-created on first run
- **`package.json`** — ES Module project, Node.js 20

## Running the App

The **dashboard** is the primary workflow, running on port **5000** (`node dashboard/server.js`).

The **bot** is a separate process (`node bot/index.js`) that requires a valid `DISCORD_TOKEN` secret.

## Environment Variables / Secrets

The following secrets must be configured via Replit Secrets:

| Secret | Description |
|---|---|
| `DISCORD_TOKEN` | Discord bot token (from Discord Developer Portal) |
| `CLIENT_ID` | Discord Application ID |
| `CLIENT_SECRET` | Discord OAuth2 Client Secret (for dashboard login) |
| `GUILD_ID` | Optional: specific server ID for faster command deploy |
| `SESSION_SECRET` | Random string for Express session security |

The following env vars are set in Replit:

| Variable | Value |
|---|---|
| `DASHBOARD_PORT` | `5000` |

## Key Design Decisions

- **SQLite** via `better-sqlite3` for synchronous local DB in `data/govbot.db`
- **Discord OAuth2** is optional at startup — the dashboard starts without it, showing a 503 on auth routes if credentials are missing
- **Socket.IO** for real-time dashboard updates (subscribe by guildId)
- **Passport.js** + `passport-discord` for OAuth2 authentication
- Dashboard listens on `0.0.0.0:5000` to work correctly behind Replit's proxy

## Features

- Elections, Parties, Legislature (Bills/Laws), Judiciary (Court Cases), Offices, Constitution, Citizens, Treasury, Activity Log
- Web dashboard with Discord OAuth2 login and real-time updates
- Cron-based election auto-close scheduler

## Code Quality

The codebase follows Discord.js v14 best practices with:
- Parameterized SQL queries (protection against SQL injection)
- Comprehensive error handling in async operations
- Helper functions for common patterns (embeds, logging, permissions)
- Proper use of Discord.js builders for commands and embeds

Recent improvements:
- Fixed embed object formatting in stats command
- Standardized permission checks to use `PermissionFlagsBits`
- Added error handling and validation to dashboard API endpoints
- Consistent import organization across all command files

## Deployment

Configured as a **VM** deployment (always-running) because it uses a local SQLite file and WebSockets. Run command: `node dashboard/server.js`.
