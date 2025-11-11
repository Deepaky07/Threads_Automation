import mongoose from "mongoose";
import { logInfo, logSuccess, logError } from "../utils/logger.js";

/**
 * Connect to MongoDB
 * @param {string} mongoUri - MongoDB connection URI
 * @returns {Promise<boolean>} Success status
 */
export async function connectDatabase(mongoUri = null) {
  try {
    const uri = mongoUri || process.env.MONGODB_URI || "mongodb://localhost:27017/threads_bot";
    
    logInfo("🔌 Connecting to MongoDB...");
    
    // Fixed: Removed deprecated options (they are now defaults in Mongoose 6+)
    await mongoose.connect(uri);
    
    logSuccess(`✅ MongoDB connected: ${mongoose.connection.name}`);
    
    // Setup connection event listeners
    mongoose.connection.on("error", (error) => {
      logError(`❌ MongoDB error: ${error.message}`);
    });

    mongoose.connection.on("disconnected", () => {
      logInfo("⚠️ MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      logSuccess("✅ MongoDB reconnected");
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      await disconnectDatabase();
      process.exit(0);
    });

    return true;
  } catch (error) {
    logError(`❌ MongoDB connection error: ${error.message}`);
    return false;
  }
}

/**
 * Disconnect from MongoDB
 * @returns {Promise<void>}
 */
export async function disconnectDatabase() {
  try {
    await mongoose.connection.close();
    logInfo("👋 MongoDB connection closed");
  } catch (error) {
    logError(`❌ MongoDB disconnect error: ${error.message}`);
  }
}

/**
 * Check database connection status
 * @returns {boolean} True if connected
 */
export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Get database connection state
 * @returns {string} Connection state
 */
export function getDatabaseState() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
}

/**
 * Get database statistics
 * @returns {Promise<Object>} Database stats
 */
export async function getDatabaseStats() {
  try {
    if (!isDatabaseConnected()) {
      throw new Error("Database not connected");
    }

    const stats = await mongoose.connection.db.stats();
    
    return {
      connected: true,
      database: mongoose.connection.name,
      collections: stats.collections,
      dataSize: `${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`,
      storageSize: `${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`,
      indexes: stats.indexes,
      avgObjSize: `${(stats.avgObjSize / 1024).toFixed(2)} KB`,
      documents: stats.objects,
    };
  } catch (error) {
    logError(`❌ Database stats error: ${error.message}`);
    return {
      connected: false,
      error: error.message,
    };
  }
}

/**
 * Ping database to check if it's responsive
 * @returns {Promise<boolean>} True if database responds
 */
export async function pingDatabase() {
  try {
    if (!isDatabaseConnected()) {
      return false;
    }
    
    await mongoose.connection.db.admin().ping();
    return true;
  } catch (error) {
    logError(`❌ Database ping error: ${error.message}`);
    return false;
  }
}

/**
 * Get list of collections in the database
 * @returns {Promise<Array>} Array of collection names
 */
export async function listCollections() {
  try {
    if (!isDatabaseConnected()) {
      throw new Error("Database not connected");
    }
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    return collections.map(col => col.name);
  } catch (error) {
    logError(`❌ List collections error: ${error.message}`);
    return [];
  }
}

export default {
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected,
  getDatabaseState,
  getDatabaseStats,
  pingDatabase,
  listCollections,
};