// ============================================================================
// FIXED Bots/index.js - WITH PROPER COMMENT EXTRACTION
// ============================================================================

import { initializeBotWithSession, closeBotGracefully, handleBotError } from "../helpers/botBootstrap.js";
import { logInfo, logSuccess, logError, sleep, randomDelay, logStructured, createLogEntry } from "../utils/logger.js";
import { generateAIComment, generateAIReply } from "../helpers/aiGeneration.js";
import { saveSession } from "../services/SessionManager.js";
import { logPostToCSV } from "../utils/csvLogger.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CSV Logging Function - Now uses centralized logger with username support
async function logToCSV(actionType, status, data = {}, sessionId, username) {
  try {
    logPostToCSV({
      actionType,
      status,
      username: username || data.username || '',
      author: data.postAuthor || data.replyAuthor || '',
      postContent: data.postContent || '',
      generatedText: data.commentText || '',
      postLink: data.postLink || '',
      module: 'index.js'
    });
  } catch (error) {
    logError(`❌ Error writing to CSV: ${error.message}`);
  }
}

// ============================================================================
// AI INTERACTION FUNCTIONS
// ============================================================================

/**
 * ✅ NEW: Find current index of a post by its unique link
 */
async function findPostIndexByLink(page, postLink) {
  try {
    if (!postLink) {
      logError('❌ No postLink provided to findPostIndexByLink');
      return -1;
    }

    const index = await page.evaluate((link) => {
      const containers = document.querySelectorAll('div[data-pressable-container="true"]');
      
      for (let i = 0; i < containers.length; i++) {
        const container = containers[i];
        
        // Look for the specific post link in this container
        const postLinks = container.querySelectorAll('a[href*="/post/"]');
        
        for (const a of postLinks) {
          const href = a.getAttribute('href');
          // Match either full URL or relative path
          if (href === link || href.includes(link) || link.includes(href)) {
            return i;
          }
        }
      }
      return -1;
    }, postLink);
    
    if (index === -1) {
      logInfo(`⚠️ Could not find post with link: ${postLink}`);
    }
    
    return index;
  } catch (error) {
    logError(`❌ Error finding post index: ${error.message}`);
    return -1;
  }
}

/**
 * ✅ NEW: Check for notification popup and press Ctrl+Enter if present
 */
async function handleNotificationPopup(page) {
  try {
    await sleep(1500); // Wait longer for notification to appear
    
    // Check if a notification/modal popup is visible
    const popupInfo = await page.evaluate(() => {
      // Check for various popup indicators
      const checks = {
        dialog: document.querySelector('[role="dialog"]'),
        alertDialog: document.querySelector('[role="alertdialog"]'),
        ariaModal: document.querySelector('[aria-modal="true"]'),
        contentEditable: document.querySelector('div[contenteditable="true"]'),
        textarea: document.querySelector('textarea'),
        // Check for overlay/backdrop (common in modals)
        backdrop: document.querySelector('[style*="position: fixed"]'),
        // Check for z-index layers (popups usually have high z-index)
        highZIndex: Array.from(document.querySelectorAll('div')).find(el => {
          const zIndex = window.getComputedStyle(el).zIndex;
          return zIndex && parseInt(zIndex) > 100;
        })
      };
      
      // Log what we found for debugging
      const found = Object.entries(checks)
        .filter(([key, val]) => val !== null && val !== undefined)
        .map(([key]) => key);
      
      // Check if any element is visible and interactive
      for (const [key, element] of Object.entries(checks)) {
        if (element && element.offsetParent !== null) {
          // Additional check: is it actually visible on screen?
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { found: true, type: key, foundElements: found };
          }
        }
      }
      
      return { found: false, foundElements: found };
    });
    
    if (popupInfo.found) {
      logInfo(`📬 Notification popup detected (${popupInfo.type}), pressing Ctrl+Enter...`);
      
      // Try to focus on the input field first if it exists
      try {
        await page.focus('div[contenteditable="true"]').catch(() => {});
        await sleep(500);
      } catch (e) {
        // Ignore if focus fails
      }
      
      // Press Ctrl+Enter
      await page.keyboard.down('Control');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Control');
      
      await sleep(1500); // Wait for action to complete
      logSuccess('✅ Pressed Ctrl+Enter on notification');
      return true;
    } else if (popupInfo.foundElements.length > 0) {
      logInfo(`⚠️ Found elements but not visible: ${popupInfo.foundElements.join(', ')}`);
    }
    
    return false;
  } catch (error) {
    logError(`❌ Error handling notification popup: ${error.message}`);
    return false;
  }
}

async function likePost(page, postIndex) {
  try {
    await sleep(randomDelay(1500, 2500));

    const likeResult = await page.evaluate((idx) => {
      const allContainers = document.querySelectorAll('div[data-pressable-container="true"]');
      if (idx >= allContainers.length) {
        return { success: false, alreadyLiked: false, error: 'Container not found' };
      }

      const targetContainer = allContainers[idx];
      let encounteredLiked = false;

      const candidateSelectors = [
        'div[role="button"][aria-label*="Like"]',
        'div[role="button"] svg[aria-label="Like"]',
        'svg[aria-label="Like"]',
      ];

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

        button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        button.click();

        return true;
      };

      // Search ONLY in the target container
      for (const selector of candidateSelectors) {
        const elements = targetContainer.querySelectorAll(selector);
        for (const el of elements) {
          if (clickButton(el)) {
            return { success: true, alreadyLiked: false };
          }
        }
      }

      return { success: false, alreadyLiked: encounteredLiked };
    }, postIndex);

    if (likeResult.success) {
      await handleNotificationPopup(page);
      
      // Check for alert after liking
      const alert = await checkForAlert(page);
      
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

async function postCommentToThreads(page, commentText, postIndex) {
  try {
    await sleep(randomDelay(2000, 3000));

    const replyButtonClicked = await page.evaluate((idx) => {
      const allContainers = document.querySelectorAll('div[data-pressable-container="true"]');
      if (idx >= allContainers.length) return false;
      
      const targetContainer = allContainers[idx];
      
      // Search for Reply button ONLY in the target container
      const buttons = targetContainer.querySelectorAll('div[role="button"]');
      for (const btn of buttons) {
        const svg = btn.querySelector('svg[aria-label="Reply"]');
        if (svg) {
          btn.click();
          return true;
        }
      }
      return false;
    }, postIndex);

    if (!replyButtonClicked) {
      logInfo("⚠️ Reply button not found");
      return false;
    }

    await sleep(randomDelay(2000, 3000));

    const commentInput = await page.waitForSelector('div[contenteditable="true"]', {
      timeout: 10000,
    });

    if (!commentInput) {
      logError("❌ Comment input not found");
      return false;
    }

    await commentInput.click();
    await sleep(500);
    await commentInput.type(commentText, { delay: randomDelay(100, 200) });
    await sleep(randomDelay(2000, 3000));

    // Submit via keyboard
    await page.keyboard.down("Control");
    await page.keyboard.press("Enter");
    await page.keyboard.up("Control");
    await sleep(2000);
    
    await handleNotificationPopup(page);
    
    // Check for alert after posting comment
    const alert = await checkForAlert(page);
    
    if (alert.hasAlert && alert.alertType === 'error') {
      logError(`❌ Comment failed: ${alert.message}`);
      return { success: false, error: alert.message };
    }

    logSuccess("✅ Comment posted");
    return { success: true };
  } catch (error) {
    logError(`❌ Comment posting error: ${error.message}`);
    return false;
  }
}

/**
 * ✅ NEW: Click on post to open detail view
 */
async function openPostDetailView(page, postLink) {
  try {
    if (!postLink) {
      logError('❌ No post link available');
      return false;
    }

    logInfo('🔗 Opening post detail view...');
    const fullUrl = postLink.startsWith('http') ? postLink : `https://www.threads.net${postLink}`;
    
    await page.goto(fullUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await sleep(randomDelay(2000, 3000));
    
    // Wait for comments to load
    await page.waitForSelector('div[data-pressable-container="true"]', {
      timeout: 10000,
    }).catch(() => logInfo('⚠️ Timeout waiting for comments'));

    logSuccess('✅ Post detail view opened');
    return true;
  } catch (error) {
    logError(`❌ Error opening post: ${error.message}`);
    return false;
  }
}

/**
 * ✅ UPDATED: Extract comments from post detail view
 */
async function extractCommentsFromPostDetail(page) {
  try {
    const comments = await page.evaluate(() => {
      const commentContainers = document.querySelectorAll('div[data-pressable-container="true"]');
      const extractedComments = [];

      // Start from index 1 to skip the main post (index 0)
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
          extractedComments.push({ author, text: commentText, index: i });
        }
      }

      return extractedComments;
    });

    logInfo(`📝 Found ${comments.length} comments in post detail`);
    return comments;
  } catch (error) {
    logError(`❌ Error extracting comments from detail: ${error.message}`);
    return [];
  }
}

/**
 * ✅ UPDATED: Reply to specific comment in post detail view
 */
async function replyToComment(page, replyText, commentIndex) {
  try {
    await sleep(randomDelay(2000, 3000));

    // Click reply button on the specific comment container
    const replyButtonClicked = await page.evaluate((idx) => {
      const commentContainers = document.querySelectorAll('div[data-pressable-container="true"]');
      if (idx >= commentContainers.length) return false;
      
      const targetContainer = commentContainers[idx];
      
      // Find reply button using the specific selector structure
      const replyButtons = targetContainer.querySelectorAll('div[role="button"]');
      for (const btn of replyButtons) {
        const svg = btn.querySelector('svg[aria-label="Reply"]');
        if (svg) {
          // Scroll into view first
          targetContainer.scrollIntoView({ block: 'center', behavior: 'smooth' });
          btn.click();
          return true;
        }
      }
      return false;
    }, commentIndex);

    if (!replyButtonClicked) {
      logInfo("⚠️ Reply button not found");
      return false;
    }

    await sleep(randomDelay(2000, 3000));

    const replyInput = await page.waitForSelector('div[contenteditable="true"]', {
      timeout: 10000,
    });

    if (!replyInput) {
      logError("❌ Reply input not found");
      return false;
    }

    await replyInput.click();
    await sleep(500);
    await replyInput.type(replyText, { delay: randomDelay(100, 200) });
    await sleep(randomDelay(2000, 3000));

    // Submit via keyboard
    await page.keyboard.down("Control");
    await page.keyboard.press("Enter");
    await page.keyboard.up("Control");
    await sleep(2000);
    
    await handleNotificationPopup(page);
    
    // Check for alert after posting reply
    const alert = await checkForAlert(page);
    
    if (alert.hasAlert && alert.alertType === 'error') {
      logError(`❌ Reply failed: ${alert.message}`);
      return { success: false, error: alert.message };
    }

    logSuccess("✅ Reply posted");
    return { success: true };
  } catch (error) {
    logError(`❌ Reply posting error: ${error.message}`);
    return false;
  }
}

// ============================================================================
// EXTRACTION FUNCTIONS - ✅ WITH UNIQUE ID TRACKING
// ============================================================================

async function extractPostsFromPage(page) {
  try {
    await page.waitForSelector('div[data-pressable-container="true"]', {
      timeout: 10000
    }).catch(() => logInfo('⚠️ Timeout waiting for posts'));

    await sleep(1000);

    const posts = await page.evaluate(() => {
      const containers = document.querySelectorAll('div[data-pressable-container="true"]');
      const extractedPosts = [];

      if (containers.length === 0) {
        console.log('No containers found');
        return [];
      }

      for (let idx = 0; idx < containers.length; idx++) {
        const container = containers[idx];

        // Extract profile link and username
        const profileLink = container.querySelector('a[role="link"]');
        const username = profileLink ? profileLink.textContent.trim() : "";

        // Extract post content
        const contentSpans = container.querySelectorAll('span');
        let postContent = "";
        for (const span of contentSpans) {
          const text = span.textContent.trim();
          if (text.length > 20 && text.length < 500) {
            postContent = text;
            break;
          }
        }

        // Extract post link (use as unique ID)
        const postLinks = container.querySelectorAll('a[href*="/post/"]');
        const postLink = postLinks.length > 0 ? postLinks[0].getAttribute('href') : "";

        // Create unique ID from postLink or combination of username + content
        let uniqueId = postLink || `${username}_${postContent.substring(0, 50)}`;

        // Only include posts with valid data
        if (username && (postContent || postLink)) {
          extractedPosts.push({
            uniqueId,
            username,
            postContent,
            postLink,
            index: idx
          });
        }
      }

      return extractedPosts;
    });

    return posts;
  } catch (error) {
    logError(`❌ Error extracting posts: ${error.message}`);
    return [];
  }
}

// ============================================================================
// ALERT/NOTIFICATION DETECTION
// ============================================================================

/**
 * Check for alert/notification messages after an action
 * Returns: { hasAlert: boolean, alertType: 'success'|'error'|'warning', message: string }
 */
async function checkForAlert(page) {
  try {
    await sleep(1000); // Wait for alert to appear
    
    const alertInfo = await page.evaluate(() => {
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

// ✅ Smart scroll function with post count tracking
async function performSmartScroll(page) {
  try {
    const scrollResult = await page.evaluate(() => {
      const beforeScroll = window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const currentBottom = beforeScroll + viewportHeight;

      const spaceLeft = documentHeight - currentBottom;
      const nearBottom = spaceLeft < 500;
      
      // Count posts before scroll
      const postsBefore = document.querySelectorAll('div[data-pressable-container="true"]').length;

      // Scroll by 60-80% of viewport height
      const scrollAmount = Math.floor(viewportHeight * (0.6 + Math.random() * 0.2));

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

    // Wait longer if near bottom for new content to load
    if (scrollResult.nearBottom) {
      logInfo('⏳ Near bottom, waiting for new content...');
      await sleep(randomDelay(3000, 4000));
    }
    
    // Check if new posts loaded
    const postsAfter = await page.evaluate(() => {
      return document.querySelectorAll('div[data-pressable-container="true"]').length;
    });
    
    const newPostsLoaded = postsAfter > scrollResult.postsBefore;
    
    if (newPostsLoaded) {
      logInfo(`📜 Scrolled: ${scrollResult.postsBefore} → ${postsAfter} posts (${postsAfter - scrollResult.postsBefore} new)`);
    } else {
      logInfo(`📜 Scrolled ${scrollResult.scrollAmount}px | No new posts loaded`);
    }

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

// ============================================================================
// MAIN BOT LOGIC - ✅ FIXED: Proper post tracking with Set
// ============================================================================

async function interactWithPosts(page, config, stats, processedPostIds, sessionId, username) {
  try {
    // Extract ALL current posts on page
    const allPosts = await extractPostsFromPage(page);

    if (allPosts.length === 0) {
      logInfo('⚠️ No posts found, scrolling...');
      await performSmartScroll(page);
      return { stats, shouldContinue: true, foundNewPost: false };
    }

    // Find first unprocessed post
    let targetPost = null;
    for (const post of allPosts) {
      if (!processedPostIds.has(post.uniqueId)) {
        targetPost = post;
        break;
      }
    }

    // If all visible posts are processed, scroll for more
    if (!targetPost) {
      logInfo('✅ All visible posts processed, scrolling for more...');
      await performSmartScroll(page);
      return { stats, shouldContinue: true, foundNewPost: false };
    }

    // Mark this post as processed
    processedPostIds.add(targetPost.uniqueId);

    logInfo(`📌 Post by @${targetPost.username}: ${targetPost.postContent?.substring(0, 50)}...`);

    // Scroll the post into view
    await page.evaluate((idx) => {
      const containers = document.querySelectorAll('div[data-pressable-container="true"]');
      if (containers[idx]) {
        containers[idx].scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, targetPost.index);

    await sleep(randomDelay(1000, 2000));

    // 1. Like post
    const likeRoll = Math.random();
    logInfo(`🎲 Like roll: ${(likeRoll * 100).toFixed(1)}% vs ${(config.likeProbability * 100).toFixed(1)}%`);
    if (likeRoll < config.likeProbability) {
      logInfo(`👍 Attempting to like @${targetPost.username}'s post...`);
      
      // ✅ Re-find post index to ensure accuracy
      const currentIndex = await findPostIndexByLink(page, targetPost.postLink);
      if (currentIndex === -1) {
        logError('❌ Could not locate post for liking');
      } else {
        const likeResult = await likePost(page, currentIndex);
        
        if (likeResult && likeResult.success) {
          stats.likes++;
          logSuccess(`✅ Liked @${targetPost.username}'s post`);
          await logStructured(createLogEntry({
            actionType: "LIKE",
            author: targetPost.username,
            postContent: targetPost.postContent,
            status: "SUCCESS"
          }), "automation.json");
          
          // Log to CSV
          await logToCSV('LIKE', 'SUCCESS', {
            postAuthor: targetPost.username,
            postContent: targetPost.postContent,
            postLink: targetPost.postLink
          }, sessionId, username);
        } else if (likeResult && likeResult.error && !likeResult.alreadyLiked) {
          // Log failure to CSV
          await logToCSV('LIKE', 'FAILED', {
            postAuthor: targetPost.username,
            postContent: targetPost.postContent,
            postLink: targetPost.postLink,
            errorMessage: likeResult.error
          }, sessionId, username);
        }
      }
    } else {
      logInfo('⏭️ Skipped like (probability)');
    }

    // 2. Comment on post
    const commentRoll = Math.random();
    logInfo(`🎲 Comment roll: ${(commentRoll * 100).toFixed(1)}% vs ${(config.commentProbability * 100).toFixed(1)}%`);
    if (commentRoll < config.commentProbability) {
      logInfo(`💬 Attempting to comment on @${targetPost.username}'s post...`);
      const comment = await generateAIComment(targetPost.postContent || '');
      if (comment) {
        logInfo(`💬 Generated comment: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"}`);
        
        // ✅ Re-find post index to ensure accuracy
        const currentIndex = await findPostIndexByLink(page, targetPost.postLink);
        if (currentIndex === -1) {
          logError('❌ Could not locate post for commenting');
        } else {
          const commentResult = await postCommentToThreads(page, comment, currentIndex);
          
          if (commentResult && commentResult.success) {
            stats.comments++;
            logSuccess(`✅ Commented on @${targetPost.username}'s post: "${comment}"`);
            await logStructured(createLogEntry({
              actionType: "COMMENT",
              author: targetPost.username,
              postContent: targetPost.postContent,
              generatedText: comment,
              status: "SUCCESS"
            }), "automation.json");
            
            // Log to CSV
            await logToCSV('COMMENT', 'SUCCESS', {
              postAuthor: targetPost.username,
              postContent: targetPost.postContent,
              commentText: comment,
              postLink: targetPost.postLink
            }, sessionId, username);
          } else if (commentResult && commentResult.error) {
            // Log failed comment to CSV
            await logToCSV('COMMENT', 'FAILED', {
              postAuthor: targetPost.username,
              postContent: targetPost.postContent,
              commentText: comment,
              postLink: targetPost.postLink,
              errorMessage: commentResult.error
            }, sessionId, username);
          } else {
            // Log failed comment to CSV (no result)
            await logToCSV('COMMENT', 'FAILED', {
              postAuthor: targetPost.username,
              postContent: targetPost.postContent,
              commentText: comment,
              postLink: targetPost.postLink,
              errorMessage: 'Unknown error'
            }, sessionId, username);
          }
        }
      }
    } else {
      logInfo('⏭️ Skipped comment (probability)');
    }

    // 3. Reply to comment (open post detail first)
    const replyRoll = Math.random();
    logInfo(`🎲 Reply roll: ${(replyRoll * 100).toFixed(1)}% vs ${(config.replyProbability * 100).toFixed(1)}%`);
    if (replyRoll < config.replyProbability) {
      logInfo(`💭 Attempting to reply to comment on @${targetPost.username}'s post...`);
      
      // ✅ NEW: Open post detail view first
      const postOpened = await openPostDetailView(page, targetPost.postLink);
      if (postOpened) {
        const comments = await extractCommentsFromPostDetail(page);
        if (comments.length > 0) {
          const targetComment = comments[0];
          logInfo(`💭 Found comment by @${targetComment.author}: "${targetComment.text.substring(0, 40)}..."`);
          const reply = await generateAIReply(
            targetComment.author, 
            targetComment.text,
            targetPost.postContent || ''
          );
          if (reply) {
            logInfo(`💭 Generated reply: "${reply.substring(0, 50)}${reply.length > 50 ? '...' : ''}"}`);
            const replyResult = await replyToComment(page, reply, targetComment.index);
            
            if (replyResult && replyResult.success) {
              stats.replies++;
              logSuccess(`✅ Replied to @${targetComment.author} on @${targetPost.username}'s post: "${reply}"`);
              await logStructured(createLogEntry({
                actionType: "REPLY",
                author: targetComment.author,
                commentText: targetComment.text,
                generatedText: reply,
                status: "SUCCESS"
              }), "automation.json");
              
              // Log to CSV
              await logToCSV('REPLY', 'SUCCESS', {
                replyAuthor: targetComment.author,
                postAuthor: targetPost.username,
                postContent: targetPost.postContent,
                commentText: reply,
                postLink: targetPost.postLink
              }, sessionId, username);
            } else if (replyResult && replyResult.error) {
              // Log failed reply to CSV
              await logToCSV('REPLY', 'FAILED', {
                replyAuthor: targetComment.author,
                postAuthor: targetPost.username,
                postContent: targetPost.postContent,
                commentText: reply,
                postLink: targetPost.postLink,
                errorMessage: replyResult.error
              }, sessionId, username);
            }
          }
        } else {
          logInfo(`⚠️ No comments found on @${targetPost.username}'s post`);
        }
        
        // ✅ NEW: Navigate back to home feed
        logInfo('🏠 Navigating back to home feed...');
        
        // Set up dialog handler BEFORE navigation to catch "Changes you made may not be saved"
        let dialogHandled = false;
        const dialogHandler = async (dialog) => {
          if (dialogHandled) {
            logInfo(`⏭️ Dialog already handled, skipping...`);
            return;
          }
          
          logInfo(`⚠️ Dialog detected: "${dialog.message()}"`);
          try {
            if (dialog.message().includes('Changes you made') || 
                dialog.message().includes('may not be saved') ||
                dialog.message().includes('leave this page')) {
              logInfo('✅ Accepting unsaved changes dialog...');
              await dialog.accept();
            } else {
              await dialog.accept();
            }
            dialogHandled = true;
          } catch (error) {
            if (!error.message.includes('already handled')) {
              logError(`❌ Error handling dialog: ${error.message}`);
            }
          }
        };
        
        page.on('dialog', dialogHandler);
        
        // Also try to dismiss any visible popups before navigation
        try {
          await page.evaluate(() => {
            // Press Escape key to close any modals
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
          });
          await sleep(500);
        } catch (e) {
          // Ignore
        }
        
        try {
          await page.goto('https://www.threads.net/', {
            waitUntil: 'networkidle2',
            timeout: 30000,
          });
        } catch (navError) {
          logError(`⚠️ Navigation error: ${navError.message}`);
          // Try pressing Ctrl+Enter to dismiss any blocking popup
          await page.keyboard.down('Control');
          await page.keyboard.press('Enter');
          await page.keyboard.up('Control');
          await sleep(1000);
          
          // Try navigation again
          try {
            await page.goto('https://www.threads.net/', {
              waitUntil: 'networkidle2',
              timeout: 30000,
            });
          } catch (retryError) {
            logError(`❌ Retry navigation failed: ${retryError.message}`);
          }
        }
        
        // Remove dialog listener after navigation
        page.off('dialog', dialogHandler);
        
        await sleep(2000);
        
        // Check for any remaining popups after navigation
        await handleNotificationPopup(page);
      } else {
        logInfo('⚠️ Could not open post detail view');
      }
    } else {
      logInfo('⏭️ Skipped reply (probability)');
    }

    stats.postsProcessed++;

    // 4. Scroll after processing
    await performSmartScroll(page);

    return { stats, shouldContinue: true, foundNewPost: true };
  } catch (error) {
    logError(`❌ Error in interactWithPosts: ${error.message}`);
    return { stats, shouldContinue: false, foundNewPost: false };
  }
}

/**
 * ✅ FIXED: Main automation with proper duplicate prevention
 */
export async function automatedThreadsPostCreation(settings = {}) {
  const username = process.env.THREADS_USERNAME || settings.username;
  const password = process.env.THREADS_PASSWORD || settings.password;

  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  logInfo('🤖 Starting Threads automation...');
  logInfo(`⚙️ Settings: ${JSON.stringify(settings)}`);

  const config = {
    likeProbability: settings.like_percentage || 0.5,
    commentProbability: settings.comment_percentage || 0.3,
    replyProbability: settings.reply_percentage || 0.2,
    postsToProcess: settings.posts_to_process || 10,
  };

  const stats = {
    postsProcessed: 0,
    likes: 0,
    comments: 0,
    replies: 0,
  };

  // Generate unique session ID for this automation run
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  logInfo(`🆔 Session ID: ${sessionId}`);

  let browser = null;

  try {
    const { browser: browserInstance, page } = await initializeBotWithSession({
      username,
      password,
      botType: 'automation',
      headless: false,
      chromePath: process.env.CHROME_PATH || null,
    });

    browser = browserInstance;

    logSuccess('✅ Bot initialized successfully');

    // ✅ CRITICAL: Verify login before proceeding with any actions
    logInfo('🔐 Verifying login status before starting actions...');
    await page.goto('https://www.threads.net/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await sleep(3000);

    // Check if we're actually logged in
    const isLoggedIn = await page.evaluate(() => {
      // Check for login popup or login page indicators
      const hasLoginPopup = document.body.innerText.includes('Log in or sign up for Threads') || 
                           document.body.innerText.includes('Continue with Instagram') ||
                           document.body.innerText.includes('Log in with username instead');
      
      // Check for logged-in indicators
      const hasFeedContent = document.querySelectorAll('[data-pressable-container="true"]').length > 0;
      const hasProfileLinks = document.querySelectorAll('a[href^="/@"]').length > 0;
      const hasNavigation = document.querySelector('nav') !== null;
      
      // Must NOT have login popup AND must have at least one logged-in indicator
      return !hasLoginPopup && (hasFeedContent || hasProfileLinks || hasNavigation);
    });

    if (!isLoggedIn) {
      const currentUrl = page.url();
      logError('❌ Login verification failed - not logged in');
      logError(`❌ Current URL: ${currentUrl}`);
      throw new Error('Login verification failed - bot is not logged in. Cannot proceed with actions.');
    }

    logSuccess('✅ Login verified - proceeding with actions');

    // Navigate to home feed once
    logInfo('🏠 Navigating to Threads home feed...');
    await page.goto('https://www.threads.net/', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await sleep(5000);

    // Initial scroll to trigger feed loading
    await page.evaluate(() => window.scrollBy(0, 200));
    await sleep(2000);

    // Wait for posts to appear
    let postFound = false;
    let retries = 3;

    while (!postFound && retries > 0) {
      const hasPost = await page.evaluate(() => {
        return document.querySelectorAll('[data-pressable-container="true"]').length > 0;
      });

      if (hasPost) {
        postFound = true;
        break;
      }

      retries--;
      if (retries > 0) {
        logInfo('⏳ Waiting for posts to load...');
        await sleep(2000);
        await page.evaluate(() => window.scrollBy(0, 100));
      }
    }

    if (!postFound) {
      throw new Error('No posts found after initial load - may not be logged in');
    }

    logSuccess('✅ Feed loaded successfully');
    logInfo(`🎯 Target: ${config.postsToProcess} posts`);

    // ✅ Use Set to track processed post IDs (prevents duplicates)
    const processedPostIds = new Set();
    let consecutiveNoNewPosts = 0;
    const MAX_CONSECUTIVE_NO_NEW_POSTS = 3; // Reduced from 5 to 3 for consistency with flow.js

    while (stats.postsProcessed < config.postsToProcess) {
      const result = await interactWithPosts(page, config, stats, processedPostIds, sessionId, username);

      // Update stats
      stats.likes = result.stats.likes;
      stats.comments = result.stats.comments;
      stats.replies = result.stats.replies;
      stats.postsProcessed = result.stats.postsProcessed;

      if (!result.shouldContinue) {
        logInfo('⚠️ Stopping due to error');
        break;
      }

      // Check if we found a new post
      if (result.foundNewPost) {
        consecutiveNoNewPosts = 0;
      } else {
        consecutiveNoNewPosts++;
        logInfo(`⚠️ No new post found (${consecutiveNoNewPosts}/${MAX_CONSECUTIVE_NO_NEW_POSTS})`);
      }

      // If we haven't found new posts after multiple attempts, might be at end of feed
      if (consecutiveNoNewPosts >= MAX_CONSECUTIVE_NO_NEW_POSTS) {
        logInfo('⚠️ No new posts found after multiple scrolls, ending automation');
        break;
      }

      logInfo(`📊 Progress: ${stats.postsProcessed}/${config.postsToProcess} posts | ❤️ ${stats.likes} | 💬 ${stats.comments} | 💭 ${stats.replies}`);

      // Random delay between posts
      await sleep(randomDelay(3000, 6000));
    }

    logSuccess(`✅ Automation completed!`);
    logSuccess(`📊 Final Stats: ${stats.postsProcessed} posts, ${stats.likes} likes, ${stats.comments} comments, ${stats.replies} replies`);

    await logStructured(createLogEntry({
      actionType: "AUTOMATION_COMPLETE",
      stats: stats,
      status: "SUCCESS"
    }), "automation.json");
    
    // Log automation completion to CSV
    await logToCSV('AUTOMATION_COMPLETE', 'SUCCESS', {
      postAuthor: username,
      postContent: `Processed ${stats.postsProcessed} posts`,
      commentText: `Likes: ${stats.likes}, Comments: ${stats.comments}, Replies: ${stats.replies}`
    }, sessionId, username);

    await closeBotGracefully(browser, username);

    return {
      success: true,
      stats,
    };
  } catch (error) {
    await handleBotError(browser, error, username);
    return {
      success: false,
      error: error.message,
      stats,
    };
  }
}

/**
 * ✅ Wrapper for backward compatibility
 */
export async function runFullAutomation(settings = {}) {
  logInfo('🚀 Preparing full automation workflow...');
  return await automatedThreadsPostCreation(settings);
}

export default automatedThreadsPostCreation;