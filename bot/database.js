import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '../data/govbot.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  -- Server configuration
  CREATE TABLE IF NOT EXISTS server_config (
    guild_id TEXT PRIMARY KEY,
    government_name TEXT DEFAULT 'The Republic',
    election_channel TEXT,
    announcement_channel TEXT,
    court_channel TEXT,
    legislature_channel TEXT,
    party_role_color INTEGER DEFAULT 0,
    election_duration_hours INTEGER DEFAULT 48,
    created_at INTEGER DEFAULT (unixepoch())
  );

  -- Political Parties
  CREATE TABLE IF NOT EXISTS parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    description TEXT,
    ideology TEXT,
    color TEXT DEFAULT '#5865F2',
    emoji TEXT DEFAULT '🏛️',
    leader_id TEXT,
    role_id TEXT,
    founded_at INTEGER DEFAULT (unixepoch()),
    is_active INTEGER DEFAULT 1,
    UNIQUE(guild_id, name)
  );

  -- Party Members
  CREATE TABLE IF NOT EXISTS party_members (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    party_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (guild_id, user_id),
    FOREIGN KEY (party_id) REFERENCES parties(id)
  );

  -- Elections
  CREATE TABLE IF NOT EXISTS elections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    office TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'registration',
    starts_at INTEGER,
    ends_at INTEGER,
    created_by TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    message_id TEXT,
    winner_id TEXT
  );

  -- Election Candidates
  CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    party_id INTEGER,
    platform TEXT,
    votes INTEGER DEFAULT 0,
    registered_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(election_id, user_id),
    FOREIGN KEY (election_id) REFERENCES elections(id)
  );

  -- Votes
  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_id INTEGER NOT NULL,
    voter_id TEXT NOT NULL,
    candidate_id INTEGER NOT NULL,
    voted_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(election_id, voter_id),
    FOREIGN KEY (election_id) REFERENCES elections(id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
  );

  -- Government Offices / Roles
  CREATE TABLE IF NOT EXISTS offices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    role_id TEXT,
    holder_id TEXT,
    term_length_days INTEGER DEFAULT 30,
    is_elected INTEGER DEFAULT 1,
    assumed_at INTEGER,
    UNIQUE(guild_id, name)
  );

  -- Legislature Bills
  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    sponsor_id TEXT NOT NULL,
    status TEXT DEFAULT 'proposed',
    votes_yes INTEGER DEFAULT 0,
    votes_no INTEGER DEFAULT 0,
    votes_abstain INTEGER DEFAULT 0,
    proposed_at INTEGER DEFAULT (unixepoch()),
    voted_at INTEGER,
    message_id TEXT
  );

  -- Bill Votes
  CREATE TABLE IF NOT EXISTS bill_votes (
    bill_id INTEGER NOT NULL,
    voter_id TEXT NOT NULL,
    vote TEXT NOT NULL,
    voted_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (bill_id, voter_id),
    FOREIGN KEY (bill_id) REFERENCES bills(id)
  );

  -- Court Cases
  CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    plaintiff_id TEXT NOT NULL,
    defendant_id TEXT,
    judge_id TEXT,
    status TEXT DEFAULT 'filed',
    verdict TEXT,
    ruling TEXT,
    filed_at INTEGER DEFAULT (unixepoch()),
    ruled_at INTEGER,
    message_id TEXT
  );

  -- Laws (passed bills)
  CREATE TABLE IF NOT EXISTS laws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    bill_id INTEGER,
    enacted_by TEXT,
    enacted_at INTEGER DEFAULT (unixepoch()),
    is_active INTEGER DEFAULT 1
  );

  -- Citizens (registered users)
  CREATE TABLE IF NOT EXISTS citizens (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    citizen_number INTEGER,
    registered_at INTEGER DEFAULT (unixepoch()),
    reputation INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  -- Government Treasury
  CREATE TABLE IF NOT EXISTS treasury (
    guild_id TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 10000,
    currency_name TEXT DEFAULT 'Credits',
    currency_symbol TEXT DEFAULT '₡',
    last_updated INTEGER DEFAULT (unixepoch())
  );

  -- Constitutional Amendments
  CREATE TABLE IF NOT EXISTS constitution (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    article_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    ratified_at INTEGER DEFAULT (unixepoch()),
    ratified_by TEXT,
    is_active INTEGER DEFAULT 1
  );

  -- Activity Log
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT,
    target TEXT,
    details TEXT,
    logged_at INTEGER DEFAULT (unixepoch())
  );
`);

export default db;
