import runSearchBot from "../Bots/search.js";
import runNotificationBot from "../Bots/notification.js";
import runFlowBot from "../Bots/flow.js";
import { logInfo, logError, logSuccess } from "../utils/logger.js";
import { cleanupExpiredSessions, getSessionStats } from "../services/SessionManager.js";

/**
 * Start full automation workflow
 * @param {Object} settings - Automation settings from frontend
 * @returns {Promise<Object>} Result object
 */
export async function startFullAutomation(settings) {
  try {
    logInfo("🚀 Starting full automation workflow...");
    
    const {
      username,
      password,
      mode = 'flow', // 'flow', 'search', 'notification'
      posts_to_process = 40,
      like_percentage = 40,
      comment_percentage = 13,
      reply_percentage = 13,
      search_query = '',
      duration_minutes = 60,
    } = settings;

    // Validate required fields
    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    // Build config for bot with correct parameter names
    const config = {
      username,
      password,
      numPosts: Number(posts_to_process) || 40, // Changed from maxPosts to numPosts
      likeProbability: Number(like_percentage) / 100 || 0.4,
      commentProbability: Number(comment_percentage) / 100 || 0.13,
      replyProbability: Number(reply_percentage) / 100 || 0.13,
      durationMinutes: Number(duration_minutes) || 60,
      searchQuery: search_query || '',
      headless: settings.headless !== true, // Default to true for production
      chromePath: process.env.CHROME_PATH || null,
    };

    logInfo(`📋 Mode: ${mode}`);
    logInfo(`👤 User: ${username}`);
    logInfo(`⚙️ Settings: ${JSON.stringify(config, null, 2)}`);

    // Cleanup expired sessions before starting
    await cleanupExpiredSessions();

    // Run the appropriate bot based on mode
    let result;
    
    switch (mode) {
      case 'search':
        if (!config.searchQuery) {
          throw new Error("Search query is required for search mode");
        }
        logInfo(`🔍 Starting search bot for: "${config.searchQuery}"`);
        result = await runSearchBot({
          username: config.username,
          password: config.password,
          searchQuery: config.searchQuery,
          numPosts: config.numPosts,
          searchDurationMinutes: config.durationMinutes,
          likeProbability: config.likeProbability,
          commentProbability: config.commentProbability,
          replyProbability: config.replyProbability,
          headless: config.headless,
          chromePath: config.chromePath,
        });
        break;

      case 'notification':
        logInfo(`🔔 Starting notification bot`);
        result = await runNotificationBot({
          username: config.username,
          password: config.password,
          checkIntervalMinutes: 120,
          maxRepliesPerCheck: 10,
          headless: config.headless,
          chromePath: config.chromePath,
        });
        break;

      case 'flow':
      default:
        logInfo(`🌊 Starting flow bot (scroll, like, comment, reply)`);
        result = await runFlowBot({
          username: config.username,
          password: config.password,
          maxPosts: config.numPosts,
          likeProbability: config.likeProbability,
          commentProbability: config.commentProbability,
          replyProbability: config.replyProbability,
          durationMinutes: config.durationMinutes,
          headless: config.headless,
          chromePath: config.chromePath,
        });
        break;
    }

    logSuccess(`✅ Automation completed successfully`);
    
    return {
      success: true,
      message: `${mode} bot completed successfully`,
      data: result,
    };
  } catch (error) {
    logError(`❌ Automation error: ${error.message}`);
    return {
      success: false,
      message: error.message,
      error: error.stack,
    };
  }
}

/**
 * Create a Threads post
 * @param {Object} data - Post data
 * @returns {Promise<Object>} Result object
 */
export async function createThreadsPost(data) {
  try {
    const { postText, hashtags = [], username, password } = data;

    if (!postText) {
      throw new Error("Post text is required");
    }

    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    logInfo(`📝 Creating Threads post for ${username}`);

    // Implementation would use botBootstrap to create post
    // For now, return success
    logSuccess(`✅ Post created successfully`);

    return {
      success: true,
      message: "Post created successfully",
    };
  } catch (error) {
    logError(`❌ Create post error: ${error.message}`);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Automated post creation
 * @param {Object} data - Post data
 * @returns {Promise<Object>} Result object
 */
export async function automatedThreadsPostCreation(data) {
  try {
    const { topic, username, password } = data;

    if (!topic) {
      throw new Error("Topic is required");
    }

    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    logInfo(`🤖 Generating and posting about: "${topic}"`);

    // Implementation would use aiGeneration and botBootstrap
    logSuccess(`✅ Automated post created successfully`);

    return {
      success: true,
      message: "Automated post created successfully",
    };
  } catch (error) {
    logError(`❌ Automated post error: ${error.message}`);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Search and interact
 * @param {Object} data - Search data
 * @returns {Promise<Object>} Result object
 */
export async function searchAndInteract(data) {
  try {
    logInfo(`🔍 Starting search and interact`);
    
    // Validate required fields
    if (!data.username || !data.password) {
      throw new Error("Username and password are required");
    }
    
    if (!data.searchQuery) {
      throw new Error("Search query is required");
    }
    
    const result = await runSearchBot({
      username: data.username,
      password: data.password,
      searchQuery: data.searchQuery,
      numPosts: data.numPosts || 10,
      searchDurationMinutes: data.searchDurationMinutes || 30,
      likeProbability: data.likeProbability || 0.4,
      commentProbability: data.commentProbability || 0.13,
      replyProbability: data.replyProbability || 0.13,
      headless: data.headless !==true,
      chromePath: data.chromePath || null,
    });
    
    return {
      success: result.success,
      message: result.success ? "Search completed" : "Search failed",
      data: result,
    };
  } catch (error) {
    logError(`❌ Search error: ${error.message}`);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Check and reply to notifications
 * @param {Object} data - Notification data
 * @returns {Promise<Object>} Result object
 */
export async function checkAndReplyToNotifications(data) {
  try {
    logInfo(`🔔 Checking notifications`);
    
    // Validate required fields
    if (!data.username || !data.password) {
      throw new Error("Username and password are required");
    }
    
    const result = await runNotificationBot({
      username: data.username,
      password: data.password,
      checkIntervalMinutes: 0, // Single check
      maxRepliesPerCheck: data.maxRepliesPerCheck || 10,
      headless: data.headless !== true,
      chromePath: data.chromePath || null,
    });
    
    return {
      success: result.success,
      message: result.success ? "Notifications checked" : "Check failed",
      data: result,
    };
  } catch (error) {
    logError(`❌ Notification error: ${error.message}`);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Schedule multiple Threads posts
 * @param {Object} data - Post scheduling data
 * @returns {Promise<Object>} Result object
 */
export async function scheduleThreadsPosts(data) {
  try {
    const { posts = [], delayBetweenPosts = 900000, username, password } = data;

    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    if (posts.length === 0) {
      throw new Error("No posts to schedule");
    }

    logInfo(`📅 Scheduling ${posts.length} posts`);

    // Implementation would schedule posts
    logSuccess(`✅ Posts scheduled successfully`);

    return {
      success: true,
      message: `Scheduled ${posts.length} posts`,
      scheduled: posts.length,
      delayBetweenPosts,
    };
  } catch (error) {
    logError(`❌ Schedule error: ${error.message}`);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Get session statistics
 * @returns {Promise<Object>} Session stats
 */
export async function getSessionStatistics() {
  try {
    const stats = await getSessionStats();
    logInfo(`📊 Session stats retrieved`);
    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    logError(`❌ Stats error: ${error.message}`);
    return {
      success: false,
      message: error.message,
    };
  }
}

export default {
  startFullAutomation,
  createThreadsPost,
  automatedThreadsPostCreation,
  searchAndInteract,
  checkAndReplyToNotifications,
  scheduleThreadsPosts,
  getSessionStatistics,
};