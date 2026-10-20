const test = require('node:test');
const assert = require('node:assert/strict');
const cloudinarySdk = require('cloudinary').v2;
const HttpError = require('../src/utils/httpError');
const User = require('../src/models/User');
const { detectImageFormat, uploadStudentPhoto, deleteStudentPhoto } = require('../src/services/profilePhotoService');

const CLOUDINARY_KEYS = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
async function withCloudinaryEnv(configured, callback) {
  const previous = Object.fromEntries(CLOUDINARY_KEYS.map((key) => [key, process.env[key]]));
  for (const [index, key] of CLOUDINARY_KEYS.entries()) {
    if (configured) process.env[key] = ['test-cloud', 'test-key', 'test-secret'][index];
    else delete process.env[key];
  }
  try { return await callback(); } finally {
    for (const key of CLOUDINARY_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('profile photos are identified by file signatures, not only browser MIME labels', () => {
  assert.equal(detectImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0x00])), 'jpeg');
  assert.equal(detectImageFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
  assert.equal(detectImageFormat(Buffer.from('RIFF0000WEBP', 'ascii')), 'webp');
  assert.equal(detectImageFormat(Buffer.from('not an image')), null);
});

test('Cloudinary profile-photo fields keep the asset ID private', () => {
  assert.equal(User.schema.path('profilePhotoUrl').options.select, undefined);
  assert.equal(User.schema.path('profilePhotoPublicId').options.select, false);
});

test('photo uploads fail safely when Cloudinary server credentials are absent', async () => {
  await withCloudinaryEnv(false, async () => {
    await assert.rejects(
      uploadStudentPhoto('student-id', { mimetype: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }),
      (error) => error instanceof HttpError && error.status === 503,
    );
  });
});

test('photo upload uses a per-student Cloudinary asset and returns a transformed secure URL', async () => {
  await withCloudinaryEnv(true, async () => {
    const originals = { uploadStream: cloudinarySdk.uploader.upload_stream, url: cloudinarySdk.url };
    let uploadOptions;
    let generatedUrlOptions;
    cloudinarySdk.uploader.upload_stream = (options, callback) => {
      uploadOptions = options;
      return { end(buffer) { assert.equal(buffer[0], 0x89); callback(null, { public_id: `${options.folder}/${options.public_id}` }); } };
    };
    cloudinarySdk.url = (publicId, options) => {
      generatedUrlOptions = { publicId, options };
      return `https://res.cloudinary.test/${publicId}`;
    };
    try {
      const photo = await uploadStudentPhoto('student-42', {
        mimetype: 'image/png',
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      });
      assert.equal(uploadOptions.folder, 'gmiu-dbms/profile-photos');
      assert.match(uploadOptions.public_id, /^student_student-42_/);
      assert.equal(uploadOptions.overwrite, false);
      assert.match(photo.publicId, /^gmiu-dbms\/profile-photos\/student_student-42_/);
      assert.equal(photo.url, `https://res.cloudinary.test/${photo.publicId}`);
      assert.equal(generatedUrlOptions.options.secure, true);
      assert.equal(generatedUrlOptions.options.transformation[0].width, 400);
      assert.equal(generatedUrlOptions.options.transformation[0].height, 400);
    } finally {
      cloudinarySdk.uploader.upload_stream = originals.uploadStream;
      cloudinarySdk.url = originals.url;
    }
  });
});

test('Cloudinary photo deletion accepts an already-removed asset', async () => {
  await withCloudinaryEnv(true, async () => {
    const originalDestroy = cloudinarySdk.uploader.destroy;
    let removedId;
    cloudinarySdk.uploader.destroy = async (publicId, options) => {
      removedId = { publicId, options };
      return { result: 'not found' };
    };
    try {
      const result = await deleteStudentPhoto('gmiu-dbms/profile-photos/student_42_image');
      assert.equal(result.result, 'not found');
      assert.equal(removedId.publicId, 'gmiu-dbms/profile-photos/student_42_image');
      assert.equal(removedId.options.resource_type, 'image');
    } finally {
      cloudinarySdk.uploader.destroy = originalDestroy;
    }
  });
});
