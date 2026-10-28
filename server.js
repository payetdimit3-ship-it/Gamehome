require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
let s3sign = null;   // faili la kusaini upload za hifadhi kubwa — likikosekana, website inaendelea kufanya kazi bila hifadhi kubwa
try { s3sign = require('./s3sign'); } catch (e) { console.warn('⚠️ s3sign.js haipo kwenye mradi — hifadhi kubwa (S3/R2) imezimwa. Pakia s3sign.js pamoja na server.js.'); }
const https = require('https');

const app = express();
app.set('trust proxy', 1);   // Render ina proxy 1 — req.ip inakuwa IP halisi ya mteja
app.use(express.json({ limit: '10mb' }));
// 🔒 Usitoe files za siri (code, data, nyaraka) hadharani
const BLOCKED_STATIC = /^\/(server\.js|package(-lock)?\.json|tools(\/.*)?|uploads\/tmp(\/.*)?|[^/]+\.(json|md|py|log|env))$/i;
app.use((req, res, next) => {
  let p = req.path;
  try { p = decodeURIComponent(p); } catch (e) { return res.status(400).end(); }
  if (BLOCKED_STATIC.test(p) || /(^|\/)\.[^/]/.test(p)) return res.status(404).send('Not found');
  next();
});
app.use(express.static('.'));

function requireStaff(req, res, next) {
  const u = getUserByToken(req);
  if (!u || (!u.isAdmin && !u.isStaff)) return res.status(403).json({ error: 'Huna ruhusa' });
  req.adminUser = u;
  res.on('finish', () => { try { if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (e) {} });
  next();
}
// Admin lazima athibitishwe KABLA file kupokelewa (multer inaandika disk)
function requireAdmin(req, res, next) {
  const u = getUserByToken(req);
  if (!u || !u.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  req.adminUser = u;
  res.on('finish', () => { try { if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (e) {} });
  next();
}

// 🎬 MEDIA STORAGE
const MEDIA_DIR = path.join(__dirname, 'uploads');
const TMP_MEDIA_DIR = path.join(MEDIA_DIR, 'tmp');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
if (!fs.existsSync(TMP_MEDIA_DIR)) fs.mkdirSync(TMP_MEDIA_DIR, { recursive: true });
app.use('/uploads', (req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); }, express.static(MEDIA_DIR));

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

// 📤 Upload ya file la game na picha (admin/staff)
const GAME_EXT = ['.zip', '.rar', '.7z', '.iso', '.cso', '.bin', '.apk', '.xapk', '.obb', '.exe', '.msi', '.pkg', '.gz', '.tar', '.001', '.nsp', '.xci', '.rpx'];
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const GAME_MAX_MB = Math.max(10, Number(process.env.UPLOAD_MAX_MB) || 1024);
const uploadGame = multer({ dest: TMP_MEDIA_DIR, limits: { fileSize: GAME_MAX_MB * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const ext = path.extname(String(file.originalname || '')).toLowerCase();
  if (!GAME_EXT.includes(ext)) return cb(new Error('Aina ya file hairuhusiwi. Tumia: ' + GAME_EXT.join(' ')));
  cb(null, true);
}});
const uploadImage = multer({ dest: TMP_MEDIA_DIR, limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const ext = path.extname(String(file.originalname || '')).toLowerCase();
  if (!IMAGE_EXT.includes(ext) || !/^image\/(png|jpe?g|webp|gif)$/i.test(String(file.mimetype || ''))) return cb(new Error('Aina ya file hairuhusiwi. Tumia picha ya PNG, JPG, WEBP au GIF (hadi 8MB).'));
  cb(null, true);
}});

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
  const ext = (path.extname(file.originalname || '') || '.mp4').replace(/[^a-zA-Z0-9.]/g, '').slice(0, 8);
  const safeBase = (path.basename(file.originalname || 'video', ext).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'video');
  const filename = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '-' + safeBase + ext.toLowerCase();
  const objectPath = folder + '/' + filename;
  const localPath = file.path;
  try {
    if (supabase) {
      try {
        const upOpts = { contentType: file.mimetype || 'video/mp4', upsert: false, cacheControl: '3600' };
        let error;
        try {   // stream — haipakii video nzima kwenye memory
          ({ error } = await supabase.storage.from(MEDIA_BUCKET).upload(objectPath, fs.createReadStream(localPath), { ...upOpts, duplex: 'half' }));
        } catch (e) { error = e; }
        if (error && file.size <= 150 * 1024 * 1024) {   // fallback kwa files ndogo
          ({ error } = await supabase.storage.from(MEDIA_BUCKET).upload(objectPath, fs.readFileSync(localPath), upOpts));
        }
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

// Canonical page compatibility routes. The project stores the HTML files at the
// project root, while older sitemap/docs use /user/* and /admin/* paths.
const USER_PAGE_ALIASES = {
  'home':'index.html','store':'store.html','games':'games.html','psp-gaming':'psp-gaming.html',
  'ps2-gaming':'ps2-gaming.html','ps3-gaming':'ps3-gaming.html','winlator-gamehub':'winlator-gamehub.html',
  'nintendo-switch':'nintendo-switch.html','android-gaming':'android-gaming.html','pc-gaming':'pc-gaming.html',
  'movies':'movies.html','live-tv-esports':'live-tv-esports.html','live-scores':'live-scores.html',
  'tournament':'tournament.html','betting':'betting.html','academy':'academy.html','courses':'courses.html',
  'cloud-gaming':'cloud-gaming.html','efootball-topup':'efootball-topup.html','gift-cards':'gift-cards.html',
  'community-chat':'community-chat.html','health-assistant':'health-assistant.html','ai-assistant':'ai-assistant.html',
  'marketplace':'marketplace.html','wishlist':'wishlist.html','cart':'cart.html','my-games-library':'my-games-library.html',
  'profile':'profile.html','login':'login.html','register':'register.html','product-details':'product-details.html',
  'checkout':'checkout.html','live-football-watch':'live-football-watch.html','live-movies-player':'live-movies-player.html',
  'game-trailer':'game-trailer.html','sports-tv':'sports-tv.html','sports-news':'sports-news.html',
  'my-orders':'my-orders.html','requests-transactions':'requests-transactions.html','contact-support':'contact-support.html',
  'faq-help':'faq-help.html','free-games':'free-games.html','game-advisor':'game-advisor.html','wallet':'wallet.html','content':'content.html'
};
const ADMIN_PAGE_ALIASES = {
  'dashboard':'dashboard.html','games-management':'games-management.html','products-management':'products-management.html',
  'movies-management':'movies-management.html','trailers-management':'trailers-management.html','hero-homepage-management':'hero-homepage-management.html',
  'live-matches-management':'live-matches-management.html','efootball-topup-management':'efootball-topup-management.html',
  'cloud-gaming-management':'cloud-gaming-management.html','gift-cards-management':'gift-cards-management.html',
  'marketplace-management':'marketplace-management.html','users-management':'users-management.html','orders-sales':'orders-sales.html',
  'coupons-discounts':'coupons-discounts.html','withdraw-requests':'withdraw-requests.html','support-tickets':'support-tickets.html',
  'courses-management':'courses-management.html','lessons-videos-management':'lessons-videos-management.html','students-management':'students-management.html',
  'sports-tv-management':'sports-tv-management.html','sports-news-management':'sports-news-management.html',
  'analytics':'analytics.html','reports':'reports.html','storage-server':'storage-server.html','settings':'settings.html','web-content':'web-content.html','content-management':'content-management.html','news-management':'news-management.html','tv-management':'tv-management.html','admin-chat':'admin-chat.html'
};
function servePageAlias(map, req, res) {
  const key = String(req.params.page || '').replace(/\.html$/i, '').toLowerCase();
  const file = map[key];
  if (!file) return res.status(404).send('Page haipatikani.');
  res.sendFile(path.join(__dirname, file));
}
app.get('/user/:page', (req,res) => servePageAlias(USER_PAGE_ALIASES, req, res));
app.get('/admin/:page', (req,res) => servePageAlias(ADMIN_PAGE_ALIASES, req, res));
app.get('/user/:page.html', (req,res) => servePageAlias(USER_PAGE_ALIASES, req, res));
app.get('/admin/:page.html', (req,res) => servePageAlias(ADMIN_PAGE_ALIASES, req, res));

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
  'public_chat.json', 'health_chats.json', 'boss_approvals.json', 'withdrawals.json', 'news.json', 'tv_channels.json'
];

function readJson(file, fallback) {
  try {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) { return fallback; }
}

const cloudQueue = new Map();
async function writeJson(file, data) {
  const filePath = path.join(DATA_DIR, file);
  const tmp = filePath + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);                       // atomic: file haiharibiki likikatika katikati
  if (!supabase) return { local: true, cloud: false };
  const snapshot = JSON.parse(JSON.stringify(data));
  const prev = cloudQueue.get(file) || Promise.resolve();
  const job = prev.catch(() => {}).then(async () => {  // upserts za file moja zinaenda kwa mpangilio (latest wins)
    try {
      const { error } = await supabase.from(process.env.SUPABASE_KV_TABLE || 'kv_store').upsert({ file_name: file, data: snapshot, updated_at: new Date().toISOString() });
      if (error) { console.error('☁️ Supabase backup error (' + file + '):', error.message); return { local: true, cloud: false, error: error.message }; }
      return { local: true, cloud: true };
    } catch (err) { console.error('☁️ Supabase backup error (' + file + '):', err.message); return { local: true, cloud: false, error: err.message }; }
  });
  cloudQueue.set(file, job);
  return job;
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

// (Hakuna tena mashindano ya demo yanayowekwa kiotomatiki)

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
function isBlocked(key, max) {
  const entry = loginAttempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.time > BLOCK_MINUTES * 60000) { loginAttempts.delete(key); return false; }
  return entry.count >= (max || MAX_ATTEMPTS);
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
  // 'trust proxy' imewekwa juu, kwa hiyo req.ip haiwezi kughushiwa kwa header ya x-forwarded-for
  return String(req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
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
  // Patterns za SQL injection / XSS halisi pekee (maneno ya kawaida kama "update" au "select" hayakamatwi)
  return /(union\s+(all\s+)?select\b|insert\s+into\s+\w+|drop\s+(table|database)\s+\w+|delete\s+from\s+\w+|update\s+\w+\s+set\s+\w+\s*=|<\s*script|javascript\s*:|onerror\s*=|onload\s*=|<\s*(iframe|embed|object)\b)/i.test(input);
}
const strikes = new Map();
function addStrike(ip) {
  const now = Date.now(); const e = strikes.get(ip) || { n: 0, t: now };
  if (now - e.t > 10 * 60000) e.n = 0;
  e.n++; e.t = now; strikes.set(ip, e);
  if (strikes.size > 5000) strikes.clear();
  return e.n;
}

app.use('/api', (req, res, next) => {
  const ip = getIP(req);
  const data = readJson(securityFile, { events: [], blocked: {} });
  const blocked = data.blocked || {};
  if (blocked[ip] && blocked[ip] > Date.now()) {
    logSecurity('BLOCKED_REQUEST', 'IP iliyofungwa ilijaribu kuingia tena', 'MEDIUM', ip);
    return res.status(403).json({ error: 'IP yako imefungwa. Wasiliana na admin.' });
  }
  const URL_FIELDS = ['downloadLink', 'imageUrl', 'trailerUrl', 'videoUrl', 'streamUrl', 'poster', 'thumbnail', 'buttonUrl', 'url', 'image'];
  for (const obj of [req.body, req.query]) {
    if (!obj || typeof obj !== 'object') continue;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val !== 'string') continue;
      if (URL_FIELDS.includes(key)) {
        if (val.length > 2000) return res.status(400).json({ error: 'URL ni ndefu sana.' });
        if (/^\s*(javascript|vbscript)\s*:/i.test(val) || /^\s*data:\s*text\/html/i.test(val)) {
          logSecurity('BAD_URL_SCHEME', 'URL hatari katika: "' + key + '"', 'MEDIUM', ip);
          return res.status(400).json({ error: 'URL haikubaliki.' });
        }
        continue;
      }
      if (val.length > 12000) return res.status(400).json({ error: 'Maandishi ni marefu mno.' });   // si shambulio — hatufungi IP
      if (isSuspicious(val)) {
        logSecurity('SQLI_XSS', 'Input ya mashaka katika: "' + key + '"', 'HIGH', ip);
        if (addStrike(ip) >= 3) blockIP(ip, 30);           // IP inafungwa baada ya majaribio 3 ndani ya dakika 10
        return res.status(400).json({ error: 'Input haikubaliki.' });
      }
    }
  }
  next();
});

// Admin hapewi kiotomatiki bila ADMIN_EMAIL. Kwa usajili wa password (email haijathibitishwa) inatolewa mara ya kwanza tu (kama hakuna admin bado).
function canAutoAdmin(email, verified, users) {
  const ae = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!ae || email !== ae) return false;
  return verified ? true : !Object.values(users || {}).some(u => u && u.isAdmin);
}

// 👤 USERS + SESSIONS
const usersFile = 'users.json';
const sessionsFile = 'sessions.json';
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;   // token inaisha baada ya siku 30
function createSession(email) {
  const token = crypto.randomBytes(24).toString('hex');
  const sessions = readJson(sessionsFile, {});
  const now = Date.now();
  for (const k of Object.keys(sessions)) { const v = sessions[k]; if (v && typeof v === 'object' && v.exp && v.exp < now) delete sessions[k]; }
  sessions[token] = { email, exp: now + SESSION_TTL_MS };
  writeJson(sessionsFile, sessions);
  return token;
}
function getUserByToken(req) {
  const token = req.headers.authorization || (req.method === 'GET' ? req.query.token : '');
  if (!token) return null;
  const sessions = readJson(sessionsFile, {});
  const entry = sessions[token];
  if (!entry) return null;
  const email = typeof entry === 'string' ? entry : entry.email;     // sessions za zamani (string) bado zinafanya kazi
  if (entry && typeof entry === 'object' && entry.exp && entry.exp < Date.now()) return null;
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
  users[cleanEmail] = {
    name: name.trim(), email: cleanEmail, phone: phone || '',
    password: hashPassword(password), isAdmin: canAutoAdmin(cleanEmail, false, users), isStaff: false,
    balance: 0, adminEarnings: 0, created: new Date().toISOString()
  };
  writeJson(usersFile, users);
  const token = createSession(cleanEmail);
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
    if (!users[email]) {
      users[email] = { name: displayName || 'LIFEISGAMETZ User', email, phone: '', password: null, authProvider: provider, providerId: authUser.id, isAdmin: canAutoAdmin(email, true, users), isStaff: false, balance: 0, adminEarnings: 0, created: new Date().toISOString() };
      writeJson(usersFile, users);
    } else {
      users[email].authProvider = users[email].authProvider || provider;
      users[email].providerId = users[email].providerId || authUser.id;
      if (!users[email].name || users[email].name === email.split('@')[0]) users[email].name = displayName;
      writeJson(usersFile, users);
    }
    const token = createSession(email);
    const user = users[email];
    res.json({ success:true, token, user:{ name:user.name, email:user.email, isAdmin:!!user.isAdmin, isStaff:!!user.isStaff, provider } });
  } catch (e) { console.error('Social login:', e); res.status(500).json({ error: 'Social login imeshindikana.' }); }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const ip = getIP(req);
  if (!cleanEmail || !password) return res.status(400).json({ error: 'Jaza email na password' });
  if (isBlocked(ip + '|' + cleanEmail) || isBlocked(ip, 25)) return res.status(429).json({ error: 'Jaribio nyingi. Subiri dakika ' + BLOCK_MINUTES + '.' });
  const users = readJson(usersFile, {});
  const user = users[cleanEmail];
  if (!user || !user.password || !verifyPassword(password, user.password)) {
    recordFail(ip + '|' + cleanEmail); recordFail(ip);
    if ((loginAttempts.get(ip) || {}).count >= 25) { blockIP(ip, 60); logSecurity('BRUTE_FORCE', 'Majaribio mengi ya kuingia kutoka IP ' + ip, 'HIGH', ip); }
    return res.status(401).json({ error: 'Email au password si sahihi' });
  }
  loginAttempts.delete(ip + '|' + cleanEmail);
  const token = createSession(cleanEmail);
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
  const setupKey = String(process.env.ADMIN_SETUP_KEY || '');
  const a = Buffer.from(String(key || '')), b = Buffer.from(setupKey);
  if (!setupKey || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: 'Ufunguo si sahihi' });
  const users = readJson(usersFile, {});
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!users[cleanEmail]) return res.status(404).json({ error: 'Mtumiaji huyo hajapatikana. Jisajili kwanza kwenye tovuti.' });
  users[cleanEmail].isAdmin = true;
  writeJson(usersFile, users);
  res.json({ success: true, message: '✅ ' + cleanEmail + ' sasa ni Admin. Toka (logout) na uingie tena ili ibadilike.' });
});

// 💰 WALLET (Mpila Yangu): salio linatokana na zawadi za mechi/mashindano. Kutoa pesa = ombi linalothibitishwa na admin.
const MIN_WITHDRAW = Math.max(1000, Number(process.env.MIN_WITHDRAW_TZS) || 5000);
const WITHDRAW_NETWORKS = ['M-Pesa', 'Tigo Pesa', 'Airtel Money', 'HaloPesa'];
app.get('/api/wallet', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza' });
  const mine = readJson('withdrawals.json', []).filter(w => w.email === user.email).slice(-20).reverse();
  res.json({ success: true, balance: Number(user.balance) || 0, minWithdraw: MIN_WITHDRAW, networks: WITHDRAW_NETWORKS, ledger: (user.ledger || []).slice(-30).reverse(), withdrawals: mine });
});
app.post('/api/wallet/withdraw', async (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza' });
  const amount = Math.floor(Number(req.body && req.body.amount));
  const network = WITHDRAW_NETWORKS.includes(req.body && req.body.network) ? req.body.network : '';
  let phone = String((req.body && req.body.phone) || '').replace(/\D/g, '');
  if (!phone.startsWith('255')) phone = '255' + phone.replace(/^0/, '');
  if (!network) return res.status(400).json({ error: 'Chagua mtandao wa simu' });
  if (phone.length !== 12) return res.status(400).json({ error: 'Namba ya simu si sahihi. Mfano: 0786095758' });
  if (!(amount >= MIN_WITHDRAW)) return res.status(400).json({ error: 'Kiwango cha chini cha kutoa ni ' + MIN_WITHDRAW.toLocaleString() + ' TZS' });
  const users = readJson(usersFile, {});
  const me = users[String(user.email).toLowerCase()];
  if (!me || (me.balance || 0) < amount) return res.status(400).json({ error: 'Salio halitoshi' });
  const withdrawals = readJson('withdrawals.json', []);
  if (withdrawals.filter(w => w.email === me.email && w.status === 'pending').length >= 2) return res.status(429).json({ error: 'Una maombi 2 yanayosubiri. Subiri yathibitishwe.' });
  me.balance -= amount;
  me.ledger = (me.ledger || []).concat([{ type: 'withdraw', amount: -amount, note: 'Ombi la kutoa ' + network, date: new Date().toISOString() }]).slice(-200);
  const w = { id: 'wd_' + Date.now() + '_' + crypto.randomBytes(2).toString('hex'), email: me.email, name: me.name, amount, phone, network, status: 'pending', date: new Date().toISOString() };
  withdrawals.push(w);
  await writeJson(usersFile, users);
  await writeJson('withdrawals.json', withdrawals);
  logSecurity('WITHDRAW_REQUESTED', me.email + ' ameomba kutoa ' + amount, 'LOW', getIP(req));
  res.json({ success: true, withdrawal: w, balance: me.balance });
});
app.get('/api/admin/withdrawals', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  res.json({ success: true, withdrawals: readJson('withdrawals.json', []).slice().reverse() });
});
app.post('/api/admin/withdrawals/:id/decide', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const decision = req.body && req.body.decision;
  if (!['paid', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Uamuzi si sahihi' });
  const withdrawals = readJson('withdrawals.json', []);
  const w = withdrawals.find(x => x.id === req.params.id);
  if (!w || w.status !== 'pending') return res.status(404).json({ error: 'Ombi halipatikani au limeshashughulikiwa' });
  w.status = decision; w.decidedAt = new Date().toISOString(); w.decidedBy = user.email; w.note = cleanPublicText(req.body.note, 200);
  if (decision === 'rejected') {   // rudisha salio
    const users = readJson(usersFile, {});
    const u = users[w.email];
    if (u) { u.balance = (u.balance || 0) + w.amount; u.ledger = (u.ledger || []).concat([{ type: 'refund', amount: w.amount, note: 'Ombi la kutoa limekataliwa', date: new Date().toISOString() }]).slice(-200); await writeJson(usersFile, users); }
  }
  await writeJson('withdrawals.json', withdrawals);
  res.json({ success: true, withdrawal: w });
});

// 🏆 KUKAMILISHA MECHI
async function completeMatchAndPayout(matchId, winnerUserId) {
  const matches = readJson('matches.json', []);
  const match = matches.find(m => m.id === matchId);
  if (!match || match.status === 'completed') return { success: false, error: 'Mechi haipatikani au imeshakamilika' };
  const w = String(winnerUserId || '').trim().toLowerCase();
  const players = [match.player1Id, match.player2Id].filter(Boolean).map(x => String(x).trim().toLowerCase());
  if (players.length && !players.includes(w)) return { success: false, error: 'Mshindi lazima awe mmoja wa wachezaji wa mechi hii' };
  const users = readJson(usersFile, {});
  const winnerKey = Object.keys(users).find(k => k.toLowerCase() === w || String(users[k].email || '').toLowerCase() === w);
  if (!winnerKey) return { success: false, error: 'Mshindi hajapatikana kwenye wateja (angalia email)' };
  const totalPool = (match.entryFee || 0) * 2;
  const platformFee = totalPool * 0.10;
  const winnerPrize = totalPool - platformFee;
  users[winnerKey].balance = (users[winnerKey].balance || 0) + winnerPrize;
  users[winnerKey].ledger = (users[winnerKey].ledger || []).concat([{ type: 'win', amount: winnerPrize, note: 'Zawadi ya mechi: ' + String(match.title || '').slice(0, 60), date: new Date().toISOString() }]).slice(-200);
  const adminKey = Object.keys(users).find(k => users[k].isAdmin === true);
  if (adminKey) users[adminKey].adminEarnings = (users[adminKey].adminEarnings || 0) + platformFee;
  match.status = 'completed'; match.winnerId = winnerKey; match.platformCommission = platformFee; match.winnerPayout = winnerPrize;
  await writeJson('matches.json', matches);
  await writeJson(usersFile, users);
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

// ☁️ HIFADHI KUBWA (S3-compatible: Cloudflare R2, Backblaze B2, AWS S3, Wasabi, Supabase S3…)
// Browser inapakia file MOJA KWA MOJA kwenye bucket kwa presigned URL (haipiti Render — hakuna kikomo cha disk/RAM/muda).
// Files za game ni PRIVATE: zinahifadhiwa kama 's3:<key>' na wateja waliolipa wanapewa link ya muda mfupi (masaa 6).
function s3Cfg() {
  if (!s3sign) return null;
  const e = process.env;
  if (!(e.S3_ENDPOINT && e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY)) return null;
  let u; try { u = new URL(e.S3_ENDPOINT); } catch (x) { return null; }
  return { host: u.host, bucket: e.S3_BUCKET, region: e.S3_REGION || 'auto', accessKey: e.S3_ACCESS_KEY_ID, secretKey: e.S3_SECRET_ACCESS_KEY, publicBase: String(e.S3_PUBLIC_BASE_URL || '').replace(/\/+$/, '') };
}
function s3Url(method, key, expires, query) {
  const c = s3Cfg();
  return s3sign.presign({ method, host: c.host, path: '/' + c.bucket + '/' + key, region: c.region, accessKey: c.accessKey, secretKey: c.secretKey, expires, query });
}
const S3_PRIVATE_KEY = /^(games|files)\/[A-Za-z0-9._\/-]{3,200}$/;
// 's3:games/…' -> link ya kupakua ya muda mfupi (inatolewa tu kwa wateja waliolipa au kwa games za FREE)
function resolveFileUrl(u) {
  const v = String(u || '');
  if (!v.startsWith('s3:')) return v;
  const key = v.slice(3);
  if (!s3Cfg() || !S3_PRIVATE_KEY.test(key) || key.includes('..')) return '';
  const base = key.split('/').pop().replace(/^\d+-[a-f0-9]{8}-/, '').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'download';
  return s3Url('GET', key, 6 * 3600, { 'response-content-disposition': 'attachment; filename="' + base + '"' });
}
const S3_MAX_MB = Math.max(10, Number(process.env.UPLOAD_MAX_MB_S3) || 5120);
const UPLOAD_KINDS = {
  game: { exts: ['.zip', '.rar', '.7z', '.iso', '.cso', '.bin', '.apk', '.xapk', '.obb', '.exe', '.msi', '.pkg', '.gz', '.tar', '.001', '.nsp', '.xci', '.rpx'], folder: 'games', priv: true, maxMb: () => S3_MAX_MB, serverMaxMb: () => GAME_MAX_MB },
  image: { exts: ['.png', '.jpg', '.jpeg', '.webp', '.gif'], folder: 'images', priv: false, maxMb: () => 8, serverMaxMb: () => 8 },
  video: { exts: ['.mp4', '.webm', '.mov', '.m4v'], folder: 'news', priv: false, maxMb: () => Math.min(S3_MAX_MB, 2048), serverMaxMb: () => 1024 }
};
app.get('/api/admin/storage-info', (req, res) => {
  const user = getUserByToken(req);
  if (!user || (!user.isAdmin && !user.isStaff)) return res.status(403).json({ error: 'Huna ruhusa' });
  const c = s3Cfg();
  if (c) return res.json({ success: true, provider: 's3', directUpload: true, gameMaxMb: S3_MAX_MB, publicImages: !!c.publicBase, message: '☁️ Hifadhi kubwa (S3/R2) imewashwa — files za game hadi ' + (S3_MAX_MB >= 1024 ? (S3_MAX_MB / 1024).toFixed(0) + 'GB' : S3_MAX_MB + 'MB') + ' zinapakiwa moja kwa moja, na ni za faragha (wateja waliolipa tu).' + (c.publicBase ? '' : ' Picha/video za habari zinapitia server (weka S3_PUBLIC_BASE_URL ili ziende moja kwa moja pia).') });
  res.json({ success: true, provider: supabase ? 'supabase' : 'local', directUpload: false, gameMaxMb: GAME_MAX_MB, message: supabase ? '⚠️ Unatumia Supabase Storage: plan ya bure inakubali ~50MB tu kwa file. Kwa games za GB, weka Cloudflare R2/S3 (S3_* kwenye Render) au upgrade Supabase na uongeze file size limit.' : '⚠️ Hifadhi ya server tu (inapotea Render ikiwashwa upya). Weka Cloudflare R2/S3 ili files ziwe za kudumu na ziweze kuwa kubwa.' });
});
// 🔍 UCHUNGUZI WA HIFADHI (S3/R2): inajaribu funguo, bucket na CORS na kueleza kinachokosekana
function s3Raw(method, url, headers, body, timeoutMs) {
  return new Promise(resolve => {
    let u; try { u = new URL(url); } catch (e) { return resolve({ error: 'URL si sahihi' }); }
    const r = https.request({ method, hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, headers: Object.assign({}, headers || {}, body != null ? { 'Content-Length': Buffer.byteLength(body) } : {}), timeout: timeoutMs || 10000 }, resp => {
      let data = ''; resp.setEncoding('utf8'); resp.on('data', d => { if (data.length < 4000) data += d; });
      resp.on('end', () => resolve({ status: resp.statusCode, headers: resp.headers, body: data }));
    });
    r.on('timeout', () => { r.destroy(); resolve({ error: 'Muda umeisha (hakuna jibu kutoka kwenye endpoint)' }); });
    r.on('error', e => resolve({ error: e.code === 'ENOTFOUND' ? 'Endpoint haipatikani (' + u.hostname + ') — angalia S3_ENDPOINT' : (e.message || 'Hitilafu ya mtandao') }));
    if (body != null) r.write(body);
    r.end();
  });
}
const xmlTag = (xml, tag) => { const m = new RegExp('<' + tag + '>([^<]*)</' + tag + '>').exec(String(xml || '')); return m ? m[1] : ''; };
function s3Explain(r, what) {
  if (r.error) return { ok: false, detail: r.error, fix: 'Hakiki S3_ENDPOINT (mf. https://ACCOUNT_ID.r2.cloudflarestorage.com) na kwamba hauna nafasi/herufi za ziada.' };
  const code = xmlTag(r.body, 'Code'), msg = xmlTag(r.body, 'Message');
  if (r.status >= 200 && r.status < 300) return { ok: true, detail: what + ' imefanikiwa' };
  const fixes = {
    InvalidAccessKeyId: 'S3_ACCESS_KEY_ID si sahihi. Nakili tena Access Key ID ya token (siyo Account ID wala Token value).',
    SignatureDoesNotMatch: 'S3_SECRET_ACCESS_KEY si sahihi (au S3_ENDPOINT/S3_REGION si sahihi). Weka region = auto kwa R2, na nakili Secret yote bila nafasi.',
    NoSuchBucket: 'Bucket "' + (s3Cfg() || {}).bucket + '" haipo kwenye akaunti hii. Hakiki jina la S3_BUCKET (herufi ndogo, kama ulivyoitengeneza).',
    AccessDenied: 'Token haina ruhusa ya kutosha. Tengeneza token mpya yenye "Object Read & Write" kwa bucket hii.',
    RequestTimeTooSkewed: 'Saa ya server haiko sahihi.'
  };
  return { ok: false, detail: what + ' imekataliwa: HTTP ' + r.status + (code ? ' ' + code : '') + (msg ? ' — ' + msg : ''), fix: fixes[code] || (r.status === 403 ? 'Funguo au ruhusa si sahihi. Tengeneza token mpya ya R2 yenye Object Read & Write.' : r.status === 404 ? 'Bucket au endpoint si sahihi.' : 'Angalia mipangilio ya S3_* kwenye Render.') };
}
app.post('/api/admin/storage-test', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const checks = []; const add = (name, ok, detail, fix) => checks.push({ name, ok, detail: detail || '', fix: fix || '' });
  if (!s3sign) { add('Faili la s3sign.js', false, 'Halipo kwenye mradi wako', 'Pakia faili s3sign.js (liko kwenye zip) kwenye folda moja na server.js, kisha deploy upya.'); return res.json({ success: true, ok: false, checks }); }
  const e = process.env;
  const missing = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].filter(k => !e[k]);
  if (missing.length) {
    add('Mipangilio kwenye Render', false, 'Haipo: ' + missing.join(', '), 'Weka vigezo hivi kwenye Render → Environment, kisha ubonyeze Manual Deploy (Environment mpya haisomwi bila kuwasha upya).');
    return res.json({ success: true, ok: false, checks });
  }
  let ep; try { ep = new URL(e.S3_ENDPOINT); } catch (x) { ep = null; }
  if (!ep) { add('S3_ENDPOINT', false, 'Si URL sahihi: ' + String(e.S3_ENDPOINT).slice(0, 80), 'Mfano sahihi: https://ACCOUNT_ID.r2.cloudflarestorage.com (anza na https://).'); return res.json({ success: true, ok: false, checks }); }
  const epWarn = /r2\.dev$/i.test(ep.hostname) ? 'Hii ni anwani ya public (r2.dev), siyo S3 endpoint.' : (ep.pathname && ep.pathname !== '/' ? 'Endpoint isiwe na jina la bucket au njia (' + ep.pathname + ').' : '');
  add('S3_ENDPOINT', !epWarn, epWarn ? ep.hostname + ' — ' + epWarn : ep.hostname, epWarn ? 'Tumia: https://ACCOUNT_ID.r2.cloudflarestorage.com' : '');
  add('Vigezo vya Render', true, 'S3_BUCKET=' + e.S3_BUCKET + ' • region=' + (e.S3_REGION || 'auto') + ' • funguo zimewekwa');
  const c = s3Cfg(); const key = 'files/_healthcheck-' + Date.now() + '.txt';
  // 1. PUT (funguo + bucket + sahihi)
  const put = await s3Raw('PUT', s3Url('PUT', key, 300), { 'Content-Type': 'text/plain' }, 'ok');
  const pe = s3Explain(put, 'Kuandika (PUT) faili la majaribio'); add('Funguo na bucket (kuandika)', pe.ok, pe.detail, pe.fix);
  if (pe.ok) {
    const get = await s3Raw('GET', s3Url('GET', key, 300));
    const ge = s3Explain(get, 'Kusoma (GET)'); add('Kusoma file', ge.ok && get.body === 'ok', ge.ok ? (get.body === 'ok' ? 'imesomwa sawa' : 'maudhui hayalingani') : ge.detail, ge.fix);
    const del = await s3Raw('DELETE', s3Url('DELETE', key, 300));
    add('Kufuta file la majaribio', del.status >= 200 && del.status < 300, del.error || ('HTTP ' + del.status), del.status === 403 ? 'Si lazima, lakini ruhusa ya kufuta inasaidia kusafisha. Tumia token yenye Object Read & Write.' : '');
  }
  // 2. CORS preflight (hii ndiyo sababu ya kawaida ya "mtandao umekatika")
  const origin = req.headers.origin || ((req.headers['x-forwarded-proto'] || 'https') + '://' + (req.headers['x-forwarded-host'] || req.headers.host || ''));
  const pre = await s3Raw('OPTIONS', s3Url('PUT', 'games/_cors-check.bin', 300), { 'Origin': origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type' });
  if (pre.error) add('CORS (ruhusa ya browser)', false, pre.error, 'Hakiki S3_ENDPOINT.');
  else {
    const h = pre.headers || {}, allowO = String(h['access-control-allow-origin'] || ''), allowM = String(h['access-control-allow-methods'] || ''), allowH = String(h['access-control-allow-headers'] || '').toLowerCase();
    const oOk = allowO === '*' || allowO === origin, mOk = !allowM || /PUT/i.test(allowM) || allowM === '*', hOk = !allowH || allowH.includes('*') || allowH.includes('content-type');
    const good = pre.status >= 200 && pre.status < 300 && oOk && mOk && hOk;
    add('CORS (ruhusa ya browser)', good, good ? 'Browser inaruhusiwa kupakia kutoka ' + origin : (!allowO ? 'Bucket haikubali maombi kutoka ' + origin + ' (hakuna CORS policy)' : !oOk ? 'CORS inaruhusu "' + allowO + '" lakini admin yako iko "' + origin + '"' : !mOk ? 'CORS hairuhusu PUT' : 'CORS hairuhusu header ya Content-Type'),
      good ? '' : 'R2 → bucket → Settings → CORS Policy, weka: [{"AllowedOrigins":["' + origin + '"],"AllowedMethods":["PUT"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3600}] — origin iwe sawa kabisa na anwani ya admin (bila "/" mwishoni).');
  }
  add('Picha/video za habari', !!c.publicBase, c.publicBase ? 'Zitaenda moja kwa moja: ' + c.publicBase : 'S3_PUBLIC_BASE_URL haijawekwa — picha na video zinapitia server (si lazima kwa files za game).', '');
  res.json({ success: true, ok: checks.filter(x => x.name !== 'Picha/video za habari' && x.name !== 'Kufuta file la majaribio').every(x => x.ok), checks });
});

// Hatua ya 1 ya upload: server inakagua file na kutoa presigned URL (au inaelekeza njia ya kawaida kupitia server)
app.post('/api/admin/upload/init', (req, res) => {
  const user = getUserByToken(req);
  if (!user || (!user.isAdmin && !user.isStaff)) return res.status(403).json({ error: 'Huna ruhusa' });
  const b = req.body || {};
  const k = UPLOAD_KINDS[b.kind];
  if (!k) return res.status(400).json({ error: 'Aina ya upload si sahihi' });
  const filename = cleanPublicText(b.filename, 160);
  const ext = path.extname(filename).toLowerCase();
  if (!k.exts.includes(ext)) return res.status(400).json({ error: 'Aina ya file hairuhusiwi. Tumia: ' + k.exts.join(' ') });
  const size = Number(b.size);
  if (!(size > 0)) return res.status(400).json({ error: 'Ukubwa wa file si sahihi' });
  const c = s3Cfg();
  if (!c || (!k.priv && !c.publicBase)) {
    const max = k.serverMaxMb();
    if (size > max * 1048576) return res.status(413).json({ error: 'File ni kubwa kuliko ' + max + 'MB inayoruhusiwa kupitia server.' + (b.kind === 'game' ? ' Weka hifadhi kubwa (Cloudflare R2/S3) kupakia files za GB.' : '') });
    const warning = (supabase && !c && size > 50 * 1048576) ? 'Faili hili ni kubwa kuliko 50MB. Supabase ya bure itakataa upload hii (baada ya kupakia kwenye server). Endelea?' : '';
    return res.json({ success: true, mode: 'server', maxMb: max, warning });
  }
  const max = k.maxMb();
  if (size > max * 1048576) return res.status(413).json({ error: 'File ni kubwa kuliko ' + max + 'MB inayoruhusiwa.' });
  const base = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60) || 'file';
  const key = k.folder + '/' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '-' + base + ext;
  res.json({ success: true, mode: 's3', uploadUrl: s3Url('PUT', key, 3600), url: k.priv ? 's3:' + key : c.publicBase + '/' + key, maxMb: max, name: filename, size });
});

// 📤 UPLOAD: picha na file la game
app.post('/api/admin/upload/image', requireStaff, uploadImage.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Chagua picha kwanza.' });
    const saved = await saveUploadedVideo(req.file, 'images');
    res.json({ success: true, url: saved.url, storage: saved.storage, name: req.file.originalname, size: req.file.size });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/admin/upload/game', requireStaff, uploadGame.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Chagua file la game kwanza.' });
    const saved = await saveUploadedVideo(req.file, 'games');
    res.json({ success: true, url: saved.url, storage: saved.storage, name: req.file.originalname, size: req.file.size });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// 🎮 BIDHAA (PRODUCTS)
// Links nyingi kwa game moja: product.links = [{ label, url }]. Free games: product.free = true (bei 0).
const PLATFORM_KEYS = ['psp','ps2','ps3','switch','android','cloud','pc','winlator'];
function cleanLinks(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const l of arr.slice(0, 15)) {
    const url = String((l && l.url) || '').trim();
    if (!/^(https?:\/\/|\/uploads\/|s3:games\/|s3:files\/)/i.test(url) || url.length > 2000) continue;   // links za nje, files zilizopakiwa (/uploads/) au hifadhi kubwa (s3:)
    if (url.startsWith('s3:') && (!S3_PRIVATE_KEY.test(url.slice(3)) || url.includes('..'))) continue;   // ref ya hifadhi isiyo salama haikubaliwi
    out.push({ label: String((l && l.label) || 'Download').trim().slice(0, 40) || 'Download', url });
  }
  return out;
}
// Features na System Requirements za bidhaa (mistari mifupi, imesafishwa)
function cleanLines(arr, maxItems, maxLen) {
  if (!Array.isArray(arr)) return [];
  return arr.map(x => cleanPublicText(x, maxLen)).filter(Boolean).slice(0, maxItems);
}
function cleanRequirements(r) {
  r = r && typeof r === 'object' ? r : {};
  return { minimum: cleanLines(r.minimum, 8, 160), recommended: cleanLines(r.recommended, 8, 160) };
}
function isStaffUser(req) { const u = getUserByToken(req); return !!(u && (u.isAdmin || u.isStaff)); }
// Mteja wa kawaida haoni password za akaunti wala links za games za kulipia — hizi hutolewa baada ya malipo (My Orders).
function publicProduct(p) {
  const out = { ...p };
  delete out.accountUser; delete out.accountPassword;
  if (!out.free) { delete out.downloadLink; delete out.links; }
  else {   // games za FREE: 's3:' inakuwa link ya muda mfupi
    out.downloadLink = resolveFileUrl(out.downloadLink);
    out.links = (out.links || []).map(l => ({ ...l, url: resolveFileUrl(l.url) })).filter(l => l.url);
  }
  return out;
}
app.get('/api/products', (req, res) => {
  const products = Object.values(readJson('products.json', {}));
  res.json({ success: true, products: isStaffUser(req) ? products : products.map(publicProduct) });
});

app.post('/api/products', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || (!user.isAdmin && !user.isStaff)) return res.status(403).json({ error: 'Huna ruhusa' });
  const { name, type, price, emoji, desc, downloadLink, downloadLabel, imageUrl, trailerUrl, category, section, accountUser, accountPassword, free, platform, links, specs, features, requirements } = req.body;
  const isFree = free === true || free === 'true';
  if (!name || (!price && !isFree)) return res.status(400).json({ error: 'Jaza jina na bei (au weka Free)' });
  const products = readJson('products.json', {});
  const id = 'p' + Date.now() + crypto.randomBytes(2).toString('hex');   // random suffix: hakuna mgongano wa id
  const plat = PLATFORM_KEYS.includes(String(platform || '').toLowerCase()) ? String(platform).toLowerCase() : '';
  products[id] = { id, name, type: type || 'Bidhaa', price: isFree ? 0 : Number(price), emoji: emoji || '🎮', desc: cleanBody(desc, 3000), downloadLink: downloadLink || '', imageUrl: imageUrl || '', trailerUrl: trailerUrl || '', category: category || 'Zote', section: section || 'shop', accountUser: accountUser || '', accountPassword: accountPassword || '', free: isFree, platform: plat, links: cleanLinks(links), specs: String(specs || '').slice(0, 600), downloadLabel: cleanPublicText(downloadLabel, 40), features: cleanLines(features, 10, 140), requirements: cleanRequirements(requirements) };
  const saved = await writeJson('products.json', products);
  res.json({ success: true, id, persistent: saved.cloud !== false });
});

app.put('/api/products/:id', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || (!user.isAdmin && !user.isStaff)) return res.status(403).json({ error: 'Huna ruhusa' });
  const products = readJson('products.json', {});
  const existing = products[req.params.id];
  if (!existing) return res.status(404).json({ error: 'Bidhaa haipatikani' });
  const { name, type, price, emoji, desc, downloadLink, downloadLabel, imageUrl, trailerUrl, category, section, accountUser, accountPassword, free, platform, links, specs, features, requirements } = req.body;
  const isFree = free === undefined ? !!existing.free : (free === true || free === 'true');
  const plat = platform === undefined ? (existing.platform || '') : (PLATFORM_KEYS.includes(String(platform).toLowerCase()) ? String(platform).toLowerCase() : '');
  products[req.params.id] = {
    ...existing,
    name: name || existing.name, type: type || existing.type,
    price: isFree ? 0 : (price ? Number(price) : existing.price),
    emoji: emoji || existing.emoji,
    desc: desc !== undefined ? cleanBody(desc, 3000) : existing.desc,
    downloadLink: downloadLink !== undefined ? downloadLink : existing.downloadLink,
    imageUrl: imageUrl !== undefined ? imageUrl : existing.imageUrl,
    trailerUrl: trailerUrl !== undefined ? trailerUrl : existing.trailerUrl,
    category: category || existing.category || 'Zote',
    section: section || existing.section || 'shop',
    accountUser: accountUser !== undefined ? accountUser : existing.accountUser,
    accountPassword: accountPassword !== undefined ? accountPassword : existing.accountPassword,
    free: isFree, platform: plat,
    downloadLabel: downloadLabel !== undefined ? cleanPublicText(downloadLabel, 40) : (existing.downloadLabel || ''),
    features: features !== undefined ? cleanLines(features, 10, 140) : (existing.features || []),
    requirements: requirements !== undefined ? cleanRequirements(requirements) : (existing.requirements || { minimum: [], recommended: [] }),
    links: links !== undefined ? cleanLinks(links) : (existing.links || []),
    specs: specs !== undefined ? String(specs).slice(0, 600) : (existing.specs || '')
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
  const out = {};
  for (const [k, c] of Object.entries(readJson('coupons.json', {}))) { const n = normCoupon(c); out[k] = { ...n, appliesText: couponAppliesText(n) }; }
  res.json({ success: true, coupons: out });
});

app.post('/api/admin/coupons', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const b = req.body || {};
  const code = String(b.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return res.status(400).json({ error: 'Kodi iwe herufi/namba 3–24 (mf. GAME20), bila nafasi' });
  const type = b.type === 'fixed' ? 'fixed' : 'percent';
  const value = Number(b.value ?? b.percentOff);
  if (type === 'percent' && !(value >= 1 && value <= 90)) return res.status(400).json({ error: 'Punguzo % liwe kati ya 1 na 90' });
  if (type === 'fixed' && !(value >= 100 && value <= 1000000)) return res.status(400).json({ error: 'Kiasi cha punguzo kiwe kati ya 100 na 1,000,000 TZS' });
  const scope = ['platform', 'products'].includes(b.scope) ? b.scope : 'all';
  const platforms = (Array.isArray(b.platforms) ? b.platforms : []).filter(k => PLATFORM_KEYS.includes(k));
  const products = readJson('products.json', {});
  const productIds = (Array.isArray(b.productIds) ? b.productIds : []).map(String).filter(id => products[id]).slice(0, 200);
  if (scope === 'platform' && !platforms.length) return res.status(400).json({ error: 'Chagua angalau platform moja ya gaming' });
  if (scope === 'products' && !productIds.length) return res.status(400).json({ error: 'Chagua angalau game moja' });
  let expiresAt = '';
  if (b.expiresAt) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.expiresAt)) || isNaN(new Date(b.expiresAt).getTime())) return res.status(400).json({ error: 'Tarehe ya mwisho si sahihi' });
    expiresAt = String(b.expiresAt);
  }
  const maxUses = b.maxUses ? Math.max(1, Math.min(1000000, parseInt(b.maxUses, 10) || 0)) || null : null;
  const minTotal = Math.max(0, Math.min(10000000, Number(b.minTotal) || 0));
  const coupons = readJson('coupons.json', {});
  coupons[code] = { code, type, value, percentOff: type === 'percent' ? value : 0, scope, platforms: scope === 'platform' ? platforms : [], productIds: scope === 'products' ? productIds : [], expiresAt, maxUses, minTotal, uses: (coupons[code] && coupons[code].uses) || 0, active: true, createdAt: (coupons[code] && coupons[code].createdAt) || new Date().toISOString() };
  await writeJson('coupons.json', coupons);
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
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza kutumia kodi ya punguzo' });
  const { code, items, shipping } = req.body || {};
  const c = lookupCoupon(code);
  if (!c) return res.status(404).json({ error: 'Kodi si sahihi, imeisha muda au imeisha kutumika' });
  const out = { success: true, code: c.code, type: c.type, value: c.value, percentOff: c.percentOff, appliesTo: couponAppliesText(c) };
  if (Array.isArray(items) && items.length) {      // hesabu punguzo halisi kwa kikapu hiki (matumizi yanahesabiwa wakati wa kulipa, si hapa)
    const calc = priceCart(items, c.code, shipping);
    if (calc.error) return res.status(400).json({ error: calc.error });
    out.discountAmount = calc.discount; out.subtotal = calc.subtotal; out.total = calc.total;
  }
  res.json(out);
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
  res.json({ success: true, users: Object.values(users).map(({ password, providerId, ...u }) => u) });
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
  for (const ip in (data.blocked || {})) { if (data.blocked[ip] > now) activeBlocks[ip] = data.blocked[ip]; }
  res.json({ success: true, stats: { totalEvents: data.events.length, high: data.events.filter(e => e.severity === 'HIGH').length, medium: data.events.filter(e => e.severity === 'MEDIUM').length, low: data.events.filter(e => e.severity === 'LOW').length, blockedIPs: Object.keys(activeBlocks).length }, blocked: activeBlocks });
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
  delete data.blocked[ip];
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

// ═══════════════════════════════════════════════════════════════
// ⚡ CLICKPESA PAYMENTS
// ═══════════════════════════════════════════════════════════════
const CLICKPESA_BASE = 'https://api.clickpesa.com/third-parties';
let clickpesaTokenCache = { token: null, expiresAt: 0 };

async function getClickPesaToken(force) {
  if (!force && clickpesaTokenCache.token && Date.now() < clickpesaTokenCache.expiresAt - 60_000) {
    return clickpesaTokenCache.token;
  }
  if (!process.env.CLICKPESA_CLIENT_ID || !process.env.CLICKPESA_API_KEY) throw new Error('ClickPesa haijawekwa (CLICKPESA_CLIENT_ID / CLICKPESA_API_KEY)');
  const r = await fetch(CLICKPESA_BASE + '/generate-token', {
    method: 'POST',
    headers: { 'client-id': process.env.CLICKPESA_CLIENT_ID, 'api-key': process.env.CLICKPESA_API_KEY }
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.token) throw new Error('ClickPesa: imeshindwa kupata token — ' + (data.message || ('HTTP ' + r.status)));
  clickpesaTokenCache = { token: data.token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return clickpesaTokenCache.token;
}

// 💰 BEI HUHESABIWA NA SERVER — hatuamini bei/total kutoka kwa mteja
const SHIPPING_FEE = 5000;
const RENTAL_PACKAGES = { 20: 300, 50: 500, 120: 1000 };
function rentalPriceServer(minutes) {
  const m = parseInt(minutes, 10);
  if (!m || m < 1 || m > 1440) return 0;
  if (RENTAL_PACKAGES[m]) return RENTAL_PACKAGES[m];
  const rate = m <= 20 ? 15 : m <= 50 ? 10 : 8;
  return Math.round(m * rate / 100) * 100;
}
// 🎟️ KUPONI: punguzo la % au kiasi (TZS), kwa bidhaa zote / platform za gaming / games ulizochagua
function detectProductPlatform(p) {
  if (p.platform) return String(p.platform);
  const t = [p.category, p.type, p.name].join(' ').toLowerCase();
  if (/winlator|gamehub/.test(t)) return 'winlator';
  const R = [['cloud', /cloud|geforce|xcloud|game ?pass|\bluna\b|shadow pc/], ['psp', /\bpsp\b|ppsspp/], ['ps2', /\bps2\b|playstation ?2/], ['ps3', /\bps3\b|playstation ?3/], ['switch', /switch|nintendo/], ['android', /android|mobile|simu/], ['pc', /\bpc\b|steam|windows/]];
  for (const [k, re] of R) if (re.test(t)) return k;
  return '';
}
const PLATFORM_LABELS = { psp: 'PSP', ps2: 'PS2', ps3: 'PS3', switch: 'Nintendo Switch', android: 'Android', cloud: 'Cloud Gaming', pc: 'PC', winlator: 'Winlator' };
function normCoupon(c) {
  if (!c) return null;
  const type = c.type === 'fixed' ? 'fixed' : 'percent';
  const value = Number(type === 'percent' ? (c.value ?? c.percentOff) : c.value) || 0;
  return { ...c, type, value, percentOff: type === 'percent' ? value : 0, scope: ['platform', 'products'].includes(c.scope) ? c.scope : 'all', productIds: Array.isArray(c.productIds) ? c.productIds : [], platforms: Array.isArray(c.platforms) ? c.platforms : [], minTotal: Number(c.minTotal) || 0 };
}
function couponAppliesText(c) {
  if (c.scope === 'platform') return 'games za ' + c.platforms.map(k => PLATFORM_LABELS[k] || k).join(', ');
  if (c.scope === 'products') return 'games ulizochagua (' + c.productIds.length + ')';
  return 'bidhaa zote';
}
function couponEligible(c, product) {
  if (c.scope === 'all') return true;
  if (!product) return false;                      // kukodi muda (rental) haingii kwenye punguzo la games
  if (c.scope === 'products') return c.productIds.includes(product.id);
  if (c.scope === 'platform') return c.platforms.includes(detectProductPlatform(product));
  return false;
}
function lookupCoupon(code) {
  const key = String(code || '').trim().toUpperCase();
  if (!key) return null;
  const c = normCoupon(readJson('coupons.json', {})[key]);
  if (!c || !c.active) return null;
  if (c.maxUses && c.uses >= c.maxUses) return null;
  if (c.expiresAt && new Date(c.expiresAt + 'T23:59:59').getTime() < Date.now()) return null;
  return c;
}
function priceCart(items, couponCode, wantsShipping) {
  if (!Array.isArray(items) || !items.length) return { error: 'Kikapu ni tupu' };
  if (items.length > 30) return { error: 'Kikapu kina bidhaa nyingi mno' };
  const products = readJson('products.json', {});
  let subtotal = 0; const clean = [], lines = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') return { error: 'Kikapu si sahihi' };
    const qty = Math.max(1, Math.min(20, parseInt(it.qty ?? it.quantity ?? 1, 10) || 1));
    let unit, row, product = null;
    if (it.rentalMinutes) {
      const m = parseInt(it.rentalMinutes, 10);
      unit = rentalPriceServer(m);
      if (!unit) return { error: 'Muda wa kukodi si sahihi' };
      row = { id: 'rental-' + m, name: cleanPublicText(it.name, 60) || ('Kukodi dakika ' + m), emoji: '⏱️', rentalMinutes: m };
    } else {
      product = products[String(it.id)];
      if (!product) return { error: 'Bidhaa "' + cleanPublicText(it.name || it.id, 60) + '" haipatikani tena. Iondoe kwenye kikapu.' };
      if (product.free) return { error: '"' + product.name + '" ni FREE — pakua moja kwa moja kwenye Free Games.' };
      unit = Number(product.price);
      row = { id: product.id, name: product.name, emoji: product.emoji || '🎮', imageUrl: product.imageUrl || '' };
    }
    if (!(unit > 0)) return { error: 'Bei ya bidhaa si sahihi' };
    subtotal += unit * qty; lines.push({ unit, qty, product });
    clean.push({ ...row, num: unit, price: unit.toLocaleString() + ' TZS', qty });
  }
  let discount = 0, couponOut = '', couponInfo = null;
  if (String(couponCode || '').trim()) {
    const c = lookupCoupon(couponCode);
    if (!c) return { error: 'Kodi si sahihi, imeisha muda au imeisha kutumika' };
    if (c.minTotal && subtotal < c.minTotal) return { error: 'Kodi hii inahitaji manunuzi ya angalau ' + c.minTotal.toLocaleString() + ' TZS' };
    let eligible = 0;
    for (const l of lines) if (couponEligible(c, l.product)) eligible += l.unit * l.qty;
    if (!eligible) return { error: 'Kodi hii inatumika kwa ' + couponAppliesText(c) + ' tu — haipo kwenye kikapu chako.' };
    discount = c.type === 'fixed' ? Math.min(Math.round(c.value), eligible) : Math.round(eligible * Math.max(0, Math.min(90, c.value)) / 100);
    couponOut = c.code;
    couponInfo = { code: c.code, type: c.type, value: c.value, appliesTo: couponAppliesText(c) };
  }
  const shipping = wantsShipping === true || wantsShipping === 'true' ? SHIPPING_FEE : 0;
  const total = Math.max(0, subtotal - discount) + shipping;
  if (total < 100) return { error: 'Jumla ya malipo ni ndogo mno' };
  return { items: clean, subtotal, discount, total, shipping, couponCode: couponOut, couponInfo };
}
async function useCoupon(code) {
  if (!code) return;
  const coupons = readJson('coupons.json', {});
  if (coupons[code]) { coupons[code].uses = (coupons[code].uses || 0) + 1; await writeJson('coupons.json', coupons); }
}

// ⚡ UTHIBITISHO WA MALIPO YA CLICKPESA (tabaka 3: webhook iliyosainiwa → kuuliza ClickPesa → admin kwa mkono)
// Hali za ClickPesa: PROCESSING → SUCCESS/SETTLED au FAILED. Kuuliza kwa orderReference kunarudisha ORODHA ya majaribio.
const CP_OK = ['SUCCESS', 'SETTLED', 'COMPLETED', 'PAID'];
const CP_FAIL = ['FAILED', 'CANCELLED', 'CANCELED', 'REJECTED', 'EXPIRED'];
const cpState = { lastQueryAt: 0, lastQueryError: '' };
const cpAuth = t => (/^Bearer\s/i.test(String(t)) ? String(t) : 'Bearer ' + t);

async function queryClickPesa(orderRef) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let token;
    try { token = await getClickPesaToken(attempt > 0); } catch (e) { return { error: e.message }; }
    let r;
    try { r = await fetch(CLICKPESA_BASE + '/payments/' + encodeURIComponent(orderRef), { headers: { 'Authorization': cpAuth(token) } }); }
    catch (e) { return { error: 'Mtandao: ' + e.message }; }
    if ((r.status === 401 || r.status === 403) && attempt === 0) continue;       // token mpya kisha jaribu tena
    const text = await r.text(); let data = null; try { data = JSON.parse(text); } catch (e) {}
    if (r.status === 404) return { attempts: [], http: 404 };
    if (!r.ok) return { error: 'ClickPesa HTTP ' + r.status + ': ' + String(text).slice(0, 120), http: r.status };
    const arr = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : (data && data.data && typeof data.data === 'object' ? [data.data] : (data && typeof data === 'object' ? [data] : [])));
    const attempts = arr.filter(x => x && typeof x === 'object' && x.status).map(x => ({ status: String(x.status).toUpperCase(), amount: x.collectedAmount != null ? Number(x.collectedAmount) : (x.amount != null ? Number(x.amount) : NaN), ref: x.paymentReference || x.id || '' }));
    return { attempts, http: r.status };
  }
  return { error: 'ClickPesa: token imekataliwa' };
}
function classifyPayment(attempts, order) {
  if (!attempts.length) return { state: 'pending', note: 'ClickPesa bado haijaona malipo.' };
  const need = Number(order.amount) || 0;
  const okA = attempts.filter(a => CP_OK.includes(a.status));
  if (okA.length) {
    const good = okA.find(a => Number.isNaN(a.amount) || a.amount >= need - 5);
    if (good) return { state: 'success', note: '', ref: good.ref };
    return { state: 'mismatch', note: 'Kiasi kilicholipwa (' + okA[0].amount + ' TZS) ni kidogo kuliko ' + need + ' TZS.' };
  }
  if (attempts.every(a => CP_FAIL.includes(a.status))) return { state: 'failed', note: 'ClickPesa: ' + attempts[attempts.length - 1].status };
  return { state: 'pending', note: 'ClickPesa: ' + attempts.map(a => a.status).join(', ') };
}
// trusted = { status, amount } kutoka webhook iliyothibitishwa kwa checksum; force = admin anaangalia upya hata order iliyoshindwa
async function settleClickPesaOrder(orderRef, ip, trusted, force) {
  let order = readJson('orders.json', []).find(o => o.tx_ref === orderRef && o.provider === 'ClickPesa');
  if (!order || order.status === 'successful') return order || null;
  if (!force && order.status !== 'pending_clickpesa') return order;
  let result, via;
  if (trusted) { result = classifyPayment([{ status: String(trusted.status || '').toUpperCase(), amount: Number(trusted.amount) }], order); via = 'webhook'; }
  else {
    const q = await queryClickPesa(orderRef); via = 'api';
    cpState.lastQueryAt = Date.now(); cpState.lastQueryError = q.error || '';
    result = q.error ? { state: 'unknown', note: q.error } : classifyPayment(q.attempts, order);
    result.attempts = q.attempts || [];
  }
  const all = readJson('orders.json', []); const o = all.find(x => x.tx_ref === orderRef);
  if (!o || o.status === 'successful') return o || null;
  o.lastCheckedAt = new Date().toISOString(); o.checkCount = (o.checkCount || 0) + 1; o.verifyNote = result.note || ''; o.providerStatus = (result.attempts || []).map(a => a.status).join(',');
  if (result.state === 'success') { o.status = 'successful'; o.confirmedAt = new Date().toISOString(); o.confirmedVia = via; o.clickpesaRef = result.ref || o.clickpesaRef || null; logSecurity('CLICKPESA_PAYMENT_CONFIRMED', 'Malipo yamethibitishwa (' + via + '): ' + orderRef, 'LOW', ip); }
  else if (result.state === 'mismatch') o.status = 'amount_mismatch';
  else if (result.state === 'failed') o.status = 'failed';
  else if (result.state === 'unknown') logSecurity('CLICKPESA_UNVERIFIED', 'Imeshindwa kuthibitisha ' + orderRef + ': ' + result.note, 'MEDIUM', ip);
  await writeJson('orders.json', all);
  return o;
}

// 🔏 Checksum ya webhook (nyaraka za ClickPesa): ondoa checksum/checksumMethod, panga keys kwa alfabeti (recursive), JSON compact, HMAC-SHA256 hex
function cpCanonical(o) {
  if (o === null || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map(cpCanonical);
  return Object.keys(o).sort().reduce((a, k) => { a[k] = cpCanonical(o[k]); return a; }, {});
}
function verifyCpChecksum(body) {   // true = sahihi, false = si sahihi, null = haikuweza kukaguliwa
  const key = process.env.CLICKPESA_CHECKSUM_KEY;
  if (!key || !body || typeof body.checksum !== 'string') return null;
  if (body.checksumMethod && body.checksumMethod !== 'canonical') return null;
  const { checksum, checksumMethod, ...rest } = body;
  const expect = Buffer.from(crypto.createHmac('sha256', key).update(JSON.stringify(cpCanonical(rest))).digest('hex'));
  const got = Buffer.from(String(checksum));
  return expect.length === got.length && crypto.timingSafeEqual(expect, got);
}

// 🔄 Reconciler: kila sekunde 30 inakagua orders za ClickPesa zinazosubiri (hata mteja akifunga ukurasa au webhook isipofika)
let cpReconciling = false;
async function reconcileClickPesa() {
  if (cpReconciling || !process.env.CLICKPESA_CLIENT_ID || !process.env.CLICKPESA_API_KEY) return;
  cpReconciling = true;
  try {
    const now = Date.now(); let n = 0;
    for (const o of readJson('orders.json', []).filter(x => x.provider === 'ClickPesa' && x.status === 'pending_clickpesa')) {
      const age = now - new Date(o.date).getTime(); if (age > 7 * 86400e3) continue;
      const last = o.lastCheckedAt ? new Date(o.lastCheckedAt).getTime() : 0;
      const every = age < 2 * 3600e3 ? 40e3 : (age < 24 * 3600e3 ? 10 * 60e3 : 60 * 60e3);
      if (now - last < every) continue;
      if (++n > 15) break;
      await settleClickPesaOrder(o.tx_ref, 'reconciler');
    }
  } catch (e) { console.error('ClickPesa reconcile error:', e.message); }
  finally { cpReconciling = false; }
}
setInterval(() => { reconcileClickPesa(); }, 30000).unref();
if (process.env.NODE_ENV === 'test') global.__zpTest = { reconcileClickPesa };

app.post('/api/clickpesa-pay', async (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza kulipa' });
  try {
    const { items, phone, name, coupon, shipping } = req.body;
    const calc = priceCart(items, coupon, shipping);
    if (calc.error) return res.status(400).json({ error: calc.error });
    if (!phone) return res.status(400).json({ error: 'Weka namba ya simu' });
    let phoneFull = String(phone).replace(/\D/g, '');
    if (!phoneFull.startsWith('255')) phoneFull = '255' + phoneFull.replace(/^0/, '');
    if (phoneFull.length !== 12) return res.status(400).json({ error: 'Namba ya simu si sahihi. Mfano: 0786095758' });
    const orderReference = 'GH' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(4).toString('hex').toUpperCase();
    const orders = readJson('orders.json', []);
    const inFlight = orders.find(o => o.customer === user.email && o.provider === 'ClickPesa' && o.status === 'pending_clickpesa' && Date.now() - new Date(o.date).getTime() < 120000);
    if (inFlight) return res.status(409).json({ error: 'Una malipo yanayoendelea. Ingiza PIN kwenye simu yako, au subiri dakika 2 kabla ya kujaribu tena — usilipe mara mbili.', tx_ref: inFlight.tx_ref });
    orders.push({ tx_ref: orderReference, customer: user.email, customerPhone: phoneFull, customerName: cleanPublicText(name || user.name, 80), amount: calc.total, subtotal: calc.subtotal, discount: calc.discount, coupon: calc.couponCode, shipping: calc.shipping, items: calc.items, provider: 'ClickPesa', status: 'pending_clickpesa', date: new Date().toISOString() });
    await writeJson('orders.json', orders);
    await useCoupon(calc.couponCode);
    const token = await getClickPesaToken();
    const body = JSON.stringify({ amount: String(calc.total), currency: 'TZS', orderReference, phoneNumber: phoneFull });
    const headers = { 'Authorization': token, 'Content-Type': 'application/json' };
    const previewRes = await fetch(CLICKPESA_BASE + '/payments/preview-ussd-push-request', { method: 'POST', headers, body });
    const previewData = await previewRes.json();
    if (!previewRes.ok || previewData.success === false) { console.error('ClickPesa preview error:', previewData); return res.status(400).json({ error: 'ClickPesa: ' + (previewData.message || 'Malipo hayakuanza') }); }
    const payRes = await fetch(CLICKPESA_BASE + '/payments/initiate-ussd-push-request', { method: 'POST', headers, body });
    const payData = await payRes.json();
    if (!payRes.ok || payData.success === false) {
      console.error('ClickPesa payment error:', payData);
      const all = readJson('orders.json', []);
      const o = all.find(x => x.tx_ref === orderReference);
      if (o) { o.status = 'failed_to_start'; await writeJson('orders.json', all); }
      return res.status(400).json({ error: 'ClickPesa: ' + (payData.message || 'Malipo hayakuanza') });
    }
    res.json({ success: true, tx_ref: orderReference, provider: 'ClickPesa', amount: calc.total, transactionId: payData.id || null });
  } catch (err) { console.error('ClickPesa error:', err); res.status(500).json({ error: 'Server error: ' + err.message }); }
});

// Webhook ya ClickPesa. Ikiwa na checksum sahihi (CLICKPESA_CHECKSUM_KEY) inaaminiwa; vinginevyo inatumika kuamsha ukaguzi wa moja kwa moja kwa ClickPesa.
app.post('/api/clickpesa-webhook', async (req, res) => {
  try {
    const body = req.body || {}, d = body.data || {};
    const ref = String(d.orderReference || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 60);
    const check = verifyCpChecksum(body);
    logSecurity('CLICKPESA_WEBHOOK', String(body.event || '?').slice(0, 30) + ' ' + ref + ' checksum=' + (check === null ? 'n/a' : check ? 'ok' : 'BAD'), check === false ? 'HIGH' : 'LOW', getIP(req));
    if (ref && (body.event === 'PAYMENT RECEIVED' || body.event === 'PAYMENT FAILED')) {
      const trusted = check === true ? { status: d.status, amount: d.collectedAmount } : null;
      await settleClickPesaOrder(ref, getIP(req), trusted);
    }
    res.json({ success: true });
  } catch (err) { console.error('ClickPesa webhook error:', err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/clickpesa-check/:ref', async (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza' });
  const find = () => readJson('orders.json', []).find(x => x.tx_ref === req.params.ref && x.customer === user.email);
  let o = find();
  if (!o) return res.status(404).json({ error: 'Order haipatikani' });
  if (o.status === 'pending_clickpesa' && (!o.lastCheckedAt || Date.now() - new Date(o.lastCheckedAt).getTime() > 4000)) { await settleClickPesaOrder(o.tx_ref, getIP(req)); o = find() || o; }
  const st = o.status === 'successful' ? 'successful' : (o.status === 'failed' || o.status === 'failed_to_start' ? 'failed' : o.status === 'amount_mismatch' ? 'amount_mismatch' : 'pending');
  res.json({ success: true, status: st, waitingSeconds: Math.round((Date.now() - new Date(o.date).getTime()) / 1000) });
});

// 🔎 Admin: angalia upya order ya ClickPesa (inaonyesha ClickPesa inasema nini hasa)
app.post('/api/admin/orders/verify', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const ref = String(req.body && req.body.tx_ref || '');
  const order = readJson('orders.json', []).find(o => o.tx_ref === ref);
  if (!order || order.provider !== 'ClickPesa') return res.status(404).json({ error: 'Order ya ClickPesa haipatikani' });
  const q = await queryClickPesa(ref);
  const o = await settleClickPesaOrder(ref, getIP(req), null, true);
  res.json({ success: true, status: o ? o.status : order.status, queryError: q.error || '', http: q.http || null, providerStatuses: (q.attempts || []).map(a => a.status + (Number.isNaN(a.amount) ? '' : ' ' + a.amount)), note: o ? o.verifyNote || '' : '' });
});

// 🩺 Admin: hali ya mfumo wa malipo ya auto (kwa nini order zinasubiri?)
app.get('/api/admin/payment-diagnostics', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const cfg = { clientId: !!process.env.CLICKPESA_CLIENT_ID, apiKey: !!process.env.CLICKPESA_API_KEY, checksumKey: !!process.env.CLICKPESA_CHECKSUM_KEY };
  const token = { ok: false, note: '' };
  if (cfg.clientId && cfg.apiKey) { try { await getClickPesaToken(true); token.ok = true; } catch (e) { token.note = e.message; } } else token.note = 'CLICKPESA_CLIENT_ID / CLICKPESA_API_KEY hazijawekwa kwenye Render';
  const cp = readJson('orders.json', []).filter(o => o.provider === 'ClickPesa');
  let queryTest = null; const sample = cp.slice(-1)[0];
  if (sample && token.ok) { const q = await queryClickPesa(sample.tx_ref); queryTest = { ref: sample.tx_ref, http: q.http || null, error: q.error || '', statuses: (q.attempts || []).map(a => a.status) }; }
  const events = (readJson(securityFile, { events: [] }).events || []).filter(e => e.type === 'CLICKPESA_WEBHOOK');
  const lastWh = events[events.length - 1] || null;
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  res.json({ success: true, config: cfg, token, queryTest,
    webhook: { url: (req.headers['x-forwarded-proto'] || 'https') + '://' + host + '/api/clickpesa-webhook', lastAt: lastWh ? lastWh.time : null, lastInfo: lastWh ? lastWh.details : null, received: events.length },
    orders: { total: cp.length, successful: cp.filter(o => o.status === 'successful').length, pending: cp.filter(o => o.status === 'pending_clickpesa').length, pendingOver10Min: cp.filter(o => o.status === 'pending_clickpesa' && Date.now() - new Date(o.date).getTime() > 600000).length, failed: cp.filter(o => o.status === 'failed' || o.status === 'failed_to_start').length },
    lastQueryError: cpState.lastQueryError || '' });
});

// 💵 MALIPO YA MANUAL — mteja anatuma pesa, anaandika Tx Ref + kiasi, admin anathibitisha
app.post('/api/manual-pay', async (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza kutuma ripoti ya malipo' });
  const { items, txRef, phone, coupon, shipping, paidAmount, payNetwork } = req.body;
  const calc = priceCart(items, coupon, shipping);
  if (calc.error) return res.status(400).json({ error: calc.error });
  const ref = cleanPublicText(txRef, 40);
  if (!/^[A-Za-z0-9._-]{5,40}$/.test(ref)) return res.status(400).json({ error: 'Namba ya muamala (Tx Ref) si sahihi. Ichukue kwenye SMS ya malipo (herufi/namba 5–40, bila nafasi).' });
  let ph = String(phone || '').replace(/\D/g, ''); if (!ph.startsWith('255')) ph = '255' + ph.replace(/^0/, '');
  if (ph.length !== 12) return res.status(400).json({ error: 'Namba ya simu uliyotumia kulipa si sahihi. Mfano: 0786095758' });
  let claimed = calc.total;
  if (paidAmount !== undefined && paidAmount !== '') {
    claimed = Math.floor(Number(paidAmount));
    if (!(claimed >= calc.total)) return res.status(400).json({ error: 'Kiasi ulicholipa kiwe angalau ' + calc.total.toLocaleString() + ' TZS (jumla ya order hii).' });
  }
  const orders = readJson('orders.json', []);
  if (orders.some(o => o.manualTxRef && o.manualTxRef.toLowerCase() === ref.toLowerCase())) return res.status(409).json({ error: 'Namba hii ya muamala tayari imetumika kwenye order nyingine.' });
  if (orders.filter(o => o.customer === user.email && o.status === 'pending_manual').length >= 5) return res.status(429).json({ error: 'Una ripoti 5 zinazosubiri uthibitisho. Subiri admin azithibitishe.' });
  const orderRef = 'MANUAL-' + Date.now() + crypto.randomBytes(2).toString('hex');
  orders.push({ tx_ref: orderRef, customer: user.email, customerName: user.name, customerPhone: ph, manualTxRef: ref, claimedAmount: claimed, payNetwork: cleanPublicText(payNetwork, 30), amount: calc.total, subtotal: calc.subtotal, discount: calc.discount, coupon: calc.couponCode, shipping: calc.shipping, items: calc.items, status: 'pending_manual', date: new Date().toISOString() });
  await writeJson('orders.json', orders);
  await useCoupon(calc.couponCode);
  logSecurity('MANUAL_PAYMENT_SUBMITTED', 'Ripoti ya malipo manual kutoka ' + user.email, 'LOW', getIP(req));
  res.json({ success: true, message: '✅ Ripoti imepokelewa! Admin atahakiki malipo (kwa kawaida ndani ya saa chache). Download yako itaonekana kwenye "My Orders" ikishathibitishwa.', tx_ref: orderRef, amount: calc.total });
});

app.post('/api/admin/orders/confirm', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { tx_ref } = req.body;
  const orders = readJson('orders.json', []);
  const order = orders.find(o => o.tx_ref === tx_ref);
  if (!order) return res.status(404).json({ error: 'Order haipatikani' });
  if (order.status === 'successful') return res.json({ success: true, message: 'Order hii tayari imethibitishwa.' });
  order.status = 'successful';
  order.confirmedAt = new Date().toISOString(); order.confirmedBy = user.email; order.confirmedVia = order.confirmedVia || 'admin';
  delete order.rejectReason;
  await writeJson('orders.json', orders);
  logSecurity('MANUAL_PAYMENT_CONFIRMED', 'Admin ' + user.email + ' amethibitisha: ' + tx_ref, 'LOW', getIP(req));
  res.json({ success: true, message: '✅ Malipo yamethibitishwa. Mteja ataona download yake kwenye My Orders.' });
});

app.post('/api/admin/orders/reject', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { tx_ref, reason } = req.body;
  const orders = readJson
