const { GEMINI_API_KEY } = require("./env");

// GEMINI_API_KEY is optional (see env.js) — with no key the models stay
// null, geminiService.isConfigured() returns false, and the orchestrator
// cascade skips Gemini entirely instead of the server crashing at boot.
let genAI = null;
let textModel = null;
let visionModel = null;

if (GEMINI_API_KEY) {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const { buildPlatformConfig } = require("../services/ai/platform/platformConfig");
  const model = buildPlatformConfig().models.gemini;
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  textModel = genAI.getGenerativeModel({ model });
  visionModel = genAI.getGenerativeModel({ model });
}

const isGeminiConfigured = () => Boolean(textModel);

module.exports = { genAI, textModel, visionModel, isGeminiConfigured };
