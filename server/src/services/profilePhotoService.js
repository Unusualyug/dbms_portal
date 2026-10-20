const crypto = require('node:crypto');
const HttpError = require('../utils/httpError');
const { getCloudinary } = require('../config/cloudinary');

const mimeForFormat = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const profileFolder = 'gmiu-dbms/profile-photos';

function detectImageFormat(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function uploadBuffer(cloudinary, buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
}

async function uploadStudentPhoto(userId, file) {
  if (!file?.buffer) throw new HttpError(400, 'Choose a profile photo to upload.');
  const detectedFormat = detectImageFormat(file.buffer);
  if (!detectedFormat || mimeForFormat[detectedFormat] !== file.mimetype) {
    throw new HttpError(400, 'The uploaded file is not a valid JPEG, PNG, or WebP image.');
  }
  const cloudinary = getCloudinary();
  const publicId = `student_${String(userId)}_${crypto.randomUUID()}`;
  let uploaded;
  try {
    uploaded = await uploadBuffer(cloudinary, file.buffer, {
      resource_type: 'image',
      folder: profileFolder,
      public_id: publicId,
      overwrite: false,
      unique_filename: false,
      use_filename: false,
      allowed_formats: ['jpg', 'png', 'webp'],
    });
  } catch {
    console.error('Cloudinary profile-photo upload failed. Check the server Cloudinary configuration.');
    throw new HttpError(502, 'Could not store your profile photo. Please try again later.');
  }
  if (!uploaded?.public_id) throw new HttpError(502, 'Could not store your profile photo. Please try again later.');
  const url = cloudinary.url(uploaded.public_id, {
    secure: true,
    resource_type: 'image',
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'auto', quality: 'auto:good', fetch_format: 'auto' }],
  });
  return { publicId: uploaded.public_id, url };
}

async function deleteStudentPhoto(publicId) {
  if (!publicId) return { result: 'not found' };
  const cloudinary = getCloudinary();
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
    if (!['ok', 'not found'].includes(result?.result)) {
      throw new Error('Cloudinary did not confirm photo deletion.');
    }
    return result;
  } catch {
    console.error('Cloudinary profile-photo deletion failed. Check the server Cloudinary configuration.');
    throw new HttpError(502, 'Could not remove the stored profile photo. Please try again later.');
  }
}

module.exports = { detectImageFormat, uploadStudentPhoto, deleteStudentPhoto, profileFolder };
