import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import db from '../bot/database.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'govbot-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 86400000 }
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport Discord OAuth2 (only if credentials are configured)
const oauthConfigured = !!(process.env.CLIENT_ID && process.env.CLIENT_SECRET);

const replitDomain = process.env.REPLIT_DEV_DOMAIN;
const defaultCallbackURL = replitDomain
  ? `https://${replitDomain}/auth/callback`
  : 'http://localhost:5000/auth/callback';

if (oauthConfigured) {
  passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || defaultCallbackURL,
    scope: ['identify', 'guilds']
  }, (accessToken, refreshToken, profile, done) => done(null, profile)));
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Auth middleware
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

// ─── AUTH ROUTES ───────────────────────────────────────────────────────────
app.get('/auth/discord', (req, res, next) => {
  if (!oauthConfigured) return res.status(503).json({ error: 'Discord OAuth not configured. Add CLIENT_ID and CLIENT_SECRET secrets.' });
  passport.authenticate('discord')(req, res, next);
});
app.get('/auth/callback', (req, res, next) => {
  if (!oauthConfigured) return res.redirect('/?error=oauth_not_configured');
  passport.authenticate('discord', { failureRedirect: '/?error=auth_failed' })(req, res, next);
}, (req, res) => res.redirect('/dashboard'));
app.get('/auth/logout', (req, res) => { req.logout(() => res.redirect('/')); });
app.get('/auth/me', (req, res) => {
  if (!req.user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: { id: req.user.id, username: req.user.username, avatar: req.user.avatar, guilds: req.user.guilds } });
});

// ─── API ROUTES ────────────────────────────────────────────────────────────

// Government overview
app.get('/api/:guildId/overview', requireAuth, (req, res) => {
  const { guildId } = req.params;
  const config = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(guildId);
  const treasury = db.prepare('SELECT * FROM treasury WHERE guild_id = ?').get(guildId);
  const stats = {
    citizens: db.prepare('SELECT COUNT(*) as cnt FROM citizens WHERE guild_id = ?').get(guildId).cnt,
    parties: db.prepare('SELECT COUNT(*) as cnt FROM parties WHERE guild_id = ? AND is_active = 1').get(guildId).cnt,
    laws: db.prepare("SELECT COUNT(*) as cnt FROM laws WHERE guild_id = ? AND is_active = 1").get(guildId).cnt,
    activeElections: db.prepare("SELECT COUNT(*) as cnt FROM elections WHERE guild_id = ? AND status = 'active'").get(guildId).cnt,
    openCases: db.prepare("SELECT COUNT(*) as cnt FROM cases WHERE guild_id = ? AND status != 'closed'").get(guildId).cnt,
    pendingBills: db.prepare("SELECT COUNT(*) as cnt FROM bills WHERE guild_id = ? AND status = 'proposed'").get(guildId).cnt,
    totalOffices: db.prepare('SELECT COUNT(*) as cnt FROM offices WHERE guild_id = ?').get(guildId).cnt,
    filledOffices: db.prepare('SELECT COUNT(*) as cnt FROM offices WHERE guild_id = ? AND holder_id IS NOT NULL').get(guildId).cnt,
  };
  res.json({ config, treasury, stats });
});

// Elections
app.get('/api/:guildId/elections', requireAuth, (req, res) => {
  const elections = db.prepare('SELECT * FROM elections WHERE guild_id = ? ORDER BY id DESC').all(req.params.guildId);
  const enriched = elections.map(e => ({
    ...e,
    candidates: db.prepare('SELECT * FROM candidates WHERE election_id = ?').all(e.id),
    totalVotes: db.prepare('SELECT COALESCE(SUM(votes),0) as total FROM candidates WHERE election_id = ?').get(e.id).total
  }));
  res.json(enriched);
});

app.get('/api/:guildId/elections/:id', requireAuth, (req, res) => {
  const election = db.prepare('SELECT * FROM elections WHERE id = ? AND guild_id = ?').get(req.params.id, req.params.guildId);
  if (!election) return res.status(404).json({ error: 'Not found' });
  const candidates = db.prepare('SELECT * FROM candidates WHERE election_id = ? ORDER BY votes DESC').all(election.id);
  const totalVotes = candidates.reduce((s, c) => s + c.votes, 0);
  res.json({ ...election, candidates, totalVotes });
});

// Parties
app.get('/api/:guildId/parties', requireAuth, (req, res) => {
  const parties = db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM party_members WHERE party_id = p.id) as member_count
    FROM parties p WHERE p.guild_id = ? AND p.is_active = 1 ORDER BY member_count DESC
  `).all(req.params.guildId);
  res.json(parties);
});

// Bills
app.get('/api/:guildId/bills', requireAuth, (req, res) => {
  const bills = db.prepare('SELECT * FROM bills WHERE guild_id = ? ORDER BY id DESC').all(req.params.guildId);
  res.json(bills);
});

// Laws
app.get('/api/:guildId/laws', requireAuth, (req, res) => {
  const laws = db.prepare('SELECT * FROM laws WHERE guild_id = ? AND is_active = 1 ORDER BY id DESC').all(req.params.guildId);
  res.json(laws);
});

// Court
app.get('/api/:guildId/cases', requireAuth, (req, res) => {
  const cases = db.prepare('SELECT * FROM cases WHERE guild_id = ? ORDER BY id DESC').all(req.params.guildId);
  res.json(cases);
});

// Offices
app.get('/api/:guildId/offices', requireAuth, (req, res) => {
  const offices = db.prepare('SELECT * FROM offices WHERE guild_id = ?').all(req.params.guildId);
  res.json(offices);
});

// Constitution
app.get('/api/:guildId/constitution', requireAuth, (req, res) => {
  const articles = db.prepare('SELECT * FROM constitution WHERE guild_id = ? AND is_active = 1 ORDER BY article_number').all(req.params.guildId);
  res.json(articles);
});

// Activity log
app.get('/api/:guildId/activity', requireAuth, (req, res) => {
  const log = db.prepare('SELECT * FROM activity_log WHERE guild_id = ? ORDER BY id DESC LIMIT 50').all(req.params.guildId);
  res.json(log);
});

// Citizens
app.get('/api/:guildId/citizens', requireAuth, (req, res) => {
  const citizens = db.prepare('SELECT * FROM citizens WHERE guild_id = ? ORDER BY citizen_number ASC').all(req.params.guildId);
  res.json(citizens);
});

// Party seat distribution (for charts)
app.get('/api/:guildId/seat-distribution', requireAuth, (req, res) => {
  const data = db.prepare(`
    SELECT p.name, p.color, p.emoji, COUNT(pm.user_id) as seats
    FROM parties p
    LEFT JOIN party_members pm ON p.id = pm.party_id
    WHERE p.guild_id = ? AND p.is_active = 1
    GROUP BY p.id ORDER BY seats DESC
  `).all(req.params.guildId);
  res.json(data);
});

// Election results history (for charts)
app.get('/api/:guildId/election-history', requireAuth, (req, res) => {
  const elections = db.prepare("SELECT * FROM elections WHERE guild_id = ? AND status = 'closed' ORDER BY id DESC LIMIT 10").all(req.params.guildId);
  res.json(elections);
});

// ─── CATCH-ALL ──────────────────────────────────────────────────────────────
app.get('/dashboard*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ─── SOCKET.IO ──────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('subscribe', (guildId) => socket.join(guildId));
});

export { io };

const PORT = process.env.DASHBOARD_PORT || 5000;
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is in use. Retrying in 2 seconds...`);
    setTimeout(() => httpServer.listen(PORT, '0.0.0.0'), 2000);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Dashboard running at http://0.0.0.0:${PORT}`);
  if (replitDomain) console.log(`🔗 Public URL: https://${replitDomain}`);
  if (oauthConfigured) console.log(`🔑 OAuth callback: ${process.env.CALLBACK_URL || defaultCallbackURL}`);
});
