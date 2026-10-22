const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const requireDatabase = require("../middleware/requireDatabase");
const { requireAuth, requireRole } = require("../middleware/auth");
const admin = require("../controllers/adminController");
const content = require("../controllers/contentController");
const submissions = require("../controllers/submissionReviewController");
const support = require("../controllers/supportController");
const examResult = require("../controllers/examResultController");
const router = express.Router();

router.use(requireDatabase, requireAuth, requireRole("admin"));
router.get("/dashboard", asyncHandler(admin.dashboard));
router.get("/students", asyncHandler(admin.students));
router.delete("/students/:id", asyncHandler(admin.removeStudent));
router.get("/students/:id", asyncHandler(admin.studentDetail));
router.post(
  "/students/:id/report-email",
  asyncHandler(admin.emailStudentReport),
);
router.get("/online-students", asyncHandler(admin.onlineStudents));
router.get("/topics/analytics", asyncHandler(admin.topicAnalytics));
router.get("/questions/analytics", asyncHandler(admin.questionAnalytics));
router.get("/practicals/analytics", asyncHandler(admin.practicalAnalytics));
router.get("/time-analytics", asyncHandler(admin.timeAnalytics));
router.get("/activity", asyncHandler(admin.activity));
router.get("/system-stats", asyncHandler(admin.systemStats));
router.get("/content/validation", asyncHandler(content.validationSummary));
router.get("/submissions", asyncHandler(submissions.listSubmissions));
router.post(
  "/submissions/:type/:attemptId/review",
  asyncHandler(submissions.reviewSubmission),
);
router.get("/support", asyncHandler(support.listAdminSupportMessages));
router.post("/support/:id/reply", asyncHandler(support.replyToSupportMessage));
router.post(
  "/support/:id/retry-email",
  asyncHandler(support.retrySupportReplyEmail),
);
router.delete("/support/:id", asyncHandler(support.deleteSupportMessage));
router.get("/exam-result", asyncHandler(examResult.listAdminAssessments));
router.post("/exam-result", asyncHandler(examResult.createAssessment));
router.get("/exam-result/:id", asyncHandler(examResult.getAdminAssessment));
router.patch("/exam-result/:id", asyncHandler(examResult.updateAssessment));
router.patch(
  "/exam-result/:id/marks",
  asyncHandler(examResult.saveAssessmentMarks),
);
router.post(
  "/exam-result/:id/publish",
  asyncHandler(examResult.publishAssessment),
);
router.post(
  "/exam-result/:id/unpublish",
  asyncHandler(examResult.unpublishAssessment),
);
router.delete("/exam-result/:id", asyncHandler(examResult.deleteAssessment));
router.get("/export/:type", asyncHandler(admin.exportCsv));

module.exports = router;
