/**
 * Resolves "today" in the user's timezone. Every date-keyed table
 * (daily_checklists, meals, workout_logs, daily_briefings) keys on this
 * instead of the server's CURRENT_DATE, so a user in IST rolls over at
 * their midnight, not the server's.
 *
 * Returns a YYYY-MM-DD string, or null when the user has no stored
 * timezone — models COALESCE null to CURRENT_DATE, which is exactly the
 * pre-004 behavior (safe for legacy rows and the keyless smoke test).
 *
 * The resolved date is also RATCHETED: see DailyChecklist.effectiveDate.
 * A timezone change can move the user's local date backward (flying west),
 * and letting writes follow it backward corrupts a completed day. Time only
 * moves one way, so the resolved day never decreases either.
 */
const { getProfile } = require('../models/UserProfile');
const { effectiveDate } = require('../models/DailyChecklist');

function localDateInZone(timezone, at = new Date()) {
  if (!timezone) return null;
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(at);
  } catch {
    return null; // bad/unknown IANA name -> server date fallback
  }
}

// The ratchet, given an already-loaded profile — callers that just read the
// profile shouldn't pay for a second read.
async function resolveUserDate(userId, profile) {
  return effectiveDate(userId, localDateInZone(profile?.timezone));
}

async function getUserToday(userId) {
  const profile = await getProfile(userId);
  return resolveUserDate(userId, profile);
}

module.exports = { getUserToday, resolveUserDate, localDateInZone };
