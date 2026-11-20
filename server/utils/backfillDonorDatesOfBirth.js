/**
 * Backfills dates of birth for existing donor users.
 *
 * Usage:
 *   node server/utils/backfillDonorDatesOfBirth.js
 */

const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const User = require('../models/User');
const DonorProfile = require('../models/DonorProfile');

const startDate = new Date('1980-01-01T00:00:00.000Z').getTime();
const endDate = new Date('2006-12-31T00:00:00.000Z').getTime();

const randomDateOfBirth = () => new Date(
  startDate + Math.floor(Math.random() * (endDate - startDate + 1))
);

const backfillDonorDatesOfBirth = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set in .env');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    const donorUserIds = await DonorProfile.distinct('userId');
    const users = await User.find({
      _id: { $in: donorUserIds },
      $or: [{ dateOfBirth: { $exists: false } }, { dateOfBirth: null }]
    }).select('_id');

    if (users.length > 0) {
      await User.bulkWrite(users.map((user) => ({
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { dateOfBirth: randomDateOfBirth() }, $unset: { gender: 1 } }
        }
      })));
    }

    await User.updateMany({}, { $unset: { gender: 1 } });
    console.log(`Backfilled ${users.length} donor date(s) of birth and removed gender data.`);
  } finally {
    await mongoose.disconnect();
  }
};

backfillDonorDatesOfBirth().catch((error) => {
  console.error('Donor date-of-birth backfill failed:', error.message);
  process.exitCode = 1;
});
