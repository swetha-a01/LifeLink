/**
 * LifeLink — Blood Centre Seed Script (Phase 10)
 *
 * Inserts demo blood donation centres into MongoDB.
 *
 * Usage:
 *   node server/utils/seedCentres.js
 *
 * This script:
 *   1. Connects to MongoDB using the .env configuration.
 *   2. Checks each centre by name to prevent duplicate records.
 *   3. Inserts only centres that don't already exist.
 *   4. Disconnects and exits.
 *
 * IMPORTANT:
 *   - These are DEMO centres for academic testing purposes.
 *   - They do NOT represent verified real medical facilities.
 *   - Safe to run multiple times (idempotent).
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables from the project root .env file
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BloodCentre = require('../models/BloodCentre');

// ---- Demo centre data ----
const DEMO_CENTRES = [
  {
    name: 'LifeLink Central Blood Bank (Demo)',
    address: '42 Medical College Road, T. Nagar',
    area: 'T. Nagar',
    city: 'Chennai',
    phone: '044-28150000',
    email: 'central@demo-lifelink.example',
    operatingHours: 'Mon–Sat: 8:00 AM – 6:00 PM',
    supportedBloodGroups: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    status: 'ACTIVE'
  },
  {
    name: 'Red Cross Blood Centre (Demo)',
    address: '15 Anna Salai, Egmore',
    area: 'Egmore',
    city: 'Chennai',
    phone: '044-28190001',
    email: 'redcross@demo-lifelink.example',
    operatingHours: 'Mon–Fri: 9:00 AM – 5:00 PM',
    supportedBloodGroups: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
    status: 'ACTIVE'
  },
  {
    name: 'City General Hospital Blood Bank (Demo)',
    address: '88 Hospital Road, Adyar',
    area: 'Adyar',
    city: 'Chennai',
    phone: '044-24910002',
    email: 'citygen@demo-lifelink.example',
    operatingHours: 'Mon–Sun: 7:00 AM – 9:00 PM',
    supportedBloodGroups: ['A+', 'B+', 'AB+', 'AB-', 'O+', 'O-'],
    status: 'ACTIVE'
  },
  {
    name: 'Apollo Blood Donation Centre (Demo)',
    address: '21 Greams Road, Thousand Lights',
    area: 'Thousand Lights',
    city: 'Chennai',
    phone: '044-28290003',
    email: 'apollo@demo-lifelink.example',
    operatingHours: 'Mon–Sat: 8:30 AM – 7:00 PM',
    supportedBloodGroups: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    status: 'ACTIVE'
  },
  {
    name: 'Community Wellness Blood Centre (Demo)',
    address: '5 MG Road, Guindy',
    area: 'Guindy',
    city: 'Chennai',
    phone: '044-22500004',
    operatingHours: 'Tue–Sat: 10:00 AM – 4:00 PM',
    supportedBloodGroups: ['A+', 'B+', 'O+', 'O-'],
    status: 'ACTIVE'
  },
  {
    name: 'Inactive Test Centre (Demo)',
    address: '99 Test Street',
    area: 'Test Area',
    city: 'Chennai',
    phone: '044-00000000',
    operatingHours: 'Closed',
    supportedBloodGroups: ['O+'],
    status: 'INACTIVE'
  }
];

const seedCentres = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('ERROR: MONGODB_URI is not set in .env');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    let insertedCount = 0;
    let skippedCount = 0;

    for (const centreData of DEMO_CENTRES) {
      const existing = await BloodCentre.findOne({ name: centreData.name });

      if (existing) {
        console.log(`  [SKIP] Already exists: ${centreData.name}`);
        skippedCount++;
      } else {
        await BloodCentre.create(centreData);
        console.log(`  [NEW]  Created: ${centreData.name}`);
        insertedCount++;
      }
    }

    console.log(`\nSeed complete: ${insertedCount} inserted, ${skippedCount} skipped (already existed).`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
};

seedCentres();
