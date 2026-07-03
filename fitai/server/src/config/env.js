require("dotenv").config();

// A value copied straight from .env's placeholders ("your-gemini-api-key",
// "https://your-project.supabase.co") is not configuration — treat it the
// same as unset so isConfigured() checks and boot validation stay honest.
function isPlaceholder(value) {
  return !value || /your-|example|changeme/i.test(value);
}

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const env = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: required("DATABASE_URL"),
  SUPABASE_URL: required("SUPABASE_URL"),
  SUPABASE_SERVICE_KEY: required("SUPABASE_SERVICE_KEY"),
  REDIS_URL: process.env.REDIS_URL || null,

  // ALL AI provider keys are optional — including Gemini. The orchestrator
  // cascade skips unconfigured providers and bottoms out at the rules
  // engine / static templates, so the app is fully usable with zero keys.
  GEMINI_API_KEY: isPlaceholder(process.env.GEMINI_API_KEY) ? null : process.env.GEMINI_API_KEY,
  OPENAI_API_KEY: isPlaceholder(process.env.OPENAI_API_KEY) ? null : process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: isPlaceholder(process.env.ANTHROPIC_API_KEY) ? null : process.env.ANTHROPIC_API_KEY,
  OPENROUTER_API_KEY: isPlaceholder(process.env.OPENROUTER_API_KEY) ? null : process.env.OPENROUTER_API_KEY,
  GROQ_API_KEY: isPlaceholder(process.env.GROQ_API_KEY) ? null : process.env.GROQ_API_KEY,
  CEREBRAS_API_KEY: isPlaceholder(process.env.CEREBRAS_API_KEY) ? null : process.env.CEREBRAS_API_KEY,
  CLOUDFLARE_ACCOUNT_ID: isPlaceholder(process.env.CLOUDFLARE_ACCOUNT_ID) ? null : process.env.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN: isPlaceholder(process.env.CLOUDFLARE_API_TOKEN) ? null : process.env.CLOUDFLARE_API_TOKEN,
};

/**
 * Called once at startup (server.js). Fails fast in production when core
 * infrastructure config is placeholder junk; in development it only warns,
 * so a keyless local checkout still boots.
 */
function validateEnv() {
  const problems = [];
  if (isPlaceholder(env.SUPABASE_URL)) problems.push("SUPABASE_URL looks like a placeholder");
  if (isPlaceholder(env.SUPABASE_SERVICE_KEY)) problems.push("SUPABASE_SERVICE_KEY looks like a placeholder");
  if (/user:password@/.test(env.DATABASE_URL)) problems.push("DATABASE_URL looks like a placeholder");

  const aiProviders = [
    env.GEMINI_API_KEY && "gemini",
    env.OPENAI_API_KEY && "openai",
    env.ANTHROPIC_API_KEY && "anthropic",
    env.OPENROUTER_API_KEY && "openrouter",
    env.GROQ_API_KEY && "groq",
    env.CEREBRAS_API_KEY && "cerebras",
    env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID && "cloudflare",
  ].filter(Boolean);

  if (env.NODE_ENV === "production" && problems.length) {
    throw new Error(`Refusing to start in production with invalid config: ${problems.join("; ")}`);
  }
  return { problems, aiProviders };
}

module.exports = { ...env, validateEnv };
