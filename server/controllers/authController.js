/**
 * LifeLink — Authentication Controller
 *
 * Handles user registration, login, profile retrieval, and logout.
 *
 * Security:
 *   - Passwords are hashed by the User model's pre-save hook (bcrypt).
 *   - JWT tokens contain only userId and role — no sensitive data.
 *   - passwordHash is NEVER included in API responses.
 *   - Login returns the same error for wrong email OR wrong password
 *     to prevent user enumeration.
 */

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { validationResult } = require('express-validator');

// ----------------------------------------------------------------
// HELPER — Generate a signed JWT for the given user
// ----------------------------------------------------------------
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

// ----------------------------------------------------------------
// HELPER — Build a safe user object (no password, no internal fields)
// ----------------------------------------------------------------
const getSafeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  accountStatus: user.accountStatus,
  dateOfBirth: user.dateOfBirth,
  address: user.address,
  profilePhotoUrl: user.profilePhotoUrl,
  createdAt: user.createdAt
});

// ================================================================
// POST /api/auth/register
// ================================================================
const register = async (req, res, next) => {
  try {
    // Check express-validator results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, errors.array()[0].msg, 400);
    }

    const { name, email, phone, dateOfBirth, password } = req.body;

    // Check if the email is already registered
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return errorResponse(
        res,
        'An account with this email already exists.',
        409
      );
    }

    // Create the user
    // The plain-text password goes into passwordHash; the pre-save hook
    // will hash it automatically before writing to MongoDB.
    const user = await User.create({
      name,
      email,
      phone,
      ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
      passwordHash: password
    });

    // Return safe user data (no passwordHash)
    return successResponse(
      res,
      'Registration successful',
      { user: getSafeUser(user) },
      201
    );
  } catch (error) {
    next(error); // Handled by centralized error handler
  }
};

// ================================================================
// POST /api/auth/login
// ================================================================
const login = async (req, res, next) => {
  try {
    // Check express-validator results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, errors.array()[0].msg, 400);
    }

    const { email, password } = req.body;

    // Find user by email
    // NOTE: We must NOT use .select('-passwordHash') here because
    // we need the hash to compare against the provided password.
    const user = await User.findOne({ email: email.toLowerCase() });

    // Same error message for wrong email or wrong password (prevents enumeration)
    if (!user) {
      return errorResponse(res, 'Invalid email or password.', 401);
    }

    // Block suspended accounts
    if (user.accountStatus === 'SUSPENDED') {
      return errorResponse(
        res,
        'Your account has been suspended. Please contact support.',
        403
      );
    }

    // Compare the provided password with the stored hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid email or password.', 401);
    }

    // Generate JWT
    const token = generateToken(user);

    return successResponse(res, 'Login successful', {
      token,
      user: getSafeUser(user)
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET /api/auth/me  (protected — requires valid JWT)
// ================================================================
const getMe = async (req, res, next) => {
  try {
    // req.user is set by the protect middleware (already excludes passwordHash)
    return successResponse(res, 'User profile retrieved', {
      user: getSafeUser(req.user)
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// POST /api/auth/logout
// ================================================================
// JWT is stateless — the server cannot "invalidate" an already-issued token
// without a token blacklist (not implemented in this phase).
// The actual logout happens on the client by deleting the stored token.
// This endpoint exists so the frontend has a clean API call to make.
// ================================================================
const logout = async (req, res) => {
  return successResponse(
    res,
    'Logout successful. Please remove the token from client storage.'
  );
};

module.exports = { register, login, getMe, logout };
