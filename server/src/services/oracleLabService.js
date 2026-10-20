const crypto = require('node:crypto');
const { Parser } = require('node-sql-parser');

function status(value) {
  return value === true ? 'passed' : value === false ? 'failed' : 'not-run';
}

function localOracleSqlPreflight(source) {
  const procedural = /\b(DECLARE|BEGIN|CREATE\s+OR\s+REPLACE\s+(PROCEDURE|FUNCTION|PACKAGE|TRIGGER))\b/i.test(source);
  if (procedural) {
    return {
      syntaxStatus: 'not-run',
      validationEngine: 'not-configured',
      validationNote: 'PL/SQL requires the isolated Oracle lab. No procedural code was parsed or executed locally.',
      error: 'Oracle sandbox is not configured. PL/SQL syntax, expected output and database state were not verified.',
    };
  }
  try {
    const parser = new Parser();
    parser.astify(source, { database: 'Oracle' });
    return {
      syntaxStatus: 'passed',
      validationEngine: 'static SQL parser preflight',
      validationNote: 'The static parser accepted this SQL. This is not an Oracle server execution or result check.',
      error: 'Oracle sandbox is not configured. Expected-result and database-state checks were not run, so this submission is not complete.',
    };
  } catch (error) {
    return {
      syntaxStatus: 'failed',
      validationEngine: 'static SQL parser preflight',
      validationNote: 'The static parser reported a possible syntax issue. This is not a definitive Oracle compiler result; validate in the configured Oracle lab.',
      error: `Static preflight: ${String(error.message || 'parser rejected the statement').slice(0, 700)}. Oracle execution was not run.`,
    };
  }
}

async function runOraclePractical({ code, practical, studentId }) {
  if (!process.env.ORACLE_LAB_URL || !process.env.ORACLE_LAB_TOKEN) {
    const preflight = localOracleSqlPreflight(code);
    return {
      executionMode: 'preflight-only',
      ...preflight,
      expectedResultStatus: 'not-run',
      databaseStateStatus: 'not-run',
      isCorrect: null,
      output: '',
      expectedOutput: '',
      executionTimeMs: null,
    };
  }
  const timeoutMs = Math.max(1000, Math.min(Number(process.env.ORACLE_LAB_TIMEOUT_MS) || 12000, 30000));
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), timeoutMs);
  const pseudonymousStudent = crypto.createHmac('sha256', process.env.JWT_SECRET || process.env.ORACLE_LAB_TOKEN).update(String(studentId)).digest('hex');
  try {
    const response = await fetch(process.env.ORACLE_LAB_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.ORACLE_LAB_TOKEN}`,
      },
      body: JSON.stringify({
        dialect: practical.dialect,
        questionType: practical.practiceArena ? 'practice-arena' : 'official-course-practical',
        practicalKey: practical.key,
        officialPrompt: practical.prompt,
        roundTitle: practical.roundTitle || undefined,
        sectionTitle: practical.sectionTitle || undefined,
        source: code,
        studentRef: pseudonymousStudent,
        limits: { wallTimeMs: timeoutMs, maxSourceBytes: 20000, network: false, noPrivilegedDdl: true },
        requiredChecks: ['syntax', 'expected-result', 'database-state'],
      }),
      signal: abort.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Oracle lab returned HTTP ${response.status}.`);
    const syntaxStatus = status(body.syntaxValid);
    const expectedResultStatus = status(body.expectedResultValid);
    const databaseStateStatus = status(body.databaseStateValid);
    const isCorrect = syntaxStatus === 'passed' && expectedResultStatus === 'passed' && databaseStateStatus === 'passed';
    return {
      executionMode: practical.dialect === 'mysql-workbench' ? 'mysql-sandbox' : 'oracle-sandbox',
      syntaxStatus,
      validationEngine: 'configured isolated lab',
      validationNote: String(body.validationNote || 'Validated by the configured isolated lab.').slice(0, 1000),
      expectedResultStatus,
      databaseStateStatus,
      isCorrect,
      output: String(body.stdout || body.output || '').slice(0, 12000),
      expectedOutput: String(body.expectedOutput || '').slice(0, 6000),
      error: String(body.stderr || body.error || '').slice(0, 6000),
      executionTimeMs: Number.isFinite(Number(body.executionTimeMs)) ? Math.max(0, Number(body.executionTimeMs)) : null,
    };
  } catch (error) {
    return {
      executionMode: 'oracle-sandbox',
      syntaxStatus: 'not-run',
      validationEngine: 'configured isolated lab',
      validationNote: 'The configured lab did not return a verifiable result. No completion was recorded.',
      expectedResultStatus: 'not-run',
      databaseStateStatus: 'not-run',
      isCorrect: null,
      output: '',
      expectedOutput: '',
      error: error.name === 'AbortError' ? 'Oracle sandbox timed out. No completion was recorded.' : `Oracle sandbox unavailable: ${String(error.message || 'request failed').slice(0, 500)}`,
      executionTimeMs: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { runOraclePractical, localOracleSqlPreflight };
