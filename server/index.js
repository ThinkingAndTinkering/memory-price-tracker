const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDbPromise } = require('./db');
const pricesRouter = require('./routes/prices');
const analyticsRouter = require('./routes/analytics');
const { runAllScrapers } = require('./scrapers/index');
const { startScheduler } = require('./jobs/scheduler');

const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3002;

app.use(cors());
app.use(express.json());

// Serve built client files
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// API routes
app.use('/api/prices', pricesRouter);
app.use('/api', analyticsRouter);

// Manual scrape trigger
app.post('/api/scrape', async (req, res) => {
  const result = await runAllScrapers();
  res.json(result);
});

// Health check
app.get('/api/health', async (req, res) => {
  const db = await getDbPromise();
  const result = db.exec('SELECT COUNT(*) as count FROM prices');
  const count = result.length > 0 ? result[0].values[0][0] : 0;
  res.json({ status: 'ok', priceCount: count });
});

async function start() {
  // Ensure DB is ready
  await getDbPromise();

  // Start the cron scheduler
  startScheduler();

  // SPA fallback: serve index.html for non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api/prices`);
  });
}

start().catch(console.error);
