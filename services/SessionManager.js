import ThreadsSession from "../models/ThreadsSession.js";
import { logInfo, logError } from "../utils/logger.js";

/**
 * Get session for a user
 */
export async function getSession(username) {
  try {
    if (!username) {
      return null;
    }

    const session = await ThreadsSession.findOne({ username });
    if (!session) {
      return null;
    }

    // Check if session is still valid
    if (!session.isSessionValid()) {
      await deleteSession(username);
      return null;
    }

    logInfo(`✅ Retrieved session for ${username}`);
    return session;
  } catch (error) {
    logError(`❌ getSession error: ${error.message}`);
    return null;
  }
}

/**
 * Save session for a user
 */
export async function saveSession(username, sessionData) {
  try {
    if (!username) {
      throw new Error("Username is required");
    }

    console.log('💾 [SessionManager] saveSession called:', { 
      username, 
      hasCookies: !!sessionData.cookies,
      cookiesCount: sessionData.cookies?.length 
    });

    // Check if session already exists
    let session = await ThreadsSession.findOne({ username });
    
    if (session) {
      console.log('♻️ [SessionManager] Updating existing session for:', username);
      
      // Update existing session
      session.cookies = sessionData.cookies || [];
      session.localStorage = sessionData.localStorage || {};
      session.sessionStorage = sessionData.sessionStorage || {};
      session.userAgent = sessionData.userAgent || session.userAgent;
      session.lastLogin = new Date();
      session.isValid = true; // Reset validity
      session.metadata = {
        ...session.metadata,
        botType: sessionData.botType || session.metadata?.botType || 'unknown',
        loginCount: (session.metadata?.loginCount || 0) + 1,
        lastUsed: new Date()
      };
      if (sessionData.csvLogPath) {
        session.csvLogPath = sessionData.csvLogPath;
      }
      
      await session.save();
      console.log('✅ [SessionManager] Updated session:', {
        username: session.username,
        id: session._id,
        loginCount: session.metadata.loginCount
      });
      
      logInfo(`♻️ Updated session for ${username}`);
    } else {
      console.log('🆕 [SessionManager] Creating new session for:', username);
      
      // Create new session
      session = new ThreadsSession({
        username,
        cookies: sessionData.cookies || [],
        localStorage: sessionData.localStorage || {},
        sessionStorage: sessionData.sessionStorage || {},
        userAgent: sessionData.userAgent || '',
        csvLogPath: sessionData.csvLogPath || '',
        lastLogin: new Date(),
        isValid: true,
        metadata: {
          botType: sessionData.botType || 'unknown',
          loginCount: 1,
          lastUsed: new Date()
        }
      });
      
      await session.save();
      console.log('✅ [SessionManager] Created new session:', {
        username: session.username,
        id: session._id
      });
      
      logInfo(`✅ Created new session for ${username}`);
    }

    // Verify the save by counting documents
    const totalCount = await ThreadsSession.countDocuments({});
    console.log('📊 [SessionManager] Total sessions in DB after save:', totalCount);

    return session;
  } catch (error) {
    console.error('❌ [SessionManager] saveSession error:', error);
    logError(`❌ saveSession error: ${error.message}`);
    throw error;
  }
}

/**
 * Check whether the provided username currently has a valid session.
 */
export async function hasValidSession(username) {
  try {
    if (!username) {
      return false;
    }

    const session = await ThreadsSession.findOne({ username });
    return session ? session.isSessionValid() : false;
  } catch (error) {
    logError(`❌ hasValidSession error: ${error.message}`);
    return false;
  }
}

/**
 * Delete the session for a given username.
 */
export async function deleteSession(username) {
  try {
    if (!username) {
      return false;
    }

    console.log('🗑️ [SessionManager] Deleting session for:', username);
    
    const result = await ThreadsSession.findOneAndDelete({ username });
    
    if (result) {
      console.log('✅ [SessionManager] Deleted session:', {
        username: result.username,
        id: result._id
      });
      logInfo(`🗑️ Deleted session for ${username}`);
      
      // Verify deletion
      const remainingCount = await ThreadsSession.countDocuments({});
      console.log('📊 [SessionManager] Remaining sessions:', remainingCount);
      
      return true;
    }

    console.log('⚠️ [SessionManager] No session found to delete for:', username);
    return false;
  } catch (error) {
    console.error('❌ [SessionManager] deleteSession error:', error);
    logError(`❌ deleteSession error: ${error.message}`);
    return false;
  }
}

/**
 * Run the cleanup routine that marks expired sessions as invalid.
 */
export async function cleanupExpiredSessions() {
  try {
    const cleaned = await ThreadsSession.cleanupExpired();
    if (cleaned > 0) {
      logInfo(`🧹 Cleaned ${cleaned} expired session(s)`);
    }

    return cleaned;
  } catch (error) {
    logError(`❌ cleanupExpiredSessions error: ${error.message}`);
    return 0;
  }
}

/**
 * Retrieve aggregated statistics about stored sessions.
 */
export async function getSessionStats() {
  try {
    return await ThreadsSession.getStats();
  } catch (error) {
    logError(`❌ getSessionStats error: ${error.message}`);
    return null;
  }
}

/**
 * Get details of a session for verification
 */
export async function getSessionDetails(username) {
  try {
    if (!username) {
      return null;
    }

    const session = await ThreadsSession.findOne({ username });
    if (!session) {
      return null;
    }

    return {
      username: session.username,
      lastLogin: session.lastLogin,
      isValid: session.isSessionValid(),
      hasCookies: session.cookies && session.cookies.length > 0,
      hasLocalStorage: session.localStorage && Object.keys(session.localStorage).length > 0,
      metadata: session.metadata
    };
  } catch (error) {
    logError(`❌ getSessionDetails error: ${error.message}`);
    return null;
  }
}

/**
 * Invalidate a session without deleting it
 */
export async function invalidateSession(username) {
  try {
    if (!username) {
      throw new Error("Username is required");
    }

    const session = await ThreadsSession.findOne({ username });
    if (!session) {
      throw new Error(`No session found for ${username}`);
    }

    session.metadata = {
      ...session.metadata,
      invalidated: true,
      invalidatedAt: new Date()
    };
    await session.save();
    logInfo(`⚠️ Invalidated session for ${username}`);
    return true;
  } catch (error) {
    logError(`❌ invalidateSession error: ${error.message}`);
    throw error;
  }
}

/**
 * ✅ IMPROVED: Get all usernames from stored sessions with extensive debugging
 */
export async function getAllSessions() {
  try {
    console.log('📥 [SessionManager.getAllSessions] ========== START ==========');
    
    // Check if model is available
    console.log('📥 [SessionManager] ThreadsSession model available:', !!ThreadsSession);
    console.log('📥 [SessionManager] Model name:', ThreadsSession.modelName);
    console.log('📥 [SessionManager] Collection name:', ThreadsSession.collection.name);
    
    // Method 1: Get all sessions with username only
    console.log('📥 [SessionManager] Method 1: Finding with projection { username: 1, _id: 0 }');
    const sessions = await ThreadsSession.find({}, { username: 1, _id: 0 }).lean();
    console.log('📊 [SessionManager] Sessions from Method 1:', {
      count: sessions.length,
      data: sessions
    });
    
    // Method 2: Get all sessions (full documents)
    console.log('📥 [SessionManager] Method 2: Finding all documents (no projection)');
    const fullSessions = await ThreadsSession.find({}).lean();
    console.log('📊 [SessionManager] Sessions from Method 2:', {
      count: fullSessions.length,
      usernames: fullSessions.map(s => s.username)
    });
    
    // Method 3: Get distinct usernames
    console.log('📥 [SessionManager] Method 3: Using distinct()');
    const distinctUsernames = await ThreadsSession.distinct('username');
    console.log('📊 [SessionManager] Distinct usernames:', distinctUsernames);
    
    // Method 4: Count documents
    const totalCount = await ThreadsSession.countDocuments({});
    console.log('📊 [SessionManager] Total document count:', totalCount);
    
    // Get database connection status
    const mongoose = (await import("mongoose")).default;
    console.log('🔌 [SessionManager] MongoDB connection state:', mongoose.connection.readyState);
    console.log('🔌 [SessionManager] Connection states: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting');
    
    if (sessions.length === 0 && totalCount > 0) {
      console.warn('⚠️ [SessionManager] WARNING: Documents exist but projection returned empty!');
      console.log('📊 [SessionManager] Using full documents instead');
      logInfo(`📥 Retrieved ${fullSessions.length} sessions (using fallback method)`);
      console.log('📥 [SessionManager.getAllSessions] ========== END ==========');
      return fullSessions;
    }
    
    logInfo(`📥 Retrieved ${sessions.length} sessions`);
    console.log('📥 [SessionManager.getAllSessions] ========== END ==========');
    return sessions.length > 0 ? sessions : fullSessions;
  } catch (error) {
    console.error('❌ [SessionManager.getAllSessions] Error:', error);
    console.error('❌ [SessionManager.getAllSessions] Stack:', error.stack);
    logError(`❌ getAllSessions error: ${error.message}`);
    return [];
  }
}

/**
 * ✅ NEW: Get all usernames only (optimized)
 */
export async function getAllUsernames() {
  try {
    console.log('📥 [SessionManager.getAllUsernames] Fetching usernames...');
    
    // Use distinct for better performance
    const usernames = await ThreadsSession.distinct('username');
    
    console.log('✅ [SessionManager.getAllUsernames] Found usernames:', usernames);
    logInfo(`📥 Retrieved ${usernames.length} unique usernames`);
    
    return usernames;
  } catch (error) {
    console.error('❌ [SessionManager.getAllUsernames] Error:', error);
    logError(`❌ getAllUsernames error: ${error.message}`);
    return [];
  }
}

// Export all functions as default
export default {
  getSession,
  saveSession,
  hasValidSession,
  deleteSession,
  cleanupExpiredSessions,
  getSessionStats,
  getSessionDetails,
  invalidateSession,
  getAllSessions,
  getAllUsernames, // ✅ Add new function
};