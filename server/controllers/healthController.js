/**
 * LifeLink — Health Controller
 * 
 * Returns basic server health information.
 * 
 * SECURITY: Does NOT expose environment variables, MongoDB URI,
 * JWT secrets, or any internal server configuration.
 */

const mongoose = require('mongoose');
const { successResponse } = require('../utils/apiResponse');

/**
 * GET /api/health
 * Returns server status, uptime, database connection state, and timestamp.
 */
const getHealthStatus = (req, res) => {
  // Map Mongoose readyState to a human-readable string
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbState = mongoose.connection.readyState;

  return successResponse(res, 'Server is running', {
    status: 'OK',
    uptime: `${Math.floor(process.uptime())}s`,
    database: dbStates[dbState] || 'unknown',
    timestamp: new Date().toISOString()
  });
};

module.exports = { getHealthStatus };
