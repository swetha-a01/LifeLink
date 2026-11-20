/**
 * LifeLink — Appointment Model (Phase 10)
 *
 * Mongoose schema for the `appointments` collection.
 *
 * Links a user to a BloodCentre or DonationCamp for a scheduled appointment.
 *
 * Statuses:
 *   PENDING   — Appointment booked, awaiting confirmation
 *   CONFIRMED — Confirmed by admin/system
 *   CANCELLED — Cancelled by donor
 *   COMPLETED — Donation completed (admin only)
 *
 * Security:
 *   - donorUserId and donorProfileId are ALWAYS set from the JWT/database.
 *   - status is controlled by the backend; users cannot forge statuses.
 *   - Only the owner can view or cancel their own appointments.
 */

const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    donorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Donor User ID is required'],
      index: true
    },

    donorProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DonorProfile'
    },

    centreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BloodCentre'
    },

    campId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DonationCamp'
    },

    requesterUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match'
    },

    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BloodRequest',
      index: true
    },

    locationName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ''
    },

    locationArea: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ''
    },

    appointmentDate: {
      type: Date,
      required: [true, 'Appointment date is required']
    },

    appointmentTime: {
      type: String,
      required: [true, 'Appointment time is required'],
      trim: true
    },

    status: {
      type: String,
      enum: {
        values: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
        message: '{VALUE} is not a valid appointment status'
      },
      default: 'PENDING'
    },

    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Notes cannot exceed 500 characters']
    }
  },
  {
    timestamps: true
  }
);

// Index for conflict detection: same donor, same date, same time (not unique — we filter by status)
appointmentSchema.index({ donorUserId: 1, appointmentDate: 1, appointmentTime: 1 });
// Index for listing user appointments
appointmentSchema.index({ donorUserId: 1, createdAt: -1 });

// JSON Transform — Strip internal __v field
appointmentSchema.methods.toJSON = function () {
  const appointmentObject = this.toObject();
  delete appointmentObject.__v;
  return appointmentObject;
};

module.exports = mongoose.model('Appointment', appointmentSchema);
