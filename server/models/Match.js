
/**
 * LifeLink - Match Model
 * Links blood requests to matching donor profiles.
 */

const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BloodRequest',
      required: [true, 'Request ID is required']
    },

    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DonorProfile',
      required: [true, 'Donor Profile ID is required']
    },

    donorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Donor User ID is required']
    },

    matchScore: {
      type: Number,
      required: [true, 'Match score is required'],
      min: 0,
      max: 100
    },

    matchReasons: [
      {
        type: String
      }
    ],

    roadDistanceKm: {
      type: Number,
      min: 0
    },

    estimatedDurationMinutes: {
      type: Number,
      min: 0
    },

    routeStatus: {
      type: String,
      enum: ['AVAILABLE', 'NO_ROUTE', 'UNAVAILABLE']
    },

    routeApproximate: {
      type: Boolean,
      default: false
    },

    status: {
      type: String,
      enum: {
        values: ['PENDING', 'ACCEPTED', 'REJECTED'],
        message: '{VALUE} is not a valid match status'
      },
      default: 'PENDING'
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate matches for the same request and donor.
matchSchema.index(
  { requestId: 1, donorId: 1 },
  { unique: true }
);

// Exclude the internal Mongoose version field from JSON responses.
matchSchema.methods.toJSON = function () {
  const matchObject = this.toObject();
  delete matchObject.__v;
  return matchObject;
};

module.exports = mongoose.model('Match', matchSchema);
