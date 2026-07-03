/**
 * Resolves "today" in the user's timezone. Every date-keyed table
 * (daily_checklists, meals, body_weight_logs, progress_snapshots) keys on
 * this instead of the server's CURRENT_DATE, so a user in IST rolls over
 * at their midnight, not the server's.
 *
 * Returns a YYYY-MM-DD string, or null when the user has no stored
 * timezone — models COALESCE null to CURRENT_DATE, which is exactly the
 * pre-004 behavior (safe for legacy rows and the keyless smoke test).
 */
const { getProfile } = require('../models/UserProfile');

function localDateInZone(timezone, at = new Date()) {
  if (!timezone) return null;
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(at);
  } catch {
    return null; // bad/unknown IANA name -> server date fallback
  }
}

async function getUserToday(userId) {
  const profile = await getProfile(userId);
  return localDateInZone(profile?.timezone);
}

module.exports = { getUserToday, localDateInZone };
