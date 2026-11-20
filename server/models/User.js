/**
 * LifeLink — User Model
 *
 * Mongoose schema for the `users` collection.
 *
 * Roles:
 *   USER  — default role, can request blood and/or become a donor
 *   ADMIN — platform administrator
 *
 * Security:
 *   - Passwords are hashed with bcrypt before saving (pre-save hook).
 *   - passwordHash is NEVER returned in JSON responses (toJSON transform).
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },

    passwordHash: {
      type: String,
      required: [true, 'Password is required']
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },

    dateOfBirth: {
      type: Date,
      validate: {
        validator: (value) => !value || value <= new Date(),
        message: 'Date of birth cannot be in the future'
      }
    },

    address: {
      street: { type: String, trim: true, maxlength: 200 },
      city: { type: String, trim: true, maxlength: 100 },
      district: { type: String, trim: true, maxlength: 100 },
      state: { type: String, trim: true, maxlength: 100 },
      pinCode: { type: String, trim: true, maxlength: 10 }
    },

    profilePhotoUrl: {
      type: String,
      trim: true,
      maxlength: 500
    },

    role: {
      type: String,
      enum: ['USER', 'ADMIN'],
      default: 'USER'
    },

    accountStatus: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE'
    },

    preferences: {
      emailNotifications: {
        type: Boolean,
        default: true
      },
      theme: {
        type: String,
        enum: ['system', 'light', 'dark'],
        default: 'system'
      }
    }
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true
  }
);

// ----------------------------------------------------------------
// PRE-SAVE HOOK — Hash password before storing in MongoDB
// ----------------------------------------------------------------
// This runs every time a document is saved.
// It only hashes the password if the passwordHash field was changed
// (e.g., during registration or password reset, NOT on every save).
// ----------------------------------------------------------------
userSchema.pre('save', async function (next) {
  // Skip hashing if passwordHash was not modified
  if (!this.isModified('passwordHash')) {
    return next();
  }

  try {
    // Generate a salt (10 rounds is a good default)
    const salt = await bcrypt.genSalt(10);

    // Hash the plain-text password and replace the field value
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);

    next();
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------------------
// INSTANCE METHOD — Compare a candidate password with the stored hash
// ----------------------------------------------------------------
// Usage:  const isMatch = await user.comparePassword('Test@123');
// ----------------------------------------------------------------
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// ----------------------------------------------------------------
// JSON TRANSFORM — Remove sensitive fields from API responses
// ----------------------------------------------------------------
// Whenever Express calls res.json(user), Mongoose calls toJSON().
// We strip passwordHash and __v so they are NEVER sent to the client.
// ----------------------------------------------------------------
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.passwordHash;
  delete userObject.__v;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
