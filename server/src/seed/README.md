# Seed behavior

- `seedCourse.js` imports only the checked-in official manifest and its separately labeled syllabus-derived practice checks.
- `seedAdmin.js` creates/updates only `yglakhani@gmiu.edu.in`; it requires a password from the server environment and never supplies a default.
- Neither script adds course practicals beyond the 52 exact prompts in the manifest.
- Run `npm run validate:course` at the repository root to verify module and practical counts before a deployment.