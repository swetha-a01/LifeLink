/**
 * LifeLink — Centralized Configuration
 * 
 * Reads all environment variables and exports a single frozen config object.
 * Every module imports from here instead of reading process.env directly.
 */

require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5000',
  publicAppUrl: (process.env.LIFELINK_APP_URL || 'http://localhost:5000').replace(/\/+$/, ''),
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'LifeLink <noreply@lifelink.org>'
  },
  location: {
    enabled: process.env.LOCATION_MATCHING_ENABLED !== 'false',
    geocodingUrl: process.env.GEOCODING_URL || 'https://nominatim.openstreetmap.org/search',
    routingUrl: process.env.OSRM_ROUTING_URL || 'https://router.project-osrm.org/route/v1/driving',
    timeoutMs: parseInt(process.env.LOCATION_SERVICE_TIMEOUT_MS, 10) || 5000,
    userAgent: process.env.LOCATION_SERVICE_USER_AGENT || 'LifeLink/1.0 (development)'
  }
};

// ---- Startup validation ----
// Ensure critical variables are set — fail fast if not.
if (!config.mongoUri) {
  console.error('FATAL: MONGODB_URI is not defined in environment variables.');
  process.exit(1);
}

if (!config.jwtSecret || config.jwtSecret === 'CHANGE_ME_to_a_strong_random_secret_key_at_least_32_chars') {
  console.warn('WARNING: JWT_SECRET is not set or is using the default placeholder. Set a strong secret in .env for production.');
}

module.exports = Object.freeze(config);
