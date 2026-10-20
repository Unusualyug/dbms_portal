# Run the DBMS Learning Portal

This guide runs the complete local development stack: the React website, Express API, MongoDB persistence, course content, and administrator account.

## 1. Install prerequisites

- **Node.js 20 or newer** (npm is included with Node.js).
- **A MongoDB database**, either:
  - MongoDB Community Server installed and running on your computer, or
  - a MongoDB Atlas cluster. Atlas is the simpler option if the API is running on a remote preview/server.
- Optional: MongoDB Compass is a GUI for inspecting a database; it does not replace MongoDB Server or Atlas.

## 2. Extract the ZIP and open a terminal

Extract `dbms-learning-portal.zip`. Open a terminal in the extracted `dbms-learning-portal` folder—the folder containing the root `package.json`.

Install the project dependencies once:

```bash
npm install
```

Do not run this command from `client/` or `server/`; run it from the project root.

## 3. Create and configure `.env`

Make a private environment file from the example.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS/Linux:**

```bash
cp .env.example .env
```

Open `.env` in a text editor. Set at least these values:

```dotenv
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/dbms_learning_portal
JWT_SECRET=PASTE_A_LONG_RANDOM_SECRET_HERE
ADMIN_EMAIL=yglakhani@gmiu.edu.in
ADMIN_PASSWORD=CHOOSE_A_PRIVATE_PASSWORD_AT_LEAST_12_CHARACTERS_LONG
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
```

### Choose your MongoDB connection

**Local MongoDB Server:** Keep the example `MONGODB_URI`. Make sure the MongoDB service is running on port `27017` before continuing. Compass alone is not enough; it must connect to a running local server.

**MongoDB Atlas:** In Atlas, create a database user and add the machine running this API to Network Access. Copy the Node.js driver connection string and replace the local URI, for example:

```dotenv
MONGODB_URI=mongodb+srv://DB_USER:URL_ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/dbms_learning_portal?retryWrites=true&w=majority
```

Replace the example username, password, and cluster host with your own. URL-encode special characters in the database password. For a local computer, allow that computer's public IP in Atlas; for a hosted preview, allow the preview server's egress IP. Avoid a broad `0.0.0.0/0` rule except as a temporary, controlled test setting, and never use it for a production database.

Generate a random JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output into `JWT_SECRET`. Set a private `ADMIN_PASSWORD` with at least 12 characters. There is no default administrator password. **Do not share or commit `.env`; it contains credentials.**

## 4. Seed the course and administrator

With MongoDB running/reachable and `.env` filled in, run these from the project root:

```bash
npm run validate:course
npm run seed:course
npm run seed:admin
```

The course seed imports the official 5-module syllabus, its 52 practical prompts, and the portal-authored practice questions. The admin seed creates the fixed administrator account:

- **Email:** `yglakhani@gmiu.edu.in`
- **Password:** the value you set for `ADMIN_PASSWORD` in `.env`

Students can create accounts through the registration page. The registration form supports semesters 3 and 5, and classes X1, X2, Y1, and Y2.

## 5. Start the full website

From the project root:

```bash
npm run dev
```

This starts both the website and API. Keep this terminal open while using the app.

- **Website:** <http://localhost:5173>
- **API health check:** <http://localhost:5000/api/health>

The health endpoint should return JSON with `"status":"ok"` and `"database":"connected"`. Press **Ctrl+C** in the terminal to stop both development servers.

## 6. Optional integrations

The website and regular database-backed features run without these integrations, but their related features are limited until configured:

- **Oracle SQL/PLSQL practical submissions:** No Oracle lab is needed. The portal saves a submission temporarily without executing it or showing database output. In **Admin → Review submissions**, approve it to award 20 points once and lock the practical/challenge, or request changes with feedback. Submitted code is deleted after either review decision; approval also clears prior code for that item. Pending and rejected submissions earn no points. Startup cleanup removes stored code from previously completed or legacy non-review attempts.
- **Judge0 general-code execution:** Set `JUDGE0_API_URL` and `JUDGE0_API_KEY` only if you use Judge0 for general programming languages. It is not an Oracle SQL/PLSQL engine.
- **Student profile photos:** Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the server-side `.env` to enable upload/change/remove from Profile. Uploads accept JPEG, PNG, or WebP up to 5 MB. Keep the API secret out of client code and Git.
- **Email reports and student password resets:** Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and optionally `REPORT_FROM_EMAIL` for an SMTP provider or your institution's mail server. Admins can email a report to a student's registered email; students can request a one-time password-reset link from the sign-in page. Password reset links expire after 30 minutes and are single-use. For Gmail, use an App Password where available, not your normal account password. Keep SMTP credentials in the server-side `.env`; never add them to the client. The fixed administrator password remains managed through `ADMIN_PASSWORD` and `npm run seed:admin`.

After changing `.env`, stop and restart `npm run dev` so the server loads the new values.

## Production build (optional)

For a production-style single-server run, build the client:

```bash
npm run build
```

Configure the production environment before starting the API: use a reachable MongoDB URI, a strong private `JWT_SECRET`, `NODE_ENV=production`, `COOKIE_SECURE=true`, and the exact HTTPS site URL in `CLIENT_URL`. Then run:

```bash
npm start
```

The Express server serves the built client from `client/dist` in production. Put it behind HTTPS/TLS for real users; do not use development secrets or development cookie settings in production.

## Troubleshooting

- **`MONGODB_URI is empty` or auth/admin pages show a database error:** check that the root `.env` exists, contains `MONGODB_URI`, and restart the server.
- **`ECONNREFUSED 127.0.0.1:27017`:** the local MongoDB service is not running. Start it or switch to Atlas.
- **Atlas connection timeout/authentication error:** check Network Access, database-user credentials, cluster host, and URL-encode special characters in the password.
- **Admin sign-in fails:** set `ADMIN_PASSWORD` in `.env`, run `npm run seed:admin`, then sign in with the fixed admin email above.
- **Password reset says a link will be sent, but no email arrives:** confirm the server-side SMTP values and `REPORT_FROM_EMAIL`, set `CLIENT_URL` to the public HTTPS frontend, and review server logs. The response intentionally does not reveal whether an email exists.
- **Course map is empty:** run `npm run seed:course` after confirming MongoDB is connected.
- **A practical does not show as complete or add points yet:** submissions wait for administrator review. Open **Admin → Review submissions** and approve the submission. This awards points once, marks the item complete and locks it.
- **Port 5000 or 5173 is already in use:** stop the other process using that port, then restart the portal.

## Useful verification commands

```bash
npm test
npm run validate:course
npm run build
```
