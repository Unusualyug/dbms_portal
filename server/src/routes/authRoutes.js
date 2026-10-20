const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const requireDatabase = require('../middleware/requireDatabase');
const { requireAuth, requireRole } = require('../middleware/auth');
const auth = require('../controllers/authController');
const profilePhotos = require('../controllers/profilePhotoController');
const { profilePhotoUpload } = require('../middleware/profilePhotoUpload');
const router = express.Router();

router.post('/register', requireDatabase, asyncHandler(auth.register));
router.post('/login', requireDatabase, asyncHandler(auth.login));
router.post('/forgot-password', requireDatabase, asyncHandler(auth.requestPasswordReset));
router.post('/reset-password', requireDatabase, asyncHandler(auth.resetPassword));
router.patch('/profile', requireDatabase, requireAuth, requireRole('student'), asyncHandler(auth.updateProfile));
router.post('/profile/photo', requireDatabase, requireAuth, requireRole('student'), profilePhotoUpload, asyncHandler(profilePhotos.uploadProfilePhoto));
router.delete('/profile/photo', requireDatabase, requireAuth, requireRole('student'), asyncHandler(profilePhotos.removeProfilePhoto));
router.patch('/password', requireDatabase, requireAuth, requireRole('student'), asyncHandler(auth.changePassword));
router.get('/me', requireDatabase, requireAuth, asyncHandler(auth.me));
router.post('/logout', requireDatabase, requireAuth, asyncHandler(auth.logout));

module.exports = router;
