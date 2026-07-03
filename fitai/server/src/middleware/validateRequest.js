// Wraps a Zod schema as Express middleware. Use on any route accepting a
// body the AI orchestrator or DB layer will trust.
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request body', details: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
