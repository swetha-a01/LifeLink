/**
 * LifeLink — User Profile Controller
 *
 * Handles viewing and updating user profile information.
 *
 * Security:
 *   - Protected by JWT authentication middleware (`protect`).
 *   - Only name and phone fields are allowed to be updated by normal users.
 *   - Email, role, accountStatus, and passwordHash CANNOT be modified via this API.
 */

const User = require('../models/User');
const DonorProfile = require('../models/DonorProfile');
const BloodRequest = require('../models/BloodRequest');
const Match = require('../models/Match');
const Notification = require('../models/Notification');
const Appointment = require('../models/Appointment');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { validationResult } = require('express-validator');
const path = require('path');

const normalizePhone = (value) =>
  String(value || '').replace(/[\s()-]/g, '');

const validateAddress = (address) => {
  if (!address || typeof address !== 'object') return 'Address is required.';
  for (const field of ['street', 'city', 'district', 'state', 'pinCode']) {
    if (!String(address[field] || '').trim()) {
      return `${field} is required in the address.`;
    }
  }
  if (!/^\d{4,10}$/.test(String(address.pinCode).trim())) {
    return 'PIN code must contain 4 to 10 digits.';
  }
  return null;
};

// Helper to construct a safe user object
const getSafeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  accountStatus: user.accountStatus,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  dateOfBirth: user.dateOfBirth,
  address: user.address,
  profilePhotoUrl: user.profilePhotoUrl,
  preferences: user.preferences || { emailNotifications: true, theme: 'system' }
});

// ================================================================
// GET /api/user/profile
// ================================================================
const getUserProfile = async (req, res, next) => {
  try {
    // req.user is set by authMiddleware protect (passwordHash excluded)
    return successResponse(res, 'User profile retrieved', {
      user: getSafeUser(req.user)
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// PUT /api/user/profile
// ================================================================
const updateUserProfile = async (req, res, next) => {
  try {
    // Check express-validator validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, errors.array()[0].msg, 400);
    }

    const { name, phone, dateOfBirth, address } = req.body;

    // Fetch user from DB to ensure we operate on a fresh Mongoose instance
    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, 'User not found.', 404);
    }

    // Update ONLY allowed fields
    if (name) user.name = name.trim();
    if (phone !== undefined) {
      const normalizedPhone = normalizePhone(phone);
      if (!/^\+?[1-9]\d{9,14}$/.test(normalizedPhone)) {
        return errorResponse(res, 'Please provide a valid mobile number.', 400);
      }
      user.phone = normalizedPhone;
    }
    if (dateOfBirth !== undefined) {
      const parsedDob = new Date(dateOfBirth);
      if (Number.isNaN(parsedDob.getTime()) || parsedDob > new Date()) {
        return errorResponse(res, 'Date of birth must be a valid past date.', 400);
      }
      if (user.dateOfBirth && user.dateOfBirth.getTime() !== parsedDob.getTime()) {
        return errorResponse(res, 'Date of birth cannot be changed after it is saved.', 400);
      }
      user.dateOfBirth = parsedDob;
    }
    if (address !== undefined) {
      const addressError = validateAddress(address);
      if (addressError) return errorResponse(res, addressError, 400);
      user.address = {
        street: String(address.street).trim(),
        city: String(address.city).trim(),
        district: String(address.district).trim(),
        state: String(address.state).trim(),
        pinCode: String(address.pinCode).trim()
      };
    }

    // Explicitly prevent modification of restricted fields even if sent in body
    // (email, role, accountStatus, passwordHash are untouched)

    await user.save();

    return successResponse(res, 'Profile updated successfully', {
      user: getSafeUser(user)
    });
  } catch (error) {
    next(error);
  }
};

const getUserSettings = async (req, res, next) => {
  try {
    return successResponse(res, 'User settings retrieved', {
      preferences: req.user.preferences || { emailNotifications: true, theme: 'system' }
    });
  } catch (error) {
    next(error);
  }
};

const updateUserSettings = async (req, res, next) => {
  try {
    const { emailNotifications, theme } = req.body;
    if (typeof emailNotifications !== 'boolean') {
      return errorResponse(res, 'Email notification permission must be true or false.', 400);
    }
    if (!['system', 'light', 'dark'].includes(theme)) {
      return errorResponse(res, 'Theme must be system, light, or dark.', 400);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { 'preferences.emailNotifications': emailNotifications, 'preferences.theme': theme } },
      { new: true, runValidators: true }
    );
    return successResponse(res, 'Settings updated successfully', {
      preferences: user.preferences
    });
  } catch (error) {
    next(error);
  }
};

const deleteUserAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const requests = await BloodRequest.find({ requesterId: userId }).select('_id');
    const requestIds = requests.map((request) => request._id);

    await Promise.all([
      Appointment.deleteMany({ $or: [{ donorUserId: userId }, { requesterUserId: userId }] }),
      Notification.deleteMany({ recipientId: userId }),
      DonorProfile.deleteMany({ userId }),
      Match.deleteMany({ $or: [{ donorUserId: userId }, { requestId: { $in: requestIds } }] }),
      BloodRequest.deleteMany({ requesterId: userId }),
      User.deleteOne({ _id: userId })
    ]);

    return successResponse(res, 'Account deleted successfully');
  } catch (error) {
    next(error);
  }
};

const uploadProfilePhoto = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, 'Please select a JPG, PNG, or WebP image.', 400);
    const user = await User.findById(req.user._id);
    if (!user) return errorResponse(res, 'User not found.', 404);
    user.profilePhotoUrl = `/uploads/profiles/${path.basename(req.file.filename)}`;
    await user.save();
    return successResponse(res, 'Profile photo uploaded successfully', {
      profilePhotoUrl: user.profilePhotoUrl
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getUserSettings,
  updateUserSettings,
  deleteUserAccount,
  uploadProfilePhoto
};
