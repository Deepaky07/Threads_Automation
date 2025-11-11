// ============================================================================
// COMPREHENSIVE FLOW BOT - Combines All Automation Features
// Notification Check → Search → Like/Comment/Reply → Post Creation
// ============================================================================

import { initializeBotWithSession, closeBotGracefully, handleBotError } from "../helpers/botBootstrap.js";
import { logInfo, logSuccess, logError, sleep, randomDelay, logStructured, createLogEntry } from "../utils/logger.js";
import { generateAIComment, generateAIReply } from "../helpers/aiGeneration.js";
import { logPostToCSV } from "../utils/csvLogger.js";
import { generateThreadsPost, createThreadsPost, createThreadsPostWithExistingPage } from "./post.js";
import { checkAndReplyToNotifications } from "./notification.js";

// ============================================================================
// SEARCH & INTERACTION FUNCTIONS
// ============================================================================

async function performSmartScroll(page) {
  try {
    const scrollResult = await page.evaluate(() => {
      const beforeScroll = window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const currentBottom = beforeScroll + viewportHeight;
      const spaceLeft = documentHeight - currentBottom;
      const nearBottom = spaceLeft < 500;
      const scrollAmount = Math.floor(viewportHeight * (0.6 + Math.random() * 0.2));
      
      // Count posts before scroll
      const postsBefore = document.querySelectorAll('div[data-pressable-container="true"]').length;

      window.scrollBy({
        top: scrollAmount,
        behavior: 'smooth'
      });

      return {
        beforeScroll,
        scrollAmount,
        spaceLeft,
        nearBottom,
        documentHeight,
        viewportHeight,
        postsBefore
      };
    });

    // Wait for content to load
    await sleep(randomDelay(2000, 3000));

    // If near bottom, wait longer for new content
    if (scrollResult.nearBottom) {
      await sleep(randomDelay(3000, 4000));
    }
    
    // Check if new posts loaded
    const postsAfter = await page.evaluate(() => {
      return document.querySelectorAll('div[data-pressable-container="true"]').length;
    });
    
    const newPostsLoaded = postsAfter > scrollResult.postsBefore;

    return {
      ...scrollResult,
      postsAfter,
      newPostsLoaded
    };
  } catch (error) {
    logError(`❌ Error during scroll: ${error.message}`);
    return null;
  }
}

async function extractPostsFromPage(page, index) {
  try {
    const postData = await page.evaluate((idx) => {
      const containers = document.querySelectorAll('div[data-pressable-container="true"]');
      if (idx >= containers.length) return null;

      const container = containers[idx];
      const profileLink = container.querySelector('a[role="link"]');
      const username = profileLink ? profileLink.textContent.trim() : "";

      const contentSpans = container.querySelectorAll('span');
      let postContent = "";
      for (const span of contentSpans) {
        const text = span.textContent.trim();
        if (text.length > 20 && text.length < 500) {
          postContent = text;
          break;
        }
      }

      const timeElement = container.querySelector('time');
      const postTime = timeElement ? timeElement.getAttribute('datetime') || timeElement.textContent : "";

      const postLinks = container.querySelectorAll('a[href*="/post/"]');
      const postLink = postLinks.length > 0 ? postLinks[0].getAttribute('href') : "";
      const postId = postLink ? postLink.split('/post/')[1]?.split('?')[0] : "";

      return {
        username,
        postContent,
        postTime,
        postLink,
        postId
      };
    }, index);

    return postData;
  } catch (error) {
    logError(`❌ Error extracting post: ${error.message}`);
    return null;
  }
}

// New function to extract all posts and find unprocessed ones
async function extractAllPosts(page) {
  try {
    const allPosts = await page.evaluate(() => {
      const containers = document.querySelectorAll('div[data-pressable-container="true"]');
      const posts = [];
      
      for (let i = 0; i < containers.length; i++) {
        const container = containers[i];
        const profileLink = container.querySelector('a[role="link"]');
        const username = profileLink ? profileLink.textContent.trim() : "";

        const contentSpans = container.querySelectorAll('span');
        let postContent = "";
        for (const span of contentSpans) {
          const text = span.textContent.trim();
          if (text.length > 20 && text.length < 500) {
            postContent = text;
            break;
          }
        }

        const timeElement = container.querySelector('time');
        const postTime = timeElement ? timeElement.getAttribute('datetime') || timeElement.textContent : "";

        const postLinks = container.querySelectorAll('a[href*="/post/"]');
        const postLink = postLinks.length > 0 ? postLinks[0].getAttribute('href') : "";
        const postId = postLink ? postLink.split('/post/')[1]?.split('?')[0] : "";
        
        if (postId && postContent) {
          posts.push({
            username,
            postContent,
            postTime,
            postLink,
            postId,
            index: i
          });
        }
      }
      
      return posts;
    });

    return allPosts;
  } catch (error) {
    logError(`❌ Error extracting all posts: ${error.message}`);
    return [];
  }
}

// ============================================================================
// ALERT/NOTIFICATION DETECTION
// ============================================================================

/**
 * Check for alert/notification messages after an action
 * Returns: { hasAlert: boolean, alertType: 'success'|'error'|'warning'|'page_not_found', message: string }
 */
async function checkForAlert(page) {
  try {
    await sleep(1000); // Wait for alert to appear
    
    const alertInfo = await page.evaluate(() => {
      // First, check for "page not found" error (specific Threads error page)
      const pageNotFoundText = document.body.textContent || '';
      if (pageNotFoundText.includes('Not all who wander are lost, but this page is') ||
          pageNotFoundText.includes('The link\'s not working or the page is gone')) {
        return {
          hasAlert: true,
          alertType: 'page_not_found',
          message: 'Page not found - link not working or page is gone'
        };
      }
      
      // Check for various alert/notification patterns
      const alertSelectors = [
        // Error/failure messages
        'div[class*="html-div"]',
        'div[role="alert"]',
        'div[aria-live="polite"]',
        'div[aria-live="assertive"]',
        // Toast notifications
        'div[class*="toast"]',
        'div[class*="notification"]',
        'div[class*="snackbar"]',
      ];
      
      for (const selector of alertSelectors) {
        const elements = document.querySelectorAll(selector);
        
        for (const element of elements) {
          const text = element.textContent?.trim();
          if (!text || text.length < 3) continue;
          
          // Check if element is visible
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          
          const lowerText = text.toLowerCase();
          
          // Check for page not found error in element text
          if (lowerText.includes('not all who wander are lost') ||
              lowerText.includes('the link\'s not working') ||
              lowerText.includes('page is gone') ||
              lowerText.includes('go back to keep exploring')) {
            return {
              hasAlert: true,
              alertType: 'page_not_found',
              message: text
            };
          }
          
          // Error patterns
          if (lowerText.includes('failed') || 
              lowerText.includes('failed to upload') ||
              lowerText.includes('error') || 
              lowerText.includes('couldn\'t') || 
              lowerText.includes('unable to') ||
              lowerText.includes('something went wrong') ||
              lowerText.includes('try again')) {
            return {
              hasAlert: true,
              alertType: 'error',
              message: text
            };
          }
          
          // Success patterns
          if (lowerText.includes('success') || 
              lowerText.includes('posted') || 
              lowerText.includes('sent') ||
              lowerText.includes('shared')) {
            return {
              hasAlert: true,
              alertType: 'success',
              message: text
            };
          }
          
          // Warning patterns
          if (lowerText.includes('warning') || 
              lowerText.includes('limit') ||
              lowerText.includes('restricted')) {
            return {
              hasAlert: true,
              alertType: 'warning',
              message: text
            };
          }
        }
      }
      
      return { hasAlert: false, alertType: null, message: null };
    });
    
    return alertInfo;
  } catch (error) {
    logError(`❌ Error checking for alert: ${error.message}`);
    return { hasAlert: false, alertType: null, message: null };
  }
}

/**
 * Click the Back button on Threads error page
 * Returns: { success: boolean, message: string }
 */
async function clickBackButton(page) {
  try {
    logInfo('🔙 Attempting to click Back button...');
    
    const clicked = await page.evaluate(() => {
      // Method 1: Look for the exact Back button structure
      // <a href="/" role="link"> with <div>Back</div> inside
      const backLinks = document.querySelectorAll('a[href="/"][role="link"]');
      
      for (const link of backLinks) {
        // Check if it contains a div with "Back" text
        const backDiv = link.querySelector('div');
        if (backDiv) {
          const divText = backDiv.textContent?.trim() || '';
          if (divText.toLowerCase() === 'back') {
            // Check if button is visible
            const rect = link.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              link.scrollIntoView({ block: 'center', behavior: 'smooth' });
              link.click();
              return true;
            }
          }
        }
      }
      
      // Method 2: Look for any link with href="/" that contains "Back" text
      const allBackLinks = document.querySelectorAll('a[href="/"]');
      for (const link of allBackLinks) {
        const linkText = link.textContent?.trim() || '';
        const backDiv = link.querySelector('div');
        const divText = backDiv?.textContent?.trim() || '';
        
        if (linkText.toLowerCase().includes('back') || 
            divText.toLowerCase().includes('back')) {
          const rect = link.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            link.scrollIntoView({ block: 'center', behavior: 'smooth' });
            link.click();
            return true;
          }
        }
      }
      
      // Method 3: Look for any link with "Back" text
      const allLinks = document.querySelectorAll('a');
      for (const link of allLinks) {
        const text = link.textContent?.trim() || '';
        if (text.toLowerCase() === 'back') {
          const rect = link.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            link.scrollIntoView({ block: 'center', behavior: 'smooth' });
            link.click();
            return true;
          }
        }
      }
      
      return false;
    });
    
    if (clicked) {
      await sleep(2000); // Wait for navigation
      logSuccess('✅ Back button clicked successfully');
      return { success: true, message: 'Back button clicked' };
    } else {
      // Fallback: Use browser back navigation
      logInfo('⚠️ Back button not found, using browser back navigation...');
      await page.goBack();
      await sleep(2000);
      logSuccess('✅ Navigated back using browser');
      return { success: true, message: 'Navigated back using browser' };
    }
  } catch (error) {
    logError(`❌ Error clicking back button: ${error.message}`);
    // Try browser back as last resort
    try {
      await page.goBack();
      await sleep(2000);
      return { success: true, message: 'Navigated back using browser (fallback)' };
    } catch (backError) {
      return { success: false, message: `Failed to navigate back: ${backError.message}` };
    }
  }
}

async function extractPostComments(page) {
  try {
    const comments = await page.evaluate(() => {
      const commentContainers = document.querySelectorAll('div[data-pressable-container="true"]');
      const extractedComments = [];

      for (let i = 1; i < Math.min(commentContainers.length, 6); i++) {
        const container = commentContainers[i];
        const authorLink = container.querySelector('a[href^="/@"]');
        const author = authorLink ? authorLink.getAttribute('href').replace('/@', '').split('/')[0] : "";

        const textSpans = container.querySelectorAll('span');
        let commentText = "";
        for (const span of textSpans) {
          const text = span.textContent.trim();
          if (text.length > 10 && text.length < 200 && !text.includes('ago')) {
            commentText = text;
            break;
          }
        }

        if (author && commentText) {
          extractedComments.push({ author, text: commentText });
        }
      }

      return extractedComments;
    });

    return comments;
  } catch (error) {
    logError(`❌ Error extracting comments: ${error.message}`);
    return [];
  }
}

async function likePost(page) {
  try {
    await sleep(randomDelay(1500, 2500));

    const likeResult = await page.evaluate(() => {
      const candidateSelectors = [
        'div[role="button"][aria-label*="Like"]',
        'div[role="button"] svg[aria-label="Like"]',
        'svg[aria-label="Like"]',
      ];

      const visibleContainers = Array.from(document.querySelectorAll('div[data-pressable-container="true"]'))
        .filter((container) => {
          const rect = container.getBoundingClientRect();
          return rect.height > 0 && rect.width > 0 && rect.bottom > 80 && rect.top < window.innerHeight - 80;
        });

      let encounteredLiked = false;

      const clickButton = (node) => {
        const button = node.closest('div[role="button"]') || (node.getAttribute?.('role') === 'button' ? node : null);
        if (!button) return false;

        const labelSource = button.getAttribute('aria-label') || node.getAttribute?.('aria-label') || '';
        const normalizedLabel = labelSource.toLowerCase();

        if (normalizedLabel.includes('unlike')) {
          encounteredLiked = true;
          return false;
        }

        if (!normalizedLabel.includes('like')) {
          return false;
        }

        const rect = button.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
          return false;
        }

        button.scrollIntoView({ block: 'center', behavior: 'instant' });
        button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        button.click();

        return true;
      };

      const searchScopes = visibleContainers.length ? visibleContainers : [document];

      for (const scope of searchScopes) {
        for (const selector of candidateSelectors) {
          const elements = scope.querySelectorAll(selector);
          for (const el of elements) {
            if (clickButton(el)) {
              return { success: true, alreadyLiked: false };
            }
          }
        }
      }

      return { success: false, alreadyLiked: encounteredLiked };
    });

    if (likeResult.success) {
      // Check for alert after liking
      const alert = await checkForAlert(page);
      
      if (alert.hasAlert && alert.alertType === 'page_not_found') {
        logError(`❌ Page not found error: ${alert.message}`);
        await clickBackButton(page);
        return { success: false, error: alert.message };
      }
      
      if (alert.hasAlert && alert.alertType === 'error') {
        logError(`❌ Like failed: ${alert.message}`);
        return { success: false, error: alert.message };
      }
      
      logSuccess("✅ Liked post");
      return { success: true };
    } else if (likeResult.alreadyLiked) {
      logInfo("⚠️ Post already liked");
      return { success: false, alreadyLiked: true };
    } else {
      logInfo("⚠️ Like button not found");
      return { success: false, error: 'Like button not found' };
    }
  } catch (error) {
    logError(`❌ Error liking post: ${error.message}`);
    return false;
  }
}

async function postCommentToThreads(page, commentText) {
  try {
    await sleep(randomDelay(2000, 3000));

    const replyButtonClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('div[role="button"]');
      for (const btn of buttons) {
        const svg = btn.querySelector('svg[aria-label="Reply"]');
        if (svg) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (!replyButtonClicked) {
      logInfo("⚠️ Reply button not found");
      return false;
    }

    await sleep(randomDelay(2000, 3000));

    const inputSelectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
    ];

    let commentInput = null;
    for (const selector of inputSelectors) {
      try {
        commentInput = await page.waitForSelector(selector, { timeout: 5000 });
        if (commentInput) break;
      } catch (e) {
        continue;
      }
    }

    if (!commentInput) {
      logError("❌ Comment input not found");
      return false;
    }

    await commentInput.click();
    await sleep(500);
    await commentInput.evaluate((el) => {
      el.textContent = "";
      el.focus();
    });
    await sleep(500);
    await commentInput.type(commentText, { delay: randomDelay(100, 200) });
    await sleep(randomDelay(2000, 3000));

    const postButtonClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('div[role="button"]');
      for (const btn of buttons) {
        const text = btn.textContent;
        if (text && text.includes("Post")) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (postButtonClicked) {
      await sleep(2000);
    } else {
      await page.keyboard.down("Control");
      await page.keyboard.press("Enter");
      await page.keyboard.up("Control");
      await sleep(2000);
    }
    
    // Check for alert after posting comment
    const alert = await checkForAlert(page);
    
    if (alert.hasAlert && alert.alertType === 'page_not_found') {
      logError(`❌ Page not found error: ${alert.message}`);
      await clickBackButton(page);
      return { success: false, error: alert.message };
    }
    
    if (alert.hasAlert && alert.alertType === 'error') {
      logError(`❌ Comment failed: ${alert.message}`);
      return { success: false, error: alert.message };
    }
    
    logSuccess("✅ Comment posted successfully");
    return { success: true };
  } catch (error) {
    logError(`❌ Comment posting error: ${error.message}`);
    return false;
  }
}

async function replyToComment(page, replyText) {
  try {
    await sleep(randomDelay(2000, 3000));

    const replyButtonClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('div[role="button"]');
      for (const btn of buttons) {
        const svg = btn.querySelector('svg[aria-label="Reply"]');
        if (svg) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (!replyButtonClicked) {
      logInfo("⚠️ Reply button not found");
      return false;
    }

    await sleep(randomDelay(2000, 3000));

    const inputSelectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
    ];

    let replyInput = null;
    for (const selector of inputSelectors) {
      try {
        replyInput = await page.waitForSelector(selector, { timeout: 10000 });
        if (replyInput) break;
      } catch (e) {
        continue;
      }
    }

    if (!replyInput) {
      logError("❌ Reply input not found");
      return false;
    }

    await replyInput.click();
    await sleep(500);
    await replyInput.evaluate((el) => {
      el.textContent = "";
      el.focus();
    });
    await sleep(500);
    await replyInput.type(replyText, { delay: randomDelay(100, 200) });
    await sleep(randomDelay(2000, 3000));

    const postButtonClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('div[role="button"]');
      for (const btn of buttons) {
        const text = btn.textContent;
        if (text && text.includes("Post")) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (postButtonClicked) {
      await sleep(2000);
    } else {
      await page.keyboard.down("Control");
      await page.keyboard.press("Enter");
      await page.keyboard.up("Control");
      await sleep(2000);
    }
    
    // Check for alert after posting reply
    const alert = await checkForAlert(page);
    
    if (alert.hasAlert && alert.alertType === 'page_not_found') {
      logError(`❌ Page not found error: ${alert.message}`);
      await clickBackButton(page);
      return { success: false, error: alert.message };
    }
    
    if (alert.hasAlert && alert.alertType === 'error') {
      logError(`❌ Reply failed: ${alert.message}`);
      return { success: false, error: alert.message };
    }
    
    logSuccess("✅ Reply posted successfully");
    return { success: true };
  } catch (error) {
    logError(`❌ Reply posting error: ${error.message}`);
    return false;
  }
}

// ============================================================================
// MAIN COMPREHENSIVE FLOW BOT
// ============================================================================

export default async function runComprehensiveFlowBot(config) {
  const {
    username,
    password,
    searchKeyword = '',
    maxPosts = 30,
    likeProbability = 0.4,
    commentProbability = 0.15,
    replyProbability = 0.15,
    notificationCheckInterval = 2, // hours
    postScheduleTime = null, // HH:MM format
    postTopic = '',
    postImage = null,
    durationMinutes = 120,
    headless = false,
    chromePath = null
  } = config;

  logInfo(`🌊 Starting Comprehensive Flow Bot`);
  logInfo(`👤 User: ${username}`);
  logInfo(`🔍 Search Keyword: ${searchKeyword || 'Home Feed'}`);
  logInfo(`📊 Settings: ${maxPosts} posts, Like:${likeProbability*100}%, Comment:${commentProbability*100}%, Reply:${replyProbability*100}%`);
  logInfo(`📬 Notification Check: Every ${notificationCheckInterval} hours`);
  logInfo(`📝 Post Schedule: ${postScheduleTime || 'Not scheduled'}`);
  logInfo(`⏱️ Duration: ${durationMinutes} minutes`);

  let browser, page;
  let stats = {
    notificationChecks: 0,
    notificationsFound: 0,
    postsProcessed: 0,
    likes: 0,
    comments: 0,
    replies: 0,
    scrolls: 0,
    postsCreated: 0
  };

  try {
    // Initialize bot with session
    const botSession = await initializeBotWithSession({
      username,
      password,
      botType: 'flow',
      headless,
      chromePath
    });

    browser = botSession.browser;
    page = botSession.page;

    const startTime = Date.now();
    const endTime = startTime + (durationMinutes * 60 * 1000);
    let lastNotificationCheck = 0;
    let lastPostTime = 0;

    // Initial notification check with reply enabled
    logInfo(`📬 Navigating to notifications page first...`);
    await page.goto('https://www.threads.net/activity', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await sleep(3000);
    
    logInfo(`📬 Starting initial notification check...`);
    const notifResults = await checkAndReplyToNotifications(page, true, username, searchKeyword);
    stats.notificationChecks++;
    stats.notificationsFound += notifResults.checked;
    lastNotificationCheck = Date.now();
    // Note: checkAndReplyToNotifications now handles navigation to search page

    logInfo(`🚀 Starting automation loop...`);

    let currentPostIndex = 0;
    let consecutiveFailures = 0;
    let consecutiveScrollsWithoutNewPosts = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;
    const MAX_SCROLLS_WITHOUT_NEW_POSTS = 3;
    const processedPostIds = new Set(); // Track processed posts to avoid duplicates
    let lastScheduledPostDate = null; // Track which date we last posted at scheduled time

    while (stats.postsProcessed < maxPosts && Date.now() < endTime) {
      try {
        // Check if it's time for notification check (every N hours)
        const timeSinceLastNotifCheck = (Date.now() - lastNotificationCheck) / 1000 / 60 / 60;
        
        // Log notification check status every 10 iterations
        if (stats.postsProcessed % 10 === 0) {
          logInfo(`📬 Notification check: ${timeSinceLastNotifCheck.toFixed(2)}h / ${notificationCheckInterval}h (next check in ${(notificationCheckInterval - timeSinceLastNotifCheck).toFixed(2)}h)`);
        }
        
        if (timeSinceLastNotifCheck >= notificationCheckInterval) {
          logInfo(`\n📬 ✅ Time for notification check (${notificationCheckInterval} hours elapsed)...`);
          
          // Navigate to notifications page first
          logInfo(`📬 Navigating to notifications page...`);
          await page.goto('https://www.threads.net/activity', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          await sleep(3000);
          
          const notifResults = await checkAndReplyToNotifications(page, true, username, searchKeyword);
          stats.notificationChecks++;
          stats.notificationsFound += notifResults.checked;
          lastNotificationCheck = Date.now();
          // Note: checkAndReplyToNotifications now handles navigation to search page
        }

        // Check if it's time to create a post (BEFORE extracting posts)
        if (postScheduleTime && postTopic) {
          const now = new Date();
          const [scheduleHour, scheduleMinute] = postScheduleTime.split(':').map(Number);
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          
          // More precise time matching: exact hour and minute (within 1 minute window)
          const hourMatch = currentHour === scheduleHour;
          const minuteMatch = currentMinute === scheduleMinute || 
                             (currentMinute === scheduleMinute + 1 && now.getSeconds() < 30); // Allow 30 seconds into next minute
          const timeSinceLastPost = (Date.now() - lastPostTime) / 1000 / 60;
          const canPost = lastPostTime === 0 || timeSinceLastPost > 60; // Allow first post or after 60 min

          // Check if we've already posted at this scheduled time today
          const today = now.toDateString(); // e.g., "Mon Jan 15 2024"
          const alreadyPostedToday = lastScheduledPostDate === today;

          // Calculate minutes until scheduled time
          const scheduledTimeInMinutes = scheduleHour * 60 + scheduleMinute;
          const currentTimeInMinutes = currentHour * 60 + currentMinute;
          let minutesUntilScheduled = scheduledTimeInMinutes - currentTimeInMinutes;
          if (minutesUntilScheduled < 0) minutesUntilScheduled += 24 * 60; // Handle next day

          // Log time checks every 10 iterations OR when within 10 minutes of scheduled time
          const shouldLog = stats.postsProcessed % 10 === 0 || minutesUntilScheduled <= 10;
          if (shouldLog) {
            logInfo(`⏰ Post Schedule Check:`);
            logInfo(`   Current Time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
            logInfo(`   Scheduled Time: ${scheduleHour}:${scheduleMinute.toString().padStart(2, '0')}`);
            logInfo(`   Minutes Until Scheduled: ${minutesUntilScheduled}`);
            logInfo(`   Hour Match: ${hourMatch}, Minute Match: ${minuteMatch}`);
            logInfo(`   Time Since Last Post: ${timeSinceLastPost.toFixed(1)} minutes`);
            logInfo(`   Can Post: ${canPost} (need >60 min or first post)`);
            logInfo(`   Already Posted Today: ${alreadyPostedToday} (last scheduled post: ${lastScheduledPostDate || 'never'})`);
          }

          // Only post if exact time match AND haven't posted in this time slot today AND can post
          const isScheduledTime = hourMatch && minuteMatch && canPost && !alreadyPostedToday;
          if (shouldLog || isScheduledTime) {
            logInfo(`   ⏰ Is Scheduled Time: ${isScheduledTime}`);
          }

          if (isScheduledTime) {
            logInfo(`\n📝 ✅ TIME MATCHED! Creating scheduled post about: "${postTopic}"`);
            
            try {
              // Check for page not found error before creating post
              const alertBeforePost = await checkForAlert(page);
              if (alertBeforePost.hasAlert && alertBeforePost.alertType === 'page_not_found') {
                logError(`❌ Page not found error detected before posting: ${alertBeforePost.message}`);
                await clickBackButton(page);
                // Wait a bit and continue - will retry on next iteration
                await sleep(3000);
                continue;
              }
              
              // Generate and create post using existing page session
              const postContent = await generateThreadsPost(postTopic);
              if (postContent) {
                logInfo(`📄 Generated post content: ${postContent.substring(0, 100)}...`);
                const created = await createThreadsPostWithExistingPage(page, postContent, username, postImage);
                if (created && created.success) {
                  stats.postsCreated++;
                  lastPostTime = Date.now();
                  lastScheduledPostDate = today; // Mark that we've posted at scheduled time today
                  logSuccess(`✅ Post created successfully!`);
                  
                  // Extract post link from return value
                  const postLink = created.postLink || "";
                  const postId = created.postId || "";
                  
                  if (postLink) {
                    logInfo(`🔗 Post link: ${postLink}`);
                  } else {
                    logInfo(`⚠️ Post link not extracted`);
                  }
                  
                  // Note: CSV logging is handled by createThreadsPostWithExistingPage in post.js
                  // No need to log again here to avoid duplicates
                } else {
                  logError(`❌ Post creation failed: ${created?.error || 'Unknown error'}`);
                }
              } else {
                logError(`❌ Failed to generate post content`);
              }
            } catch (postError) {
              logError(`❌ Error creating scheduled post: ${postError.message}`);
            }
            
            // Return to search/feed
            logInfo(`🔙 Returning to ${searchKeyword ? 'search' : 'feed'}...`);
            if (searchKeyword) {
              await page.goto(`https://www.threads.net/search?q=${encodeURIComponent(searchKeyword)}&serp_type=default`, {
                waitUntil: 'networkidle2',
                timeout: 60000
              });
            } else {
              await page.goto('https://www.threads.net', {
                waitUntil: 'networkidle2',
                timeout: 60000
              });
            }
            await sleep(3000);
          }
        }

        // Extract post data
        const post = await extractPostsFromPage(page, currentPostIndex);

        if (!post || !post.postContent || !post.postId) {
          consecutiveFailures++;
          logInfo(`⚠️ No post found at index ${currentPostIndex} (failure ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);
          
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            logInfo(`📜 Reached max failures. Attempting to scroll and find new posts...`);
            
            const scrollResult = await performSmartScroll(page);
            stats.scrolls++;
            
            if (scrollResult && scrollResult.newPostsLoaded) {
              logInfo(`✅ New posts loaded after scroll (${scrollResult.postsBefore} → ${scrollResult.postsAfter})`);
              consecutiveFailures = 0;
              consecutiveScrollsWithoutNewPosts = 0;
              await sleep(randomDelay(2000, 3000));
              currentPostIndex++;
              continue;
            } else {
              consecutiveScrollsWithoutNewPosts++;
              logInfo(`⚠️ No new posts after scroll (${consecutiveScrollsWithoutNewPosts}/${MAX_SCROLLS_WITHOUT_NEW_POSTS})`);
              
              if (consecutiveScrollsWithoutNewPosts >= MAX_SCROLLS_WITHOUT_NEW_POSTS) {
                logInfo(`⚠️ No new posts found after multiple scrolls, ending automation`);
                break;
              }
              
              await sleep(randomDelay(3000, 5000));
              currentPostIndex++;
              continue;
            }
          }
          
          await sleep(randomDelay(2000, 3000));
          currentPostIndex++;
          continue;
        }
        
        // Check if we've already processed this post
        if (processedPostIds.has(post.postId)) {
          logInfo(`⏭️ Skipping already processed post: ${post.postId}`);
          currentPostIndex++;
          continue;
        }

        // Reset failure counter on success
        consecutiveFailures = 0;
        consecutiveScrollsWithoutNewPosts = 0;
        processedPostIds.add(post.postId);

        logInfo(`📝 Post by @${post.username}: ${post.postContent.substring(0, 60)}...`);

        // 1. Like post (based on probability)
        if (Math.random() < likeProbability) {
          logInfo(`❤️ Attempting to like...`);
          const likeResult = await likePost(page);
          
          if (likeResult && likeResult.success) {
            stats.likes++;
            
            try {
              await logPostToCSV({
                actionType: 'LIKE',
                status: 'SUCCESS',
                username: username,
                author: post.username,
                postContent: post.postContent,
                generatedText: '',
                postLink: post.postLink,
                module: 'flow.js'
              });
            } catch (csvError) {
              logError(`⚠️ Error logging LIKE to CSV: ${csvError.message}`);
            }
            
            await sleep(randomDelay(1500, 2500));
          } else if (likeResult && likeResult.error && !likeResult.alreadyLiked) {
            // Log failure to CSV
            try {
              await logPostToCSV({
                actionType: 'LIKE',
                status: 'FAILED',
                username: username,
                author: post.username,
                postContent: post.postContent,
                generatedText: `Error: ${likeResult.error}`,
                postLink: post.postLink,
                module: 'flow.js'
              });
            } catch (csvError) {
              logError(`⚠️ Error logging LIKE failure to CSV: ${csvError.message}`);
            }
          }
        }

        // 2. Comment on post (based on probability)
        if (Math.random() < commentProbability) {
          logInfo(`💬 Generating comment...`);
          try {
            const existingComments = await extractPostComments(page);
            const comment = await generateAIComment(post.postContent, existingComments);
            
            if (comment) {
              logInfo(`📤 Posting comment: "${comment.substring(0, 50)}..."`);
              const commentResult = await postCommentToThreads(page, comment);
              
              if (commentResult && commentResult.success) {
                stats.comments++;
                
                try {
                  await logPostToCSV({
                    actionType: 'COMMENT',
                    status: 'SUCCESS',
                    username: username,
                    author: post.username,
                    postContent: post.postContent,
                    generatedText: comment,
                    postLink: post.postLink,
                    module: 'flow.js'
                  });
                } catch (csvError) {
                  logError(`⚠️ Error logging COMMENT to CSV: ${csvError.message}`);
                }
                
                await sleep(randomDelay(3000, 5000));
              } else if (commentResult && commentResult.error) {
                // Log failure to CSV
                try {
                  await logPostToCSV({
                    actionType: 'COMMENT',
                    status: 'FAILED',
                    username: username,
                    author: post.username,
                    postContent: post.postContent,
                    generatedText: `${comment} | Error: ${commentResult.error}`,
                    postLink: post.postLink,
                    module: 'flow.js'
                  });
                } catch (csvError) {
                  logError(`⚠️ Error logging COMMENT failure to CSV: ${csvError.message}`);
                }
              }
            }
          } catch (commentError) {
            logError(`❌ Comment error: ${commentError.message}`);
          }
        }

        // 3. Reply to comment (based on probability)
        if (Math.random() < replyProbability) {
          logInfo(`💭 Attempting to reply to a comment...`);
          try {
            const comments = await extractPostComments(page);
            
            if (comments.length > 0) {
              const randomComment = comments[Math.floor(Math.random() * comments.length)];
              logInfo(`👥 Replying to @${randomComment.author}: "${randomComment.text.substring(0, 40)}..."`);
              
              const reply = await generateAIReply(
                randomComment.author,
                randomComment.text,
                post.postContent
              );
              
              if (reply) {
                logInfo(`📤 Posting reply: "${reply.substring(0, 50)}..."`);
                const replyResult = await replyToComment(page, reply);
                
                if (replyResult && replyResult.success) {
                  stats.replies++;
                  
                  try {
                    await logPostToCSV({
                      actionType: 'REPLY',
                      status: 'SUCCESS',
                      username: username, // Fixed: Use bot username, not comment author
                      author: post.username,
                      postContent: post.postContent,
                      generatedText: reply,
                      postLink: post.postLink,
                      module: 'flow.js'
                    });
                  } catch (csvError) {
                    logError(`⚠️ Error logging REPLY to CSV: ${csvError.message}`);
                  }
                  
                  await sleep(randomDelay(3000, 5000));
                } else if (replyResult && replyResult.error) {
                  // Log failure to CSV
                  try {
                    await logPostToCSV({
                      actionType: 'REPLY',
                      status: 'FAILED',
                      username: username, // Fixed: Use bot username, not comment author
                      author: post.username,
                      postContent: post.postContent,
                      generatedText: `${reply} | Error: ${replyResult.error}`,
                      postLink: post.postLink,
                      module: 'flow.js'
                    });
                  } catch (csvError) {
                    logError(`⚠️ Error logging REPLY failure to CSV: ${csvError.message}`);
                  }
                }
              }
            }
          } catch (replyError) {
            logError(`❌ Reply error: ${replyError.message}`);
          }
        }

        // Random scroll between posts
        const scrollResult = await performSmartScroll(page);
        stats.scrolls++;
        
        if (scrollResult && scrollResult.newPostsLoaded) {
          logInfo(`📜 Scrolled: ${scrollResult.postsBefore} → ${scrollResult.postsAfter} posts`);
        }

        stats.postsProcessed++;
        currentPostIndex++;

        // Progress update
        const elapsed = Math.floor((Date.now() - startTime) / 1000 / 60);
        logInfo(`\n📊 Progress: ${stats.postsProcessed}/${maxPosts} posts | ${elapsed}/${durationMinutes} min`);
        logInfo(`   ❤️ Likes: ${stats.likes} | 💬 Comments: ${stats.comments} | 💭 Replies: ${stats.replies}`);
        logInfo(`   📬 Notifications: ${stats.notificationsFound} | 📝 Posts Created: ${stats.postsCreated}`);

        // Random delay between posts
        await sleep(randomDelay(3000, 6000));

      } catch (loopError) {
        logError(`⚠️ Error in loop: ${loopError.message}`);
        await performSmartScroll(page);
        await sleep(3000);
        continue;
      }
    }

    // Final stats
    const totalTime = Math.floor((Date.now() - startTime) / 1000 / 60);
    logSuccess(`\n✅ Comprehensive Flow Bot Completed!`);
    logInfo(`⏱️ Duration: ${totalTime} minutes`);
    logInfo(`📊 Final Stats:`);
    logInfo(`   📝 Posts Processed: ${stats.postsProcessed}`);
    logInfo(`   ❤️ Likes: ${stats.likes}`);
    logInfo(`   💬 Comments: ${stats.comments}`);
    logInfo(`   💭 Replies: ${stats.replies}`);
    logInfo(`   📬 Notification Checks: ${stats.notificationChecks}`);
    logInfo(`   📬 Notifications Found: ${stats.notificationsFound}`);
    logInfo(`   📝 Posts Created: ${stats.postsCreated}`);
    logInfo(`   📜 Scrolls: ${stats.scrolls}`);

    await closeBotGracefully(browser, username);

    return {
      success: true,
      stats,
      duration: totalTime
    };

  } catch (error) {
    await handleBotError(browser, error, username);
    return {
      success: false,
      error: error.message,
      stats
    };
  }
}
