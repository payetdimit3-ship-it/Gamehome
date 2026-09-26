require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// 🎬 MEDIA STORAGE
const MEDIA_DIR = path.join(__dirname, 'uploads');
const TMP_MEDIA_DIR = path.join(MEDIA_DIR, 'tmp');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
if (!fs.existsSync(TMP_MEDIA_DIR)) fs.mkdirSync(TMP_MEDIA_DIR, { recursive: true });
app.use('/uploads', express.static(MEDIA_DIR));

const upload = multer({
  dest: TMP_MEDIA_DIR,
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const name = String(file.originalname || '').toLowerCase();
    const ok = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/mov'].includes(mime)
      || /\.(mp4|webm|mov|m4v)$/.test(name);
    if (!ok) return cb(new Error('Aina ya file hairuhusiwi. Tumia MP4, WebM, MOV au M4V.'));
    cb(null, true);
  }
});

const MEDIA_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'gamehub-media';

// ☁️ SUPABASE CLIENT SETUP
let supabase = null;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log('☁️ Supabase imeunganishwa — data itahifadhiwa kudumu.');
} else {
  console.log('⚠️ Supabase HAIJAWEKWA — data itapotea kila deploy mpya kwenye Render free tier!');
}

async function ensureMediaBucket() {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.storage.getBucket(MEDIA_BUCKET);
    if (!error && data) return true;
    const created = await supabase.storage.createBucket(MEDIA_BUCKET, { public: true });
    if (created.error && !/already exists|duplicate/i.test(created.error.message || '')) {
      console.warn('⚠️ Supabase Storage bucket:', created.error.message);
      return false;
    }
    console.log('☁️ Supabase Storage bucket iko tayari: ' + MEDIA_BUCKET);
    return true;
  } catch (e) {
    console.warn('⚠️ Storage bucket check:', e.message);
    return false;
  }
}

async function saveUploadedVideo(file, folder) {
  if (!file) throw new Error('Chagua video kwanza.');
  const ext = path.extname(file.originalname || '') || '.mp4';
  const safeBase = (path.basename(file.originalname || 'video', ext).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'video');
  const filename = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '-' + safeBase + ext.toLowerCase();
  const objectPath = folder + '/' + filename;
  const localPath = file.path;
  try {
    if (supabase) {
      try {
        const buffer = fs.readFileSync(localPath);
        const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(objectPath, buffer, {
          contentType: file.mimetype || 'video/mp4', upsert: false, cacheControl: '3600'
        });
        if (!error) {
          const pub = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath);
          return { url: pub.data.publicUrl, storage: 'supabase', path: objectPath, filename };
        }
        console.warn('⚠️ Supabase Storage upload failed:', error.message);
        throw new Error('Supabase Storage imekataa upload: ' + error.message + '. Hakikisha bucket ' + MEDIA_BUCKET + ' ipo na ukubwa wa file unaruhusiwa.');
      } catch (e) {
        if (e.message && e.message.startsWith('Supabase Storage imekataa')) throw e;
        throw new Error('Supabase Storage imekataa upload: ' + e.message);
      }
    }
    const targetDir = path.join(MEDIA_DIR, folder);
    fs.mkdirSync(targetDir, { recursive: true });
    const target = path.join(targetDir, filename);
    fs.renameSync(localPath, target);
    return { url: '/uploads/' + folder + '/' + filename, storage: 'local', path: target, filename };
  } finally {
    try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch (e) {}
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 📁 HIFADHI YA DATA
const DATA_DIR = path.join(__dirname, '.data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const TRACKED_FILES = [
  'users.json', 'sessions.json', 'products.json',
  'orders.json', 'requests.json', 'security.json',
  'marketplace.json', 'coupons.json', 'reviews.json',
  'matches.json', 'tournaments.json', 'live_streams.json',
  'courses.json', 'movies.json', 'media.json',
  'ai_builder_runs.json', 'banners.json', 'settings.json',
  'public_chat.json', 'health_chats.json', 'boss_approvals.json'
];

function readJson(file, fallback) {
  try {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) { return fallback; }
}

async function writeJson(file, data) {
  const filePath = path.join(DATA_DIR, file);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  if (!supabase) return { local: true, cloud: false };
  try {
    const { error } = await supabase.from(process.env.SUPABASE_KV_TABLE || 'kv_store').upsert({
      file_name: file, data, updated_at: new Date().toISOString()
    });
    if (error) { console.error('☁️ Supabase backup error (' + file + '):', error.message); return { local: true, cloud: false, error: error.message }; }
    return { local: true, cloud: true };
  } catch (err) { console.error('☁️ Supabase backup error (' + file + '):', err.message); return { local: true, cloud: false, error: err.message }; }
}

async function restoreFromSupabase() {
  if (!supabase) return;
  for (const file of TRACKED_FILES) {
    try {
      const { data, error } = await supabase.from(process.env.SUPABASE_KV_TABLE || 'kv_store').select('data').eq('file_name', file).maybeSingle();
      if (!error && data && data.data !== undefined) {
        fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data.data, null, 2));
        console.log('☁️ Imerudishwa kutoka Supabase: ' + file);
      }
    } catch (err) { console.error('☁️ Supabase restore error (' + file + '):', err.message); }
  }
}

function ensureTournamentSeed() {
  const current = readJson('tournaments.json', null);
  if (!Array.isArray(current)) {
    writeJson('tournaments.json', [
      { id: 't1', name: 'GameHub eFootball Cup', game: 'eFootball', date: 'Tarehe itawekwa', status: 'OPEN', description: 'Mashindano ya eFootball kwa community ya GameHub.', registrations: [] },
      { id: 't2', name: 'GameHub FC Challenge', game: 'EA SPORTS FC', date: 'Tarehe itawekwa', status: 'OPEN', description: 'Challenge ya football gaming.', registrations: [] }
    ]);
  }
}

// 💬 PUBLIC COMMUNITY CHAT
const publicChatRate = new Map();
function cleanPublicText(value, max) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/<[^>]*>/g, '').trim().slice(0, max);
}
function publicChatAllowed(ip) {
  const now = Date.now();
  const last = publicChatRate.get(ip) || 0;
  if (now - last < 3500) return false;
  publicChatRate.set(ip, now);
  return true;
}

app.get('/api/public-chat/messages', (req, res) => {
  const messages = readJson('public_chat.json', []);
  res.json({ success: true, messages: Array.isArray(messages) ? messages.slice(-100) : [] });
});

app.post('/api/public-chat/messages', async (req, res) => {
  const ip = getIP(req);
  if (!publicChatAllowed(ip)) return res.status(429).json({ error: 'Tafadhali subiri sekunde chache kabla ya kutuma ujumbe mwingine.' });
  const name = cleanPublicText(req.body?.name, 32) || 'Mgeni';
  const message = cleanPublicText(req.body?.message, 500);
  if (!message) return res.status(400).json({ error: 'Andika ujumbe kwanza.' });
  const messages = readJson('public_chat.json', []);
  const row = { id: 'chat_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'), name, message, time: new Date().toISOString() };
  messages.push(row);
  const kept = messages.slice(-300);
  await writeJson('public_chat.json', kept);
  res.json({ success: true, message: row });
});

app.delete('/api/admin/public-chat/:id', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const messages = readJson('public_chat.json', []);
  const filtered = messages.filter(x => x.id !== req.params.id);
  await writeJson('public_chat.json', filtered);
  res.json({ success: true });
});

// 🔐 PASSWORD SALAMA
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  return crypto.scryptSync(password, salt, 64).toString('hex') === hash;
}

// 🛑 ULINZI WA LOGIN
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const BLOCK_MINUTES = 10;
function isBlocked(key) {
  const entry = loginAttempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.time > BLOCK_MINUTES * 60000) { loginAttempts.delete(key); return false; }
  return entry.count >= MAX_ATTEMPTS;
}
function recordFail(key) {
  const entry = loginAttempts.get(key) || { count: 0, time: Date.now() };
  entry.count += 1; entry.time = Date.now();
  loginAttempts.set(key, entry);
}

// 🛡️ HACKERAI — SECURITY MODULE
const securityFile = 'security.json';
function logSecurity(type, details, severity, ip) {
  const data = readJson(securityFile, { events: [], blocked: {} });
  data.events.push({ time: new Date().toISOString(), type, details, severity, ip: ip || 'unknown' });
  if (data.events.length > 500) data.events = data.events.slice(-500);
  writeJson(securityFile, data);
}
function getIP(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}
function blockIP(ip, minutes) {
  const data = readJson(securityFile, { events: [], blocked: {} });
  data.blocked = data.blocked || {};
  data.blocked[ip] = Date.now() + minutes * 60000;
  writeJson(securityFile, data);
  logSecurity('IP_BLOCKED', 'IP imefungwa kwa dakika ' + minutes, 'HIGH', ip);
}

// ═══════════ 🛡️ IMPROVED isSuspicious — Ruhusu URLs ndefu ═══════════
// Ruhusu URLs za Google Drive, YouTube, n.k. — angalia SQL/XSS halisi pekee
function isSuspicious(input) {
  if (!input || typeof input !== 'string') return false;
  
  // Ruhusu URLs ndefu (hadi 2000 chars) — kwa Google Drive, YouTube, n.k.
  if (input.length > 2000) return true;
  
  // Angalia TU patterns za SQL injection na XSS halisi
  // (Ondoa ' | " | -- | ; kwa sababu URLs zina hizi)
  const patterns = /(union\s+select|insert\s+into|drop\s+table|delete\s+from|update\s+.*\s+set|<\s*script|javascript:|onerror\s*=|onload\s*=|<iframe|<embed|<object)/i;
  return patterns.test(input);
}

// ═══════════ 🛡️ IMPROVED /api middleware — Whitelist URL fields ═══════════
app.use('/api', (req, res, next) => {
  const ip = getIP(req);
  const data = readJson(securityFile, { events: [], blocked: {} });
  const blocked = data.blocked || {};
  if (blocked[ip] && blocked[ip] > Date.now()) {
    logSecurity('BLOCKED_REQUEST', 'IP iliyofungwa ilijaribu kuingia tena', 'MEDIUM', ip);
    return res.status(403).json({ error: 'IP yako imefungwa. Wasiliana na admin.' });
  }

  // ✅ Fields zinazoruhusiwa URLs ndefu (downloadLink, imageUrl, trailerUrl, n.k.)
  const URL_FIELDS = [
    'downloadLink', 'imageUrl', 'trailerUrl', 'videoUrl', 'streamUrl', 
    'poster', 'thumbnail', 'buttonUrl', 'url', 'image'
  ];

  const checkItems = [req.body, req.query];
  for (const obj of checkItems) {
    if (!obj) continue;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val !== 'string') continue;

      // Ruka URL fields kwenye kikomo cha urefu
      if (URL_FIELDS.includes(key)) {
        if (val.length > 2000) {
          logSecurity('URL_TOO_LONG', 'URL ndefu sana katika: "' + key + '"', 'MEDIUM', ip);
          return res.status(400).json({ error: 'URL ni ndefu sana.' });
        }
        continue; // Ruka SQL/XSS check kwa URL fields
      }

      // Angalia SQL/XSS kwa fields nyingine zote
      if (isSuspicious(val)) {
        logSecurity('SQLI_XSS', 'Input ya mashaka katika: "' + key + '"', 'HIGH', ip);
        blockIP(ip, 30);
        return res.status(400).json({ error: 'Input haikubaliki.' });
      }
    }
  }
  next();
});

// 👤 USERS + SESSIONS
const usersFile = 'users.json';
const sessionsFile = 'sessions.json';
function getUserByToken(req) {
  const token = req.headers.authorization || req.query.token;
  if (!token) return null;
  const sessions = readJson(sessionsFile, {});
  const email = sessions[token];
  if (!email) return null;
  const users = readJson(usersFile, {});
  return users[email] || null;
}

app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Jaza jina, email na password' });
  if (password.length < 4) return res.status(400).json({ error: 'Password iwe angalau herufi 4' });
  const users = readJson(usersFile, {});
  const cleanEmail = email.trim().toLowerCase();
  if (users[cleanEmail]) return res.status(400).json({ error: 'Email hii tayari iko. Ingia badala yake.' });
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gamehub.co.tz').toLowerCase();
  users[cleanEmail] = {
    name: name.trim(), email: cleanEmail, phone: phone || '',
    password: hashPassword(password), isAdmin: cleanEmail === adminEmail, isStaff: false,
    balance: 0, adminEarnings: 0, created: new Date().toISOString()
  };
  writeJson(usersFile, users);
  const token = crypto.randomBytes(24).toString('hex');
  const sessions = readJson(sessionsFile, {});
  sessions[token] = cleanEmail;
  writeJson(sessionsFile, sessions);
  res.json({ success: true, token, user: { name: name.trim(), email: cleanEmail, isAdmin: users[cleanEmail].isAdmin, isStaff: false } });
});

app.get('/api/auth/social/config', (req, res) => {
  res.json({ success: true, enabled: !!(SUPABASE_URL && SUPABASE_ANON_KEY), url: SUPABASE_URL || '', anonKey: SUPABASE_ANON_KEY || '' });
});

app.post('/api/auth/social/complete', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Social login haijawekwa. Weka SUPABASE_URL na SUPABASE_SERVICE_ROLE_KEY.' });
    const accessToken = String(req.body.accessToken || '').trim();
    const provider = String(req.body.provider || '').trim().toLowerCase();
    if (!accessToken || !['google','facebook','apple'].includes(provider)) return res.status(400).json({ error: 'Provider au access token si sahihi.' });
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user?.email) return res.status(401).json({ error: 'Social account haikuthibitishwa.' });
    const authUser = data.user;
    const email = String(authUser.email).trim().toLowerCase();
    const meta = authUser.user_metadata || {};
    const displayName = String(meta.full_name || meta.name || [meta.first_name, meta.last_name].filter(Boolean).join(' ') || email.split('@')[0]).trim();
    const users = readJson(usersFile, {});
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gamehub.co.tz').toLowerCase();
    if (!users[email]) {
      users[email] = { name: displayName || 'LIFEISGAMETZ User', email, phone: '', password: null, authProvider: provider, providerId: authUser.id, isAdmin: email === adminEmail, isStaff: false, balance: 0, adminEarnings: 0, created: new Date().toISOString() };
      writeJson(usersFile, users);
    } else {
      users[email].authProvider = users[email].authProvider || provider;
      users[email].providerId = users[email].providerId || authUser.id;
      if (!users[email].name || users[email].name === email.split('@')[0]) users[email].name = displayName;
      writeJson(usersFile, users);
    }
    const token = crypto.randomBytes(24).toString('hex');
    const sessions = readJson(sessionsFile, {});
    sessions[token] = email;
    writeJson(sessionsFile, sessions);
    const user = users[email];
    res.json({ success:true, token, user:{ name:user.name, email:user.email, isAdmin:!!user.isAdmin, isStaff:!!user.isStaff, provider } });
  } catch (e) { console.error('Social login:', e); res.status(500).json({ error: 'Social login imeshindikana.' }); }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const ip = getIP(req);
  if (!cleanEmail || !password) return res.status(400).json({ error: 'Jaza email na password' });
  if (isBlocked(cleanEmail) || isBlocked(ip)) return res.status(429).json({ error: 'Jaribio nyingi. Subiri dakika ' + BLOCK_MINUTES + '.' });
  const users = readJson(usersFile, {});
  const user = users[cleanEmail];
  if (!user || !user.password || !verifyPassword(password, user.password)) {
    recordFail(cleanEmail); recordFail(ip);
    if ((loginAttempts.get(ip) || {}).count >= MAX_ATTEMPTS) { blockIP(ip, 60); logSecurity('BRUTE_FORCE', 'Majaribio mengi ya kuingia kutoka IP ' + ip, 'HIGH', ip); }
    return res.status(401).json({ error: 'Email au password si sahihi' });
  }
  loginAttempts.delete(cleanEmail);
  const token = crypto.randomBytes(24).toString('hex');
  const sessions = readJson(sessionsFile, {});
  sessions[token] = cleanEmail;
  writeJson(sessionsFile, sessions);
  res.json({ success: true, token, user: { name: user.name, email: user.email, isAdmin: user.isAdmin, isStaff: !!user.isStaff } });
});

app.get('/api/auth/me', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Huna token au token si sahihi' });
  res.json({ success: true, user: { name: user.name, email: user.email, phone: user.phone || '', created: user.created || null, balance: user.balance || 0, adminEarnings: user.adminEarnings || 0, isAdmin: !!user.isAdmin, isStaff: !!user.isStaff } });
});

app.put('/api/auth/profile', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Tafadhali ingia kwanza.' });
  const users = readJson(usersFile, {});
  const email = String(user.email || '').trim().toLowerCase();
  const current = users[email];
  if (!current) return res.status(404).json({ error: 'Akaunti haikupatikana.' });
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  if (name.length < 2) return res.status(400).json({ error: 'Jina liwe na angalau herufi 2.' });
  if (name.length > 80) return res.status(400).json({ error: 'Jina ni refu sana.' });
  if (phone.length > 30) return res.status(400).json({ error: 'Namba ya simu si sahihi.' });
  current.name = name; current.phone = phone;
  users[email] = current;
  writeJson(usersFile, users);
  res.json({ success: true, user: { name: current.name, email: current.email, phone: current.phone || '', balance: current.balance || 0, isAdmin: !!current.isAdmin, isStaff: !!current.isStaff } });
});

app.post('/api/auth/change-password', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Tafadhali ingia kwanza.' });
  const oldPassword = String(req.body?.oldPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  const confirmPassword = String(req.body?.confirmPassword || '');
  if (!oldPassword || !newPassword || !confirmPassword) return res.status(400).json({ error: 'Jaza password zote.' });
  if (!user.password || !verifyPassword(oldPassword, user.password)) return res.status(400).json({ error: 'Password ya sasa si sahihi.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password mpya iwe na angalau herufi 6.' });
  if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Password mpya hazifanani.' });
  if (newPassword === oldPassword) return res.status(400).json({ error: 'Tumia password mpya tofauti na ya zamani.' });
  const users = readJson(usersFile, {});
  const email = String(user.email || '').trim().toLowerCase();
  if (!users[email]) return res.status(404).json({ error: 'Akaunti haikupatikana.' });
  users[email].password = hashPassword(newPassword);
  writeJson(usersFile, users);
  res.json({ success: true, message: 'Password imebadilishwa kikamilifu.' });
});

app.post('/api/admin/users/staff', (req, res) => {
  const admin = getUserByToken(req);
  if (!admin || !admin.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { email, makeStaff } = req.body;
  const users = readJson(usersFile, {});
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!users[cleanEmail]) return res.status(404).json({ error: 'Mtumiaji hajapatikana' });
  if (users[cleanEmail].isAdmin) return res.status(400).json({ error: 'Huyu tayari ni Admin kamili' });
  users[cleanEmail].isStaff = !!makeStaff;
  writeJson(usersFile, users);
  res.json({ success: true, message: makeStaff ? '✅ ' + cleanEmail + ' sasa ni Staff.' : '✅ ' + cleanEmail + ' si Staff tena.' });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization;
  if (token) { const sessions = readJson(sessionsFile, {}); delete sessions[token]; writeJson(sessionsFile, sessions); }
  res.json({ success: true });
});

app.get('/api/auth/promote', (req, res) => {
  const { email, key } = req.query;
  if (!process.env.ADMIN_SETUP_KEY || key !== process.env.ADMIN_SETUP_KEY) return res.status(403).json({ error: 'Ufunguo si sahihi' });
  const users = readJson(usersFile, {});
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!users[cleanEmail]) return res.status(404).json({ error: 'Mtumiaji huyo hajapatikana. Jisajili kwanza kwenye tovuti.' });
  users[cleanEmail].isAdmin = true;
  writeJson(usersFile, users);
  res.json({ success: true, message: '✅ ' + cleanEmail + ' sasa ni Admin. Toka (logout) na uingie tena ili ibadilike.' });
});

// 🏆 KUKAMILISHA MECHI
async function completeMatchAndPayout(matchId, winnerUserId) {
  const matches = readJson('matches.json', []);
  const match = matches.find(m => m.id === matchId);
  if (!match || match.status === 'completed') return { success: false, error: 'Mechi haipatikani au imeshakamilika' };
  const totalPool = (match.entryFee || 0) * 2;
  const platformFee = totalPool * 0.10;
  const winnerPrize = totalPool - platformFee;
  match.status = 'completed'; match.winnerId = winnerUserId; match.platformCommission = platformFee; match.winnerPayout = winnerPrize;
  const users = readJson(usersFile, {});
  let winnerKey = Object.keys(users).find(k => k === winnerUserId || users[k].email === winnerUserId);
  if (winnerKey) users[winnerKey].balance = (users[winnerKey].balance || 0) + winnerPrize;
  let adminKey = Object.keys(users).find(k => users[k].isAdmin === true);
  if (adminKey) users[adminKey].adminEarnings = (users[adminKey].adminEarnings || 0) + platformFee;
  writeJson('matches.json', matches);
  writeJson(usersFile, users);
  return { success: true, winnerPrize, platformFee };
}

app.get('/api/matches', (req, res) => {
  const matches = readJson('matches.json', []);
  res.json({ success: true, matches });
});

app.post('/api/matches', (req, res) => {
  const user = getUserByToken(req);
  if (!user || (!user.isAdmin && !user.isStaff)) return res.status(403).json({ error: 'Huna ruhusa' });
  const { title, entryFee, player1Id, player2Id } = req.body;
  if (!title || entryFee === undefined) return res.status(400).json({ error: 'Jaza kichwa cha habari na kiingilio' });
  const matches = readJson('matches.json', []);
  const match = { id: 'm_' + Date.now(), title: title.trim(), entryFee: Number(entryFee), player1Id: player1Id || '', player2Id: player2Id || '', status: 'pending', winnerId: null, platformCommission: 0, winnerPayout: 0, date: new Date().toISOString() };
  matches.push(match);
  writeJson('matches.json', matches);
  res.json({ success: true, match });
});

app.post('/api/matches/:id/complete', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || (!user.isAdmin && !user.isStaff)) return res.status(403).json({ error: 'Huna ruhusa' });
  const { winnerUserId } = req.body;
  if (!winnerUserId) return res.status(400).json({ error: 'Weka ID au Email ya mshindi' });
  const result = await completeMatchAndPayout(req.params.id, winnerUserId);
  if (!result.success) return res.status(400).json({ error: result.error || 'Imeshindikana kukamilisha mechi' });
  res.json({ success: true, message: '✅ Mechi imekamilishwa na zawadi zimetolewa!', ...result });
});

// 🎮 BIDHAA (PRODUCTS)
app.get('/api/products', (req, res) => {
  const products = readJson('products.json', {});
  res.json({ success: true, products: Object.values(products) });
});

app.post('/api/products', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || (!user.isAdmin && !user.isStaff)) return res.status(403).json({ error: 'Huna ruhusa' });
  const { name, type, price, emoji, desc, downloadLink, imageUrl, trailerUrl, category, section, accountUser, accountPassword } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Jaza jina na bei' });
  const products = readJson('products.json', {});
  const id = 'p' + Date.now();
  products[id] = { id, name, type: type || 'Bidhaa', price: Number(price), emoji: emoji || '🎮', desc: desc || '', downloadLink: downloadLink || '', imageUrl: imageUrl || '', trailerUrl: trailerUrl || '', category: category || 'Zote', section: section || 'shop', accountUser: accountUser || '', accountPassword: accountPassword || '' };
  const saved = await writeJson('products.json', products);
  res.json({ success: true, id, persistent: saved.cloud !== false });
});

app.put('/api/products/:id', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || (!user.isAdmin && !user.isStaff)) return res.status(403).json({ error: 'Huna ruhusa' });
  const products = readJson('products.json', {});
  const existing = products[req.params.id];
  if (!existing) return res.status(404).json({ error: 'Bidhaa haipatikani' });
  const { name, type, price, emoji, desc, downloadLink, imageUrl, trailerUrl, category, section, accountUser, accountPassword } = req.body;
  products[req.params.id] = { ...existing, name: name || existing.name, type: type || existing.type, price: price ? Number(price) : existing.price, emoji: emoji || existing.emoji, desc: desc !== undefined ? desc : existing.desc, downloadLink: downloadLink !== undefined ? downloadLink : existing.downloadLink, imageUrl: imageUrl !== undefined ? imageUrl : existing.imageUrl, trailerUrl: trailerUrl !== undefined ? trailerUrl : existing.trailerUrl, category: category || existing.category || 'Zote', section: section || existing.section || 'shop', accountUser: accountUser !== undefined ? accountUser : existing.accountUser, accountPassword: accountPassword !== undefined ? accountPassword : existing.accountPassword };
  const saved = await writeJson('products.json', products);
  res.json({ success: true, product: products[req.params.id], persistent: saved.cloud !== false });
});

app.delete('/api/products/:id', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const products = readJson('products.json', {});
  delete products[req.params.id];
  writeJson('products.json', products);
  res.json({ success: true });
});

// 📊 ANALYTICS
app.get('/api/admin/analytics', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const orders = readJson('orders.json', []).filter(o => o.status === 'successful');
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, label: d.toLocaleDateString('sw', { day: '2-digit', month: '2-digit' }), total: 0, count: 0 });
  }
  orders.forEach(o => { const key = (o.confirmedAt || o.date || '').slice(0, 10); const day = days.find(d => d.date === key); if (day) { day.total += (o.amount || 0); day.count += 1; } });
  const productSales = {};
  orders.forEach(o => (o.items || []).forEach(i => { const qty = Number(i.quantity || i.qty || 1); productSales[i.name] = (productSales[i.name] || 0) + qty; }));
  const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));
  res.json({ success: true, days, topProducts });
});

app.get('/api/admin/backup', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const backup = { generatedAt: new Date().toISOString(), users: readJson(usersFile, {}), products: readJson('products.json', {}), orders: readJson('orders.json', []), requests: readJson('requests.json', []), matches: readJson('matches.json', []), security: readJson(securityFile, { events: [], blocked: {} }) };
  res.setHeader('Content-Disposition', 'attachment; filename="gamehub-backup-' + Date.now() + '.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(backup, null, 2));
});

// 🏪 MARKETPLACE
app.get('/api/marketplace', (req, res) => {
  const listings = readJson('marketplace.json', []);
  res.json({ success: true, listings });
});

app.post('/api/marketplace', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { businessName, description, contact, imageUrl, category } = req.body;
  if (!businessName || !contact) return res.status(400).json({ error: 'Jaza jina la biashara na mawasiliano' });
  const listings = readJson('marketplace.json', []);
  const listing = { id: 'm' + Date.now(), businessName, description: description || '', contact, imageUrl: imageUrl || '', category: category || 'Nyingine', date: new Date().toISOString() };
  listings.push(listing);
  writeJson('marketplace.json', listings);
  res.json({ success: true, id: listing.id });
});

app.delete('/api/marketplace/:id', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const listings = readJson('marketplace.json', []);
  writeJson('marketplace.json', listings.filter(l => l.id !== req.params.id));
  res.json({ success: true });
});

// 🎟️ DISCOUNT CODES
app.get('/api/admin/coupons', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  res.json({ success: true, coupons: readJson('coupons.json', {}) });
});

app.post('/api/admin/coupons', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { code, percentOff, maxUses } = req.body;
  if (!code || !percentOff) return res.status(400).json({ error: 'Jaza kodi na asilimia ya punguzo' });
  const coupons = readJson('coupons.json', {});
  const cleanCode = code.trim().toUpperCase();
  coupons[cleanCode] = { code: cleanCode, percentOff: Number(percentOff), maxUses: maxUses ? Number(maxUses) : null, uses: 0, active: true };
  writeJson('coupons.json', coupons);
  res.json({ success: true });
});

app.delete('/api/admin/coupons/:code', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const coupons = readJson('coupons.json', {});
  delete coupons[req.params.code.toUpperCase()];
  writeJson('coupons.json', coupons);
  res.json({ success: true });
});

app.post('/api/coupons/check', (req, res) => {
  const { code } = req.body;
  const coupons = readJson('coupons.json', {});
  const key = (code || '').trim().toUpperCase();
  const c = coupons[key];
  if (!c || !c.active) return res.status(404).json({ error: 'Kodi si sahihi au imeisha muda' });
  if (c.maxUses && c.uses >= c.maxUses) return res.status(400).json({ error: 'Kodi hii imeisha kutumika' });
  c.uses += 1;
  writeJson('coupons.json', coupons);
  res.json({ success: true, percentOff: c.percentOff, code: c.code });
});

// ⭐ MAONI NA RATING
app.get('/api/reviews/:productId', (req, res) => {
  const reviews = readJson('reviews.json', {});
  const list = reviews[req.params.productId] || [];
  const avg = list.length ? (list.reduce((t, r) => t + r.rating, 0) / list.length) : 0;
  res.json({ success: true, reviews: list.slice().reverse(), average: Math.round(avg * 10) / 10, count: list.length });
});

app.post('/api/reviews/:productId', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza kuacha maoni' });
  const { rating, comment } = req.body;
  const r = Number(rating);
  if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'Chagua rating ya nyota 1-5' });
  const reviews = readJson('reviews.json', {});
  if (!reviews[req.params.productId]) reviews[req.params.productId] = [];
  const already = reviews[req.params.productId].find(x => x.email === user.email);
  if (already) return res.json({ success: false, message: 'Umeshaacha maoni kwenye bidhaa hii.' });
  reviews[req.params.productId].push({ name: user.name, email: user.email, rating: r, comment: (comment || '').trim(), date: new Date().toISOString() });
  writeJson('reviews.json', reviews);
  res.json({ success: true, message: '✅ Asante kwa maoni yako!' });
});

// 📌 GAME REQUESTS
app.get('/api/requests', (req, res) => {
  const requests = readJson('requests.json', []);
  res.json({ success: true, requests: requests.slice().sort((a, b) => b.votes - a.votes) });
});

app.post('/api/requests', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza kuomba game' });
  const { gameName } = req.body;
  if (!gameName || !gameName.trim()) return res.status(400).json({ error: 'Andika jina la game' });
  const requests = readJson('requests.json', []);
  const name = gameName.trim();
  const existing = requests.find(r => r.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (!existing.voters.includes(user.email)) { existing.voters.push(user.email); existing.votes += 1; writeJson('requests.json', requests); return res.json({ success: true, message: 'Game hii tayari iko. Tumeongeza kura yako!' }); }
    return res.json({ success: true, message: 'Game hii tayari iko na umeshaipigia kura.' });
  }
  const newReq = { id: 'r' + Date.now(), name, voters: [user.email], votes: 1, date: new Date().toISOString() };
  requests.push(newReq);
  writeJson('requests.json', requests);
  res.json({ success: true, message: '✅ Game yako imeongezwa! Wengine wanaweza kuipigia kura.' });
});

app.post('/api/requests/:id/vote', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza kupiga kura' });
  const requests = readJson('requests.json', []);
  const item = requests.find(r => r.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Game haipatikani' });
  if (item.voters.includes(user.email)) return res.json({ success: false, message: 'Umeshapiga kura kwenye game hii' });
  item.voters.push(user.email); item.votes += 1;
  writeJson('requests.json', requests);
  res.json({ success: true, message: '✅ Kura yako imeongezwa!' });
});

app.delete('/api/requests/:id', (req, res) => {
  const user = getUserByToken(req);
  if (!user || (!user.isAdmin && !user.isStaff)) return res.status(403).json({ error: 'Huna ruhusa' });
  const requests = readJson('requests.json', []);
  writeJson('requests.json', requests.filter(r => r.id !== req.params.id));
  res.json({ success: true });
});

// 🧾 MAUZO & STATS (ADMIN)
app.get('/api/admin/orders', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const orders = readJson('orders.json', []);
  res.json({ success: true, orders: orders.slice().reverse() });
});

app.get('/api/admin/overview', (req,res)=>{
  const user=getUserByToken(req); if(!user||!user.isAdmin) return res.status(403).json({error:'Wewe si admin'});
  const orders=readJson('orders.json',[]); const products=Object.values(readJson('products.json',{})); const users=Object.values(readJson(usersFile,{}));
  const paid=orders.filter(o=>o.status==='successful');
  const pending=orders.filter(o=>String(o.status||'').startsWith('pending'));
  const revenue=paid.reduce((n,o)=>n+Number(o.amount||0),0);
  const byMethod={}; paid.forEach(o=>{const k=o.provider||'Other';byMethod[k]=(byMethod[k]||0)+Number(o.amount||0)});
  const top={}; paid.forEach(o=>(o.items||[]).forEach(i=>{const k=i.name||'Bidhaa';top[k]=(top[k]||0)+(Number(i.quantity||i.qty)||1)}));
  res.json({success:true,revenue,paidOrders:paid.length,pendingOrders:pending.length,customers:users.filter(u=>!u.isAdmin).length,products:products.length,byMethod,topProducts:Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,8),recent:orders.slice().reverse().slice(0,20)});
});

app.get('/api/admin/users', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const users = readJson(usersFile, {});
  res.json({ success: true, users: Object.values(users) });
});

app.get('/api/admin/storage-status', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const table = process.env.SUPABASE_KV_TABLE || 'kv_store';
  if (!supabase) return res.json({success:true,persistent:false,provider:'Local .data only',warning:'Weka SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL na SUPABASE_SERVICE_ROLE_KEY kwenye Render ili data isifutike baada ya restart/deploy.',kvTable:table});
  try {
    const { error } = await supabase.from(table).select('file_name').limit(1);
    if (error) return res.json({success:true,persistent:false,provider:'Supabase configured but KV unavailable',warning:'Supabase imeunganishwa lakini table '+table+' haipatikani au RLS/permissions zimezuia server.',kvTable:table});
    res.json({success:true,persistent:true,provider:'Supabase KV + local cache',warning:null,kvTable:table});
  } catch(e) { res.json({success:true,persistent:false,provider:'Supabase error',warning:e.message,kvTable:table}); }
});

app.get('/api/admin/stats', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const orders = readJson('orders.json', []);
  const users = readJson(usersFile, {});
  const total = orders.reduce((t, o) => t + (o.amount || 0), 0);
  res.json({ success: true, stats: { orders: orders.length, total, customers: Object.keys(users).length, products: Object.keys(readJson('products.json', {})).length } });
});

// 🛡️ SECURITY ADMIN ENDPOINTS
app.get('/api/security/events', (req, res) => {
  const user = getUserByToken(req);
  if (!
