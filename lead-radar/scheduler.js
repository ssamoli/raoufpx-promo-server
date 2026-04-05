// lead-radar/scheduler.js
// Entry point for the Railway worker process
// Runs a scan immediately on startup, then every SCAN_INTERVAL_MS
// ASCII-only

const { runScan } = require('./scanner');

const SCAN_INTERVAL_MS = 2.5 * 60 * 60 * 1000; // 2.5 hours

async function tick() {
  console.log('[scheduler] Tick at ' + new Date().toISOString());
  try {
    const result = await runScan();
    console.log('[scheduler] Scan complete. New leads: ' + result.newCount);
  } catch (e) {
    console.error('[scheduler] Scan failed:', e.message);
  }
}

// Run immediately on startup
tick();

// Then repeat on interval
setInterval(tick, SCAN_INTERVAL_MS);

// Keep process alive
process.on('uncaughtException', (err) => {
  console.error('[scheduler] Uncaught exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[scheduler] Unhandled rejection:', reason);
});

console.log('[scheduler] Lead Radar worker started. Scanning every ' + (SCAN_INTERVAL_MS / 60000) + ' minutes.');
