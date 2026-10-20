const ALLOWED_LANGUAGES = new Set([63, 71, 62, 54]); // JavaScript, Python, Java, C++ on typical Judge0 CE installs.

async function runJudge0({ sourceCode, languageId, stdin = '' }) {
  if (!process.env.JUDGE0_API_URL) throw new Error('Judge0 is not configured.');
  if (!ALLOWED_LANGUAGES.has(Number(languageId))) throw new Error('This language is not enabled for the general sandbox.');
  if (typeof sourceCode !== 'string' || sourceCode.length > 20000) throw new Error('Source code is empty or exceeds the 20 KB limit.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const encoded = (value) => Buffer.from(value || '', 'utf8').toString('base64');
    const response = await fetch(`${process.env.JUDGE0_API_URL.replace(/\/$/, '')}/submissions?base64_encoded=true&wait=true`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.JUDGE0_API_KEY ? { 'X-RapidAPI-Key': process.env.JUDGE0_API_KEY } : {}),
      },
      body: JSON.stringify({ source_code: encoded(sourceCode), language_id: Number(languageId), stdin: encoded(stdin) }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Judge0 returned HTTP ${response.status}.`);
    const decode = (value) => value ? Buffer.from(value, 'base64').toString('utf8').slice(0, 12000) : '';
    return {
      status: result.status?.description || 'Unknown',
      stdout: decode(result.stdout),
      stderr: decode(result.stderr),
      compileOutput: decode(result.compile_output),
      time: result.time || null,
      memory: result.memory || null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { runJudge0, ALLOWED_LANGUAGES };
