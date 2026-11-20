/**
 * LifeLink — Blood Centre Model (Phase 10)
 *
 * Mongoose schema for the `bloodcentres` collection.
 *
 * Stores blood donation centre information including location,
 * contact details, operating hours, and supported blood groups.
 *
 * Status:
 *   ACTIVE   — Centre is operational and visible to users
 *   INACTIVE — Centre is not shown to ordinary users
 */

const mongoose = require('mongoose');

const bloodCentreSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Centre name is required'],
      trim: true,
      minlength: [2, 'Centre name must be at least 2 characters'],
      maxlength: [150, 'Centre name cannot exceed 150 characters']
    },

    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      maxlength: [300, 'Address cannot exceed 300 characters']
    },

    area: {
      type: String,
      required: [true, 'Area is required'],
      trim: true,
      maxlength: [100, 'Area cannot exceed 100 characters']
    },

    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters']
    },

    phone: {
      type: String,
      required: [true, 'Contact phone is required'],
      trim: true
    },

    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      match: [/^$|^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },

    operatingHours: {
      type: String,
      required: [true, 'Operating hours are required'],
      trim: true,
      maxlength: [150, 'Operating hours cannot exceed 150 characters']
    },

    supportedBloodGroups: {
      type: [String],
      required: [true, 'At least one supported blood group is required'],
      validate: {
        validator: function (arr) {
          if (!arr || arr.length === 0) return false;
          const valid = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
          return arr.every((g) => valid.includes(g));
        },
        message: 'Supported blood groups must contain valid blood group values'
      }
    },

    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'INACTIVE'],
        message: '{VALUE} is not a valid centre status'
      },
      default: 'ACTIVE'
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient querying
bloodCentreSchema.index({ city: 1, status: 1 });
bloodCentreSchema.index({ name: 1 }, { unique: true });

// JSON Transform — Strip internal __v field
bloodCentreSchema.methods.toJSON = function () {
  const centreObject = this.toObject();
  delete centreObject.__v;
  return centreObject;
};

module.exports = mongoose.model('BloodCentre', bloodCentreSchema);
