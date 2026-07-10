// Wraps a Zod schema as Express middleware. Use on any route accepting a
// body the AI orchestrator or DB layer will trust.
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      // Name the first offending field in the message itself — the client
      // only surfaces `error`, and a bare "Invalid request body" under a
      // 10-field form tells the user nothing about what to fix.
      const first = result.error.issues?.[0];
      const where = first?.path?.length ? `${first.path.join('.')}: ` : '';
      const message = first ? `${where}${first.message}` : 'Invalid request body';
      return res.status(400).json({ error: message, details: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
