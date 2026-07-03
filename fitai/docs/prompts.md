# Prompt Templates

All prompts live in `shared/prompts/templates.js` so they're versioned
independently of route handlers. See that file for the tutor, plan
generation, food analysis, and form analysis prompts. Each is paired with
a Zod schema in `shared/schemas/aiSchemas.js` that the response must pass
before it reaches the user.
