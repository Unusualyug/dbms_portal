require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDatabase } = require('../config/database');
const User = require('../models/User');
const Session = require('../models/Session');
const { FIXED_ADMIN_EMAIL } = require('../config/constants');

async function seedAdmin() {
  const configuredEmail = (process.env.ADMIN_EMAIL || FIXED_ADMIN_EMAIL).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (configuredEmail !== FIXED_ADMIN_EMAIL) {
    throw new Error(`ADMIN_EMAIL is fixed by policy and must be ${FIXED_ADMIN_EMAIL}.`);
  }
  if (!password || password.length < 12) {
    throw new Error('Set ADMIN_PASSWORD in the server environment (minimum 12 characters); no default password is provided.');
  }
  await connectDatabase();
  const otherAdmin = await User.findOne({ role: 'admin', email: { $ne: FIXED_ADMIN_EMAIL } });
  if (otherAdmin) throw new Error('A different admin account already exists. Resolve it manually before seeding the single fixed admin.');

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await User.findOneAndUpdate(
    { email: FIXED_ADMIN_EMAIL },
    { $set: {
      name: process.env.ADMIN_NAME || 'DBMS Administrator',
      email: FIXED_ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
      isActive: true,
    }, $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 }, $setOnInsert: { studentId: undefined }, $inc: { authVersion: 1 } },
    { upsert: true, new: true, runValidators: true, select: '_id email role' },
  );
  await Session.deleteMany({ studentId: admin._id });
  const adminCount = await User.countDocuments({ role: 'admin' });
  if (adminCount !== 1) throw new Error(`Admin invariant failed: expected exactly one, found ${adminCount}.`);
  console.log(`Seeded fixed admin account ${admin.email}. The password remains environment-only.`);
  return admin;
}

if (require.main === module) {
  seedAdmin().then(() => mongoose.disconnect()).catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { seedAdmin };
