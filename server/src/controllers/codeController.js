const { z } = require('zod');
const { runJudge0 } = require('../services/judge0Service');
const HttpError = require('../utils/httpError');

async function runGeneralCode(req, res) {
  const schema = z.object({
    sourceCode: z.string().min(1).max(20000),
    languageId: z.number().int(),
    stdin: z.string().max(5000).optional(),
  }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'Invalid code submission.');
  try {
    const result = await runJudge0(parsed.data);
    res.json({ result, sandbox: 'Judge0 general-code sandbox', warning: 'This endpoint is not used to validate official Oracle SQL/PLSQL practicals.' });
  } catch (error) {
    throw new HttpError(503, error.message || 'Code sandbox unavailable.');
  }
}
module.exports = { runGeneralCode };
