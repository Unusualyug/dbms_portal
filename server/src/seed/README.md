# Course seeding behavior

- `seedCourse.js` imports each subject from the checked-in official manifest and its separately labeled syllabus-derived practice checks.
- Use `npm run seed:course -- --course=OS` to seed only Operating Systems (`BET1CE14311`), or `npm run seed:course -- --course=DBMS` to reconcile DBMS. `--all` seeds both subjects.
- The DBMS seed matches legacy rows without `courseCode` and updates them in place rather than creating duplicate modules. OS rows are always matched by their explicit course code.
- Seeding can update or remove stale syllabus rows inside the selected subject, but does not delete student attempts, progress, marks, scores, support requests, or activity.
- `migrateCourseIndexes.js` is a dry run by default. It preserves existing documents, drops only recognized old unique indexes that block a second course, and ensures indexes defined by the current schemas. To apply, first restore a fresh production backup in staging and test the migration there; then use `COURSE_MIGRATION_ACK=backup-tested npm run migrate:course-indexes -- --apply`.
- Never run a seed or migration against production until a database backup has been made and the process has been tested on a restored staging copy. No seed, migration, or production database operation is run by this code change.
- `seedAdmin.js` creates/updates only `yglakhani@gmiu.edu.in`; it requires a password from the server environment and never supplies a default.
- Run `npm run validate:course` at the repository root to verify the official manifests before seeding or release.
