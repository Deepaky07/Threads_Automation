import mongoose, { Schema } from "mongoose";

const threadsSessionSchema = new Schema(
  {
    username: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true 
    },
    cookies: { 
      type: [mongoose.Schema.Types.Mixed], 
      default: [] 
    },
    localStorage: { 
      type: Map, 
      of: String, 
      default: () => new Map() // Fixed: Use function to create new Map
    },
    sessionStorage: { 
      type: Map, 
      of: String, 
      default: () => new Map() // Fixed: Use function to create new Map
    },
    csvLogPath: {
      type: String,
      default: ''
    },
    userAgent: { 
      type: String,
      default: ''
    },
    lastLogin: { 
      type: Date, 
      default: Date.now 
    },
    isValid: { 
      type: Boolean, 
      default: true 
    },
    metadata: {
      loginCount: { type: Number, default: 0 },
      lastUsed: { type: Date, default: Date.now },
      browser: { type: String, default: 'chromium' },
      ip: { type: String, default: '' },
      botType: { type: String, default: 'unknown' }, // 'search', 'notification', 'flow', etc.
    },
  },
  { 
    timestamps: true,
    collection: 'threads_sessions'
  }
);

// Instance method: Check if session is still valid (23 hours)
threadsSessionSchema.methods.isSessionValid = function () {
  const now = Date.now();
  const ageMs = now - this.lastLogin.getTime();
  const maxAgeMs = 23 * 60 * 60 * 1000; // 23 hours
  return this.isValid && ageMs < maxAgeMs;
};

// Instance method: Mark session as used
threadsSessionSchema.methods.markAsUsed = async function () {
  this.metadata.lastUsed = new Date();
  await this.save();
};

// Instance method: Get session age in hours
threadsSessionSchema.methods.getSessionAge = function () {
  const ageMs = Date.now() - this.lastLogin.getTime();
  return Math.floor(ageMs / (60 * 60 * 1000));
};

// Instance method: Invalidate session
threadsSessionSchema.methods.invalidate = async function () {
  this.isValid = false;
  await this.save();
};

// Static method: Cleanup expired sessions
threadsSessionSchema.statics.cleanupExpired = async function () {
  const sessions = await this.find({ isValid: true });
  let cleaned = 0;
  
  for (const session of sessions) {
    if (!session.isSessionValid()) {
      session.isValid = false;
      await session.save();
      cleaned++;
    }
  }
  
  return cleaned;
};

// Static method: Get session statistics
threadsSessionSchema.statics.getStats = async function () {
  const sessions = await this.find();
  
  const stats = {
    total: sessions.length,
    valid: 0,
    expired: 0,
    avgAge: 0,
    byBotType: {},
    oldestSession: null,
    newestSession: null,
  };

  let totalAge = 0;

  for (const session of sessions) {
    if (session.isSessionValid()) {
      stats.valid++;
    } else {
      stats.expired++;
    }

    const age = session.getSessionAge();
    totalAge += age;

    // Track by bot type
    const botType = session.metadata.botType || 'unknown';
    stats.byBotType[botType] = (stats.byBotType[botType] || 0) + 1;

    if (!stats.oldestSession || age > stats.oldestSession.age) {
      stats.oldestSession = { username: session.username, age };
    }

    if (!stats.newestSession || age < stats.newestSession.age) {
      stats.newestSession = { username: session.username, age };
    }
  }

  stats.avgAge = sessions.length > 0 ? (totalAge / sessions.length).toFixed(1) : 0;

  return stats;
};

// Static method: Delete old expired sessions (older than 7 days)
threadsSessionSchema.statics.deleteOldExpired = async function () {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await this.deleteMany({
    isValid: false,
    lastLogin: { $lt: sevenDaysAgo }
  });
  return result.deletedCount;
};

const ThreadsSession = mongoose.model("ThreadsSession", threadsSessionSchema);

export default ThreadsSession;