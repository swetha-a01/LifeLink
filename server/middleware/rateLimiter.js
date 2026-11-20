/**
 * LifeLink — Rate Limiter Middleware
 * 
 * Applied to API routes only (/api/*) — does NOT limit static frontend assets.
 * 
 * Defaults: 100 requests per 15-minute window per IP.
 * Returns a consistent JSON error when the limit is exceeded.
 */

const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,       // 15 minutes
  max: 100,                        // limit each IP to 100 requests per window
  standardHeaders: true,           // return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,            // disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});

module.exports = apiLimiter;
