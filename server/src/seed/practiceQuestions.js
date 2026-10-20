// Portal-authored, syllabus-derived learning checks. The PDF contains no official per-topic quiz bank.
// These are never represented as official practicals or as questions from the course file.
module.exports = [
  {
    key: 'm1-q1', moduleNumber: 1, topicKey: 'm1-dml', title: 'DML purpose',
    prompt: 'Which set contains the DML commands named in this course?', type: 'mcq',
    options: [
      { id: 'a', text: 'CREATE, ALTER, DROP' },
      { id: 'b', text: 'INSERT, UPDATE, DELETE' },
      { id: 'c', text: 'SELECT, ORDER BY, HAVING' },
      { id: 'd', text: 'COMMIT, ROLLBACK, SAVEPOINT' },
    ], correctAnswer: 'b', explanation: 'The syllabus lists INSERT, UPDATE and DELETE under DML.',
  },
  {
    key: 'm1-q2', moduleNumber: 1, topicKey: 'm1-having', title: 'Filtering groups',
    prompt: 'Which clause filters grouped results after GROUP BY?', type: 'mcq',
    options: [{ id: 'a', text: 'WHERE' }, { id: 'b', text: 'ORDER BY' }, { id: 'c', text: 'HAVING' }, { id: 'd', text: 'CREATE' }],
    correctAnswer: 'c', explanation: 'HAVING filters groups, often using aggregate conditions.',
  },
  {
    key: 'm2-q1', moduleNumber: 2, topicKey: 'm2-primary-key', title: 'Primary key rule',
    prompt: 'Which statement best describes a primary key?', type: 'mcq',
    options: [{ id: 'a', text: 'It allows duplicate and NULL values.' }, { id: 'b', text: 'It identifies rows and is unique and non-NULL.' }, { id: 'c', text: 'It sorts rows automatically.' }, { id: 'd', text: 'It is only used for text columns.' }],
    correctAnswer: 'b', explanation: 'A primary key uniquely identifies each row and cannot be NULL.',
  },
  {
    key: 'm2-q2', moduleNumber: 2, topicKey: 'm2-foreign-key', title: 'Referential integrity',
    prompt: 'What does a foreign key primarily help establish?', type: 'mcq',
    options: [{ id: 'a', text: 'A relationship to a referenced key' }, { id: 'b', text: 'A query sort order' }, { id: 'c', text: 'A stored PL/SQL package' }, { id: 'd', text: 'A backup file format' }],
    correctAnswer: 'a', explanation: 'A foreign key establishes and protects a relationship between tables.',
  },
  {
    key: 'm3-q1', moduleNumber: 3, topicKey: 'm3-union', title: 'Set operation',
    prompt: 'Which set operator combines compatible query results and removes duplicates by default?', type: 'mcq',
    options: [{ id: 'a', text: 'MINUS' }, { id: 'b', text: 'INTERSECT' }, { id: 'c', text: 'UNION' }, { id: 'd', text: 'SAVEPOINT' }],
    correctAnswer: 'c', explanation: 'UNION combines rows from compatible SELECT results and removes duplicates unless UNION ALL is used.',
  },
  {
    key: 'm3-q2', moduleNumber: 3, topicKey: 'm3-acid', title: 'ACID',
    prompt: 'In ACID, which property means committed results persist?', type: 'mcq',
    options: [{ id: 'a', text: 'Atomicity' }, { id: 'b', text: 'Consistency' }, { id: 'c', text: 'Isolation' }, { id: 'd', text: 'Durability' }],
    correctAnswer: 'd', explanation: 'Durability means committed transaction results persist.',
  },
  {
    key: 'm4-q1', moduleNumber: 4, topicKey: 'm4-exception-handling', title: 'PL/SQL exceptions',
    prompt: 'Which PL/SQL block section is used to handle exceptions?', type: 'mcq',
    options: [{ id: 'a', text: 'DECLARE' }, { id: 'b', text: 'BEGIN' }, { id: 'c', text: 'EXCEPTION' }, { id: 'd', text: 'PACKAGE' }],
    correctAnswer: 'c', explanation: 'The EXCEPTION section handles raised exceptions in a PL/SQL block.',
  },
  {
    key: 'm4-q2', moduleNumber: 4, topicKey: 'm4-implicit-cursor', title: 'Implicit cursor',
    prompt: 'What is true of an implicit cursor?', type: 'mcq',
    options: [{ id: 'a', text: 'It is managed automatically for a SQL statement.' }, { id: 'b', text: 'It is a table lock.' }, { id: 'c', text: 'It is always a user-defined exception.' }, { id: 'd', text: 'It replaces the database.' }],
    correctAnswer: 'a', explanation: 'Oracle manages an implicit cursor for relevant SQL statements.',
  },
  {
    key: 'm5-q1', moduleNumber: 5, topicKey: 'm5-grant', title: 'Privilege assignment',
    prompt: 'Which command assigns a privilege?', type: 'mcq',
    options: [{ id: 'a', text: 'REVOKE' }, { id: 'b', text: 'GRANT' }, { id: 'c', text: 'ROLLBACK' }, { id: 'd', text: 'DROP' }],
    correctAnswer: 'b', explanation: 'GRANT assigns privileges or roles; REVOKE removes them.',
  },
  {
    key: 'm5-q2', moduleNumber: 5, topicKey: 'm5-triggers', title: 'Trigger behavior',
    prompt: 'What is a defining behavior of a database trigger?', type: 'mcq',
    options: [{ id: 'a', text: 'It is manually run as a SELECT clause.' }, { id: 'b', text: 'It runs automatically when its configured event occurs.' }, { id: 'c', text: 'It stores a backup of every table.' }, { id: 'd', text: 'It is another name for a synonym.' }],
    correctAnswer: 'b', explanation: 'A trigger responds automatically to configured events and timing.',
  },
];
