// ── LEAD RADAR API ──
// Add these routes to your existing server.js
// Place them alongside your existing /admin/ routes
// ASCII-only - safe for Railway

const RADAR_DB_PATH = path.join(__dirname, 'leads-radar.json');

function loadRadarLeads() {
  try {
    return JSON.parse(fs.readFileSync(RADAR_DB_PATH, 'utf8'));
  } catch (_) {
    return [];
  }
}
function saveRadarLeads(leads) {
  fs.writeFileSync(RADAR_DB_PATH, JSON.stringify(leads, null, 2));
}

// Middleware: require admin key (reuse your existing pattern)
function requireAdminKey(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /api/leads - list all leads, optional ?status=new&platform=reddit
app.get('/api/leads', requireAdminKey, (req, res) => {
  let leads = loadRadarLeads();
  if (req.query.status) leads = leads.filter(l => l.status === req.query.status);
  if (req.query.platform) leads = leads.filter(l => l.platform === req.query.platform);
  res.json({ leads, total: leads.length });
});

// PATCH /api/leads/:id - update status and/or notes
app.patch('/api/leads/:id', requireAdminKey, (req, res) => {
  const leads = loadRadarLeads();
  const idx = leads.findIndex(l => l.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });

  const allowed = ['status', 'notes'];
  allowed.forEach(field => {
    if (req.body[field] !== undefined) leads[idx][field] = req.body[field];
  });

  saveRadarLeads(leads);
  res.json(leads[idx]);
});

// DELETE /api/leads/:id
app.delete('/api/leads/:id', requireAdminKey, (req, res) => {
  const leads = loadRadarLeads();
  const filtered = leads.filter(l => l.id !== req.params.id);
  if (filtered.length === leads.length) return res.status(404).json({ error: 'Not found' });
  saveRadarLeads(filtered);
  res.json({ deleted: true });
});

// POST /api/leads/test - inject a test lead manually
app.post('/api/leads/test', requireAdminKey, (req, res) => {
  const leads = loadRadarLeads();
  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    platform: req.body.platform || 'reddit',
    username: req.body.username || '@test_user',
    profile_or_post_link: req.body.link || 'https://reddit.com/r/dubai/test',
    location: req.body.location || 'Dubai',
    caption_or_title: req.body.caption || 'Test lead injected manually',
    detected_time: new Date().toISOString(),
    status: 'new',
    notes: ''
  };
  leads.unshift(lead);
  saveRadarLeads(leads);
  res.json(lead);
});

// Serve the radar UI
// Place your /public/radar/index.html and serve it:
app.get('/radar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'radar', 'index.html'));
});
