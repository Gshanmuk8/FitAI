/**
 * Production wiring for the AI platform: builds the real gateway from the
 * real provider registry, cache, validator, health monitor, breaker,
 * usage tracker, and telemetry. This is the ONLY place those singletons
 * meet — tests build their own gateway from fakes via createGateway.
 */
const { createGateway } = require('./aiGateway');
const { buildPlatformConfig } = require('./platformConfig');
const { createCircuitBreaker } = require('./circuitBreaker');
const { createUsageTracker } = require('./usageTracker');
const { createTelemetry } = require('./telemetry');
const cacheManager = require('../cacheManager');
const { validate } = require('../responseValidator');
const health = require('../providerHealthMonitor');
const logger = require('../../../utils/logger');

const gemini = require('../geminiService');
const openai = require('../openaiService');
const anthropic = require('../anthropicService');
const openrouter = require('../openRouterService');
const groq = require('../groqService');
const cerebras = require('../cerebrasService');
const cloudflare = require('../cloudflareService');

const config = buildPlatformConfig();
const breaker = createCircuitBreaker(config.breaker);
const usage = createUsageTracker({ pricing: config.pricing, budget: config.budget });
const telemetry = createTelemetry({ logger });

const providers = new Map(
  [gemini, openai, anthropic, openrouter, groq, cerebras, cloudflare].map((p) => [p.name, p])
);

const gateway = createGateway({
  providers,
  config,
  cache: cacheManager,
  validate,
  health,
  breaker,
  usage,
  telemetry,
});

module.exports = { gateway, config, breaker, usage, telemetry };
