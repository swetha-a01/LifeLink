/**
 * LifeLink — Admin Controller (Phase 9)
 *
 * Handles admin dashboard metrics, donor profile verification/suspension, and user management.
 *
 * Security:
 *   - Protected by `protect` AND `adminOnly` middleware.
 *   - Only authenticated users with `role === 'ADMIN'` can access these endpoints.
 *   - Admins CANNOT modify their own account status via the status endpoint.
 *   - Passwords and sensitive internal hashes are NEVER returned in responses.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const DonorProfile = require('../models/DonorProfile');
const BloodRequest = require('../models/BloodRequest');
const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// Helper to construct a safe user object
const getSafeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  accountStatus: user.accountStatus,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

// ================================================================
// GET /api/admin/dashboard — Real MongoDB system statistics
// ================================================================
const getAdminDashboardStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalDonors = await DonorProfile.countDocuments();
    const pendingDonors = await DonorProfile.countDocuments({
      verificationStatus: 'PENDING'
    });
    const verifiedDonors = await DonorProfile.countDocuments({
      verificationStatus: 'VERIFIED'
    });
    const rejectedDonors = await DonorProfile.countDocuments({
      verificationStatus: 'REJECTED'
    });
    const suspendedDonors = await DonorProfile.countDocuments({
      verificationStatus: 'SUSPENDED'
    });
    const activeRequests = await BloodRequest.countDocuments({
      status: { $in: ['SEARCHING', 'DONOR_RESPONDED'] }
    });
    const emergencyRequests = await BloodRequest.countDocuments({
      priority: 'EMERGENCY',
      status: { $in: ['SEARCHING', 'DONOR_RESPONDED'] }
    });
    const completedRequests = await BloodRequest.countDocuments({
      status: 'COMPLETED'
    });

    return successResponse(res, 'Admin dashboard statistics retrieved', {
      totalUsers,
      totalDonors,
      pendingDonors,
      verifiedDonors,
      rejectedDonors,
      suspendedDonors,
      activeRequests,
      emergencyRequests,
      completedRequests
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET /api/admin/donors/pending — List pending donor profiles
// ================================================================
const getPendingDonors = async (req, res, next) => {
  try {
    const pendingDonors = await DonorProfile.find({
      verificationStatus: 'PENDING'
    })
      .populate('userId', 'name email phone role accountStatus createdAt')
      .sort({ createdAt: -1 });

    return successResponse(res, 'Pending donor profiles retrieved', {
      count: pendingDonors.length,
      donors: pendingDonors
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET /api/admin/donors — List all donor profiles (Overview)
// ================================================================
const getAllDonors = async (req, res, next) => {
  try {
    const donors = await DonorProfile.find()
      .populate('userId', 'name email phone role accountStatus createdAt')
      .sort({ createdAt: -1 });

    return successResponse(res, 'All donor profiles retrieved', {
      count: donors.length,
      donors
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// PATCH /api/admin/donors/:id/verify — Verify, reject, or suspend donor
// ================================================================
const updateDonorVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!action || !['VERIFY', 'REJECT', 'SUSPEND'].includes(action)) {
      return errorResponse(
        res,
        "Invalid action value. Must be 'VERIFY', 'REJECT', or 'SUSPEND'.",
        400
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 'Invalid donor profile ID format.', 400);
    }

    const donor = await DonorProfile.findById(id).populate('userId', 'name email');

    if (!donor) {
      return errorResponse(res, 'Donor profile not found.', 404);
    }

    const recipientUserId = donor.userId._id ? donor.userId._id : donor.userId;

    if (action === 'VERIFY') {
      donor.verificationStatus = 'VERIFIED';
      await Notification.create({
        recipientId: recipientUserId,
        type: 'DONOR_VERIFIED',
        title: 'Donor Profile Verified',
        message: 'Your voluntary donor profile has been verified by an administrator. You can now be matched with blood requests.',
        priority: 'NORMAL',
        isRead: false
      });
    } else if (action === 'REJECT') {
      donor.verificationStatus = 'REJECTED';
      await Notification.create({
        recipientId: recipientUserId,
        type: 'DONOR_REJECTED',
        title: 'Donor Verification Update',
        message: 'Your donor profile verification request was declined by an administrator.',
        priority: 'NORMAL',
        isRead: false
      });
    } else if (action === 'SUSPEND') {
      donor.verificationStatus = 'SUSPENDED';
      await Notification.create({
        recipientId: recipientUserId,
        type: 'DONOR_SUSPENDED',
        title: 'Donor Profile Suspended',
        message: 'Your donor profile has been suspended by an administrator.',
        priority: 'URGENT',
        isRead: false
      });
    }

    await donor.save();

    return successResponse(
      res,
      `Donor profile status updated to ${donor.verificationStatus}`,
      { donor }
    );
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET /api/admin/users — List registered users
// ================================================================
const getUsersList = async (req, res, next) => {
  try {
    const { role, accountStatus } = req.query;
    const query = {};

    if (role && ['USER', 'ADMIN'].includes(role)) {
      query.role = role;
    }
    if (accountStatus && ['ACTIVE', 'SUSPENDED'].includes(accountStatus)) {
      query.accountStatus = accountStatus;
    }

    const users = await User.find(query).select('-passwordHash').sort({ createdAt: -1 });

    const safeUsers = users.map(getSafeUser);

    return successResponse(res, 'Users list retrieved', {
      count: safeUsers.length,
      users: safeUsers
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// PATCH /api/admin/users/:id/status — Activate/deactivate user account
// ================================================================
const updateUserAccountStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { accountStatus } = req.body;

    if (!accountStatus || !['ACTIVE', 'SUSPENDED'].includes(accountStatus)) {
      return errorResponse(
        res,
        "Invalid account status. Must be 'ACTIVE' or 'SUSPENDED'.",
        400
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 'Invalid user ID format.', 400);
    }

    // Security check: Prevent Admin from deactivating their own account
    if (id.toString() === req.user._id.toString()) {
      return errorResponse(
        res,
        'Access denied. Administrators cannot deactivate or alter their own account status.',
        400
      );
    }

    const user = await User.findById(id);

    if (!user) {
      return errorResponse(res, 'User not found.', 404);
    }

    user.accountStatus = accountStatus;
    await user.save();

    return successResponse(res, `User account status updated to ${accountStatus}`, {
      user: getSafeUser(user)
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET /api/admin/appointments — List all appointments for admin
// ================================================================
const getAdminAppointments = async (req, res, next) => {
  try {
    const appointments = await Appointment.find()
      .populate('donorUserId', 'name email phone')
      .populate('centreId', 'name city area phone')
      .populate('campId', 'name city area phone')
      .populate('requesterUserId', 'name email phone')
      .sort({ appointmentDate: -1, createdAt: -1 });

    return successResponse(res, 'All appointments retrieved', {
      count: appointments.length,
      appointments
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// PATCH /api/admin/appointments/:id/complete — Complete appointment
// ================================================================
const completeAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 'Invalid appointment ID format.', 400);
    }

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return errorResponse(res, 'Appointment not found.', 404);
    }

    if (appointment.status === 'COMPLETED') {
      return errorResponse(res, 'Appointment is already marked as completed.', 400);
    }

    if (appointment.status === 'CANCELLED') {
      return errorResponse(res, 'Cannot complete a cancelled appointment.', 400);
    }

    appointment.status = 'COMPLETED';
    await appointment.save();

    // If donorProfile exists, update lastDonationDate
    if (appointment.donorProfileId) {
      await DonorProfile.findByIdAndUpdate(appointment.donorProfileId, {
        lastDonationDate: appointment.appointmentDate || new Date()
      });
    }

    // Send notification to donor
    await Notification.create({
      recipientId: appointment.donorUserId,
      type: 'APPOINTMENT_BOOKED',
      title: 'Donation Completed',
      message: 'Your donation appointment has been successfully marked as completed. Thank you for your contribution to saving lives!',
      priority: 'NORMAL',
      isRead: false
    });

    return successResponse(res, 'Appointment marked as completed successfully', {
      appointment
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminDashboardStats,
  getPendingDonors,
  getAllDonors,
  updateDonorVerification,
  getUsersList,
  updateUserAccountStatus,
  getAdminAppointments,
  completeAppointment
};
