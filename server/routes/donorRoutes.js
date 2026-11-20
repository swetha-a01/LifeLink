/**
 * LifeLink — Donor Profile Routes
 *
 * GET  /api/donor/profile — Get authenticated user's donor profile
 * POST /api/donor/profile — Create a new donor profile
 * PUT  /api/donor/profile — Update existing donor profile
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const {
  getDonorProfile,
  createDonorProfile,
  updateDonorProfile
} = require('../controllers/donorController');

// Validation rules for creating/updating donor profile
const donorProfileValidation = [
  body('bloodGroup')
    .trim()
    .notEmpty()
    .withMessage('Blood group is required')
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Invalid blood group provided'),

  body('availability')
    .optional()
    .trim()
    .isIn(['AVAILABLE', 'UNAVAILABLE'])
    .withMessage('Availability must be AVAILABLE or UNAVAILABLE'),

  body('interestedInDonation')
    .isBoolean()
    .withMessage('Please confirm your interest in blood donation'),

  body('termsAccepted')
    .custom(function (value) {
      return value === true;
    })
    .withMessage('You must agree to the donor terms and conditions'),

  body('area')
    .trim()
    .notEmpty()
    .withMessage('Area/City is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Area name must be between 2 and 100 characters'),

  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),

  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
];

// Protected routes (requires valid JWT token)
router.get('/profile', protect, getDonorProfile);
router.post('/profile', protect, donorProfileValidation, createDonorProfile);
router.put('/profile', protect, donorProfileValidation, updateDonorProfile);

module.exports = router;
