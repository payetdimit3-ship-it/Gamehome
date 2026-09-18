require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const app = express();
app.use(express.json());
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
    const ok = ['video/mp4','video/webm','video/quicktime','video/x-m4v','video/mov'].includes(mime)
      || /\.(mp4|webm|mov|m4v)$/.test(name);
    if (!ok) return cb(new Error('Aina ya file hairuhusiwi. Tumia MP4, WebM, MOV au M4V.'));
    cb(null, true);
  }
});
const MEDIA_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'gamehub-media';

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
        throw new Error('Supabase Storage imekataa upload: ' + error.message);
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

// ☁️ SUPABASE PERSISTENCE
let supabase = null;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log('☁️ Supabase imeunganishwa.');
} else {
  console.log('⚠️ Supabase HAIJAWEKWA.');
}

const TRACKED_FILES = [
  'users.json', 'sessions.json', 'products.json',
  'orders.json', 'requests.json', 'security.json',
  'marketplace.json', 'coupons.json', 'reviews.json', 'matches.json', 'tournaments.json', 'live_streams.json', 'courses.json', 'movies.json', 'media.json', 'ai_builder_runs.json', 'banners.json', 'settings.json', 'public_chat.json'
];

const DATA_DIR = path.join(__dirname, '.data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); }
  catch (e) { return fallback; }
}

async function writeJson(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
  if (!supabase) return { local: true, cloud: false };
  try {
    const { error } = await supabase.from(process.env.SUPABASE_KV_TABLE || 'kv_store').upsert({ file_name: file, data, updated_at: new Date().toISOString() });
    if (error) { console.error('☁️ Supabase backup error (' + file + '):', error.message); return { local: true, cloud: false, error: error.message }; }
    return { local: true, cloud: true };
  } catch (err) {
    console.error('☁️ Supabase backup error (' + file + '):', err.message);
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
      { id: 't1', name: 'GameHub eFootball Cup', game: 'eFootball', date: 'Tarehe itawekwa', status: 'OPEN', description: 'Mashindano ya eFootball.', registrations: [] },
      { id: 't2', name: 'GameHub FC Challenge', game: 'EA SPORTS FC', date: 'Tarehe itawekwa', status: 'OPEN', description: 'Challenge ya football gaming.', registrations: [] }
    ]);
  }
}

// 🔐 PASSWORD & AUTH
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  return crypto.scryptSync(password, salt, 64).toString('hex') === hash;
}

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
  const patterns = /('|"|--|;|/*|*/|union\s+select|select\s+.\s+from|insert\s+into|drop\s+table|<\sscript|onerror\s*=|javascript:)/i;
  return patterns.test(input);
}

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
    if (!obj) continue;
    for (const key of Object.keys(obj)) {
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

  res.json({ success: true, token, user: { name: user.name, email: user.email, isAdmin: user.isAdmin, isStaff: !!user.isStaff } });
});

app.get('/api/auth/me', (req, res) => {
  const user = getUserByToken(req);
  if (!user) return res.status(401).json({ error: 'Huna token au token si sahihi' });
  res.json({ success: true, user: { name: user.name, email: user.email, balance: user.balance || 0, adminEarnings: user.adminEarnings || 0, isAdmin: user.isAdmin, isStaff: !!user.isStaff } });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization;
  if (token) { const sessions = readJson(sessionsFile, {}); delete sessions[token]; writeJson(sessionsFile, sessions); }
  res.json({ success: true });
});

// 🤖 AI INTEGRATION FIX
async function askAI(prompt, preferred) {
  const providers = {
    google: {
      key: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
      model: process.env.NEXUS_GOOGLE_MODEL || 'gemini-1.5-flash'
    },
    openai: {
      key: process.env.OPENAI_API_KEY,
      model: process.env.NEXUS_OPENAI_MODEL || 'gpt-4o-mini'
    },
    deepseek: {
      key: process.env.DEEPSEEK_API_KEY,
      model: process.env.NEXUS_DEEPSEEK_MODEL || 'deepseek-chat'
    },
    anthropic: {
      key: process.env.ANTHROPIC_API_KEY,
      model: process.env.NEXUS_ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022'
    }
  };

  const configured = Object.keys(providers).filter(p => providers[p].key);
  if (!configured.length) {
    return 'AI API key haijawekwa. Weka GOOGLE_GENERATIVE_AI_API_KEY, OPENAI_API_KEY, au DEEPSEEK_API_KEY kwenye Render.';
  }

  const primary = preferred && providers[preferred] && providers[preferred].key
    ? preferred
    : (process.env.NEXUS_AI_PRIMARY && providers[process.env.NEXUS_AI_PRIMARY]?.key
    ? process.env.NEXUS_AI_PRIMARY : configured[0]);

  const fallbackEnv = process.env.NEXUS_AI_FALLBACK;
  const order = [primary]
    .concat(fallbackEnv && providers[fallbackEnv]?.key ? [fallbackEnv] : [])
    .concat(configured.filter(p => p !== primary && p !== fallbackEnv));

  const clean = (value) => String(value || '').slice(0, 12000);

  for (const provider of order) {
    try {
      const cfg = providers[provider];
      let text = '';

      if (provider === 'google') {    
        const response = await fetch(    
          'https://generativelanguage.googleapis.com/v1beta/models/' +    
          encodeURIComponent(cfg.model) + ':generateContent?key=' + encodeURIComponent(cfg.key),    
          {    
            method: 'POST',    
            headers: { 'Content-Type': 'application/json' },    
            body: JSON.stringify({    
              contents: [{ parts: [{ text: clean(prompt) }] }],    
              generationConfig: { temperature: 0.7, maxOutputTokens: 700 }    
            })    
          }    
        );    
        const data = await response.json();    
        if (!response.ok) throw new Error(data?.error?.message || ('HTTP ' + response.status));    
        text = data?.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || '';    
      } 

      if (provider === 'openai' || provider === 'deepseek') {    
        const base = provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com';    
        const response = await fetch(base + '/chat/completions', {    
          method: 'POST',    
          headers: {    
            'Content-Type': 'application/json',    
            'Authorization': 'Bearer ' + cfg.key    
          },    
          body: JSON.stringify({    
            model: cfg.model,    
            messages: [{ role: 'user', content: clean(prompt) }],    
            temperature: 0.7,    
            max_tokens: 700    
          })    
        });    
        const data = await response.json();    
        if (!response.ok) throw new Error(data?.error?.message || ('HTTP ' + response.status));    
        text = data?.choices?.[0]?.message?.content || '';    
      }    

      if (text.trim()) return text.trim();    
      throw new Error('Provider returned empty string');    
    } catch (err) {    
      console.error('AI provider failed:', provider, err.message);    
    }
  }

  return 'Samahani, AI haikupatikana kwa sasa. Kagua API key, model, au quota/billing kwenye Render.';
}

app.post('/api/ai/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Andika ujumbe' });

  const products = Object.values(readJson('products.json', {}));
  const productList = products.length
    ? products.map(p => p.name + ' (' + (p.type || 'Bidhaa') + ') - ' + Number(p.price).toLocaleString() + ' TZS').join('\n')
    : 'Hakuna bidhaa bado kwenye duka';

  let transcript = '';
  if (Array.isArray(history) && history.length) {
    transcript = '\n\nMazungumzo ya awali:\n' + history.map(h => (h.role === 'user' ? 'Mteja: ' : 'Wewe: ') + h.text).join('\n') + '\n';
  }

  const prompt = `Wewe ni msaidizi wa GameHub Tanzania. Jibu kwa Kiswahili kirafiki.
Bidhaa zinazopatikana:
${productList}

Mteja anasema: "${message}"`;

  const reply = await askAI(prompt, 'google');
  res.json({ reply });
});

app.post('/api/ai/recommendations', async (req, res) => {
  const { message } = req.body;
  const products = Object.values(readJson('products.json', {}));
  const catalog = products.map(p => `${p.name} | ${p.type || 'Game'} | ${Number(p.price || 0).toLocaleString()} TZS`).join('\n');
  const prompt = `Wewe ni AI Recommendation wa GameHub. Msaidie mteja kuchagua bidhaa kutoka catalog:
${catalog || 'Hakuna bidhaa.'}
Mteja: ${String(message || '').slice(0, 3000)}`;

  const reply = await askAI(prompt);
  res.json({ reply });
});

app.post('/api/ai/health', async (req, res) => {
  const { message, history } = req.body;
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'Andika swali' });
  const transcript = Array.isArray(history) ? history.slice(-8).map(h => `${h.role}: ${h.text}`).join('\n') : '';
  const prompt = `Wewe ni msaidizi wa afya ndani ya GameHub. Toa elimu ya jumla tu bila kujidai daktari.
Mazungumzo:
${transcript}
Swali: ${String(message).slice(0, 5000)}`;

  const reply = await askAI(prompt, process.env.NEXUS_HEALTH_PROVIDER || 'google');
  res.json({ reply });
});

// START SERVER
restoreFromSupabase()
  .then(() => ensureMediaBucket())
  .catch(err => console.error('☁️ Restore error:', err.message))
  .finally(() => {
    const listener = app.listen(process.env.PORT || 3000, () => {
      console.log('🎮 GameHub iko live kwenye port', listener.address().port);
    });
  });
