/**
 * shared/prompts/templates.js already does the actual prompt assembly —
 * this just enforces the 500-1000 token context budget from the
 * architecture spec on top of it, by trimming the lowest-importance
 * memory summaries first if the assembled prompt comes back oversized.
 * Token counts are estimated (chars/4); good enough for a budget guard,
 * not meant to be exact.
 */
const TARGET_MAX_TOKENS = 1000;
const CHARS_PER_TOKEN_ESTIMATE = 4;

function estimateTokens(text) {
  return Math.ceil((text?.length || 0) / CHARS_PER_TOKEN_ESTIMATE);
}

// buildFn: a shared/prompts/templates.js builder, e.g. buildTutorPrompt.
// args must include `recentMemorySummaries` (array) for trimming to apply;
// builders that don't use memory summaries are simply returned as-is.
//
// Memory summaries currently come back from the DB as plain strings,
// newest first (see memoryRetriever.getRecentConversationalMemory).
// If they ever carry an `importance` score, that's used instead — lower
// importance gets dropped first. Otherwise the oldest entries (the tail
// of the newest-first array) are dropped first.
function enforceBudget(buildFn, args) {
  if (!Array.isArray(args.recentMemorySummaries)) {
    return buildFn(args);
  }

  let summaries = [...args.recentMemorySummaries];
  let prompt = buildFn({ ...args, recentMemorySummaries: summaries });
  const scored = summaries.length > 0 && typeof summaries[0] === "object" && summaries[0] !== null;

  while (estimateTokens(prompt) > TARGET_MAX_TOKENS && summaries.length > 0) {
    if (scored) {
      summaries = [...summaries].sort((a, b) => (a.importance ?? 5) - (b.importance ?? 5));
      summaries.shift();
    } else {
      summaries.pop(); // drop the oldest (last) plain-string summary
    }
    prompt = buildFn({ ...args, recentMemorySummaries: summaries });
  }

  return prompt;
}

module.exports = { enforceBudget, estimateTokens, TARGET_MAX_TOKENS };
