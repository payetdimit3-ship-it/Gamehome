require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();

app.set('trust proxy', 1);

// ==================== SECURITY MIDDLEWARE ====================
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 
  'http://localhost:3000,http://localhost:5500,https://payetdimit3-ship-it.github.io,https://kelvingamingtz.com,https://www.kelvingamingtz.com'
).split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
      return callback(null, true);
    }
    console.warn('CORS blocked:', origin);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 1000,
  message: { error: 'Maombi mengi. Subiri kidogo.' },
  standardHeaders: true, legacyHeaders: false,
  skip: (req) => {
    const skip = ['/api/products','/api/tournaments','/api/live-streams','/api/movies','/api/courses','/api/banners','/api/public-chat/messages','/api/live-scores'];
    return skip.some(p => req.path.startsWith(p));
  }
});
const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Majaribio mengi. Subiri dakika 1.' } });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, message: { error: 'AI requests mengi.' } });

app.use('/api/auth/login', loginLimiter);
app.use('/api/ai/', aiLimiter);
app.use('/api/', apiLimiter);

console.log('Security middleware imewekwa');

// ==================== MEDIA STORAGE ====================
const MEDIA_DIR = path.join(__dirname, 'uploads');
const TMP_MEDIA_DIR = path.join(MEDIA_DIR, 'tmp');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
if (!fs.existsSync(TMP_MEDIA_DIR)) fs.mkdirSync(TMP_MEDIA_DIR, { recursive: true });

app.use('/uploads', express.static(MEDIA_DIR, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (/\.(html?|js|mjs|php|asp|jsp|cgi)$/i.test(filePath)) {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }
}));

// ==================== SERVE WEBSITE (MPYA!) ====================
// Hii inaruhusu Render ionyeshe website yako (index.html, store.html, n.k.)
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.use(express.static(path.join(__dirname), {
  index: 'index.html',
  setHeaders: (res, filePath) => {
    // Zuia faili za siri zisionekane
    if (/\.env$|\.data\/|server\.js$|package\.json$/i.test(filePath)) {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }
}));

// ==================== MULTER ====================
const upload = multer({
  dest: TMP_MEDIA_DIR,
  limits: { fileSize: 1024 * 1024 * 1024, files: 1 },
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

// ==================== SUPABASE CLIENT SETUP ====================
let supabase = null;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log('Supabase imeunganishwa');
} else {
  console.log('Supabase HAIJAWEKWA - data itapotea kila deploy!');
}

async function ensureMediaBucket() {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.storage.getBucket(MEDIA_BUCKET);
    if (!error && data) return true;
    const created = await supabase.storage.createBucket(MEDIA_BUCKET, { public: true });
    if (created.error && !/already exists|duplicate/i.test(created.error.message || '')) return false;
    console.log('Bucket iko tayari: ' + MEDIA_BUCKET);
    return true;
  } catch (e) { return false; }
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
      const buffer = fs.readFileSync(localPath);
      const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(objectPath, buffer, {
        contentType: file.mimetype || 'video/mp4', upsert: false, cacheControl: '3600'
      });
      if (!error) {
        const pub = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath);
        return { url: pub.data.publicUrl, storage: 'supabase', path: objectPath, filename };
      }
      throw new Error('Supabase Storage imekataa: ' + error.message);
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

// ==================== ROOT + HEALTH ====================
// ROOT - Inaonyesha index.html kama ipo. La sivyo, JSON.
app.get('/', (req, res) => {
  const candidates = [
    path.join(__dirname, 'public', 'index.html'),
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'home.html')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return res.sendFile(p);
  }
  res.json({
    success: true,
    app: 'Kelvin Gaming TZ API',
    version: '3.2',
    status: 'online',
    time: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    supabase: !!supabase
  });
});

// ==================== DATA STORAGE ====================
const DATA_DIR = path.join(__dirname, '.data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const TRACKED_FILES = [
  'users.json', 'sessions.json', 'products.json', 'orders.json',
  'requests.json', 'security.json', 'marketplace.json', 'coupons.json',
  'reviews.json', 'matches.json', 'tournaments.json', 'live_streams.json',
  'courses.json', 'movies.json', 'media.json', 'ai_builder_runs.json',
  'banners.json', 'settings.json', 'public_chat.json', 'health_chats.json',
  'boss_approvals.json'
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
  const tmpPath = filePath + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, filePath);
  } catch (e) {
    console.error('Write error (' + file + '):', e.message);
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) {}
    return { local: false, cloud: false, error: e.message };
  }
  if (!supabase) return { local: true, cloud: false };
  try {
    const { error } = await supabase.from(process.env.SUPABASE_KV_TABLE || 'kv_store').upsert({
      file_name: file, data, updated_at: new Date().toISOString()
    });
    if (error) { console.error('Supabase (' + file + '):', error.message); return { local: true, cloud: false, error: error.message }; }
    return { local: true, cloud: true };
  } catch (err) { return { local: true, cloud: false, error: err.message }; }
}

async function restoreFromSupabase() {
  if (!supabase) return;
  console.log('Inarudisha data...');
  const results = await Promise.allSettled(
    TRACKED_FILES.map(async (file) => {
      const { data, error } = await supabase.from(process.env.SUPABASE_KV_TABLE || 'kv_store').select('data').eq('file_name', file).maybeSingle();
      if (!error && data && data.data !== undefined) {
        fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data.data, null, 2));
        return file;
      }
      return null;
    })
  );
  const restored = results.filter(r => r.status === 'fulfilled' && r.value).length;
  console.log('Files ' + restored + '/' + TRACKED_FILES.length + ' zimerudishwa');
}

function ensureTournamentSeed() {
  const current = readJson('tournaments.json', null);
  if (!Array.isArray(current)) {
    writeJson('tournaments.json', [
      { id: 't1', name: 'GameHub eFootball Cup', game: 'eFootball', date: 'Tarehe itawekwa', status: 'OPEN', description: 'Mashindano ya eFootball.', registrations: [] },
      { id: 't2', name: 'GameHub FC Challenge', game: 'EA SPORTS FC', date: 'Tarehe itawekwa', status: 'OPEN', description: 'Challenge ya football gaming.', registrations: [] }
    ]);
  }
}

// ==================== PUBLIC CHAT ====================
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
  if (!publicChatAllowed(ip)) return res.status(429).json({ error: 'Subiri sekunde chache.' });
  const name = cleanPublicText(req.body?.name, 32) || 'Mgeni';
  const message = cleanPublicText(req.body?.message, 500);
  if (!message) return res.status(400).json({ error: 'Andika ujumbe kwanza.' });
  const messages = readJson('public_chat.json', []);
  const row = { id: 'chat_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'), name, message, time: new Date().toISOString() };
  messages.push(row);
  await writeJson('public_chat.json', messages.slice(-300));
  res.json({ success: true, message: row });
});

app.delete('/api/admin/public-chat/:id', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const messages = readJson('public_chat.json', []);
  await writeJson('public_chat.json', messages.filter(x => x.id !== req.params.id));
  res.json({ success: true });
});

// ==================== PASSWORD ====================
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  try {
    const computed = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computed));
  } catch (e) { return false; }
}

// ==================== LOGIN PROTECTION ====================
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

// ==================== SECURITY ====================
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
function isSuspicious(input) {
  if (!input || typeof input !== 'string') return false;
  if (input.length > 2000) return true;
  const patterns = /(union\s+select|insert\s+into|drop\s+table|delete\s+from|update\s+.*\s+set|<\s*script|javascript:|onerror\s*=|onload\s*=|<iframe|<embed|<object)/i;
  return patterns.test(input);
}

app.use('/api', (req, res, next) => {
  const ip = getIP(req);
  const data = readJson(securityFile, { events: [], blocked: {} });
  const blocked = data.blocked || {};
  if (blocked[ip] && blocked[ip] > Date.now()) {
    logSecurity('BLOCKED_REQUEST', 'IP iliyofungwa', 'MEDIUM', ip);
    return res.status(403).json({ error: 'IP yako imefungwa. Wasiliana na admin.' });
  }
  const URL_FIELDS = ['downloadLink','imageUrl','trailerUrl','videoUrl','streamUrl','poster','thumbnail','buttonUrl','url','image','gameLinks'];
  const checkItems = [req.body, req.query];
  for (const obj of checkItems) {
    if (!obj) continue;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val !== 'string') continue;
      if (URL_FIELDS.includes(key)) {
        if (val.length > 2000) {
          logSecurity('URL_TOO_LONG', 'URL ndefu: ' + key, 'MEDIUM', ip);
          return res.status(400).json({ error: 'URL ni ndefu sana.' });
        }
        continue;
      }
      if (isSuspicious(val)) {
        logSecurity('SQLI_XSS', 'Input ya mashaka: ' + key, 'HIGH', ip);
        blockIP(ip, 30);
        return res.status(400).json({ error: 'Input haikubaliki.' });
      }
    }
  }
  next();
});

// ==================== USERS + SESSIONS ====================
const usersFile = 'users.json';
const sessionsFile = 'sessions.json';
const SESSION_DAYS = 7;

function getUserByToken(req) {
  const token = req.headers.authorization || req.query.token;
  if (!token) return null;
  const sessions = readJson(sessionsFile, {});
  const session = sessions[token];
  if (!session) return null;
  const email = typeof session === 'string' ? session : session.email;
  const expiresAt = typeof session === 'object' ? session.expiresAt : null;
  if (expiresAt && Date.now() > expiresAt) {
    delete sessions[token];
    writeJson(sessionsFile, sessions);
    return null;
  }
  const users = readJson(usersFile, {});
  return users[email] || null;
}

function createSession(email) {
  const token = crypto.randomBytes(24).toString('hex');
  const sessions = readJson(sessionsFile, {});
  sessions[token] = { email, expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000, createdAt: new Date().toISOString() };
  writeJson(sessionsFile, sessions);
  return token;
}

app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Jaza jina, email na password' });
  if (password.length < 6) return res.status(400).json({ error: 'Password iwe angalau herufi 6' });
  const users = readJson(usersFile, {});
  const cleanEmail = email.trim().toLowerCase();
  if (users[cleanEmail]) return res.status(400).json({ error: 'Email hii tayari iko.' });
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gamehub.co.tz').toLowerCase();
  users[cleanEmail] = {
    name: name.trim(), email: cleanEmail, phone: phone || '',
    password: hashPassword(password), isAdmin: cleanEmail === adminEmail, isStaff: false,
    balance: 0, adminEarnings: 0, created: new Date().toISOString()
  };
  writeJson(usersFile, users);
  const token = createSession(cleanEmail);
  logSecurity('USER_REGISTERED', 'Mtumiaji mpya: ' + cleanEmail, 'LOW', getIP(req));
  res.json({ success: true, token, user: { name: name.trim(), email: cleanEmail, isAdmin: users[cleanEmail].isAdmin, isStaff: false } });
});

app.get('/api/auth/social/config', (req, res) => {
  res.json({ success: true, enabled: !!(SUPABASE_URL && SUPABASE_ANON_KEY), url: SUPABASE_URL || '', anonKey: SUPABASE_ANON_KEY || '' });
});

app.post('/api/auth/social/complete', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Social login haijawekwa.' });
    const accessToken = String(req.body.accessToken || '').trim();
    const provider = String(req.body.provider || '').trim().toLowerCase();
    if (!accessToken || !['google','facebook','apple'].includes(provider)) return res.status(400).json({ error: 'Provider si sahihi.' });
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user?.email) return res.status(401).json({ error: 'Social account haikuthibitishwa.' });
    const authUser = data.user;
    const email = String(authUser.email).trim().toLowerCase();
    const meta = authUser.user_metadata || {};
    const displayName = String(meta.full_name || meta.name || email.split('@')[0]).trim();
    const users = readJson(usersFile, {});
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gamehub.co.tz').toLowerCase();
    if (!users[email]) {
      users[email] = { name: displayName || 'Mteja', email, phone: '', password: null, authProvider: provider, providerId: authUser.id, isAdmin: email === adminEmail, isStaff: false, balance: 0, adminEarnings: 0, created: new Date().toISOString() };
      writeJson(usersFile, users);
    }
    const token = createSession(email);
    const user = users[email];
    res.json({ success:true, token, user:{ name:user.name, email:user.email, isAdmin:!!user.isAdmin, isStaff:!!user.isStaff, provider } });
  } catch (e) { res.status(500).json({ error: 'Social login imeshindikana.' }); }
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
    if ((loginAttempts.get(ip) || {}).count >= MAX_ATTEMPTS) { blockIP(ip, 60); logSecurity('BRUTE_FORCE', 'Majaribio mengi: ' + ip, 'HIGH', ip); }
    return res.status(401).json({ error: 'Email au password si sahihi' });
  }
  loginAttempts.delete(cleanEmail);
  const token = createSession(cleanEmail);
  logSecurity('USER_LOGIN', 'Kuingia: ' + cleanEmail, 'LOW', ip);
  res.json({ success: true, token, user: { name: user.name, email: user.email, isAdmin: user.isAdmin, isStaff: !!user.isStaff } });
});

app.get('/api/auth/me', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Huna token' });
  res.json({ success: true, user: { name: user.name, email: user.email, phone: user.phone || '', created: user.created || null, balance: user.balance || 0, adminEarnings: user.adminEarnings || 0, isAdmin: !!user.isAdmin, isStaff: !!user.isStaff } });
});

app.put('/api/auth/profile', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza.' });
  const users = readJson(usersFile, {});
  const email = String(user.email || '').trim().toLowerCase();
  const current = users[email];
  if (!current) return res.status(404).json({ error: 'Akaunti haikupatikana.' });
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  if (name.length < 2) return res.status(400).json({ error: 'Jina liwe herufi 2+' });
  current.name = name; current.phone = phone;
  users[email] = current;
  writeJson(usersFile, users);
  res.json({ success: true, user: { name: current.name, email: current.email, phone: current.phone || '', balance: current.balance || 0, isAdmin: !!current.isAdmin, isStaff: !!current.isStaff } });
});

app.post('/api/auth/change-password', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza.' });
  const oldPassword = String(req.body?.oldPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  const confirmPassword = String(req.body?.confirmPassword || '');
  if (!oldPassword || !newPassword || !confirmPassword) return res.status(400).json({ error: 'Jaza password zote.' });
  if (!user.password || !verifyPassword(oldPassword, user.password)) return res.status(400).json({ error: 'Password ya sasa si sahihi.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password mpya iwe herufi 6+' });
  if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Password hazifanani.' });
  const users = readJson(usersFile, {});
  const email = String(user.email || '').trim().toLowerCase();
  users[email].password = hashPassword(newPassword);
  writeJson(usersFile, users);
  res.json({ success: true, message: 'Password imebadilishwa.' });
});

app.post('/api/admin/users/staff', (req, res) => {
  const admin = getUserByToken(req);
  if (!admin || !admin.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { email, makeStaff } = req.body;
  const users = readJson(usersFile, {});
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!users[cleanEmail]) return res.status(404).json({ error: 'Mtumiaji hajapatikana' });
  if (users[cleanEmail].isAdmin) return res.status(400).json({ error: 'Huyu ni Admin kamili' });
  users[cleanEmail].isStaff = !!makeStaff;
  writeJson(usersFile, users);
  res.json({ success: true, message: makeStaff ? 'Staff.' : 'Si Staff tena.' });
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
  if (!users[cleanEmail]) return res.status(404).json({ error: 'Mtumiaji hajapatikana.' });
  users[cleanEmail].isAdmin = true;
  writeJson(usersFile, users);
  res.json({ success: true, message: cleanEmail + ' sasa ni Admin.' });
});

// ==================== MATCH PAYOUT ====================
async function completeMatchAndPayout(matchId, winnerUserId) {
  const matches = readJson('matches.json', []);
  const match = matches.find(m => m.id === matchId);
  if (!match || match.status === 'completed') return { success: false, error: 'Mechi haipatikani' };
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
  res.json({ success: true, matches: readJson('matches.json', []) });
});

app.post('/api/matches', (req, res) => {
  const user = getUserByToken(req);
  if (!user || (!user.isAdmin && !user.isStaff)) return res.status(403).json({ error: 'Huna ruhusa' });
  const { title, entryFee, player1Id, player2Id } = req.body;
  if (!title || entryFee === undefined) return res.status(400).json({ error: 'Jaza title na entry fee' });
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
  if (!winnerUserId) return res.status(400).json({ error: 'Weka mshindi' });
  const result = await completeMatchAndPayout(req.params.id, winnerUserId);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json({ success: true, message: 'Mechi imekamilika!', ...result });
});

// ==================== PRODUCTS ====================
app.get('/api/products', (req, res) => {
  const products = readJson('products.json', {});
  res.json({ success: true, products: Object.values(products) });
});

app.post('/api/products', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || (!user.isAdmin && !user.isStaff)) return res.status(403).json({ error: 'Huna ruhusa' });
  const { name, type, price, emoji, desc, downloadLink, imageUrl, trailerUrl, category, section, accountUser, accountPassword, gameLinks, saleType, platforms, minimumSpecs, recommendedSpecs, recommendedSettings } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'Jaza jina na bei' });
  const products = readJson('products.json', {});
  const id = 'p' + Date.now();
  products[id] = { id, name, type: type || 'Bidhaa', price: Number(price), saleType: saleType || (Number(price) === 0 ? 'free' : 'paid'), gameLinks: Array.isArray(gameLinks) ? gameLinks.filter(Boolean).slice(0, 10) : (downloadLink ? [downloadLink] : []), platforms: platforms || '', minimumSpecs: minimumSpecs || '', recommendedSpecs: recommendedSpecs || '', recommendedSettings: recommendedSettings || '', emoji: emoji || '', desc: desc || '', downloadLink: downloadLink || '', imageUrl: imageUrl || '', trailerUrl: trailerUrl || '', category: category || 'Zote', section: section || 'shop', accountUser: accountUser || '', accountPassword: accountPassword || '' };
  const saved = await writeJson('products.json', products);
  res.json({ success: true, id, persistent: saved.cloud !== false });
});

app.put('/api/products/:id', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || (!user.isAdmin && !user.isStaff)) return res.status(403).json({ error: 'Huna ruhusa' });
  const products = readJson('products.json', {});
  const existing = products[req.params.id];
  if (!existing) return res.status(404).json({ error: 'Bidhaa haipatikani' });
  const updates = req.body;
  products[req.params.id] = { ...existing, ...updates, price: updates.price !== undefined ? Number(updates.price) : existing.price };
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

// ==================== ANALYTICS ====================
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

// ==================== MARKETPLACE ====================
app.get('/api/marketplace', (req, res) => {
  res.json({ success: true, listings: readJson('marketplace.json', []) });
});

app.post('/api/marketplace', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { businessName, description, contact, imageUrl, category } = req.body;
  if (!businessName || !contact) return res.status(400).json({ error: 'Jaza jina na mawasiliano' });
  const listings = readJson('marketplace.json', []);
  const listing = { id: 'm' + Date.now(), businessName, description: description || '', contact, imageUrl: imageUrl || '', category: category || 'Nyingine', date: new Date().toISOString() };
  listings.push(listing);
  writeJson('marketplace.json', listings);
  res.json({ success: true, id: listing.id });
});

app.delete('/api/marketplace/:id', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  writeJson('marketplace.json', readJson('marketplace.json', []).filter(l => l.id !== req.params.id));
  res.json({ success: true });
});

// ==================== COUPONS ====================
app.get('/api/admin/coupons', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  res.json({ success: true, coupons: readJson('coupons.json', {}) });
});

app.post('/api/admin/coupons', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { code, percentOff, maxUses } = req.body;
  if (!code || !percentOff) return res.status(400).json({ error: 'Jaza kodi na percent' });
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
  if (!c || !c.active) return res.status(404).json({ error: 'Kodi si sahihi' });
  if (c.maxUses && c.uses >= c.maxUses) return res.status(400).json({ error: 'Kodi imeisha' });
  c.uses += 1;
  writeJson('coupons.json', coupons);
  res.json({ success: true, percentOff: c.percentOff, code: c.code });
});

// ==================== REVIEWS ====================
app.get('/api/reviews/:productId', (req, res) => {
  const reviews = readJson('reviews.json', {});
  const list = reviews[req.params.productId] || [];
  const avg = list.length ? (list.reduce((t, r) => t + r.rating, 0) / list.length) : 0;
  res.json({ success: true, reviews: list.slice().reverse(), average: Math.round(avg * 10) / 10, count: list.length });
});

app.post('/api/reviews/:productId', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza' });
  const { rating, comment } = req.body;
  const r = Number(rating);
  if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'Rating 1-5' });
  const reviews = readJson('reviews.json', {});
  if (!reviews[req.params.productId]) reviews[req.params.productId] = [];
  const already = reviews[req.params.productId].find(x => x.email === user.email);
  if (already) return res.json({ success: false, message: 'Umeshaacha maoni.' });
  reviews[req.params.productId].push({ name: user.name, email: user.email, rating: r, comment: (comment || '').trim(), date: new Date().toISOString() });
  writeJson('reviews.json', reviews);
  res.json({ success: true, message: 'Asante!' });
});

// ==================== REQUESTS ====================
app.get('/api/requests', (req, res) => {
  res.json({ success: true, requests: readJson('requests.json', []).slice().sort((a, b) => b.votes - a.votes) });
});

app.post('/api/requests', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza' });
  const { gameName } = req.body;
  if (!gameName || !gameName.trim()) return res.status(400).json({ error: 'Andika jina la game' });
  const requests = readJson('requests.json', []);
  const name = gameName.trim();
  const existing = requests.find(r => r.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (!existing.voters.includes(user.email)) { existing.voters.push(user.email); existing.votes += 1; writeJson('requests.json', requests); return res.json({ success: true, message: 'Kura yako imeongezwa!' }); }
    return res.json({ success: true, message: 'Umeshapiga kura.' });
  }
  requests.push({ id: 'r' + Date.now(), name, voters: [user.email], votes: 1, date: new Date().toISOString() });
  writeJson('requests.json', requests);
  res.json({ success: true, message: 'Game imeongezwa!' });
});

app.post('/api/requests/:id/vote', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza' });
  const requests = readJson('requests.json', []);
  const item = requests.find(r => r.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Game haipatikani' });
  if (item.voters.includes(user.email)) return res.json({ success: false, message: 'Umeshapiga kura' });
  item.voters.push(user.email); item.votes += 1;
  writeJson('requests.json', requests);
  res.json({ success: true, message: 'Kura imeongezwa!' });
});

app.delete('/api/requests/:id', (req, res) => {
  const user = getUserByToken(req);
  if (!user || (!user.isAdmin && !user.isStaff)) return res.status(403).json({ error: 'Huna ruhusa' });
  writeJson('requests.json', readJson('requests.json', []).filter(r => r.id !== req.params.id));
  res.json({ success: true });
});

// ==================== ADMIN STATS ====================
app.get('/api/admin/orders', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  res.json({ success: true, orders: readJson('orders.json', []).slice().reverse() });
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
  res.json({ success: true, users: Object.values(readJson(usersFile, {})) });
});

app.get('/api/admin/storage-status', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const table = process.env.SUPABASE_KV_TABLE || 'kv_store';
  if (!supabase) return res.json({success:true,persistent:false,provider:'Local .data only',warning:'Weka SUPABASE_URL na SUPABASE_SERVICE_ROLE_KEY.',kvTable:table});
  try {
    const { error } = await supabase.from(table).select('file_name').limit(1);
    if (error) return res.json({success:true,persistent:false,provider:'Supabase KV unavailable',warning:error.message,kvTable:table});
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

// ==================== SECURITY ====================
app.get('/api/security/events', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  res.json({ success: true, events: readJson(securityFile, { events: [], blocked: {} }).events.slice().reverse() });
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
  res.json({ success: true, message: 'IP imefungwa.' });
});

app.post('/api/security/unblock', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { ip } = req.body;
  const data = readJson(securityFile, { events: [], blocked: {} });
  delete data.blocked[ip];
  writeJson(securityFile, data);
  logSecurity('IP_UNBLOCKED', 'IP ' + ip + ' imefunguliwa', 'LOW', getIP(req));
  res.json({ success: true, message: 'IP imefunguliwa.' });
});

app.get('/api/security/report', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const data = readJson(securityFile, { events: [], blocked: {} });
  const now = Date.now();
  const high = data.events.filter(e => e.severity === 'HIGH').length;
  res.json({ success: true, report: 'RIPOTI YA USALAMA\nMatukio: ' + data.events.length + '\nHIGH: ' + high + '\nHali: ' + (high > 0 ? 'Kuna hatari!' : 'Salama') });
});

// ==================== CLICKPESA ====================
const CLICKPESA_BASE = 'https://api.clickpesa.com/third-parties';
let clickpesaTokenCache = { token: null, expiresAt: 0 };

async function getClickPesaToken() {
  if (!process.env.CLICKPESA_CLIENT_ID || !process.env.CLICKPESA_API_KEY) {
    throw new Error('ClickPesa keys hazijawekwa (CLICKPESA_CLIENT_ID, CLICKPESA_API_KEY).');
  }
  if (clickpesaTokenCache.token && Date.now() < clickpesaTokenCache.expiresAt - 60_000) return clickpesaTokenCache.token;
  const r = await fetch(CLICKPESA_BASE + '/generate-token', {
    method: 'POST',
    headers: { 'client-id': process.env.CLICKPESA_CLIENT_ID, 'api-key': process.env.CLICKPESA_API_KEY }
  });
  const data = await r.json();
  if (!r.ok || !data.token) throw new Error('ClickPesa: token imeshindwa - ' + (data.message || 'Unknown'));
  clickpesaTokenCache = { token: data.token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return clickpesaTokenCache.token;
}

app.post('/api/clickpesa-pay', async (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza kulipa' });
  try {
    const { items, total, phone, name } = req.body;
    if (!items || !items.length || !total) return res.status(400).json({ error: 'Kikapu ni tupu' });
    if (!phone) return res.status(400).json({ error: 'Weka namba ya simu' });
    let phoneFull = String(phone).replace(/\D/g, '');
    if (!phoneFull.startsWith('255')) phoneFull = '255' + phoneFull.replace(/^0/, '');
    if (phoneFull.length !== 12) return res.status(400).json({ error: 'Namba si sahihi. Mfano: 0786095758' });
    const orderReference = 'KGTZ' + Date.now().toString().slice(-10);
    const orders = readJson('orders.json', []);
    orders.push({ tx_ref: orderReference, customer: user.email, customerPhone: phoneFull, customerName: name || user.name, amount: Number(total), items, provider: 'ClickPesa', status: 'pending_clickpesa', date: new Date().toISOString() });
    await writeJson('orders.json', orders);
    const token = await getClickPesaToken();
    const previewRes = await fetch(CLICKPESA_BASE + '/payments/preview-ussd-push-request', { method: 'POST', headers: { 'Authorization': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: String(total), currency: 'TZS', orderReference, phoneNumber: phoneFull }) });
    const previewData = await previewRes.json();
    if (!previewRes.ok || previewData.success === false) return res.status(400).json({ error: 'ClickPesa Preview: ' + (previewData.message || 'Malipo hayakuanza') });
    const payRes = await fetch(CLICKPESA_BASE + '/payments/initiate-ussd-push-request', { method: 'POST', headers: { 'Authorization': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: String(total), currency: 'TZS', orderReference, phoneNumber: phoneFull }) });
    const payData = await payRes.json();
    if (!payRes.ok || payData.success === false) {
      const all = readJson('orders.json', []);
      const o = all.find(x => x.tx_ref === orderReference);
      if (o) { o.status = 'failed_to_start'; await writeJson('orders.json', all); }
      return res.status(400).json({ error: 'ClickPesa Push: ' + (payData.message || 'Malipo hayakuanza') });
    }
    res.json({ success: true, tx_ref: orderReference, provider: 'ClickPesa', transactionId: payData.id || null });
  } catch (err) {
    console.error('ClickPesa error:', err);
    res.status(500).json({ error: 'Hitilafu ya Malipo: ' + err.message });
  }
});

app.post('/api/clickpesa-webhook', async (req, res) => {
  try {
    const body = req.body || {};
    const event = body.event || body.eventType;
    const data = body.data || {};
    if (event === 'PAYMENT RECEIVED') {
      const orders = readJson('orders.json', []);
      const order = orders.find(o => o.tx_ref === data.orderReference);
      if (order && order.status !== 'successful') {
        const collected = Number(data.collectedAmount || data.amount || 0);
        if (collected >= (order.amount - 5)) { order.status = 'successful'; order.confirmedAt = new Date().toISOString(); order.clickpesaRef = data.id || null; await writeJson('orders.json', orders); logSecurity('CLICKPESA_CONFIRMED', data.orderReference, 'LOW', getIP(req)); }
        else { order.status = 'amount_mismatch'; await writeJson('orders.json', orders); }
      }
    } else if (event === 'PAYMENT FAILED') {
      const orders = readJson('orders.json', []);
      const order = orders.find(o => o.tx_ref === data.orderReference);
      if (order && order.status !== 'successful') { order.status = 'failed'; await writeJson('orders.json', orders); }
    }
    res.json({ success: true });
  } catch (err) { console.error('Webhook error:', err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/clickpesa-check/:ref', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza' });
  const orders = readJson('orders.json', []);
  const o = orders.find(x => x.tx_ref === req.params.ref && x.customer === user.email);
  if (!o) return res.status(404).json({ error: 'Order haipatikani' });
  res.json({ success: true, status: o.status === 'successful' ? 'successful' : (o.status === 'failed' || o.status === 'failed_to_start' ? 'failed' : o.status === 'amount_mismatch' ? 'amount_mismatch' : 'pending') });
});

// ==================== MANUAL PAY ====================
app.post('/api/manual-pay', async (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza' });
  const { items, total, txRef, phone } = req.body;
  if (!items || !items.length || !total) return res.status(400).json({ error: 'Kikapu ni tupu' });
  if (!txRef || !txRef.trim()) return res.status(400).json({ error: 'Andika tx ref' });
  const orders = readJson('orders.json', []);
  const orderRef = 'MANUAL-' + Date.now();
  orders.push({ tx_ref: orderRef, customer: user.email, customerPhone: phone || '', manualTxRef: txRef.trim(), amount: Number(total), items, status: 'pending_manual', date: new Date().toISOString() });
  await writeJson('orders.json', orders);
  logSecurity('MANUAL_PAYMENT_SUBMITTED', user.email, 'LOW', getIP(req));
  res.json({ success: true, message: 'Ripoti imepokelewa!', tx_ref: orderRef });
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
  res.json({ success: true, message: 'Malipo yamethibitishwa.' });
});

app.post('/api/admin/orders/reject', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { tx_ref } = req.body;
  await writeJson('orders.json', readJson('orders.json', []).filter(o => o.tx_ref !== tx_ref));
  res.json({ success: true });
});

app.get('/api/my-orders', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Ingia kwanza' });
  const orders = readJson('orders.json', []);
  res.json({ success: true, orders: orders.filter(o => o.customer === user.email).slice().reverse() });
});

// ==================== AI INTEGRATION ====================
async function askAI(prompt, preferred) {
  const providers = {
    cerebras: { key: process.env.CEREBRAS_API_KEY, model: process.env.NEXUS_CEREBRAS_MODEL || 'gpt-oss-120b', base: 'https://api.cerebras.ai/v1' },
    groq: { key: process.env.GROQ_API_KEY, model: process.env.NEXUS_GROQ_MODEL || 'openai/gpt-oss-120b', base: 'https://api.groq.com/openai/v1' },
    google: { key: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY, model: process.env.NEXUS_GOOGLE_MODEL || 'gemini-2.0-flash-exp' },
    openrouter: { key: process.env.OPENROUTER_API_KEY, model: process.env.NEXUS_OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free', base: 'https://openrouter.ai/api/v1' },
    deepseek: { key: process.env.DEEPSEEK_API_KEY, model: process.env.NEXUS_DEEPSEEK_MODEL || 'deepseek-chat', base: 'https://api.deepseek.com' },
    openai: { key: process.env.OPENAI_API_KEY, model: process.env.NEXUS_OPENAI_MODEL || 'gpt-4o-mini', base: 'https://api.openai.com' },
    anthropic: { key: process.env.ANTHROPIC_API_KEY, model: process.env.NEXUS_ANTHROPIC_MODEL || 'claude-3-5-haiku-latest' }
  };
  const configured = Object.keys(providers).filter(p => providers[p].key);
  if (!configured.length) return 'AI API key haijawekwa.';
  const primary = preferred && providers[preferred]?.key ? preferred : configured[0];
  const order = [primary, ...configured.filter(p => p !== primary)];
  const clean = (v) => String(v || '').slice(0, 12000);
  for (const provider of order) {
    try {
      const cfg = providers[provider];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let text = '';
      try {
        if (['cerebras', 'groq', 'openrouter', 'deepseek', 'openai'].includes(provider)) {
          const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key };
          if (provider === 'openrouter') { headers['HTTP-Referer'] = process.env.RENDER_EXTERNAL_URL || 'https://kelvingamingtz.com'; headers['X-Title'] = 'Kelvin Gaming TZ'; }
          const response = await fetch(cfg.base + '/chat/completions', { method: 'POST', headers, signal: controller.signal, body: JSON.stringify({ model: cfg.model, messages: [{ role: 'system', content: 'Wewe ni msaidizi wa Kelvin Gaming TZ. Jibu kwa Kiswahili. Kuwa mfupi na rafiki.' }, { role: 'user', content: clean(prompt) }], temperature: 0.7, max_tokens: 900 }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error?.message || 'HTTP ' + response.status);
          text = data?.choices?.[0]?.message?.content || '';
        } else if (provider === 'anthropic') {
          const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' }, signal: controller.signal, body: JSON.stringify({ model: cfg.model, max_tokens: 900, temperature: 0.7, messages: [{ role: 'user', content: clean(prompt) }] }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error?.message || 'HTTP ' + response.status);
          text = data?.content?.map(x => x.text || '').join('') || '';
        } else if (provider === 'google') {
          const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(cfg.model) + ':generateContent?key=' + encodeURIComponent(cfg.key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ contents: [{ parts: [{ text: clean(prompt) }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 900 } }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error?.message || 'HTTP ' + response.status);
          text = data?.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || '';
        }
      } finally { clearTimeout(timeout); }
      if (text.trim()) return text.trim();
      throw new Error('Empty response');
    } catch (err) { console.error('AI [' + provider + ']:', err.message); }
  }
  return 'Samahani, AI haikupatikana kwa sasa.';
}

app.get('/api/ai/test', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const results = {};
  const testPrompt = 'Sema "OK" tu.';
  const providers = {
    cerebras: { key: process.env.CEREBRAS_API_KEY, model: 'gpt-oss-120b', base: 'https://api.cerebras.ai/v1' },
    groq: { key: process.env.GROQ_API_KEY, model: 'openai/gpt-oss-120b', base: 'https://api.groq.com/openai/v1' },
    google: { key: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY, model: 'gemini-2.0-flash-exp' },
    openai: { key: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini', base: 'https://api.openai.com' },
    anthropic: { key: process.env.ANTHROPIC_API_KEY, model: 'claude-3-5-haiku-latest' }
  };
  for (const [name, cfg] of Object.entries(providers)) {
    if (!cfg.key) { results[name] = { status: 'NO_KEY' }; continue; }
    try {
      let text = '';
      if (cfg.base) {
        const r = await fetch(cfg.base + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key }, body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: testPrompt }], max_tokens: 50 }) });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error?.message || 'HTTP ' + r.status);
        text = data?.choices?.[0]?.message?.content || '';
      } else if (name === 'google') {
        const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + cfg.model + ':generateContent?key=' + cfg.key, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: testPrompt }] }] }) });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error?.message || 'HTTP ' + r.status);
        text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else if (name === 'anthropic') {
        const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: cfg.model, max_tokens: 50, messages: [{ role: 'user', content: testPrompt }] }) });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error?.message || 'HTTP ' + r.status);
        text = data?.content?.[0]?.text || '';
      }
      results[name] = { status: 'OK', reply: text.slice(0, 50) };
    } catch (e) { results[name] = { status: 'FAILED', error: e.message }; }
  }
  res.json({ success: true, results });
});

const HEALTH_FORBIDDEN = ['orders.json', 'users.json', 'products.json', 'coupons.json', 'sessions.json'];
function healthSafetyLayer(prompt) {
  let cleaned = String(prompt);
  for (const f of HEALTH_FORBIDDEN) { if (cleaned.includes(f)) { cleaned = cleaned.replace(new RegExp(f.replace(/\./g, '\\.'), 'g'), '[DATA_ILIYOFICHWA]'); } }
  cleaned = cleaned.replace(/toa dawa|agiza dawa|andika prescription|diagnosis ya uhakika/gi, '[KANUNI]');
  return cleaned;
}

app.post('/api/ai/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Andika ujumbe' });
  const products = Object.values(readJson('products.json', {}));
  const productList = products.length ? products.map(p => '- ' + p.name + ' - ' + Number(p.price).toLocaleString() + ' TZS').join('\n') : 'Hakuna bidhaa';
  let transcript = '';
  if (Array.isArray(history) && history.length) {
    transcript = '\n[Mazungumzo ya awali]:\n' + history.slice(-4).map(h => (h.role === 'user' ? 'Mteja: ' : 'Wewe: ') + String(h.text).slice(0, 200)).join('\n') + '\n\n';
  }
  const prompt = 'Wewe ni Amina, msaidizi wa Kelvin Gaming TZ.\nBidhaa zilizopo:\n' + productList + '\nGeForce NOW: Dakika 20=300, 50=500, Masaa 2=1,000 TZS\nMalipo: M-Pesa, Tigo, Airtel, HaloPesa (ClickPesa)\n' + transcript + 'Mteja: "' + message + '"\nJibu kwa Kiswahili kifupi (sentensi 2-4).';
  const reply = await askAI(prompt);
  res.json({ reply, agent: 'Amina' });
});

app.post('/api/ai/recommendations', async (req, res) => {
  const { message } = req.body;
  const products = Object.values(readJson('products.json', {}));
  const catalog = products.map(p => p.name + ' | ' + (p.type || 'Game') + ' | ' + Number(p.price || 0).toLocaleString() + ' TZS').join('\n');
  const prompt = 'Wewe ni AI Recommendation wa Kelvin Gaming TZ.\nMteja: ' + String(message || '').slice(0, 3000) + '\nCatalog:\n' + (catalog || 'Hakuna bidhaa.') + '\nJibu kwa Kiswahili kifupi, chaguo hadi 3.';
  const reply = await askAI(prompt);
  res.json({ reply });
});

app.post('/api/ai/health', async (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Andika swali' });
  const safeMessage = healthSafetyLayer(String(message).slice(0, 5000));
  const transcript = Array.isArray(history) ? history.slice(-8).map(h => h.role + ': ' + h.text).join('\n') : '';
  const prompt = 'Wewe ni msaidizi wa afya wa Kelvin Gaming TZ.\nToa taarifa za jumla tu; usijidai kuwa daktari, usifanye diagnosis, usiagize dawa.\nKama ni dharura, mshauri kupiga 114 (Afya) au 112 (Dharura).\nMazungumzo:\n' + transcript + '\nSwali: ' + safeMessage;
  const reply = await askAI(prompt, process.env.NEXUS_HEALTH_PROVIDER || 'cerebras');
  const healthLog = readJson('health_chats.json', []);
  healthLog.push({ id: 'hc_' + Date.now(), user: getUserByToken(req)?.email || 'anonymous', question: safeMessage.slice(0, 200), time: new Date().toISOString() });
  if (healthLog.length > 500) healthLog.splice(0, healthLog.length - 500);
  writeJson('health_chats.json', healthLog);
  res.json({ reply });
});

app.post('/api/ai/admin', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { command } = req.body;
  if (!command || !command.trim()) return res.status(400).json({ error: 'Andika amri' });
  const reply = await askAI('Wewe ni msaidizi wa Admin wa Kelvin Gaming TZ. Admin ameuliza: "' + command + '". Jibu kwa Kiswahili kifupi.');
  res.json({ reply });
});

app.post('/api/ai/boss', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si Boss.' });
  const { message, mode } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Andika amri' });
  const orders = readJson('orders.json', []);
  const paid = orders.filter(o => o.status === 'successful');
  const usersCount = Object.keys(readJson('users.json', {})).length;
  const revenue = paid.reduce((t, o) => t + Number(o.amount || 0), 0);
  const pending = orders.filter(o => String(o.status || '').startsWith('pending'));
  const needsApproval = /payout|refund|withdraw|kutoa pesa|kufuta user|delete user|badilisha wallet|futa data/i.test(message);
  const prompt = 'Wewe ni Kelvin Boss AI. Boss (' + user.name + '): "' + message + '"\nTAARIFA:\n- Mauzo: ' + orders.length + ', Yaliyofanikiwa: ' + paid.length + ', Mapato: ' + revenue.toLocaleString() + ' TZS, Wateja: ' + usersCount + ', Pending: ' + pending.length + '\nJibu kwa Kiswahili kifupi. Kama ombi linahitaji pesa/delete, sema "Inahitaji Boss Approval."';
  const reply = await askAI(prompt, process.env.NEXUS_BOSS_PROVIDER || 'cerebras');
  if (needsApproval) {
    const approvals = readJson('boss_approvals.json', []);
    approvals.push({ id: 'appr_' + Date.now(), command: message.slice(0, 500), status: 'pending', time: new Date().toISOString(), requestedBy: user.email });
    await writeJson('boss_approvals.json', approvals);
  }
  res.json({ success: true, reply, needsApproval, mode: mode || 'chat', timestamp: new Date().toISOString() });
});

app.get('/api/ai/boss/approvals', (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si Boss.' });
  res.json({ success: true, approvals: readJson('boss_approvals.json', []).slice().reverse() });
});

app.post('/api/ai/boss/approvals/:id/decide', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si Boss.' });
  const { decision } = req.body;
  const approvals = readJson('boss_approvals.json', []);
  const item = approvals.find(x => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Approval haipatikani.' });
  item.status = decision === 'approve' ? 'approved' : 'rejected';
  item.decidedAt = new Date().toISOString();
  item.decidedBy = user.email;
  await writeJson('boss_approvals.json', approvals);
  res.json({ success: true, approval: item });
});

// ==================== BANNERS ====================
app.get('/api/banners', (req, res) => {
  res.json({ success: true, banners: readJson('banners.json', []).filter(x => x.status !== 'hidden').slice(-20).reverse() });
});

// ==================== ESPN LIVE SCORES ====================
const ESPN_LEAGUES = {
  'eng.1': { name: 'Premier League' },
  'esp.1': { name: 'La Liga' },
  'ita.1': { name: 'Serie A' },
  'ger.1': { name: 'Bundesliga' },
  'fra.1': { name: 'Ligue 1' },
  'uefa.champions': { name: 'Champions League' },
  'uefa.europa': { name: 'Europa League' }
};

async function fetchESPNLeague(leagueCode) {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/' + leagueCode + '/scoreboard';
    const response = await fetch(url, { headers: { 'User-Agent': 'KelvinGamingTZ/1.0' } });
    if (!response.ok) return [];
    const data = await response.json();
    const leagueInfo = ESPN_LEAGUES[leagueCode] || { name: leagueCode };
    return (data.events || []).map(event => {
      const comp = event.competitions?.[0] || {};
      const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
      const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
      const statusState = event.status?.type?.state || 'pre';
      return {
        id: event.id,
        league: leagueInfo.name,
        homeTeam: home.team?.displayName || 'Home',
        homeLogo: home.team?.logo || '',
        homeScore: home.score ?? '0',
        awayTeam: away.team?.displayName || 'Away',
        awayLogo: away.team?.logo || '',
        awayScore: away.score ?? '0',
        status: statusState === 'in' ? 'LIVE' : (statusState === 'post' ? 'FINISHED' : 'SCHEDULED'),
        minute: event.status?.displayClock || '',
        date: event.date || '',
        time: event.date ? new Date(event.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
        venue: comp.venue?.fullName || '',
        source: 'ESPN'
      };
    });
  } catch (error) { return []; }
}

app.get('/api/live-scores', async (req, res) => {
  try {
    const leagueCodes = Object.keys(ESPN_LEAGUES);
    const results = await Promise.allSettled(leagueCodes.map(code => fetchESPNLeague(code)));
    let allMatches = [];
    results.forEach(r => { if (r.status === 'fulfilled') allMatches.push(...r.value); });
    const live = allMatches.filter(m => m.status === 'LIVE');
    const scheduled = allMatches.filter(m => m.status === 'SCHEDULED');
    const finished = allMatches.filter(m => m.status === 'FINISHED');
    res.json({ success: true, count: allMatches.length, liveCount: live.length, live, scheduled, finished, all: allMatches, updatedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Imeshindwa kupata live scores', live: [], scheduled: [], finished: [], all: [] });
  }
});

app.get('/api/leagues', (req, res) => {
  res.json({ success: true, leagues: Object.entries(ESPN_LEAGUES).map(([code, info]) => ({ code, name: info.name })) });
});

// ==================== LIVE STREAMS ====================
const cleanScore = v => (v === '' || v == null || isNaN(Number(v))) ? null : Math.max(0, Math.min(99, Math.floor(Number(v))));

app.get('/api/live-streams', (req, res) => {
  const streams = readJson('live_streams.json', []);
  res.json({ success: true, streams: streams.filter(x => x.status !== 'hidden').sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||''))) });
});

app.post('/api/admin/live-streams', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const { title, league, homeTeam, awayTeam, status, streamUrl, videoUrl, startTime, description, homeScore, awayScore, minute } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Weka jina la mechi.' });
  const streams = readJson('live_streams.json', []);
  const item = { id: 'live_' + Date.now(), title: String(title).slice(0,160), league: String(league||'Football').slice(0,100), homeTeam: String(homeTeam||'').slice(0,80), awayTeam: String(awayTeam||'').slice(0,80), status: String(status||'LIVE').slice(0,30), streamUrl: String(streamUrl||'').slice(0,2000), videoUrl: String(videoUrl||'').slice(0,2000), startTime: String(startTime||'').slice(0,80), description: String(description||'').slice(0,1000), createdAt: new Date().toISOString(), homeScore: cleanScore(homeScore), awayScore: cleanScore(awayScore), minute: String(minute||'').slice(0,10) };
  streams.push(item); await writeJson('live_streams.json', streams);
  res.json({ success:true, stream:item });
});

app.post('/api/admin/live-streams/:id/score', async (req, res) => {
  const user = getUserByToken(req);
  if (!user || !user.isAdmin) return res.status(403).json({ error: 'Wewe si admin' });
  const streams = readJson('live_streams.json', []);
  const s = streams.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Haipatikani.' });
  const { homeScore, awayScore, minute, status } = req.body || {};
  if (homeScore !== undefined) s.homeScore = cleanScore(homeScore);
  if (awayScore !== undefined) s.awayScore = cleanScore(awayScore);
  if (minute !== undefined) s.minute = String(minute || '').slice(0, 10);
  if (status !== undefined && ['LIVE', 'UPCOMING', 'ENDED'].includes(String(status).toUpperCase())) s.status = String(status).toUpperCase();
  s.updatedAt = new Date().toISOString();
  await writeJson('live_streams.json', streams);
  res.json({ success: true, stream: s });
});

app.delete('/api/admin/live-streams/:id', (req,res) => {
  const user=getUserByToken(req); if(!user||!user.isAdmin) return res.status(403).json({error:'Wewe si admin'});
  const data=readJson('live_streams.json',[]); writeJson('live_streams.json', data.filter(x=>x.id!==req.params.id)); res.json({success:true});
});

// ==================== COURSES ====================
app.get('/api/courses', (req,res) => {
  res.json({success:true, courses: readJson('courses.json',[])});
});

app.post('/api/admin/courses', (req,res) => {
  const user=getUserByToken(req); if(!user||!user.isAdmin) return res.status(403).json({error:'Wewe si admin'});
  const {name,description,thumbnail,price,level}=req.body||{};
  if(!name) return res.status(400).json({error:'Weka jina la course.'});
  const courses=readJson('courses.json',[]);
  const course={id:'course_'+Date.now(),name:String(name).slice(0,160),description:String(description||'').slice(0,1000),thumbnail:String(thumbnail||'').slice(0,1000),price:Number(price||0),level:String(level||'Beginner').slice(0,50),videos:[],createdAt:new Date().toISOString()};
  courses.push(course); writeJson('courses.json',courses); res.json({success:true,course});
});

app.post('/api/admin/courses/:id/videos/upload', upload.single('video'), async (req,res) => {
  const user=getUserByToken(req); if(!user||!user.isAdmin) return res.status(403).json({error:'Wewe si admin'});
  const courses=readJson('courses.json',[]); const course=courses.find(x=>x.id===req.params.id);
  if(!course) return res.status(404).json({error:'Course haipatikani.'});
  try {
    const saved=await saveUploadedVideo(req.file,'courses');
    const video={id:'cv_'+Date.now(),title:String(req.body.title||req.file.originalname).slice(0,160),description:String(req.body.description||'').slice(0,1000),url:saved.url,duration:String(req.body.duration||'').slice(0,30),createdAt:new Date().toISOString()};
    course.videos=course.videos||[]; course.videos.push(video); writeJson('courses.json',courses);
    res.json({success:true,course,video});
  } catch(e){res.status(400).json({error:e.message});}
});

app.delete('/api/admin/courses/:id/videos/:videoId', (req,res)=>{
  const user=getUserByToken(req); if(!user||!user.isAdmin) return res.status(403).json({error:'Wewe si admin'});
  const courses=readJson('courses.json',[]); const course=courses.find(x=>x.id===req.params.id);
  if(!course) return res.status(404).json({error:'Course haipatikani.'});
  course.videos=(course.videos||[]).filter(v=>v.id!==req.params.videoId); writeJson('courses.json',courses); res.json({success:true});
});

// ==================== MOVIES ====================
app.get('/api/movies',(req,res)=>{
  const movies=readJson('movies.json',[]);
  res.json({success:true,movies:movies.filter(m=>m.status!=='hidden')});
});

app.post('/api/admin/movies/upload', upload.single('video'), async (req,res)=>{
  const user=getUserByToken(req); if(!user||!user.isAdmin) return res.status(403).json({error:'Wewe si admin'});
  if(!req.file && !req.body.videoUrl) return res.status(400).json({error:'Chagua video au weka URL.'});
  try{
    const remoteUrl=String(req.body.videoUrl||'').trim();
    const saved=remoteUrl ? {url:remoteUrl,storage:'remote',path:remoteUrl,filename:''} : await saveUploadedVideo(req.file,'movies');
    const movies=readJson('movies.json',[]);
    const movie={id:'movie_'+Date.now(),title:String(req.body.title||req.file?.originalname||'Movie').slice(0,180),description:String(req.body.description||'').slice(0,1200),genre:String(req.body.genre||'General').slice(0,80),year:String(req.body.year||'2026').slice(0,10),poster:String(req.body.poster||'').slice(0,1000),videoUrl:saved.url,storage:saved.storage,createdAt:new Date().toISOString()};
    movies.push(movie); await writeJson('movies.json',movies); res.json({success:true,movie});
  }catch(e){res.status(400).json({error:e.message});}
});

app.delete('/api/admin/movies/:id',(req,res)=>{
  const user=getUserByToken(req); if(!user||!user.isAdmin) return res.status(403).json({error:'Wewe si admin'});
  const movies=readJson('movies.json',[]); writeJson('movies.json',movies.filter(x=>x.id!==req.params.id)); res.json({success:true});
});

app.post('/api/admin/media/upload', upload.single('video'), async (req,res)=>{
  const user=getUserByToken(req); if(!user||!user.isAdmin) return res.status(403).json({error:'Wewe si admin'});
  try{
    const saved=await saveUploadedVideo(req.file,'media');
    const media=readJson('media.json',[]);
    const item={id:'media_'+Date.now(),title:String(req.body.title||req.file.originalname).slice(0,180),type:String(req.body.type||'video').slice(0,40),url:saved.url,storage:saved.storage,createdAt:new Date().toISOString()};
    media.push(item); writeJson('media.json',media); res.json({success:true,media:item});
  }catch(e){res.status(400).json({error:e.message});}
});

// ==================== AI BUILDER ====================
function extractJson(text) {
  const raw=String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  try{return JSON.parse(raw);}catch(e){}
  const a=raw.indexOf('{'), b=raw.lastIndexOf('}');
  if(a>=0&&b>a){try{return JSON.parse(raw.slice(a,b+1));}catch(e){}}
  return null;
}

async function askClaudeBuilder(command) {
  const key=process.env.ANTHROPIC_API_KEY;
  if(!key) throw new Error('Weka ANTHROPIC_API_KEY.');
  const model=process.env.NEXUS_ANTHROPIC_BUILDER_MODEL || process.env.NEXUS_ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
  const system='Wewe ni AI Web Developer wa Kelvin Gaming TZ. Tengeneza JSON TU.\nAllowed actions:\n1) add_product: {name,price,productType,desc,section,image}\n2) add_banner: {title,description,buttonText,buttonUrl}\n3) add_movie: {title,description,genre,year,videoUrl,poster}\n4) add_course_video: {courseName,title,description,videoUrl}\n5) add_live_match: {title,league,homeTeam,awayTeam,status,streamUrl,videoUrl,startTime,description}\n6) update_settings: {key,value}\nJibu: {"summary":"...","actions":[...]}.';
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:1800,temperature:0.2,system,messages:[{role:'user',content:String(command).slice(0,6000)}]})});
  const data=await r.json(); if(!r.ok) throw new Error(data?.error?.message||('Claude HTTP '+r.status));
  return extractJson(data?.content?.map(x=>x.text||'').join(''));
}

app.post('/api/admin/ai-builder', async (req,res)=>{
  const user=getUserByToken(req); if(!user||!user.isAdmin) return res.status(403).json({error:'Wewe si admin'});
  const {command,execute=true}=req.body||{}; if(!command||!String(command).trim()) return res.status(400).json({error:'Andika amri.'});
  try{
    const plan=await askClaudeBuilder(command); if(!plan||!Array.isArray(plan.actions)) return res.status(422).json({error:'Claude hakutoa JSON sahihi.',raw:plan});
    const results=[];
    if (!execute) return res.json({success:true,summary:plan.summary||'Plan.',actions:plan.actions,results:[],executed:false});
    for(const action of plan.actions.slice(0,10)){
      const type=String(action.type||action.action||'');
      if(type==='add_product'){
        const products=readJson('products.json',{}), id='p'+Date.now()+crypto.randomBytes(2).toString('hex');
        products[id]={ id, name:String(action.name||'New Product').slice(0,160), type:String(action.productType||action.section||'Game').slice(0,80), price:Number(action.price||0), desc:String(action.desc||'').slice(0,800), imageUrl:String(action.image||'').slice(0,1000), section:String(action.section||'shop').slice(0,30) };
        await writeJson('products.json',products); results.push('Bidhaa: '+products[id].name); continue;
      }
      if(type==='add_movie'){
        const movies=readJson('movies.json',[]); const m={id:'movie_'+Date.now(),title:String(action.title||'').slice(0,180),description:String(action.description||'').slice(0,1200),genre:String(action.genre||'General').slice(0,80),year:String(action.year||'2026').slice(0,10),videoUrl:String(action.videoUrl||'').slice(0,2000),poster:String(action.poster||'').slice(0,1000),createdAt:new Date().toISOString()}; movies.push(m); await writeJson('movies.json',movies); results.push('Movie: '+m.title); continue;
      }
      if(type==='add_live_match'){
        const streams=readJson('live_streams.json',[]); const x={id:'live_'+Date.now(),title:String(action.title||'Live Match').slice(0,160),league:String(action.league||'Football').slice(0,100),homeTeam:String(action.homeTeam||'').slice(0,80),awayTeam:String(action.awayTeam||'').slice(0,80),status:String(action.status||'LIVE').slice(0,30),streamUrl:String(action.streamUrl||'').slice(0,2000),videoUrl:String(action.videoUrl||'').slice(0,2000),startTime:String(action.startTime||'').slice(0,80),description:String(action.description||'').slice(0,1000),createdAt:new Date().toISOString()}; streams.push(x); await writeJson('live_streams.json',streams); results.push('Mechi: '+x.title); continue;
      }
    }
    res.json({success:true,summary:plan.summary||'Mabadiliko yameandaliwa.',actions:plan.actions,results,executed:Boolean(execute)});
  }catch(e){console.error('AI Builder:',e);res.status(500).json({error:e.message});}
});

// ==================== TOURNAMENTS ====================
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
  t.registrations.push({ name: String(name).slice(0,100), phone: String(phone).slice(0,30), game: String(game || t.game || '').slice(0,100), userToken: userToken || null, createdAt: new Date().toISOString() });
  writeJson('tournaments.json', tournaments);
  res.json({ success: true, message: 'Umefanikiwa kusajiliwa.' });
});

ensureTournamentSeed();

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  if (err) {
    console.error('API error:', err.message);
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Video ni kubwa sana (1GB max).' });
      return res.status(400).json({ error: 'Upload error: ' + err.message });
    }
    if (String(err.message || '').includes('Aina ya file')) return res.status(400).json({ error: err.message });
    if (String(err.message || '').includes('CORS')) return res.status(403).json({ error: 'Origin hairuhusiwi.' });
    return res.status(500).json({ error: err.message || 'Server error' });
  }
  next();
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint haipatikani' });
});

// ==================== START SERVER ====================
restoreFromSupabase()
  .then(() => ensureMediaBucket())
  .catch(err => console.error('Restore error:', err.message))
  .finally(() => {
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('\n========================================');
      console.log('   KELVIN GAMING TZ API v3.2');
      console.log('   Port: ' + PORT);
      console.log('   Supabase: ' + (supabase ? 'OK' : 'NOT CONFIGURED'));
      console.log('   CORS: ' + ALLOWED_ORIGINS.length + ' origins');
      console.log('========================================\n');
    });

    const shutdown = (signal) => {
      console.log('\n' + signal + ' imepokelewa.');
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => console.error('Unhandled:', reason));
    process.on('uncaughtException', (err) => console.error('Uncaught:', err));
  });
