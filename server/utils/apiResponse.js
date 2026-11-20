/**
 * LifeLink — API Response Helpers
 * 
 * Enforces consistent JSON response format across all endpoints:
 * 
 * Success: { success: true,  message: "...", data: {...} }
 * Error:   { success: false, message: "..." }
 */

/**
 * Send a success JSON response.
 * @param {object} res        - Express response object
 * @param {string} message    - Human-readable message
 * @param {object} [data={}]  - Response payload
 * @param {number} [statusCode=200] - HTTP status code
 */
const successResponse = (res, message, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Send an error JSON response.
 * @param {object} res        - Express response object
 * @param {string} message    - Human-readable error message
 * @param {number} [statusCode=500] - HTTP status code
 */
const errorResponse = (res, message, statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message
  });
};

module.exports = { successResponse, errorResponse };
