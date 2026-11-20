/**
 * LifeLink — Authentication Routes
 *
 * POST /api/auth/register  — Create a new USER account
 * POST /api/auth/login     — Authenticate and receive a JWT
 * GET  /api/auth/me        — Get the currently authenticated user (protected)
 * POST /api/auth/logout    — Client-side logout acknowledgement
 *
 * Validation is handled by express-validator middleware arrays.
 * Each validator checks one field and provides a clear error message.
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

// Controller functions
const {
  register,
  login,
  getMe,
  logout
} = require('../controllers/authController');

// Auth middleware
const { protect } = require('../middleware/authMiddleware');

// ================================================================
// Validation Rules
// ================================================================

/**
 * Registration validation:
 *   - name:     required, 2–100 characters
 *   - email:    required, valid email format
 *   - phone:    required, 10–15 digits
 *   - dateOfBirth: required, valid past date
 *   - password: required, min 6 chars, must include uppercase,
 *               lowercase, number, and special character
 */
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[0-9]{10,15}$/)
    .withMessage('Phone number must be 10 to 15 digits'),

  body('dateOfBirth')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('Date of birth must be a valid date')
    .custom((value) => new Date(value) <= new Date())
    .withMessage('Date of birth cannot be in the future'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*]/)
    .withMessage(
      'Password must contain at least one special character (!@#$%^&*)'
    )
];

/**
 * Login validation:
 *   - email:    required, valid format
 *   - password: required
 */
const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address'),

  body('password').notEmpty().withMessage('Password is required')
];

// ================================================================
// Routes
// ================================================================

// Public routes (no JWT needed)
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/logout', logout);

// Protected route (valid JWT required)
router.get('/me', protect, getMe);

module.exports = router;
