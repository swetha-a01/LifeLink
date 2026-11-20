/**
 * LifeLink — Authentication Middleware
 *
 * Protects routes by verifying the JWT sent in the Authorization header.
 *
 * Flow:
 *   1. Read token from "Authorization: Bearer <token>" header.
 *   2. Verify the token using the JWT secret from config.
 *   3. Find the user in MongoDB.
 *   4. Check account status (SUSPENDED users are blocked).
 *   5. Attach the user object to req.user for downstream handlers.
 *
 * Usage in routes:
 *   const { protect } = require('../middleware/authMiddleware');
 *   router.get('/me', protect, controller);
 */

const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');
const { errorResponse } = require('../utils/apiResponse');

/**
 * Middleware — Require a valid JWT to access the route.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Step 1: Extract token from "Authorization: Bearer <token>"
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // No token provided
    if (!token) {
      return errorResponse(res, 'Authentication required. Please log in.', 401);
    }

    // Step 2: Verify the token
    const decoded = jwt.verify(token, config.jwtSecret);

    // Step 3: Find the user (exclude passwordHash from the query result)
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user) {
      return errorResponse(res, 'User not found. Please log in again.', 401);
    }

    // Step 4: Block suspended accounts
    if (user.accountStatus === 'SUSPENDED') {
      return errorResponse(
        res,
        'Your account has been suspended. Please contact support.',
        403
      );
    }

    // Step 5: Attach user to request — downstream handlers can use req.user
    req.user = user;

    next();
  } catch (error) {
    // Handle specific JWT errors with user-friendly messages
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid token. Please log in again.', 401);
    }
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token has expired. Please log in again.', 401);
    }
    return errorResponse(res, 'Authentication failed.', 401);
  }
};

/**
 * Attach the current user when a valid bearer token is supplied, but allow
 * public email-action pages to load before the donor signs in.
 */
const optionalProtect = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authorization.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (user && user.accountStatus !== 'SUSPENDED') {
      req.user = user;
    }
  } catch (error) {
    // The action endpoint will treat an invalid session as unauthenticated.
    // It must never fall back to that session for authorization.
  }

  return next();
};

/**
 * Middleware — Require ADMIN role (must be used AFTER protect).
 *
 * Usage:
 *   router.get('/admin-only', protect, adminOnly, controller);
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    return next();
  }
  return errorResponse(
    res,
    'Access denied. Administrator privileges required.',
    403
  );
};

module.exports = { protect, optionalProtect, adminOnly };
