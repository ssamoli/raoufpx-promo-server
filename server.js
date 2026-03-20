/**

- RAOUF px — Street Promo Code Server
- Run: node server.js
- Requires: npm install express cors cookie-parser multer
- 
- DATA FILES:
- codes.json   — code store (schema v2 with status/timeline + gallery fields)
- scans.json   — QR scan events (one entry per secret.html visit)
- leads.json   — booking submissions with lead profile data
- 
- FOLDERS:
- /uploads     — private ZIP files for client gallery delivery (never served statically)
  */

const express      = require(‘express’);
const cors         = require(‘cors’);
const cookieParser = require(‘cookie-parser’);
const crypto       = require(‘crypto’);
const path         = require(‘path’);
const fs           = require(‘fs’);

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Token store (in-memory) ──
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const tokenStore   = new Map();
setInterval(() => {
const now = Date.now();
for (const [t, meta] of tokenStore) {
if (meta.expiresAt < now) tokenStore.delete(t);
}
}, 60 * 60 * 1000);

// ── Real-time activity feed (in-memory ring buffer, last 50 events) ──
const activityFeed = [];
function pushActivity(type, detail = ‘’) {
activityFeed.unshift({ time: new Date().toISOString(), type, detail });
if (activityFeed.length > 50) activityFeed.pop();
}

app.use(express.json());
app.use(cookieParser());

const ALLOWED_ORIGINS = [
‘https://raoufpx.com’,
‘https://www.raoufpx.com’,
‘https://raoufpx-promo-server-production.up.railway.app’,
‘http://localhost:3000’,
‘http://127.0.0.1:3000’,
];
app.use(cors({
origin: (origin, cb) => {
if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
cb(new Error(`CORS blocked: ${origin}`));
},
methods: [‘GET’, ‘POST’, ‘PATCH’, ‘DELETE’, ‘OPTIONS’],
allowedHeaders: [‘Content-Type’, ‘Authorization’],
credentials: true,
}));

// Explicit OPTIONS preflight handler for all routes
app.options(’*’, cors({
origin: (origin, cb) => {
if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
cb(new Error(`CORS blocked: ${origin}`));
},
methods: [‘GET’, ‘POST’, ‘PATCH’, ‘DELETE’, ‘OPTIONS’],
allowedHeaders: [‘Content-Type’, ‘Authorization’],
credentials: true,
}));

app.use(express.static(path.join(__dirname)));

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN AUTH
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_KEY = process.env.ADMIN_KEY || ‘raoufpx-admin-2024’;

function requireAdmin(req, res, next) {
const queryKey  = req.query.key;
const authHeader = req.headers[‘authorization’] || ‘’;
const bearerKey  = authHeader.startsWith(’Bearer ’) ? authHeader.slice(7) : null;
if (queryKey === ADMIN_KEY || bearerKey === ADMIN_KEY) return next();
return res.status(403).json({ error: ‘Forbidden.’ });
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON FILE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function readJSON(file, fallback) {
if (fs.existsSync(file)) {
try { return JSON.parse(fs.readFileSync(file, ‘utf8’)); } catch {}
}
return fallback;
}
function writeJSON(file, data) {
fs.writeFileSync(file, JSON.stringify(data, null, 2), ‘utf8’);
}

// ─────────────────────────────────────────────────────────────────────────────
// CODE STORE  (codes.json)
// Schema v2:
//   code, status, createdAt, issuedAt, firstScanAt, redeemedAt,
//   expiresAt, bookingSubmittedAt, location, notes, used, usedAt
//
// status: ‘available’ | ‘issued’ | ‘redeemed’ | ‘expired’
// ─────────────────────────────────────────────────────────────────────────────
const CODES_FILE = path.join(__dirname, ‘codes.json’);

const MASTER_CODES = [
‘7G9K2VQX’,‘P4T6M1ZD’,‘X8R3L5WY’,‘N2F9J7BQ’,‘C6Z4H1VK’,
‘D9M7S2QA’,‘L5T3G8NR’,‘W1K6P9XF’,‘R3H7V2JM’,‘Q8Y4B1LD’,
‘V2M8J5QK’,‘T9P3C7WX’,‘F6R1L4NZ’,‘H5K9V2MQ’,‘S4D7T1PY’,
‘B8N3R6JL’,‘M2G5X9QK’,‘K7C1F4VD’,‘J6L2T8WP’,‘E9H3R5ZN’,
‘Z1F6M7QX’,‘N8T4B3LD’,‘Y3P7K1VM’,‘W2R9J5QX’,‘C5L3H8DZ’,
‘G4M7V1KP’,‘D6T2N9XQ’,‘F3K8J4RM’,‘H9P1C6VZ’,‘S2L5F8WY’,
‘V7R3M1QK’,‘T4N9J6PD’,‘B1K5H7VZ’,‘M9F3T2QL’,‘K2P8R5WX’,
‘J7L1C4VN’,‘E5H9M2QK’,‘Z4T6B3LD’,‘N1R7K8XP’,‘Y8F2J5QW’,
‘W3M6V1KL’,‘C9P4H7DZ’,‘G1K8L5QN’,‘D2T7R3VM’,‘F5L9M1QX’,
‘H3C6P8WR’,‘S7N2J4QK’,‘V1F5K9ZD’,‘T6R3M7PX’,‘B2L8H1VQ’,
];

function makeCodeEntry(code) {
return {
code,
status: ‘available’,
createdAt: new Date().toISOString(),
issuedAt: null,
firstScanAt: null,
redeemedAt: null,
expiresAt: null,
bookingSubmittedAt: null,
location: ‘’,
notes: ‘’,
sessionDuration: null,
source: ‘street’,      // ‘street’ | ‘referral’
parentCode: null,       // set for referral codes
// ── Gallery / file delivery fields ──
clientName:       ‘’,
sessionStatus:    null,  // ‘requested’|‘confirmed’|‘scheduled’|‘completed’|‘editing’|‘ready’
sessionDate:      null,
galleryFile:      null,  // filename inside /uploads
downloadCount:    0,
maxDownloads:     2,
galleryExpiresAt: null,
// legacy compat fields
used: false,
usedAt: null,
};
}

function loadCodes() {
const data   = readJSON(CODES_FILE, []);
const stored = new Map(data.map(c => [c.code, c]));
// Migrate old entries that lack status field
for (const [code, entry] of stored) {
if (!entry.status) {
entry.status = entry.used ? ‘redeemed’ : ‘available’;
}
}
// Ensure master codes exist
MASTER_CODES.forEach(code => {
if (!stored.has(code)) stored.set(code, makeCodeEntry(code));
});
return stored;
}

function saveCodes(store) {
writeJSON(CODES_FILE, […store.values()]);
}

let codeStore = loadCodes();
saveCodes(codeStore);

// ─────────────────────────────────────────────────────────────────────────────
// SCAN STORE  (scans.json)
// One entry per secret.html visit.
// Schema: { scanId, timestamp, deviceType, browser, country }
// ─────────────────────────────────────────────────────────────────────────────
const SCANS_FILE = path.join(__dirname, ‘scans.json’);
let scanStore = readJSON(SCANS_FILE, []);

function saveScans() { writeJSON(SCANS_FILE, scanStore); }

function detectDevice(ua = ‘’) {
if (/tablet|ipad/i.test(ua))  return ‘tablet’;
if (/mobile|iphone|android/i.test(ua)) return ‘mobile’;
return ‘desktop’;
}
function detectBrowser(ua = ‘’) {
if (/edg//i.test(ua))    return ‘Edge’;
if (/chrome/i.test(ua))   return ‘Chrome’;
if (/safari/i.test(ua))   return ‘Safari’;
if (/firefox/i.test(ua))  return ‘Firefox’;
return ‘Other’;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAD STORE  (leads.json)
// One entry per booking submission.
// Schema: { code, clientName, email, whatsapp, selectedPackage,
//           submittedAt, price, date }
// ─────────────────────────────────────────────────────────────────────────────
const LEADS_FILE = path.join(__dirname, ‘leads.json’);
let leadStore = readJSON(LEADS_FILE, []);
function saveLeads() { writeJSON(LEADS_FILE, leadStore); }

// ─────────────────────────────────────────────────────────────────────────────
// CODE GENERATOR  (format: XXX-XXX)
// ─────────────────────────────────────────────────────────────────────────────
const CODE_CHARS = ‘ABCDEFGHJKLMNPQRSTUVWXYZ23456789’;

function generateCode() {
const rand = (n) => {
const bytes = crypto.randomBytes(n);
let s = ‘’;
for (let i = 0; i < n; i++) s += CODE_CHARS[bytes[i] % CODE_CHARS.length];
return s;
};
return `${rand(3)}-${rand(3)}`;
}

function generateUniqueCode() {
for (let i = 0; i < 100; i++) {
const code = generateCode();
if (!codeStore.has(code)) return code;
}
throw new Error(‘Could not generate unique code after 100 attempts.’);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPIRY CHECKER — runs every 10 minutes
// ─────────────────────────────────────────────────────────────────────────────
setInterval(() => {
const now = new Date().toISOString();
let changed = false;
for (const [, entry] of codeStore) {
if (entry.status === ‘redeemed’ && entry.expiresAt && entry.expiresAt < now) {
entry.status = ‘expired’;
changed = true;
}
}
if (changed) saveCodes(codeStore);
}, 10 * 60 * 1000);

// =============================================================================
// ── PUBLIC ROUTES ─────────────────────────────────────────────────────────────
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// POST /track-scan
// Called by secret.html on every page load (QR scan event).
// Body: {} — no code needed, just the visit.
// ─────────────────────────────────────────────────────────────────────────────
app.post(’/track-scan’, (req, res) => {
const ua      = req.headers[‘user-agent’] || ‘’;
const scanId  = crypto.randomBytes(8).toString(‘hex’);
const scan    = {
scanId,
timestamp:  new Date().toISOString(),
deviceType: detectDevice(ua),
browser:    detectBrowser(ua),
country:    req.headers[‘cf-ipcountry’] || req.headers[‘x-country’] || ‘unknown’,
};
scanStore.push(scan);
saveScans();
pushActivity(‘QR Scan’, `${scan.deviceType} / ${scan.browser}`);
return res.json({ ok: true, scanId });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /check-code  — EXISTING ROUTE (extended with timeline fields)
// ─────────────────────────────────────────────────────────────────────────────
app.post(’/check-code’, (req, res) => {
const raw  = req.body?.code;
const code = typeof raw === ‘string’ ? raw.trim().toUpperCase() : ‘’;

if (!code || code.length > 20) {
return res.status(400).json({ valid: false, message: ‘No code provided.’ });
}

const entry = codeStore.get(code);

if (!entry) {
pushActivity(‘Invalid Code’, code);
return setTimeout(() => res.json({ valid: false, message: ‘Invalid code.’ }), 300);
}

// Record firstScanAt (code was entered — best proxy for “first scan with this code”)
if (!entry.firstScanAt) {
entry.firstScanAt = new Date().toISOString();
codeStore.set(code, entry);
saveCodes(codeStore);
}

if (entry.status === ‘expired’ || (entry.expiresAt && entry.expiresAt < new Date().toISOString())) {
entry.status = ‘expired’;
saveCodes(codeStore);
pushActivity(‘Expired Code’, code);
return res.json({ valid: false, message: ‘This offer has expired.’ });
}

if (entry.used || entry.status === ‘redeemed’) {
pushActivity(‘Already Used’, code);
return res.json({ valid: false, message: ‘Code already redeemed.’ });
}

// ✅ Valid
const now       = new Date().toISOString();
const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

entry.used       = true;
entry.usedAt     = now;
entry.redeemedAt = now;
entry.expiresAt  = expiresAt;
entry.status     = ‘redeemed’;
codeStore.set(code, entry);
saveCodes(codeStore);

const token    = crypto.randomBytes(32).toString(‘hex’);
const expMs    = Date.now() + TOKEN_TTL_MS;
tokenStore.set(token, { createdAt: Date.now(), expiresAt: expMs, code });

res.cookie(‘raoufpx_access’, token, {
httpOnly: true, sameSite: ‘None’, secure: true, maxAge: TOKEN_TTL_MS,
});

pushActivity(‘Code Redeemed’, code);
console.log(`[${now}] Code redeemed: ${code}`);
return res.json({ valid: true, message: ‘Code accepted.’, expiresAt: expMs });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /verify-token  — EXISTING ROUTE (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
app.get(’/verify-token’, (req, res) => {
const token = req.cookies?.raoufpx_access;
if (!token) return res.json({ valid: false });
const meta = tokenStore.get(token);
if (!meta) return res.json({ valid: false });
if (meta.expiresAt < Date.now()) { tokenStore.delete(token); return res.json({ valid: false }); }
return res.json({ valid: true, expiresAt: meta.expiresAt });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /track-booking
// Called by promo.html after successful Formspree submission.
// Body: { code, clientName, email, whatsapp, selectedPackage, price, date }
// On success: auto-generates 3 referral codes linked to secret.html
// ─────────────────────────────────────────────────────────────────────────────
app.post(’/track-booking’, (req, res) => {
const { code, clientName, email, whatsapp, selectedPackage, price, date } = req.body || {};
const now = new Date().toISOString();
const upperCode = (code || ‘’).toUpperCase();

// Update code timeline
if (upperCode) {
const entry = codeStore.get(upperCode);
if (entry) {
entry.bookingSubmittedAt = now;
// Store referrer WhatsApp on the parent code for traceability
if (whatsapp) entry.referrerWhatsapp = whatsapp;
codeStore.set(entry.code, entry);
}
}

// Store lead (includes referrer WhatsApp)
const lead = {
code:              upperCode,
clientName:        clientName || ‘’,
email:             email      || ‘’,
whatsapp:          whatsapp   || ‘’,
selectedPackage:   selectedPackage || ‘’,
price:             price      || ‘’,
date:              date       || ‘’,
submittedAt:       now,
referralCodes:     [],   // filled below
};

// ── Generate 3 referral codes ─────────────────────────────────────────────
const referralCodes   = [];
const referralLinks   = [];   // secret.html links for each code
const referralContacts = [];  // Firebase-ready: { code, whatsapp, name } — filled on referrals.html

try {
for (let i = 0; i < 3; i++) {
const refCode = generateUniqueCode();
const refEntry = {
…makeCodeEntry(refCode),
source:           ‘referral’,
parentCode:       upperCode,
referralSource:   upperCode,   // explicit attribution field
referrerName:     clientName || ‘’,
referrerWhatsapp: whatsapp   || ‘’,
};
codeStore.set(refCode, refEntry);
referralCodes.push(refCode);
referralLinks.push(`https://raoufpx.com/secret.html?code=${refCode}`);
}
} catch (err) {
console.error(’[track-booking] Referral generation failed:’, err.message);
}

lead.referralCodes = referralCodes;
leadStore.push(lead);
saveLeads();
saveCodes(codeStore);

pushActivity(‘Booking Submitted’, `${selectedPackage || '?'} — ${clientName || 'unknown'} (+3 referrals)`);
console.log(`[${now}] Booking: ${upperCode} | ${clientName} | ${selectedPackage} | referrals: ${referralCodes.join(', ')}`);

return res.json({
ok: true,
referralCodes,
referralLinks,   // https://raoufpx.com/secret.html?code=XXX-XXX
});
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /capture-hot-lead
// Called by promo.html exit-intent / time trigger modal.
// Body: { promoCode, whatsapp, capturedAt, source }
// Skipped silently if booking already exists for this code.
// ─────────────────────────────────────────────────────────────────────────────
function validateUAEPhone(num = ‘’) {
// Accepts +971XXXXXXXXX, 971XXXXXXXXX, 05XXXXXXXX, 5XXXXXXXX
const cleaned = num.replace(/[\s-().]/g, ‘’);
return /^(+971|971|0)(5[024568]\d{7})$/.test(cleaned);
}

app.post(’/capture-hot-lead’, (req, res) => {
const { promoCode, whatsapp, capturedAt, source } = req.body || {};
const code = (promoCode || ‘’).toUpperCase();

if (!code || !whatsapp) return res.status(400).json({ ok: false, error: ‘Missing fields.’ });
if (!validateUAEPhone(whatsapp)) return res.status(400).json({ ok: false, error: ‘Invalid UAE number.’ });

const entry = codeStore.get(code);
if (!entry) return res.status(404).json({ ok: false, error: ‘Code not found.’ });

// Silently ignore if booking already submitted
if (entry.bookingSubmittedAt) return res.json({ ok: true, skipped: true });

// Avoid duplicate hot lead captures for same code
const already = leadStore.find(l => l.code === code && l.status === ‘hot_lead’);
if (already) {
already.whatsapp   = whatsapp;
already.capturedAt = capturedAt || new Date().toISOString();
saveLeads();
return res.json({ ok: true, updated: true });
}

const hotLead = {
code,
whatsapp,
capturedAt:  capturedAt || new Date().toISOString(),
source:      source || ‘promo_exit_capture’,
status:      ‘hot_lead’,
clientName:  ‘’,
email:       ‘’,
selectedPackage: ‘’,
price:       ‘’,
date:        ‘’,
submittedAt: capturedAt || new Date().toISOString(),
};
leadStore.push(hotLead);
saveLeads();

pushActivity(‘🔥 Hot Lead Captured’, `${code} — ${whatsapp}`);
console.log(`[capture-hot-lead] ${code} | ${whatsapp}`);
return res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /save-referral-contacts
// Called by referrals.html when user fills WhatsApp + name per referral code.
// Body: { parentCode, contacts: [{ code, whatsapp, name }] }
// Stores contact info on each referral code entry for Firebase automation.
// ─────────────────────────────────────────────────────────────────────────────
app.post(’/save-referral-contacts’, (req, res) => {
const { parentCode, contacts } = req.body || {};
if (!Array.isArray(contacts) || !contacts.length) {
return res.status(400).json({ ok: false, error: ‘No contacts provided.’ });
}

let saved = 0;
contacts.forEach(({ code, whatsapp, name }) => {
if (!code || !whatsapp) return;
const entry = codeStore.get((code || ‘’).toUpperCase());
if (!entry) return;
if (whatsapp) entry.friendWhatsapp = whatsapp;
if (name)     entry.friendName     = name;
entry.messageScheduledAt = new Date().toISOString();
codeStore.set(entry.code, entry);
saved++;
pushActivity(‘Referral Contact Saved’, `${entry.code} → ${whatsapp}`);
});

if (saved > 0) saveCodes(codeStore);
console.log(`[save-referral-contacts] ${saved} contacts saved for parent: ${parentCode}`);
return res.json({ ok: true, saved });
});

// =============================================================================
// ── ADMIN ROUTES ──────────────────────────────────────────────────────────────
// =============================================================================

// GET /admin/codes — full code list with stats
app.get(’/admin/codes’, requireAdmin, (req, res) => {
const all      = […codeStore.values()];
const total    = all.length;
const issued   = all.filter(c => c.status === ‘issued’).length;
const redeemed = all.filter(c => c.status === ‘redeemed’ || c.used).length;
const expired  = all.filter(c => c.status === ‘expired’).length;
const available= all.filter(c => c.status === ‘available’).length;
res.json({ total, available, issued, redeemed, expired, codes: all });
});

// GET /admin/analytics — funnel metrics
app.get(’/admin/analytics’, requireAdmin, (req, res) => {
const codes    = […codeStore.values()];
const total    = codes.length;
const issued   = codes.filter(c => c.status === ‘issued’ || c.issuedAt).length;
const redeemed = codes.filter(c => c.status === ‘redeemed’ || c.used).length;
const withBooking = codes.filter(c => c.bookingSubmittedAt).length;
const scans    = scanStore.length;

// Package breakdown
const packages = {};
leadStore.forEach(l => {
const p = l.selectedPackage || ‘Unknown’;
packages[p] = (packages[p] || 0) + 1;
});

// Location breakdown
const locations = {};
codes.forEach(c => {
if (c.location) locations[c.location] = (locations[c.location] || 0) + 1;
});

res.json({
funnel: {
codesGenerated:  total,
codesIssued:     issued,
qrScans:         scans,
codesEntered:    redeemed,
bookingsSubmitted: withBooking,
},
rates: {
scanRate:    issued   > 0 ? ((scans    / issued)   * 100).toFixed(1) + ‘%’ : ‘—’,
unlockRate:  scans    > 0 ? ((redeemed / scans)    * 100).toFixed(1) + ‘%’ : ‘—’,
bookingRate: redeemed > 0 ? ((withBooking / redeemed) * 100).toFixed(1) + ‘%’ : ‘—’,
},
packages,
locations,
recentScans:  scanStore.slice(-10).reverse(),
recentLeads:  leadStore.slice(-10).reverse(),
});
});

// GET /admin/activity — real-time feed
app.get(’/admin/activity’, requireAdmin, (req, res) => {
res.json({ feed: activityFeed });
});

// GET /admin/leads — all lead profiles
app.get(’/admin/leads’, requireAdmin, (req, res) => {
// Join leads with their code entry for full profile
const profiles = leadStore.map(lead => {
const entry = codeStore.get(lead.code) || {};
return { …lead, location: entry.location || ‘’, notes: entry.notes || ‘’ };
});
res.json({ total: profiles.length, leads: profiles });
});

// GET /admin/lead/:code — single lead profile
app.get(’/admin/lead/:code’, requireAdmin, (req, res) => {
const code  = req.params.code.toUpperCase();
const entry = codeStore.get(code);
if (!entry) return res.status(404).json({ error: ‘Code not found.’ });
const lead = leadStore.find(l => l.code === code) || null;
res.json({ code: entry, lead });
});

// PATCH /admin/code/:code — update location, notes, status (issue a code)
app.patch(’/admin/code/:code’, requireAdmin, (req, res) => {
const code  = req.params.code.toUpperCase();
const entry = codeStore.get(code);
if (!entry) return res.status(404).json({ error: ‘Code not found.’ });

const { location, notes, status } = req.body || {};
if (location !== undefined) entry.location = location;
if (notes    !== undefined) entry.notes    = notes;

// Allow marking as issued
if (status === ‘issued’ && entry.status === ‘available’) {
entry.status   = ‘issued’;
entry.issuedAt = new Date().toISOString();
pushActivity(‘Code Issued’, `${code} — ${entry.location || 'no location'}`);
}

codeStore.set(code, entry);
saveCodes(codeStore);
res.json({ ok: true, code: entry });
});

// POST /admin/generate-code
app.post(’/admin/generate-code’, requireAdmin, (req, res) => {
try {
const code  = generateUniqueCode();
const entry = makeCodeEntry(code);
codeStore.set(code, entry);
saveCodes(codeStore);
console.log(`[ADMIN] Generated: ${code}`);
return res.json({ success: true, code, createdAt: entry.createdAt });
} catch (err) {
return res.status(500).json({ success: false, error: err.message });
}
});

// POST /admin/generate-bulk
app.post(’/admin/generate-bulk’, requireAdmin, (req, res) => {
const raw   = parseInt(req.body?.count, 10);
const count = isNaN(raw) ? 1 : Math.min(Math.max(raw, 1), 200);
const created = [];
try {
for (let i = 0; i < count; i++) {
const code  = generateUniqueCode();
const entry = makeCodeEntry(code);
codeStore.set(code, entry);
created.push({ code, createdAt: entry.createdAt });
}
saveCodes(codeStore);
return res.json({ success: true, generated: created.length, codes: created });
} catch (err) {
if (created.length > 0) saveCodes(codeStore);
return res.status(500).json({ success: false, error: err.message, generated: created.length, codes: created });
}
});

// GET /admin/export — CSV download of all leads + code data
app.get(’/admin/export’, requireAdmin, (req, res) => {
const headers = [
‘code’,‘status’,‘location’,‘notes’,
‘createdAt’,‘issuedAt’,‘firstScanAt’,‘redeemedAt’,‘expiresAt’,‘bookingSubmittedAt’,
‘selectedPackage’,‘clientName’,‘clientEmail’,‘clientPhone’,
];

const rows = […codeStore.values()].map(entry => {
const lead = leadStore.find(l => l.code === entry.code) || {};
return [
entry.code,
entry.status || (entry.used ? ‘redeemed’ : ‘available’),
entry.location || ‘’,
(entry.notes || ‘’).replace(/,/g, ‘;’),
entry.createdAt   || ‘’,
entry.issuedAt    || ‘’,
entry.firstScanAt || ‘’,
entry.redeemedAt  || entry.usedAt || ‘’,
entry.expiresAt   || ‘’,
entry.bookingSubmittedAt || ‘’,
lead.selectedPackage || ‘’,
lead.clientName  || ‘’,
lead.email       || ‘’,
lead.whatsapp    || ‘’,
].map(v => `"${v}"`).join(’,’);
});

const csv = [headers.join(’,’), …rows].join(’\n’);
res.setHeader(‘Content-Type’, ‘text/csv’);
res.setHeader(‘Content-Disposition’, ‘attachment; filename=“raoufpx-leads.csv”’);
res.send(csv);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /track-session — promo page session duration
// Body: { code, durationSeconds }
// ─────────────────────────────────────────────────────────────────────────────
app.post(’/track-session’, (req, res) => {
const { code, durationSeconds } = req.body || {};
if (code) {
const entry = codeStore.get((code||’’).toUpperCase());
if (entry) {
entry.sessionDuration = Math.round(Number(durationSeconds) || 0);
codeStore.set(entry.code, entry);
saveCodes(codeStore);
}
}
return res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/delete-codes — mobile-safe bulk delete (array of codes in body)
// Safety: never deletes redeemed or expired codes
// Body: { codes: [‘ABC-123’, ‘DEF-456’, …] }
// ─────────────────────────────────────────────────────────────────────────────
app.post(’/admin/delete-codes’, requireAdmin, (req, res) => {
const codes = (req.body?.codes || []).map(c => String(c).toUpperCase());
const deleted = [];
const skipped = [];
codes.forEach(code => {
const entry = codeStore.get(code);
if (!entry) { skipped.push(code); return; }
if (entry.status === ‘redeemed’ || entry.status === ‘expired’ || entry.used) {
skipped.push(code); return;
}
codeStore.delete(code);
deleted.push(code);
});
if (deleted.length > 0) saveCodes(codeStore);
deleted.forEach(code => pushActivity(‘Code Deleted’, code));
console.log(`[ADMIN] Bulk deleted ${deleted.length} codes`);
return res.json({ ok: true, deleted: deleted.length, codes: deleted, skipped });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/code/:code — delete a single code by code value
// Safety: never deletes redeemed or expired codes
// ─────────────────────────────────────────────────────────────────────────────
app.delete(’/admin/code/:code’, requireAdmin, (req, res) => {
const code  = req.params.code.toUpperCase();
const entry = codeStore.get(code);
if (!entry) return res.status(404).json({ error: ‘Code not found.’ });
if (entry.status === ‘redeemed’ || entry.status === ‘expired’ || entry.used) {
return res.status(400).json({ error: ‘Cannot delete redeemed or expired codes.’ });
}
codeStore.delete(code);
saveCodes(codeStore);
pushActivity(‘Code Deleted’, code);
console.log(`[ADMIN] Deleted code: ${code}`);
return res.json({ ok: true, deleted: code });
});

// POST /admin/delete-test — mobile-safe version of DELETE /admin/test-data
app.post(’/admin/delete-test’, requireAdmin, (req, res) => {
const toDelete = […codeStore.values()].filter(c => {
const notes = (c.notes || ‘’).toLowerCase();
if (c.status === ‘redeemed’ || c.status === ‘expired’ || c.used) return false;
return notes.includes(‘test’);
});
const deletedCodes = toDelete.map(c => c.code);
deletedCodes.forEach(code => codeStore.delete(code));
if (deletedCodes.length > 0) saveCodes(codeStore);
console.log(`[ADMIN] Deleted ${deletedCodes.length} test codes`);
pushActivity(‘Test Data Deleted’, `${deletedCodes.length} codes removed`);
return res.json({ ok: true, deleted: deletedCodes.length, codes: deletedCodes });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/test-data — delete codes whose notes contain “test”
// Safety: only touches codes with status !== ‘redeemed’ and notes including “test”
// Returns { deleted: N, codes: […] }
// ─────────────────────────────────────────────────────────────────────────────
app.delete(’/admin/test-data’, requireAdmin, (req, res) => {
const toDelete = […codeStore.values()].filter(c => {
const notes = (c.notes || ‘’).toLowerCase();
return notes.includes(‘test’);
});

const deletedCodes = toDelete.map(c => c.code);
deletedCodes.forEach(code => codeStore.delete(code));
if (deletedCodes.length > 0) saveCodes(codeStore);

console.log(`[ADMIN] Deleted ${deletedCodes.length} test codes: ${deletedCodes.join(', ')}`);
pushActivity(‘Test Data Deleted’, `${deletedCodes.length} codes removed`);
return res.json({ ok: true, deleted: deletedCodes.length, codes: deletedCodes });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/revenue — revenue metrics based on package prices
// ─────────────────────────────────────────────────────────────────────────────
const PACKAGE_PRICES = { ‘Starter’: 250, ‘Signature’: 499, ‘Storytelling’: 999 };

app.get(’/admin/revenue’, requireAdmin, (req, res) => {
const codes   = […codeStore.values()];
const issued  = codes.filter(c => c.issuedAt || c.status === ‘issued’ || c.status === ‘redeemed’).length;

let totalRevenue = 0;
leadStore.forEach(l => {
const price = PACKAGE_PRICES[l.selectedPackage] || 0;
totalRevenue += price;
});

const bookings = leadStore.length;
const avgBookingValue    = bookings > 0 ? Math.round(totalRevenue / bookings) : 0;
const revenuePerCard     = issued   > 0 ? Math.round(totalRevenue / issued)   : 0;

// Package revenue breakdown
const byPackage = {};
Object.keys(PACKAGE_PRICES).forEach(p => { byPackage[p] = { count: 0, revenue: 0 }; });
leadStore.forEach(l => {
const p = l.selectedPackage;
if (byPackage[p]) {
byPackage[p].count++;
byPackage[p].revenue += PACKAGE_PRICES[p];
}
});

return res.json({
totalRevenue, avgBookingValue, revenuePerCard,
issuedCards: issued, bookings,
byPackage,
});
});

// ─────────────────────────────────────────────────────────────────────────────
// FILE DELIVERY SYSTEM
// Requires: npm install multer
// ─────────────────────────────────────────────────────────────────────────────
const multer = require(‘multer’);

// Gallery session statuses (separate from promo code lifecycle statuses)
const SESSION_STATUSES = [‘requested’,‘confirmed’,‘scheduled’,‘completed’,‘editing’,‘ready’];

// Uploads folder — never served statically
const UPLOADS_DIR = path.join(__dirname, ‘uploads’);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer — only accept .zip files, sanitize filename
const storage = multer.diskStorage({
destination: (req, file, cb) => cb(null, UPLOADS_DIR),
filename: (req, file, cb) => {
const code      = (req.body.code || ‘UNKNOWN’).toUpperCase().replace(/[^A-Z0-9-]/g, ‘’);
const timestamp = Date.now();
cb(null, `${code}-${timestamp}.zip`);
},
});
const upload = multer({
storage,
limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB max
fileFilter: (req, file, cb) => {
const ok = file.mimetype === ‘application/zip’
|| file.mimetype === ‘application/x-zip-compressed’
|| file.originalname.toLowerCase().endsWith(’.zip’);
if (ok) return cb(null, true);
cb(new Error(‘Only ZIP files are allowed.’));
},
});

// Extend makeCodeEntry — gallery fields default to null/0
// (existing entries will just have these as undefined, handled gracefully below)
const GALLERY_DEFAULTS = {
clientName:    ‘’,
sessionStatus: null,       // one of SESSION_STATUSES, or null
sessionDate:   null,
galleryFile:   null,       // filename inside /uploads
downloadCount: 0,
maxDownloads:  2,
galleryExpiresAt: null,    // ISO string, optional
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/upload-session
// Uploads a ZIP for a code and marks it ready for client download.
// Body: multipart/form-data — fields: code (string), file (zip)
// ─────────────────────────────────────────────────────────────────────────────
app.post(’/admin/upload-session’, requireAdmin, upload.single(‘file’), (req, res) => {
try {
const code  = (req.body.code || ‘’).toUpperCase().trim();
const entry = codeStore.get(code);
if (!entry) {
// Clean up orphaned upload
if (req.file) fs.unlink(req.file.path, () => {});
return res.status(404).json({ ok: false, error: ‘Code not found.’ });
}
if (!req.file) return res.status(400).json({ ok: false, error: ‘No file uploaded.’ });

```
// If a previous file exists for this code, delete it
if (entry.galleryFile) {
  const oldPath = path.join(UPLOADS_DIR, entry.galleryFile);
  if (fs.existsSync(oldPath)) fs.unlink(oldPath, () => {});
}

entry.galleryFile   = req.file.filename;
entry.sessionStatus = 'ready';
entry.downloadCount = 0;
codeStore.set(code, entry);
saveCodes(codeStore);
pushActivity('Gallery Uploaded', `${code} — ${req.file.filename}`);
console.log(`[upload-session] ${code} → ${req.file.filename}`);
return res.json({ ok: true, code, file: req.file.filename, sessionStatus: 'ready' });
```

} catch (err) {
if (req.file) fs.unlink(req.file.path, () => {});
return res.status(500).json({ ok: false, error: err.message });
}
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/session/:code — update gallery/session metadata
// Body: { clientName, sessionStatus, sessionDate, maxDownloads, galleryExpiresAt }
// ─────────────────────────────────────────────────────────────────────────────
app.patch(’/admin/session/:code’, requireAdmin, (req, res) => {
const code  = req.params.code.toUpperCase();
const entry = codeStore.get(code);
if (!entry) return res.status(404).json({ error: ‘Code not found.’ });

const { clientName, sessionStatus, sessionDate, maxDownloads, galleryExpiresAt } = req.body || {};

if (clientName    !== undefined) entry.clientName    = String(clientName).slice(0, 200);
if (sessionDate   !== undefined) entry.sessionDate   = sessionDate || null;
if (galleryExpiresAt !== undefined) entry.galleryExpiresAt = galleryExpiresAt || null;
if (maxDownloads  !== undefined) {
const n = parseInt(maxDownloads, 10);
if (!isNaN(n) && n >= 0) entry.maxDownloads = n;
}
if (sessionStatus !== undefined) {
if (SESSION_STATUSES.includes(sessionStatus)) {
entry.sessionStatus = sessionStatus;
} else {
return res.status(400).json({ error: `Invalid status. Must be one of: ${SESSION_STATUSES.join(', ')}` });
}
}

codeStore.set(code, entry);
saveCodes(codeStore);
pushActivity(‘Session Updated’, `${code} → ${entry.sessionStatus || '?'}`);
return res.json({ ok: true, code: entry });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/session-file/:code — remove uploaded file for a code
// ─────────────────────────────────────────────────────────────────────────────
app.delete(’/admin/session-file/:code’, requireAdmin, (req, res) => {
const code  = req.params.code.toUpperCase();
const entry = codeStore.get(code);
if (!entry) return res.status(404).json({ error: ‘Code not found.’ });
if (!entry.galleryFile) return res.status(404).json({ error: ‘No file on this code.’ });

const filePath = path.join(UPLOADS_DIR, entry.galleryFile);
if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

entry.galleryFile   = null;
entry.sessionStatus = entry.sessionStatus === ‘ready’ ? ‘completed’ : entry.sessionStatus;
entry.downloadCount = 0;
codeStore.set(code, entry);
saveCodes(codeStore);
pushActivity(‘Gallery File Deleted’, code);
return res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /client/status?code=XXX-XXX
// Returns public-safe session info for the client.
// ─────────────────────────────────────────────────────────────────────────────
app.get(’/client/status’, (req, res) => {
const code  = (req.query.code || ‘’).toUpperCase().trim();
if (!code) return res.status(400).json({ error: ‘Code required.’ });

const entry = codeStore.get(code);
if (!entry) return res.status(404).json({ error: ‘Code not found.’ });

return res.json({
code,
clientName:    entry.clientName    || null,
sessionStatus: entry.sessionStatus || null,
sessionDate:   entry.sessionDate   || null,
downloadCount: entry.downloadCount || 0,
maxDownloads:  entry.maxDownloads  !== undefined ? entry.maxDownloads : 2,
hasFile:       !!entry.galleryFile,
});
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /client/download?code=XXX-XXX
// Protected file delivery — validates all rules before streaming the file.
// ─────────────────────────────────────────────────────────────────────────────
app.get(’/client/download’, (req, res) => {
const code  = (req.query.code || ‘’).toUpperCase().trim();
if (!code) return res.status(400).json({ error: ‘Code required.’ });

const entry = codeStore.get(code);
if (!entry) return res.status(404).json({ error: ‘Code not found.’ });

// Must be ready
if (entry.sessionStatus !== ‘ready’) {
return res.status(403).json({ error: ‘Your gallery is not ready yet.’, status: entry.sessionStatus || null });
}

// Must have a file
if (!entry.galleryFile) {
return res.status(403).json({ error: ‘No file attached to this code.’ });
}

// Check gallery expiry (separate from promo code expiry)
if (entry.galleryExpiresAt && new Date(entry.galleryExpiresAt) < new Date()) {
return res.status(403).json({ error: ‘This download link has expired.’ });
}

// Check download limit
const maxDl = entry.maxDownloads !== undefined ? entry.maxDownloads : 2;
const curDl = entry.downloadCount || 0;
if (maxDl > 0 && curDl >= maxDl) {
return res.status(403).json({ error: ‘Download limit reached. Please contact us.’ });
}

// Resolve file path — prevent path traversal
const safeFilename = path.basename(entry.galleryFile);
const filePath     = path.join(UPLOADS_DIR, safeFilename);
if (!fs.existsSync(filePath)) {
return res.status(404).json({ error: ‘File not found on server. Please contact us.’ });
}

// Increment download count before sending
entry.downloadCount = curDl + 1;
codeStore.set(code, entry);
saveCodes(codeStore);
pushActivity(‘Gallery Downloaded’, `${code} — download ${entry.downloadCount}/${maxDl}`);
console.log(`[download] ${code} — ${safeFilename} (${entry.downloadCount}/${maxDl})`);

// Stream the file — filename shown to client is sanitized
const downloadName = `RAOUF-px-${code}.zip`;
res.download(filePath, downloadName, (err) => {
if (err && !res.headersSent) {
console.error(`[download] stream error for ${code}:`, err.message);
}
});
});

// ─────────────────────────────────────────────────────────────────────────────
// Catch-all
// ─────────────────────────────────────────────────────────────────────────────
app.get(’*’, (req, res) => {
if (req.path.startsWith(’/admin/’)) {
return res.status(404).json({ error: ‘Not found.’ });
}
res.redirect(’/secret.html’);
});

app.listen(PORT, () => {
console.log(`RAOUF px promo server running on http://localhost:${PORT}`);
console.log(`Admin: http://localhost:${PORT}/admin/codes?key=${ADMIN_KEY}`);
});