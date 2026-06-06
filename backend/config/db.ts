import mongoose from "mongoose";

/**
 * Connect to MongoDB.
 * The connection string is read from MONGO_URI (see .env.example),
 * falling back to a local development database.
 */
export async function connectDB(): Promise<void> {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error("❌ MONGO_URI is not set. Add it to backend/.env");
    process.exit(1);
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(mongoUri);
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ MongoDB connection error:", message);
    // Exit so the failure is visible instead of running a server with no DB.
    process.exit(1);
  }
}

export default connectDB;
