/**
 * LifeLink — Admin Routes (Phase 9)
 *
 * All routes require JWT authentication (`protect`) AND administrator role (`adminOnly`).
 *
 * Endpoints:
 *   GET   /api/admin/dashboard       — Real MongoDB statistics
 *   GET   /api/admin/donors/pending   — Pending donor profiles
 *   GET   /api/admin/donors           — All donor profiles
 *   PATCH /api/admin/donors/:id/verify — Verify/reject/suspend donor profile
 *   GET   /api/admin/users            — List registered users
 *   PATCH /api/admin/users/:id/status — Activate/suspend user account
 */

const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  getAdminDashboardStats,
  getPendingDonors,
  getAllDonors,
  updateDonorVerification,
  getUsersList,
  updateUserAccountStatus,
  getAdminAppointments,
  completeAppointment
} = require('../controllers/adminController');
const DonationCamp = require('../models/DonationCamp');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// Apply protect & adminOnly middleware to ALL admin endpoints
router.use(protect, adminOnly);

router.get('/dashboard', getAdminDashboardStats);
router.get('/donors/pending', getPendingDonors);
router.get('/donors', getAllDonors);
router.patch('/donors/:id/verify', updateDonorVerification);
router.get('/users', getUsersList);
router.patch('/users/:id/status', updateUserAccountStatus);
router.get('/appointments', getAdminAppointments);
router.patch('/appointments/:id/complete', completeAppointment);

router.get('/camps', async (req, res, next) => {
  try {
    const camps = await DonationCamp.find().sort({ eventDate: 1, createdAt: -1 });
    return successResponse(res, 'Donation camps retrieved successfully', { camps });
  } catch (error) {
    next(error);
  }
});

router.post('/camps', async (req, res, next) => {
  try {
    const {
      name, address, area, city, phone, email, operatingHours,
      eventDate, eventTime, capacity, supportedBloodGroups, notes
    } = req.body;

    if (!name || !address || !area || !city || !phone || !operatingHours || !eventDate || !eventTime || !capacity) {
      return errorResponse(
        res,
        'Name, address, area, city, phone, operating hours, event date, event time and capacity are required.',
        400
      );
    }

    const camp = await DonationCamp.create({
      name,
      address,
      area,
      city,
      phone,
      email,
      operatingHours,
      eventDate,
      eventTime,
      capacity,
      supportedBloodGroups: Array.isArray(supportedBloodGroups) && supportedBloodGroups.length
        ? supportedBloodGroups
        : ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      notes
    });

    return successResponse(res, 'Donation camp created successfully', { camp }, 201);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
