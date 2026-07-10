const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = require('../config/env');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  const token = authHeader.slice('Bearer '.length);
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = data.user;
    next();
  } catch (err) {
    // A thrown error here is the auth SERVICE failing (network, outage) —
    // not a bad token. Saying 401 would make every client force-logout its
    // user during a Supabase blip; 503 tells them to retry instead.
    require('../utils/logger').error('auth service unreachable', { error: err.message });
    res.status(503).json({ error: 'Authentication service unavailable — try again shortly.' });
  }
}

module.exports = { requireAuth };
