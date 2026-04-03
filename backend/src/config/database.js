const mongoose = require('mongoose');
const logger = require('../utils/logger');
const env = require('./env');

const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection error:', error.message);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB runtime error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
};

module.exports = connectDB;
