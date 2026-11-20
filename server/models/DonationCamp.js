const mongoose = require('mongoose');

const donationCampSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 150 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    area: { type: String, required: true, trim: true, maxlength: 100 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    operatingHours: { type: String, required: true, trim: true, maxlength: 150 },
    eventDate: { type: Date, required: true },
    eventTime: { type: String, required: true, trim: true, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Event time must use HH:MM format'] },
    capacity: { type: Number, required: true, min: 1, max: 100000 },
    registeredCount: { type: Number, default: 0, min: 0 },
    supportedBloodGroups: {
      type: [String],
      required: true,
      validate: {
        validator: (groups) => {
          const valid = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
          return Array.isArray(groups) && groups.length > 0 && groups.every((group) => valid.includes(group));
        },
        message: 'Supported blood groups must contain valid blood group values'
      }
    },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    notes: { type: String, trim: true, maxlength: 500, default: '' }
  },
  { timestamps: true }
);

donationCampSchema.index({ city: 1, status: 1, eventDate: 1 });

donationCampSchema.methods.toJSON = function () {
  const value = this.toObject();
  delete value.__v;
  return value;
};

module.exports = mongoose.model('DonationCamp', donationCampSchema);
