/**
 * Converts a raw chat exchange into a one-line durable summary instead of
 * storing full transcripts. A cheap heuristic runs first; the AI is only
 * called for summarization when the exchange looks substantive, to keep
 * this off the expensive path for small talk. With no AI configured the
 * exchange is simply not summarized — system memories (memoryWriter) and
 * the other three tiers still work.
 */
const { queryAs } = require('../../db/userAccess');
const { callGeminiText, isConfigured } = require('../ai/geminiService');
const { buildMemorySummaryPrompt } = require('../../../../shared/prompts/templates');
const { MemorySummarySchema } = require('../../../../shared/schemas/aiSchemas');
const logger = require('../../utils/logger');

const TRIVIAL_PATTERNS = /^(hi|hello|hey|thanks|thank you|ok|okay|cool)\b/i;

function looksTrivial(userMessage) {
  return userMessage.trim().length < 15 || TRIVIAL_PATTERNS.test(userMessage.trim());
}

async function summarizeAndStore({ userId, mode, userMessage, aiAnswer }) {
  if (looksTrivial(userMessage)) return null;
  if (!isConfigured()) return null; // no summarizer available — skip quietly

  let parsed;
  try {
    const raw = await callGeminiText(buildMemorySummaryPrompt({ userMessage, aiAnswer }));
    const result = MemorySummarySchema.safeParse(raw);
    if (!result.success) return null;
    parsed = result.data;
  } catch (err) {
    logger.error('memory summarization failed, skipping', { error: err.message });
    return null;
  }

  if (!parsed.summary || parsed.summary === 'SKIP') return null;

  await queryAs(userId,
    `INSERT INTO memory_summaries (user_id, mode, summary, category, importance, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [userId, mode, parsed.summary, parsed.category, parsed.importance]
  );
  return parsed.summary;
}

module.exports = { summarizeAndStore };
