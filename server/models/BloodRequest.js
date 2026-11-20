/**
 * LifeLink — Blood Request Model
 *
 * Mongoose schema for the `bloodrequests` collection.
 *
 * Statuses:
 *   SEARCHING       — Default status upon creation. Request is actively looking for donors.
 *   DONOR_RESPONDED — At least one donor has responded.
 *   ACCEPTED        — Requester accepted a donor.
 *   COMPLETED       — Blood donation completed.
 *   CANCELLED       — Cancelled by requester.
 *   EXPIRED         — Automatically expired after required date passed.
 */

const mongoose = require('mongoose');

const bloodRequestSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester ID is required']
    },

    bloodGroup: {
      type: String,
      required: [true, 'Blood group is required'],
      enum: {
        values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        message: '{VALUE} is not a valid blood group'
      }
    },

    unitsRequired: {
      type: Number,
      required: [true, 'Units required is required'],
      min: [1, 'Units required must be at least 1 unit'],
      max: [20, 'Units required cannot exceed 20 units']
    },

    hospitalName: {
      type: String,
      required: [true, 'Hospital name is required'],
      trim: true,
      maxlength: [150, 'Hospital name cannot exceed 150 characters']
    },

    hospitalAddress: {
      type: String,
      trim: true,
      maxlength: 250,
      default: ''
    },

    city: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ''
    },

    district: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ''
    },

    state: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'Tamil Nadu'
    },

    pinCode: {
      type: String,
      trim: true,
      maxlength: 10,
      default: ''
    },

    landmark: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ''
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

    requiredDate: {
      type: Date,
      required: [true, 'Required date is required']
    },

    requiredTime: {
      type: String,
      required: [true, 'Required time is required'],
      trim: true
    },

    priority: {
      type: String,
      enum: {
        values: ['NORMAL', 'URGENT', 'EMERGENCY'],
        message: '{VALUE} is not a valid priority level'
      },
      default: 'NORMAL'
    },

    additionalInfo: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Additional information cannot exceed 500 characters']
    },

    status: {
      type: String,
      enum: {
        values: [
          'SEARCHING',
          'DONOR_RESPONDED',
          'ACCEPTED',
          'COMPLETED',
          'CANCELLED',
          'EXPIRED'
        ],
        message: '{VALUE} is not a valid request status'
      },
      default: 'SEARCHING'
    }
  },
  {
    timestamps: true
  }
);

// JSON Transform — Strip internal __v field
bloodRequestSchema.methods.toJSON = function () {
  const requestObject = this.toObject();
  delete requestObject.__v;
  return requestObject;
};

module.exports = mongoose.model('BloodRequest', bloodRequestSchema);
