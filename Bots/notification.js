// ============================================================================
// FIXED notification.js - Complete Updated Code
// ============================================================================

import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";
import { initializeBotWithSession, closeBotGracefully, handleBotError } from "../helpers/botBootstrap.js";
import { sleep, randomDelay, logInfo, logSuccess, logError } from "../utils/logger.js";
import { logPostToCSV } from "../utils/csvLogger.js";

dotenv.config();

// Persistent tracking of processed notifications (across cycles)
const processedNotificationsFile = "./logs/processed_notifications.json";
let processedNotifications = new Set();

// Load processed notifications from file
function loadProcessedNotifications() {
  try {
    if (fs.existsSync(processedNotificationsFile)) {
      const data = fs.readFileSync(processedNotificationsFile, "utf8");
      const array = JSON.parse(data);
      processedNotifications = new Set(array);
      logToNotificationFile(`📋 Loaded ${processedNotifications.size} previously processed notifications`);
    }
  } catch (error) {
    logToNotificationFile(`⚠️ Error loading processed notifications: ${error.message}`);
    processedNotifications = new Set();
  }
}

// Save processed notifications to file
function saveProcessedNotifications() {
  try {
    const dir = "./logs";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const array = Array.from(processedNotifications);
    fs.writeFileSync(processedNotificationsFile, JSON.stringify(array, null, 2), "utf8");
  } catch (error) {
    logToNotificationFile(`⚠️ Error saving processed notifications: ${error.message}`);
  }
}

// Create unique identifier for a notification
function getNotificationId(notification) {
  // Use postLink + author + time to create unique ID
  const postLink = notification.postLink || "";
  const author = notification.author || "";
  const time = notification.time || "";
  return `${postLink}::${author}::${time}`;
}

function logToNotificationFile(message) {
  const timestamp = new Date().toLocaleString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync("threads_notification_log.txt", logMessage, "utf8");
    console.log(message);
  } catch (error) {
    console.error("Error writing to notification log:", error.message);
  }
}

// Parse time string and check if it's under 12 hours
function isUnder12Hours(timeString) {
  if (!timeString) return false;
  const match = timeString.match(/(\d+)([mhd])/);
  if (!match) return false;
  const [, value, unit] = match;
  const num = parseInt(value);
  if (unit === "m") return true;
  if (unit === "h") return num < 12;
  if (unit === "d") return false;
  return false;
}

/**
 * ✅ FIXED: Verify we're on notifications page BEFORE extracting
 */
async function verifyNotificationsPageLoaded(page) {
  try {
    logToNotificationFile("🔍 Verifying notification page is fully loaded...");
    
    // Wait for notification column to appear
    logToNotificationFile("⏳ Waiting for notification column...");
    await page.waitForSelector('div[aria-label="Column body"][role="region"]', { 
      timeout: 20000 
    }).catch(() => {
      logToNotificationFile("⚠️ Column body not found");
      return false;
    });
    
    await sleep(2000);
    
    // Verify page elements
    const pageCheck = await page.evaluate(() => {
      const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
      const hasNotificationText = document.body.innerText.includes('Notifications') || 
                                  document.body.innerText.includes('Activity');
      
      // Check for FEED indicators (these mean we're NOT on notifications)
      const feedIndicators = document.querySelector('div[aria-label="Feed"]') ||
                            document.querySelector('button[aria-label="Create a post"]') ||
                            document.querySelector('textarea[placeholder*="Start a thread"]');
      
      // Check for notification-specific elements
      const notificationIndicators = document.querySelector('svg[aria-label="Notifications"]')?.closest('a')?.getAttribute('aria-current') === 'page';
      
      return {
        hasColumnBody: !!columnBody,
        hasNotificationText,
        isFeed: !!feedIndicators,
        isNotificationActive: notificationIndicators,
        url: window.location.href,
        bodyPreview: document.body.innerText.substring(0, 300)
      };
    });
    
    logToNotificationFile(`  - Current URL: ${pageCheck.url}`);
    logToNotificationFile(`  - Has Column Body: ${pageCheck.hasColumnBody}`);
    logToNotificationFile(`  - Has Notification Text: ${pageCheck.hasNotificationText}`);
    logToNotificationFile(`  - Is Feed Page: ${pageCheck.isFeed}`);
    logToNotificationFile(`  - Notification Tab Active: ${pageCheck.isNotificationActive}`);
    
    // CRITICAL: If we detect feed indicators, we're NOT on notifications
    if (pageCheck.isFeed) {
      logToNotificationFile(`❌ ERROR: Still on FEED page, not notifications!`);
      logToNotificationFile(`📄 Page preview: ${pageCheck.bodyPreview}`);
      return false;
    }
    
    // Must have column body AND be on notifications URL
    const urlCheck = pageCheck.url.includes('/notifications') || pageCheck.url.includes('/activity');
    if (!pageCheck.hasColumnBody || !urlCheck) {
      logToNotificationFile(`❌ ERROR: Not on valid notifications page`);
      return false;
    }
    
    logToNotificationFile(`✅ Confirmed on notifications page with column loaded`);
    return true;
    
  } catch (error) {
    logToNotificationFile(`❌ Error verifying page: ${error.message}`);
    return false;
  }
}

/**
 * ✅ FIXED: Navigate to notifications with proper verification
 */
async function navigateToNotifications(page) {
  try {
    logToNotificationFile("\n" + "─".repeat(80));
    logToNotificationFile("🔔 Navigating to notifications page...");
    
    // Step 1: Go to home first to ensure clean state
    logToNotificationFile("🏠 Going to home page first...");
    await page.goto("https://www.threads.net/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await sleep(3000);

    // Step 2: Try clicking notification icon
    logToNotificationFile("🔍 Looking for notifications button...");
    const notificationIconClicked = await page.evaluate(() => {
      const notificationSvg = document.querySelector('svg[aria-label="Notifications"]');
      if (notificationSvg) {
        const clickableParent = notificationSvg.closest('div[class*="x6s0dn4"]') ||
          notificationSvg.closest('a') ||
          notificationSvg.closest('div[role="button"]') ||
          notificationSvg.parentElement;
        if (clickableParent) {
          clickableParent.click();
          return true;
        }
      }
      return false;
    }).catch(() => false);

    if (notificationIconClicked) {
      logToNotificationFile("✅ Notification icon clicked, waiting for page load...");
      await Promise.race([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {
          logToNotificationFile("⚠️ Navigation wait timed out, continuing...");
        }),
        sleep(15000)
      ]);
    } else {
      logToNotificationFile("⚠️ Icon not found, navigating directly...");
    }
    
    await sleep(2000);

    // Step 3: Force navigation if not on notifications
    const currentUrl = page.url();
    if (!currentUrl.includes('/notifications') && !currentUrl.includes('/activity')) {
      logToNotificationFile(`📍 Not on notifications (${currentUrl}), forcing navigation...`);
      await page.goto("https://www.threads.net/notifications", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await sleep(3000);
    }

    // Step 4: VERIFY page loaded correctly
    const isVerified = await verifyNotificationsPageLoaded(page);
    
    if (!isVerified) {
      logToNotificationFile(`❌ FAILED: Could not load notifications page properly`);
      
      // Debug: Take screenshot
      try {
        await page.screenshot({ path: 'debug-failed-navigation.png', fullPage: true });
        logToNotificationFile(`📸 Debug screenshot saved to debug-failed-navigation.png`);
      } catch (e) {
        // Ignore screenshot errors
      }
      
      return false;
    }

    // Step 5: Scroll to load content
    logToNotificationFile("📜 Scrolling to load notifications...");
    await page.evaluate(() => {
      const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
      if (columnBody) {
        columnBody.scrollTo(0, columnBody.scrollHeight / 2);
      }
    });
    await sleep(2000);

    logToNotificationFile("✅ Successfully navigated to notifications page");
    return true;
    
  } catch (error) {
    logToNotificationFile(`❌ Navigation error: ${error.message}`);
    return false;
  }
}

/**
 * Extract notifications from page
 */
async function extractNotificationsFromPage(page) {
  try {
    // Wait for the column body to appear
    logToNotificationFile("⏳ Waiting for notification column to load...");
    await page.waitForSelector('div[aria-label="Column body"][role="region"]', { timeout: 15000 });
    await sleep(2000);

    // Wait for loading spinner to disappear
    logToNotificationFile("⏳ Waiting for loading spinner to disappear...");
    await page.waitForFunction(() => {
      const loadingSpinner = document.querySelector('div[aria-label="Loading..."][role="status"]');
      return !loadingSpinner || loadingSpinner.offsetParent === null;
    }, { timeout: 10000 }).catch(() => {
      logToNotificationFile("⚠️ Loading spinner check timed out, continuing...");
    });
    await sleep(1000);

    // Wait for actual notification content (look for profile pictures)
    logToNotificationFile("⏳ Waiting for notification items to appear...");
    await page.waitForFunction(() => {
      const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
      if (!columnBody) return false;
      const profilePics = columnBody.querySelectorAll('img[alt*="profile picture"]');
      return profilePics.length > 0;
    }, { timeout: 15000 }).catch(() => {
      logToNotificationFile("⚠️ No profile pictures found, page may be empty");
    });
    await sleep(1500);

    // Scroll to load more notifications (do multiple small scrolls)
    logToNotificationFile("📜 Scrolling to load more notifications...");
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
        if (columnBody) {
          columnBody.scrollBy(0, 300);
        }
      });
      await sleep(800);
    }

    // Scroll back to top
    await page.evaluate(() => {
      const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
      if (columnBody) {
        columnBody.scrollTo(0, 0);
      }
    });
    await sleep(1500);

    // Extract notifications
    const notifications = await page.evaluate(() => {
      try {
        const extractedNotifications = [];

        const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
        if (!columnBody) {
          console.log(`❌ Column body not found!`);
          return [];
        }

        console.log(`✅ Found Column body`);

        const gridRows = columnBody.querySelectorAll('div.xrvj5dj.xnr31nm.xcttayb.xrjixri');
        console.log(`📦 Found ${gridRows.length} grid rows`);

        let containers = [];
        gridRows.forEach((gridRow, idx) => {
          const contentArea = gridRow.querySelector('div.x1hvtcl2.x1q0q8m5.x1co6499.x1xdureb');
          if (contentArea) {
            const pressableContainer = contentArea.querySelector('div[data-pressable-container="true"]');
            if (pressableContainer) {
              const hasUsername = pressableContainer.querySelector('a[href^="/@"]');
              const hasTime = pressableContainer.querySelector('time');
              if (hasUsername && hasTime) {
                containers.push(pressableContainer);
                console.log(`  ✅ Row ${idx}: Found valid notification`);
              }
            }
          }
        });

        console.log(`📦 Strategy 1 (grid rows): Found ${containers.length} notification containers`);

        if (containers.length === 0) {
          console.log(`⚠️ Strategy 1 failed, trying fallback...`);
          const allPressable = columnBody.querySelectorAll('div[data-pressable-container="true"]');
          console.log(`📦 Found ${allPressable.length} total pressable containers`);

          allPressable.forEach((container, idx) => {
            const hasUsername = container.querySelector('a[href^="/@"]');
            const hasTime = container.querySelector('time');
            if (hasUsername && hasTime) {
              containers.push(container);
              console.log(`  ✅ Container ${idx}: Valid notification`);
            }
          });

          console.log(`📦 Strategy 2 (fallback): Found ${containers.length} notification containers`);
        }

        console.log(`📄 Processing ${containers.length} containers...`);

        for (let index = 0; index < containers.length; index++) {
          const container = containers[index];
          try {
            console.log(`\n📋 Container ${index + 1}:`);

            const timeElement = container.querySelector('time') || container.querySelector('abbr[title]');
            if (!timeElement) {
              console.log(`  ⏭️ Skipped: No time element`);
              continue;
            }

            let notificationText = "";
            const textSpans = container.querySelectorAll('span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62');
            if (textSpans.length > 0) {
              notificationText = Array.from(textSpans).map(span => span.textContent).join(' ').trim();
            }

            if (!notificationText || notificationText.length < 5) {
              const contentArea = container.querySelector('div.x1hvtcl2');
              if (contentArea) {
                notificationText = contentArea.textContent.trim();
              }
            }

            if (notificationText && typeof notificationText === 'string') {
              console.log(`  📝 Text: "${notificationText.substring(0, 50)}..." (length: ${notificationText.length})`);
            }

            if (!notificationText || notificationText.length < 5) {
              console.log(`  ⏭️ Skipped: Text too short`);
              continue;
            }

            let timeText = "";
            if (timeElement) {
              const abbrElement = timeElement.querySelector('abbr');
              timeText = abbrElement ? abbrElement.textContent.trim() : timeElement.textContent.trim();
            }

            console.log(`  ⏰ Time: "${timeText}"`);

            if (!timeText) {
              console.log(`  ⏭️ Skipped: No time`);
              continue;
            }

            // ✅ Check for reply button using the specific structure provided
            // Structure: div[role="button"][tabindex="0"] containing svg[aria-label="Reply"] with specific path
            const replyButton = container.querySelector('div[role="button"][tabindex="0"] svg[aria-label="Reply"]');
            // Also check for the specific SVG path that identifies reply button (path starts with M15.376 13.2177)
            const replyButtonPath = container.querySelector('svg[aria-label="Reply"] path[d*="M15.376 13.2177"]');
            // Fallback: check for any button with Reply SVG
            const replyButtonFallback = container.querySelector('div[role="button"] svg[aria-label="Reply"]');
            const hasReplyButton = !!(replyButton || replyButtonPath || replyButtonFallback);
            
            const heartIcon = container.querySelector('svg path[d*="8.33956"]');
            const hasReplyIcon = container.querySelector('svg path[d*="13.2177"]');
            const hasFollowIcon = container.querySelector('svg path[d*="5.81283"]');

            let notificationType = "unknown";
            let detectionMethod = "";

            if (heartIcon) {
              notificationType = "like";
              detectionMethod = "heart-icon";
            } else if (hasReplyIcon || hasReplyButton) {
              notificationType = "reply";
              detectionMethod = "reply-icon";
            } else if (hasFollowIcon) {
              notificationType = "follow";
              detectionMethod = "follow-icon";
            }

            console.log(`Notification type: ${notificationType} (detected via: ${detectionMethod})`);

            const authorLinks = container.querySelectorAll('a[href^="/@"]');
            let author = "";
            if (authorLinks.length > 0) {
              const href = authorLinks[0].getAttribute("href");
              author = href ? href.replace("/@", "").split("/")[0] : "";
            }

            const postLinks = container.querySelectorAll('a[href*="/post/"]');
            let postLink = "";
            let postOwner = "";
            if (postLinks.length > 0) {
              postLink = postLinks[0].getAttribute("href");
              if (postLink) {
                const match = postLink.match(/\/@([^\/]+)\/post\//);
                if (match) {
                  postOwner = match[1];
                }
              }
            }

            extractedNotifications.push({
              text: notificationText,
              time: timeText,
              type: notificationType,
              detectionMethod: detectionMethod,
              author: author,
              postLink: postLink,
              postOwner: postOwner,
              index: index,
              hasReplyButton: hasReplyButton
            });

          } catch (innerError) {
            console.error("Error extracting single notification:", innerError);
            continue;
          }
        }

        console.log(`✅ Returning ${extractedNotifications.length} notifications`);
        return extractedNotifications;

      } catch (evalError) {
        console.error("❌ Error in page.evaluate:", evalError);
        console.error("Error stack:", evalError.stack);
        return [];
      }
    }).catch((error) => {
      logToNotificationFile(`⚠️ Page evaluation failed: ${error.message}`);
      return [];
    });

    // Safety check
    if (!notifications || !Array.isArray(notifications)) {
      logToNotificationFile(`⚠️ Notifications extraction returned invalid data (type: ${typeof notifications})`);
      return [];
    }

    logToNotificationFile(`✅ Extracted ${notifications.length} notifications from page`);

    return notifications;

  } catch (error) {
    logToNotificationFile(`❌ Error extracting notifications: ${error.message}`);
    return [];
  }
}

/**
 * Generate AI reply using OpenRouter
 */
async function generateAIReply(notificationText, commentText = "") {
  try {
    const apikey = process.env.OPENROUTER_API_KEY || process.env.REACT_APP_OPENROUTER_API_KEY;
    if (!apikey) {
      throw new Error("API key not found");
    }

    const tones = ["friendly", "casual", "supportive", "curious", "thoughtful"];
    const randomTone = tones[Math.floor(Math.random() * tones.length)];
    const prompt = `You are replying to a notification on Threads. Adopt a ${randomTone} tone.
Notification: "${notificationText}"
${commentText ? `Comment text: "${commentText}"` : ""}

Write a natural, human-like REPLY (8-25 words) that:
- Directly responds to the notification
- Sounds conversational and authentic
- Uses casual language
- Feels like a real person's reaction
- Can use 1-2 emojis max
- Matches the ${randomTone} tone
- IMPORTANT: Return ONLY the reply text, no quotes, no explanations

Generate ONE authentic reply now:`;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 1.0,
        top_p: 0.95,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apikey}`,
          "HTTP-Referer": "https://github.com/threads-bot",
          "X-Title": "Threads Notification Bot",
        },
      }
    );

    let aiReply = response.data.choices[0].message.content.trim();
    aiReply = aiReply.replace(/^[\"\']+|[\"\']+$/g, "");
    if (aiReply.length > 280) {
      aiReply = aiReply.substring(0, 277) + "...";
    }

    return aiReply;
  } catch (error) {
    logToNotificationFile(`❌ AI reply generation failed: ${error.message}`);
    return null;
  }
}

/**
 * Check if bot already replied using dynamic username and return last reply author info
 */
async function checkIfBotAlreadyReplied(page, username) {
  try {
    const replyInfo = await page.evaluate((user) => {
      // Find the Column body which contains the conversation thread
      const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
      if (!columnBody) return { alreadyReplied: false, lastReplyAuthor: null };

      // Get all pressable containers in the column body
      const allContainers = columnBody.querySelectorAll('div[data-pressable-container="true"]');
      
      // Filter to get only actual reply/comment containers (those with username links and profile pics)
      const replyContainers = Array.from(allContainers).filter((container, index) => {
        // Skip the first container (main post)
        if (index === 0) return false;
        
        // ✅ Must have a username link with translate="no" span (using specific structure)
        const usernameLink = container.querySelector('a[href^="/@"] span[translate="no"]');
        // Must have a profile picture
        const profilePic = container.querySelector('img[alt*="profile picture"]');
        return usernameLink && profilePic;
      });

      if (replyContainers.length === 0) {
        return { alreadyReplied: false, lastReplyAuthor: null };
      }

      // The LAST reply container in the entire thread is what we need to check
      const lastReply = replyContainers[replyContainers.length - 1];
      
      // Extract username from the last reply using the specific structure
      const authorSpan = lastReply.querySelector('a[href^="/@"] span[translate="no"]');
      if (!authorSpan) {
        return { alreadyReplied: false, lastReplyAuthor: null };
      }

      const author = authorSpan.textContent.trim();
      const alreadyReplied = author.toLowerCase() === user.toLowerCase();
      
      return {
        alreadyReplied: alreadyReplied,
        lastReplyAuthor: author
      };
    }, username).catch((error) => {
      console.error("Page evaluation failed in checkIfBotAlreadyReplied:", error);
      return { alreadyReplied: false, lastReplyAuthor: null };
    });

    logToNotificationFile(`  📝 Last reply author: ${replyInfo.lastReplyAuthor || 'none'}, Bot username: ${username}`);
    logToNotificationFile(`  ${replyInfo.alreadyReplied ? '✅ Bot already replied' : '❌ Bot has not replied yet'}`);
    
    return replyInfo;
  } catch (error) {
    logToNotificationFile(`⚠️ Error checking bot reply: ${error.message}`);
    return { alreadyReplied: false, lastReplyAuthor: null };
  }
}

/**
 * Find the last comment by a specific user (sorted by time)
 * Uses the specific HTML structure provided
 */
async function findLastCommentByUser(page, targetUsername, botUsername) {
  try {
    const commentInfo = await page.evaluate((username) => {
      // ✅ Use the specific structure: div[aria-label="Column body"][role="region"]
      const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
      if (!columnBody) return null;

      // Get all pressable containers (skip first which is the main post)
      const allContainers = columnBody.querySelectorAll('div[data-pressable-container="true"]');
      
      // Extract all comments with their timestamps
      const allComments = [];
      
      for (let i = 1; i < allContainers.length; i++) { // Start from 1 to skip main post
        const container = allContainers[i];
        
        // ✅ Must have a username link with translate="no" span (specific structure)
        const authorSpan = container.querySelector('a[href^="/@"] span[translate="no"]');
        // ✅ Must have a profile picture
        const profilePic = container.querySelector('img[alt*="profile picture"]');
        
        if (!authorSpan || !profilePic) continue;
        
        // Extract username
        const author = authorSpan.textContent.trim().toLowerCase();
        
        // ✅ Extract time using the specific structure: time element with datetime attribute
        const timeElement = container.querySelector('time[datetime]');
        let timestamp = null;
        let timeText = "";
        
        if (timeElement) {
          const datetime = timeElement.getAttribute('datetime');
          if (datetime) {
            timestamp = new Date(datetime).getTime(); // Convert to timestamp for sorting
          }
          // Also get the text representation
          const abbr = timeElement.querySelector('abbr');
          if (abbr) {
            timeText = abbr.textContent.trim();
          } else {
            timeText = timeElement.textContent.trim();
          }
        }
        
        // Extract comment text
        const textSpans = container.querySelectorAll('span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62');
        let commentText = "";
        if (textSpans.length > 0) {
          commentText = Array.from(textSpans)
            .map(span => span.textContent)
            .filter(text => text && text.length > 5 && !text.includes('ago') && !text.match(/^\d+[mhd]$/))
            .join(' ')
            .trim();
        }
        
        // If no text found, try getting text from the container
        if (!commentText || commentText.length < 5) {
          const containerText = container.textContent || container.innerText || '';
          commentText = containerText.trim();
        }
        
        allComments.push({
          index: i,
          author: author,
          text: commentText,
          timestamp: timestamp || 0, // Use 0 if no timestamp found
          timeText: timeText
        });
      }

      if (allComments.length === 0) return null;

      // ✅ Sort all comments by timestamp (most recent first)
      allComments.sort((a, b) => {
        if (a.timestamp && b.timestamp) {
          return b.timestamp - a.timestamp; // Most recent first
        }
        // If no timestamp, keep original order (later in DOM = more recent)
        return b.index - a.index;
      });

      // Find all comments by the target user
      const userComments = allComments.filter(comment => comment.author === username.toLowerCase());

      if (userComments.length === 0) return null;

      // ✅ Return the most recent comment by the user (first in sorted array)
      const lastComment = userComments[0];
      return {
        index: lastComment.index,
        author: lastComment.author,
        text: lastComment.text,
        timestamp: lastComment.timestamp,
        timeText: lastComment.timeText
      };
    }, targetUsername);

    if (commentInfo) {
      logToNotificationFile(`✅ Found last comment by @${targetUsername} at index ${commentInfo.index}`);
      if (commentInfo.timeText) {
        logToNotificationFile(`   Time: ${commentInfo.timeText}`);
      }
      logToNotificationFile(`   Comment text: "${commentInfo.text.substring(0, 50)}${commentInfo.text.length > 50 ? '...' : ''}"`);
    } else {
      logToNotificationFile(`⚠️ No comment found by @${targetUsername}`);
    }

    return commentInfo;
  } catch (error) {
    logToNotificationFile(`❌ Error finding comment by user: ${error.message}`);
    return null;
  }
}

/**
 * Reply to a specific comment by index
 */
async function replyToCommentByIndex(page, replyText, commentIndex) {
  try {
    await sleep(randomDelay(2000, 3000));
    logToNotificationFile(`🔍 Looking for Reply button on comment at index ${commentIndex}...`);

    // ✅ Click reply button on the specific comment container using the provided HTML structure
    // Structure: div[role="button"][tabindex="0"] containing svg[aria-label="Reply"] with path d="M15.376 13.2177..."
    const replyButtonClicked = await page.evaluate((idx) => {
      const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
      if (!columnBody) return false;
      
      const commentContainers = columnBody.querySelectorAll('div[data-pressable-container="true"]');
      if (idx >= commentContainers.length || idx < 0 || idx === 0) return false; // idx 0 is main post
      
      const targetContainer = commentContainers[idx];
      
      // Scroll into view first to ensure the comment is visible
      targetContainer.scrollIntoView({ block: 'center', behavior: 'smooth' });
      
      // ✅ Use the specific HTML structure provided:
      // Look for: div[role="button"][tabindex="0"] containing svg[aria-label="Reply"] with specific path
      // First try: Look for button with role="button" and tabindex="0" containing Reply SVG
      const replyButton = targetContainer.querySelector('div[role="button"][tabindex="0"] svg[aria-label="Reply"]');
      if (replyButton) {
        const buttonElement = replyButton.closest('div[role="button"][tabindex="0"]');
        if (buttonElement) {
          // Verify it has the specific path structure
          const path = replyButton.querySelector('path[d*="M15.376 13.2177"]');
          if (path) {
            buttonElement.click();
            return true;
          }
        }
      }
      
      // Second try: Check for the specific SVG path that identifies reply button
      const replyButtonPath = targetContainer.querySelector('svg[aria-label="Reply"] path[d*="M15.376 13.2177"]');
      if (replyButtonPath) {
        const buttonElement = replyButtonPath.closest('div[role="button"][tabindex="0"]');
        if (buttonElement) {
          buttonElement.click();
          return true;
        }
        // Fallback: any button containing this SVG
        const fallbackButton = replyButtonPath.closest('div[role="button"]');
        if (fallbackButton) {
          fallbackButton.click();
          return true;
        }
      }
      
      // Third try: Check for any button with Reply SVG (fallback)
      const replyButtons = targetContainer.querySelectorAll('div[role="button"]');
      for (const btn of replyButtons) {
        const svg = btn.querySelector('svg[aria-label="Reply"]');
        if (svg) {
          btn.click();
          return true;
        }
      }
      
      return false;
    }, commentIndex);

    if (!replyButtonClicked) {
      logToNotificationFile("⚠️ Reply button not found on comment");
      return { success: false, error: "Reply button not found" };
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
        if (replyInput) {
          logToNotificationFile(`✅ Found reply input`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!replyInput) {
      logToNotificationFile("❌ Reply input not found");
      return { success: false, error: "Reply input not found" };
    }

    await replyInput.click();
    await sleep(500);
    await replyInput.evaluate((el) => {
      el.textContent = "";
      el.focus();
    });
    await sleep(500);
    await replyInput.type(replyText, { delay: randomDelay(80, 150) });
    await sleep(randomDelay(2000, 3000));

    // Use Ctrl+Enter to post the reply
    logToNotificationFile("⌨️ Pressing Ctrl+Enter to post reply...");
    await page.keyboard.down("Control");
    await page.keyboard.press("Enter");
    await page.keyboard.up("Control");
    await sleep(2000);
    
    // Check for error alerts like "Post failed to upload"
    const alert = await checkForAlert(page);
    if (alert.hasAlert && alert.alertType === 'error') {
      logToNotificationFile(`❌ Reply failed: ${alert.message}`);
      return { success: false, error: alert.message };
    }
    
    logToNotificationFile("✅ Reply posted successfully to comment");
    return { success: true };

  } catch (error) {
    logToNotificationFile(`❌ Reply posting error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Post reply when already on the post detail page
 */
async function replyToNotificationOnPostPage(page, replyText) {
  try {
    await sleep(randomDelay(2000, 3000));
    logToNotificationFile("🔍 Looking for Reply button...");

    // Find and click reply button on the post page
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
    }).catch((error) => {
      logToNotificationFile(`⚠️ Error clicking reply button: ${error.message}`);
      return false;
    });

    if (!replyButtonClicked) {
      logToNotificationFile("⚠️ Reply button not found");
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
        if (replyInput) {
          logToNotificationFile(`✅ Found reply input`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!replyInput) {
      logToNotificationFile("❌ Reply input not found");
      return false;
    }

    await replyInput.click();
    await sleep(500);
    await replyInput.evaluate((el) => {
      el.textContent = "";
      el.focus();
    });
    await sleep(500);
    await replyInput.type(replyText, { delay: randomDelay(80, 150) });
    await sleep(randomDelay(2000, 3000));

    // Use Ctrl+Enter to post the reply
    logToNotificationFile("⌨️ Pressing Ctrl+Enter to post reply...");
    await page.keyboard.down("Control");
    await page.keyboard.press("Enter");
    await page.keyboard.up("Control");
    await sleep(2000);
    
    // Check for error alerts like "Post failed to upload"
    const alert = await checkForAlert(page);
    if (alert.hasAlert && alert.alertType === 'error') {
      logToNotificationFile(`❌ Reply failed: ${alert.message}`);
      return { success: false, error: alert.message };
    }
    
    logToNotificationFile("✅ Reply posted successfully");
    return { success: true };

  } catch (error) {
    logToNotificationFile(`❌ Reply posting error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

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
    logToNotificationFile(`❌ Error checking for alert: ${error.message}`);
    return { hasAlert: false, alertType: null, message: null };
  }
}

/**
 * Post reply to notification (legacy function - kept for compatibility)
 */
async function replyToNotification(page, replyText, postLink = null) {
  try {
    await sleep(randomDelay(2000, 3000));
    logToNotificationFile("🔍 Looking for Reply button...");

    // If postLink is provided, find the specific notification first
    const replyButtonClicked = await page.evaluate((targetPostLink) => {
      let targetContainer = null;
      
      // If we have a postLink, find the specific notification container
      if (targetPostLink) {
        const allContainers = document.querySelectorAll('div[data-pressable-container="true"]');
        for (const container of allContainers) {
          const postLinkElement = container.querySelector(`a[href="${targetPostLink}"]`);
          if (postLinkElement) {
            targetContainer = container;
            break;
          }
        }
        
        if (!targetContainer) {
          console.log(`❌ Could not find notification with postLink: ${targetPostLink}`);
          return false;
        }
      }
      
      // Find reply button within the target container (or first one if no postLink)
      const searchScope = targetContainer || document;
      const buttons = searchScope.querySelectorAll('div[role="button"]');
      
      for (const btn of buttons) {
        const svg = btn.querySelector('svg[aria-label="Reply"]');
        if (svg) {
          btn.click();
          return true;
        }
      }
      return false;
    }, postLink).catch((error) => {
      logToNotificationFile(`⚠️ Error clicking reply button: ${error.message}`);
      return false;
    });

    if (!replyButtonClicked) {
      logToNotificationFile("⚠️ Reply button not found");
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
        if (replyInput) {
          logToNotificationFile(`✅ Found reply input`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!replyInput) {
      logToNotificationFile("❌ Reply input not found");
      return false;
    }

    await replyInput.click();
    await sleep(500);
    await replyInput.evaluate((el) => {
      el.textContent = "";
      el.focus();
    });
    await sleep(500);
    await replyInput.type(replyText, { delay: randomDelay(80, 150) });
    await sleep(randomDelay(2000, 3000));

    // Use Ctrl+Enter to post the reply
    logToNotificationFile("⌨️ Pressing Ctrl+Enter to post reply...");
    await page.keyboard.down("Control");
    await page.keyboard.press("Enter");
    await page.keyboard.up("Control");
    await sleep(2000);
    
    // Check for error alerts like "Post failed to upload"
    const alert = await checkForAlert(page);
    if (alert.hasAlert && alert.alertType === 'error') {
      logToNotificationFile(`❌ Reply failed: ${alert.message}`);
      return { success: false, error: alert.message };
    }
    
    // Also check for unsaved changes popup
    try {
      await sleep(1500);
      const popupInfo = await page.evaluate(() => {
        const bodyText = document.body.innerText || document.body.textContent || '';
        const hasUnsavedChangesAlert = bodyText.includes('Changes you made may not be saved') ||
          bodyText.includes('changes you made') ||
          bodyText.includes('may not be saved');

        if (hasUnsavedChangesAlert) {
          return { found: true, type: 'unsavedChanges' };
        }

        const dialog = document.querySelector('[role="dialog"]') ||
          document.querySelector('[role="alertdialog"]') ||
          document.querySelector('[aria-modal="true"]');

        if (dialog && dialog.offsetParent !== null) {
          const rect = dialog.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { found: true, type: 'dialog' };
          }
        }

        return { found: false };
      });

      if (popupInfo.found) {
        logToNotificationFile(`  Popup detected after posting, pressing Ctrl+Enter...`);
        await page.keyboard.down('Control');
        await page.keyboard.press('Enter');
        await page.keyboard.up('Control');
        await sleep(1000);
        logToNotificationFile('  Dismissed popup');
      }
    } catch (popupError) {
      logToNotificationFile(`  Error checking for popup: ${popupError.message}`);
    }

    logToNotificationFile("✅ Reply posted successfully");
    return { success: true };

  } catch (error) {
    logToNotificationFile(`❌ Reply posting error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * ✅ FIXED: Check and reply to notifications with proper navigation
 */
async function checkAndReplyToNotifications(page, shouldReply, username, searchKeyword = null) {
  try {
    logToNotificationFile("\n" + "═".repeat(80));
    logToNotificationFile("🔔 Starting notification check cycle...");
    
    // Check if we're already on notifications page
    const currentUrl = page.url();
    const isOnNotifications = currentUrl.includes('/notifications') || currentUrl.includes('/activity');
    
    if (!isOnNotifications) {
      logToNotificationFile("⚠️ Not on notifications page, navigating...");
      const navigationSuccess = await navigateToNotifications(page);
      
      if (!navigationSuccess) {
        logToNotificationFile(`❌ Failed to navigate to notifications page`);
        return {
          checked: 0,
          processed: 0,
          replied: 0,
          skipped: 0,
          skippedLikeFollow: 0,
          alreadyReplied: 0,
          error: "Navigation failed"
        };
      }
    } else {
      logToNotificationFile(`✅ Already on notifications page: ${currentUrl}`);
      // Refresh to get latest notifications
      logToNotificationFile("🔄 Refreshing page to get latest notifications...");
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3000);
      
      // Verify the page is ready
      const isVerified = await verifyNotificationsPageLoaded(page);
      if (!isVerified) {
        logToNotificationFile(`❌ Notifications page verification failed`);
        return {
          checked: 0,
          processed: 0,
          replied: 0,
          skipped: 0,
          skippedLikeFollow: 0,
          alreadyReplied: 0,
          error: "Verification failed"
        };
      }
    }

    // ✅ NOW it's safe to extract notifications
    // Load previously processed notifications
    loadProcessedNotifications();
    
    // Track which notifications we've already replied to in THIS cycle (by postLink)
    const repliedPostLinks = new Set();
    
    // Process notifications
    let checkedCount = 0;
    let processedCount = 0;
    let repliedCount = 0;
    let skippedOldCount = 0;
    let skippedLikeFollowCount = 0;
    let alreadyRepliedCount = 0;
    let alreadyProcessedCount = 0;
    
    // Keep processing until we've checked all notifications or hit old ones
    let continueProcessing = true;
    
    while (continueProcessing) {
      // Re-extract notifications to get fresh DOM state
      logToNotificationFile("📄 Extracting notifications from verified page...");
      const notifications = await extractNotificationsFromPage(page);
      
      logToNotificationFile(`📬 Found ${notifications.length} notifications on page`);

      if (notifications.length === 0) {
        logToNotificationFile(`⚠️ No notifications found!`);
        try {
          await page.screenshot({ path: 'debug-no-notifications.png', fullPage: true });
          logToNotificationFile(`📸 Screenshot saved to debug-no-notifications.png`);
        } catch (e) {
          // Ignore screenshot errors
        }
        break;
      }
      
      let foundNewNotification = false;

      for (const notification of notifications) {
        // Create unique ID for this notification
        const notificationId = getNotificationId(notification);
        
        // Skip if we've already processed this notification (persistent check)
        if (processedNotifications.has(notificationId)) {
          alreadyProcessedCount++;
          logToNotificationFile(`\n📌 Notification (already processed):`);
          logToNotificationFile(`  Type: ${notification.type}`);
          logToNotificationFile(`  Author: @${notification.author}`);
          logToNotificationFile(`  Time: ${notification.time}`);
          logToNotificationFile(`  ⏭️ SKIPPED: Already processed in a previous cycle`);
          continue;
        }
        
        // Skip if we've already replied to this notification in THIS cycle
        if (notification.postLink && repliedPostLinks.has(notification.postLink)) {
          continue; // Already processed this one in current cycle
        }
        
        checkedCount++;
        logToNotificationFile(`\n📌 Notification ${checkedCount}:`);
        logToNotificationFile(`  Type: ${notification.type}`);
        logToNotificationFile(`  Author: @${notification.author}`);
        logToNotificationFile(`  Time: ${notification.time}`);
        
        if (!isUnder12Hours(notification.time)) {
          logToNotificationFile(`  ⏭️ SKIPPED: Older than 12 hours`);
          skippedOldCount++;
          continueProcessing = false; // Stop processing entirely
          break;
        }
        
        // ✅ Check for reply button immediately after time check
        // Only notifications with reply buttons are reply notifications
        if (!notification.hasReplyButton) {
          logToNotificationFile(`  ⏭️ SKIPPED: No reply button present (not a reply notification)`);
          continue;
        }
        
        if (notification.type === "like" || notification.type === "follow" || notification.type === "repost") {
          skippedLikeFollowCount++;
          logToNotificationFile(`  ⏭️ SKIPPED: ${notification.type.toUpperCase()} notification`);
          continue;
        }

        processedCount++;
        
        // Mark as being processed immediately to prevent duplicate processing
        processedNotifications.add(notificationId);
        saveProcessedNotifications();
        
        if (!shouldReply) {
          logToNotificationFile("ℹ️ Reply disabled in this run");
          continue;
        }

        if (!notification.postLink) {
          logToNotificationFile("⚠️ No post link found");
          continue;
        }
        
        foundNewNotification = true;

        try {
          // Step 1: Click on the notification to open it
          logToNotificationFile("🖱️ Clicking on notification to open...");
          const notificationClicked = await page.evaluate((targetPostLink) => {
            const allContainers = document.querySelectorAll('div[data-pressable-container="true"]');
            for (const container of allContainers) {
              const postLinkElement = container.querySelector(`a[href="${targetPostLink}"]`);
              if (postLinkElement) {
                postLinkElement.click();
                return true;
              }
            }
            return false;
          }, notification.postLink);
          
          if (!notificationClicked) {
            logToNotificationFile("⚠️ Could not click notification");
            continue;
          }
          
          await sleep(randomDelay(3000, 4000));
          
          // Step 2: Check if bot already replied to this notification and get the last reply author
          logToNotificationFile("🔍 Checking if bot already replied...");
          const lastReplyInfo = await checkIfBotAlreadyReplied(page, username);
          
          if (lastReplyInfo.alreadyReplied) {
            alreadyRepliedCount++;
            logToNotificationFile("  ⏭️ SKIPPED: Bot already replied to this");
            
            // Mark as processed even though we didn't reply (bot already did)
            processedNotifications.add(notificationId);
            saveProcessedNotifications();
            
            // Go back to notifications page
            logToNotificationFile("🔙 Going back to notifications...");
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
            await sleep(randomDelay(2000, 3000));
            continue;
          }
          
          // Step 3: Bot hasn't replied yet, reply to the last reply author's comment
          logToNotificationFile("✅ Bot hasn't replied yet");
          
          let lastComment = null;
          
          // If we found a last reply author (and it's not the bot), reply to that author's last comment
          if (lastReplyInfo.lastReplyAuthor && lastReplyInfo.lastReplyAuthor.toLowerCase() !== username.toLowerCase()) {
            logToNotificationFile(`💬 Last reply was by @${lastReplyInfo.lastReplyAuthor}, finding their last comment to reply to...`);
            lastComment = await findLastCommentByUser(page, lastReplyInfo.lastReplyAuthor, username);
          } else {
            // Fallback: Find the last comment by the notification author
            logToNotificationFile(`💬 Finding last un-replied comment by notification author @${notification.author}...`);
            lastComment = await findLastCommentByUser(page, notification.author, username);
          }
          
          let replyResult = null;
          
          if (lastComment) {
            // Reply to the last comment by the notification author
            logToNotificationFile(`💬 Found un-replied comment by @${notification.author} at index ${lastComment.index}`);
            logToNotificationFile(`   Comment: "${lastComment.text.substring(0, 50)}${lastComment.text.length > 50 ? '...' : ''}"`);
            
            const aiReply = await generateAIReply(notification.text, lastComment.text);
            if (!aiReply) {
              logToNotificationFile("⚠️ Failed to generate AI reply");
              // Go back to notifications page
              await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
              await sleep(randomDelay(2000, 3000));
              continue;
            }

            logToNotificationFile(`💬 Generated reply: "${aiReply}"`);
            
            // ✅ Reply to the specific comment using the tracked index and proper reply button structure
            replyResult = await replyToCommentByIndex(page, aiReply, lastComment.index);
          } else {
            // Fallback: If no comment found, reply to the main post
            logToNotificationFile(`⚠️ No un-replied comment found by @${notification.author}, replying to main post instead...`);
            
            const aiReply = await generateAIReply(notification.text);
            if (!aiReply) {
              logToNotificationFile("⚠️ Failed to generate AI reply");
              // Go back to notifications page
              await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
              await sleep(randomDelay(2000, 3000));
              continue;
            }

            logToNotificationFile(`💬 Generated reply: "${aiReply}"`);
            
            // Reply to main post as fallback
            replyResult = await replyToNotificationOnPostPage(page, aiReply);
          }
          if (replyResult && replyResult.success) {
            repliedCount++;
            logToNotificationFile("✅ Successfully replied");
            
            // Mark this notification as replied (both in current cycle and persistent)
            if (notification.postLink) {
              repliedPostLinks.add(notification.postLink);
            }
            processedNotifications.add(notificationId);
            saveProcessedNotifications(); // Save immediately
            
            await logPostToCSV({
              actionType: "REPLY",
              status: "SUCCESS",
              username: username,  // Bot's username (who is replying)
              author: notification.author || "",  // Person who sent the notification
              postContent: notification.text || "",
              generatedText: aiReply,
              postLink: notification.postLink || "",
              module: "notification.js"
            });
          } else if (replyResult && replyResult.error) {
            logToNotificationFile(`❌ Reply failed: ${replyResult.error}`);
            await logPostToCSV({
              actionType: "REPLY",
              status: "FAILED",
              username: username,
              author: notification.author || "",
              postContent: notification.text || "",
              generatedText: `${aiReply} | Error: ${replyResult.error}`,
              postLink: notification.postLink || "",
              module: "notification.js"
            });
          }
          
          // Go back to notifications page
          logToNotificationFile("🔙 Going back to notifications...");
          await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
          await sleep(randomDelay(3000, 5000));
          
          // After replying, DOM changes - break loop to re-extract notifications
          logToNotificationFile("🔄 Will re-extract notifications to avoid index issues");
          break; // Exit inner loop to re-extract fresh notifications

        } catch (replyError) {
          logToNotificationFile(`⚠️ Error processing notification: ${replyError.message}`);
          // Try to go back to notifications page on error
          try {
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
            await sleep(2000);
          } catch (navError) {
            logToNotificationFile(`⚠️ Could not navigate back: ${navError.message}`);
          }
        }
      }
      
      // If we didn't find any new notifications to process, stop
      if (!foundNewNotification) {
        continueProcessing = false;
      }
    }

    // Save processed notifications at end of cycle
    saveProcessedNotifications();
    
    logToNotificationFile("\n" + "─".repeat(80));
    logToNotificationFile("📊 CYCLE SUMMARY:");
    logToNotificationFile(`  ✓ Checked: ${checkedCount}`);
    logToNotificationFile(`  ⏭ Skipped (old): ${skippedOldCount}`);
    logToNotificationFile(`  ⏭ Skipped (like/follow): ${skippedLikeFollowCount}`);
    logToNotificationFile(`  ⏭ Skipped (already processed): ${alreadyProcessedCount}`);
    logToNotificationFile(`  ⏭ Skipped (already replied): ${alreadyRepliedCount}`);
    logToNotificationFile(`  📝 Processed: ${processedCount}`);
    logToNotificationFile(`  💬 Replied: ${repliedCount}`);
    logToNotificationFile("─".repeat(80));

    // Navigate to search page after processing notifications
    try {
      logToNotificationFile("🔍 Navigating to search page after notification check...");
      if (searchKeyword) {
        await page.goto(`https://www.threads.net/search?q=${encodeURIComponent(searchKeyword)}&serp_type=default`, {
          waitUntil: 'networkidle2',
          timeout: 60000
        });
        logToNotificationFile(`✅ Navigated to search page for: "${searchKeyword}"`);
      } else {
        await page.goto('https://www.threads.net/', {
          waitUntil: 'networkidle2',
          timeout: 60000
        });
        logToNotificationFile(`✅ Navigated to home feed`);
      }
      await sleep(3000);
    } catch (navError) {
      logToNotificationFile(`⚠️ Error navigating to search page: ${navError.message}`);
    }

    return {
      checked: checkedCount,
      processed: processedCount,
      replied: repliedCount,
      skipped: skippedOldCount,
      skippedLikeFollow: skippedLikeFollowCount,
      alreadyReplied: alreadyRepliedCount,
      alreadyProcessed: alreadyProcessedCount,
    };

  } catch (error) {
    logToNotificationFile(`❌ Error in notification check cycle: ${error.message}`);
    console.error(error.stack);
    return {
      checked: 0,
      processed: 0,
      replied: 0,
      skipped: 0,
      skippedLikeFollow: 0,
      alreadyReplied: 0,
      error: error.message
    };
  }
}

/**
 * Main notification checker
 */
async function runNotificationChecker(username, password, config = {}) {
  let browser = null;
  try {
    logToNotificationFile("\n" + "=".repeat(80));
    logToNotificationFile("🤖 THREADS NOTIFICATION BOT STARTED");
    logToNotificationFile("=".repeat(80));
    logToNotificationFile(`👤 User: ${username}`);

    const { browser: browserInstance, page } = await initializeBotWithSession({
      username: username,
      password: password,
      botType: 'notification_checker',
      headless: config.headless !== undefined ? config.headless : false,
      chromePath: config.chromePath || null,
    });

    browser = browserInstance;
    logSuccess('✅ Login successful, navigating to notifications page...');

    // Navigate to notifications page immediately after login
    const initialNavSuccess = await navigateToNotifications(page);
    if (!initialNavSuccess) {
      throw new Error('Failed to navigate to notifications page after login');
    }
    
    logToNotificationFile('✅ Ready to start notification checks...');

    const checkInterval = config.checkInterval || 2;
    while (true) {
      const results = await checkAndReplyToNotifications(page, config.autoReply !== false, username);
      logToNotificationFile(
        `📊 Stats: ${results.checked} checked, ${results.skippedLikeFollow} skipped, ${results.processed} processed, ${results.replied} replied`
      );
      logToNotificationFile(`⏳ Waiting ${checkInterval} hours...`);
      await sleep(checkInterval * 60 * 60 * 1000);
    }

  } catch (error) {
    logToNotificationFile(`❌ Critical error: ${error.message}`);
    console.error(error);
    await handleBotError(browser, error, username);
  } finally {
    if (browser) {
      await closeBotGracefully(browser, username);
    }
  }
}

export { checkAndReplyToNotifications, runNotificationChecker, navigateToNotifications, verifyNotificationsPageLoaded };
export default runNotificationChecker;