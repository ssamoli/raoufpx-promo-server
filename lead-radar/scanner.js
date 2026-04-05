// lead-radar/scanner.js
// ASCII-only (Railway constraint respected)
// Orchestrates all platform sources and saves new leads to leads-radar.json

const fs = require('fs');
const path = require('path');
const { scanReddit } = require('./sources/reddit');
const { scanUpwork } = require('./sources/upwork');

const DB_PATH = path.join(__dirname, '..', 'leads-radar.json');

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (_) {
    return [];
  }
}

function saveDB(leads) {
  fs.writeFileSync(DB_PATH, JSON.stringify(leads, null, 2));
}

function dedupeKey(lead) {
  // Stable identity: platform + username + link (first 80 chars)
  const link = (lead.profile_or_post_link || '').slice(0, 80);
  return `${lead.platform}::${lead.username}::${link}`;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function runScan() {
  console.log('[scanner] Starting scan at ' + new Date().toISOString());

  const existing = loadDB();
  const existingKeys = new Set(existing.map(dedupeKey));

  let newLeads = [];
  let errors = [];

  // -- Reddit --
  try {
    const redditLeads = await scanReddit();
    console.log('[scanner] Reddit: found ' + redditLeads.length + ' candidates');
    redditLeads.forEach(l => {
      const key = dedupeKey(l);
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        newLeads.push({ ...l, id: generateId(), status: 'new', notes: '', detected_time: new Date().toISOString() });
      }
    });
  } catch (e) {
    errors.push('Reddit: ' + e.message);
    console.error('[scanner] Reddit error:', e.message);
  }

  // -- Upwork --
  try {
    const upworkLeads = await scanUpwork();
    console.log('[scanner] Upwork: found ' + upworkLeads.length + ' candidates');
    upworkLeads.forEach(l => {
      const key = dedupeKey(l);
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        newLeads.push({ ...l, id: generateId(), status: 'new', notes: '', detected_time: new Date().toISOString() });
      }
    });
  } catch (e) {
    errors.push('Upwork: ' + e.message);
    console.error('[scanner] Upwork error:', e.message);
  }

  if (newLeads.length > 0) {
    const updated = [...newLeads, ...existing]; // newest first
    saveDB(updated);
    console.log('[scanner] Saved ' + newLeads.length + ' new lead(s). Total: ' + updated.length);
  } else {
    console.log('[scanner] No new leads found this scan.');
  }

  if (errors.length) {
    console.warn('[scanner] Errors during scan:', errors.join(', '));
  }

  return { newCount: newLeads.length, errors };
}

module.exports = { runScan };
