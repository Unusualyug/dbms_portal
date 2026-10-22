const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const requireDatabase = require("../middleware/requireDatabase");
const { requireAuth, requireRole } = require("../middleware/auth");
const student = require("../controllers/studentController");
const questions = require("../controllers/questionController");
const practicals = require("../controllers/practicalController");
const practiceArena = require("../controllers/practiceArenaController");
const activity = require("../controllers/activityController");
const code = require("../controllers/codeController");
const router = express.Router();

router.use(requireDatabase, requireAuth, requireRole("student"));
router.get("/dashboard", asyncHandler(student.getDashboard));
router.get("/hall-of-fame", asyncHandler(student.getHallOfFame));
router.get("/modules", asyncHandler(student.getModules));
router.get("/modules/:moduleId", asyncHandler(student.getModule));
router.get("/topics/:topicId", asyncHandler(student.getTopic));
router.post("/topics/:topicId/complete", asyncHandler(student.completeTopic));
router.get("/progress", asyncHandler(student.getProgress));
router.get("/questions", asyncHandler(questions.listQuestions));
router.post(
  "/questions/:questionId/start",
  asyncHandler(questions.startQuestion),
);
router.post(
  "/question-attempts/:attemptId/heartbeat",
  asyncHandler(questions.questionHeartbeat),
);
router.post(
  "/question-attempts/:attemptId/submit",
  asyncHandler(questions.submitQuestion),
);
router.get("/practicals", asyncHandler(practicals.listPracticals));
router.get("/practicals/:practicalId", asyncHandler(practicals.openPractical));
router.get(
  "/practicals/:practicalId/history",
  asyncHandler(practicals.getHistory),
);
router.post("/practicals/:practicalId/submit", asyncHandler(practicals.submit));
// Backward-compatible route alias; this now saves a submission and never executes SQL.
router.post("/practicals/:practicalId/run", asyncHandler(practicals.submit));
router.get("/practice-arena", asyncHandler(practiceArena.getProgress));
router.post(
  "/practice-arena/:challengeId/submit",
  asyncHandler(practiceArena.submitChallenge),
);
// Backward-compatible route alias; this now saves a submission and never executes SQL.
router.post(
  "/practice-arena/:challengeId/run",
  asyncHandler(practiceArena.submitChallenge),
);
router.post("/code/run", asyncHandler(code.runGeneralCode));
router.post("/activity", asyncHandler(activity.track));
router.post("/activity/pulse", asyncHandler(activity.pulse));
router.post("/activity/timer/start", asyncHandler(activity.timerStart));
router.post("/activity/timer/heartbeat", asyncHandler(activity.timerHeartbeat));

module.exports = router;
