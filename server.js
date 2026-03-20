‘use strict’;

const express      = require(‘express’);
const cors         = require(‘cors’);
const cookieParser = require(‘cookie-parser’);
const crypto       = require(‘crypto’);
const path         = require(‘path’);
const fs           = require(‘fs’);
const multer       = require(‘multer’);

const app  = express();
const PORT = process.env.PORT || 3000;

// —————————————————————————
// TOKEN STORE (in-memory)
// —————————————————————————
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const tokenStore   = new Map();
setInterval(() => {
const now = Date.now();
for (const [t, meta] of tokenStore) {
if (meta.expiresAt < now) tokenStore.delete(t);
}
}, 60 * 60 * 1000);

// —————————————————————————
// ACTIVITY FEED (in-memory ring buffer, last 50 events)
// —————————————————————————
const activityFeed = [];
function pushActivity(type, detail) {
if (detail === undefined) detail = ‘’;
activityFeed.unshift({ time: new Date().toISOString(), type: type, detail: detail });
if (activityFeed.length > 50) activityFeed.pop();
}

// —————————————————————————
// MIDDLEWARE
// —————————————————————————
app.use(express.json());
app.use(cookieParser());

const ALLOWED_ORIGINS = [
‘https://raoufpx.com’,
‘https://www.raoufpx.com’,
‘https://raoufpx-promo-server-production.up.railway.app’,
‘http://localhost:3000’,
‘http://127.0.0.1:3000’,
];

var corsOptions = {
origin: function(origin, cb) {
if (!origin || ALLOWED_ORIGINS.indexOf(origin) !== -1) return cb(null, true);
cb(new Error(’CORS blocked: ’ + origin));
},
methods: [‘GET’, ‘POST’, ‘PATCH’, ‘DELETE’, ‘OPTIONS’],
allowedHeaders: [‘Content-Type’, ‘Authorization’],
credentials: true,
};

app.use(cors(corsOptions));
app.options(’*’, cors(corsOptions));

// Block /uploads from static serving - only accessible via /client/download
app.use(’/uploads’, function(req, res) {
res.status(403).json({ error: ‘Forbidden.’ });
});

app.use(express.static(path.join(__dirname)));

// —————————————————————————
// ADMIN AUTH
// —————————————————————————
const ADMIN_KEY = process.env.ADMIN_KEY || ‘raoufpx-admin-2024’;

function requireAdmin(req, res, next) {
var queryKey   = req.query.key;
var authHeader = req.headers[‘authorization’] || ‘’;
var bearerKey  = authHeader.indexOf(’Bearer ’) === 0 ? authHeader.slice(7) : null;
if (queryKey === ADMIN_KEY || bearerKey === ADMIN_KEY) return next();
return res.status(403).json({ error: ‘Forbidden.’ });
}

// —————————————————————————
// JSON FILE HELPERS
// —————————————————————————
function readJSON(file, fallback) {
if (fs.existsSync(file)) {
try { return JSON.parse(fs.readFileSync(file, ‘utf8’)); } catch(e) {}
}
return fallback;
}
function writeJSON(file, data) {
fs.writeFileSync(file, JSON.stringify(data, null, 2), ‘utf8’);
}

// —————————————————————————
// CODE STORE (codes.json)
// —————————————————————————
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
code:              code,
status:            ‘available’,
createdAt:         new Date().toISOString(),
issuedAt:          null,
firstScanAt:       null,
redeemedAt:        null,
expiresAt:         null,
bookingSubmittedAt:null,
location:          ‘’,
notes:             ‘’,
sessionDuration:   null,
source:            ‘street’,
parentCode:        null,
clientName:        ‘’,
sessionStatus:     null,
sessionDate:       null,
galleryFile:       null,
downloadCount:     0,
maxDownloads:      2,
galleryExpiresAt:  null,
used:              false,
usedAt:            null,
};
}

function loadCodes() {
var data   = readJSON(CODES_FILE, []);
var stored = new Map(data.map(function(c) { return [c.code, c]; }));
for (var pair of stored) {
var entry = pair[1];
if (!entry.status) {
entry.status = entry.used ? ‘redeemed’ : ‘available’;
}
}
MASTER_CODES.forEach(function(code) {
if (!stored.has(code)) stored.set(code, makeCodeEntry(code));
});
return stored;
}

function saveCodes(store) {
writeJSON(CODES_FILE, Array.from(store.values()));
}

var codeStore = loadCodes();
saveCodes(codeStore);

// —————————————————————————
// SCAN STORE (scans.json)
// —————————————————————————
const SCANS_FILE = path.join(__dirname, ‘scans.json’);
var scanStore = readJSON(SCANS_FILE, []);
function saveScans() { writeJSON(SCANS_FILE, scanStore); }

function detectDevice(ua) {
if (!ua) ua = ‘’;
if (/tablet|ipad/i.test(ua))         return ‘tablet’;
if (/mobile|iphone|android/i.test(ua)) return ‘mobile’;
return ‘desktop’;
}
function detectBrowser(ua) {
if (!ua) ua = ‘’;
if (/edg//i.test(ua))   return ‘Edge’;
if (/chrome/i.test(ua))  return ‘Chrome’;
if (/safari/i.test(ua))  return ‘Safari’;
if (/firefox/i.test(ua)) return ‘Firefox’;
return ‘Other’;
}

// —————————————————————————
// LEAD STORE (leads.json)
// —————————————————————————
const LEADS_FILE = path.join(__dirname, ‘leads.json’);
var leadStore = readJSON(LEADS_FILE, []);
function saveLeads() { writeJSON(LEADS_FILE, leadStore); }

// —————————————————————————
// CODE GENERATOR (format: XXX-XXX)
// —————————————————————————
const CODE_CHARS = ‘ABCDEFGHJKLMNPQRSTUVWXYZ23456789’;

function generateCode() {
function rand(n) {
var bytes = crypto.randomBytes(n);
var s = ‘’;
for (var i = 0; i < n; i++) s += CODE_CHARS[bytes[i] % CODE_CHARS.length];
return s;
}
return rand(3) + ‘-’ + rand(3);
}

function generateUniqueCode() {
for (var i = 0; i < 100; i++) {
var code = generateCode();
if (!codeStore.has(code)) return code;
}
throw new Error(‘Could not generate unique code after 100 attempts.’);
}

// —————————————————————————
// EXPIRY CHECKER - runs every 10 minutes
// —————————————————————————
setInterval(function() {
var now = new Date().toISOString();
var changed = false;
codeStore.forEach(function(entry) {
if (entry.status === ‘redeemed’ && entry.expiresAt && entry.expiresAt < now) {
entry.status = ‘expired’;
changed = true;
}
});
if (changed) saveCodes(codeStore);
}, 10 * 60 * 1000);

// —————————————————————————
// FILE DELIVERY SETUP (multer)
// —————————————————————————
const SESSION_STATUSES = [‘requested’,‘confirmed’,‘scheduled’,‘completed’,‘editing’,‘ready’];

const UPLOADS_DIR = path.join(__dirname, ‘uploads’);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

var storage = multer.diskStorage({
destination: function(req, file, cb) { cb(null, UPLOADS_DIR); },
filename: function(req, file, cb) {
var code = (req.body.code || ‘UNKNOWN’).toUpperCase().replace(/[^A-Z0-9-]/g, ‘’);
cb(null, code + ‘-’ + Date.now() + ‘.zip’);
},
});

var upload = multer({
storage: storage,
limits: { fileSize: 2 * 1024 * 1024 * 1024 },
fileFilter: function(req, file, cb) {
var ok = file.mimetype === ‘application/zip’
|| file.mimetype === ‘application/x-zip-compressed’
|| file.originalname.toLowerCase().indexOf(’.zip’) !== -1;
if (ok) return cb(null, true);
cb(new Error(‘Only ZIP files are allowed.’));
},
});

// ===========================================================================
// PUBLIC ROUTES
// ===========================================================================

// POST /track-scan
app.post(’/track-scan’, function(req, res) {
var ua     = req.headers[‘user-agent’] || ‘’;
var scanId = crypto.randomBytes(8).toString(‘hex’);
var scan   = {
scanId:     scanId,
timestamp:  new Date().toISOString(),
deviceType: detectDevice(ua),
browser:    detectBrowser(ua),
country:    req.headers[‘cf-ipcountry’] || req.headers[‘x-country’] || ‘unknown’,
};
scanStore.push(scan);
saveScans();
pushActivity(‘QR Scan’, scan.deviceType + ’ / ’ + scan.browser);
return res.json({ ok: true, scanId: scanId });
});

// POST /check-code
app.post(’/check-code’, function(req, res) {
var raw  = req.body && req.body.code;
var code = typeof raw === ‘string’ ? raw.trim().toUpperCase() : ‘’;

if (!code || code.length > 20) {
return res.status(400).json({ valid: false, message: ‘No code provided.’ });
}

var entry = codeStore.get(code);

if (!entry) {
pushActivity(‘Invalid Code’, code);
return setTimeout(function() { res.json({ valid: false, message: ‘Invalid code.’ }); }, 300);
}

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

var now      = new Date().toISOString();
var expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

entry.used       = true;
entry.usedAt     = now;
entry.redeemedAt = now;
entry.expiresAt  = expiresAt;
entry.status     = ‘redeemed’;
codeStore.set(code, entry);
saveCodes(codeStore);

var token = crypto.randomBytes(32).toString(‘hex’);
var expMs  = Date.now() + TOKEN_TTL_MS;
tokenStore.set(token, { createdAt: Date.now(), expiresAt: expMs, code: code });

res.cookie(‘raoufpx_access’, token, {
httpOnly: true, sameSite: ‘None’, secure: true, maxAge: TOKEN_TTL_MS,
});

pushActivity(‘Code Redeemed’, code);
console.log(’[’ + now + ’] Code redeemed: ’ + code);
return res.json({ valid: true, message: ‘Code accepted.’, expiresAt: expMs });
});

// GET /verify-token
app.get(’/verify-token’, function(req, res) {
var token = req.cookies && req.cookies.raoufpx_access;
if (!token) return res.json({ valid: false });
var meta = tokenStore.get(token);
if (!meta) return res.json({ valid: false });
if (meta.expiresAt < Date.now()) { tokenStore.delete(token); return res.json({ valid: false }); }
return res.json({ valid: true, expiresAt: meta.expiresAt });
});

// POST /track-booking
app.post(’/track-booking’, function(req, res) {
var body            = req.body || {};
var code            = body.code;
var clientName      = body.clientName;
var email           = body.email;
var whatsapp        = body.whatsapp;
var selectedPackage = body.selectedPackage;
var price           = body.price;
var date            = body.date;
var now             = new Date().toISOString();
var upperCode       = (code || ‘’).toUpperCase();

if (upperCode) {
var entry = codeStore.get(upperCode);
if (entry) {
entry.bookingSubmittedAt = now;
if (whatsapp) entry.referrerWhatsapp = whatsapp;
codeStore.set(entry.code, entry);
}
}

var lead = {
code:            upperCode,
clientName:      clientName      || ‘’,
email:           email           || ‘’,
whatsapp:        whatsapp        || ‘’,
selectedPackage: selectedPackage || ‘’,
price:           price           || ‘’,
date:            date            || ‘’,
submittedAt:     now,
referralCodes:   [],
};

var referralCodes = [];
var referralLinks = [];

try {
for (var i = 0; i < 3; i++) {
var refCode  = generateUniqueCode();
var refEntry = makeCodeEntry(refCode);
refEntry.source           = ‘referral’;
refEntry.parentCode       = upperCode;
refEntry.referralSource   = upperCode;
refEntry.referrerName     = clientName || ‘’;
refEntry.referrerWhatsapp = whatsapp   || ‘’;
codeStore.set(refCode, refEntry);
referralCodes.push(refCode);
referralLinks.push(‘https://raoufpx.com/secret.html?code=’ + refCode);
}
} catch(err) {
console.error(’[track-booking] Referral generation failed:’, err.message);
}

lead.referralCodes = referralCodes;
leadStore.push(lead);
saveLeads();
saveCodes(codeStore);

pushActivity(‘Booking Submitted’, (selectedPackage || ‘?’) + ’ - ’ + (clientName || ‘unknown’) + ’ (+3 referrals)’);
console.log(’[’ + now + ‘] Booking: ’ + upperCode + ’ | ’ + clientName + ’ | ’ + selectedPackage + ’ | referrals: ’ + referralCodes.join(’, ’));

return res.json({ ok: true, referralCodes: referralCodes, referralLinks: referralLinks });
});

// POST /capture-hot-lead
function validateUAEPhone(num) {
if (!num) num = ‘’;
var cleaned = num.replace(/[\s-().]/g, ‘’);
return /^(+971|971|0)(5[024568]\d{7})$/.test(cleaned);
}

app.post(’/capture-hot-lead’, function(req, res) {
var body       = req.body || {};
var promoCode  = body.promoCode;
var whatsapp   = body.whatsapp;
var capturedAt = body.capturedAt;
var source     = body.source;
var code = (promoCode || ‘’).toUpperCase();

if (!code || !whatsapp) return res.status(400).json({ ok: false, error: ‘Missing fields.’ });
if (!validateUAEPhone(whatsapp)) return res.status(400).json({ ok: false, error: ‘Invalid UAE number.’ });

var entry = codeStore.get(code);
if (!entry) return res.status(404).json({ ok: false, error: ‘Code not found.’ });
if (entry.bookingSubmittedAt) return res.json({ ok: true, skipped: true });

var already = null;
for (var i = 0; i < leadStore.length; i++) {
if (leadStore[i].code === code && leadStore[i].status === ‘hot_lead’) {
already = leadStore[i];
break;
}
}

if (already) {
already.whatsapp   = whatsapp;
already.capturedAt = capturedAt || new Date().toISOString();
saveLeads();
return res.json({ ok: true, updated: true });
}

var ts = capturedAt || new Date().toISOString();
var hotLead = {
code:            code,
whatsapp:        whatsapp,
capturedAt:      ts,
source:          source || ‘promo_exit_capture’,
status:          ‘hot_lead’,
clientName:      ‘’,
email:           ‘’,
selectedPackage: ‘’,
price:           ‘’,
date:            ‘’,
submittedAt:     ts,
};
leadStore.push(hotLead);
saveLeads();
pushActivity(‘HOT Lead Captured’, code + ’ - ’ + whatsapp);
console.log(’[capture-hot-lead] ’ + code + ’ | ’ + whatsapp);
return res.json({ ok: true });
});

// POST /save-referral-contacts
app.post(’/save-referral-contacts’, function(req, res) {
var body       = req.body || {};
var parentCode = body.parentCode;
var contacts   = body.contacts;

if (!Array.isArray(contacts) || !contacts.length) {
return res.status(400).json({ ok: false, error: ‘No contacts provided.’ });
}

var saved = 0;
contacts.forEach(function(c) {
var code     = c.code;
var whatsapp = c.whatsapp;
var name     = c.name;
if (!code || !whatsapp) return;
var entry = codeStore.get((code || ‘’).toUpperCase());
if (!entry) return;
if (whatsapp) entry.friendWhatsapp    = whatsapp;
if (name)     entry.friendName        = name;
entry.messageScheduledAt = new Date().toISOString();
codeStore.set(entry.code, entry);
saved++;
pushActivity(‘Referral Contact Saved’, entry.code + ’ -> ’ + whatsapp);
});

if (saved > 0) saveCodes(codeStore);
console.log(’[save-referral-contacts] ’ + saved + ’ contacts saved for parent: ’ + parentCode);
return res.json({ ok: true, saved: saved });
});

// POST /track-session
app.post(’/track-session’, function(req, res) {
var body            = req.body || {};
var code            = body.code;
var durationSeconds = body.durationSeconds;
if (code) {
var entry = codeStore.get((code || ‘’).toUpperCase());
if (entry) {
entry.sessionDuration = Math.round(Number(durationSeconds) || 0);
codeStore.set(entry.code, entry);
saveCodes(codeStore);
}
}
return res.json({ ok: true });
});

// GET /client/status
app.get(’/client/status’, function(req, res) {
var code = (req.query.code || ‘’).toUpperCase().trim();
if (!code) return res.status(400).json({ error: ‘Code required.’ });
var entry = codeStore.get(code);
if (!entry) return res.status(404).json({ error: ‘Code not found.’ });
return res.json({
code:          code,
clientName:    entry.clientName    || null,
sessionStatus: entry.sessionStatus || null,
sessionDate:   entry.sessionDate   || null,
downloadCount: entry.downloadCount || 0,
maxDownloads:  entry.maxDownloads  !== undefined ? entry.maxDownloads : 2,
hasFile:       !!entry.galleryFile,
});
});

// GET /client/download
app.get(’/client/download’, function(req, res) {
var code = (req.query.code || ‘’).toUpperCase().trim();
if (!code) return res.status(400).json({ error: ‘Code required.’ });

var entry = codeStore.get(code);
if (!entry) return res.status(404).json({ error: ‘Code not found.’ });

if (entry.sessionStatus !== ‘ready’) {
return res.status(403).json({ error: ‘Your gallery is not ready yet.’, status: entry.sessionStatus || null });
}
if (!entry.galleryFile) {
return res.status(403).json({ error: ‘No file attached to this code.’ });
}
if (entry.galleryExpiresAt && new Date(entry.galleryExpiresAt) < new Date()) {
return res.status(403).json({ error: ‘This download link has expired.’ });
}

var maxDl = entry.maxDownloads !== undefined ? entry.maxDownloads : 2;
var curDl = entry.downloadCount || 0;
if (maxDl > 0 && curDl >= maxDl) {
return res.status(403).json({ error: ‘Download limit reached. Please contact us.’ });
}

var safeFilename = path.basename(entry.galleryFile);
var filePath     = path.join(UPLOADS_DIR, safeFilename);
if (!fs.existsSync(filePath)) {
return res.status(404).json({ error: ‘File not found on server. Please contact us.’ });
}

entry.downloadCount = curDl + 1;
codeStore.set(code, entry);
saveCodes(codeStore);
pushActivity(‘Gallery Downloaded’, code + ’ - download ’ + entry.downloadCount + ‘/’ + maxDl);
console.log(’[download] ’ + code + ’ - ’ + safeFilename + ’ (’ + entry.downloadCount + ‘/’ + maxDl + ‘)’);

res.download(filePath, ‘RAOUF-px-’ + code + ‘.zip’, function(err) {
if (err && !res.headersSent) {
console.error(’[download] stream error for ’ + code + ’: ’ + err.message);
}
});
});

// ===========================================================================
// ADMIN ROUTES
// ===========================================================================

// GET /admin/codes
app.get(’/admin/codes’, requireAdmin, function(req, res) {
var all      = Array.from(codeStore.values());
var total    = all.length;
var issued   = all.filter(function(c) { return c.status === ‘issued’; }).length;
var redeemed = all.filter(function(c) { return c.status === ‘redeemed’ || c.used; }).length;
var expired  = all.filter(function(c) { return c.status === ‘expired’; }).length;
var available= all.filter(function(c) { return c.status === ‘available’; }).length;
res.json({ total: total, available: available, issued: issued, redeemed: redeemed, expired: expired, codes: all });
});

// GET /admin/analytics
app.get(’/admin/analytics’, requireAdmin, function(req, res) {
var codes      = Array.from(codeStore.values());
var total      = codes.length;
var issued     = codes.filter(function(c) { return c.status === ‘issued’ || c.issuedAt; }).length;
var redeemed   = codes.filter(function(c) { return c.status === ‘redeemed’ || c.used; }).length;
var withBooking= codes.filter(function(c) { return c.bookingSubmittedAt; }).length;
var scans      = scanStore.length;

var packages = {};
leadStore.forEach(function(l) {
var p = l.selectedPackage || ‘Unknown’;
packages[p] = (packages[p] || 0) + 1;
});

var locations = {};
codes.forEach(function(c) {
if (c.location) locations[c.location] = (locations[c.location] || 0) + 1;
});

res.json({
funnel: {
codesGenerated:    total,
codesIssued:       issued,
qrScans:           scans,
codesEntered:      redeemed,
bookingsSubmitted: withBooking,
},
rates: {
scanRate:    issued   > 0 ? ((scans       / issued)   * 100).toFixed(1) + ‘%’ : ‘-’,
unlockRate:  scans    > 0 ? ((redeemed    / scans)    * 100).toFixed(1) + ‘%’ : ‘-’,
bookingRate: redeemed > 0 ? ((withBooking / redeemed) * 100).toFixed(1) + ‘%’ : ‘-’,
},
packages:    packages,
locations:   locations,
recentScans: scanStore.slice(-10).reverse(),
recentLeads: leadStore.slice(-10).reverse(),
});
});

// GET /admin/activity
app.get(’/admin/activity’, requireAdmin, function(req, res) {
res.json({ feed: activityFeed });
});

// GET /admin/leads
app.get(’/admin/leads’, requireAdmin, function(req, res) {
var profiles = leadStore.map(function(lead) {
var entry = codeStore.get(lead.code) || {};
return Object.assign({}, lead, { location: entry.location || ‘’, notes: entry.notes || ‘’ });
});
res.json({ total: profiles.length, leads: profiles });
});

// GET /admin/lead/:code
app.get(’/admin/lead/:code’, requireAdmin, function(req, res) {
var code  = req.params.code.toUpperCase();
var entry = codeStore.get(code);
if (!entry) return res.status(404).json({ error: ‘Code not found.’ });
var lead = null;
for (var i = 0; i < leadStore.length; i++) {
if (leadStore[i].code === code) { lead = leadStore[i]; break; }
}
res.json({ code: entry, lead: lead });
});

// PATCH /admin/code/:code
app.patch(’/admin/code/:code’, requireAdmin, function(req, res) {
var code  = req.params.code.toUpperCase();
var entry = codeStore.get(code);
if (!entry) return res.status(404).json({ error: ‘Code not found.’ });

var body     = req.body || {};
var location = body.location;
var notes    = body.notes;
var status   = body.status;

if (location !== undefined) entry.location = location;
if (notes    !== undefined) entry.notes    = notes;

if (status === ‘issued’ && entry.status === ‘available’) {
entry.status   = ‘issued’;
entry.issuedAt = new Date().toISOString();
pushActivity(‘Code Issued’, code + ’ - ’ + (entry.location || ‘no location’));
}

codeStore.set(code, entry);
saveCodes(codeStore);
res.json({ ok: true, code: entry });
});

// POST /admin/generate-code
app.post(’/admin/generate-code’, requireAdmin, function(req, res) {
try {
var code  = generateUniqueCode();
var entry = makeCodeEntry(code);
codeStore.set(code, entry);
saveCodes(codeStore);
console.log(’[ADMIN] Generated: ’ + code);
return res.json({ success: true, code: code, createdAt: entry.createdAt });
} catch(err) {
return res.status(500).json({ success: false, error: err.message });
}
});

// POST /admin/generate-bulk
app.post(’/admin/generate-bulk’, requireAdmin, function(req, res) {
var raw   = parseInt((req.body && req.body.count), 10);
var count = isNaN(raw) ? 1 : Math.min(Math.max(raw, 1), 200);
var created = [];
try {
for (var i = 0; i < count; i++) {
var code  = generateUniqueCode();
var entry = makeCodeEntry(code);
codeStore.set(code, entry);
created.push({ code: code, createdAt: entry.createdAt });
}
saveCodes(codeStore);
return res.json({ success: true, generated: created.length, codes: created });
} catch(err) {
if (created.length > 0) saveCodes(codeStore);
return res.status(500).json({ success: false, error: err.message, generated: created.length, codes: created });
}
});

// GET /admin/export
app.get(’/admin/export’, requireAdmin, function(req, res) {
var headers = [
‘code’,‘status’,‘location’,‘notes’,
‘createdAt’,‘issuedAt’,‘firstScanAt’,‘redeemedAt’,‘expiresAt’,‘bookingSubmittedAt’,
‘selectedPackage’,‘clientName’,‘clientEmail’,‘clientPhone’,
];

var rows = Array.from(codeStore.values()).map(function(entry) {
var lead = null;
for (var i = 0; i < leadStore.length; i++) {
if (leadStore[i].code === entry.code) { lead = leadStore[i]; break; }
}
if (!lead) lead = {};
return [
entry.code,
entry.status || (entry.used ? ‘redeemed’ : ‘available’),
entry.location || ‘’,
(entry.notes || ‘’).replace(/,/g, ‘;’),
entry.createdAt            || ‘’,
entry.issuedAt             || ‘’,
entry.firstScanAt          || ‘’,
entry.redeemedAt           || entry.usedAt || ‘’,
entry.expiresAt            || ‘’,
entry.bookingSubmittedAt   || ‘’,
lead.selectedPackage       || ‘’,
lead.clientName            || ‘’,
lead.email                 || ‘’,
lead.whatsapp              || ‘’,
].map(function(v) { return ‘”’ + v + ‘”’; }).join(’,’);
});

var csv = [headers.join(’,’)].concat(rows).join(’\n’);
res.setHeader(‘Content-Type’, ‘text/csv’);
res.setHeader(‘Content-Disposition’, ‘attachment; filename=“raoufpx-leads.csv”’);
res.send(csv);
});

// GET /admin/revenue
const PACKAGE_PRICES = { Starter: 250, Signature: 499, Storytelling: 999 };

app.get(’/admin/revenue’, requireAdmin, function(req, res) {
var codes  = Array.from(codeStore.values());
var issued = codes.filter(function(c) {
return c.issuedAt || c.status === ‘issued’ || c.status === ‘redeemed’;
}).length;

var totalRevenue = 0;
leadStore.forEach(function(l) {
totalRevenue += PACKAGE_PRICES[l.selectedPackage] || 0;
});

var bookings          = leadStore.length;
var avgBookingValue   = bookings > 0 ? Math.round(totalRevenue / bookings) : 0;
var revenuePerCard    = issued   > 0 ? Math.round(totalRevenue / issued)   : 0;

var byPackage = {};
Object.keys(PACKAGE_PRICES).forEach(function(p) { byPackage[p] = { count: 0, revenue: 0 }; });
leadStore.forEach(function(l) {
var p = l.selectedPackage;
if (byPackage[p]) { byPackage[p].count++; byPackage[p].revenue += PACKAGE_PRICES[p]; }
});

return res.json({
totalRevenue:    totalRevenue,
avgBookingValue: avgBookingValue,
revenuePerCard:  revenuePerCard,
issuedCards:     issued,
bookings:        bookings,
byPackage:       byPackage,
});
});

// POST /admin/upload-session
app.post(’/admin/upload-session’, requireAdmin, upload.single(‘file’), function(req, res) {
try {
var code  = (req.body.code || ‘’).toUpperCase().trim();
var entry = codeStore.get(code);
if (!entry) {
if (req.file) fs.unlink(req.file.path, function() {});
return res.status(404).json({ ok: false, error: ‘Code not found.’ });
}
if (!req.file) return res.status(400).json({ ok: false, error: ‘No file uploaded.’ });

```
if (entry.galleryFile) {
  var oldPath = path.join(UPLOADS_DIR, entry.galleryFile);
  if (fs.existsSync(oldPath)) fs.unlink(oldPath, function() {});
}

entry.galleryFile   = req.file.filename;
entry.sessionStatus = 'ready';
entry.downloadCount = 0;
codeStore.set(code, entry);
saveCodes(codeStore);
pushActivity('Gallery Uploaded', code + ' - ' + req.file.filename);
console.log('[upload-session] ' + code + ' -> ' + req.file.filename);
return res.json({ ok: true, code: code, file: req.file.filename, sessionStatus: 'ready' });
```

} catch(err) {
if (req.file) fs.unlink(req.file.path, function() {});
return res.status(500).json({ ok: false, error: err.message });
}
});

// PATCH /admin/session/:code
app.patch(’/admin/session/:code’, requireAdmin, function(req, res) {
var code  = req.params.code.toUpperCase();
var entry = codeStore.get(code);
if (!entry) return res.status(404).json({ error: ‘Code not found.’ });

var body             = req.body || {};
var clientName       = body.clientName;
var sessionStatus    = body.sessionStatus;
var sessionDate      = body.sessionDate;
var maxDownloads     = body.maxDownloads;
var galleryExpiresAt = body.galleryExpiresAt;

if (clientName       !== undefined) entry.clientName       = String(clientName).slice(0, 200);
if (sessionDate      !== undefined) entry.sessionDate      = sessionDate      || null;
if (galleryExpiresAt !== undefined) entry.galleryExpiresAt = galleryExpiresAt || null;
if (maxDownloads     !== undefined) {
var n = parseInt(maxDownloads, 10);
if (!isNaN(n) && n >= 0) entry.maxDownloads = n;
}
if (sessionStatus !== undefined) {
if (SESSION_STATUSES.indexOf(sessionStatus) !== -1) {
entry.sessionStatus = sessionStatus;
} else {
return res.status(400).json({ error: ‘Invalid status. Must be one of: ’ + SESSION_STATUSES.join(’, ’) });
}
}

codeStore.set(code, entry);
saveCodes(codeStore);
pushActivity(‘Session Updated’, code + ’ -> ’ + (entry.sessionStatus || ‘?’));
return res.json({ ok: true, code: entry });
});

// DELETE /admin/session-file/:code
app.delete(’/admin/session-file/:code’, requireAdmin, function(req, res) {
var code  = req.params.code.toUpperCase();
var entry = codeStore.get(code);
if (!entry)            return res.status(404).json({ error: ‘Code not found.’ });
if (!entry.galleryFile) return res.status(404).json({ error: ‘No file on this code.’ });

var filePath = path.join(UPLOADS_DIR, entry.galleryFile);
if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

entry.galleryFile   = null;
entry.sessionStatus = entry.sessionStatus === ‘ready’ ? ‘completed’ : entry.sessionStatus;
entry.downloadCount = 0;
codeStore.set(code, entry);
saveCodes(codeStore);
pushActivity(‘Gallery File Deleted’, code);
return res.json({ ok: true });
});

// POST /admin/delete-codes
app.post(’/admin/delete-codes’, requireAdmin, function(req, res) {
var codes   = ((req.body && req.body.codes) || []).map(function(c) { return String(c).toUpperCase(); });
var deleted = [];
var skipped = [];
codes.forEach(function(code) {
var entry = codeStore.get(code);
if (!entry) { skipped.push(code); return; }
if (entry.status === ‘redeemed’ || entry.status === ‘expired’ || entry.used) { skipped.push(code); return; }
codeStore.delete(code);
deleted.push(code);
});
if (deleted.length > 0) saveCodes(codeStore);
deleted.forEach(function(code) { pushActivity(‘Code Deleted’, code); });
console.log(’[ADMIN] Bulk deleted ’ + deleted.length + ’ codes’);
return res.json({ ok: true, deleted: deleted.length, codes: deleted, skipped: skipped });
});

// DELETE /admin/code/:code
app.delete(’/admin/code/:code’, requireAdmin, function(req, res) {
var code  = req.params.code.toUpperCase();
var entry = codeStore.get(code);
if (!entry) return res.status(404).json({ error: ‘Code not found.’ });
if (entry.status === ‘redeemed’ || entry.status === ‘expired’ || entry.used) {
return res.status(400).json({ error: ‘Cannot delete redeemed or expired codes.’ });
}
codeStore.delete(code);
saveCodes(codeStore);
pushActivity(‘Code Deleted’, code);
console.log(’[ADMIN] Deleted code: ’ + code);
return res.json({ ok: true, deleted: code });
});

// POST /admin/delete-test
app.post(’/admin/delete-test’, requireAdmin, function(req, res) {
var toDelete = Array.from(codeStore.values()).filter(function(c) {
var notes = (c.notes || ‘’).toLowerCase();
if (c.status === ‘redeemed’ || c.status === ‘expired’ || c.used) return false;
return notes.indexOf(‘test’) !== -1;
});
var deletedCodes = toDelete.map(function(c) { return c.code; });
deletedCodes.forEach(function(code) { codeStore.delete(code); });
if (deletedCodes.length > 0) saveCodes(codeStore);
console.log(’[ADMIN] Deleted ’ + deletedCodes.length + ’ test codes’);
pushActivity(‘Test Data Deleted’, deletedCodes.length + ’ codes removed’);
return res.json({ ok: true, deleted: deletedCodes.length, codes: deletedCodes });
});

// DELETE /admin/test-data
app.delete(’/admin/test-data’, requireAdmin, function(req, res) {
var toDelete = Array.from(codeStore.values()).filter(function(c) {
return (c.notes || ‘’).toLowerCase().indexOf(‘test’) !== -1;
});
var deletedCodes = toDelete.map(function(c) { return c.code; });
deletedCodes.forEach(function(code) { codeStore.delete(code); });
if (deletedCodes.length > 0) saveCodes(codeStore);
console.log(’[ADMIN] Deleted ’ + deletedCodes.length + ’ test codes: ’ + deletedCodes.join(’, ‘));
pushActivity(‘Test Data Deleted’, deletedCodes.length + ’ codes removed’);
return res.json({ ok: true, deleted: deletedCodes.length, codes: deletedCodes });
});

// ===========================================================================
// CATCH-ALL
// ===========================================================================
app.get(’*’, function(req, res) {
if (req.path.indexOf(’/admin/’) === 0) {
return res.status(404).json({ error: ‘Not found.’ });
}
res.redirect(’/secret.html’);
});

// ===========================================================================
// MULTER ERROR HANDLER (must be last middleware)
// ===========================================================================
app.use(function(err, req, res, next) {
if (err && err.code === ‘LIMIT_FILE_SIZE’) {
return res.status(413).json({ ok: false, error: ‘File too large. Max 2GB.’ });
}
if (err && err.message && err.message.indexOf(‘ZIP’) !== -1) {
return res.status(400).json({ ok: false, error: err.message });
}
next(err);
});

// ===========================================================================
// START
// ===========================================================================
app.listen(PORT, function() {
console.log(‘RAOUF px promo server running on http://localhost:’ + PORT);
console.log(‘Admin: http://localhost:’ + PORT + ‘/admin/codes?key=’ + ADMIN_KEY);
});