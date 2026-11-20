/**
 * LifeLink — Centralized Error Handler Middleware
 * 
 * This is the LAST middleware in the chain.
 * It catches all errors thrown or passed via next(err) and returns
 * a consistent JSON response.
 * 
 * Handles:
 *  - Mongoose ValidationError  → 400
 *  - Mongoose CastError        → 400 (invalid ObjectId, etc.)
 *  - Mongoose duplicate key    → 409
 *  - JWT errors                → 401
 *  - Custom errors with statusCode
 *  - Generic / unknown errors  → 500
 */

const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Default values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // ---- Mongoose Validation Error ----
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors).map((e) => e.message);
    message = `Validation failed: ${messages.join(', ')}`;
  }

  // ---- Mongoose CastError (e.g., invalid ObjectId) ----
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // ---- MongoDB Duplicate Key Error ----
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue).join(', ');
    message = `Duplicate value for: ${field}. Please use a different value.`;
  }

  // ---- JWT Errors ----
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired. Please log in again.';
  }

  // Log the error (full stack in development)
  if (statusCode >= 500) {
    logger.error(`${statusCode} - ${message}`);
    if (process.env.NODE_ENV === 'development') {
      logger.error(err.stack);
    }
  } else {
    logger.warn(`${statusCode} - ${message}`);
  }

  // Build response
  const response = {
    success: false,
    message
  };

  // Include stack trace only in development for debugging
  if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
