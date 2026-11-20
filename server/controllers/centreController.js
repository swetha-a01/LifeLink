/**
 * LifeLink — Centre Controller (Phase 10)
 *
 * Handles listing and retrieving blood donation centres.
 *
 * Security:
 *   - All endpoints require JWT authentication (`protect`).
 *   - Only ACTIVE centres are returned to ordinary users.
 *   - Invalid IDs return appropriate error responses.
 */

const mongoose = require('mongoose');
const BloodCentre = require('../models/BloodCentre');
const DonationCamp = require('../models/DonationCamp');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// ================================================================
// GET /api/centres — List all active blood centres
// ================================================================
const getCentres = async (req, res, next) => {
  try {
    const query = { status: 'ACTIVE' };

    // Optional city filter
    if (req.query.city) {
      query.city = { $regex: new RegExp('^' + req.query.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') };
    }

    const [centres, camps] = await Promise.all([
      BloodCentre.find(query).sort({ name: 1 }),
      DonationCamp.find({
        ...query,
        eventDate: { $gte: new Date() }
      }).sort({ eventDate: 1, name: 1 })
    ]);

    return successResponse(res, 'Blood centres retrieved successfully', {
      count: centres.length + camps.length,
      centres,
      camps
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET /api/centres/:id — Get details of a specific centre
// ================================================================
const getCentreById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 'Invalid centre ID format.', 400);
    }

    const centre = await BloodCentre.findById(id);

    if (!centre) {
      return errorResponse(res, 'Blood centre not found.', 404);
    }

    // Only return active centres to ordinary users
    if (centre.status !== 'ACTIVE') {
      return errorResponse(res, 'This blood centre is currently inactive.', 404);
    }

    return successResponse(res, 'Blood centre details retrieved', { centre });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCentres,
  getCentreById
};
