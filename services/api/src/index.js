const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'crisisdb';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

async function createServer() {
  const app = express();
  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json());
  app.use(morgan('dev'));

  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(MONGO_DB);
  const crises = db.collection('crises');

  // Normalize ensure geo field exists
  app.get('/crises', async (req, res) => {
    try {
      const since = req.query.since ? new Date(req.query.since) : null;
      const limit = Math.min(parseInt(req.query.limit || '500', 10), 2000);
      const query = {};
      if (since && !isNaN(since.getTime())) {
        query.created_at = { $gte: since };
      }
      const cursor = crises.find(query).sort({ pubDate: -1 }).limit(limit);
      const docs = await cursor.toArray();
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch crises' });
    }
  });

  app.get('/stats', async (_req, res) => {
    try {
      const total = await crises.estimatedDocumentCount();
      const byCountryAgg = await crises.aggregate([
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]).toArray();
      res.json({ total, topCountries: byCountryAgg });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // Simple server-sent events via polling new items
  app.get('/events', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let lastCheck = new Date(Date.now() - 60 * 1000);

    const interval = setInterval(async () => {
      try {
        const newItems = await crises.find({ created_at: { $gt: lastCheck } }).sort({ created_at: 1 }).limit(100).toArray();
        if (newItems.length > 0) {
          lastCheck = newItems[newItems.length - 1].created_at;
          res.write(`event: update\n`);
          res.write(`data: ${JSON.stringify(newItems)}\n\n`);
        } else {
          res.write(`event: ping\n`);
          res.write(`data: {}\n\n`);
        }
      } catch (e) {
        // keep stream alive
      }
    }, 5000);

    const keepAlive = setInterval(() => {
      res.write(`:\n\n`);
    }, 20000);

    req.on('close', () => {
      clearInterval(interval);
      clearInterval(keepAlive);
      res.end();
    });
  });

  // Cleanup old entries (older than 5 days)
  app.delete('/cleanup', async (req, res) => {
    try {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const result = await crises.deleteMany({
        $or: [
          { createdAt: { $lt: fiveDaysAgo } },
          { pubDate: { $lt: fiveDaysAgo } }
        ]
      });
      
      console.log(`Cleaned up ${result.deletedCount} entries older than 5 days`);
      res.json({ 
        success: true, 
        deletedCount: result.deletedCount,
        cutoffDate: fiveDaysAgo.toISOString()
      });
    } catch (err) {
      console.error('Cleanup failed:', err);
      res.status(500).json({ error: 'Failed to cleanup old entries' });
    }
  });

  // Get cleanup stats
  app.get('/cleanup/stats', async (req, res) => {
    try {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const oldEntries = await crises.countDocuments({
        $or: [
          { createdAt: { $lt: fiveDaysAgo } },
          { pubDate: { $lt: fiveDaysAgo } }
        ]
      });
      const totalEntries = await crises.estimatedDocumentCount();
      
      res.json({
        totalEntries,
        oldEntries,
        cutoffDate: fiveDaysAgo.toISOString(),
        percentageOld: totalEntries > 0 ? Math.round((oldEntries / totalEntries) * 100) : 0
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to get cleanup stats' });
    }
  });

  app.get('/', (_req, res) => {
    res.json({ ok: true });
  });

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API running on port ${PORT}`);
  });
}

createServer().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', err);
  process.exit(1);
});
