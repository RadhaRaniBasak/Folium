import mongoose from 'mongoose';
import { env } from './env';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export async function connectDB(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(env.MONGO_URI);
      console.log('✅ MongoDB connected');
      return;
    } catch (err) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.error(
        `❌ MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed. Retrying in ${delay}ms...`,
        err,
      );
      if (attempt === MAX_RETRIES) {
        throw new Error(`Failed to connect to MongoDB after ${MAX_RETRIES} attempts`);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export function disconnectDB(): Promise<void> {
  return mongoose.disconnect();
}
