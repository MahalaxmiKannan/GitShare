import mongoose from 'mongoose';
import { MONGO_URI } from './config.js';

export const connectDB = async () => {
  if (!MONGO_URI) {
    console.warn('⚠️ Warning: MONGO_URI is not defined in the environment variables. Skipping MongoDB connection.');
    return null;
  }

  try {
    const conn = await mongoose.connect(MONGO_URI);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    // We don't exit the process immediately so the server can run even if DB fails/is offline during testing
    return null;
  }
};

export default connectDB;
