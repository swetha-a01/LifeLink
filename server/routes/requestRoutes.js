/**
 * LifeLink — Blood Request Routes
 *
 * All routes require JWT authentication (`protect`).
 *
 * Endpoints:
 *   POST   /api/requests           — Create a new blood request
 *   GET    /api/requests           — Get authenticated user's blood requests
 *   GET    /api/requests/:id       — Get blood request details by ID
 *   PUT    /api/requests/:id       — Update blood request by ID
 *   PATCH  /api/requests/:id/cancel — Cancel blood request by ID
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const {
  createBloodRequest,
  getMyBloodRequests,
  getBloodRequestById,
  updateBloodRequest,
  cancelBloodRequest
} = require('../controllers/requestController');
const BloodRequest = require('../models/BloodRequest');
const { successResponse } = require('../utils/apiResponse');

// Validation rules for creating a blood request
const createRequestValidation = [
  body('bloodGroup')
    .trim()
    .notEmpty()
    .withMessage('Blood group is required')
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Invalid blood group provided'),

  body('unitsRequired')
    .notEmpty()
    .withMessage('Units required is required')
    .isInt({ min: 1, max: 20 })
    .withMessage('Units required must be an integer between 1 and 20'),

  body('hospitalName')
    .trim()
    .notEmpty()
    .withMessage('Hospital name is required')
    .isLength({ min: 2, max: 150 })
    .withMessage('Hospital name must be between 2 and 150 characters'),

  body('area')
    .trim()
    .notEmpty()
    .withMessage('Area/City is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Area name must be between 2 and 100 characters'),

  body('hospitalAddress').optional().isLength({ max: 250 })
    .withMessage('Hospital address cannot exceed 250 characters'),
  body('city').optional().isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),
  body('district').optional().isLength({ max: 100 })
    .withMessage('District cannot exceed 100 characters'),
  body('state').optional().isLength({ max: 100 })
    .withMessage('State cannot exceed 100 characters'),
  body('pinCode').optional().matches(/^\d{4,10}$/)
    .withMessage('PIN code must contain 4 to 10 digits'),
  body('landmark').optional().isLength({ max: 200 })
    .withMessage('Landmark cannot exceed 200 characters'),

  body('requiredDate')
    .notEmpty()
    .withMessage('Required date is required')
    .isISO8601()
    .withMessage('Required date must be a valid date format'),

  body('requiredTime')
    .trim()
    .notEmpty()
    .withMessage('Required time is required'),

  body('priority')
    .optional()
    .trim()
    .isIn(['NORMAL', 'URGENT', 'EMERGENCY'])
    .withMessage('Priority must be NORMAL, URGENT, or EMERGENCY'),

  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),

  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
];

// Validation rules for updating a blood request
const updateRequestValidation = [
  body('bloodGroup')
    .optional()
    .trim()
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Invalid blood group provided'),

  body('unitsRequired')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Units required must be an integer between 1 and 20'),

  body('hospitalName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Hospital name must be between 2 and 150 characters'),

  body('area')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Area name must be between 2 and 100 characters'),

  body('hospitalAddress').optional().isLength({ max: 250 }),
  body('city').optional().isLength({ max: 100 }),
  body('district').optional().isLength({ max: 100 }),
  body('state').optional().isLength({ max: 100 }),
  body('pinCode').optional().matches(/^\d{4,10}$/)
    .withMessage('PIN code must contain 4 to 10 digits'),
  body('landmark').optional().isLength({ max: 200 }),

  body('requiredDate')
    .optional()
    .isISO8601()
    .withMessage('Required date must be a valid date format'),

  body('requiredTime')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Required time cannot be empty'),

  body('priority')
    .optional()
    .trim()
    .isIn(['NORMAL', 'URGENT', 'EMERGENCY'])
    .withMessage('Priority must be NORMAL, URGENT, or EMERGENCY'),

  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),

  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
];

// Apply auth middleware and handlers
router.post('/', protect, createRequestValidation, createBloodRequest);
router.get('/emergency/all', protect, async (req, res, next) => {
  try {
    const requests = await BloodRequest.find({
      priority: 'EMERGENCY',
      status: { $nin: ['CANCELLED', 'COMPLETED', 'EXPIRED'] }
    }).sort({ requiredDate: 1, createdAt: -1 });
    return successResponse(res, 'Emergency blood requests retrieved', {
      count: requests.length,
      requests
    });
  } catch (error) {
    next(error);
  }
});
router.get('/', protect, getMyBloodRequests);
router.get('/:id', protect, getBloodRequestById);
router.put('/:id', protect, updateRequestValidation, updateBloodRequest);
router.patch('/:id/cancel', protect, cancelBloodRequest);

module.exports = router;
