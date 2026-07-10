const { askTutor } = require('../services/ai/aiOrchestrator');
const { buildTutorPrompt } = require('../../../shared/prompts/templates');
const { enforceBudget } = require('../services/ai/promptBuilder');
const { buildContextForUser } = require('../services/memory/contextBuilder');
const { buildActivitySnapshot } = require('../services/analytics/activitySnapshot');
const { summarizeAndStore } = require('../services/memory/memorySummarizer');

async function postTutorMessage(req, res, next) {
  try {
    const userId = req.user.id;
    const { mode, question, history } = req.body; // validated upstream by validateBody(TutorRequestSchema)

    // The coach sees the user's measured reality (weigh-ins, training,
    // nutrition, adherence) on every message — enrichment only: a snapshot
    // failure must never block the chat.
    const [{ profile, recentMemorySummaries }, activity] = await Promise.all([
      buildContextForUser(userId),
      buildActivitySnapshot(userId).catch(() => null),
    ]);
    const prompt = enforceBudget(buildTutorPrompt, { mode, profile, recentMemorySummaries, question, history, activity });

    const result = await askTutor({ mode, question, profile, prompt, history, userId, activity });

    // Fire-and-forget: don't make the user wait on memory summarization.
    summarizeAndStore({ userId, mode, userMessage: question, aiAnswer: result.answer }).catch((err) =>
      require('../utils/logger').error('tutor memory summarization failed', { error: err.message })
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { postTutorMessage };
