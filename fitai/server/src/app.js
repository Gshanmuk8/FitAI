const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { v4: uuid } = require('uuid');

const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

const onboardingRoutes = require('./routes/onboarding');
const aiRoutes = require('./routes/ai');
const nutritionRoutes = require('./routes/nutrition');
const checklistRoutes = require('./routes/checklist');
const workoutRoutes = require('./routes/workout');
const memoryRoutes = require('./routes/memory');
const planRoutes = require('./routes/plan');
const progressRoutes = require('./routes/progress');
const reviewRoutes = require('./routes/reviews');
const achievementRoutes = require('./routes/achievements');
const profileRoutes = require('./routes/profile');
const { querySystem } = require('./db/userAccess');

const app = express();

// Render (and most PaaS) put exactly one proxy in front of the app. Trust
// it so req.ip is the real client IP — express-rate-limit v7 refuses to
// run when X-Forwarded-For arrives untrusted, and would 500 every request.
app.set('trust proxy', 1);

app.use(helmet());
// Development default: allow all origins (Vite dev server, local tools).
// Production: set CORS_ORIGINS=https://app.example.com[,https://…] to lock
// the API to known frontends. Optional and additive — unset keeps today's
// behavior.
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : {}));
app.use(express.json({ limit: '2mb' }));
app.use((req, _res, next) => {
  req.id = uuid();
  next();
});
app.use(apiLimiter);

// Liveness + readiness in one: the process is up, and (best-effort, 3s
// budget) whether Postgres is reachable. Load balancers can key off
// status; humans get the detail. The budget must clear the FIRST-request
// cold path: a managed Postgres (Supabase/Render) SSL handshake on a fresh
// pool routinely exceeds 1s, and a false 503 on boot can make the platform
// fail the health check and roll back a good deploy.
app.get('/health', async (_req, res) => {
  let database = 'unknown';
  let timer;
  try {
    await Promise.race([
      querySystem('SELECT 1'),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('db ping timeout')), 3000); }),
    ]);
    database = 'ok';
  } catch {
    database = 'unreachable';
  } finally {
    clearTimeout(timer); // don't leave a dangling 3s timer once the query settles
  }
  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'ok' : 'degraded',
    database,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.use('/api/onboarding', onboardingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/workout', workoutRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/profile', profileRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
