const cron = require('node-cron');
const { runAllScrapers } = require('../scrapers/index');

function startScheduler() {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled scrape...`);
    const result = await runAllScrapers();
    console.log(`[${new Date().toISOString()}] Scrape result:`, result);
  });

  console.log('Scheduler started: daily scrape at midnight');
}

module.exports = { startScheduler };
