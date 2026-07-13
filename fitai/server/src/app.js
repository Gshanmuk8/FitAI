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
const profileRoutes = require('./routes/profile');
const progressRoutes = require('./routes/progress');
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

// Every /api response is per-user: forbid ANY cache (browser, proxy, CDN)
// from storing it, so one user's response can never be replayed to another.
// ETags are disabled for the same reason — a 304 tells the client "keep the
// copy you have", which is only safe when the copy can't be someone else's.
app.set('etag', false);
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  res.set('Vary', 'Authorization');
  next();
});

// Liveness + readiness in one: the process is up, and (best-effort, 3s
// budget) whether Postgres is reachable. Load balancers can key off
// status; humans get the detail. The budget must clear the FIRST-request
// cold path: a managed Postgres (Supabase/Render) SSL handshake on a fresh
// pool routinely exceeds 1s, and a false 503 on boot can make the platform
// fail the health check and roll back a good deploy.
// Registered BEFORE the rate limiter on purpose: a platform probing every
// few seconds from one IP would otherwise burn the 200/15min budget and
// start seeing 429s — which it reads as "unhealthy" and restarts a healthy
// instance.
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

app.use(apiLimiter);

app.use('/api/onboarding', onboardingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/workout', workoutRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/progress', progressRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
