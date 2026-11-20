/**
 * LifeLink — MongoDB Connection
 * 
 * Connects to MongoDB using the URI from config.
 * If the connection fails at startup, the process exits with a clear error.
 */

const mongoose = require('mongoose');
const config = require('./config');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB.
 * @returns {Promise<void>} Resolves when connected, exits process on failure.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 10000 // Fail fast (10s) if MongoDB is unreachable
    });
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    logger.error('Please ensure MongoDB is running and MONGODB_URI is correct in .env');
    process.exit(1); // Do not continue with a broken database connection
  }
};

module.exports = connectDB;
