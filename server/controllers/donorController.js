/**
 * LifeLink — Donor Profile Controller
 *
 * Handles creating, reading, and updating donor profiles.
 *
 * Security:
 *   - All endpoints require JWT authentication (`protect`).
 *   - Only 1 donor profile allowed per user (enforced by DB index & API checks).
 *   - `verificationStatus` is ALWAYS set to 'PENDING' on creation.
 *   - Normal users CANNOT modify `verificationStatus` or `userId`.
 */

const DonorProfile = require('../models/DonorProfile');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { validationResult } = require('express-validator');

// ================================================================
// GET /api/donor/profile
// ================================================================
const getDonorProfile = async (req, res, next) => {
  try {
    const donor = await DonorProfile.findOne({ userId: req.user._id });

    if (!donor) {
      return successResponse(res, 'No donor profile found', {
        exists: false,
        donor: null
      });
    }

    return successResponse(res, 'Donor profile retrieved', {
      exists: true,
      donor: donor
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// POST /api/donor/profile
// ================================================================
const createDonorProfile = async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, errors.array()[0].msg, 400);
    }

    // Check if donor profile already exists for this user
    const existingDonor = await DonorProfile.findOne({ userId: req.user._id });
    if (existingDonor) {
      return errorResponse(
        res,
        'Donor profile already exists. Please update your existing profile instead.',
        409
      );
    }

    const {
      bloodGroup,
      availability,
      area,
      lastDonationDate,
      interestedInDonation,
      termsAccepted,
      latitude,
      longitude
    } = req.body;

    // Validate lastDonationDate if provided (must not be in the future)
    if (lastDonationDate) {
      const donationDate = new Date(lastDonationDate);
      if (isNaN(donationDate.getTime())) {
        return errorResponse(res, 'Invalid last donation date format.', 400);
      }
      if (donationDate > new Date()) {
        return errorResponse(
          res,
          'Last donation date cannot be in the future.',
          400
        );
      }
    }

    // Create donor profile
    // System automatically assigns userId and verificationStatus = 'PENDING'
    const donor = await DonorProfile.create({
      userId: req.user._id,
      bloodGroup,
      availability: availability || 'AVAILABLE',
      interestedInDonation: interestedInDonation === true || interestedInDonation === 'true',
      termsAccepted: termsAccepted === true || termsAccepted === 'true',
      termsAcceptedAt: new Date(),
      area: area.trim(),
      latitude: latitude !== undefined ? Number(latitude) : undefined,
      longitude: longitude !== undefined ? Number(longitude) : undefined,
      lastDonationDate: lastDonationDate ? new Date(lastDonationDate) : undefined,
      verificationStatus: 'PENDING'
    });

    return successResponse(
      res,
      'Donor profile created successfully',
      { donor: donor },
      201
    );
  } catch (error) {
    next(error);
  }
};

// ================================================================
// PUT /api/donor/profile
// ================================================================
const updateDonorProfile = async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, errors.array()[0].msg, 400);
    }

    const donor = await DonorProfile.findOne({ userId: req.user._id });
    if (!donor) {
      return errorResponse(
        res,
        'Donor profile not found. Please create a donor profile first.',
        404
      );
    }

    const {
      bloodGroup,
      availability,
      area,
      lastDonationDate,
      interestedInDonation,
      termsAccepted,
      latitude,
      longitude
    } = req.body;

    // Validate lastDonationDate if provided
    if (lastDonationDate) {
      const donationDate = new Date(lastDonationDate);
      if (isNaN(donationDate.getTime())) {
        return errorResponse(res, 'Invalid last donation date format.', 400);
      }
      if (donationDate > new Date()) {
        return errorResponse(
          res,
          'Last donation date cannot be in the future.',
          400
        );
      }
      donor.lastDonationDate = donationDate;
    } else if (lastDonationDate === null || lastDonationDate === '') {
      donor.lastDonationDate = undefined;
    }

    // Update allowed fields
    if (bloodGroup && donor.bloodGroup !== bloodGroup) {
      return errorResponse(res, 'Blood group cannot be changed after the donor profile is saved.', 400);
    }
    if (availability) donor.availability = availability;
    if (area) donor.area = area.trim();
    if (latitude !== undefined) donor.latitude = Number(latitude);
    if (longitude !== undefined) donor.longitude = Number(longitude);
    donor.interestedInDonation = interestedInDonation === true || interestedInDonation === 'true';
    donor.termsAccepted = termsAccepted === true || termsAccepted === 'true';
    if (donor.termsAccepted) donor.termsAcceptedAt = new Date();

    // Explicitly protect userId and verificationStatus from user modification
    // (verificationStatus and userId remain unchanged)

    await donor.save();

    return successResponse(res, 'Donor profile updated successfully', {
      donor: donor
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDonorProfile,
  createDonorProfile,
  updateDonorProfile
};
