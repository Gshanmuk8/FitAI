const { analyzeFoodImage } = require('../ai/aiOrchestrator');
const { buildFoodAnalysisPrompt } = require('../../../../shared/prompts/templates');

async function analyzeFoodPhoto({ imageBase64, mimeType, userId }) {
  const prompt = buildFoodAnalysisPrompt();
  return analyzeFoodImage({ imageBase64, mimeType, prompt, userId });
}

module.exports = { analyzeFoodPhoto };
