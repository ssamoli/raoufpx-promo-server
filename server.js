/**
 * RAOUF px — Street Promo Code Server
 * Run: node server.js
 * Requires: npm install express cors cookie-parser
 */

const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const crypto       = require('crypto');
const path         = require('path');
const fs           = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Access token store (in-memory) ──
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const tokenStore   = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [t, meta] of tokenStore) {
    if (meta.expiresAt < now) tokenStore.delete(t);
  }
}, 60 * 60 * 1000);

app.use(express.json());
app.use(cookieParser());

const ALLOWED_ORIGINS = [
  'https://raoufpx.com',
  'https://www.raoufpx.com',
  'https://raoufpx-promo-server-production.up.railway.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.static(path.join(__dirname)));

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SECRET
// Set ADMIN_KEY environment variable in Railway dashboard.
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_KEY = process.env.ADMIN_KEY || 'raoufpx-admin-2024';

function requireAdmin(req, res, next) {
  const queryKey   = req.query.key;
  const authHeader = req.headers['authorization'] || '';
  const bearerKey  = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (queryKey === ADMIN_KEY || bearerKey === ADMIN_KEY) return next();
  return res.status(403).json({ error: 'Forbidden.' });
}

// ─────────────────────────────────────────────────────────────────────────────
// CODE STORE — persisted to codes.json
// Schema per entry: { code, used, createdAt, usedAt }
// ─────────────────────────────────────────────────────────────────────────────
const CODES_FILE = path.join(__dirname, 'codes.json');

const MASTER_CODES = [
  '7G9K2VQX','P4T6M1ZD','X8R3L5WY','N2F9J7BQ','C6Z4H1VK',
  'D9M7S2QA','L5T3G8NR','W1K6P9XF','R3H7V2JM','Q8Y4B1LD',
  'V2M8J5QK','T9P3C7WX','F6R1L4NZ','H5K9V2MQ','S4D7T1PY',
  'B8N3R6JL','M2G5X9QK','K7C1F4VD','J6L2T8WP','E9H3R5ZN',
  'Z1F6M7QX','N8T4B3LD','Y3P7K1VM','W2R9J5QX','C5L3H8DZ',
  'G4M7V1KP','D6T2N9XQ','F3K8J4RM','H9P1C6VZ','S2L5F8WY',
  'V7R3M1QK','T4N9J6PD','B1K5H7VZ','M9F3T2QL','K2P8R5WX',
  'J7L1C4VN','E5H9M2QK','Z4T6B3LD','N1R7K8XP','Y8F2J5QW',
  'W3M6V1KL','C9P4H7DZ','G1K8L5QN','D2T7R3VM','F5L9M1QX',
  'H3C6P8WR','S7N2J4QK','V1F5K9ZD','T6R3M7PX','B2L8H1VQ',
];

function loadCodes() {
  if (fs.existsSync(CODES_FILE)) {
    try {
      const data   = JSON.parse(fs.readFileSync(CODES_FILE, 'utf8'));
      const stored = new Map(data.map(c => [c.code, c]));
      MASTER_CODES.forEach(code => {
        if (!stored.has(code)) {
          stored.set(code, { code, used: false, createdAt: new Date().toISOString(), usedAt: null });
        }
      });
      return stored;
    } catch {
      console.warn('codes.json corrupt — rebuilding.');
    }
  }
  return new Map(MASTER_CODES.map(code => [
    code, { code, used: false, createdAt: new Date().toISOString(), usedAt: null }
  ]));
}

function saveCodes(store) {
  fs.writeFileSync(CODES_FILE, JSON.stringify([...store.values()], null, 2), 'utf8');
}

let codeStore = loadCodes();
saveCodes(codeStore);

// ─────────────────────────────────────────────────────────────────────────────
// CODE GENERATOR HELPERS
// Format: PX-XXXXXXXX  (8 chars, no O/0 or I/1)
// ─────────────────────────────────────────────────────────────────────────────
const CODE_CHARS  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function generateCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let result = 'PX-';
  for (let i = 0; i < CODE_LENGTH; i++) {
    result += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return result;
}

function generateUniqueCode() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = generateCode();
    if (!codeStore.has(code)) return code;
  }
  throw new Error('Could not generate a unique code after 100 attempts.');
}

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING ROUTES — UNCHANGED
// ─────────────────────────────────────────────────────────────────────────────

// POST /check-code
app.post('/check-code', (req, res) => {
  const raw  = req.body?.code;
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';

  if (!code || code.length > 20) {
    return res.status(400).json({ valid: false, message: 'No code provided.' });
  }

  const entry = codeStore.get(code);

  if (!entry) {
    return setTimeout(() => {
      res.json({ valid: false, message: 'Invalid code.' });
    }, 300);
  }

  if (entry.used) {
    return res.json({ valid: false, message: 'Code already redeemed.' });
  }

  entry.used   = true;
  entry.usedAt = new Date().toISOString();
  codeStore.set(code, entry);
  saveCodes(codeStore);

  const token     = crypto.randomBytes(32).toString('hex');
  const createdAt = Date.now();
  const expiresAt = createdAt + TOKEN_TTL_MS;
  tokenStore.set(token, { createdAt, expiresAt });

  res.cookie('raoufpx_access', token, {
    httpOnly: true,
    sameSite: 'None',
    secure: true,
    maxAge: TOKEN_TTL_MS,
  });

  console.log(`[${entry.usedAt}] Code redeemed: ${code} | Token: ${token.slice(0,8)}...`);
  return res.json({ valid: true, message: 'Code accepted.', expiresAt });
});

// GET /verify-token
app.get('/verify-token', (req, res) => {
  const token = req.cookies?.raoufpx_access;
  if (!token) return res.json({ valid: false });

  const meta = tokenStore.get(token);
  if (!meta) return res.json({ valid: false });
  if (meta.expiresAt < Date.now()) {
    tokenStore.delete(token);
    return res.json({ valid: false });
  }

  return res.json({ valid: true, expiresAt: meta.expiresAt });
});

// GET /admin/codes — view all + stats
app.get('/admin/codes', requireAdmin, (req, res) => {
  const all   = [...codeStore.values()];
  const used  = all.filter(c => c.used).length;
  const avail = all.length - used;
  res.json({ total: all.length, used, available: avail, codes: all });
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW: POST /admin/generate-code — generate exactly 1 code
// Auth: ?key=ADMIN_KEY  OR  Authorization: Bearer ADMIN_KEY
// ─────────────────────────────────────────────────────────────────────────────
app.post('/admin/generate-code', requireAdmin, (req, res) => {
  try {
    const code      = generateUniqueCode();
    const createdAt = new Date().toISOString();
    codeStore.set(code, { code, used: false, createdAt, usedAt: null });
    saveCodes(codeStore);
    console.log(`[ADMIN] Generated: ${code}`);
    return res.json({ success: true, code, createdAt });
  } catch (err) {
    console.error('[ADMIN] generate-code error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW: POST /admin/generate-bulk — generate N codes at once
// Body: { "count": 10 }   (clamped 1–200)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/admin/generate-bulk', requireAdmin, (req, res) => {
  const raw   = parseInt(req.body?.count, 10);
  const count = isNaN(raw) ? 1 : Math.min(Math.max(raw, 1), 200);
  const created   = [];
  const createdAt = new Date().toISOString();

  try {
    for (let i = 0; i < count; i++) {
      const code = generateUniqueCode();
      codeStore.set(code, { code, used: false, createdAt, usedAt: null });
      created.push({ code, createdAt });
    }
    saveCodes(codeStore);
    console.log(`[ADMIN] Bulk generated ${created.length} codes`);
    return res.json({ success: true, generated: created.length, codes: created });
  } catch (err) {
    if (created.length > 0) saveCodes(codeStore);
    console.error('[ADMIN] generate-bulk error:', err.message);
    return res.status(500).json({
      success: false, error: err.message,
      generated: created.length, codes: created,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Catch-all
// /admin/* routes are never redirected — return 404 JSON instead.
// Everything else (unknown page URLs) redirects to the gate.
// ─────────────────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/admin/')) {
    return res.status(404).json({ error: 'Not found.' });
  }
  res.redirect('/secret.html');
});

app.listen(PORT, () => {
  console.log(`RAOUF px promo server running on http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin/codes?key=${ADMIN_KEY}`);
});
