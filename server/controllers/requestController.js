/**
 * LifeLink — Blood Request Controller
 *
 * Handles creating, retrieving, updating, and cancelling blood requests.
 *
 * Security & Authorization:
 *   - All endpoints require JWT authentication (`protect`).
 *   - `requesterId` is ALWAYS retrieved from `req.user._id`.
 *   - Users can only access, edit, or cancel their own blood requests.
 *   - `status` is automatically set to 'SEARCHING' on creation. Client cannot override status on creation or update.
 */

const mongoose = require('mongoose');
const BloodRequest = require('../models/BloodRequest');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { validationResult } = require('express-validator');

// ================================================================
// POST /api/requests — Create a new blood request
// ================================================================
const createBloodRequest = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, errors.array()[0].msg, 400);
    }

    const {
      bloodGroup,
      unitsRequired,
      hospitalName,
      hospitalAddress,
      city,
      district,
      state,
      pinCode,
      landmark,
      area,
      requiredDate,
      requiredTime,
      priority,
      additionalInfo,
      latitude,
      longitude
    } = req.body;

    // Validate unitsRequired explicitly (numeric >= 1)
    const units = parseInt(unitsRequired, 10);
    if (isNaN(units) || units < 1) {
      return errorResponse(
        res,
        'Units required must be a valid positive integer of at least 1.',
        400
      );
    }

    // Validate requiredDate
    const parsedDate = new Date(requiredDate);
    if (isNaN(parsedDate.getTime())) {
      return errorResponse(res, 'Invalid required date provided.', 400);
    }

    // Create Blood Request document
    const request = await BloodRequest.create({
      requesterId: req.user._id,
      bloodGroup,
      unitsRequired: units,
      hospitalName: hospitalName.trim(),
      hospitalAddress: hospitalAddress ? hospitalAddress.trim() : '',
      city: city ? city.trim() : '',
      district: district ? district.trim() : area.trim(),
      state: state ? state.trim() : 'Tamil Nadu',
      pinCode: pinCode ? pinCode.trim() : '',
      landmark: landmark ? landmark.trim() : '',
      area: area.trim(),
      latitude: latitude !== undefined ? Number(latitude) : undefined,
      longitude: longitude !== undefined ? Number(longitude) : undefined,
      requiredDate: parsedDate,
      requiredTime: requiredTime.trim(),
      priority: priority || 'NORMAL',
      additionalInfo: additionalInfo ? additionalInfo.trim() : '',
      status: 'SEARCHING'
    });

    return successResponse(
      res,
      'Blood request created successfully',
      { request },
      201
    );
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET /api/requests — List current user's blood requests
// ================================================================
const getMyBloodRequests = async (req, res, next) => {
  try {
    const requests = await BloodRequest.find({ requesterId: req.user._id }).sort(
      { createdAt: -1 }
    );

    return successResponse(res, 'Blood requests retrieved', {
      count: requests.length,
      requests
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET /api/requests/:id — Get details of a single blood request
// ================================================================
const getBloodRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 'Invalid request ID format.', 400);
    }

    const request = await BloodRequest.findById(id);

    if (!request) {
      return errorResponse(res, 'Blood request not found.', 404);
    }

    // Ownership check — Only requester (or future admin) can view details
    if (
      request.requesterId.toString() !== req.user._id.toString() &&
      req.user.role !== 'ADMIN'
    ) {
      return errorResponse(
        res,
        'Access denied. You do not own this blood request.',
        403
      );
    }

    return successResponse(res, 'Blood request details retrieved', { request });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// PUT /api/requests/:id — Update an existing blood request
// ================================================================
const updateBloodRequest = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, errors.array()[0].msg, 400);
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 'Invalid request ID format.', 400);
    }

    const request = await BloodRequest.findById(id);

    if (!request) {
      return errorResponse(res, 'Blood request not found.', 404);
    }

    // Ownership check
    if (request.requesterId.toString() !== req.user._id.toString()) {
      return errorResponse(
        res,
        'Access denied. You can only edit your own blood requests.',
        403
      );
    }

    // State check — Only SEARCHING requests can be updated
    if (request.status !== 'SEARCHING') {
      return errorResponse(
        res,
        `Cannot update request with status '${request.status}'. Only active 'SEARCHING' requests can be modified.`,
        400
      );
    }

    const {
      bloodGroup,
      unitsRequired,
      hospitalName,
      hospitalAddress,
      city,
      district,
      state,
      pinCode,
      landmark,
      area,
      requiredDate,
      requiredTime,
      priority,
      additionalInfo,
      latitude,
      longitude
    } = req.body;

    if (unitsRequired !== undefined) {
      const units = parseInt(unitsRequired, 10);
      if (isNaN(units) || units < 1) {
        return errorResponse(
          res,
          'Units required must be a valid positive integer of at least 1.',
          400
        );
      }
      request.unitsRequired = units;
    }

    if (requiredDate) {
      const parsedDate = new Date(requiredDate);
      if (isNaN(parsedDate.getTime())) {
        return errorResponse(res, 'Invalid required date provided.', 400);
      }
      request.requiredDate = parsedDate;
    }

    if (bloodGroup) request.bloodGroup = bloodGroup;
    if (hospitalName) request.hospitalName = hospitalName.trim();
    if (hospitalAddress !== undefined) request.hospitalAddress = hospitalAddress.trim();
    if (city !== undefined) request.city = city.trim();
    if (district !== undefined) request.district = district.trim();
    if (state !== undefined) request.state = state.trim();
    if (pinCode !== undefined) request.pinCode = pinCode.trim();
    if (landmark !== undefined) request.landmark = landmark.trim();
    if (area) request.area = area.trim();
    if (requiredTime) request.requiredTime = requiredTime.trim();
    if (priority) request.priority = priority;
    if (additionalInfo !== undefined) request.additionalInfo = additionalInfo.trim();
    if (latitude !== undefined) request.latitude = Number(latitude);
    if (longitude !== undefined) request.longitude = Number(longitude);

    // Ensure requesterId and status are NOT modified by user update
    await request.save();

    return successResponse(res, 'Blood request updated successfully', {
      request
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// PATCH /api/requests/:id/cancel — Cancel a blood request
// ================================================================
const cancelBloodRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 'Invalid request ID format.', 400);
    }

    const request = await BloodRequest.findById(id);

    if (!request) {
      return errorResponse(res, 'Blood request not found.', 404);
    }

    // Ownership check
    if (request.requesterId.toString() !== req.user._id.toString()) {
      return errorResponse(
        res,
        'Access denied. You can only cancel your own blood requests.',
        403
      );
    }

    if (request.status === 'CANCELLED') {
      return errorResponse(res, 'This blood request is already cancelled.', 400);
    }

    if (request.status === 'COMPLETED') {
      return errorResponse(
        res,
        'Completed blood requests cannot be cancelled.',
        400
      );
    }

    // Update status to CANCELLED (does not delete record)
    request.status = 'CANCELLED';
    await request.save();

    return successResponse(res, 'Blood request cancelled successfully', {
      request
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBloodRequest,
  getMyBloodRequests,
  getBloodRequestById,
  updateBloodRequest,
  cancelBloodRequest
};
