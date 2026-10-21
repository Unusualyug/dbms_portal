require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../../.env"),
});
const http = require("node:http");
const { createApp } = require("./app");
const { connectDatabase } = require("./config/database");
const { initSockets } = require("./sockets");
const {
  purgeReviewedSolutions,
} = require("./services/submissionRetentionService");
const {
  startModuleCompletionEmailWorker,
} = require("./services/moduleCompletionEmailService");

async function start() {
  const app = createApp();
  const server = http.createServer(app);
  initSockets(server, app);
  if (process.env.MONGODB_URI) {
    try {
      await connectDatabase();
      const purged = await purgeReviewedSolutions();
      if (purged.total)
        console.log(
          `Removed stored SQL/PLSQL from ${purged.total} completed or non-pending submissions.`,
        );
      console.log("MongoDB connected.");
      startModuleCompletionEmailWorker();
    } catch (error) {
      console.error("MongoDB connection failed:", error.message);
      process.exit(1);
    }
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("MONGODB_URI is required in production.");
  } else {
    console.warn(
      "MONGODB_URI is empty: public syllabus and health endpoints work; persistence/auth endpoints return 503.",
    );
  }
  const port = Number(process.env.PORT) || 5000;
  server.listen(port, "0.0.0.0", () =>
    console.log(`DBMS API listening on 0.0.0.0:${port}`),
  );
  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down.`);
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
