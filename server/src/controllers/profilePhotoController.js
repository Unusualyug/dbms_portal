const User = require('../models/User');
const HttpError = require('../utils/httpError');
const { userPayload } = require('./authController');
const { uploadStudentPhoto, deleteStudentPhoto } = require('../services/profilePhotoService');

const userProfileFields = 'studentId name email role semester classSection totalPoints createdAt lastLogin profilePhotoUrl';

async function uploadProfilePhoto(req, res) {
  if (!req.file) throw new HttpError(400, 'Choose a profile photo to upload.');
  const student = await User.findOne({ _id: req.user._id, role: 'student', isActive: true }).select('+profilePhotoPublicId profilePhotoUrl');
  if (!student) throw new HttpError(404, 'Student account not found.');

  const newPhoto = await uploadStudentPhoto(student._id, req.file);
  let updated;
  try {
    updated = await User.findOneAndUpdate(
      { _id: student._id, role: 'student', isActive: true },
      { $set: { profilePhotoUrl: newPhoto.url, profilePhotoPublicId: newPhoto.publicId } },
      { new: true, runValidators: true },
    ).select(userProfileFields).lean();
  } catch (error) {
    await deleteStudentPhoto(newPhoto.publicId).catch(() => {});
    throw error;
  }
  if (!updated) {
    await deleteStudentPhoto(newPhoto.publicId).catch(() => {});
    throw new HttpError(404, 'Student account not found.');
  }
  if (student.profilePhotoPublicId && student.profilePhotoPublicId !== newPhoto.publicId) {
    await deleteStudentPhoto(student.profilePhotoPublicId).catch(() => {});
  }
  res.json({ user: userPayload(updated) });
}

async function removeProfilePhoto(req, res) {
  const student = await User.findOne({ _id: req.user._id, role: 'student', isActive: true }).select('+profilePhotoPublicId profilePhotoUrl');
  if (!student) throw new HttpError(404, 'Student account not found.');
  if (student.profilePhotoPublicId) await deleteStudentPhoto(student.profilePhotoPublicId);

  const photoFilter = student.profilePhotoPublicId
    ? { profilePhotoPublicId: student.profilePhotoPublicId }
    : { profilePhotoPublicId: { $exists: false } };
  const updated = await User.findOneAndUpdate(
    { _id: student._id, role: 'student', isActive: true, ...photoFilter },
    { $unset: { profilePhotoUrl: 1, profilePhotoPublicId: 1 } },
    { new: true },
  ).select(userProfileFields).lean();
  if (!updated) throw new HttpError(409, 'Your profile photo changed during this request. Refresh and try again.');
  res.json({ user: userPayload(updated) });
}

module.exports = { uploadProfilePhoto, removeProfilePhoto };
