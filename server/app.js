/**
 * LifeLink — Express Application
 * 
 * Configures and exports the Express app with all middleware.
 * 
 * Middleware order:
 *   1. Helmet          — security headers
 *   2. CORS            — cross-origin control
 *   3. express.json()  — parse JSON bodies
 *   4. express.urlencoded() — parse URL-encoded bodies
 *   5. Morgan          — HTTP request logging
 *   6. Static files    — serve client/ folder
 *   7. API Rate Limiter — applied to /api/* routes only
 *   8. Routes          — API route handlers
 *   9. 404 Middleware  — catch unmatched routes
 *  10. Error Handler   — centralized error handling
 */

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config/config');

// Middleware
const apiLimiter = require('./middleware/rateLimiter');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

// Routes
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const donorRoutes = require('./routes/donorRoutes');
const requestRoutes = require('./routes/requestRoutes');
const matchRoutes = require('./routes/matchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const centreRoutes = require('./routes/centreRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');

// ---- Create Express app ----
const app = express();

// 1. Helmet — set secure HTTP headers
//    CSP is configured to allow Bootstrap/jQuery CDNs and inline scripts
//    needed by our frontend pages.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://code.jquery.com",
          "https://cdn.jsdelivr.net"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net"
        ],
        fontSrc: [
          "'self'",
          "https://cdn.jsdelivr.net"
        ],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"]
      }
    }
  })
);

// 2. CORS
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));

// 3. Parse JSON request bodies (limit payload size)
app.use(express.json({ limit: '10mb' }));

// 4. Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. HTTP request logging (dev format in development)
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 6. Serve static frontend files from client/ folder
//    This is NOT rate-limited so HTML/CSS/JS/images load normally.
app.use(express.static(path.join(__dirname, '..', 'client')));

// 7. API Rate Limiter — applied only to /api/* routes
app.use('/api', apiLimiter);

// ---- API Routes ----
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/users', userRoutes);
app.use('/api/donor', donorRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

// ---- 404 Middleware (after all routes) ----
app.use(notFound);

// ---- Centralized Error Handler (must be last) ----
app.use(errorHandler);

module.exports = app;
