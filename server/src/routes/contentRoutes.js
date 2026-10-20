const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const content = require('../controllers/contentController');
const requireDatabase = require('../middleware/requireDatabase');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/syllabus', asyncHandler(content.publicSyllabus));
router.get('/validation', requireDatabase, requireAuth, requireRole('admin'), asyncHandler(content.validationSummary));

module.exports = router;
