/**
 * The single write-path for memory_summaries rows that do NOT come from
 * AI summarization: plan edits, pace-status changes, milestones. These are
 * deterministic system observations, so they cost nothing and work with
 * zero AI providers — but they land in the same store the tutor reads,
 * which is what makes the coach feel like it "noticed".
 */
const { pool } = require('../../config/db');
const logger = require('../../utils/logger');

const VALID_CATEGORIES = ['injury', 'preference', 'constraint', 'progress', 'schedule', 'behavior', 'conversation'];

async function recordSystemMemory(userId, { summary, category = 'progress', importance = 2 }) {
  if (!summary) return null;
  const safeCategory = VALID_CATEGORIES.includes(category) ? category : 'conversation';
  const safeImportance = Math.min(3, Math.max(1, Math.round(importance)));
  try {
    await pool.query(
      `INSERT INTO memory_summaries (user_id, mode, summary, category, importance, created_at)
       VALUES ($1, 'system', $2, $3, $4, NOW())`,
      [userId, summary.slice(0, 300), safeCategory, safeImportance]
    );
    return summary;
  } catch (err) {
    // Memory writes are always fire-and-forget enrichment — never let one
    // fail a user-facing request.
    logger.error('recordSystemMemory failed', { error: err.message });
    return null;
  }
}

module.exports = { recordSystemMemory };
