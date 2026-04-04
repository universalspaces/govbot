import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');
mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'govbot.db'));

// ── Performance + Safety ─────────────────────────────────────────────
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -32000'); // 32MB cache
db.pragma('temp_store = MEMORY');

// Auto-checkpoint WAL to prevent runaway growth (~4MB)
db.pragma('wal_autocheckpoint = 1000');

// ── Schema ───────────────────────────────────────────────────────────
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
    default_initiative_signatures INTEGER DEFAULT 10,
    parliament_role TEXT,
    citizenship_oath TEXT,
    require_citizenship INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );

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

  CREATE TABLE IF NOT EXISTS party_members (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    party_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (guild_id, user_id),
    FOREIGN KEY (party_id) REFERENCES parties(id)
  );

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

  CREATE TABLE IF NOT EXISTS offices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    role_id TEXT,
    holder_id TEXT,
    term_length_days INTEGER DEFAULT 30,
    is_elected INTEGER DEFAULT 1,
    is_permanent INTEGER DEFAULT 0,
    assumed_at INTEGER,
    UNIQUE(guild_id, name)
  );

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

  CREATE TABLE IF NOT EXISTS bill_votes (
    bill_id INTEGER NOT NULL,
    voter_id TEXT NOT NULL,
    vote TEXT NOT NULL,
    voted_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (bill_id, voter_id),
    FOREIGN KEY (bill_id) REFERENCES bills(id)
  );

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

  CREATE TABLE IF NOT EXISTS citizens (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    citizen_number INTEGER,
    registered_at INTEGER DEFAULT (unixepoch()),
    reputation INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS treasury (
    guild_id TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 10000,
    currency_name TEXT DEFAULT 'Credits',
    currency_symbol TEXT DEFAULT '₡',
    last_updated INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS treasury_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description TEXT NOT NULL,
    authorized_by TEXT NOT NULL,
    recipient_id TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS citizen_wallets (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    balance INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS admin_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    reason TEXT,
    details TEXT,
    logged_at INTEGER DEFAULT (unixepoch())
  );

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

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT,
    target TEXT,
    details TEXT,
    logged_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS rcv_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_id INTEGER NOT NULL,
    voter_id TEXT NOT NULL,
    preferences TEXT NOT NULL,
    voted_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(election_id, voter_id),
    FOREIGN KEY (election_id) REFERENCES elections(id)
  );

  CREATE TABLE IF NOT EXISTS referendums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_by TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    votes_yes INTEGER DEFAULT 0,
    votes_no INTEGER DEFAULT 0,
    votes_abstain INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    ends_at INTEGER,
    result TEXT
  );

  CREATE TABLE IF NOT EXISTS referendum_votes (
    referendum_id INTEGER NOT NULL,
    voter_id TEXT NOT NULL,
    vote TEXT NOT NULL,
    voted_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (referendum_id, voter_id),
    FOREIGN KEY (referendum_id) REFERENCES referendums(id)
  );

  CREATE TABLE IF NOT EXISTS initiatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    proposed_action TEXT NOT NULL,
    type TEXT DEFAULT 'bill',
    creator_id TEXT NOT NULL,
    status TEXT DEFAULT 'collecting',
    signatures_required INTEGER DEFAULT 10,
    created_at INTEGER DEFAULT (unixepoch()),
    expires_at INTEGER,
    fulfilled_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS initiative_signatures (
    initiative_id INTEGER NOT NULL,
    signer_id TEXT NOT NULL,
    signed_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (initiative_id, signer_id),
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id)
  );

  CREATE TABLE IF NOT EXISTS impeachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    office TEXT NOT NULL,
    charges TEXT NOT NULL,
    brought_by TEXT NOT NULL,
    status TEXT DEFAULT 'trial',
    votes_convict INTEGER DEFAULT 0,
    votes_acquit INTEGER DEFAULT 0,
    votes_abstain INTEGER DEFAULT 0,
    filed_at INTEGER DEFAULT (unixepoch()),
    concluded_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS impeachment_votes (
    impeachment_id INTEGER NOT NULL,
    voter_id TEXT NOT NULL,
    vote TEXT NOT NULL,
    voted_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (impeachment_id, voter_id),
    FOREIGN KEY (impeachment_id) REFERENCES impeachments(id)
  );

  CREATE TABLE IF NOT EXISTS bill_cosponsors (
    bill_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    cosigned_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (bill_id, user_id),
    FOREIGN KEY (bill_id) REFERENCES bills(id)
  );

  CREATE TABLE IF NOT EXISTS office_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    office_name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    assumed_at INTEGER NOT NULL,
    vacated_at INTEGER,
    reason TEXT DEFAULT 'term_ended'
  );

  CREATE TABLE IF NOT EXISTS term_limits (
    guild_id TEXT NOT NULL,
    office_name TEXT NOT NULL,
    max_terms INTEGER NOT NULL DEFAULT 2,
    PRIMARY KEY (guild_id, office_name)
  );

  CREATE TABLE IF NOT EXISTS election_reminders (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    election_id INTEGER NOT NULL,
    remind_at INTEGER NOT NULL,
    sent INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id, election_id)
  );

  CREATE TABLE IF NOT EXISTS polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    options TEXT NOT NULL,
    ends_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    message_id TEXT,
    channel_id TEXT,
    anonymous INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id INTEGER NOT NULL,
    voter_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    voted_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (poll_id, voter_id),
    FOREIGN KEY (poll_id) REFERENCES polls(id)
  );

  CREATE TABLE IF NOT EXISTS bill_voting_config (
    bill_id INTEGER PRIMARY KEY,
    quorum INTEGER,
    voting_deadline INTEGER,
    FOREIGN KEY (bill_id) REFERENCES bills(id)
  );

  CREATE TABLE IF NOT EXISTS recalls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    office TEXT NOT NULL,
    reason TEXT NOT NULL,
    creator_id TEXT NOT NULL,
    status TEXT DEFAULT 'collecting',
    signatures_required INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    expires_at INTEGER,
    election_id INTEGER,
    FOREIGN KEY (election_id) REFERENCES elections(id)
  );

  CREATE TABLE IF NOT EXISTS recall_signatures (
    recall_id INTEGER NOT NULL,
    signer_id TEXT NOT NULL,
    signed_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (recall_id, signer_id),
    FOREIGN KEY (recall_id) REFERENCES recalls(id)
  );

  CREATE TABLE IF NOT EXISTS judges (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    appointed_by TEXT NOT NULL,
    appointed_at INTEGER DEFAULT (unixepoch()),
    is_active INTEGER DEFAULT 1,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS case_appeals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    original_case_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    grounds TEXT NOT NULL,
    appellant_id TEXT NOT NULL,
    judge_id TEXT,
    status TEXT DEFAULT 'filed',
    verdict TEXT,
    ruling TEXT,
    filed_at INTEGER DEFAULT (unixepoch()),
    ruled_at INTEGER,
    FOREIGN KEY (original_case_id) REFERENCES cases(id)
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_activity_log_guild ON activity_log(guild_id);
  CREATE INDEX IF NOT EXISTS idx_admin_log_guild ON admin_log(guild_id);
`);

// ── Migrations ──────────────────────────────────────────────────────
const officeColumns = db.pragma('table_info(offices)').map(c => c.name);
const serverConfigColumns = db.pragma('table_info(server_config)').map(c => c.name);

if (!officeColumns.includes('is_permanent')) {
  db.exec('ALTER TABLE offices ADD COLUMN is_permanent INTEGER DEFAULT 0;');
}

if (!serverConfigColumns.includes('parliament_role')) {
  db.exec('ALTER TABLE server_config ADD COLUMN parliament_role TEXT;');
}
if (!serverConfigColumns.includes('citizenship_oath')) {
  db.exec('ALTER TABLE server_config ADD COLUMN citizenship_oath TEXT;');
}
if (!serverConfigColumns.includes('require_citizenship')) {
  db.exec('ALTER TABLE server_config ADD COLUMN require_citizenship INTEGER DEFAULT 0;');
}

// ── Maintenance (NEW) ───────────────────────────────────────────────
export function pruneOldData() {
  const DAYS = 30 * 24 * 60 * 60;
  db.prepare('DELETE FROM activity_log WHERE logged_at < unixepoch() - ?').run(DAYS);
  db.prepare('DELETE FROM admin_log WHERE logged_at < unixepoch() - ?').run(DAYS);
  db.prepare('DELETE FROM treasury_transactions WHERE created_at < unixepoch() - ?').run(DAYS);
}

export function checkpoint() {
  db.pragma('wal_checkpoint(FULL)');
}

export function vacuum() {
  db.exec('VACUUM');
}

export function startMaintenance(intervalHours = 6) {
  setInterval(() => {
    try {
      pruneOldData();
      checkpoint();
      console.log('[DB] Maintenance complete');
    } catch (e) {
      console.error('[DB] Maintenance error:', e);
    }
  }, intervalHours * 60 * 60 * 1000);
}

export default db;
