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
  BriefingSchema,
  ProgressAnalysisSchema,
  MemorySummarySchema,
} = require("../../../../shared/schemas/aiSchemas");

const SCHEMAS = {
  plan: PlanSchema,
  foodAnalysis: FoodAnalysisSchema,
  tutorResponse: TutorResponseSchema,
  briefing: BriefingSchema,
  progressAnalysis: ProgressAnalysisSchema,
  memorySummary: MemorySummarySchema,
};

function validate(schemaName, data) {
  const schema = SCHEMAS[schemaName];
  if (!schema) throw new Error(`Unknown schema: ${schemaName}`);
  // A model sometimes writes a paragraph in this display label. Keep the
  // plan rather than rejecting all its exercises over label length. This
  // applies ONLY to AI output; user edits still use the strict shared schema.
  // Never truncate exercise instructions or relax numeric training bounds.
  if (
    schemaName === "plan" &&
    typeof data?.goal === "string" &&
    data.goal.length > 120
  ) {
    data = { ...data, goal: `${data.goal.slice(0, 119).trimEnd()}…` };
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.flatten(),
      issues: result.error.issues.map(({ path, code }) => ({ path, code })),
    };
  }
  return { valid: true, data: sanityCheck(schemaName, result.data) };
}

// Plausibility checks beyond what Zod ranges alone catch — e.g. a single
// food item where protein grams exceed total grams is schema-valid nonsense.
function sanityCheck(schemaName, data) {
  if (schemaName === "foodAnalysis") {
    const before = data.foods.length;
    data.foods = data.foods.filter(
      (f) => f.protein <= f.grams && f.calories <= f.grams * 9,
    );
    // If plausibility filtering emptied the plate, the original confidence
    // is meaningless — "found nothing, 90% confident" would tell the client
    // NOT to ask the user for manual input.
    if (before > 0 && data.foods.length === 0) data.confidence = 0;
  }
  return data;
}

module.exports = { validate };
