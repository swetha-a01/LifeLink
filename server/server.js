/**
 * LifeLink — Server Entry Point
 * 
 * 1. Loads environment variables (via config).
 * 2. Connects to MongoDB (exits on failure).
 * 3. Starts the Express server.
 * 4. Handles graceful shutdown on SIGTERM / SIGINT.
 */

const app = require('./app');
const config = require('./config/config');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const mongoose = require('mongoose');

// ---- Start Server ----
const startServer = async () => {
  // Connect to MongoDB — will exit process if connection fails
  await connectDB();

  const server = app.listen(config.port, () => {
    logger.info('===========================================');
    logger.info('  LifeLink Server Started');
    logger.info(`  Environment : ${config.nodeEnv}`);
    logger.info(`  Port        : ${config.port}`);
    logger.info(`  URL         : http://localhost:${config.port}`);
    logger.info('===========================================');
  });

  // ---- Graceful Shutdown ----
  const gracefulShutdown = async (signal) => {
    logger.info(`\n${signal} received. Shutting down gracefully...`);

    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed.');
    });

    try {
      // Close MongoDB connection
      await mongoose.connection.close();
      logger.info('MongoDB connection closed.');
    } catch (err) {
      logger.error(`Error closing MongoDB connection: ${err.message}`);
    }

    process.exit(0);
  };

  // Listen for termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
};

startServer();
