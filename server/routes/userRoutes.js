/**
 * LifeLink — User Profile Routes
 *
 * GET /api/user/profile — Get authenticated user's profile
 * PUT /api/user/profile — Update shared personal profile fields
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { profilePhotoUpload } = require('../middleware/uploadMiddleware');
const {
  getUserProfile,
  updateUserProfile,
  getUserSettings,
  updateUserSettings,
  deleteUserAccount,
  uploadProfilePhoto
} = require('../controllers/userController');

// Validation rules for updating user profile
const updateProfileValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .customSanitizer((value) => String(value).replace(/[\s()-]/g, ''))
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage('Please provide a valid mobile number'),

  body('dateOfBirth')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),

  body('address')
    .optional()
    .isObject()
    .withMessage('Address must be an object')
];

// All user profile routes require authentication
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateProfileValidation, updateUserProfile);
router.post('/profile/photo', protect, profilePhotoUpload.single('photo'), uploadProfilePhoto);
router.get('/settings', protect, getUserSettings);
router.put('/settings', protect, updateUserSettings);
router.delete('/account', protect, deleteUserAccount);

module.exports = router;
