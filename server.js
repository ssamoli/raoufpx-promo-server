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

// ── Access token store (in-memory, keyed by token string) ──
// { [token]: { createdAt: Date, expiresAt: Date } }
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours — matches the offer window
const tokenStore   = new Map();

// Clean up expired tokens every hour
setInterval(() => {
  const now = Date.now();
  for (const [t, meta] of tokenStore) {
    if (meta.expiresAt < now) tokenStore.delete(t);
  }
}, 60 * 60 * 1000);

// ── Parse JSON bodies & cookies ──
app.use(express.json());
app.use(cookieParser());

// ── CORS: allow GitHub Pages frontend + local dev ──
const ALLOWED_ORIGINS = [
  'https://raoufpx.com',
  'https://www.raoufpx.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. curl, Postman) and listed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST'],
  credentials: true, // required for HttpOnly cookie to be sent cross-origin
}));

// ── Serve static files (secret.html, promo.html, css, images, etc.) ──
app.use(express.static(path.join(__dirname)));

// ─────────────────────────────────────────────────────────────────────────────
// CODE LIST — 50 pre-generated codes
// Each entry: { code, used: bool, usedAt: timestamp|null }
// Persisted to codes.json so restarts don't reset "used" state.
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
  '12345610',
];

// Load or initialise code store
function loadCodes() {
  if (fs.existsSync(CODES_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CODES_FILE, 'utf8'));
      // Merge: add any new master codes not yet in file
      const stored = new Map(data.map(c => [c.code, c]));
      MASTER_CODES.forEach(code => {
        if (!stored.has(code)) stored.set(code, { code, used: false, usedAt: null });
      });
      return stored;
    } catch {
      console.warn('codes.json corrupt — rebuilding.');
    }
  }
  return new Map(MASTER_CODES.map(code => [code, { code, used: false, usedAt: null }]));
}

function saveCodes(store) {
  fs.writeFileSync(CODES_FILE, JSON.stringify([...store.values()], null, 2), 'utf8');
}

let codeStore = loadCodes();
saveCodes(codeStore); // Ensure file exists on first run

// ─────────────────────────────────────────────────────────────────────────────
// POST /check-code
// Body: { "code": "XXXXXXXX" }
// Returns: { valid: true|false, message: string }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/check-code', (req, res) => {
  const raw  = req.body?.code;
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';

  if (!code || code.length > 20) {
    return res.status(400).json({ valid: false, message: 'No code provided.' });
  }

  const entry = codeStore.get(code);

  if (!entry) {
    // Unknown code — add small artificial delay to slow brute-force
    return setTimeout(() => {
      res.json({ valid: false, message: 'Invalid code.' });
    }, 300);
  }

  if (entry.used) {
    return res.json({ valid: false, message: 'Code already redeemed.' });
  }

  // ✅ Valid — mark as used
  entry.used   = true;
  entry.usedAt = new Date().toISOString();
  codeStore.set(code, entry);
  saveCodes(codeStore);

  // Generate a cryptographically secure access token
  const token     = crypto.randomBytes(32).toString('hex');
  const createdAt = Date.now();
  const expiresAt = createdAt + TOKEN_TTL_MS;
  tokenStore.set(token, { createdAt, expiresAt });

  // Set as HttpOnly cookie (JS can't read it — prevents XSS theft)
  res.cookie('raoufpx_access', token, {
    httpOnly: true,
    sameSite: 'None',  // required for cross-origin cookie (GitHub Pages → Railway)
    secure: true,      // required when sameSite=None
    maxAge: TOKEN_TTL_MS,
  });

  console.log(`[${entry.usedAt}] Code redeemed: ${code} | Token issued: ${token.slice(0,8)}...`);
  return res.json({ valid: true, message: 'Code accepted.', expiresAt });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /verify-token
// Called by promo.html on load. Reads HttpOnly cookie and confirms it's valid.
// Returns: { valid: true, expiresAt: number } or { valid: false }
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: GET /admin/codes?key=YOUR_ADMIN_KEY
// Shows redemption status of all codes.
// Set ADMIN_KEY env var before deploying: export ADMIN_KEY=somethingSecret
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_KEY = process.env.ADMIN_KEY || 'raoufpx-admin-2024';

app.get('/admin/codes', (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  const all   = [...codeStore.values()];
  const used  = all.filter(c => c.used).length;
  const avail = all.length - used;
  res.json({ total: all.length, used, available: avail, codes: all });
});

// ─────────────────────────────────────────────────────────────────────────────
// Catch-all: redirect unknown routes to the gate page
// ─────────────────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.redirect('/secret.html');
});

app.listen(PORT, () => {
  console.log(`RAOUF px promo server running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin/codes?key=${ADMIN_KEY}`);
});
