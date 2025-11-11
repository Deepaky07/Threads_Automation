import mongoose from 'mongoose';

const userSessionSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  cookies: {
    type: Array,
    default: []
  },
  localStorage: {
    type: Object,
    default: {}
  },
  sessionStorage: {
    type: Object,
    default: {}
  },
  userAgent: {
    type: String,
    default: ''
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  isValid: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  },
  metadata: {
    loginCount: { type: Number, default: 0 },
    botType: { type: String, default: 'unknown' },
    lastIP: String,
    lastUserAgent: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Instance methods
userSessionSchema.methods.isSessionValid = function() {
  return this.isValid && this.expiresAt > new Date();
};

userSessionSchema.methods.markAsUsed = function() {
  this.lastUsed = new Date();
  return this.save();
};

// Static methods
userSessionSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isValid: false }
    ]
  });
  return result.deletedCount;
};

userSessionSchema.statics.getStats = async function() {
  return await this.aggregate([
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        validSessions: {
          $sum: { $cond: ['$isValid', 1, 0] }
        },
        totalLogins: { $sum: '$metadata.loginCount' },
        avgLoginCount: { $avg: '$metadata.loginCount' }
      }
    }
  ]);
};

export default mongoose.model('UserSession', userSessionSchema);
