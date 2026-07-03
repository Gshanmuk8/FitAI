/**
 * Validates AI JSON output against the shared Zod schemas, and rejects
 * outputs that parse fine but contain physically impossible values
 * (e.g. 100g protein in a banana) — schema-valid is not the same as
 * sane, and Gemini will occasionally produce numbers that are syntactically
 * fine and substantively wrong.
 */
const {
  PlanSchema,
  FoodAnalysisSchema,
  TutorResponseSchema,
  ReviewNarrativeSchema,
} = require("../../../../shared/schemas/aiSchemas");

const SCHEMAS = {
  plan: PlanSchema,
  foodAnalysis: FoodAnalysisSchema,
  tutorResponse: TutorResponseSchema,
  reviewNarrative: ReviewNarrativeSchema,
};

function validate(schemaName, data) {
  const schema = SCHEMAS[schemaName];
  if (!schema) throw new Error(`Unknown schema: ${schemaName}`);
  const result = schema.safeParse(data);
  if (!result.success) {
    return { valid: false, errors: result.error.flatten() };
  }
  return { valid: true, data: sanityCheck(schemaName, result.data) };
}

// Plausibility checks beyond what Zod ranges alone catch — e.g. a single
// food item where protein grams exceed total grams is schema-valid nonsense.
function sanityCheck(schemaName, data) {
  if (schemaName === "foodAnalysis") {
    data.foods = data.foods.filter((f) => f.protein <= f.grams && f.calories <= f.grams * 9);
  }
  return data;
}

module.exports = { validate };
