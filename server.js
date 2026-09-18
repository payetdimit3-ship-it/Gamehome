require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('.'));

// 🎬 MEDIA STORAGE — Supabase Storage (production) au local uploads (fallback)
const MEDIA_DIR = path.join(__dirname, 'uploads');
const TMP_MEDIA_DIR = path.join(MEDIA_DIR, 'tmp');

try {
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
  if (!fs.existsSync(TMP_MEDIA_DIR)) fs.mkdirSync(TMP_MEDIA_DIR, { recursive: true });
} catch (err) {
  console.error('⚠️ Directory creation error:', err.message);
}

app.use('/uploads', express.static(MEDIA_DIR));

const upload = multer({
  dest: TMP_MEDIA_DIR,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB limit
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

// ☁️ SUPABASE CLIENT INITIALIZATION
let supabase = null;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log('☁️ Supabase imeunganishwa — data itahifadhiwa kudumu.');
  } catch (e) {
    console.error('⚠️ Supabase connection failed:', e.message);
  }
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
  
  // Prevent path traversal in folder name
  const safeFolder = String(folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '');
  const objectPath = safeFolder + '/' + filename;
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
        throw new Error('Supabase Storage imekataa upload: ' + error.message + '. Hakikisha bucket ' + MEDIA_BUCKET + ' ipo.');
      } catch (e) {
        if (e.message && e.message.startsWith('Supabase Storage imekataa')) throw e;
        throw new Error('Supabase Storage error: ' + e.message);
      }
    }
    const targetDir = path.join(MEDIA_DIR, safeFolder);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    const target = path.join(targetDir, filename);
    fs.renameSync(localPath, target);
    return { url: '/uploads/' + safeFolder + '/' + filename, storage: 'local', path: target, filename };
  } finally {
    try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch (e) {}
  }
}

// 📁 HIFADHI YA DATA (.data folder)
const DATA_DIR = path.join(__dirname, '.data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const TRACKED_FILES = [
  'users.json', 'sessions.json', 'products.json',
  'orders.json', 'requests.json', 'security.json',
  'marketplace.json', 'coupons.json', 'reviews.json', 'matches.json',
  'tournaments.json', 'live_streams.json', 'courses.json', 'movies.json',
  'media.json', 'ai_builder_runs.json', 'banners.json', 'settings.json', 'public_chat.json'
];

function sanitizeFilename(file) {
  const base = path.basename(file);
  return TRACKED_FILES.includes(base) ? base : null;
}

function readJson(file, fallback) {
  const safeFile = sanitizeFilename(file);
  if (!safeFile) return fallback;
  try { 
    const filePath = path.join(DATA_DIR, safeFile);
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')); 
  } catch (e) { 
    return fallback; 
  }
}

async function writeJson(file, data) {
  const safeFile = sanitizeFilename(file);
  if (!safeFile) return { local: false, cloud: false, error: 'Invalid filename' };
  try {
    fs.writeFileSync(path.join(DATA_DIR, safeFile), JSON.stringify(data, null, 2));
    if (!supabase) return { local: true, cloud: false };
    const { error } = await supabase.from(process.env.SUPABASE_KV_TABLE || 'kv_store').upsert({
      file_name: safeFile,
      data,
      updated_at: new Date().toISOString()
    });
    if (error) {
      console.error('☁️ Supabase backup error (' + safeFile + '):', error.message);
      return { local: true, cloud: false, error: error.message };
    }
    return { local: true, cloud: true };
  } catch (err) {
    console.error('☁️ Save error (' + safeFile + '):', err.message);
    return { local: true, cloud: false, error: err.message };
  }
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
    } catch (err) {
      console.error('☁️ Supabase restore error (' + file + '):', err.message);
    }
  }
}

function ensureTournamentSeed() {
  const current = readJson('tournaments.json', null);
  if (!Array.isArray(current)) {
    writeJson('tournaments.json', [
      { id: 't1', name: 'GameHub eFootball Cup', game: 'eFootball', date: 'Tarehe itawekwa', status: 'OPEN', description: 'Mashindano ya eFootball kwa community ya GameHub.', registrations: [] },
      { id: 't2', name: 'GameHub FC Challenge', game: 'EA SPORTS FC', date: 'Tarehe itawekwa', status: 'OPEN', description: 'Challenge ya football gaming. Fuata matangazo ya GameHub.', registrations: [] }
    ]);
  }
}

// 🔐 PASSWORD HASHING
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    return crypto.scryptSync(password, salt, 64).toString('hex') === hash;
  } catch (e) {
    return false;
  }
}

// 🛑 RATE LIMITING & SECURITY
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
  entry.count += 1; 
  entry.time = Date.now();
  loginAttempts.set(key, entry);
}

const securityFile = 'security.json';

function logSecurity(type, details, severity, ip) {
  const data = readJson(securityFile, { events: [], blocked: {} });
  data.events.push({ time: new Date().toISOString(), type, details, severity, ip: ip || 'unknown' });
  if (data.events.length > 500) data.events = data.events.slice(-500);
  writeJson(securityFile, data);
}

function getIP(req) {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function blockIP(ip, minutes) {
  const data = readJson(securityFile, { events: [], blocked: {} });
  data.blocked = data.blocked || {};
  data.blocked[ip] = Date.now() + (minutes || 60) * 60000;
  writeJson(securityFile, data);
  logSecurity('IP_BLOCKED', 'IP imefungwa kwa dakika ' + minutes, 'HIGH', ip);
}

function isSuspicious(input) {
  if (!input || typeof input !== 'string') return false;
  const patterns = /('|"|--|;|;|\/\*|\*\/|union\s+select|select\s+.*\s+from|insert\s+into|drop\s+table|<\s*script|onerror\s*=|javascript:)/i;
  return patterns.test(input);
}

// Security Middleware
app.use('/api', (req, res, next) => {
  const ip = getIP(req);
  const data = readJson(securityFile, { events: [], blocked: {} });
  const blocked = data.blocked || {};

  if (blocked[ip] && blocked[ip] > Date.now()) {
    logSecurity('BLOCKED_REQUEST', 'IP iliyofungwa ilijaribu kuingia tena', 'MEDIUM', ip);
    return res.status(403).json({ error: 'IP yako imefungwa. Wasiliana na admin.' });
  }

  const checkItems = [req.body, req.query];
  for (const obj of checkItems) {
    if (!obj || typeof obj !== 'object') continue;
    for (const key of Object.keys(obj)) {
      if (['password', 'accountPassword'].includes(key)) continue; // Skip raw passwords
      const val = obj[key];
      if (typeof val === 'string' && isSuspicious(val)) {
        logSecurity('SQLI_XSS', 'Input ya mashaka katika: "' + key + '"', 'HIGH', ip);
        blockIP(ip, 30);
        return res.status(400).json({ error: 'Input haikubaliki.' });
      }
    }
  }
  next();
});

// 👤 AUTHENTICATION HELPERS
const usersFile = 'users.json';
const sessionsFile = 'sessions.json';

function getUserByToken(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.token;
  if (!token) return null;
  const sessions = readJson(sessionsFile, {});
  const email = sessions[token];
  if (!email) return null;
  const users = readJson(usersFile, {});
  return users[email] || null;
}

// 🌐 ROUTING & API ENDPOINTS

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 💬 PUBLIC COMMUNITY CHAT
const publicChatRate = new Map();
function cleanPublicText(value, max) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/<[^>]*>/g, '').trim().slice(0, max);
}

function publicChatAllowed(ip) {
  const now = Date.now();
  const last = publicChatRate.get(ip) || 0;
  if (now - last < 3000) return false;
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

// 🔑 AUTHENTICATION ENDPOINTS
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Jaza jina, email na password' });
  if (password.length < 4) return res.status(400).json({ error: 'Password iwe angalau herufi 4' });
  
  const users = readJson(usersFile, {});
  const cleanEmail = email.trim().toLowerCase();
  if (users[cleanEmail]) return res.status(400).json({ error: 'Email hii tayari ipo. Ingia badala yake.' });

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gamehub.co.tz').toLowerCase();
  users[cleanEmail] = {
    name: name.trim(), email: cleanEmail, phone: phone || '',
    password: hashPassword(password), isAdmin: cleanEmail === adminEmail, isStaff: false,
    balance: 0, adminEarnings: 0,
    created: new Date().toISOString()
  };
  writeJson(usersFile, users);

  const token = crypto.randomBytes(24).toString('hex');
  const sessions = readJson(sessionsFile, {});
  sessions[token] = cleanEmail;
  writeJson(sessionsFile, sessions);

  res.json({ success: true, token, user: { name: name.trim(), email: cleanEmail, isAdmin: users[cleanEmail].isAdmin, isStaff: false } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const ip = getIP(req);

  if (!cleanEmail || !password) return res.status(400).json({ error: 'Jaza email na password' });
  if (isBlocked(cleanEmail) || isBlocked(ip)) return res.status(429).json({ error: 'Jaribio nyingi. Subiri dakika ' + BLOCK_MINUTES + '.' });

  const users = readJson(usersFile, {});
  const user = users[cleanEmail];
  if (!user || !verifyPassword(password, user.password)) {
    recordFail(cleanEmail);
    recordFail(ip);
    if ((loginAttempts.get(ip) || {}).count >= MAX_ATTEMPTS) {
      blockIP(ip, 60);
      logSecurity('BRUTE_FORCE', 'Majaribio mengi ya kuingia kutoka IP ' + ip, 'HIGH', ip);
    }
    return res.status(401).json({ error: 'Email au password si sahihi' });
  }

  loginAttempts.delete(cleanEmail);
  const token = crypto.randomBytes(24).toString('hex');
  const sessions = readJson(sessionsFile, {});
  sessions[token] = cleanEmail;
  writeJson(sessionsFile, sessions);

  res.json({ success: true, token, user: { name: user.name, email: user.email, isAdmin: !!user.isAdmin, isStaff: !!user.isStaff } });
});

app.get('/api/auth/me', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Huna token au token si sahihi' });
  res.json({ success: true, user: { name: user.name, email: user.email, balance: user.balance || 0, adminEarnings: user.adminEarnings || 0, isAdmin: !!user.isAdmin, isStaff: !!user.isStaff } });
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
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.token;
  if (token) { const sessions = readJson(sessionsFile, {}); delete sessions[token]; writeJson(sessionsFile, sessions); }
  res.json({ success: true });
});

app.get('/api/auth/promote', (req, res) => {
  const { email, key } = req.query;
  if (!process.env.ADMIN_SETUP_KEY || key !== process.env.ADMIN_SETUP_KEY) {
    return res.status(403).json({ error: 'Ufunguo si sahihi' });
  }
  const users = readJson(usersFile, {});
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!users[cleanEmail]) return res.status(404).json({ error: 'Mtumiaji huyo hajapatikana.' });
  users[cleanEmail].isAdmin = true;
  writeJson(usersFile, users);
  res.json({ success: true, message: '✅ ' + cleanEmail + ' sasa ni Admin. Toka na uingie tena.' });
});

// 🏆 MATCHES & PAYOUTS
async function completeMatchAndPayout(matchId, winnerUserId) {
  const matches = readJson('matches.json', []);
  const match = matches.find(m => m.id === matchId);

  if (!match || match.status === 'completed') return { success: false, error: 'Mechi haipatikani au imeshakamilika' };

  const totalPool = (match.entryFee || 0) * 2;
  const platformFee = totalPool * 0.10;
  const winnerPrize = totalPool - platformFee;

  match.status = 'completed';
  match.winnerId = winnerUserId;
  match.platformCommission = platformFee;
  match.winnerPayout = winnerPrize;

  const users = readJson(usersFile, {});
  let winnerKey = Object.keys(users).find(k => k === winnerUserId || users[k].email === winnerUserId);
  if (winnerKey) {
    users[winnerKey].balance = (users[winnerKey].balance || 0) + winnerPrize;
  }

  let adminKey = Object.keys(users).find(k => users[k].isAdmin === true);
  if (adminKey) {
    users[adminKey].adminEarnings = (users[adminKey].adminEarnings || 0) + platformFee;
  }

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
  const match = {
    id: 'm_' + Date.now(),
    title: title.trim(),
    entryFee: Number(entryFee),
    player1Id: player1Id || '',
    player2Id: player2Id || '',
    status: 'pending',
    winnerId: null,
    platformCommission: 0,
    winnerPayout: 0,
    date: new Date().toISOString()
  };
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

// 🎮 PRODUCTS MANAGEMENT
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
  products[id] = {
    id, name, type: type || 'Bidhaa', price: Number(price), emoji: emoji || '🎮', desc: desc || '',
    downloadLink: downloadLink || '', imageUrl: imageUrl || '', trailerUrl: trailerUrl || '',
    category: category || 'Zote', section: section || 'shop',
    accountUser: accountUser || '', accountPassword: accountPassword || ''
  };
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
  products[req.params.id] = {
    ...existing,
    name: name || existing.name,
    type: type || existing.type,
    price: price ? Number(price) : existing.price,
    emoji: emoji || existing.emoji,
    desc: desc !== undefined ? desc : existing.desc,
    downloadLink: downloadLink !== undefined ? downloadLink : existing.downloadLink,
    imageUrl: imageUrl !== undefined ? imageUrl : existing.imageUrl,
    trailerUrl: trailerUrl !== undefined ? trailerUrl : existing.trailerUrl,
    category: category || existing.category || 'Zote',
    section: section || existing.section || 'shop',
    accountUser: accountUser !== undefined ? accountUser : existing.accountUser,
    accountPassword: accountPassword !== undefined ? accountPassword : existing.accountPassword
  };
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

// 📊 ADMIN DASHBOARD & ANALYTICS
app.get('/api/admin/analytics', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const orders = readJson('orders.json', []).filter(o => o.status === 'successful');

  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, label: d.toLocaleDateString('sw', { day: '2-digit', month: '2-digit' }), total: 0, count: 0 });
  }
  orders.forEach(o => {
    const key = (o.confirmedAt || o.date || '').slice(0, 10);
    const day = days.find(d => d.date === key);
    if (day) { day.total += (o.amount || 0); day.count += 1; }
  });

  const productSales = {};
  orders.forEach(o => (o.items || []).forEach(i => {
    productSales[i.name] = (productSales[i.name] || 0) + (i.qty || i.quantity || 1);
  }));
  const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  res.json({ success: true, days, topProducts });
});

app.get('/api/admin/backup', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const backup = {
    generatedAt: new Date().toISOString(),
    users: readJson(usersFile, {}),
    products: readJson('products.json', {}),
    orders: readJson('orders.json', []),
    requests: readJson('requests.json', []),
    matches: readJson('matches.json', []),
    security: readJson(securityFile, { events: [], blocked: {} })
  };
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
  const listing = {
    id: 'm' + Date.now(), businessName, description: description || '', contact,
    imageUrl: imageUrl || '', category: category || 'Nyingine', date: new Date().toISOString()
  };
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

// 🎟️ COUPONS
app.get('/api/admin/coupons', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  res.json({ success: true, coupons: readJson('coupons.json', {}) });
});

app.post('/api/admin/coupons', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { code, percentOff, maxUses } = req.body;
  if (!code || !percentOff) return res.status(400).json({ error: 'Jaza kodi na asilimia' });
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

// ⭐ REVIEWS & RATINGS
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
  reviews[req.params.productId].push({
    name: user.name, email: user.email, rating: r, comment: (comment || '').trim(), date: new Date().toISOString()
  });
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
    if (!existing.voters.includes(user.email)) {
      existing.voters.push(user.email);
      existing.votes += 1;
      writeJson('requests.json', requests);
      return res.json({ success: true, message: 'Game hii ipo tayari. Tumeongeza kura yako!' });
    }
    return res.json({ success: true, message: 'Umeshaipigia kura game hii.' });
  }

  const newReq = {
    id: 'r' + Date.now(),
    name: name,
    voters: [user.email],
    votes: 1,
    date: new Date().toISOString()
  };
  requests.push(newReq);
  writeJson('requests.json', requests);
  res.json({ success: true, message: '✅ Game imeongezwa! Wengine wanaweza kuipigia kura.' });
});

app.post('/api/requests/:id/vote', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza kupiga kura' });

  const requests = readJson('requests.json', []);
  const item = requests.find(r => r.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Game haipatikani' });
  if (item.voters.includes(user.email)) {
    return res.json({ success: false, message: 'Umeshapiga kura kwenye game hii' });
  }
  item.voters.push(user.email);
  item.votes += 1;
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

// 🧾 ADMIN OVERVIEW & STATS
app.get('/api/admin/orders', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const orders = readJson('orders.json', []);
  res.json({ success: true, orders: orders.slice().reverse() });
});

app.get('/api/admin/overview', (req, res) => {
  const user = getUserByToken(req); 
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const orders = readJson('orders.json', []); 
  const products = Object.values(readJson('products.json', {})); 
  const users = Object.values(readJson(usersFile, {}));
  
  const paid = orders.filter(o => o.status === 'successful');
  const pending = orders.filter(o => String(o.status || '').startsWith('pending'));
  const revenue = paid.reduce((n, o) => n + Number(o.amount || 0), 0);
  const byMethod = {}; 
  paid.forEach(o => { const k = o.provider || 'Other'; byMethod[k] = (byMethod[k] || 0) + Number(o.amount || 0); });
  const top = {}; 
  paid.forEach(o => (o.items || []).forEach(i => { const k = i.name || 'Bidhaa'; top[k] = (top[k] || 0) + (Number(i.quantity || i.qty) || 1); }));
  
  res.json({ 
    success: true, 
    revenue, 
    paidOrders: paid.length, 
    pendingOrders: pending.length, 
    customers: users.filter(u => !u.isAdmin).length, 
    products: products.length, 
    byMethod, 
    topProducts: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 8), 
    recent: orders.slice().reverse().slice(0, 20) 
  });
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
  if (!supabase) return res.json({ success: true, persistent: false, provider: 'Local .data only', warning: 'Weka SUPABASE_URL na SUPABASE_SERVICE_ROLE_KEY ili data isifutike.', kvTable: table });
  try {
    const { error } = await supabase.from(table).select('file_name').limit(1);
    if (error) return res.json({ success: true, persistent: false, provider: 'Supabase configured but KV unavailable', warning: 'Table ' + table + ' haipatikani.', kvTable: table });
    res.json({ success: true, persistent: true, provider: 'Supabase KV + local cache', warning: null, kvTable: table });
  } catch (e) { res.json({ success: true, persistent: false, provider: 'Supabase error', warning: e.message, kvTable: table }); }
});

app.get('/api/admin/stats', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const orders = readJson('orders.json', []);
  const users = readJson(usersFile, {});
  const total = orders.filter(o => o.status === 'successful').reduce((t, o) => t + (o.amount || 0), 0);
  res.json({
    success: true,
    stats: {
      orders: orders.length,
      total: total,
      customers: Object.keys(users).length,
      products: Object.keys(readJson('products.json', {})).length
    }
  });
});

// 🛡️ SECURITY MODULE ENDPOINTS
app.get('/api/security/events', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const data = readJson(securityFile, { events: [], blocked: {} });
  res.json({ success: true, events: data.events.slice().reverse() });
});

app.get('/api/security/stats', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const data = readJson(securityFile, { events: [], blocked: {} });
  const now = Date.now();
  const activeBlocks = {};
  for (const ip in (data.blocked || {})) {
    if (data.blocked[ip] > now) activeBlocks[ip] = data.blocked[ip];
  }
  res.json({
    success: true,
    stats: {
      totalEvents: data.events.length,
      high: data.events.filter(e => e.severity === 'HIGH').length,
      medium: data.events.filter(e => e.severity === 'MEDIUM').length,
      low: data.events.filter(e => e.severity === 'LOW').length,
      blockedIPs: Object.keys(activeBlocks).length
    },
    blocked: activeBlocks
  });
});

app.post('/api/security/block', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { ip, minutes } = req.body;
  if (!ip) return res.status(400).json({ error: 'Andika IP' });
  blockIP(ip, minutes || 60);
  res.json({ success: true, message: '🛡️ IP ' + ip + ' imefungwa kwa dakika ' + (minutes || 60) + '.' });
});

app.post('/api/security/unblock', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { ip } = req.body;
  const data = readJson(securityFile, { events: [], blocked: {} });
  if (data.blocked) delete data.blocked[ip];
  writeJson(securityFile, data);
  logSecurity('IP_UNBLOCKED', 'IP ' + ip + ' imefunguliwa na admin', 'LOW', getIP(req));
  res.json({ success: true, message: '✅ IP ' + ip + ' imefunguliwa.' });
});

app.get('/api/security/report', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const data = readJson(securityFile, { events: [], blocked: {} });
  const events = data.events;
  const now = Date.now();
  const last24h = events.filter(e => now - new Date(e.time).getTime() < 86400000);
  const blockedCount = Object.keys(data.blocked || {}).filter(ip => data.blocked[ip] > now).length;
  const high = events.filter(e => e.severity === 'HIGH').length;
  const attacks = events.filter(e => ['SQLI_XSS', 'BRUTE_FORCE', 'BLOCKED_REQUEST'].includes(e.type));

  const lines = [
    '🛡️ RIPOTI YA USALAMA — GameHub',
    'Tarehe: ' + new Date().toLocaleString(),
    '----------------------------------',
    'Matukio yote: ' + events.length,
    'Masaa 24 yaliyopita: ' + last24h.length,
    'Matukio makubwa (HIGH): ' + high,
    'Mashambulizi yaliyogunduliwa: ' + attacks.length,
    'IP zilizofungwa sasa: ' + blockedCount,
    '----------------------------------',
    'Hali: ' + (high > 0 ? 'Kuna hatari! Angalia matukio ya HIGH.' : 'Salama. Endelea kufanya kazi nzuri! ✅')
  ];
  res.json({ success: true, report: lines.join('\n') });
});

// 💳 FLUTTERWAVE INTEGRATION
app.post('/api/pay', async (req, res) => {
  try {
    const { amount, email, phone, name, network, items } = req.body;
    if (!amount || !email || !phone || !name || !network) {
      return res.status(400).json({ error: 'Jaza taarifa zote za malipo' });
    }
    const tx_ref = 'GH-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const payload = {
      tx_ref, amount: String(amount), currency: 'TZS', network,
      email, phone_number: phone, fullname: name,
      meta: { items: JSON.stringify(items || []) }
    };

    const response = await fetch('https://api.flutterwave.com/v3/charges?type=mobile_money_tanzania', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.FLW_SECRET_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.status !== 'success') return res.status(400).json({ error: data.message || 'Malipo hayakuanza' });
    res.json({ success: true, tx_ref });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

app.get('/api/verify', async (req, res) => {
  try {
    const tx_ref = req.query.tx_ref;
    if (!tx_ref) return res.status(400).json({ error: 'tx_ref inahitajika' });
    const response = await fetch('https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=' + tx_ref, {
      headers: { 'Authorization': 'Bearer ' + process.env.FLW_SECRET_KEY }
    });
    const data = await response.json();

    if (data.status === 'success' && data.data.status === 'successful') {
      const orders = readJson('orders.json', []);
      if (!orders.find(o => o.tx_ref === tx_ref)) {
        const meta = data.data.meta || {};
        let items = [];
        try { items = JSON.parse(meta.items || '[]'); } catch (e) { items = []; }
        orders.push({
          tx_ref,
          customer: (data.data.customer && data.data.customer.email) || '',
          amount: data.data.amount || 0,
          items,
          status: 'successful',
          date: new Date().toISOString()
        });
        await writeJson('orders.json', orders);
        logSecurity('PAYMENT_SUCCESS', 'Malipo yamefika: ' + (data.data.amount || 0) + ' TZS', 'LOW', getIP(req));
      }
      res.json({ success: true, status: 'successful' });
    } else {
      res.json({ success: false, status: data.data ? data.data.status : 'pending' });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ⚡ AZAMPAY INTEGRATION
const AZAM_ENV = String(process.env.AZAMPAY_ENVIRONMENT || process.env.AZAMPAY_ENV || 'sandbox').toLowerCase();
const AZAM_AUTH_BASE = AZAM_ENV === 'production'
  ? 'https://authenticator.azampay.co.tz'
  : 'https://authenticator-sandbox.azampay.co.tz';
const AZAM_API_BASE = process.env.AZAMPAY_API_BASE || (AZAM_ENV === 'production'
  ? 'https://api.azampay.co.tz'
  : 'https://sandbox.azampay.co.tz');

function azamConfigured() {
  return !!(process.env.AZAMPAY_APP_NAME && process.env.AZAMPAY_CLIENT_ID && process.env.AZAMPAY_CLIENT_SECRET);
}

let azamTokenCache = { token: null, expiresAt: 0 };

async function getAzamPayToken() {
  if (azamTokenCache.token && Date.now() < azamTokenCache.expiresAt - 60_000) {
    return azamTokenCache.token;
  }
  const r = await fetch(AZAM_AUTH_BASE + '/AppRegistration/GenerateToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appName: process.env.AZAMPAY_APP_NAME,
      clientId: process.env.AZAMPAY_CLIENT_ID,
      clientSecret: process.env.AZAMPAY_CLIENT_SECRET
    })
  });
  const raw = await r.text();
  let data = {};
  try { data = JSON.parse(raw); } catch (e) {}

  const token = data?.data?.accessToken || data?.accessToken;
  if (!r.ok || !token) {
    throw new Error('AzamPay Token Error: ' + (data?.message || raw.slice(0, 200)));
  }
  const expire = data?.data?.expire ? Date.parse(data.data.expire) : 0;
  azamTokenCache = {
    token: token.startsWith('Bearer ') ? token : 'Bearer ' + token,
    expiresAt: expire && !isNaN(expire) ? expire : Date.now() + 50 * 60 * 1000
  };
  return azamTokenCache.token;
}

function detectAzamProvider(phoneFull) {
  const p = String(phoneFull).replace(/\D/g, '');
  const prefix = p.slice(3, 5);
  if (['74', '75', '76'].includes(prefix)) return 'Mpesa';
  if (['71', '65', '67', '77'].includes(prefix)) return 'Tigo';
  if (['78', '68', '69'].includes(prefix)) return 'Airtel';
  if (['62', '61'].includes(prefix)) return 'Halopesa';
  if (['73'].includes(prefix)) return 'Azampesa';
  return null;
}

const AZAM_PROVIDERS = ['Mpesa', 'Tigo', 'Airtel', 'Halopesa', 'Azampesa'];

app.get('/api/admin/payment-status', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const configured = azamConfigured();
  res.json({
    success: true,
    configured,
    environment: AZAM_ENV,
    provider: 'AzamPay',
    apiBaseConfigured: !!process.env.AZAMPAY_API_BASE,
    apiKeyConfigured: !!process.env.AZAMPAY_API_KEY,
    callbackTokenConfigured: !!(process.env.AZAMPAY_CALLBACK_TOKEN || process.env.AZAMPAY_WEBHOOK_SECRET),
    callbackPath: '/api/azampay-callback'
  });
});

app.post('/api/azampay-pay', async (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza kulipa' });

  if (!azamConfigured()) {
    return res.status(503).json({ error: 'Malipo ya automatic hayapatikani — tumia Malipo Manual.' });
  }

  try {
    const { items, total, phone, name, provider } = req.body;
    if (!items || !items.length || !total) return res.status(400).json({ error: 'Kikapu ni tupu' });
    if (!phone) return res.status(400).json({ error: 'Weka namba ya simu' });

    let phoneFull = String(phone).replace(/\D/g, '');
    if (!phoneFull.startsWith('255')) phoneFull = '255' + phoneFull.replace(/^0/, '');
    if (phoneFull.length !== 12) return res.status(400).json({ error: 'Namba ya simu si sahihi. Mfano: 0786095758' });

    const requestedProvider = String(provider || '').trim();
    const mno = AZAM_PROVIDERS.includes(requestedProvider) ? requestedProvider : detectAzamProvider(phoneFull);
    if (!mno) return res.status(400).json({ error: 'Hatujaweza kutambua mtandao wa namba hii. Chagua mtandao.' });

    const orderReference = 'AZ' + Date.now() + crypto.randomBytes(3).toString('hex');

    const orders = readJson('orders.json', []);
    orders.push({
      tx_ref: orderReference,
      customer: user.email,
      customerPhone: phoneFull,
      customerName: name || user.name,
      amount: Number(total),
      items,
      provider: mno,
      status: 'pending_azampay',
      date: new Date().toISOString()
    });
    await writeJson('orders.json', orders);

    const token = await getAzamPayToken();
    const payload = {
      accountNumber: phoneFull,
      amount: String(total),
      currency: 'TZS',
      externalId: orderReference,
      provider: mno,
      additionalProperties: { customerEmail: user.email }
    };

    const apiRes = await fetch(AZAM_API_BASE + '/azampay/mno/checkout', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'X-API-Key': process.env.AZAMPAY_API_KEY || ''
      },
      body: JSON.stringify(payload)
    });
    const rawBody = await apiRes.text();
    let apiData = {};
    try { apiData = JSON.parse(rawBody); } catch (e) {}

    if (!apiRes.ok || apiData.success === false) {
      const all = readJson('orders.json', []);
      const idx = all.findIndex(o => o.tx_ref === orderReference);
      if (idx > -1) { all[idx].status = 'failed_to_start'; writeJson('orders.json', all); }

      const msg = apiData?.message || rawBody.slice(0, 200) || 'Imeshindwa kuanzisha malipo';
      return res.status(400).json({ error: 'AzamPay: ' + msg });
    }

    res.json({
      success: true,
      tx_ref: orderReference,
      provider: mno,
      transactionId: apiData.transactionId || null
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

function amountMatches(order, collectedAmount) {
  const collected = Number(collectedAmount);
  if (isNaN(collected)) return false;
  return collected >= (order.amount - 5);
}

app.post('/api/azampay-callback', async (req, res) => {
  try {
    const expected = process.env.AZAMPAY_CALLBACK_TOKEN || process.env.AZAMPAY_WEBHOOK_SECRET;
    if (expected) {
      const got = req.headers['authorization'] || req.headers['x-callback-token'] || '';
      const clean = String(got).replace(/^Bearer\s+/i, '');
      if (clean !== expected) {
        logSecurity('AZAMPAY_CALLBACK_UNAUTHORIZED', 'Callback token si sahihi', 'HIGH', getIP(req));
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const body = req.body || {};
    const payload = (body.data && typeof body.data === 'object') ? body.data : body;
    const orderReference = payload.utilityref || payload.utilityRef || payload.externalId || payload.reference || payload.referenceId;
    const status = String(payload.transactionstatus || payload.transactionStatus || payload.status || '').toLowerCase();
    const collectedAmount = payload.amount ?? payload.collectedAmount;

    if (orderReference && ['success', 'successful', 'settled', 'completed', 'paid'].includes(status)) {
      const orders = readJson('orders.json', []);
      const order = orders.find(o => o.tx_ref === orderReference);
      if (order && order.status !== 'successful') {
        if (!amountMatches(order, collectedAmount)) {
          logSecurity('AMOUNT_MISMATCH', 'Kiasi ' + collectedAmount + ' tofauti na ' + order.amount, 'HIGH', getIP(req));
          order.status = 'amount_mismatch';
          await writeJson('orders.json', orders);
          return res.json({ success: false });
        }
        order.status = 'successful';
        order.confirmedAt = new Date().toISOString();
        order.azamTransactionId = body.transactionId || body.operatorreference || null;
        await writeJson('orders.json', orders);
        logSecurity('AZAMPAY_PAYMENT_CONFIRMED', 'Malipo yamethibitishwa: ' + orderReference, 'LOW', getIP(req));
      }
    } else if (orderReference && ['failed', 'cancelled', 'canceled', 'rejected'].includes(status)) {
      const orders = readJson('orders.json', []);
      const order = orders.find(o => o.tx_ref === orderReference);
      if (order && order.status !== 'successful') {
        order.status = 'failed';
        await writeJson('orders.json', orders);
      }
    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/azampay-check/:ref', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza' });
  try {
    const orders = readJson('orders.json', []);
    const order = orders.find(o => o.tx_ref === req.params.ref && o.customer === user.email);
    if (!order) return res.status(404).json({ error: 'Order haipatikani' });

    if (order.status === 'successful') return res.json({ success: true, status: 'successful' });
    if (order.status === 'amount_mismatch') return res.json({ success: true, status: 'amount_mismatch' });
    if (order.status === 'failed' || order.status === 'failed_to_start') return res.json({ success: true, status: 'failed' });
    
    res.json({ success: true, status: 'pending' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Alias for compatibility
app.post('/api/clickpesa-pay', (req, res, next) => { req.url = '/api/azampay-pay'; app.handle(req, res, next); });
app.get('/api/clickpesa-check/:ref', (req, res, next) => { req.url = '/api/azampay-check/' + req.params.ref; app.handle(req, res, next); });

// 💵 MANUAL PAYMENTS
app.post('/api/manual-pay', async (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza kutuma ripoti' });

  const { items, total, txRef, phone } = req.body;
  if (!items || !items.length || !total) return res.status(400).json({ error: 'Kikapu ni tupu' });
  if (!txRef || !txRef.trim()) return res.status(400).json({ error: 'Andika namba ya muamala (tx ref)' });

  const orders = readJson('orders.json', []);
  const orderRef = 'MANUAL-' + Date.now();
  orders.push({
    tx_ref: orderRef,
    customer: user.email,
    customerPhone: phone || '',
    manualTxRef: txRef.trim(),
    amount: Number(total),
    items,
    status: 'pending_manual',
    date: new Date().toISOString()
  });
  await writeJson('orders.json', orders);
  logSecurity('MANUAL_PAYMENT_SUBMITTED', 'Ripoti ya malipo manual kutoka ' + user.email, 'LOW', getIP(req));

  res.json({ success: true, message: '✅ Ripoti imepokelewa! Admin atathibitisha malipo yako.', tx_ref: orderRef });
});

app.post('/api/admin/orders/confirm', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { tx_ref } = req.body;
  const orders = readJson('orders.json', []);
  const order = orders.find(o => o.tx_ref === tx_ref);
  if (!order) return res.status(404).json({ error: 'Order haipatikani' });
  order.status = 'successful';
  order.confirmedAt = new Date().toISOString();
  await writeJson('orders.json', orders);
  logSecurity('MANUAL_PAYMENT_CONFIRMED', 'Admin amethibitisha malipo: ' + tx_ref, 'LOW', getIP(req));
  res.json({ success: true, message: '✅ Malipo yamethibitishwa.' });
});

app.post('/api/admin/orders/reject', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { tx_ref } = req.body;
  const orders = readJson('orders.json', []);
  const filtered = orders.filter(o => o.tx_ref !== tx_ref);
  await writeJson('orders.json', filtered);
  res.json({ success: true });
});

app.get('/api/my-orders', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza' });
  const orders = readJson('orders.json', []);
  const mine = orders.filter(o => o.customer === user.email).slice().reverse();
  res.json({ success: true, orders: mine });
});

// 🤖 MULTI-AI INTEGRATION
async function askAI(prompt, preferred) {
  const providers = {
    deepseek: { key: process.env.DEEPSEEK_API_KEY, model: process.env.NEXUS_DEEPSEEK_MODEL || 'deepseek-chat' },
    anthropic: { key: process.env.ANTHROPIC_API_KEY, model: process.env.NEXUS_ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022' },
    openai: { key: process.env.OPENAI_API_KEY, model: process.env.NEXUS_OPENAI_MODEL || 'gpt-4o-mini' },
    google: { key: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY, model: process.env.NEXUS_GOOGLE_MODEL || 'gemini-1.5-flash' }
  };

  const configured = Object.keys(providers).filter(p => providers[p].key);
  if (!configured.length) {
    return 'AI API key haijawekwa kwenye server environment variables.';
  }

  const primary = preferred && providers[preferred]?.key ? preferred : (process.env.NEXUS_AI_PRIMARY && providers[process.env.NEXUS_AI_PRIMARY]?.key ? process.env.NEXUS_AI_PRIMARY : configured[0]);
  const fallbackEnv = process.env.NEXUS_AI_FALLBACK;
  const order = [primary].concat(fallbackEnv && providers[fallbackEnv]?.key ? [fallbackEnv] : []).concat(configured.filter(p => p !== primary && p !== fallbackEnv));

  const clean = (val) => String(val || '').slice(0, 12000);

  for (const provider of order) {
    try {
      const cfg = providers[provider];
      let text = '';

      if (provider === 'openai' || provider === 'deepseek') {
        const base = provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com';
        const response = await fetch(base + '/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
          body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: clean(prompt) }], temperature: 0.7, max_tokens: 700 })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || ('HTTP ' + response.status));
        text = data?.choices?.[0]?.message?.content || '';
      }

      if (provider === 'anthropic') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: cfg.model, max_tokens: 700, temperature: 0.7, messages: [{ role: 'user', content: clean(prompt) }] })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || ('HTTP ' + response.status));
        text = data?.content?.map(x => x.text || '').join('') || '';
      }

      if (provider === 'google') {
        const response = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(cfg.model) + ':generateContent?key=' + encodeURIComponent(cfg.key),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: clean(prompt) }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 700 } })
          }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || ('HTTP ' + response.status));
        text = data?.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || '';
      }

      if (text.trim()) return text.trim();
    } catch (err) {
      console.error('AI error (' + provider + '):', err.message);
    }
  }

  return 'Samahani, AI haikupatikana kwa sasa.';
}

app.post('/api/ai/chat', async (req, res) => {
  const { message, history, provider } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Andika ujumbe' });

  const products = Object.values(readJson('products.json', {}));
  const productList = products.length
    ? products.map(p => p.name + ' (' + (p.type || 'Bidhaa') + ') - ' + Number(p.price).toLocaleString() + ' TZS').join('\n')
    : 'Hakuna bidhaa bado';

  let transcript = '';
  if (Array.isArray(history) && history.length) {
    transcript = '\nMazungumzo ya awali:\n' + history.map(h => (h.role === 'user' ? 'Mteja: ' : 'Wewe: ') + h.text).join('\n') + '\n';
  }

  const prompt = 'Wewe ni msaidizi wa GameHub Tanzania.\n' +
    'Bidhaa:\n' + productList + '\n' + transcript + '\nJibu swali la mteja: "' + message + '"';

  const reply = await askAI(prompt, provider);
  res.json({ reply });
});

app.post('/api/ai/recommendations', async (req, res) => {
  const { message, provider } = req.body;
  const products = Object.values(readJson('products.json', {}));
  const catalog = products.map(p => `${p.name} | ${p.type || 'Game'} | ${Number(p.price || 0).toLocaleString()} TZS`).join('\n');
  const prompt = `Wewe ni AI Recommendation wa GameHub. Pendekeza bidhaa kutoka catalog hii tu:\n${catalog}\n\nSwali: ${String(message || '')}`;
  const reply = await askAI(prompt, provider);
  res.json({ reply });
});

app.post('/api/ai/health', async (req, res) => {
  const { message, history, provider } = req.body;
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'Andika swali' });
  const transcript = Array.isArray(history) ? history.slice(-8).map(h => `${h.role}: ${h.text}`).join('\n') : '';
  const prompt = `Wewe ni msaidizi wa afya ya jamii wa GameHub. Toa taarifa za jumla kwa Kiswahili na ushauri wa kuona daktari dharura ikibidi.\nMazungumzo:\n${transcript}\nSwali: ${String(message)}`;
  const reply = await askAI(prompt, provider || 'google');
  res.json({ reply });
});

app.post('/api/ai/admin', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });

  const { command } = req.body;
  if (!command || !command.trim()) return res.status(400).json({ error: 'Andika amri' });

  const lower = command.toLowerCase();

  const addMatch = lower.match(/ongeza\s+(?:game|bidhaa|product)?\s*(.+?)\s+bei\s+(\d+)/i)
    || lower.match(/ongeza\s+(?:game|bidhaa|product)?\s*(.+?)\s+(\d{3,})/i);
  if (addMatch) {
    const name = addMatch[1].trim();
    const price = Number(addMatch[2]);
    const products = readJson('products.json', {});
    const id = 'p' + Date.now();
    products[id] = { id: id, name: name, type: 'Game', price: price, emoji: '🎮', desc: 'Imeongezwa na AI' };
    writeJson('products.json', products);
    return res.json({ reply: '✅ Nimeongeza "' + name + '" kwa bei ' + price.toLocaleString() + ' TZS.' });
  }

  const reply = await askAI('Wewe ni AI Admin Assistant wa GameHub. Jibu amri hii: "' + command + '"');
  res.json({ reply });
});

// 📺 BANNERS, STREAMS, COURSES, MOVIES & MEDIA
app.get('/api/banners', (req, res) => { res.json({ success: true, banners: readJson('banners.json', []).filter(x => x.status !== 'hidden').slice(-20).reverse() }); });

app.get('/api/live-streams', (req, res) => {
  const streams = readJson('live_streams.json', []);
  res.json({ success: true, streams: streams.filter(x => x.status !== 'hidden').sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))) });
});

app.post('/api/admin/live-streams', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { title, league, homeTeam, awayTeam, status, streamUrl, videoUrl, startTime, description } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Weka jina la mechi.' });
  const streams = readJson('live_streams.json', []);
  const item = {
    id: 'live_' + Date.now(),
    title: String(title).slice(0, 160), league: String(league || 'Football').slice(0, 100),
    homeTeam: String(homeTeam || '').slice(0, 80), awayTeam: String(awayTeam || '').slice(0, 80),
    status: String(status || 'LIVE').slice(0, 30), streamUrl: String(streamUrl || '').slice(0, 2000),
    videoUrl: String(videoUrl || '').slice(0, 2000), startTime: String(startTime || '').slice(0, 80),
    description: String(description || '').slice(0, 1000), createdAt: new Date().toISOString()
  };
  streams.push(item); 
  await writeJson('live_streams.json', streams);
  res.json({ success: true, stream: item });
});

app.delete('/api/admin/live-streams/:id', (req, res) => {
  const user = getUserByToken(req); if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const data = readJson('live_streams.json', []); 
  writeJson('live_streams.json', data.filter(x => x.id !== req.params.id)); 
  res.json({ success: true });
});

app.get('/api/courses', (req, res) => {
  res.json({ success: true, courses: readJson('courses.json', []) });
});

app.post('/api/admin/courses', (req, res) => {
  const user = getUserByToken(req); if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { name, description, thumbnail, price, level } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Weka jina la course.' });
  const courses = readJson('courses.json', []);
  const course = { id: 'course_' + Date.now(), name: String(name).slice(0, 160), description: String(description || '').slice(0, 1000), thumbnail: String(thumbnail || '').slice(0, 1000), price: Number(price || 0), level: String(level || 'Beginner').slice(0, 50), videos: [], createdAt: new Date().toISOString() };
  courses.push(course); writeJson('courses.json', courses); res.json({ success: true, course });
});

app.post('/api/admin/courses/:id/videos/upload', upload.single('video'), async (req, res) => {
  const user = getUserByToken(req); if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const courses = readJson('courses.json', []); const course = courses.find(x => x.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'Course haipatikani.' });
  try {
    const saved = await saveUploadedVideo(req.file, 'courses');
    const video = { id: 'cv_' + Date.now(), title: String(req.body.title || req.file.originalname).slice(0, 160), description: String(req.body.description || '').slice(0, 1000), url: saved.url, duration: String(req.body.duration || '').slice(0, 30), createdAt: new Date().toISOString() };
    course.videos = course.videos || []; course.videos.push(video); writeJson('courses.json', courses);
    res.json({ success: true, course, video });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/movies', (req, res) => {
  const movies = readJson('movies.json', []);
  res.json({ success: true, movies: movies.filter(m => m.status !== 'hidden') });
});

app.post('/api/admin/movies/upload', upload.single('video'), async (req, res) => {
  const user = getUserByToken(req); if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  if (!req.file && !req.body.videoUrl) return res.status(400).json({ error: 'Chagua video au weka link kwanza.' });
  try {
    const remoteUrl = String(req.body.videoUrl || '').trim();
    const saved = remoteUrl ? { url: remoteUrl, storage: 'remote', path: remoteUrl, filename: '' } : await saveUploadedVideo(req.file, 'movies');
    const movies = readJson('movies.json', []);
    const movie = { id: 'movie_' + Date.now(), title: String(req.body.title || req.file?.originalname || 'Movie').slice(0, 180), description: String(req.body.description || '').slice(0, 1200), genre: String(req.body.genre || 'General').slice(0, 80), year: String(req.body.year || '2026').slice(0, 10), poster: String(req.body.poster || '').slice(0, 1000), videoUrl: saved.url, storage: saved.storage, createdAt: new Date().toISOString() };
    movies.push(movie); await writeJson('movies.json', movies); res.json({ success: true, movie });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/admin/movies/:id', (req, res) => {
  const user = getUserByToken(req); if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const movies = readJson('movies.json', []); writeJson('movies.json', movies.filter(x => x.id !== req.params.id)); res.json({ success: true });
});

// 🛠️ INTERNAL AI BUILDER
function extractJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(raw); } catch (e) {}
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(raw.slice(a, b + 1)); } catch (e) {} }
  return null;
}

app.post('/api/admin/ai-builder', async (req, res) => {
  const user = getUserByToken(req); if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { command, execute = true } = req.body || {}; if (!command || !String(command).trim()) return res.status(400).json({ error: 'Andika amri.' });
  try {
    const system = `Wewe ni AI Web Developer & Manager wa GameHub. Tengeneza JSON TU.\nAllowed actions: add_product, add_banner, add_movie, add_live_match.\nJibu mfano: {"summary":"...","actions":[{"type":"add_product","name":"FIFA","price":50000}]}`;
    const responseText = await askAI(`${system}\nAmri: ${command}`, 'anthropic');
    const plan = extractJson(responseText);

    if (!plan || !Array.isArray(plan.actions)) return res.status(422).json({ error: 'AI haikutoa JSON sahihi.', raw: responseText });
    
    const results = [];
    if (!execute) return res.json({ success: true, summary: plan.summary || 'Plan imeandaliwa.', actions: plan.actions, executed: false });

    for (const action of plan.actions.slice(0, 10)) {
      const type = String(action.type || action.action || '');
      if (type === 'add_product') {
        const products = readJson('products.json', {}), id = 'p' + Date.now() + crypto.randomBytes(2).toString('hex');
        products[id] = { id, name: String(action.name || 'New Product').slice(0, 160), type: String(action.type || 'Game').slice(0, 80), price: Number(action.price || 0), desc: String(action.desc || '').slice(0, 800), section: 'shop' };
        writeJson('products.json', products); results.push('Bidhaa: ' + products[id].name);
      }
    }

    res.json({ success: true, summary: plan.summary || 'Mabadiliko yamekamilika.', actions: plan.actions, results, executed: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 🏆 TOURNAMENTS
app.get('/api/tournaments', (req, res) => {
  res.json({ success: true, tournaments: readJson('tournaments.json', []) });
});

app.post('/api/tournaments/register', (req, res) => {
  const { tournamentId, name, phone, game, userToken } = req.body;
  if (!tournamentId || !name || !phone) return res.status(400).json({ error: 'Jaza jina, simu na tournament.' });
  const tournaments = readJson('tournaments.json', []);
  const t = tournaments.find(x => String(x.id) === String(tournamentId));
  if (!t) return res.status(404).json({ error: 'Tournament haipatikani.' });
  t.registrations = t.registrations || [];
  if (t.registrations.some(x => x.phone === phone)) return res.status(409).json({ error: 'Namba hii tayari imesajiliwa.' });
  t.registrations.push({ name: String(name).slice(0, 100), phone: String(phone).slice(0, 30), game: String(game || t.game || '').slice(0, 100), userToken: userToken || null, createdAt: new Date().toISOString() });
  writeJson('tournaments.json', tournaments);
  res.json({ success: true, message: 'Umefanikiwa kusajiliwa kwenye tournament.' });
});

ensureTournamentSeed();

// 🛡️ CENTRAL ERROR HANDLER
app.use((err, req, res, next) => {
  if (err) {
    console.error('API Error:', err.message);
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File ni kubwa sana (Max 1GB).' });
      return res.status(400).json({ error: 'Upload Error: ' + err.message });
    }
    return res.status(500).json({ error: err.message || 'Server Internal Error' });
  }
  next();
});

// 🚀 START SERVER
restoreFromSupabase()
  .then(() => ensureMediaBucket())
  .catch(err => console.error('☁️ Restore Error:', err.message))
  .finally(() => {
    const port = process.env.PORT || 3000;
    const listener = app.listen(port, () => {
      console.log('🎮 GameHub server iko live kwenye port:', listener.address().port);
    });
  });
