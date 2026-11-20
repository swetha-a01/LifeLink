/**
 * LifeLink — Admin Seed Script
 *
 * Creates a test ADMIN account for local development/testing.
 *
 * Usage:
 *   node server/utils/seedAdmin.js
 *
 * This script:
 *   1. Connects to MongoDB using the .env configuration.
 *   2. Checks if the admin account already exists.
 *   3. Creates the account if it doesn't exist.
 *   4. Disconnects and exits.
 *
 * IMPORTANT:
 *   - This is for development/testing ONLY.
 *   - Do NOT expose an admin registration endpoint publicly.
 *   - Change the default credentials before any deployment.
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables from the project root .env file
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const User = require('../models/User');

// ---- Admin credentials for testing ----
const ADMIN_DATA = {
  name: 'Admin',
  email: 'admin@lifelink.com',
  phone: '9999999999',
  passwordHash: 'Admin@123', // Will be hashed by the pre-save hook
  role: 'ADMIN',
  accountStatus: 'ACTIVE'
};

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('ERROR: MONGODB_URI is not set in .env');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: ADMIN_DATA.email });

    if (existingAdmin) {
      console.log(`Admin account already exists: ${ADMIN_DATA.email}`);
      console.log('No changes made.');
    } else {
      // Create the admin account
      const admin = await User.create(ADMIN_DATA);
      console.log('Admin account created successfully!');
      console.log(`  Email:    ${admin.email}`);
      console.log(`  Password: Admin@123`);
      console.log(`  Role:     ${admin.role}`);
    }

    // Disconnect
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
};

seedAdmin();
