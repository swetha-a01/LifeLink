/**
 * LifeLink — Donor Profile Model
 *
 * Mongoose schema for the `donorprofiles` collection.
 *
 * Links 1-to-1 with a User document via `userId`.
 *
 * Verification Statuses:
 *   PENDING   — Default status upon creation. Awaiting admin review.
 *   VERIFIED  — Approved by administrator after document/eligibility check.
 *   REJECTED  — Rejected by administrator.
 *   SUSPENDED — Suspended by administrator.
 *
 * Security:
 *   Normal users can NEVER change verificationStatus directly.
 */

const mongoose = require('mongoose');

const donorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true
    },

    bloodGroup: {
      type: String,
      required: [true, 'Blood group is required'],
      enum: {
        values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        message: '{VALUE} is not a valid blood group'
      }
    },

    availability: {
      type: String,
      enum: {
        values: ['AVAILABLE', 'UNAVAILABLE'],
        message: '{VALUE} is not a valid availability status'
      },
      default: 'AVAILABLE',
      required: [true, 'Availability status is required']
    },

    interestedInDonation: {
      type: Boolean,
      default: false
    },

    termsAccepted: {
      type: Boolean,
      default: false
    },

    termsAcceptedAt: {
      type: Date
    },

    area: {
      type: String,
      required: [true, 'Area/City is required'],
      trim: true,
      maxlength: [100, 'Area name cannot exceed 100 characters']
    },

    latitude: {
      type: Number,
      min: -90,
      max: 90
    },

    longitude: {
      type: Number,
      min: -180,
      max: 180
    },

    lastDonationDate: {
      type: Date,
      required: false,
      validate: {
        validator: function (value) {
          // If a date is provided, it must not be in the future
          if (!value) return true;
          return value <= new Date();
        },
        message: 'Last donation date cannot be in the future'
      }
    },

    verificationStatus: {
      type: String,
      enum: {
        values: ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'],
        message: '{VALUE} is not a valid verification status'
      },
      default: 'PENDING'
    }
  },
  {
    timestamps: true
  }
);

// JSON Transform — Strip internal __v field
donorProfileSchema.methods.toJSON = function () {
  const donorObject = this.toObject();
  delete donorObject.__v;
  return donorObject;
};

module.exports = mongoose.model('DonorProfile', donorProfileSchema);
