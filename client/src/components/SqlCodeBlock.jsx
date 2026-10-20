const TOKEN_PATTERN = /(--[^\n]*|'(?:''|[^'])*'|"(?:""|[^"])*"|\b(?:SELECT|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|ON|AS|AND|OR|NOT|NULL|IS|IN|EXISTS|GROUP|BY|ORDER|HAVING|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|VIEW|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|CHECK|DEFAULT|CONSTRAINT|GRANT|REVOKE|COMMIT|ROLLBACK|SAVEPOINT|DECLARE|BEGIN|END|IF|THEN|ELSE|ELSIF|LOOP|WHILE|FOR|CURSOR|OPEN|FETCH|CLOSE|EXCEPTION|PROCEDURE|FUNCTION|TRIGGER|PACKAGE|NUMBER|VARCHAR2|DATE|COUNT|SUM|AVG|MIN|MAX|DISTINCT|UNION|INTERSECT|MINUS|CASE|WHEN|RETURNING|INTO|DUAL)\b|\b\d+(?:\.\d+)?\b|[=<>!+*/%-]+)/gi;
const KEYWORDS = new Set('SELECT FROM WHERE JOIN INNER LEFT RIGHT FULL OUTER ON AS AND OR NOT NULL IS IN EXISTS GROUP BY ORDER HAVING INSERT INTO VALUES UPDATE SET DELETE CREATE ALTER DROP TABLE VIEW INDEX PRIMARY KEY FOREIGN REFERENCES UNIQUE CHECK DEFAULT CONSTRAINT GRANT REVOKE COMMIT ROLLBACK SAVEPOINT DECLARE BEGIN END IF THEN ELSE ELSIF LOOP WHILE FOR CURSOR OPEN FETCH CLOSE EXCEPTION PROCEDURE FUNCTION TRIGGER PACKAGE NUMBER VARCHAR2 DATE COUNT SUM AVG MIN MAX DISTINCT UNION INTERSECT MINUS CASE WHEN RETURNING DUAL'.split(' '));

function getTokenClass(token) {
  if (/^--/.test(token)) return 'sql-token-comment';
  if (/^["']/.test(token)) return 'sql-token-string';
  if (/^\d/.test(token)) return 'sql-token-number';
  if (/^[=<>!+*/%-]/.test(token)) return 'sql-token-operator';
  if (KEYWORDS.has(token.toUpperCase())) return 'sql-token-keyword';
  return '';
}

export default function SqlCodeBlock({ code, label = 'SQL example' }) {
  const parts = String(code || '').split(TOKEN_PATTERN);
  return (
    <pre className="sql-code-block" aria-label={label} tabIndex="0"><code>
      {parts.map((part, index) => {
        const tokenClass = getTokenClass(part);
        return tokenClass ? <span key={`${index}-${part}`} className={tokenClass}>{part}</span> : <span key={`${index}-plain`}>{part}</span>;
      })}
    </code></pre>
  );
}
