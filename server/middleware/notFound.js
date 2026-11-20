/**
 * LifeLink — 404 Not Found Middleware
 * 
 * Catches any request that didn't match a route and returns a
 * consistent JSON 404 response.
 * 
 * Must be placed AFTER all routes and BEFORE the centralized error handler.
 */

const notFound = (req, res, next) => {
  const error = new Error(`Not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = notFound;
