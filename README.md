# DBMS Learning Portal

A JavaScript-only MERN monorepo for the GMIU DBMS course (`BETICE13305`). It includes a React student experience, an Express/MongoDB API, one seeded administrator identity, syllabus-driven module/practical content, activity and active-time analytics, live Socket.IO presence, Recharts dashboards, and an instructor-review workflow for SQL/PLSQL submissions.

**New to the project?** Follow [`RUN_GUIDE.md`](RUN_GUIDE.md) for complete setup instructions, including MongoDB, environment configuration, seeding, and starting the full website.

## Course-file source of truth

The attached `Course_File_DBMS.pdf` is a scanned 12-page syllabus. Its structured import is `server/src/seed/courseContent.json`; this single manifest drives seeding, the student course map, practical list and validation report.

- 5 modules in the source order.
- Theory/topic manifest counts: **32, 35, 38, 22, 26** (153 flattened syllabus entries).
- Official practical counts: **16, 13, 9, 6, 8** (52 total); numbering is contiguous and source ordering is preserved.
- Module 1 Practical 12 is internally inconsistent in the scan. It is preserved as transcribed and flagged; it has not been silently rewritten.
- The PDF does not contain a per-topic quiz bank. The 10 optional checks in `server/src/seed/practiceQuestions.js` are labeled as portal-authored syllabus-derived questions and are never presented as official practicals.
- The separate **🧠 Practice Arena** contains 208 challenge cards built from the additional user-provided questions across Rounds 01–06 and the Final Round. It is independent of course modules and the official practical list; drafts autosave locally, while submitted attempts and review decisions are stored per student. The portal does not execute submissions. Code is retained only while awaiting review, then deleted; instructor approval awards +20 points once and locks that challenge.
- **Hall of Fame** shows the top 10 active students by total points by default, with optional semester and class filters. Student emails and IDs are not exposed in the ranking.
- Admins can permanently remove a student from the directory. Removal first disables sign-in, then deletes the account and its linked progress, module-manual status, attempts, Arena submissions, points, activity, session, timer and learning-time records, plus the student's Cloudinary profile photo when configured.
- The course is Oracle SQL/PLSQL-first. The Module 5 assessment named “Interactive Trigger Simulation Using MySQL Workbench” remains a separate assessment entry and is not represented as Oracle execution.

See [`docs/COURSE_CONTENT_VALIDATION.md`](docs/COURSE_CONTENT_VALIDATION.md) for the complete extracted topic/practical list, learning outcomes, source page references and execution notes.

## Requirements

- Node.js 20+ and npm.
- A MongoDB server: local MongoDB Community Server (no account needed) **or** MongoDB Atlas (requires a free/paid Atlas account). MongoDB Compass is optional and only provides a GUI to inspect the database.
- No Oracle lab is required for the submission-and-review workflow. Student SQL/PLSQL is saved as text and manually reviewed by the administrator; it is not executed.
- Optional Judge0 instance/API for general programming code only.

## Local setup

```bash
# macOS/Linux
cp .env.example .env
# Windows PowerShell: Copy-Item .env.example .env
# Edit .env: choose a MongoDB URI, set JWT_SECRET (32+ random characters),
# and set a private ADMIN_PASSWORD (12+ characters). Do not commit .env.
npm install
npm run validate:course
npm run seed:course
npm run seed:admin
npm run dev
```

For a random JWT secret, run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the output into `.env`. The example uses local MongoDB at `mongodb://127.0.0.1:27017/dbms_learning_portal`; if using Atlas, replace it with your Atlas connection string, create a database user, and allow your PC's IP in Atlas Network Access. URL-encode special characters in the database password.

- React/Vite: `http://localhost:5173`
- Express API and Socket.IO: `http://localhost:5000`
- Health check: `http://localhost:5000/api/health`

The administrator email is fixed to `yglakhani@gmiu.edu.in`. There is no default password. `seed:admin` fails closed unless `ADMIN_PASSWORD` is set and at least 12 characters; the password is bcrypt-hashed and is never included in client code. The partial unique index and seed guard enforce one admin. Student registration cannot set a role and cannot register the reserved admin email.

To start only the frontend in a no-database UI preview, run the API without `MONGODB_URI`; the public course map and health route work, while authenticated/persisted routes intentionally return `503`.

## SQL/PLSQL submission and review workflow

The official course practicals and the Practice Arena use **submission-only mode**. When a student submits SQL/PLSQL, the server stores the source in MongoDB for review. It does not send that code to Oracle, another SQL engine, or `eval()`, and it returns no database output.

The administrator opens **Review submissions** to inspect the prompt and submitted code, then approves it or requests changes with feedback. Approval awards 20 points once per practical/challenge and locks that item so the student cannot submit it again. Pending or rejected submissions earn no points; a rejected item can be revised and resubmitted. Submitted SQL/PLSQL is deleted from MongoDB after either review decision; approval clears code from all attempts for that student/item. Startup cleanup also removes code from previously completed and legacy non-review attempts. The answer key is not sent to the student's browser.

Each student has a `ModuleManualProgress` record per active course module. Its `moduleManualStatus` is `completed` only when every active official practical in that module is approved; otherwise it remains `pending`. Status is initialized/reconciled on student sign-in, after practical approval, and before progress CSV export. The CSV adds one status column per module, such as `module1ManualStatus`.

When an admin approves the final official practical in a module, the portal queues one completion email to the student's saved email address. Practice Arena challenges do not count, and submissions or rejected work do not trigger this notice. Email status is persisted per student/module to prevent repeat messages; the worker retries transient failures. Only completions that transition after this feature is deployed are notified. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` on the server. Resend sends over HTTPS, which works with Render Free where outbound SMTP ports are blocked. To mail student addresses, verify a domain you control in Resend and use a sender on that domain; never put the API key in client code or commit it.

## Contact & Support

Students can send a question or suggestion from the Contact & Support section below the Hall of Fame. The administrator reads requests in the admin Contact & Support inbox and can reply. Replies are saved in the student portal thread, and Resend attempts to email the student's saved account address. The inbox shows whether the email is pending, sending, accepted by Resend, or failed. “Accepted” means Resend accepted the send request; mailbox arrival is not independently verified. The portal reply stays visible if email setup is missing or Resend rejects the email, and the ticket cannot be deleted until Resend accepts it for sending. The admin's **Read & delete** action then permanently deletes the request and saved reply from the database; any email accepted by Resend is outside the portal and cannot be recalled. Support replies use the same server-side `RESEND_API_KEY` and verified `RESEND_FROM_EMAIL` configuration described above.

The current `/run` API paths are retained only as backward-compatible aliases; they also save a submission and do not execute SQL. No `ORACLE_LAB_URL` or Oracle connection string is needed for this workflow. If actual Oracle execution is added later, it must use a separately deployed, isolated lab adapter—not a shared personal schema.

### Judge0

`POST /api/student/code/run` integrates a server-side Judge0 endpoint for general languages (JavaScript, Python, Java, C++). It is not used to claim Oracle SQL/PLSQL correctness. Judge0 URL/key stay in backend environment variables. Never enable its SQLite language as an Oracle substitute.

## Interface, accessibility and themes

- The React client uses a shared responsive design system with locally bundled Inter typography, light/dark color tokens, and a theme toggle on the landing, sign-in/sign-up, and authenticated workspace navigation.
- Theme choice is saved in browser storage and applied before the client hydrates to avoid a theme flash; the interface defaults to the operating system preference when no choice has been saved.
- Framer Motion page/card/progress transitions honor the operating system's reduced-motion setting. SQL examples and the practical editor use readable monospace styling, syntax colors, and palette-aware editor surfaces.

## Authentication, tracking and analytics

- HTTP-only JWT cookie, bcrypt password hashing, role checks, registration/login rate limits, Helmet, CORS allowlist, Mongo sanitization and input limits.
- Student registration records semester (3 or 5) and class section (X1, X2, Y1 or Y2); these remain on the profile and are visible in admin student reports. Sign-in uses the saved values rather than asking students to reselect them.
- A correct MCQ earns 10 points once per question; an instructor-approved official practical or Practice Arena challenge earns 20 points once per item. Submitting code alone does not award points. The total is stored on the student profile and shown in the dashboard, profile, admin directory/detail reports, and student progress CSV.
- Students can update their account name, upload/change/remove a profile photo, and change their password from Profile. Photos are stored in Cloudinary; the server keeps only a secure delivery URL and private asset ID. Enable photos with `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the server environment. The sign-in page has an email-based forgotten-password flow with a one-time, 30-minute reset token; tokens are stored hashed and all sessions are revoked after a reset. The reset email requires SMTP configuration. Admin credentials remain server-managed through `ADMIN_PASSWORD`.
- Admins can trigger a personal report email from each student row. The backend sends only to the student's saved email and requires SMTP configuration in server-side environment variables.
- Session and Socket.IO heartbeats define online status using `ONLINE_THRESHOLD_SECONDS`; an open tab by itself is not online.
- Topic/practical time is written only from short server-timed heartbeat intervals. Hidden tabs stop timers; gaps over 45 seconds are discarded. Question time uses question-attempt heartbeats and is stored separately.
- Opened, started, attempted, submitted, pending-review, approved, rejected and completed states are distinct.
- A topic needs at least 20 seconds of recorded active time before completion. A practical submission is not complete until the administrator approves it.
- Admin endpoints are role-protected and paginated where event history is returned. CSV exports are available in the admin UI.

## Content import and verification

`npm run seed:course` upserts the structured official manifest, removes stale course rows only, and seeds clearly labeled derived practice checks. It does not write student activity history. Run `npm run validate:course` before seeding; the admin **Content verification** page checks actual MongoDB counts against manifest counts.

Use `npm run seed` to run both course and admin seeds after setting the admin environment variable.

## Tests

```bash
npm test
npm run validate:course
npm run build
```

The tests validate module order, official practical counts, the ambiguous scan entry, course outcomes, the 208-card Practice Arena manifest, and the manual-review decision and feedback rules.

## Environment and production notes

- Never commit `.env`; `.env.example` contains placeholders only.
- Set `NODE_ENV=production`, `COOKIE_SECURE=true`, strong `JWT_SECRET`, exact `CLIENT_URL`, HTTPS, and a private Atlas network policy.
- Serve the built client and API from the same origin where practical; the Express production server serves `client/dist`.
- Use a process manager/container platform, TLS reverse proxy, MongoDB backups, alerting, and regular dependency/security review.
- For horizontally scaled Socket.IO, use sticky sessions and a shared Socket.IO adapter; the default adapter is in-memory for a single API instance.
- MongoDB indexes are defined for identity, progress, event, attempt, time and session query paths. Check index builds and aggregation plans against production data volume before rollout.

## Main structure

```text
client/                 React + Vite + JavaScript/JSX
server/src/models/       MongoDB schemas and indexes
server/src/controllers/  Auth, student, practical and admin APIs
server/src/sockets/      Authenticated real-time presence
server/src/seed/         Official manifest, lessons and seed scripts
server/src/services/     Activity, active time, Judge0 and submission review
scripts/validate-course.js
 docs/COURSE_CONTENT_VALIDATION.md
```
