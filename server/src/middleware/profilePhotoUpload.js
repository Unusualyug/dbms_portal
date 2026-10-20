const multer = require('multer');
const HttpError = require('../utils/httpError');

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  fileFilter(req, file, callback) {
    if (!acceptedTypes.has(file.mimetype)) return callback(new HttpError(400, 'Choose a JPEG, PNG, or WebP image.'));
    callback(null, true);
  },
});

function profilePhotoUpload(req, res, next) {
  upload.single('photo')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'Profile photos must be 5 MB or smaller.'));
      return next(new HttpError(400, 'Upload one supported profile photo at a time.'));
    }
    next(error);
  });
}

module.exports = { profilePhotoUpload };
