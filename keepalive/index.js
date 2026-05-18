const express = require('express');
const cron    = require('node-cron');
const https   = require('https');
const http    = require('http');

const app  = express();
const PORT = process.env.PORT || 3000;

// Add any Render-hosted URLs here (GitHub Pages never sleeps — no need)
const TARGETS = [
  { name: 'MOM Generator', url: process.env.MOM_URL  || 'https://mom-generator-jb6a.onrender.com/' },
  // Add Garvix Ops Render URL if deployed on Render (not GitHub Pages)
  // { name: 'Garvix Ops', url: process.env.GARVIX_URL || 'https://your-garvix-app.onrender.com/' },
].filter(t => t.url);

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

function ping(target) {
  const lib = target.url.startsWith('https') ? https : http;
  const req = lib.get(target.url, { timeout: 15000 }, (res) => {
    log(`✓ ${target.name} — HTTP ${res.statusCode}`);
    res.resume();
  });
  req.on('error',   (err) => log(`✗ ${target.name} — ${err.message}`));
  req.on('timeout', ()    => { log(`✗ ${target.name} — timeout`); req.destroy(); });
}

function pingAll() {
  log('--- Pinging all services ---');
  TARGETS.forEach(ping);
}

// Ping every 10 minutes — keeps Render free-tier services from sleeping
cron.schedule('*/10 * * * *', pingAll);

// Root + health endpoints — UptimeRobot pings THIS service to keep it alive
app.get('/', (_req, res) => res.json({
  status:  'alive',
  service: 'Garvix Keep-Alive',
  targets: TARGETS.map(t => t.name),
  nextPing: '≤10 minutes',
  time:    new Date().toISOString(),
}));

app.get('/health', (_req, res) => res.send('OK'));

app.listen(PORT, () => {
  log(`Keep-alive service running on port ${PORT}`);
  log(`Watching: ${TARGETS.map(t => t.name).join(', ')}`);
  pingAll();
});
