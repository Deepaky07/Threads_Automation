// ============================================================================
// COMPLETE routes.js - With CSV Logging Endpoints
// ============================================================================

import express from "express";
import { getAnalyticsData } from "./controllers/analyticsController.js";
import { getGoogleSheetData } from "./controllers/googleSheetsController.js";
import { generateThreadsPost, createThreadsPost } from "./Bots/post.js";
import { runNotificationChecker } from "./Bots/notification.js";
import runSearchBot from "./Bots/search.js";
import { automatedThreadsPostCreation } from "./Bots/index.js";
import runComprehensiveFlowBot from "./Bots/flow.js";
import { startFullAutomation } from "./controllers/threadController.js";
import {
  saveSession,
  hasValidSession,
  deleteSession,
  getAllSessions,
  getSession,
} from "./services/SessionManager.js";
import { CSV_FILE_PATH } from "./utils/csvLogger.js";
import { initializeBotWithSession } from "./helpers/botBootstrap.js";
import { sleep } from "./utils/logger.js";
import https from 'https';
import http from 'http';

// CSV functions
import {
  getCSVStats,
  exportCSVAsJSON,
  getPostEntriesFromCSV,
  downloadCSV,
  clearCSV,
  initializeCSV,
  filterCSVData,
  getRecentLogs,
  backupCSV
} from "./utils/csvLogger.js";

const router = express.Router();

// Initialize CSV on server start
initializeCSV();

// ✅ SINGLETON BROWSER MANAGER
class BrowserManager {
  constructor() {
    this.activeBots = new Map();
    this.queue = [];
  }

  async startBot(botType, config, botFunction) {
    const botId = `${botType}_${config.username}_${Date.now()}`;
    if (this.activeBots.has(botId)) {
      throw new Error(`${botType} bot already running for ${config.username}`);
    }

    this.activeBots.set(botId, {
      type: botType,
      username: config.username,
      startTime: Date.now(),
    });
    console.log(`✅ Starting ${botType} bot for ${config.username}`);
    botFunction(config)
      .then((result) => {
        console.log(`✅ ${botType} bot completed:`, result);
      })
      .catch((error) => {
        console.error(`❌ ${botType} bot error:`, error.message);
      })
      .finally(() => {
        this.activeBots.delete(botId);
        console.log(`🏁 ${botType} bot finished for ${config.username}`);
      });
    return { botId, status: 'started' };
  }

  getActiveBots() {
    return Array.from(this.activeBots.entries()).map(([id, info]) => ({
      id,
      ...info,
      runningFor: Math.floor((Date.now() - info.startTime) / 1000),
    }));
  }

  async stopBot(botId) {
    if (this.activeBots.has(botId)) {
      this.activeBots.delete(botId);
      return { success: true, message: `Bot ${botId} stopped` };
    }
    return { success: false, message: 'Bot not found' };
  }
}

const browserManager = new BrowserManager();

// ===== CREDENTIALS ENDPOINTS =====
router.post('/api/auth/save-credentials', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('💾 [SAVE CREDENTIALS] Request received:', {
      username,
      hasPassword: !!password
    });
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    const sessionData = {
      cookies: [
        { name: 'threads_username', value: username },
        { name: 'threads_password', value: password },
      ],
      localStorage: {},
      sessionStorage: {},
      botType: 'manual_save',
      userAgent: req.headers['user-agent'] || 'unknown'
    };
    sessionData.csvLogPath = CSV_FILE_PATH;
    const savedSession = await saveSession(username, sessionData);
    const verifySession = await getSession(username);
    res.json({
      success: true,
      message: '✅ Credentials saved to MongoDB',
      username,
      verified: !!verifySession
    });
  } catch (error) {
    console.error('❌ [SAVE CREDENTIALS] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/api/auth/delete-credentials', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username required' });
    }

    const deleted = await deleteSession(username);
    res.json({
      success: deleted,
      message: deleted ? '✅ Credentials deleted' : '❌ Credentials not found'
    });
  } catch (error) {
    console.error('❌ [DELETE CREDENTIALS] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api/check-session', async (req, res) => {
  try {
    const { username } = req.body;
    const hasSession = username ? await hasValidSession(username) : false;
    res.json({
      hasValidSession: hasSession,
      username: hasSession ? username : null,
    });
  } catch (error) {
    console.error('❌ [CHECK SESSION] Error:', error);
    res.json({ hasValidSession: false });
  }
});

router.get('/api/auth/get-usernames', async (req, res) => {
  try {
    const sessions = await getAllSessions();
    const usernames = sessions
      .map(session => session.username)
      .filter(Boolean);
    res.json({
      success: true,
      usernames: [...new Set(usernames)],
      count: usernames.length
    });
  } catch (error) {
    console.error('❌ [GET USERNAMES] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== CSV LOGGING ENDPOINTS =====

// 1. Get CSV statistics (user-specific or all users)
router.get('/api/logs/csv/stats', (req, res) => {
  try {
    // Get username from query parameter
    const username = req.query.username || null;
    
    const stats = getCSVStats(username);
    if (!stats) {
      return res.json({
        success: true,
        exists: false,
        message: username ? `No CSV file found for user: ${username}` : 'No CSV file found yet',
        stats: {
          totalEntries: 0,
          fileSize: '0 KB',
          byActionType: {},
          byStatus: {},
          byModule: {},
          byUser: {}
        }
      });
    }

    res.json({
      success: true,
      exists: true,
      stats: stats
    });
  } catch (error) {
    console.error('❌ Error getting CSV stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 2. Get CSV data as JSON with pagination
router.get('/api/logs/csv/data', (req, res) => {
  try {
    // Get username from query parameter or header
    const username = req.query.username || req.headers['x-username'];
    
    console.log('📊 Fetching CSV data for user:', username || 'all users');
    
    // Export CSV data for specific user or all users
    const result = exportCSVAsJSON(username);
    
    // Handle different return formats from exportCSVAsJSON
    let data = [];
    if (result && result.success) {
      data = result.data || [];
    } else if (Array.isArray(result)) {
      data = result;
    }
    
    // Filter data: if username is provided, show entries that match the username OR have empty username (legacy data)
    if (username && data.length > 0) {
      data = data.filter(entry => {
        const entryUsername = entry.Username || '';
        return entryUsername === username || entryUsername === '';
      });
      console.log(`📊 Filtered to ${data.length} entries for user ${username} (including legacy data)`);
    }
    
    if (!data || data.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: username ? `No CSV data available for user: ${username}` : 'No CSV data available',
        pagination: {
          page: 1,
          limit: 100,
          total: 0,
          totalPages: 0
        }
      });
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Sort by timestamp (newest first)
    const sortedData = [...data].sort((a, b) =>
      new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime()
    );
    const paginatedData = sortedData.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedData,
      pagination: {
        page: page,
        limit: limit,
        total: data.length,
        totalPages: Math.ceil(data.length / limit)
      },
      username: username || 'all'
    });
  } catch (error) {
    console.error('❌ Error getting CSV data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3. Get recent logs
router.get('/api/logs/csv/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const recentLogs = getRecentLogs(limit);
    res.json({
      success: true,
      data: recentLogs,
      count: recentLogs.length,
      limit: limit
    });
  } catch (error) {
    console.error('❌ Error getting recent logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 4. Download CSV file
router.get('/api/logs/csv/download', (req, res) => {
  try {
    const csvFile = downloadCSV();
    if (!csvFile) {
      return res.status(404).json({
        success: false,
        message: 'CSV file not found'
      });
    }

    res.setHeader('Content-Type', csvFile.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${csvFile.filename}"`);
    res.send(csvFile.content);
  } catch (error) {
    console.error('❌ Error downloading CSV:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 5. Clear CSV file
router.post('/api/logs/csv/clear', (req, res) => {
  try {
    const cleared = clearCSV();
    if (cleared) {
      res.json({
        success: true,
        message: 'CSV file cleared successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to clear CSV file'
      });
    }
  } catch (error) {
    console.error('❌ Error clearing CSV:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 6. Filter CSV data
router.get('/api/logs/csv/filter', (req, res) => {
  try {
    const filters = {
      actionType: req.query.actionType,
      status: req.query.status,
      username: req.query.username,
      author: req.query.author,
      module: req.query.module,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) delete filters[key];
    });

    const filteredData = filterCSVData(filters);
    res.json({
      success: true,
      data: filteredData,
      count: filteredData.length,
      filters: filters
    });
  } catch (error) {
    console.error('❌ Error filtering CSV data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 7. Backup CSV file
router.post('/api/logs/csv/backup', (req, res) => {
  try {
    const backupPath = backupCSV();
    if (backupPath) {
      res.json({
        success: true,
        message: 'CSV backup created successfully',
        backupPath: backupPath
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to create CSV backup'
      });
    }
  } catch (error) {
    console.error('❌ Error backing up CSV:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 8. Get all posts from CSV file (with insights)
router.post('/api/profile/posts', async (req, res) => {
  let browser = null;
  const overallTimeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('⏱️ Posts fetch timeout after 120 seconds');
      res.status(504).json({
        success: false,
        error: 'Request timeout - fetching posts took too long'
      });
    }
  }, 120000); // 2 minute overall timeout

  try {
    const username = req.body.username || req.query.username || req.headers['x-username'];
    const password = req.body.password || req.query.password;

    if (!username) {
      clearTimeout(overallTimeout);
      return res.status(400).json({
        success: false,
        error: 'Username is required'
      });
    }

    if (!password) {
      clearTimeout(overallTimeout);
      return res.status(400).json({
        success: false,
        error: 'Password is required. Please provide password in request body.'
      });
    }

    console.log(`📱 Fetching posts from CSV for: @${username}`);
    const startTime = Date.now();

    // Use optimized function to get only POST entries (much faster)
    const csvData = getPostEntriesFromCSV(username);
    if (!csvData.success || !csvData.data || csvData.data.length === 0) {
      clearTimeout(overallTimeout);
      return res.status(404).json({
        success: false,
        error: 'No posts found in CSV file. Please create some posts first.'
      });
    }

    const postEntries = csvData.data;
    console.log(`📋 Found ${postEntries.length} posts in CSV (optimized parsing)`);

    // Extract unique posts (by post link to avoid duplicates)
    const uniquePosts = [];
    const seenLinks = new Set();

    for (const entry of postEntries) {
      const postLink = entry['Post Link'] || '';
      const postContent = entry['Post Content'] || '';
      
      // Include posts with content even if no link (use content as identifier)
      const identifier = postLink || postContent.substring(0, 50);
      
      if (identifier && !seenLinks.has(identifier)) {
        seenLinks.add(identifier);
        
        // Extract post ID from link
        let postId = '';
        if (postLink && postLink.includes('/post/')) {
          postId = postLink.split('/post/')[1]?.split('?')[0] || '';
        }

        uniquePosts.push({
          postId,
          postLink: postLink || '',
          postContent: postContent,
          timestamp: entry['Timestamp'] || entry['Date'] + ' ' + entry['Time'],
          username: entry['Username'] || entry['Author'] || username,
          generatedText: entry['Generated Text'] || '',
        });
      }
    }

    // Sort posts by timestamp (newest first)
    uniquePosts.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA; // Newest first
    });

    console.log(`📋 Extracted ${uniquePosts.length} unique posts from CSV (sorted by date)`);

    // Check if insights should be fetched (default: false for faster loading)
    const fetchInsights = req.body.fetchInsights === true || req.body.fetchInsights === 'true';
    const maxInsightsPosts = parseInt(req.body.maxInsightsPosts) || 20;
    
    console.log(`📊 fetchInsights flag: ${fetchInsights} (from request: ${req.body.fetchInsights})`);
    
    // If not fetching insights, return posts immediately (much faster)
    if (!fetchInsights) {
      clearTimeout(overallTimeout);
      const postsWithoutInsights = uniquePosts.map((post, index) => ({
        index,
        postId: post.postId || '',
        postLink: post.postLink || '',
        postContent: post.postContent || '',
        timestamp: post.timestamp || '',
        username: post.username || username,
        mediaUrls: [],
        likes: '0',
        replies: '0',
        reposts: '0',
        shares: '0',
        insights: {
          views: '0',
          totalInteractions: '0',
          likes: '0',
          quotes: '0',
          replies: '0',
          reposts: '0',
          profileFollows: '0'
        }
      }));
      
      const endTime = Date.now();
      console.log(`✅ Returned ${postsWithoutInsights.length} posts in ${((endTime - startTime) / 1000).toFixed(2)}s (without insights)`);
      
      return res.json({
        success: true,
        data: postsWithoutInsights,
        totalPosts: uniquePosts.length,
        fetchedInsights: false,
        message: 'Posts loaded from CSV. Set fetchInsights=true to load insights (slower).'
      });
    }

    // Initialize browser to fetch insights (only if requested)
    console.log(`📊 ========================================`);
    console.log(`📊 FETCHING INSIGHTS FROM PROFILE PAGE`);
    console.log(`📊 This may take a few minutes...`);
    console.log(`📊 ========================================`);
    const { browser: browserInstance, page } = await initializeBotWithSession({
      username,
      password,
      botType: 'insights_fetcher',
      headless: true,
      chromePath: null,
    });

    browser = browserInstance;
    console.log(`✅ Browser initialized, navigating to profile page...`);

    // Navigate to user's profile page
    const profileUrl = `https://www.threads.net/@${username}`;
    console.log(`🔍 Navigating to profile page: ${profileUrl}`);
    
    try {
      await page.goto(profileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await sleep(3000);
      
      // Wait for posts to load
      try {
        await page.waitForSelector('div[data-pressable-container="true"]', {
          timeout: 10000
        });
        console.log('✅ Posts loaded on profile page');
      } catch (e) {
        console.log('⚠️ No posts found initially, continuing...');
      }
    } catch (err) {
      console.error(`❌ Failed to navigate to profile page:`, err.message);
      throw err;
    }

    // Scroll down to load more posts
    console.log('📜 Scrolling to load more posts on profile page...');
    for (let scroll = 0; scroll < 10; scroll++) {
      await page.evaluate(() => {
        window.scrollBy(0, 1000);
      });
      await sleep(1000);
    }
    
    // CRITICAL: Wait for engagement metrics to load
    console.log('⏳ Waiting for engagement metrics to load...');
    await sleep(3000);
    
    // Scroll back to top to ensure all posts are in viewport
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await sleep(2000);

    // Extract all posts from profile page with engagement metrics, matching by post links
    const csvPostLinks = uniquePosts.map(p => p.postLink).filter(Boolean);
    console.log(`📋 Looking for ${csvPostLinks.length} posts from CSV on profile page...`);
    
    const profilePosts = await page.evaluate((csvPostLinks) => {
      const postsMap = {};
      
      // Normalize post links for matching
      const normalizeLink = (link) => {
        if (!link) return '';
        let normalized = link.trim();
        if (normalized.startsWith('http')) {
          try {
            const url = new URL(normalized);
            normalized = url.pathname;
          } catch (e) {
            const match = normalized.match(/\/@[\w\.]+\/post\/[\w]+/);
            if (match) normalized = match[0];
          }
        }
        if (normalized.startsWith('/')) normalized = normalized.substring(1);
        const postIdMatch = normalized.match(/post\/([\w]+)/i);
        if (postIdMatch) {
          return postIdMatch[1].toLowerCase();
        }
        return normalized.toLowerCase();
      };

      // Create a map of normalized post IDs to original links
      const linkMap = {};
      const postIdToLinkMap = {};
      csvPostLinks.forEach(link => {
        const normalized = normalizeLink(link);
        if (normalized) {
          linkMap[normalized] = link;
          const postIdMatch = link.match(/post\/([\w]+)/i);
          if (postIdMatch) {
            const postId = postIdMatch[1].toLowerCase();
            postIdToLinkMap[postId] = link;
            linkMap[postId] = link;
          }
        }
      });

      console.log(`🔍 Looking for ${csvPostLinks.length} posts on profile page...`);
      
      // Helper function to extract engagement metrics
      const extractEngagementMetric = (container, svgAriaLabel) => {
        try {
          // Find the SVG with the specific aria-label
          const svg = container.querySelector(`svg[aria-label="${svgAriaLabel}"]`) || 
                      container.querySelector(`svg[aria-label*="${svgAriaLabel}"]`);
          
          if (!svg) return '0';
          
          // Get the parent button/div
          const button = svg.closest('button') || svg.closest('[role="button"]') || svg.closest('div[class*="x1i10hfl"]');
          if (!button) return '0';
          
          // The count span is a SIBLING of the SVG container, not inside the button
          // Structure: button > div > div > svg AND button > div > div > span.xmd891q
          const svgParent = svg.parentElement;
          const svgGrandParent = svgParent?.parentElement;
          
          // Method 1: Look for span.xmd891q as sibling of SVG container
          if (svgGrandParent) {
            const countContainer = svgGrandParent.querySelector('span.xmd891q') || 
                                  svgGrandParent.querySelector('span[class*="xmd891q"]');
            if (countContainer) {
              const innerDiv = countContainer.querySelector('div.xu9jpxn') || 
                              countContainer.querySelector('div[class*="xu9jpxn"]');
              if (innerDiv) {
                const countSpan = innerDiv.querySelector('span.x1o0tod') ||
                                 innerDiv.querySelector('span[class*="x1o0tod"]') ||
                                 innerDiv.querySelector('span.x10l6tqk') ||
                                 innerDiv.querySelector('span[class*="x10l6tqk"]') ||
                                 innerDiv.querySelector('span.x13vifvy') ||
                                 innerDiv.querySelector('span[class*="x13vifvy"]') ||
                                 innerDiv.querySelector('span');
                if (countSpan) {
                  const text = countSpan.textContent?.trim();
                  if (text && /^\d+$/.test(text)) {
                    console.log(`✅ Found ${svgAriaLabel} count: ${text}`);
                    return text;
                  }
                }
              }
            }
          }
          
          // Method 2: Look in button's parent container
          const buttonParent = button.parentElement;
          if (buttonParent) {
            const countContainer = buttonParent.querySelector('span.xmd891q') || 
                                  buttonParent.querySelector('span[class*="xmd891q"]');
            if (countContainer) {
              const innerDiv = countContainer.querySelector('div.xu9jpxn') || 
                              countContainer.querySelector('div[class*="xu9jpxn"]');
              if (innerDiv) {
                const countSpan = innerDiv.querySelector('span');
                if (countSpan) {
                  const text = countSpan.textContent?.trim();
                  if (text && /^\d+$/.test(text)) {
                    console.log(`✅ Found ${svgAriaLabel} count (method 2): ${text}`);
                    return text;
                  }
                }
              }
            }
          }
          
          // Method 3: Look directly inside button for any span with the count classes
          const countSpans = button.querySelectorAll('span[class*="x1o0tod"], span[class*="x10l6tqk"], span[class*="x13vifvy"]');
          for (const span of countSpans) {
            const text = span.textContent?.trim();
            if (text && /^\d+$/.test(text)) {
              console.log(`✅ Found ${svgAriaLabel} count (method 3): ${text}`);
              return text;
            }
          }
          
          // Method 4: Check all spans in button's parent for pure numbers
          if (buttonParent) {
            const allSpans = buttonParent.querySelectorAll('span');
            for (const span of allSpans) {
              const text = span.textContent?.trim();
              // Only accept pure numbers (not "39m", "3d", etc.)
              if (text && /^\d+$/.test(text) && text.length <= 6) {
                console.log(`✅ Found ${svgAriaLabel} count (method 4): ${text}`);
                return text;
              }
            }
          }
          
          console.log(`⚠️ No count found for ${svgAriaLabel}`);
          return '0';
        } catch (err) {
          console.error(`Error extracting ${svgAriaLabel}:`, err);
          return '0';
        }
      };
      
      // Find all post containers on the profile page
      // Based on provided HTML: posts are in div[data-pressable-container="true"]
      const postContainers = Array.from(document.querySelectorAll('div[data-pressable-container="true"]'));
      console.log(`📦 Found ${postContainers.length} post containers on profile page`);
      
      postContainers.forEach((container, index) => {
        // Find post link in this container
        const postLinkElement = container.querySelector('a[href*="/post/"]');
        if (!postLinkElement) return;
        
        const href = postLinkElement.getAttribute('href') || '';
        const normalizedHref = normalizeLink(href);
        
        // Check if this link matches any CSV post link
        let originalLink = linkMap[normalizedHref];
        if (!originalLink) {
          const postIdMatch = href.match(/post\/([\w]+)/i);
          if (postIdMatch) {
            const postId = postIdMatch[1].toLowerCase();
            originalLink = postIdToLinkMap[postId] || linkMap[postId];
          }
        }
        
        if (originalLink) {
          console.log(`✅ Found matching post: ${originalLink} (container ${index + 1})`);
          
          // Find the engagement container
          let engagementContainer = container.querySelector('div.x78zum5');
          if (!engagementContainer) {
            engagementContainer = container.querySelector('div[class*="x78zum5"]');
          }
          
          // If still not found, look for the parent of buttons with engagement SVGs
          if (!engagementContainer) {
            const likeButton = container.querySelector('svg[aria-label*="Like"]');
            if (likeButton) {
              engagementContainer = likeButton.closest('div[class*="x78zum5"]') || 
                                   likeButton.closest('div.x6s0dn4') ||
                                   likeButton.closest('div');
            }
          }
          
          console.log(`🔍 Engagement container found: ${!!engagementContainer}`);
          
          let likes = '0';
          let replies = '0';
          let reposts = '0';
          let shares = '0';
          
          if (engagementContainer) {
            // Debug: log the container HTML
            console.log(`📋 Container HTML sample:`, engagementContainer.innerHTML.substring(0, 500));
            
            likes = extractEngagementMetric(engagementContainer, 'Like') || 
                    extractEngagementMetric(engagementContainer, 'Unlike') || '0';
            replies = extractEngagementMetric(engagementContainer, 'Reply') || '0';
            reposts = extractEngagementMetric(engagementContainer, 'Repost') || '0';
            shares = extractEngagementMetric(engagementContainer, 'Share') || '0';
            
            console.log(`📊 Extracted metrics - Likes: ${likes}, Replies: ${replies}, Reposts: ${reposts}, Shares: ${shares}`);
            
            // FALLBACK: If all metrics are 0, try a simpler direct approach
            if (likes === '0' && replies === '0' && reposts === '0' && shares === '0') {
              console.log(`⚠️ All metrics are 0, trying direct approach...`);
              
              // Find all divs with role="button" or actual buttons
              const allButtons = container.querySelectorAll('div[role="button"], button');
              console.log(`🔍 Found ${allButtons.length} buttons in container`);
              
              allButtons.forEach((btn, btnIdx) => {
                const svg = btn.querySelector('svg');
                if (!svg) return;
                
                const ariaLabel = svg.getAttribute('aria-label') || '';
                console.log(`🔍 Button ${btnIdx} has SVG with aria-label: ${ariaLabel}`);
                
                // Look for span with number next to this button
                const btnParent = btn.parentElement;
                if (btnParent) {
                  const spans = btnParent.querySelectorAll('span');
                  spans.forEach(span => {
                    const text = span.textContent?.trim();
                    if (text && /^\d+$/.test(text)) {
                      console.log(`🔢 Found number "${text}" near ${ariaLabel} button`);
                      if (ariaLabel.includes('Like') || ariaLabel.includes('Unlike')) {
                        likes = text;
                      } else if (ariaLabel.includes('Reply')) {
                        replies = text;
                      } else if (ariaLabel.includes('Repost')) {
                        reposts = text;
                      } else if (ariaLabel.includes('Share')) {
                        shares = text;
                      }
                    }
                  });
                }
              });
              
              console.log(`📊 After direct approach - Likes: ${likes}, Replies: ${replies}, Reposts: ${reposts}, Shares: ${shares}`);
            }
          } else {
            console.warn('⚠️ Could not find engagement container for post');
          }
          
          // Store the post data with engagement metrics
          postsMap[originalLink] = {
            postLink: originalLink,
            likes,
            replies,
            reposts,
            shares
          };
          
          console.log(`📊 Stored post ${originalLink}:`, postsMap[originalLink]);
        }
      });
      
      return postsMap;
    }, csvPostLinks);

    console.log(`📊 Extracted engagement metrics for ${Object.keys(profilePosts).length} posts from profile page`);
    if (Object.keys(profilePosts).length > 0) {
      console.log(`📊 Sample extracted posts:`, Object.keys(profilePosts).slice(0, 2).map(key => ({ link: key, metrics: profilePosts[key] })));
    } else {
      console.warn(`⚠️ No posts extracted from profile page!`);
    }

    // Match profile posts with CSV posts and combine data
    const postsWithInsights = [];
    
    for (let i = 0; i < uniquePosts.length; i++) {
      const post = uniquePosts[i];
      
      // Find matching profile post by link
      let profilePost = null;
      if (post.postLink) {
        // Try exact match first
        profilePost = profilePosts[post.postLink];
        
        // If not found, try normalized match
        if (!profilePost) {
          const normalizedLink = post.postLink.startsWith('/') 
            ? post.postLink.substring(1) 
            : post.postLink;
          profilePost = profilePosts[normalizedLink] || 
                       profilePosts[`/${normalizedLink}`] ||
                       profilePosts[`https://www.threads.net/${normalizedLink}`] ||
                       profilePosts[`https://www.threads.net${post.postLink}`];
        }
        
        // Try matching by post ID
        if (!profilePost && post.postId) {
          const postIdLower = post.postId.toLowerCase();
          for (const [link, postData] of Object.entries(profilePosts)) {
            if (link.includes(postIdLower) || link.includes(post.postId)) {
              profilePost = postData;
              console.log(`✅ Matched post by post ID ${post.postId} for link: ${link}`);
              break;
            }
          }
        }
      }
      
      // Combine CSV post data with profile post engagement metrics
      const likes = profilePost?.likes || '0';
      const replies = profilePost?.replies || '0';
      const reposts = profilePost?.reposts || '0';
      const shares = profilePost?.shares || '0';
      
      // Calculate total interactions
      const totalInteractions = (parseInt(likes) + parseInt(replies) + parseInt(reposts) + parseInt(shares)).toString();
      
      const postData = {
        index: i,
        postId: post.postId || '',
        postLink: post.postLink || '',
        postContent: post.postContent || '',
        timestamp: post.timestamp || '',
        username: post.username || username,
        mediaUrls: [],
        likes,
        replies,
        reposts,
        shares,
        insights: {
          views: '0', // Views not available on profile page
          totalInteractions,
          likes,
          quotes: '0',
          replies,
          reposts,
          profileFollows: '0'
        }
      };
      
      postsWithInsights.push(postData);
      
      if (profilePost) {
        console.log(`✅ Matched post ${i + 1}/${uniquePosts.length}: ${post.postLink || post.postId} - Likes: ${likes}, Replies: ${replies}, Reposts: ${reposts}`);
      } else {
        console.log(`⚠️ No match found for post ${i + 1}/${uniquePosts.length}: ${post.postLink || post.postId}`);
      }
    }

    // Close browser
    if (browser) {
      await browser.close();
      console.log('✅ Browser closed');
    }

    clearTimeout(overallTimeout);
    
    const endTime = Date.now();
    const elapsedTime = Math.round((endTime - startTime) / 1000);
    console.log(`✅ Fetched engagement metrics for ${postsWithInsights.length} posts in ${elapsedTime}s`);
    console.log(`📊 Posts with engagement metrics: ${postsWithInsights.filter(p => p.likes !== '0' || p.replies !== '0' || p.reposts !== '0').length}/${postsWithInsights.length}`);
    
    res.json({
      success: true,
      data: postsWithInsights,
      totalPosts: uniquePosts.length,
      fetchedInsights: true,
      elapsedTime: elapsedTime,
      message: `Successfully fetched engagement metrics for ${postsWithInsights.length} posts from profile page`
    });

  } catch (error) {
    clearTimeout(overallTimeout);
    console.error('❌ Error fetching posts from CSV:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Close browser on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('❌ Error closing browser:', closeError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch posts from CSV',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 8b. Get all posts from user's profile (original method - kept as backup)
router.post('/api/profile/posts-scrape', async (req, res) => {
  let browser = null;
  const overallTimeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('⏱️ Posts fetch timeout after 120 seconds');
      res.status(504).json({
        success: false,
        error: 'Request timeout - fetching posts took too long'
      });
    }
  }, 120000); // 2 minute overall timeout

  try {
    const username = req.body.username || req.query.username || req.headers['x-username'];
    const password = req.body.password || req.query.password;

    if (!username) {
      clearTimeout(overallTimeout);
      return res.status(400).json({
        success: false,
        error: 'Username is required'
      });
    }

    if (!password) {
      clearTimeout(overallTimeout);
      return res.status(400).json({
        success: false,
        error: 'Password is required. Please provide password in request body.'
      });
    }

    console.log(`📱 Fetching posts for profile: @${username}`);
    const startTime = Date.now();

    // Initialize browser session
    const { browser: browserInstance, page } = await initializeBotWithSession({
      username,
      password,
      botType: 'profile_scraper',
      headless: true,
      chromePath: null,
    });

    browser = browserInstance;

    // Navigate to user's profile
    const profileUrl = `https://www.threads.net/@${username}`;
    console.log(`🔍 Navigating to: ${profileUrl}`);
    
    await page.goto(profileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Reduced initial wait - just wait for posts to appear
    await sleep(2000);

    // Wait for initial posts to load
    try {
      await page.waitForSelector('div[data-pressable-container="true"]', {
        timeout: 10000
      });
    } catch (e) {
      console.log('⚠️ No posts found initially');
    }

    // Optimized scrolling - fewer attempts, faster
    const maxScrollAttempts = 5;
    let scrollAttempts = 0;
    let lastPostCount = 0;
    
    while (scrollAttempts < maxScrollAttempts) {
      const currentPostCount = await page.evaluate(() => {
        return document.querySelectorAll('div[data-pressable-container="true"]').length;
      });
      
      if (currentPostCount === lastPostCount && scrollAttempts > 2) {
        console.log(`📊 No new posts loaded after scroll ${scrollAttempts}, stopping`);
        break;
      }
      
      lastPostCount = currentPostCount;
      await page.evaluate(() => {
        window.scrollBy(0, 2000);
      });
      await sleep(2000);
      scrollAttempts++;
    }

    // Extract all posts from profile page (this route is kept as backup)
    // This route extracts posts directly from profile page without CSV matching
    const maxPosts = parseInt(req.body.maxPosts) || 50;
    const posts = await page.evaluate((maxPosts) => {
      const containers = document.querySelectorAll('div[data-pressable-container="true"]');
      const limit = Math.min(containers.length, maxPosts || 50);
      const extractedPosts = [];

      // Helper function to extract engagement metrics
      const extractEngagementMetric = (container, svgAriaLabel) => {
        try {
          const svg = container.querySelector(`svg[aria-label="${svgAriaLabel}"]`) || 
                      container.querySelector(`svg[aria-label*="${svgAriaLabel}"]`);
          
          if (!svg) return '0';
          
          // Get the button/clickable element
          const button = svg.closest('button') || svg.closest('[role="button"]') || svg.closest('div[class*="x1i10hfl"]');
          if (!button) return '0';
          
          // The count span is a SIBLING of the SVG container, not inside the button
          // Structure: button > div > div > svg AND button > div > div > span.xmd891q
          const svgParent = svg.parentElement;
          const svgGrandParent = svgParent?.parentElement;
          
          // Method 1: Look for span.xmd891q as sibling of SVG container
          if (svgGrandParent) {
            const countContainer = svgGrandParent.querySelector('span.xmd891q') || 
                                  svgGrandParent.querySelector('span[class*="xmd891q"]');
            if (countContainer) {
              const innerDiv = countContainer.querySelector('div.xu9jpxn') || 
                              countContainer.querySelector('div[class*="xu9jpxn"]');
              if (innerDiv) {
                const countSpan = innerDiv.querySelector('span.x1o0tod') ||
                                 innerDiv.querySelector('span[class*="x1o0tod"]') ||
                                 innerDiv.querySelector('span.x10l6tqk') ||
                                 innerDiv.querySelector('span[class*="x10l6tqk"]') ||
                                 innerDiv.querySelector('span.x13vifvy') ||
                                 innerDiv.querySelector('span[class*="x13vifvy"]') ||
                                 innerDiv.querySelector('span');
                if (countSpan) {
                  const text = countSpan.textContent?.trim();
                  if (text && /^\d+$/.test(text)) {
                    console.log(`✅ Found ${svgAriaLabel} count: ${text}`);
                    return text;
                  }
                }
              }
            }
          }
          
          // Method 2: Look in button's parent container
          const buttonParent = button.parentElement;
          if (buttonParent) {
            const countContainer = buttonParent.querySelector('span.xmd891q') || 
                                  buttonParent.querySelector('span[class*="xmd891q"]');
            if (countContainer) {
              const innerDiv = countContainer.querySelector('div.xu9jpxn') || 
                              countContainer.querySelector('div[class*="xu9jpxn"]');
              if (innerDiv) {
                const countSpan = innerDiv.querySelector('span');
                if (countSpan) {
                  const text = countSpan.textContent?.trim();
                  if (text && /^\d+$/.test(text)) {
                    console.log(`✅ Found ${svgAriaLabel} count (method 2): ${text}`);
                    return text;
                  }
                }
              }
            }
          }
          
          // Method 3: Look directly inside button for any span with the count classes
          const countSpans = button.querySelectorAll('span[class*="x1o0tod"], span[class*="x10l6tqk"], span[class*="x13vifvy"]');
          for (const span of countSpans) {
            const text = span.textContent?.trim();
            if (text && /^\d+$/.test(text)) {
              console.log(`✅ Found ${svgAriaLabel} count (method 3): ${text}`);
              return text;
            }
          }
          
          // Method 4: Check all spans in button's parent for pure numbers
          if (buttonParent) {
            const allSpans = buttonParent.querySelectorAll('span');
            for (const span of allSpans) {
              const text = span.textContent?.trim();
              // Only accept pure numbers (not "39m", "3d", etc.)
              if (text && /^\d+$/.test(text) && text.length <= 6) {
                console.log(`✅ Found ${svgAriaLabel} count (method 4): ${text}`);
                return text;
              }
            }
          }
          
          console.log(`⚠️ No count found for ${svgAriaLabel}`);
          return '0';
        } catch (err) {
          console.error(`❌ Error extracting ${svgAriaLabel}:`, err);
          return '0';
        }
      };

      for (let index = 0; index < limit; index++) {
        const container = containers[index];
        try {
          // Extract username - look for links with @username pattern
          const profileLinks = container.querySelectorAll('a[href*="/@"]');
          let username = '';
          for (const link of profileLinks) {
            const href = link.getAttribute('href') || '';
            const text = link.textContent.trim();
            // Get username from href or text
            if (href.includes('/@')) {
              const match = href.match(/\/@([^\/\?]+)/);
              if (match) username = match[1];
            }
            if (!username && text && !text.includes(' ')) {
              username = text.replace('@', '');
            }
            if (username) break;
          }

          // Extract post content - look for spans with meaningful text
          const contentSpans = container.querySelectorAll('span[dir="auto"]');
          let postContent = '';
          const contentParts = [];
          
          for (const span of contentSpans) {
            const text = span.textContent.trim();
            // Filter: meaningful text that's not a timestamp, username, or engagement count
            if (text.length > 15 && 
                text.length < 2000 && 
                !text.match(/^\d+[mhd]$/) && // Not "39m", "3d"
                !text.match(/^@\w+$/) && // Not "@username"
                !text.match(/^\d+$/) && // Not just numbers
                !text.includes('followers') &&
                !text.includes('following')) {
              contentParts.push(text);
            }
          }
          
          // Join multiple content parts (for multi-line posts)
          postContent = contentParts.join(' ').trim();

          // Extract timestamp
          const timeElement = container.querySelector('time');
          let timestamp = '';
          if (timeElement) {
            timestamp = timeElement.getAttribute('datetime') || timeElement.textContent.trim();
          }

          // Extract post link
          const postLinks = container.querySelectorAll('a[href*="/post/"]');
          const postLink = postLinks.length > 0 ? postLinks[0].getAttribute('href') : '';
          const postId = postLink ? postLink.split('/post/')[1]?.split('?')[0] : '';

          // Extract media (images) - look for post images, not profile pictures
          const mediaUrls = [];
          
          // Method 1: Look for images inside post media links (most reliable)
          const postMediaLinks = container.querySelectorAll('a[href*="/post/"][href*="/media"]');
          postMediaLinks.forEach(link => {
            const picture = link.querySelector('picture');
            if (picture) {
              const img = picture.querySelector('img');
              if (img) {
                const src = img.getAttribute('src');
                const srcset = img.getAttribute('srcset');
                const alt = img.getAttribute('alt') || '';
                
                // Use srcset if available (higher quality), otherwise use src
                let imageUrl = srcset ? srcset.split(',')[0].trim().split(' ')[0] : src;
                
                if (imageUrl && 
                    imageUrl.startsWith('http') && 
                    !alt.toLowerCase().includes('profile picture') &&
                    !imageUrl.includes('profile_pic') &&
                    !imageUrl.includes('s150x150') &&
                    !imageUrl.includes('s36x36') &&
                    !imageUrl.includes('s100x100')) {
                  if (!mediaUrls.includes(imageUrl)) {
                    mediaUrls.push(imageUrl);
                  }
                }
              }
            }
          });
          
          // Method 1b: Look for images in divs with class x1xmf6yo (media container from HTML)
          if (mediaUrls.length === 0) {
            const mediaContainers = container.querySelectorAll('div[class*="x1xmf6yo"]');
            mediaContainers.forEach(container => {
              const picture = container.querySelector('picture');
              if (picture) {
                const img = picture.querySelector('img');
                if (img) {
                  const src = img.getAttribute('src');
                  const srcset = img.getAttribute('srcset');
                  const alt = img.getAttribute('alt') || '';
                  
                  let imageUrl = srcset ? srcset.split(',')[0].trim().split(' ')[0] : src;
                  
                  if (imageUrl && 
                      imageUrl.startsWith('http') && 
                      !alt.toLowerCase().includes('profile picture') &&
                      !imageUrl.includes('profile_pic') &&
                      !imageUrl.includes('s150x150') &&
                      !imageUrl.includes('s36x36') &&
                      !imageUrl.includes('s100x100')) {
                    if (!mediaUrls.includes(imageUrl)) {
                      mediaUrls.push(imageUrl);
                    }
                  }
                }
              }
            });
          }

          // Extract engagement metrics
          let engagementContainer = container.querySelector('div.x78zum5');
          if (!engagementContainer) {
            engagementContainer = container.querySelector('div[class*="x78zum5"]');
          }
          
          if (!engagementContainer) {
            const likeButton = container.querySelector('svg[aria-label*="Like"]');
            if (likeButton) {
              engagementContainer = likeButton.closest('div[class*="x78zum5"]') || 
                                   likeButton.closest('div.x6s0dn4') ||
                                   likeButton.closest('div');
            }
          }
          
          let likes = '0';
          let replies = '0';
          let reposts = '0';
          let shares = '0';
          
          if (engagementContainer) {
            likes = extractEngagementMetric(engagementContainer, 'Like') || 
                    extractEngagementMetric(engagementContainer, 'Unlike') || '0';
            replies = extractEngagementMetric(engagementContainer, 'Reply') || '0';
            reposts = extractEngagementMetric(engagementContainer, 'Repost') || '0';
            shares = extractEngagementMetric(engagementContainer, 'Share') || '0';
          }

          // Only include posts with valid data
          if (username && (postContent || postLink)) {
            extractedPosts.push({
              index,
              username,
              postContent,
              postLink,
              postId,
              timestamp,
              mediaUrls,
              likes,
              replies,
              reposts,
              shares
            });
          }
        } catch (err) {
          console.error(`Error extracting post ${index}:`, err);
        }
      }

      return extractedPosts;
    }, maxPosts);

    console.log(`✅ Extracted ${posts.length} posts from profile page`);

    // Close browser
    if (browser) {
      await browser.close();
    }

    clearTimeout(overallTimeout);
    
    const elapsedTime = Math.round((Date.now() - startTime) / 1000);
    
    res.json({
      success: true,
      data: posts.map((post, index) => ({
        index,
        postId: post.postId || '',
        postLink: post.postLink || '',
        postContent: post.postContent || '',
        timestamp: post.timestamp || '',
        username: post.username || username,
        mediaUrls: post.mediaUrls || [],
        likes: post.likes || '0',
        replies: post.replies || '0',
        reposts: post.reposts || '0',
        shares: post.shares || '0',
        insights: {
          views: '0',
          totalInteractions: '0',
          likes: post.likes || '0',
          quotes: '0',
          replies: post.replies || '0',
          reposts: post.reposts || '0',
          profileFollows: '0'
        }
      })),
      count: posts.length,
      username: username,
      elapsedTime: elapsedTime,
      fetchedInsights: false,
      totalPosts: posts.length,
      source: 'profile_scrape'
    });

  } catch (error) {
    clearTimeout(overallTimeout);
    console.error('❌ Error fetching posts from profile:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Close browser on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('❌ Error closing browser:', closeError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch posts from profile',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 9. Get post insights for a specific post
router.post('/api/profile/post-insights', async (req, res) => {
  let browser = null;
  const overallTimeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('⏱️ Post insights fetch timeout after 60 seconds');
      res.status(504).json({
        success: false,
        error: 'Request timeout - fetching post insights took too long'
      });
    }
  }, 60000); // 1 minute timeout

  try {
    const username = req.body.username || req.query.username || req.headers['x-username'];
    const password = req.body.password || req.query.password;
    const postId = req.body.postId || req.query.postId;
    const postLink = req.body.postLink || req.query.postLink;

    if (!username) {
      clearTimeout(overallTimeout);
      return res.status(400).json({
        success: false,
        error: 'Username is required'
      });
    }

    if (!password) {
      clearTimeout(overallTimeout);
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    if (!postId && !postLink) {
      clearTimeout(overallTimeout);
      return res.status(400).json({
        success: false,
        error: 'Post ID or Post Link is required'
      });
    }

    console.log(`📊 Fetching insights for post: ${postId || postLink}`);

    // Initialize browser session
    const { browser: browserInstance, page } = await initializeBotWithSession({
      username,
      password,
      botType: 'post_insights',
      headless: true,
      chromePath: null,
    });

    browser = browserInstance;

    // Navigate to post page
    let postUrl = '';
    if (postLink) {
      postUrl = postLink.startsWith('http') 
        ? postLink 
        : `https://www.threads.net${postLink}`;
    } else if (postId && username) {
      postUrl = `https://www.threads.net/@${username}/post/${postId}`;
    }

    console.log(`🔍 Navigating to: ${postUrl}`);
    await page.goto(postUrl, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await sleep(5000); // Wait for page to fully load

    // Scroll to ensure post is visible
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await sleep(2000);

    // Extract engagement metrics directly from post buttons (same as other endpoints)
    const insights = await page.evaluate(() => {
      const result = {
        views: '0',
        totalInteractions: '0',
        likes: '0',
        quotes: '0',
        replies: '0',
        reposts: '0',
        shares: '0',
        profileFollows: '0'
      };

      // Helper function to extract engagement metrics
      const extractEngagementMetric = (container, svgAriaLabel) => {
        try {
          const svg = container.querySelector(`svg[aria-label="${svgAriaLabel}"]`) || 
                      container.querySelector(`svg[aria-label*="${svgAriaLabel}"]`);
          
          if (!svg) return '0';
          
          const button = svg.closest('button') || svg.closest('[role="button"]') || svg.closest('div[class*="x6s0dn4"]');
          if (!button) return '0';
          
          const parentContainer = button.parentElement || button;
          
          let countContainer = parentContainer.querySelector('span[class*="xmd891q"]');
          if (!countContainer) {
            countContainer = button.querySelector('span[class*="xmd891q"]');
          }
          
          if (countContainer) {
            const innerDiv = countContainer.querySelector('div[class*="xu9jpxn"]');
            if (innerDiv) {
              const countSpan = innerDiv.querySelector('span');
              if (countSpan) {
                const text = countSpan.textContent?.trim();
                if (text && /^\d+$/.test(text)) {
                  return text;
                }
              }
            }
            
            const allSpans = countContainer.querySelectorAll('span');
            for (const span of allSpans) {
              const text = span.textContent?.trim();
              if (text && /^\d+$/.test(text)) {
                return text;
              }
            }
          }
          
          const countSpans = button.querySelectorAll('span[class*="x1o0tod"]');
          for (const span of countSpans) {
            const text = span.textContent?.trim();
            if (text && /^\d+$/.test(text)) {
              return text;
            }
          }
          
          const parentSpans = parentContainer.querySelectorAll('span');
          for (const span of parentSpans) {
            const text = span.textContent?.trim();
            if (text && /^\d+$/.test(text) && text.length <= 6) {
              return text;
            }
          }
          
          const buttonText = button.textContent?.trim() || '';
          const match = buttonText.match(/\b(\d+)\b/);
          if (match && match[1]) {
            return match[1];
          }
          
          return '0';
        } catch (err) {
          console.error(`Error extracting ${svgAriaLabel}:`, err);
          return '0';
        }
      };

      // Find engagement container - buttons are in div.x78zum5
      let engagementContainer = document.querySelector('div.x78zum5');
      
      if (!engagementContainer) {
        const containers = Array.from(document.querySelectorAll('div[class*="x78zum5"]'));
        if (containers.length > 0) {
          engagementContainer = containers.find(container => {
            const hasLike = container.querySelector('svg[aria-label="Like"]') || 
                          container.querySelector('svg[aria-label="Unlike"]');
            return hasLike;
          }) || containers[0];
        }
      }
      
      if (!engagementContainer) {
        const allButtons = Array.from(document.querySelectorAll('button'));
        const likeButton = allButtons.find(btn => {
          const svg = btn.querySelector('svg[aria-label="Like"]') || 
                     btn.querySelector('svg[aria-label="Unlike"]');
          return svg !== null;
        });
        if (likeButton) {
          engagementContainer = likeButton.closest('div') || likeButton.parentElement;
        }
      }
      
      if (!engagementContainer) {
        console.log('❌ Could not find engagement container');
        return result;
      }

      // Extract metrics using the helper function
      result.likes = extractEngagementMetric(engagementContainer, 'Like') || 
                     extractEngagementMetric(engagementContainer, 'Unlike') || '0';
      result.replies = extractEngagementMetric(engagementContainer, 'Reply') || '0';
      result.reposts = extractEngagementMetric(engagementContainer, 'Repost') || '0';
      result.shares = extractEngagementMetric(engagementContainer, 'Share') || '0';

      // Calculate total interactions
      const total = parseInt(result.likes || '0') + 
                   parseInt(result.replies || '0') + 
                   parseInt(result.reposts || '0') + 
                   parseInt(result.shares || '0');
      result.totalInteractions = total.toString();

      console.log('📊 Extracted insights:', result);
      return result;
    });

    console.log(`✅ Successfully extracted insights for post: ${postId || postLink}`);
    console.log('📊 Insights data:', JSON.stringify(insights, null, 2));

    // Close browser
    if (browser) {
      await browser.close();
    }

    clearTimeout(overallTimeout);
    
    res.json({
      success: true,
      insights: insights,
      postId: postId,
      postLink: postLink
    });

  } catch (error) {
    clearTimeout(overallTimeout);
    console.error('❌ Error fetching post insights:', error);
    
    // Close browser on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('❌ Error closing browser:', closeError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch post insights',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 10. Upload logs to Google Sheets
router.post('/api/logs/upload-sheets', async (req, res) => {
  try {
    const { googleSheetsController } = await import('../controllers/googleSheetsController.js');
    const result = await googleSheetsController.uploadLogs(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== AUTOMATION ENDPOINT =====
router.post('/api/automation/start', async (req, res) => {
  try {
    const {
      username,
      password,
      posts_to_process,
      like_percentage,
      comment_percentage,
      reply_percentage,
      mode = 'flow'
    } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Build config for the bot
    const config = {
      username,
      password,
      maxPosts: parseInt(posts_to_process) || 40,
      likeProbability: (parseInt(like_percentage) || 0) / 100,
      commentProbability: (parseInt(comment_percentage) || 0) / 100,
      replyProbability: (parseInt(reply_percentage) || 0) / 100,
      durationMinutes: 120, // Default duration
      headless: req.body.headless !== undefined ? req.body.headless : false, // Default to false so browser opens
      chromePath: process.env.CHROME_PATH || null,
    };

    console.log(`🤖 [AUTOMATION START] Starting automation for ${username}`);
    console.log(`📊 Config:`, config);

    // Use BrowserManager to start the bot asynchronously
    const botResult = await browserManager.startBot(
      'automation',
      config,
      async (botConfig) => {
        // Use the simple automation bot for like/comment/scroll (no notifications)
        // Note: automatedThreadsPostCreation expects percentages as decimals (0.15 for 15%)
        return await automatedThreadsPostCreation({
          username: botConfig.username,
          password: botConfig.password,
          posts_to_process: botConfig.maxPosts,
          like_percentage: botConfig.likeProbability, // Already converted to decimal (0.15)
          comment_percentage: botConfig.commentProbability, // Already converted to decimal (0.15)
          reply_percentage: botConfig.replyProbability, // Already converted to decimal (0.15)
        });
      }
    );

    res.json({
      success: true,
      botId: botResult.botId,
      config: {
        posts_to_process: config.maxPosts,
        like_percentage: parseInt(like_percentage) || 0,
        comment_percentage: parseInt(comment_percentage) || 0,
        reply_percentage: parseInt(reply_percentage) || 0,
      },
      message: 'Automation started successfully'
    });
  } catch (error) {
    console.error('❌ [AUTOMATION START] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start automation',
      error: error.stack
    });
  }
});

// ===== BOT STATUS ENDPOINT =====
router.get('/api/bots/active', (req, res) => {
  try {
    const activeBots = browserManager.getActiveBots();
    res.json({
      success: true,
      bots: activeBots,
      count: activeBots.length
    });
  } catch (error) {
    console.error('❌ [BOTS ACTIVE] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get active bots',
      error: error.stack
    });
  }
});

// ===== NOTIFICATIONS ENDPOINT =====
router.post('/api/notifications', async (req, res) => {
  try {
    const {
      username,
      password,
      checkInterval,
      autoReply,
      replyTemplate
    } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Build config for the notification bot
    const config = {
      checkInterval: parseInt(checkInterval) || 2, // hours
      autoReply: autoReply !== false, // default to true
      replyTemplate: replyTemplate || '',
      headless: req.body.headless !== undefined ? req.body.headless : false, // Default to false so browser opens
      chromePath: process.env.CHROME_PATH || null,
    };

    console.log(`🔔 [NOTIFICATIONS START] Starting notification bot for ${username}`);
    console.log(`📊 Config:`, config);

    // Use BrowserManager to start the bot asynchronously
    const botResult = await browserManager.startBot(
      'notifications',
      { username, password, ...config },
      async (botConfig) => {
        // runNotificationChecker takes (username, password, config)
        return await runNotificationChecker(
          botConfig.username,
          botConfig.password,
          {
            checkInterval: botConfig.checkInterval,
            autoReply: botConfig.autoReply,
            replyTemplate: botConfig.replyTemplate,
            headless: botConfig.headless,
            chromePath: botConfig.chromePath
          }
        );
      }
    );

    res.json({
      success: true,
      botId: botResult.botId,
      message: 'Notification bot started successfully'
    });
  } catch (error) {
    console.error('❌ [NOTIFICATIONS START] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start notification bot',
      error: error.stack
    });
  }
});

// ===== POST CREATION ENDPOINT =====
router.post('/api/posts/create', async (req, res) => {
  try {
    const { username, password, content, image } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Post content is required'
      });
    }

    console.log(`📝 [POST CREATE] Creating post for ${username}`);
    console.log(`📄 Content length: ${content.length} characters`);
    console.log(`🖼️ Image provided: ${image ? 'YES' : 'NO'}`);

    // Use BrowserManager to start the post creation asynchronously
    const botResult = await browserManager.startBot(
      'post_creator',
      { username, password, content, image },
      async (botConfig) => {
        // createThreadsPost expects: (postContent, username, password, imageBase64)
        return await createThreadsPost(
          botConfig.content,
          botConfig.username,
          botConfig.password,
          botConfig.image || null
        );
      }
    );

    res.json({
      success: true,
      botId: botResult.botId,
      message: 'Post creation started successfully'
    });
  } catch (error) {
    console.error('❌ [POST CREATE] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create post',
      error: error.stack
    });
  }
});

// ===== POST GENERATION ENDPOINT =====
router.post('/api/posts/generate', async (req, res) => {
  try {
    const { topic, options = {}, image } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Topic is required'
      });
    }

    console.log(`📝 [POST GENERATE] Generating post for topic: ${topic}`);

    // Prepare options for generateThreadsPost
    const generationOptions = {
      tone: options.tone || 'casual',
      length: options.length || 'medium',
      includeQuestion: options.includeQuestion || false,
      includeEmojis: options.includeEmojis !== false, // default to true
      image: image || null
    };

    // Generate the post using the existing function
    const generatedText = await generateThreadsPost(topic.trim(), generationOptions);

    if (!generatedText) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate post content'
      });
    }

    res.json({
      success: true,
      post: {
        text: generatedText
      }
    });
  } catch (error) {
    console.error('❌ [POST GENERATE] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate post',
      error: error.stack
    });
  }
});

// ===== FLOW BOT ENDPOINT =====
router.post('/api/flow/start', async (req, res) => {
  try {
    const {
      username,
      password,
      searchKeyword,
      maxPosts,
      likeProbability,
      commentProbability,
      replyProbability,
      notificationCheckInterval,
      postScheduleTime,
      postTopic,
      postImage
    } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Build config for the flow bot
    const config = {
      username,
      password,
      searchKeyword: searchKeyword || '',
      maxPosts: parseInt(maxPosts) || 30,
      likeProbability: (parseInt(likeProbability) || 40) / 100, // Convert percentage to decimal
      commentProbability: (parseInt(commentProbability) || 15) / 100, // Convert percentage to decimal
      replyProbability: (parseInt(replyProbability) || 15) / 100, // Convert percentage to decimal
      notificationCheckInterval: parseInt(notificationCheckInterval) || 2, // hours
      postScheduleTime: postScheduleTime || null,
      postTopic: postTopic || '',
      postImage: postImage || null,
      durationMinutes: 120, // Default duration
      headless: req.body.headless !== undefined ? req.body.headless : false, // Default to false so browser opens
      chromePath: process.env.CHROME_PATH || null,
    };

    console.log(`🌊 [FLOW START] Starting comprehensive flow bot for ${username}`);
    console.log(`📊 Config:`, config);

    // Use BrowserManager to start the bot asynchronously
    const botResult = await browserManager.startBot(
      'flow',
      config,
      async (botConfig) => {
        // runComprehensiveFlowBot expects a config object
        return await runComprehensiveFlowBot(botConfig);
      }
    );

    res.json({
      success: true,
      botId: botResult.botId,
      config: {
        searchKeyword: config.searchKeyword,
        maxPosts: config.maxPosts,
        likeProbability: parseInt(likeProbability) || 40,
        commentProbability: parseInt(commentProbability) || 15,
        replyProbability: parseInt(replyProbability) || 15,
        notificationCheckInterval: config.notificationCheckInterval,
        postScheduleTime: config.postScheduleTime,
        postTopic: config.postTopic,
      },
      message: 'Flow bot started successfully'
    });
  } catch (error) {
    console.error('❌ [FLOW START] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start flow bot',
      error: error.stack
    });
  }
});

// ===== SEARCH ENDPOINT =====
router.post('/api/search', async (req, res) => {
  try {
    const {
      username,
      password,
      keyword,
      searchInterval,
      resultLimit,
      upvotePercentage,
      commentPercentage,
      replyPercentage
    } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    if (!keyword || !keyword.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search keyword is required'
      });
    }

    // Build config for the search bot
    // Convert percentages to decimals (handle empty strings, undefined, null)
    const parsePercentage = (value) => {
      if (!value || value === '') return 0;
      const parsed = parseInt(value);
      return isNaN(parsed) ? 0 : parsed / 100;
    };

    const likeProb = parsePercentage(upvotePercentage);
    const commentProb = parsePercentage(commentPercentage);
    const replyProb = parsePercentage(replyPercentage);

    const config = {
      username,
      password,
      searchQuery: keyword.trim(),
      numPosts: parseInt(resultLimit) || 10,
      searchDurationMinutes: parseInt(searchInterval) || 30,
      likeProbability: likeProb,
      commentProbability: commentProb,
      replyProbability: replyProb,
      headless: req.body.headless !== undefined ? req.body.headless : false, // Default to false so browser opens
      chromePath: process.env.CHROME_PATH || null,
    };

    console.log(`🔍 [SEARCH START] Starting search bot for ${username}`);
    console.log(`📊 Config:`, config);
    console.log(`📊 Probabilities: Like=${(likeProb * 100).toFixed(1)}%, Comment=${(commentProb * 100).toFixed(1)}%, Reply=${(replyProb * 100).toFixed(1)}%`);

    // Use BrowserManager to start the bot asynchronously
    const botResult = await browserManager.startBot(
      'search',
      config,
      async (botConfig) => {
        // runSearchBot takes a config object
        return await runSearchBot(botConfig);
      }
    );

    res.json({
      success: true,
      botId: botResult.botId,
      message: 'Search bot started successfully'
    });
  } catch (error) {
    console.error('❌ [SEARCH START] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start search bot',
      error: error.stack
    });
  }
});

export default router;