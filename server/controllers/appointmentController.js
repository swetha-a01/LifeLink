/**
 * LifeLink — Appointment Controller (Phase 10)
 *
 * Handles creating, listing, viewing, and cancelling donation appointments.
 *
 * Security:
 *   - All endpoints require JWT authentication (`protect`).
 *   - donorUserId and donorProfileId are derived from the JWT, never from the client.
 *   - Users can ONLY view and manage their own appointments.
 *   - Appointment status is controlled server-side; clients cannot forge status values.
 *   - Only PENDING or CONFIRMED appointments can be cancelled.
 *   - Ordinary users cannot mark appointments COMPLETED.
 */

const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const DonorProfile = require('../models/DonorProfile');
const BloodCentre = require('../models/BloodCentre');
const DonationCamp = require('../models/DonationCamp');
const Notification = require('../models/Notification');
const { isDonorEligible } = require('../utils/matchingAlgorithm');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// ================================================================
// POST /api/appointments — Book a new appointment
// ================================================================
const createAppointment = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // A centre/camp booking is available to every authenticated user.
    // A donor profile is optional; when present, retain its existing checks.
    const donorProfile = await DonorProfile.findOne({ userId });

    if (donorProfile) {
      if (donorProfile.verificationStatus !== 'VERIFIED') {
        return errorResponse(res, 'Your donor profile must be verified before booking appointments.', 403);
      }

      if (donorProfile.availability !== 'AVAILABLE') {
        return errorResponse(res, 'You must be marked as available to book an appointment.', 400);
      }

      if (!isDonorEligible(donorProfile.lastDonationDate)) {
        return errorResponse(
          res,
          'You are not yet eligible to donate. Please wait for the 90-day cooldown period to pass since your last donation.',
          400
        );
      }
    }

    // Validate and extract request body (only allowed fields).
    const { centreId, campId, appointmentDate, appointmentTime, notes } = req.body;

    if (!centreId && !campId) {
      return errorResponse(res, 'Centre ID or camp ID is required.', 400);
    }

    if (centreId && !mongoose.Types.ObjectId.isValid(centreId)) {
      return errorResponse(res, 'Invalid centre ID format.', 400);
    }

    if (campId && !mongoose.Types.ObjectId.isValid(campId)) {
      return errorResponse(res, 'Invalid camp ID format.', 400);
    }

    if (!appointmentDate) {
      return errorResponse(res, 'Appointment date is required.', 400);
    }

    if (!appointmentTime) {
      return errorResponse(res, 'Appointment time is required.', 400);
    }

    // Verify the selected location exists and is active.
    const centre = centreId ? await BloodCentre.findById(centreId) : null;
    const camp = campId ? await DonationCamp.findById(campId) : null;
    const location = centre || camp;

    if (!location) {
      return errorResponse(res, 'Blood centre or donation camp not found.', 404);
    }

    if (location.status !== 'ACTIVE') {
      return errorResponse(res, 'This donation location is currently inactive.', 400);
    }

    if (camp && camp.registeredCount >= camp.capacity) {
      return errorResponse(res, 'This donation camp is already fully booked.', 409);
    }

    // 7. Validate date and time
    const parsedDate = new Date(appointmentDate);
    if (isNaN(parsedDate.getTime())) {
      return errorResponse(res, 'Invalid appointment date format.', 400);
    }

    // Normalize date to midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDay = new Date(parsedDate);
    appointmentDay.setHours(0, 0, 0, 0);

    // 8. Reject appointments in the past
    if (appointmentDay < today) {
      return errorResponse(res, 'Appointment date cannot be in the past.', 400);
    }

    // Validate time format (HH:MM, 00:00 - 23:59)
    const timeStr = appointmentTime.trim();
    if (!/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(timeStr)) {
      return errorResponse(res, 'Invalid appointment time format. Use HH:MM with valid hours (00-23) and minutes (00-59).', 400);
    }

    // 9. Prevent conflicting active appointments for same donor at same date/time
    const conflicting = await Appointment.findOne({
      donorUserId: userId,
      appointmentDate: appointmentDay,
      appointmentTime: timeStr,
      status: { $in: ['PENDING', 'CONFIRMED'] }
    });

    if (conflicting) {
      return errorResponse(
        res,
        'You already have an active appointment at this date and time.',
        409
      );
    }

    // 10. Create the appointment with PENDING status
    const appointment = await Appointment.create({
      donorUserId: userId,
      donorProfileId: donorProfile ? donorProfile._id : undefined,
      centreId: centre ? centre._id : undefined,
      campId: camp ? camp._id : undefined,
      appointmentDate: appointmentDay,
      appointmentTime: timeStr,
      status: 'PENDING',
      notes: notes ? notes.trim().substring(0, 500) : ''
    });

    if (camp) {
      await DonationCamp.updateOne(
        { _id: camp._id, registeredCount: { $lt: camp.capacity } },
        { $inc: { registeredCount: 1 } }
      );
    }

    // 11. Create APPOINTMENT_BOOKED notification
    await Notification.create({
      recipientId: userId,
      type: 'APPOINTMENT_BOOKED',
      title: 'Appointment Scheduled',
      message: `Your donation appointment at ${location.name} has been scheduled for ${parsedDate.toLocaleDateString()} at ${timeStr}.`,
      priority: 'NORMAL',
      isRead: false
    });

    // Populate centre details before returning
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('centreId', 'name address area city phone operatingHours')
      .populate('campId', 'name address area city phone operatingHours eventDate capacity');

    return successResponse(
      res,
      'Appointment booked successfully',
      { appointment: populatedAppointment },
      201
    );
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET /api/appointments — List authenticated user's appointments
// ================================================================
const getMyAppointments = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const appointments = await Appointment.find({
      $or: [{ donorUserId: userId }, { requesterUserId: userId }]
    })
      .populate('centreId', 'name address area city phone operatingHours')
      .populate('campId', 'name address area city phone operatingHours eventDate capacity')
      .populate('requestId', 'bloodGroup unitsRequired hospitalName area requiredDate requiredTime priority additionalInfo status')
      .sort({ appointmentDate: -1, createdAt: -1 });

    return successResponse(res, 'Appointments retrieved successfully', {
      count: appointments.length,
      appointments
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET /api/appointments/:id — Get details of a specific appointment
// ================================================================
const getAppointmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 'Invalid appointment ID format.', 400);
    }

    const appointment = await Appointment.findById(id)
      .populate('centreId', 'name address area city phone operatingHours supportedBloodGroups')
      .populate('campId', 'name address area city phone operatingHours eventDate capacity')
      .populate('requestId', 'bloodGroup unitsRequired hospitalName area requiredDate requiredTime priority additionalInfo status');

    if (!appointment) {
      return errorResponse(res, 'Appointment not found.', 404);
    }

    // Ownership check — users can only view their own appointments
    if (
      appointment.donorUserId.toString() !== req.user._id.toString() &&
      (!appointment.requesterUserId ||
        appointment.requesterUserId.toString() !== req.user._id.toString())
    ) {
      return errorResponse(
        res,
        'Access denied. You can only view your own appointments.',
        403
      );
    }

    return successResponse(res, 'Appointment details retrieved', { appointment });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// PATCH /api/appointments/:id/cancel — Cancel an appointment
// ================================================================
const cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 'Invalid appointment ID format.', 400);
    }

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return errorResponse(res, 'Appointment not found.', 404);
    }

    // Ownership check
    if (
      appointment.donorUserId.toString() !== req.user._id.toString() &&
      (!appointment.requesterUserId ||
        appointment.requesterUserId.toString() !== req.user._id.toString())
    ) {
      return errorResponse(
        res,
        'Access denied. You can only cancel your own appointments.',
        403
      );
    }

    // Only PENDING or CONFIRMED appointments can be cancelled
    if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) {
      return errorResponse(
        res,
        `Cannot cancel an appointment with status '${appointment.status}'.`,
        400
      );
    }

    // Update status to CANCELLED (never delete)
    appointment.status = 'CANCELLED';
    await appointment.save();

    // Create APPOINTMENT_CANCELLED notification
    const centre = appointment.centreId
      ? await BloodCentre.findById(appointment.centreId)
      : null;
    const centreName = centre
      ? centre.name
      : (appointment.locationName || 'Donation location');

    await Notification.create({
      recipientId: req.user._id,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Appointment Cancelled',
      message: `Your donation appointment at ${centreName} on ${appointment.appointmentDate.toLocaleDateString()} at ${appointment.appointmentTime} has been cancelled.`,
      priority: 'NORMAL',
      isRead: false
    });

    return successResponse(res, 'Appointment cancelled successfully', { appointment });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAppointment,
  getMyAppointments,
  getAppointmentById,
  cancelAppointment
};
