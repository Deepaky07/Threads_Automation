// // // // // // // ============================================================================
// // // // // // // FIXED Bots/index.js - WITH PROPER COMMENT EXTRACTION
// // // // // // // ============================================================================

// // // // // // import { initializeBotWithSession, closeBotGracefully, handleBotError } from "../helpers/botBootstrap.js";
// // // // // // import { logInfo, logSuccess, logError, sleep, randomDelay, logStructured, createLogEntry } from "../utils/logger.js";
// // // // // // import { generateAIComment, generateAIReply } from "../helpers/aiGeneration.js";
// // // // // // import { saveSession } from "../services/SessionManager.js";
// // // // // // import dotenv from "dotenv";
// // // // // // import fs from "fs";
// // // // // // import path from "path";
// // // // // // import { fileURLToPath } from "url";

// // // // // // dotenv.config();

// // // // // // // Get __dirname equivalent in ES modules
// // // // // // const __filename = fileURLToPath(import.meta.url);
// // // // // // const __dirname = path.dirname(__filename);

// // // // // // // CSV Logging Function
// // // // // // async function logToCSV(actionType, status, data = {}, sessionId) {
// // // // // //   try {
// // // // // //     const csvPath = path.join(__dirname, "../logs/posts_logs.csv");
// // // // // //     const timestamp = new Date().toISOString();
// // // // // //     const date = timestamp.split('T')[0];
// // // // // //     const time = timestamp.split('T')[1].split('.')[0];
    
// // // // // //     const csvLine = [
// // // // // //       timestamp,
// // // // // //       date,
// // // // // //       time,
// // // // // //       actionType,
// // // // // //       status,
// // // // // //       data.replyAuthor || '',
// // // // // //       data.postAuthor || '',
// // // // // //       data.postContent ? `"${data.postContent.replace(/"/g, '""')}"` : '',
// // // // // //       data.commentText ? `"${data.commentText.replace(/"/g, '""')}"` : '',
// // // // // //       data.postLink || '',
// // // // // //       'index.js',
// // // // // //       data.errorType || '',
// // // // // //       data.errorMessage || '',
// // // // // //       data.retryCount || 0,
// // // // // //       sessionId
// // // // // //     ].join(',') + '\n';
    
// // // // // //     await fs.promises.appendFile(csvPath, csvLine);
// // // // // //   } catch (error) {
// // // // // //     logError(`❌ Error writing to CSV: ${error.message}`);
// // // // // //   }
// // // // // // }

// // // // // // // ============================================================================
// // // // // // // AI INTERACTION FUNCTIONS
// // // // // // // ============================================================================

// // // // // // /**
// // // // // //  * ✅ NEW: Find current index of a post by its unique link
// // // // // //  */
// // // // // // async function findPostIndexByLink(page, postLink) {
// // // // // //   try {
// // // // // //     if (!postLink) {
// // // // // //       logError('❌ No postLink provided to findPostIndexByLink');
// // // // // //       return -1;
// // // // // //     }

// // // // // //     const index = await page.evaluate((link) => {
// // // // // //       const containers = document.querySelectorAll('div[data-pressable-container="true"]');
      
// // // // // //       for (let i = 0; i < containers.length; i++) {
// // // // // //         const container = containers[i];
        
// // // // // //         // Look for the specific post link in this container
// // // // // //         const postLinks = container.querySelectorAll('a[href*="/post/"]');
        
// // // // // //         for (const a of postLinks) {
// // // // // //           const href = a.getAttribute('href');
// // // // // //           // Match either full URL or relative path
// // // // // //           if (href === link || href.includes(link) || link.includes(href)) {
// // // // // //             return i;
// // // // // //           }
// // // // // //         }
// // // // // //       }
// // // // // //       return -1;
// // // // // //     }, postLink);
    
// // // // // //     if (index === -1) {
// // // // // //       logInfo(`⚠️ Could not find post with link: ${postLink}`);
// // // // // //     }
    
// // // // // //     return index;
// // // // // //   } catch (error) {
// // // // // //     logError(`❌ Error finding post index: ${error.message}`);
// // // // // //     return -1;
// // // // // //   }
// // // // // // }

// // // // // // /**
// // // // // //  * ✅ NEW: Check for notification popup and press Ctrl+Enter if present
// // // // // //  */
// // // // // // async function handleNotificationPopup(page) {
// // // // // //   try {
// // // // // //     await sleep(1500); // Wait longer for notification to appear
    
// // // // // //     // Check if a notification/modal popup is visible
// // // // // //     const popupInfo = await page.evaluate(() => {
// // // // // //       // Check for various popup indicators
// // // // // //       const checks = {
// // // // // //         dialog: document.querySelector('[role="dialog"]'),
// // // // // //         alertDialog: document.querySelector('[role="alertdialog"]'),
// // // // // //         ariaModal: document.querySelector('[aria-modal="true"]'),
// // // // // //         contentEditable: document.querySelector('div[contenteditable="true"]'),
// // // // // //         textarea: document.querySelector('textarea'),
// // // // // //         // Check for overlay/backdrop (common in modals)
// // // // // //         backdrop: document.querySelector('[style*="position: fixed"]'),
// // // // // //         // Check for z-index layers (popups usually have high z-index)
// // // // // //         highZIndex: Array.from(document.querySelectorAll('div')).find(el => {
// // // // // //           const zIndex = window.getComputedStyle(el).zIndex;
// // // // // //           return zIndex && parseInt(zIndex) > 100;
// // // // // //         })
// // // // // //       };
      
// // // // // //       // Log what we found for debugging
// // // // // //       const found = Object.entries(checks)
// // // // // //         .filter(([key, val]) => val !== null && val !== undefined)
// // // // // //         .map(([key]) => key);
      
// // // // // //       // Check if any element is visible and interactive
// // // // // //       for (const [key, element] of Object.entries(checks)) {
// // // // // //         if (element && element.offsetParent !== null) {
// // // // // //           // Additional check: is it actually visible on screen?
// // // // // //           const rect = element.getBoundingClientRect();
// // // // // //           if (rect.width > 0 && rect.height > 0) {
// // // // // //             return { found: true, type: key, foundElements: found };
// // // // // //           }
// // // // // //         }
// // // // // //       }
      
// // // // // //       return { found: false, foundElements: found };
// // // // // //     });
    
// // // // // //     if (popupInfo.found) {
// // // // // //       logInfo(`📬 Notification popup detected (${popupInfo.type}), pressing Ctrl+Enter...`);
      
// // // // // //       // Try to focus on the input field first if it exists
// // // // // //       try {
// // // // // //         await page.focus('div[contenteditable="true"]').catch(() => {});
// // // // // //         await sleep(500);
// // // // // //       } catch (e) {
// // // // // //         // Ignore if focus fails
// // // // // //       }
      
// // // // // //       // Press Ctrl+Enter
// // // // // //       await page.keyboard.down('Control');
// // // // // //       await page.keyboard.press('Enter');
// // // // // //       await page.keyboard.up('Control');
      
// // // // // //       await sleep(1500); // Wait for action to complete
// // // // // //       logSuccess('✅ Pressed Ctrl+Enter on notification');
// // // // // //       return true;
// // // // // //     } else if (popupInfo.foundElements.length > 0) {
// // // // // //       logInfo(`⚠️ Found elements but not visible: ${popupInfo.foundElements.join(', ')}`);
// // // // // //     }
    
// // // // // //     return false;
// // // // // //   } catch (error) {
// // // // // //     logError(`❌ Error handling notification popup: ${error.message}`);
// // // // // //     return false;
// // // // // //   }
// // // // // // }

// // // // // // async function likePost(page, postIndex) {
// // // // // //   try {
// // // // // //     await sleep(randomDelay(1500, 2500));

// // // // // //     const likeResult = await page.evaluate((idx) => {
// // // // // //       const allContainers = document.querySelectorAll('div[data-pressable-container="true"]');
// // // // // //       if (idx >= allContainers.length) {
// // // // // //         return { success: false, alreadyLiked: false, error: 'Container not found' };
// // // // // //       }

// // // // // //       const targetContainer = allContainers[idx];
// // // // // //       let encounteredLiked = false;

// // // // // //       const candidateSelectors = [
// // // // // //         'div[role="button"][aria-label*="Like"]',
// // // // // //         'div[role="button"] svg[aria-label="Like"]',
// // // // // //         'svg[aria-label="Like"]',
// // // // // //       ];

// // // // // //       const clickButton = (node) => {
// // // // // //         const button = node.closest('div[role="button"]') || (node.getAttribute?.('role') === 'button' ? node : null);
// // // // // //         if (!button) return false;

// // // // // //         const labelSource = button.getAttribute('aria-label') || node.getAttribute?.('aria-label') || '';
// // // // // //         const normalizedLabel = labelSource.toLowerCase();

// // // // // //         if (normalizedLabel.includes('unlike')) {
// // // // // //           encounteredLiked = true;
// // // // // //           return false;
// // // // // //         }

// // // // // //         if (!normalizedLabel.includes('like')) {
// // // // // //           return false;
// // // // // //         }

// // // // // //         button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
// // // // // //         button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
// // // // // //         button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
// // // // // //         button.click();

// // // // // //         return true;
// // // // // //       };

// // // // // //       // Search ONLY in the target container
// // // // // //       for (const selector of candidateSelectors) {
// // // // // //         const elements = targetContainer.querySelectorAll(selector);
// // // // // //         for (const el of elements) {
// // // // // //           if (clickButton(el)) {
// // // // // //             return { success: true, alreadyLiked: false };
// // // // // //           }
// // // // // //         }
// // // // // //       }

// // // // // //       return { success: false, alreadyLiked: encounteredLiked };
// // // // // //     }, postIndex);

// // // // // //     if (likeResult.success) {
// // // // // //       logSuccess("✅ Liked post");
// // // // // //       await handleNotificationPopup(page);
// // // // // //       return true;
// // // // // //     } else if (likeResult.alreadyLiked) {
// // // // // //       logInfo("⚠️ Post already liked");
// // // // // //       return false;
// // // // // //     } else {
// // // // // //       logInfo("⚠️ Like button not found");
// // // // // //       return false;
// // // // // //     }
// // // // // //   } catch (error) {
// // // // // //     logError(`❌ Error liking post: ${error.message}`);
// // // // // //     return false;
// // // // // //   }
// // // // // // }

// // // // // // async function postCommentToThreads(page, commentText, postIndex) {
// // // // // //   try {
// // // // // //     await sleep(randomDelay(2000, 3000));

// // // // // //     const replyButtonClicked = await page.evaluate((idx) => {
// // // // // //       const allContainers = document.querySelectorAll('div[data-pressable-container="true"]');
// // // // // //       if (idx >= allContainers.length) return false;
      
// // // // // //       const targetContainer = allContainers[idx];
      
// // // // // //       // Search for Reply button ONLY in the target container
// // // // // //       const buttons = targetContainer.querySelectorAll('div[role="button"]');
// // // // // //       for (const btn of buttons) {
// // // // // //         const svg = btn.querySelector('svg[aria-label="Reply"]');
// // // // // //         if (svg) {
// // // // // //           btn.click();
// // // // // //           return true;
// // // // // //         }
// // // // // //       }
// // // // // //       return false;
// // // // // //     }, postIndex);

// // // // // //     if (!replyButtonClicked) {
// // // // // //       logInfo("⚠️ Reply button not found");
// // // // // //       return false;
// // // // // //     }

// // // // // //     await sleep(randomDelay(2000, 3000));

// // // // // //     const commentInput = await page.waitForSelector('div[contenteditable="true"]', {
// // // // // //       timeout: 10000,
// // // // // //     });

// // // // // //     if (!commentInput) {
// // // // // //       logError("❌ Comment input not found");
// // // // // //       return false;
// // // // // //     }

// // // // // //     await commentInput.click();
// // // // // //     await sleep(500);
// // // // // //     await commentInput.type(commentText, { delay: randomDelay(100, 200) });
// // // // // //     await sleep(randomDelay(2000, 3000));

// // // // // //     // Submit via keyboard
// // // // // //     await page.keyboard.down("Control");
// // // // // //     await page.keyboard.press("Enter");
// // // // // //     await page.keyboard.up("Control");
// // // // // //     await sleep(2000);

// // // // // //     logSuccess("✅ Comment posted");
// // // // // //     await handleNotificationPopup(page);
// // // // // //     return true;
// // // // // //   } catch (error) {
// // // // // //     logError(`❌ Comment posting error: ${error.message}`);
// // // // // //     return false;
// // // // // //   }
// // // // // // }

// // // // // // /**
// // // // // //  * ✅ NEW: Click on post to open detail view
// // // // // //  */
// // // // // // async function openPostDetailView(page, postLink) {
// // // // // //   try {
// // // // // //     if (!postLink) {
// // // // // //       logError('❌ No post link available');
// // // // // //       return false;
// // // // // //     }

// // // // // //     logInfo('🔗 Opening post detail view...');
// // // // // //     const fullUrl = postLink.startsWith('http') ? postLink : `https://www.threads.net${postLink}`;
    
// // // // // //     await page.goto(fullUrl, {
// // // // // //       waitUntil: 'networkidle2',
// // // // // //       timeout: 30000,
// // // // // //     });

// // // // // //     await sleep(randomDelay(2000, 3000));
    
// // // // // //     // Wait for comments to load
// // // // // //     await page.waitForSelector('div[data-pressable-container="true"]', {
// // // // // //       timeout: 10000,
// // // // // //     }).catch(() => logInfo('⚠️ Timeout waiting for comments'));

// // // // // //     logSuccess('✅ Post detail view opened');
// // // // // //     return true;
// // // // // //   } catch (error) {
// // // // // //     logError(`❌ Error opening post: ${error.message}`);
// // // // // //     return false;
// // // // // //   }
// // // // // // }

// // // // // // /**
// // // // // //  * ✅ UPDATED: Extract comments from post detail view
// // // // // //  */
// // // // // // async function extractCommentsFromPostDetail(page) {
// // // // // //   try {
// // // // // //     const comments = await page.evaluate(() => {
// // // // // //       const commentContainers = document.querySelectorAll('div[data-pressable-container="true"]');
// // // // // //       const extractedComments = [];

// // // // // //       // Start from index 1 to skip the main post (index 0)
// // // // // //       for (let i = 1; i < Math.min(commentContainers.length, 6); i++) {
// // // // // //         const container = commentContainers[i];

// // // // // //         const authorLink = container.querySelector('a[href^="/@"]');
// // // // // //         const author = authorLink ? authorLink.getAttribute('href').replace('/@', '').split('/')[0] : "";

// // // // // //         const textSpans = container.querySelectorAll('span');
// // // // // //         let commentText = "";
// // // // // //         for (const span of textSpans) {
// // // // // //           const text = span.textContent.trim();
// // // // // //           if (text.length > 10 && text.length < 200 && !text.includes('ago')) {
// // // // // //             commentText = text;
// // // // // //             break;
// // // // // //           }
// // // // // //         }

// // // // // //         if (author && commentText) {
// // // // // //           extractedComments.push({ author, text: commentText, index: i });
// // // // // //         }
// // // // // //       }

// // // // // //       return extractedComments;
// // // // // //     });

// // // // // //     logInfo(`📝 Found ${comments.length} comments in post detail`);
// // // // // //     return comments;
// // // // // //   } catch (error) {
// // // // // //     logError(`❌ Error extracting comments from detail: ${error.message}`);
// // // // // //     return [];
// // // // // //   }
// // // // // // }

// // // // // // /**
// // // // // //  * ✅ UPDATED: Reply to specific comment in post detail view
// // // // // //  */
// // // // // // async function replyToComment(page, replyText, commentIndex) {
// // // // // //   try {
// // // // // //     await sleep(randomDelay(2000, 3000));

// // // // // //     // Click reply button on the specific comment container
// // // // // //     const replyButtonClicked = await page.evaluate((idx) => {
// // // // // //       const commentContainers = document.querySelectorAll('div[data-pressable-container="true"]');
// // // // // //       if (idx >= commentContainers.length) return false;
      
// // // // // //       const targetContainer = commentContainers[idx];
      
// // // // // //       // Find reply button using the specific selector structure
// // // // // //       const replyButtons = targetContainer.querySelectorAll('div[role="button"]');
// // // // // //       for (const btn of replyButtons) {
// // // // // //         const svg = btn.querySelector('svg[aria-label="Reply"]');
// // // // // //         if (svg) {
// // // // // //           // Scroll into view first
// // // // // //           targetContainer.scrollIntoView({ block: 'center', behavior: 'smooth' });
// // // // // //           btn.click();
// // // // // //           return true;
// // // // // //         }
// // // // // //       }
// // // // // //       return false;
// // // // // //     }, commentIndex);

// // // // // //     if (!replyButtonClicked) {
// // // // // //       logInfo("⚠️ Reply button not found");
// // // // // //       return false;
// // // // // //     }

// // // // // //     await sleep(randomDelay(2000, 3000));

// // // // // //     const replyInput = await page.waitForSelector('div[contenteditable="true"]', {
// // // // // //       timeout: 10000,
// // // // // //     });

// // // // // //     if (!replyInput) {
// // // // // //       logError("❌ Reply input not found");
// // // // // //       return false;
// // // // // //     }

// // // // // //     await replyInput.click();
// // // // // //     await sleep(500);
// // // // // //     await replyInput.type(replyText, { delay: randomDelay(100, 200) });
// // // // // //     await sleep(randomDelay(2000, 3000));

// // // // // //     // Submit via keyboard
// // // // // //     await page.keyboard.down("Control");
// // // // // //     await page.keyboard.press("Enter");
// // // // // //     await page.keyboard.up("Control");
// // // // // //     await sleep(2000);

// // // // // //     logSuccess("✅ Reply posted");
// // // // // //     await handleNotificationPopup(page);
// // // // // //     return true;
// // // // // //   } catch (error) {
// // // // // //     logError(`❌ Reply posting error: ${error.message}`);
// // // // // //     return false;
// // // // // //   }
// // // // // // }

// // // // // // // ============================================================================
// // // // // // // EXTRACTION FUNCTIONS - ✅ WITH UNIQUE ID TRACKING
// // // // // // // ============================================================================

// // // // // // async function extractPostsFromPage(page) {
// // // // // //   try {
// // // // // //     await page.waitForSelector('div[data-pressable-container="true"]', {
// // // // // //       timeout: 10000
// // // // // //     }).catch(() => logInfo('⚠️ Timeout waiting for posts'));

// // // // // //     await sleep(1000);

// // // // // //     const posts = await page.evaluate(() => {
// // // // // //       const containers = document.querySelectorAll('div[data-pressable-container="true"]');
// // // // // //       const extractedPosts = [];

// // // // // //       if (containers.length === 0) {
// // // // // //         console.log('No containers found');
// // // // // //         return [];
// // // // // //       }

// // // // // //       for (let idx = 0; idx < containers.length; idx++) {
// // // // // //         const container = containers[idx];

// // // // // //         // Extract profile link and username
// // // // // //         const profileLink = container.querySelector('a[role="link"]');
// // // // // //         const username = profileLink ? profileLink.textContent.trim() : "";

// // // // // //         // Extract post content
// // // // // //         const contentSpans = container.querySelectorAll('span');
// // // // // //         let postContent = "";
// // // // // //         for (const span of contentSpans) {
// // // // // //           const text = span.textContent.trim();
// // // // // //           if (text.length > 20 && text.length < 500) {
// // // // // //             postContent = text;
// // // // // //             break;
// // // // // //           }
// // // // // //         }

// // // // // //         // Extract post link (use as unique ID)
// // // // // //         const postLinks = container.querySelectorAll('a[href*="/post/"]');
// // // // // //         const postLink = postLinks.length > 0 ? postLinks[0].getAttribute('href') : "";

// // // // // //         // Create unique ID from postLink or combination of username + content
// // // // // //         let uniqueId = postLink || `${username}_${postContent.substring(0, 50)}`;

// // // // // //         // Only include posts with valid data
// // // // // //         if (username && (postContent || postLink)) {
// // // // // //           extractedPosts.push({
// // // // // //             uniqueId,
// // // // // //             username,
// // // // // //             postContent,
// // // // // //             postLink,
// // // // // //             index: idx
// // // // // //           });
// // // // // //         }
// // // // // //       }

// // // // // //       return extractedPosts;
// // // // // //     });

// // // // // //     return posts;
// // // // // //   } catch (error) {
// // // // // //     logError(`❌ Error extracting posts: ${error.message}`);
// // // // // //     return [];
// // // // // //   }
// // // // // // }

// // // // // // async function extractPostComments(page) {
// // // // // //   try {
// // // // // //     const comments = await page.evaluate(() => {
// // // // // //       const commentContainers = document.querySelectorAll('div[data-pressable-container="true"]');
// // // // // //       const extractedComments = [];

// // // // // //       for (let i = 1; i < Math.min(commentContainers.length, 6); i++) {
// // // // // //         const container = commentContainers[i];

// // // // // //         const authorLink = container.querySelector('a[href^="/@"]');
// // // // // //         const author = authorLink ? authorLink.getAttribute('href').replace('/@', '').split('/')[0] : "";

// // // // // //         const textSpans = container.querySelectorAll('span');
// // // // // //         let commentText = "";
// // // // // //         for (const span of textSpans) {
// // // // // //           const text = span.textContent.trim();
// // // // // //           if (text.length > 10 && text.length < 200 && !text.includes('ago')) {
// // // // // //             commentText = text;
// // // // // //             break;
// // // // // //           }
// // // // // //         }

// // // // // //         if (author && commentText) {
// // // // // //           extractedComments.push({ author, text: commentText });
// // // // // //         }
// // // // // //       }

// // // // // //       return extractedComments;
// // // // // //     });

// // // // // //     return comments;
// // // // // //   } catch (error) {
// // // // // //     logError(`❌ Error extracting comments: ${error.message}`);
// // // // // //     return [];
// // // // // //   }
// // // // // // }

// // // // // // // ✅ Smart scroll function
// // // // // // async function performSmartScroll(page) {
// // // // // //   try {
// // // // // //     const scrollResult = await page.evaluate(() => {
// // // // // //       const beforeScroll = window.scrollY;
// // // // // //       const documentHeight = document.documentElement.scrollHeight;
// // // // // //       const viewportHeight = window.innerHeight;
// // // // // //       const currentBottom = beforeScroll + viewportHeight;

// // // // // //       const spaceLeft = documentHeight - currentBottom;
// // // // // //       const nearBottom = spaceLeft < 500;

// // // // // //       // Scroll by 60-80% of viewport height
// // // // // //       const scrollAmount = Math.floor(viewportHeight * (0.6 + Math.random() * 0.2));

// // // // // //       window.scrollBy({
// // // // // //         top: scrollAmount,
// // // // // //         behavior: 'smooth'
// // // // // //       });

// // // // // //       return {
// // // // // //         beforeScroll,
// // // // // //         scrollAmount,
// // // // // //         spaceLeft,
// // // // // //         nearBottom,
// // // // // //         documentHeight,
// // // // // //         viewportHeight
// // // // // //       };
// // // // // //     });

// // // // // //     logInfo(`📜 Scrolled ${scrollResult.scrollAmount}px | Space left: ${scrollResult.spaceLeft}px`);

// // // // // //     await sleep(randomDelay(1500, 2500));

// // // // // //     // Wait longer if near bottom for new content to load
// // // // // //     if (scrollResult.nearBottom) {
// // // // // //       logInfo('⏳ Near bottom, waiting for new content...');
// // // // // //       await sleep(randomDelay(2000, 3000));
// // // // // //     }

// // // // // //     return scrollResult;
// // // // // //   } catch (error) {
// // // // // //     logError(`❌ Error during scroll: ${error.message}`);
// // // // // //     return null;
// // // // // //   }
// // // // // // }

// // // // // // // ============================================================================
// // // // // // // MAIN BOT LOGIC - ✅ FIXED: Proper post tracking with Set
// // // // // // // ============================================================================

// // // // // // async function interactWithPosts(page, config, stats, processedPostIds, sessionId) {
// // // // // //   try {
// // // // // //     // Extract ALL current posts on page
// // // // // //     const allPosts = await extractPostsFromPage(page);

// // // // // //     if (allPosts.length === 0) {
// // // // // //       logInfo('⚠️ No posts found, scrolling...');
// // // // // //       await performSmartScroll(page);
// // // // // //       return { stats, shouldContinue: true, foundNewPost: false };
// // // // // //     }

// // // // // //     // Find first unprocessed post
// // // // // //     let targetPost = null;
// // // // // //     for (const post of allPosts) {
// // // // // //       if (!processedPostIds.has(post.uniqueId)) {
// // // // // //         targetPost = post;
// // // // // //         break;
// // // // // //       }
// // // // // //     }

// // // // // //     // If all visible posts are processed, scroll for more
// // // // // //     if (!targetPost) {
// // // // // //       logInfo('✅ All visible posts processed, scrolling for more...');
// // // // // //       await performSmartScroll(page);
// // // // // //       return { stats, shouldContinue: true, foundNewPost: false };
// // // // // //     }

// // // // // //     // Mark this post as processed
// // // // // //     processedPostIds.add(targetPost.uniqueId);

// // // // // //     logInfo(`📌 Post by @${targetPost.username}: ${targetPost.postContent?.substring(0, 50)}...`);

// // // // // //     // Scroll the post into view
// // // // // //     await page.evaluate((idx) => {
// // // // // //       const containers = document.querySelectorAll('div[data-pressable-container="true"]');
// // // // // //       if (containers[idx]) {
// // // // // //         containers[idx].scrollIntoView({ block: 'center', behavior: 'smooth' });
// // // // // //       }
// // // // // //     }, targetPost.index);

// // // // // //     await sleep(randomDelay(1000, 2000));

// // // // // //     // 1. Like post
// // // // // //     const likeRoll = Math.random();
// // // // // //     logInfo(`🎲 Like roll: ${(likeRoll * 100).toFixed(1)}% vs ${(config.likeProbability * 100).toFixed(1)}%`);
// // // // // //     if (likeRoll < config.likeProbability) {
// // // // // //       logInfo(`👍 Attempting to like @${targetPost.username}'s post...`);
      
// // // // // //       // ✅ Re-find post index to ensure accuracy
// // // // // //       const currentIndex = await findPostIndexByLink(page, targetPost.postLink);
// // // // // //       if (currentIndex === -1) {
// // // // // //         logError('❌ Could not locate post for liking');
// // // // // //       } else {
// // // // // //         const liked = await likePost(page, currentIndex);
// // // // // //         if (liked) {
// // // // // //           stats.likes++;
// // // // // //           logSuccess(`✅ Liked @${targetPost.username}'s post`);
// // // // // //           await logStructured(createLogEntry({
// // // // // //             actionType: "LIKE",
// // // // // //             author: targetPost.username,
// // // // // //             postContent: targetPost.postContent,
// // // // // //             status: "SUCCESS"
// // // // // //           }), "automation.json");
          
// // // // // //           // Log to CSV
// // // // // //           await logToCSV('LIKE', 'SUCCESS', {
// // // // // //             postAuthor: targetPost.username,
// // // // // //             postContent: targetPost.postContent,
// // // // // //             postLink: targetPost.postLink
// // // // // //           }, sessionId);
// // // // // //         }
// // // // // //       }
// // // // // //     } else {
// // // // // //       logInfo('⏭️ Skipped like (probability)');
// // // // // //     }

// // // // // //     // 2. Comment on post
// // // // // //     const commentRoll = Math.random();
// // // // // //     logInfo(`🎲 Comment roll: ${(commentRoll * 100).toFixed(1)}% vs ${(config.commentProbability * 100).toFixed(1)}%`);
// // // // // //     if (commentRoll < config.commentProbability) {
// // // // // //       logInfo(`💬 Attempting to comment on @${targetPost.username}'s post...`);
// // // // // //       const comment = await generateAIComment(targetPost.postContent || '');
// // // // // //       if (comment) {
// // // // // //         logInfo(`💬 Generated comment: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"}`);
        
// // // // // //         // ✅ Re-find post index to ensure accuracy
// // // // // //         const currentIndex = await findPostIndexByLink(page, targetPost.postLink);
// // // // // //         if (currentIndex === -1) {
// // // // // //           logError('❌ Could not locate post for commenting');
// // // // // //         } else {
// // // // // //           const commented = await postCommentToThreads(page, comment, currentIndex);
// // // // // //           if (commented) {
// // // // // //             stats.comments++;
// // // // // //             logSuccess(`✅ Commented on @${targetPost.username}'s post: "${comment}"`);
// // // // // //             await logStructured(createLogEntry({
// // // // // //               actionType: "COMMENT",
// // // // // //               author: targetPost.username,
// // // // // //               postContent: targetPost.postContent,
// // // // // //               generatedText: comment,
// // // // // //               status: "SUCCESS"
// // // // // //             }), "automation.json");
            
// // // // // //             // Log to CSV
// // // // // //             await logToCSV('COMMENT', 'SUCCESS', {
// // // // // //               postAuthor: targetPost.username,
// // // // // //               postContent: targetPost.postContent,
// // // // // //               commentText: comment,
// // // // // //               postLink: targetPost.postLink
// // // // // //             }, sessionId);
// // // // // //           } else {
// // // // // //             // Log failed comment to CSV
// // // // // //             await logToCSV('COMMENT', 'FAILED', {
// // // // // //               postAuthor: targetPost.username,
// // // // // //               postContent: targetPost.postContent,
// // // // // //               commentText: comment,
// // // // // //               postLink: targetPost.postLink,
// // // // // //               errorMessage: 'Reply button not found'
// // // // // //             }, sessionId);
// // // // // //           }
// // // // // //         }
// // // // // //       }
// // // // // //     } else {
// // // // // //       logInfo('⏭️ Skipped comment (probability)');
// // // // // //     }

// // // // // //     // 3. Reply to comment (open post detail first)
// // // // // //     const replyRoll = Math.random();
// // // // // //     logInfo(`🎲 Reply roll: ${(replyRoll * 100).toFixed(1)}% vs ${(config.replyProbability * 100).toFixed(1)}%`);
// // // // // //     if (replyRoll < config.replyProbability) {
// // // // // //       logInfo(`💭 Attempting to reply to comment on @${targetPost.username}'s post...`);
      
// // // // // //       // ✅ NEW: Open post detail view first
// // // // // //       const postOpened = await openPostDetailView(page, targetPost.postLink);
// // // // // //       if (postOpened) {
// // // // // //         const comments = await extractCommentsFromPostDetail(page);
// // // // // //         if (comments.length > 0) {
// // // // // //           const targetComment = comments[0];
// // // // // //           logInfo(`💭 Found comment by @${targetComment.author}: "${targetComment.text.substring(0, 40)}..."`);
// // // // // //           const reply = await generateAIReply(
// // // // // //             targetComment.author, 
// // // // // //             targetComment.text,
// // // // // //             targetPost.postContent || ''
// // // // // //           );
// // // // // //           if (reply) {
// // // // // //             logInfo(`💭 Generated reply: "${reply.substring(0, 50)}${reply.length > 50 ? '...' : ''}"}`);
// // // // // //             const replied = await replyToComment(page, reply, targetComment.index);
// // // // // //             if (replied) {
// // // // // //               stats.replies++;
// // // // // //               logSuccess(`✅ Replied to @${targetComment.author} on @${targetPost.username}'s post: "${reply}"`);
// // // // // //               await logStructured(createLogEntry({
// // // // // //                 actionType: "REPLY",
// // // // // //                 author: targetComment.author,
// // // // // //                 commentText: targetComment.text,
// // // // // //                 generatedText: reply,
// // // // // //                 status: "SUCCESS"
// // // // // //               }), "automation.json");
              
// // // // // //               // Log to CSV
// // // // // //               await logToCSV('REPLY', 'SUCCESS', {
// // // // // //                 replyAuthor: targetComment.author,
// // // // // //                 postAuthor: targetPost.username,
// // // // // //                 postContent: targetPost.postContent,
// // // // // //                 commentText: reply,
// // // // // //                 postLink: targetPost.postLink
// // // // // //               }, sessionId);
// // // // // //             }
// // // // // //           }
// // // // // //         } else {
// // // // // //           logInfo(`⚠️ No comments found on @${targetPost.username}'s post`);
// // // // // //         }
        
// // // // // //         // ✅ NEW: Navigate back to home feed
// // // // // //         logInfo('🏠 Navigating back to home feed...');
        
// // // // // //         // Set up dialog handler BEFORE navigation to catch "Changes you made may not be saved"
// // // // // //         const dialogHandler = async (dialog) => {
// // // // // //           logInfo(`⚠️ Dialog detected: "${dialog.message()}"`);
// // // // // //           if (dialog.message().includes('Changes you made') || 
// // // // // //               dialog.message().includes('may not be saved') ||
// // // // // //               dialog.message().includes('leave this page')) {
// // // // // //             logInfo('✅ Accepting unsaved changes dialog...');
// // // // // //             await dialog.accept();
// // // // // //           } else {
// // // // // //             await dialog.accept();
// // // // // //           }
// // // // // //         };
        
// // // // // //         page.once('dialog', dialogHandler);
        
// // // // // //         // Also try to dismiss any visible popups before navigation
// // // // // //         try {
// // // // // //           await page.evaluate(() => {
// // // // // //             // Press Escape key to close any modals
// // // // // //             document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
// // // // // //           });
// // // // // //           await sleep(500);
// // // // // //         } catch (e) {
// // // // // //           // Ignore
// // // // // //         }
        
// // // // // //         try {
// // // // // //           await page.goto('https://www.threads.net/', {
// // // // // //             waitUntil: 'networkidle2',
// // // // // //             timeout: 30000,
// // // // // //           });
// // // // // //         } catch (navError) {
// // // // // //           logError(`⚠️ Navigation error: ${navError.message}`);
// // // // // //           // Try pressing Ctrl+Enter to dismiss any blocking popup
// // // // // //           await page.keyboard.down('Control');
// // // // // //           await page.keyboard.press('Enter');
// // // // // //           await page.keyboard.up('Control');
// // // // // //           await sleep(1000);
          
// // // // // //           // Try navigation again
// // // // // //           try {
// // // // // //             await page.goto('https://www.threads.net/', {
// // // // // //               waitUntil: 'networkidle2',
// // // // // //               timeout: 30000,
// // // // // //             });
// // // // // //           } catch (retryError) {
// // // // // //             logError(`❌ Retry navigation failed: ${retryError.message}`);
// // // // // //           }
// // // // // //         }
        
// // // // // //         await sleep(2000);
        
// // // // // //         // Check for any remaining popups after navigation
// // // // // //         await handleNotificationPopup(page);
// // // // // //       } else {
// // // // // //         logInfo('⚠️ Could not open post detail view');
// // // // // //       }
// // // // // //     } else {
// // // // // //       logInfo('⏭️ Skipped reply (probability)');
// // // // // //     }

// // // // // //     stats.postsProcessed++;

// // // // // //     // 4. Scroll after processing
// // // // // //     await performSmartScroll(page);

// // // // // //     return { stats, shouldContinue: true, foundNewPost: true };
// // // // // //   } catch (error) {
// // // // // //     logError(`❌ Error in interactWithPosts: ${error.message}`);
// // // // // //     return { stats, shouldContinue: false, foundNewPost: false };
// // // // // //   }
// // // // // // }

// // // // // // /**
// // // // // //  * ✅ FIXED: Main automation with proper duplicate prevention
// // // // // //  */
// // // // // // export async function automatedThreadsPostCreation(settings = {}) {
// // // // // //   const username = process.env.THREADS_USERNAME || settings.username;
// // // // // //   const password = process.env.THREADS_PASSWORD || settings.password;

// // // // // //   if (!username || !password) {
// // // // // //     throw new Error('Username and password are required');
// // // // // //   }

// // // // // //   logInfo('🤖 Starting Threads automation...');
// // // // // //   logInfo(`⚙️ Settings: ${JSON.stringify(settings)}`);

// // // // // //   const config = {
// // // // // //     likeProbability: settings.like_percentage || 0.5,
// // // // // //     commentProbability: settings.comment_percentage || 0.3,
// // // // // //     replyProbability: settings.reply_percentage || 0.2,
// // // // // //     postsToProcess: settings.posts_to_process || 10,
// // // // // //   };

// // // // // //   const stats = {
// // // // // //     postsProcessed: 0,
// // // // // //     likes: 0,
// // // // // //     comments: 0,
// // // // // //     replies: 0,
// // // // // //   };

// // // // // //   // Generate unique session ID for this automation run
// // // // // //   const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
// // // // // //   logInfo(`🆔 Session ID: ${sessionId}`);

// // // // // //   let browser = null;

// // // // // //   try {
// // // // // //     const { browser: browserInstance, page } = await initializeBotWithSession({
// // // // // //       username,
// // // // // //       password,
// // // // // //       botType: 'automation',
// // // // // //       headless: false,
// // // // // //       chromePath: process.env.CHROME_PATH || null,
// // // // // //     });

// // // // // //     browser = browserInstance;

// // // // // //     logSuccess('✅ Bot initialized successfully');

// // // // // //     // Navigate to home feed once
// // // // // //     logInfo('🏠 Navigating to Threads home feed...');
// // // // // //     await page.goto('https://www.threads.net/', {
// // // // // //       waitUntil: 'networkidle2',
// // // // // //       timeout: 30000,
// // // // // //     });

// // // // // //     await sleep(5000);

// // // // // //     // Initial scroll to trigger feed loading
// // // // // //     await page.evaluate(() => window.scrollBy(0, 200));
// // // // // //     await sleep(2000);

// // // // // //     // Wait for posts to appear
// // // // // //     let postFound = false;
// // // // // //     let retries = 3;

// // // // // //     while (!postFound && retries > 0) {
// // // // // //       const hasPost = await page.evaluate(() => {
// // // // // //         return document.querySelectorAll('[data-pressable-container="true"]').length > 0;
// // // // // //       });

// // // // // //       if (hasPost) {
// // // // // //         postFound = true;
// // // // // //         break;
// // // // // //       }

// // // // // //       retries--;
// // // // // //       if (retries > 0) {
// // // // // //         logInfo('⏳ Waiting for posts to load...');
// // // // // //         await sleep(2000);
// // // // // //         await page.evaluate(() => window.scrollBy(0, 100));
// // // // // //       }
// // // // // //     }

// // // // // //     if (!postFound) {
// // // // // //       throw new Error('No posts found after initial load');
// // // // // //     }

// // // // // //     logSuccess('✅ Feed loaded successfully');
// // // // // //     logInfo(`🎯 Target: ${config.postsToProcess} posts`);

// // // // // //     // ✅ Use Set to track processed post IDs (prevents duplicates)
// // // // // //     const processedPostIds = new Set();
// // // // // //     let consecutiveNoNewPosts = 0;

// // // // // //     while (stats.postsProcessed < config.postsToProcess) {
// // // // // //       const result = await interactWithPosts(page, config, stats, processedPostIds, sessionId);

// // // // // //       // Update stats
// // // // // //       stats.likes = result.stats.likes;
// // // // // //       stats.comments = result.stats.comments;
// // // // // //       stats.replies = result.stats.replies;
// // // // // //       stats.postsProcessed = result.stats.postsProcessed;

// // // // // //       if (!result.shouldContinue) {
// // // // // //         logInfo('⚠️ Stopping due to error');
// // // // // //         break;
// // // // // //       }

// // // // // //       // Check if we found a new post
// // // // // //       if (result.foundNewPost) {
// // // // // //         consecutiveNoNewPosts = 0;
// // // // // //       } else {
// // // // // //         consecutiveNoNewPosts++;
// // // // // //       }

// // // // // //       // If we haven't found new posts after 5 attempts, might be at end of feed
// // // // // //       if (consecutiveNoNewPosts >= 5) {
// // // // // //         logInfo('⚠️ No new posts found after multiple scrolls, ending automation');
// // // // // //         break;
// // // // // //       }

// // // // // //       logInfo(`📊 Progress: ${stats.postsProcessed}/${config.postsToProcess} posts | ❤️ ${stats.likes} | 💬 ${stats.comments} | 💭 ${stats.replies}`);

// // // // // //       // Random delay between posts
// // // // // //       await sleep(randomDelay(3000, 6000));
// // // // // //     }

// // // // // //     logSuccess(`✅ Automation completed!`);
// // // // // //     logSuccess(`📊 Final Stats: ${stats.postsProcessed} posts, ${stats.likes} likes, ${stats.comments} comments, ${stats.replies} replies`);

// // // // // //     await logStructured(createLogEntry({
// // // // // //       actionType: "AUTOMATION_COMPLETE",
// // // // // //       stats: stats,
// // // // // //       status: "SUCCESS"
// // // // // //     }), "automation.json");
    
// // // // // //     // Log automation completion to CSV
// // // // // //     await logToCSV('AUTOMATION_COMPLETE', 'SUCCESS', {
// // // // // //       postAuthor: username,
// // // // // //       postContent: `Processed ${stats.postsProcessed} posts`,
// // // // // //       commentText: `Likes: ${stats.likes}, Comments: ${stats.comments}, Replies: ${stats.replies}`
// // // // // //     }, sessionId);

// // // // // //     await closeBotGracefully(browser, username);

// // // // // //     return {
// // // // // //       success: true,
// // // // // //       stats,
// // // // // //     };
// // // // // //   } catch (error) {
// // // // // //     await handleBotError(browser, error, username);
// // // // // //     return {
// // // // // //       success: false,
// // // // // //       error: error.message,
// // // // // //       stats,
// // // // // //     };
// // // // // //   }
// // // // // // }

// // // // // // /**
// // // // // //  * ✅ Wrapper for backward compatibility
// // // // // //  */
// // // // // // export async function runFullAutomation(settings = {}) {
// // // // // //   logInfo('🚀 Preparing full automation workflow...');
// // // // // //   return await automatedThreadsPostCreation(settings);
// // // // // // }

// // // // // // export default automatedThreadsPostCreation;










// ============================================================================
// FIXED notification.js - Complete Updated Code
// ============================================================================

// import fs from "fs";
// import axios from "axios";
// import dotenv from "dotenv";
// import { initializeBotWithSession, closeBotGracefully, handleBotError } from "../helpers/botBootstrap.js";
// import { sleep, randomDelay, logInfo, logSuccess, logError } from "../utils/logger.js";
// import { logPostToCSV } from "../utils/csvLogger.js";

// dotenv.config();

// function logToNotificationFile(message) {
//   const timestamp = new Date().toLocaleString();
//   const logMessage = `[${timestamp}] ${message}\n`;
//   try {
//     fs.appendFileSync("threads_notification_log.txt", logMessage, "utf8");
//     console.log(message);
//   } catch (error) {
//     console.error("Error writing to notification log:", error.message);
//   }
// }

// // Parse time string and check if it's under 12 hours
// function isUnder12Hours(timeString) {
//   if (!timeString) return false;
//   const match = timeString.match(/(\d+)([mhd])/);
//   if (!match) return false;
//   const [, value, unit] = match;
//   const num = parseInt(value);
//   if (unit === "m") return true;
//   if (unit === "h") return num < 12;
//   if (unit === "d") return false;
//   return false;
// }

// /**
//  * ✅ FIXED: Verify we're on notifications page BEFORE extracting
//  */
// async function verifyNotificationsPageLoaded(page) {
//   try {
//     logToNotificationFile("🔍 Verifying notification page is fully loaded...");
    
//     // Wait for notification column to appear
//     logToNotificationFile("⏳ Waiting for notification column...");
//     await page.waitForSelector('div[aria-label="Column body"][role="region"]', { 
//       timeout: 20000 
//     }).catch(() => {
//       logToNotificationFile("⚠️ Column body not found");
//       return false;
//     });
    
//     await sleep(2000);
    
//     // Verify page elements
//     const pageCheck = await page.evaluate(() => {
//       const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
//       const hasNotificationText = document.body.innerText.includes('Notifications') || 
//                                   document.body.innerText.includes('Activity');
      
//       // Check for FEED indicators (these mean we're NOT on notifications)
//       const feedIndicators = document.querySelector('div[aria-label="Feed"]') ||
//                             document.querySelector('button[aria-label="Create a post"]') ||
//                             document.querySelector('textarea[placeholder*="Start a thread"]');
      
//       // Check for notification-specific elements
//       const notificationIndicators = document.querySelector('svg[aria-label="Notifications"]')?.closest('a')?.getAttribute('aria-current') === 'page';
      
//       return {
//         hasColumnBody: !!columnBody,
//         hasNotificationText,
//         isFeed: !!feedIndicators,
//         isNotificationActive: notificationIndicators,
//         url: window.location.href,
//         bodyPreview: document.body.innerText.substring(0, 300)
//       };
//     });
    
//     logToNotificationFile(`  - Current URL: ${pageCheck.url}`);
//     logToNotificationFile(`  - Has Column Body: ${pageCheck.hasColumnBody}`);
//     logToNotificationFile(`  - Has Notification Text: ${pageCheck.hasNotificationText}`);
//     logToNotificationFile(`  - Is Feed Page: ${pageCheck.isFeed}`);
//     logToNotificationFile(`  - Notification Tab Active: ${pageCheck.isNotificationActive}`);
    
//     // CRITICAL: If we detect feed indicators, we're NOT on notifications
//     if (pageCheck.isFeed) {
//       logToNotificationFile(`❌ ERROR: Still on FEED page, not notifications!`);
//       logToNotificationFile(`📄 Page preview: ${pageCheck.bodyPreview}`);
//       return false;
//     }
    
//     // Must have column body AND be on notifications URL
//     const urlCheck = pageCheck.url.includes('/notifications') || pageCheck.url.includes('/activity');
//     if (!pageCheck.hasColumnBody || !urlCheck) {
//       logToNotificationFile(`❌ ERROR: Not on valid notifications page`);
//       return false;
//     }
    
//     logToNotificationFile(`✅ Confirmed on notifications page with column loaded`);
//     return true;
    
//   } catch (error) {
//     logToNotificationFile(`❌ Error verifying page: ${error.message}`);
//     return false;
//   }
// }

// /**
//  * ✅ FIXED: Navigate to notifications with proper verification
//  */
// async function navigateToNotifications(page) {
//   try {
//     logToNotificationFile("\n" + "─".repeat(80));
//     logToNotificationFile("🔔 Navigating to notifications page...");
    
//     // Step 1: Go to home first to ensure clean state
//     logToNotificationFile("🏠 Going to home page first...");
//     await page.goto("https://www.threads.net/", {
//       waitUntil: "domcontentloaded",
//       timeout: 30000,
//     });
//     await sleep(3000);

//     // Step 2: Try clicking notification icon
//     logToNotificationFile("🔍 Looking for notifications button...");
//     const notificationIconClicked = await page.evaluate(() => {
//       const notificationSvg = document.querySelector('svg[aria-label="Notifications"]');
//       if (notificationSvg) {
//         const clickableParent = notificationSvg.closest('div[class*="x6s0dn4"]') ||
//           notificationSvg.closest('a') ||
//           notificationSvg.closest('div[role="button"]') ||
//           notificationSvg.parentElement;
//         if (clickableParent) {
//           clickableParent.click();
//           return true;
//         }
//       }
//       return false;
//     }).catch(() => false);

//     if (notificationIconClicked) {
//       logToNotificationFile("✅ Notification icon clicked, waiting for page load...");
//       await Promise.race([
//         page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {
//           logToNotificationFile("⚠️ Navigation wait timed out, continuing...");
//         }),
//         sleep(15000)
//       ]);
//     } else {
//       logToNotificationFile("⚠️ Icon not found, navigating directly...");
//     }
    
//     await sleep(2000);

//     // Step 3: Force navigation if not on notifications
//     const currentUrl = page.url();
//     if (!currentUrl.includes('/notifications') && !currentUrl.includes('/activity')) {
//       logToNotificationFile(`📍 Not on notifications (${currentUrl}), forcing navigation...`);
//       await page.goto("https://www.threads.net/notifications", {
//         waitUntil: "domcontentloaded",
//         timeout: 30000,
//       });
//       await sleep(3000);
//     }

//     // Step 4: VERIFY page loaded correctly
//     const isVerified = await verifyNotificationsPageLoaded(page);
    
//     if (!isVerified) {
//       logToNotificationFile(`❌ FAILED: Could not load notifications page properly`);
      
//       // Debug: Take screenshot
//       try {
//         await page.screenshot({ path: 'debug-failed-navigation.png', fullPage: true });
//         logToNotificationFile(`📸 Debug screenshot saved to debug-failed-navigation.png`);
//       } catch (e) {
//         // Ignore screenshot errors
//       }
      
//       return false;
//     }

//     // Step 5: Scroll to load content
//     logToNotificationFile("📜 Scrolling to load notifications...");
//     await page.evaluate(() => {
//       const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
//       if (columnBody) {
//         columnBody.scrollTo(0, columnBody.scrollHeight / 2);
//       }
//     });
//     await sleep(2000);

//     logToNotificationFile("✅ Successfully navigated to notifications page");
//     return true;
    
//   } catch (error) {
//     logToNotificationFile(`❌ Navigation error: ${error.message}`);
//     return false;
//   }
// }

// /**
//  * Extract notifications from page
//  */
// async function extractNotificationsFromPage(page) {
//   try {
//     // Wait for the column body to appear
//     logToNotificationFile("⏳ Waiting for notification column to load...");
//     await page.waitForSelector('div[aria-label="Column body"][role="region"]', { timeout: 15000 });
//     await sleep(2000);

//     // Wait for loading spinner to disappear
//     logToNotificationFile("⏳ Waiting for loading spinner to disappear...");
//     await page.waitForFunction(() => {
//       const loadingSpinner = document.querySelector('div[aria-label="Loading..."][role="status"]');
//       return !loadingSpinner || loadingSpinner.offsetParent === null;
//     }, { timeout: 10000 }).catch(() => {
//       logToNotificationFile("⚠️ Loading spinner check timed out, continuing...");
//     });
//     await sleep(1000);

//     // Wait for actual notification content (look for profile pictures)
//     logToNotificationFile("⏳ Waiting for notification items to appear...");
//     await page.waitForFunction(() => {
//       const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
//       if (!columnBody) return false;
//       const profilePics = columnBody.querySelectorAll('img[alt*="profile picture"]');
//       return profilePics.length > 0;
//     }, { timeout: 15000 }).catch(() => {
//       logToNotificationFile("⚠️ No profile pictures found, page may be empty");
//     });
//     await sleep(1500);

//     // Scroll to load more notifications (do multiple small scrolls)
//     logToNotificationFile("📜 Scrolling to load more notifications...");
//     for (let i = 0; i < 5; i++) {
//       await page.evaluate(() => {
//         const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
//         if (columnBody) {
//           columnBody.scrollBy(0, 300);
//         }
//       });
//       await sleep(800);
//     }

//     // Scroll back to top
//     await page.evaluate(() => {
//       const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
//       if (columnBody) {
//         columnBody.scrollTo(0, 0);
//       }
//     });
//     await sleep(1500);

//     // Extract notifications
//     const notifications = await page.evaluate(() => {
//       try {
//         const extractedNotifications = [];

//         const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
//         if (!columnBody) {
//           console.log(`❌ Column body not found!`);
//           return [];
//         }

//         console.log(`✅ Found Column body`);

//         const gridRows = columnBody.querySelectorAll('div.xrvj5dj.xnr31nm.xcttayb.xrjixri');
//         console.log(`📦 Found ${gridRows.length} grid rows`);

//         let containers = [];
//         gridRows.forEach((gridRow, idx) => {
//           const contentArea = gridRow.querySelector('div.x1hvtcl2.x1q0q8m5.x1co6499.x1xdureb');
//           if (contentArea) {
//             const pressableContainer = contentArea.querySelector('div[data-pressable-container="true"]');
//             if (pressableContainer) {
//               const hasUsername = pressableContainer.querySelector('a[href^="/@"]');
//               const hasTime = pressableContainer.querySelector('time');
//               if (hasUsername && hasTime) {
//                 containers.push(pressableContainer);
//                 console.log(`  ✅ Row ${idx}: Found valid notification`);
//               }
//             }
//           }
//         });

//         console.log(`📦 Strategy 1 (grid rows): Found ${containers.length} notification containers`);

//         if (containers.length === 0) {
//           console.log(`⚠️ Strategy 1 failed, trying fallback...`);
//           const allPressable = columnBody.querySelectorAll('div[data-pressable-container="true"]');
//           console.log(`📦 Found ${allPressable.length} total pressable containers`);

//           allPressable.forEach((container, idx) => {
//             const hasUsername = container.querySelector('a[href^="/@"]');
//             const hasTime = container.querySelector('time');
//             if (hasUsername && hasTime) {
//               containers.push(container);
//               console.log(`  ✅ Container ${idx}: Valid notification`);
//             }
//           });

//           console.log(`📦 Strategy 2 (fallback): Found ${containers.length} notification containers`);
//         }

//         console.log(`📄 Processing ${containers.length} containers...`);

//         for (let index = 0; index < containers.length; index++) {
//           const container = containers[index];
//           try {
//             console.log(`\n📋 Container ${index + 1}:`);

//             const timeElement = container.querySelector('time') || container.querySelector('abbr[title]');
//             if (!timeElement) {
//               console.log(`  ⏭️ Skipped: No time element`);
//               continue;
//             }

//             let notificationText = "";
//             const textSpans = container.querySelectorAll('span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62');
//             if (textSpans.length > 0) {
//               notificationText = Array.from(textSpans).map(span => span.textContent).join(' ').trim();
//             }

//             if (!notificationText || notificationText.length < 5) {
//               const contentArea = container.querySelector('div.x1hvtcl2');
//               if (contentArea) {
//                 notificationText = contentArea.textContent.trim();
//               }
//             }

//             if (notificationText && typeof notificationText === 'string') {
//               console.log(`  📝 Text: "${notificationText.substring(0, 50)}..." (length: ${notificationText.length})`);
//             }

//             if (!notificationText || notificationText.length < 5) {
//               console.log(`  ⏭️ Skipped: Text too short`);
//               continue;
//             }

//             let timeText = "";
//             if (timeElement) {
//               const abbrElement = timeElement.querySelector('abbr');
//               timeText = abbrElement ? abbrElement.textContent.trim() : timeElement.textContent.trim();
//             }

//             console.log(`  ⏰ Time: "${timeText}"`);

//             if (!timeText) {
//               console.log(`  ⏭️ Skipped: No time`);
//               continue;
//             }

//             const replyButton = container.querySelector('svg[aria-label="Reply"]');
//             const hasReplyButton = !!replyButton;
            
//             const heartIcon = container.querySelector('svg path[d*="8.33956"]');
//             const hasReplyIcon = container.querySelector('svg path[d*="13.2177"]');
//             const hasFollowIcon = container.querySelector('svg path[d*="5.81283"]');

//             let notificationType = "unknown";
//             let detectionMethod = "";

//             if (heartIcon) {
//               notificationType = "like";
//               detectionMethod = "heart-icon";
//             } else if (hasReplyIcon || hasReplyButton) {
//               notificationType = "reply";
//               detectionMethod = "reply-icon";
//             } else if (hasFollowIcon) {
//               notificationType = "follow";
//               detectionMethod = "follow-icon";
//             }

//             console.log(`Notification type: ${notificationType} (detected via: ${detectionMethod})`);

//             const authorLinks = container.querySelectorAll('a[href^="/@"]');
//             let author = "";
//             if (authorLinks.length > 0) {
//               const href = authorLinks[0].getAttribute("href");
//               author = href ? href.replace("/@", "").split("/")[0] : "";
//             }

//             const postLinks = container.querySelectorAll('a[href*="/post/"]');
//             let postLink = "";
//             let postOwner = "";
//             if (postLinks.length > 0) {
//               postLink = postLinks[0].getAttribute("href");
//               if (postLink) {
//                 const match = postLink.match(/\/@([^\/]+)\/post\//);
//                 if (match) {
//                   postOwner = match[1];
//                 }
//               }
//             }

//             extractedNotifications.push({
//               text: notificationText,
//               time: timeText,
//               type: notificationType,
//               detectionMethod: detectionMethod,
//               author: author,
//               postLink: postLink,
//               postOwner: postOwner,
//               index: index,
//               hasReplyButton: hasReplyButton
//             });

//           } catch (innerError) {
//             console.error("Error extracting single notification:", innerError);
//             continue;
//           }
//         }

//         console.log(`✅ Returning ${extractedNotifications.length} notifications`);
//         return extractedNotifications;

//       } catch (evalError) {
//         console.error("❌ Error in page.evaluate:", evalError);
//         console.error("Error stack:", evalError.stack);
//         return [];
//       }
//     }).catch((error) => {
//       logToNotificationFile(`⚠️ Page evaluation failed: ${error.message}`);
//       return [];
//     });

//     // Safety check
//     if (!notifications || !Array.isArray(notifications)) {
//       logToNotificationFile(`⚠️ Notifications extraction returned invalid data (type: ${typeof notifications})`);
//       return [];
//     }

//     logToNotificationFile(`✅ Extracted ${notifications.length} notifications from page`);

//     return notifications;

//   } catch (error) {
//     logToNotificationFile(`❌ Error extracting notifications: ${error.message}`);
//     return [];
//   }
// }

// /**
//  * Generate AI reply using OpenRouter
//  */
// async function generateAIReply(notificationText, commentText = "") {
//   try {
//     const apikey = process.env.OPENROUTER_API_KEY || process.env.REACT_APP_OPENROUTER_API_KEY;
//     if (!apikey) {
//       throw new Error("API key not found");
//     }

//     const tones = ["friendly", "casual", "supportive", "curious", "thoughtful"];
//     const randomTone = tones[Math.floor(Math.random() * tones.length)];
//     const prompt = `You are replying to a notification on Threads. Adopt a ${randomTone} tone.
// Notification: "${notificationText}"
// ${commentText ? `Comment text: "${commentText}"` : ""}

// Write a natural, human-like REPLY (8-25 words) that:
// - Directly responds to the notification
// - Sounds conversational and authentic
// - Uses casual language
// - Feels like a real person's reaction
// - Can use 1-2 emojis max
// - Matches the ${randomTone} tone
// - IMPORTANT: Return ONLY the reply text, no quotes, no explanations

// Generate ONE authentic reply now:`;

//     const response = await axios.post(
//       "https://openrouter.ai/api/v1/chat/completions",
//       {
//         model: "google/gemini-2.0-flash-001",
//         messages: [{ role: "user", content: prompt }],
//         max_tokens: 150,
//         temperature: 1.0,
//         top_p: 0.95,
//       },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${apikey}`,
//           "HTTP-Referer": "https://github.com/threads-bot",
//           "X-Title": "Threads Notification Bot",
//         },
//       }
//     );

//     let aiReply = response.data.choices[0].message.content.trim();
//     aiReply = aiReply.replace(/^[\"\']+|[\"\']+$/g, "");
//     if (aiReply.length > 280) {
//       aiReply = aiReply.substring(0, 277) + "...";
//     }

//     return aiReply;
//   } catch (error) {
//     logToNotificationFile(`❌ AI reply generation failed: ${error.message}`);
//     return null;
//   }
// }

// /**
//  * Check if bot already replied using dynamic username
//  */
// async function checkIfBotAlreadyReplied(page, username) {
//   try {
//     const lastReplyAuthor = await page.evaluate((user) => {
//       // Find the Column body which contains the conversation thread
//       const columnBody = document.querySelector('div[aria-label="Column body"][role="region"]');
//       if (!columnBody) return null;

//       // Look for the "View activity" button which appears after the original post
//       // All replies/comments appear BELOW this section
//       const viewActivityButtons = Array.from(columnBody.querySelectorAll('span')).filter(span => 
//         span.textContent.includes('View activity')
//       );
      
//       // Get all pressable containers in the column body
//       const allContainers = columnBody.querySelectorAll('div[data-pressable-container="true"]');
      
//       // Filter to get only actual reply/comment containers (those with username links and profile pics)
//       const replyContainers = Array.from(allContainers).filter(container => {
//         // Must have a username link with translate="no" span
//         const usernameLink = container.querySelector('a[href^="/@"][role="link"] span[translate="no"]');
//         // Must have a profile picture
//         const profilePic = container.querySelector('img[alt*="profile picture"]');
//         return usernameLink && profilePic;
//       });

//       if (replyContainers.length === 0) return null;

//       // The LAST reply container in the entire thread is what we need to check
//       const lastReply = replyContainers[replyContainers.length - 1];
      
//       // Extract username from the last reply
//       const authorSpan = lastReply.querySelector('a[href^="/@"][role="link"] span[translate="no"]');
//       if (!authorSpan) return null;

//       const author = authorSpan.textContent.trim();
//       return author;
//     }, username).catch((error) => {
//       console.error("Page evaluation failed in checkIfBotAlreadyReplied:", error);
//       return null;
//     });

//     logToNotificationFile(`  📝 Last reply author: ${lastReplyAuthor || 'none'}, Bot username: ${username}`);
//     return lastReplyAuthor === username;
//   } catch (error) {
//     logToNotificationFile(`⚠️ Error checking bot reply: ${error.message}`);
//     return false;
//   }
// }

// /**
//  * Post reply when already on the post detail page
//  */
// async function replyToNotificationOnPostPage(page, replyText) {
//   try {
//     await sleep(randomDelay(2000, 3000));
//     logToNotificationFile("🔍 Looking for Reply button...");

//     // Find and click reply button on the post page
//     const replyButtonClicked = await page.evaluate(() => {
//       const buttons = document.querySelectorAll('div[role="button"]');
//       for (const btn of buttons) {
//         const svg = btn.querySelector('svg[aria-label="Reply"]');
//         if (svg) {
//           btn.click();
//           return true;
//         }
//       }
//       return false;
//     }).catch((error) => {
//       logToNotificationFile(`⚠️ Error clicking reply button: ${error.message}`);
//       return false;
//     });

//     if (!replyButtonClicked) {
//       logToNotificationFile("⚠️ Reply button not found");
//       return false;
//     }

//     await sleep(randomDelay(2000, 3000));

//     const inputSelectors = [
//       'div[contenteditable="true"][role="textbox"]',
//       'div[contenteditable="true"]',
//     ];

//     let replyInput = null;
//     for (const selector of inputSelectors) {
//       try {
//         replyInput = await page.waitForSelector(selector, { timeout: 10000 });
//         if (replyInput) {
//           logToNotificationFile(`✅ Found reply input`);
//           break;
//         }
//       } catch (e) {
//         continue;
//       }
//     }

//     if (!replyInput) {
//       logToNotificationFile("❌ Reply input not found");
//       return false;
//     }

//     await replyInput.click();
//     await sleep(500);
//     await replyInput.evaluate((el) => {
//       el.textContent = "";
//       el.focus();
//     });
//     await sleep(500);
//     await replyInput.type(replyText, { delay: randomDelay(80, 150) });
//     await sleep(randomDelay(2000, 3000));

//     const postButtonClicked = await page.evaluate(() => {
//       const buttons = document.querySelectorAll('div[role="button"]');
//       for (const btn of buttons) {
//         const text = btn.textContent;
//         if (text && text.includes("Post")) {
//           btn.click();
//           return true;
//         }
//       }
//       return false;
//     }).catch((error) => {
//       logToNotificationFile(`⚠️ Error clicking post button: ${error.message}`);
//       return false;
//     });

//     if (postButtonClicked) {
//       await sleep(2000);
//       logToNotificationFile("✅ Reply posted successfully");
//       return true;
//     } else {
//       await page.keyboard.down("Control");
//       await page.keyboard.press("Enter");
//       await page.keyboard.up("Control");
//       await sleep(2000);
//       logToNotificationFile("✅ Reply posted via keyboard");
//       return true;
//     }

//   } catch (error) {
//     logToNotificationFile(`❌ Reply posting error: ${error.message}`);
//     return false;
//   }
// }

// /**
//  * Post reply to notification (legacy function - kept for compatibility)
//  */
// async function replyToNotification(page, replyText, postLink = null) {
//   try {
//     await sleep(randomDelay(2000, 3000));
//     logToNotificationFile("🔍 Looking for Reply button...");

//     // If postLink is provided, find the specific notification first
//     const replyButtonClicked = await page.evaluate((targetPostLink) => {
//       let targetContainer = null;
      
//       // If we have a postLink, find the specific notification container
//       if (targetPostLink) {
//         const allContainers = document.querySelectorAll('div[data-pressable-container="true"]');
//         for (const container of allContainers) {
//           const postLinkElement = container.querySelector(`a[href="${targetPostLink}"]`);
//           if (postLinkElement) {
//             targetContainer = container;
//             break;
//           }
//         }
        
//         if (!targetContainer) {
//           console.log(`❌ Could not find notification with postLink: ${targetPostLink}`);
//           return false;
//         }
//       }
      
//       // Find reply button within the target container (or first one if no postLink)
//       const searchScope = targetContainer || document;
//       const buttons = searchScope.querySelectorAll('div[role="button"]');
      
//       for (const btn of buttons) {
//         const svg = btn.querySelector('svg[aria-label="Reply"]');
//         if (svg) {
//           btn.click();
//           return true;
//         }
//       }
//       return false;
//     }, postLink).catch((error) => {
//       logToNotificationFile(`⚠️ Error clicking reply button: ${error.message}`);
//       return false;
//     });

//     if (!replyButtonClicked) {
//       logToNotificationFile("⚠️ Reply button not found");
//       return false;
//     }

//     await sleep(randomDelay(2000, 3000));

//     const inputSelectors = [
//       'div[contenteditable="true"][role="textbox"]',
//       'div[contenteditable="true"]',
//     ];

//     let replyInput = null;
//     for (const selector of inputSelectors) {
//       try {
//         replyInput = await page.waitForSelector(selector, { timeout: 10000 });
//         if (replyInput) {
//           logToNotificationFile(`✅ Found reply input`);
//           break;
//         }
//       } catch (e) {
//         continue;
//       }
//     }

//     if (!replyInput) {
//       logToNotificationFile("❌ Reply input not found");
//       return false;
//     }

//     await replyInput.click();
//     await sleep(500);
//     await replyInput.evaluate((el) => {
//       el.textContent = "";
//       el.focus();
//     });
//     await sleep(500);
//     await replyInput.type(replyText, { delay: randomDelay(80, 150) });
//     await sleep(randomDelay(2000, 3000));

//     const postButtonClicked = await page.evaluate(() => {
//       const buttons = document.querySelectorAll('div[role="button"]');
//       for (const btn of buttons) {
//         const text = btn.textContent;
//         if (text && text.includes("Post")) {
//           btn.click();
//           return true;
//         }
//       }
//       return false;
//     }).catch((error) => {
//       logToNotificationFile(`⚠️ Error clicking post button: ${error.message}`);
//       return false;
//     });

//     if (postButtonClicked) {
//       await sleep(2000);
//       try {
//         await sleep(1500);
//         const popupInfo = await page.evaluate(() => {
//           const bodyText = document.body.innerText || document.body.textContent || '';
//           const hasUnsavedChangesAlert = bodyText.includes('Changes you made may not be saved') ||
//             bodyText.includes('changes you made') ||
//             bodyText.includes('may not be saved');

//           if (hasUnsavedChangesAlert) {
//             return { found: true, type: 'unsavedChanges' };
//           }

//           const dialog = document.querySelector('[role="dialog"]') ||
//             document.querySelector('[role="alertdialog"]') ||
//             document.querySelector('[aria-modal="true"]');

//           if (dialog && dialog.offsetParent !== null) {
//             const rect = dialog.getBoundingClientRect();
//             if (rect.width > 0 && rect.height > 0) {
//               return { found: true, type: 'dialog' };
//             }
//           }

//           return { found: false };
//         });

//         if (popupInfo.found) {
//           logToNotificationFile(`  Popup detected after posting, pressing Ctrl+Enter...`);
//           await page.keyboard.down('Control');
//           await page.keyboard.press('Enter');
//           await page.keyboard.up('Control');
//           await sleep(1000);
//           logToNotificationFile('  Dismissed popup');
//         }
//       } catch (popupError) {
//         logToNotificationFile(`  Error checking for popup: ${popupError.message}`);
//       }

//       logToNotificationFile("✅ Reply posted successfully");
//       return true;
//     } else {
//       await page.keyboard.down("Control");
//       await page.keyboard.press("Enter");
//       await page.keyboard.up("Control");
//       await sleep(2000);
//       logToNotificationFile("✅ Reply posted via keyboard");
//       return true;
//     }

//   } catch (error) {
//     logToNotificationFile(`❌ Reply posting error: ${error.message}`);
//     return false;
//   }
// }

// /**
//  * ✅ FIXED: Check and reply to notifications with proper navigation
//  */
// async function checkAndReplyToNotifications(page, shouldReply, username) {
//   try {
//     logToNotificationFile("\n" + "═".repeat(80));
//     logToNotificationFile("🔔 Starting notification check cycle...");
    
//     // Check if we're already on notifications page
//     const currentUrl = page.url();
//     const isOnNotifications = currentUrl.includes('/notifications') || currentUrl.includes('/activity');
    
//     if (!isOnNotifications) {
//       logToNotificationFile("⚠️ Not on notifications page, navigating...");
//       const navigationSuccess = await navigateToNotifications(page);
      
//       if (!navigationSuccess) {
//         logToNotificationFile(`❌ Failed to navigate to notifications page`);
//         return {
//           checked: 0,
//           processed: 0,
//           replied: 0,
//           skipped: 0,
//           skippedLikeFollow: 0,
//           alreadyReplied: 0,
//           error: "Navigation failed"
//         };
//       }
//     } else {
//       logToNotificationFile(`✅ Already on notifications page: ${currentUrl}`);
//       // Refresh to get latest notifications
//       logToNotificationFile("🔄 Refreshing page to get latest notifications...");
//       await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
//       await sleep(3000);
      
//       // Verify the page is ready
//       const isVerified = await verifyNotificationsPageLoaded(page);
//       if (!isVerified) {
//         logToNotificationFile(`❌ Notifications page verification failed`);
//         return {
//           checked: 0,
//           processed: 0,
//           replied: 0,
//           skipped: 0,
//           skippedLikeFollow: 0,
//           alreadyReplied: 0,
//           error: "Verification failed"
//         };
//       }
//     }

//     // ✅ NOW it's safe to extract notifications
//     // Track which notifications we've already replied to (by postLink)
//     const repliedPostLinks = new Set();
    
//     // Process notifications
//     let checkedCount = 0;
//     let processedCount = 0;
//     let repliedCount = 0;
//     let skippedOldCount = 0;
//     let skippedLikeFollowCount = 0;
//     let alreadyRepliedCount = 0;
    
//     // Keep processing until we've checked all notifications or hit old ones
//     let continueProcessing = true;
    
//     while (continueProcessing) {
//       // Re-extract notifications to get fresh DOM state
//       logToNotificationFile("📄 Extracting notifications from verified page...");
//       const notifications = await extractNotificationsFromPage(page);
      
//       logToNotificationFile(`📬 Found ${notifications.length} notifications on page`);

//       if (notifications.length === 0) {
//         logToNotificationFile(`⚠️ No notifications found!`);
//         try {
//           await page.screenshot({ path: 'debug-no-notifications.png', fullPage: true });
//           logToNotificationFile(`📸 Screenshot saved to debug-no-notifications.png`);
//         } catch (e) {
//           // Ignore screenshot errors
//         }
//         break;
//       }
      
//       let foundNewNotification = false;

//       for (const notification of notifications) {
//         // Skip if we've already replied to this notification
//         if (notification.postLink && repliedPostLinks.has(notification.postLink)) {
//           continue; // Already processed this one
//         }
        
//         checkedCount++;
//         logToNotificationFile(`\n📌 Notification ${checkedCount}:`);
//         logToNotificationFile(`  Type: ${notification.type}`);
//         logToNotificationFile(`  Author: @${notification.author}`);
//         logToNotificationFile(`  Time: ${notification.time}`);
        
//         if (!isUnder12Hours(notification.time)) {
//           logToNotificationFile(`  ⏭️ SKIPPED: Older than 12 hours`);
//           skippedOldCount++;
//           continueProcessing = false; // Stop processing entirely
//           break;
//         }
        
//         if (notification.type === "like" || notification.type === "follow" || notification.type === "repost") {
//           skippedLikeFollowCount++;
//           logToNotificationFile(`  ⏭️ SKIPPED: ${notification.type.toUpperCase()} notification`);
//           continue;
//         }

//         processedCount++;
        
//         if (!shouldReply) {
//           logToNotificationFile("ℹ️ Reply disabled in this run");
//           continue;
//         }

//         if (!notification.postLink) {
//           logToNotificationFile("⚠️ No post link found");
//           continue;
//         }

//         // Only proceed if notification has a reply button
//         if (!notification.hasReplyButton) {
//           logToNotificationFile("⚠️ No reply button found - skipping");
//           continue;
//         }
        
//         foundNewNotification = true;

//         try {
//           // Step 1: Click on the notification to open it
//           logToNotificationFile("🖱️ Clicking on notification to open...");
//           const notificationClicked = await page.evaluate((targetPostLink) => {
//             const allContainers = document.querySelectorAll('div[data-pressable-container="true"]');
//             for (const container of allContainers) {
//               const postLinkElement = container.querySelector(`a[href="${targetPostLink}"]`);
//               if (postLinkElement) {
//                 postLinkElement.click();
//                 return true;
//               }
//             }
//             return false;
//           }, notification.postLink);
          
//           if (!notificationClicked) {
//             logToNotificationFile("⚠️ Could not click notification");
//             continue;
//           }
          
//           await sleep(randomDelay(3000, 4000));
          
//           // Step 2: Check if bot already replied to this notification
//           logToNotificationFile("🔍 Checking if bot already replied...");
//           const alreadyReplied = await checkIfBotAlreadyReplied(page, username);
          
//           if (alreadyReplied) {
//             alreadyRepliedCount++;
//             logToNotificationFile("  ⏭️ SKIPPED: Bot already replied to this");
            
//             // Go back to notifications page
//             logToNotificationFile("🔙 Going back to notifications...");
//             await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
//             await sleep(randomDelay(2000, 3000));
//             continue;
//           }
          
//           // Step 3: Bot hasn't replied yet, proceed with generating and posting reply
//           logToNotificationFile("✅ Bot hasn't replied yet, proceeding...");
          
//           const aiReply = await generateAIReply(notification.text);
//           if (!aiReply) {
//             logToNotificationFile("⚠️ Failed to generate AI reply");
//             // Go back to notifications page
//             await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
//             await sleep(randomDelay(2000, 3000));
//             continue;
//           }

//           logToNotificationFile(`💬 Generated reply: "${aiReply}"`);
          
//           // Now we're already on the post page, just find reply button and post
//           const replySuccess = await replyToNotificationOnPostPage(page, aiReply);
//           if (replySuccess) {
//             repliedCount++;
//             logToNotificationFile("✅ Successfully replied");
            
//             // Mark this notification as replied
//             repliedPostLinks.add(notification.postLink);
            
//             await logPostToCSV({
//               actionType: "REPLY",
//               status: "SUCCESS",
//               username: notification.author || "",
//               author: notification.postOwner || "",
//               postContent: notification.text || "",
//               generatedText: aiReply,
//               postLink: notification.postLink || "",
//               module: "notification.js"
//             });
//           }
          
//           // Go back to notifications page
//           logToNotificationFile("🔙 Going back to notifications...");
//           await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
//           await sleep(randomDelay(3000, 5000));
          
//           // After replying, DOM changes - break loop to re-extract notifications
//           logToNotificationFile("🔄 Will re-extract notifications to avoid index issues");
//           break; // Exit inner loop to re-extract fresh notifications

//         } catch (replyError) {
//           logToNotificationFile(`⚠️ Error processing notification: ${replyError.message}`);
//           // Try to go back to notifications page on error
//           try {
//             await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
//             await sleep(2000);
//           } catch (navError) {
//             logToNotificationFile(`⚠️ Could not navigate back: ${navError.message}`);
//           }
//         }
//       }
      
//       // If we didn't find any new notifications to process, stop
//       if (!foundNewNotification) {
//         continueProcessing = false;
//       }
//     }

//     logToNotificationFile("\n" + "─".repeat(80));
//     logToNotificationFile("📊 CYCLE SUMMARY:");
//     logToNotificationFile(`  ✓ Checked: ${checkedCount}`);
//     logToNotificationFile(`  ⏭ Skipped (old): ${skippedOldCount}`);
//     logToNotificationFile(`  ⏭ Skipped (like/follow): ${skippedLikeFollowCount}`);
//     logToNotificationFile(`  📝 Processed: ${processedCount}`);
//     logToNotificationFile(`  💬 Replied: ${repliedCount}`);
//     logToNotificationFile("─".repeat(80));

//     return {
//       checked: checkedCount,
//       processed: processedCount,
//       replied: repliedCount,
//       skipped: skippedOldCount,
//       skippedLikeFollow: skippedLikeFollowCount,
//       alreadyReplied: alreadyRepliedCount,
//     };

//   } catch (error) {
//     logToNotificationFile(`❌ Error in notification check cycle: ${error.message}`);
//     console.error(error.stack);
//     return {
//       checked: 0,
//       processed: 0,
//       replied: 0,
//       skipped: 0,
//       skippedLikeFollow: 0,
//       alreadyReplied: 0,
//       error: error.message
//     };
//   }
// }

// /**
//  * Main notification checker
//  */
// async function runNotificationChecker(username, password, config = {}) {
//   let browser = null;
//   try {
//     logToNotificationFile("\n" + "=".repeat(80));
//     logToNotificationFile("🤖 THREADS NOTIFICATION BOT STARTED");
//     logToNotificationFile("=".repeat(80));
//     logToNotificationFile(`👤 User: ${username}`);

//     const { browser: browserInstance, page } = await initializeBotWithSession({
//       username: username,
//       password: password,
//       botType: 'notification_checker',
//       headless: config.headless !== undefined ? config.headless : false,
//       chromePath: config.chromePath || null,
//     });

//     browser = browserInstance;
//     logSuccess('✅ Login successful, navigating to notifications page...');

//     // Navigate to notifications page immediately after login
//     const initialNavSuccess = await navigateToNotifications(page);
//     if (!initialNavSuccess) {
//       throw new Error('Failed to navigate to notifications page after login');
//     }
    
//     logToNotificationFile('✅ Ready to start notification checks...');

//     const checkInterval = config.checkInterval || 2;
//     while (true) {
//       const results = await checkAndReplyToNotifications(page, config.autoReply !== false, username);
//       logToNotificationFile(
//         `📊 Stats: ${results.checked} checked, ${results.skippedLikeFollow} skipped, ${results.processed} processed, ${results.replied} replied`
//       );
//       logToNotificationFile(`⏳ Waiting ${checkInterval} hours...`);
//       await sleep(checkInterval * 60 * 60 * 1000);
//     }

//   } catch (error) {
//     logToNotificationFile(`❌ Critical error: ${error.message}`);
//     console.error(error);
//     await handleBotError(browser, error, username);
//   } finally {
//     if (browser) {
//       await closeBotGracefully(browser, username);
//     }
//   }
// }

// export { checkAndReplyToNotifications, runNotificationChecker, navigateToNotifications, verifyNotificationsPageLoaded };
// export default runNotificationChecker;












// // // // // ============================================================================
// // // // // UPDATED post.js - Dynamic Credentials from Frontend
// // // // // ============================================================================

// // // // import fs from "fs";
// // // // import axios from "axios";
// // // // import dotenv from "dotenv";
// // // // import { logPostToCSV } from "../utils/csvLogger.js";
// // // // import { initializeBotWithSession, closeBotGracefully } from "../helpers/botBootstrap.js";
// // // // import { sleep, randomDelay } from "../utils/logger.js";

// // // // dotenv.config();

// // // // const THREADS_CHARACTER_LIMIT = 500;

// // // // function logToFile(message) {
// // // //   const timestamp = new Date().toLocaleString();
// // // //   const logMessage = `[${timestamp}] ${message}\n`;
// // // //   try {
// // // //     fs.appendFileSync("threads_post_creation.txt", logMessage, "utf8");
// // // //   } catch (error) {
// // // //     console.error("Error writing to log:", error.message);
// // // //   }
// // // // }

// // // // /**
// // // //  * Check and truncate text to fit Threads character limit
// // // //  */
// // // // function ensureCharacterLimit(text, limit = THREADS_CHARACTER_LIMIT) {
// // // //   if (text.length <= limit) {
// // // //     return { text, truncated: false, originalLength: text.length };
// // // //   }

// // // //   const truncated = text.substring(0, limit - 3) + "...";
// // // //   logToFile(`⚠️ Text truncated: ${text.length} → ${truncated.length} characters`);
  
// // // //   return {
// // // //     text: truncated,
// // // //     truncated: true,
// // // //     originalLength: text.length,
// // // //     newLength: truncated.length,
// // // //   };
// // // // }

// // // // /**
// // // //  * Helper function for fallback posts
// // // //  */
// // // // function getFallbackPost(topic, options = {}) {
// // // //   const { tone = 'casual', includeQuestion = false, includeEmojis = true } = options;
  
// // // //   const emoji = includeEmojis ? ' 💭' : '';
// // // //   const question = includeQuestion ? ' What do you think?' : '';
  
// // // //   const posts = {
// // // //     ai: `Artificial Intelligence is reshaping how we work and live. From automation to creativity, AI tools are becoming essential in every industry.${question}${emoji}`,
// // // //     tech: `Technology evolves faster than ever! What seemed impossible yesterday is routine today. The future is being built right now.${question}${emoji}`,
// // // //     technology: `Technology continues to advance at an incredible pace. Innovation is happening in every sector, transforming how we solve problems.${question}${emoji}`,
// // // //     automation: `Automation isn't about replacing humans—it's about freeing us to focus on what matters most. Smart workflows save time and reduce errors.${question}${emoji}`,
// // // //     social: `Social media has changed how we connect and communicate. Building authentic relationships online is more important than ever.${question}${emoji}`,
// // // //     business: `Business success today requires adapting to change quickly. The most innovative companies are those that embrace new technologies.${question}${emoji}`,
// // // //     marketing: `Marketing in the digital age is about authentic connections. People want real stories, not just sales pitches.${question}${emoji}`,
// // // //     productivity: `Productivity isn't about doing more—it's about doing what matters. Focus on high-impact tasks and eliminate distractions.${question}${emoji}`,
// // // //     default: `Let's talk about ${topic}! This is a fascinating subject that deserves more attention. There's so much to explore and learn here.${question}${emoji}`
// // // //   };
  
// // // //   const key = topic.toLowerCase().trim().split(' ')[0];
// // // //   return posts[key] || posts.default;
// // // // }

// // // // /**
// // // //  * Helper function for fallback hashtags
// // // //  */
// // // // function getFallbackHashtags(postText, count = 3) {
// // // //   const genericHashtags = [
// // // //     '#Threads', '#Content', '#Tech', '#AI', '#Automation', 
// // // //     '#Innovation', '#Digital', '#Future', '#Community', '#SocialMedia'
// // // //   ];
  
// // // //   const words = postText.split(' ').filter(word => word.length > 5 && word.length < 15);
// // // //   const extracted = words.slice(0, 2).map(word => {
// // // //     const clean = word.replace(/[^a-zA-Z]/g, '');
// // // //     return `#${clean.charAt(0).toUpperCase() + clean.slice(1)}`;
// // // //   });
  
// // // //   const combined = [...new Set([...extracted, ...genericHashtags])];
// // // //   return combined.slice(0, count);
// // // // }

// // // // /**
// // // //  * Generate AI post content for Threads
// // // //  */
// // // // async function generateThreadsPost(topic, options = {}) {
// // // //   try {
// // // //     const {
// // // //       tone = 'casual',
// // // //       length = 'medium',
// // // //       includeQuestion = false,
// // // //       includeEmojis = true,
// // // //       image = null
// // // //     } = options;

// // // //     const apikey = process.env.OPENROUTER_API_KEY;

// // // //     if (!apikey) {
// // // //       console.log("⚠️ OPENROUTER_API_KEY not found, using fallback post");
// // // //       logToFile("⚠️ Using fallback post - no API key");
// // // //       return getFallbackPost(topic, options);
// // // //     }

// // // //     const lengthMap = {
// // // //       short: '50-100 words (around 300 characters)',
// // // //       medium: '100-150 words (around 400 characters)',
// // // //       long: '150-200 words (around 480 characters)'
// // // //     };

// // // //     let prompt;
// // // //     let messages;
// // // //     let model;

// // // //     // If image is provided, use vision model
// // // //     if (image) {
// // // //       console.log(`🖼️ Generating post from image with topic: ${topic || 'auto-detect'}`);
// // // //       logToFile(`🖼️ Using vision AI to analyze image`);

// // // //       prompt = `You are creating an engaging Threads post based on this image.
// // // // ${topic ? `Topic context: "${topic}"` : 'Analyze the image and create a relevant post.'}

// // // // Write a ${tone} Threads post (${lengthMap[length]}, MAXIMUM 480 characters) that:
// // // // - Describes or relates to what you see in the image
// // // // - Is conversational and authentic
// // // // - ${includeEmojis ? 'Uses 2-4 emojis naturally throughout' : 'Uses minimal or no emojis'}
// // // // - ${includeQuestion ? 'Ends with an engaging question to spark discussion' : 'Has a strong closing statement'}
// // // // - Feels personal and relatable
// // // // - Uses line breaks for readability
// // // // - STAYS UNDER 480 CHARACTERS

// // // // IMPORTANT: Return ONLY the post text, no quotes, no explanations, no hashtags.`;

// // // //       messages = [
// // // //         {
// // // //           role: "user",
// // // //           content: [
// // // //             { type: "text", text: prompt },
// // // //             { type: "image_url", image_url: { url: image } }
// // // //           ]
// // // //         }
// // // //       ];

// // // //       // Use vision-capable model
// // // //       model = "google/gemini-2.0-flash-exp:free";
// // // //     } else {
// // // //       // Text-only generation
// // // //       prompt = `You are creating an engaging Threads post.
// // // // Topic: "${topic}"

// // // // Write a ${tone} Threads post (${lengthMap[length]}, MAXIMUM 480 characters) that:
// // // // - Is conversational and authentic
// // // // - ${includeEmojis ? 'Uses 2-4 emojis naturally throughout' : 'Uses minimal or no emojis'}
// // // // - ${includeQuestion ? 'Ends with an engaging question to spark discussion' : 'Has a strong closing statement'}
// // // // - Feels personal and relatable
// // // // - Avoids being overly promotional
// // // // - Uses line breaks for readability
// // // // - STAYS UNDER 480 CHARACTERS

// // // // IMPORTANT: Return ONLY the post text, no quotes, no explanations, no hashtags.`;

// // // //       messages = [{ role: "user", content: prompt }];
// // // //       model = "meta-llama/llama-3.2-3b-instruct:free";
// // // //     }

// // // //     console.log(`🤖 Generating post${image ? ' from image' : ''} for topic: ${topic || 'image analysis'}`);

// // // //     const response = await axios.post(
// // // //       "https://openrouter.ai/api/v1/chat/completions",
// // // //       {
// // // //         model: model,
// // // //         messages: messages,
// // // //         max_tokens: 300,
// // // //         temperature: 0.8,
// // // //       },
// // // //       {
// // // //         headers: {
// // // //           "Content-Type": "application/json",
// // // //           Authorization: `Bearer ${apikey}`,
// // // //           "HTTP-Referer": "https://threads-automation.app",
// // // //           "X-Title": "Threads Post Generator",
// // // //         },
// // // //       }
// // // //     );

// // // //     let postText = response.data.choices[0].message.content.trim();
// // // //     postText = postText.replace(/^["']/g, "").replace(/["']$/g, "");
    
// // // //     const checked = ensureCharacterLimit(postText);
// // // //     logToFile(`✅ AI post generated: ${checked.text.substring(0, 50)}...`);
    
// // // //     return checked.text;

// // // //   } catch (error) {
// // // //     console.error("Error generating AI post:", error.response?.data || error.message);
// // // //     logToFile(`❌ AI post generation failed: ${error.message}`);
    
// // // //     if (error.response?.data?.error?.code === 402) {
// // // //       console.log("⚠️ OpenRouter credits exhausted, using fallback post");
// // // //       logToFile("⚠️ Using fallback post - no credits");
// // // //     }
    
// // // //     return getFallbackPost(topic, options);
// // // //   }
// // // // }

// // // // /**
// // // //  * Generate hashtags for a post
// // // //  */
// // // // async function generateHashtags(postText, count = 3) {
// // // //   try {
// // // //     const apikey = process.env.OPENROUTER_API_KEY;

// // // //     if (!apikey) {
// // // //       console.log("⚠️ OPENROUTER_API_KEY not found, using fallback hashtags");
// // // //       return getFallbackHashtags(postText, count);
// // // //     }

// // // //     const prompt = `Based on this Threads post, suggest ${count} relevant, trending hashtags.
// // // // Post: "${postText}"

// // // // Return ONLY the hashtags, one per line, with # symbol. No explanations.`;

// // // //     const response = await axios.post(
// // // //       "https://openrouter.ai/api/v1/chat/completions",
// // // //       {
// // // //         model: "meta-llama/llama-3.2-3b-instruct:free",
// // // //         messages: [{ role: "user", content: prompt }],
// // // //         max_tokens: 50,
// // // //         temperature: 0.7,
// // // //       },
// // // //       {
// // // //         headers: {
// // // //           "Content-Type": "application/json",
// // // //           Authorization: `Bearer ${apikey}`,
// // // //           "HTTP-Referer": "https://threads-automation.app",
// // // //           "X-Title": "Threads Hashtag Generator",
// // // //         },
// // // //       }
// // // //     );

// // // //     const hashtags = response.data.choices[0].message.content
// // // //       .trim()
// // // //       .split("\n")
// // // //       .filter(tag => tag.startsWith("#"))
// // // //       .slice(0, count);

// // // //     if (hashtags.length === 0) {
// // // //       return getFallbackHashtags(postText, count);
// // // //     }

// // // //     console.log(`✅ Hashtags generated: ${hashtags.join(' ')}`);
// // // //     return hashtags;

// // // //   } catch (error) {
// // // //     console.error("Error generating hashtags:", error.response?.data || error.message);
    
// // // //     if (error.response?.data?.error?.code === 402) {
// // // //       console.log("⚠️ OpenRouter credits exhausted, using fallback hashtags");
// // // //     }
    
// // // //     return getFallbackHashtags(postText, count);
// // // //   }
// // // // }

// // // // /**
// // // //  * ✅ FIXED: Create a Threads post using credentials from parameters
// // // //  * @param {string} postContent - The content to post
// // // //  * @param {string} username - Threads username from frontend
// // // //  * @param {string} password - Threads password from frontend
// // // //  */
// // // // async function createThreadsPost(postContent, username, password) {
// // // //   let browser = null;
  
// // // //   try {
// // // //     console.log('📝 Starting post creation process...');
// // // //     console.log(`👤 User: ${username}`);
// // // //     console.log(`📄 Content: ${postContent.substring(0, 50)}...`);

// // // //     // ✅ CRITICAL FIX: Use credentials from parameters, NOT env vars
// // // //     const { browser: browserInstance, page } = await initializeBotWithSession({
// // // //       username: username,    // ✅ From function parameter
// // // //       password: password,    // ✅ From function parameter
// // // //       botType: 'post_creator',
// // // //       headless: false,
// // // //       chromePath: null,
// // // //     });

// // // //     browser = browserInstance;

// // // //     console.log('✅ Login successful, navigating to Threads...');

// // // //     // Navigate to Threads home
// // // //     await page.goto("https://www.threads.net/", {
// // // //       waitUntil: "domcontentloaded",
// // // //       timeout: 60000,
// // // //     });

// // // //     await sleep(randomDelay(3000, 4000));

// // // //     console.log('🔍 Looking for compose button...');

// // // //     // Click compose button - try multiple selectors
// // // //     let composeClicked = false;
    
// // // //     // Method 1: Try direct selector
// // // //     try {
// // // //       const composeButton = await page.waitForSelector(
// // // //         'div[role="button"][aria-label*="New"], div[role="button"][aria-label*="post"], a[href="/new"]',
// // // //         { timeout: 5000 }
// // // //       );
// // // //       if (composeButton) {
// // // //         await composeButton.click();
// // // //         composeClicked = true;
// // // //         console.log('✅ Compose button clicked (Method 1)');
// // // //       }
// // // //     } catch (e) {
// // // //       console.log('⚠️ Method 1 failed, trying Method 2...');
// // // //     }

// // // //     // Method 2: Try evaluating in page context
// // // //     if (!composeClicked) {
// // // //       composeClicked = await page.evaluate(() => {
// // // //         const buttons = document.querySelectorAll('div[role="button"], a[href="/new"]');
// // // //         for (const btn of buttons) {
// // // //           const ariaLabel = btn.getAttribute('aria-label') || '';
// // // //           const text = btn.textContent || '';
// // // //           if (
// // // //             ariaLabel.toLowerCase().includes('new') || 
// // // //             ariaLabel.toLowerCase().includes('post') ||
// // // //             btn.getAttribute('href') === '/new'
// // // //           ) {
// // // //             btn.click();
// // // //             return true;
// // // //           }
// // // //         }
// // // //         return false;
// // // //       });
      
// // // //       if (composeClicked) {
// // // //         console.log('✅ Compose button clicked (Method 2)');
// // // //       }
// // // //     }

// // // //     if (!composeClicked) {
// // // //       throw new Error('Could not find compose button');
// // // //     }

// // // //     await sleep(randomDelay(2000, 3000));

// // // //     console.log('✍️ Typing post content...');

// // // //     // Type post content
// // // //     const textArea = await page.waitForSelector('div[contenteditable="true"]', {
// // // //       timeout: 10000,
// // // //     });
    
// // // //     if (!textArea) {
// // // //       throw new Error('Could not find text input area');
// // // //     }

// // // //     await textArea.click();
// // // //     await sleep(500);
    
// // // //     // Clear any existing content
// // // //     await page.keyboard.down('Control');
// // // //     await page.keyboard.press('KeyA');
// // // //     await page.keyboard.up('Control');
// // // //     await page.keyboard.press('Backspace');
// // // //     await sleep(300);

// // // //     // Type the content
// // // //     await textArea.type(postContent, { delay: randomDelay(50, 100) });
// // // //     await sleep(randomDelay(2000, 3000));

// // // //     console.log('📤 Submitting post...');

// // // //     // Click post button - try multiple methods
// // // //     let postClicked = false;

// // // //     // Method 1: Look for enabled post button
// // // //     try {
// // // //       const postButton = await page.waitForSelector(
// // // //         'div[role="button"]:not([aria-disabled="true"])',
// // // //         { timeout: 5000 }
// // // //       );
      
// // // //       if (postButton) {
// // // //         const buttonText = await page.evaluate(el => el.textContent, postButton);
// // // //         if (buttonText && buttonText.toLowerCase().includes('post')) {
// // // //           await postButton.click();
// // // //           postClicked = true;
// // // //           console.log('✅ Post button clicked (Method 1)');
// // // //         }
// // // //       }
// // // //     } catch (e) {
// // // //       console.log('⚠️ Method 1 failed, trying Method 2...');
// // // //     }

// // // //     // Method 2: Use keyboard shortcut
// // // //     if (!postClicked) {
// // // //       console.log('⌨️ Using keyboard shortcut (Ctrl+Enter)...');
// // // //       await page.keyboard.down('Control');
// // // //       await page.keyboard.press('Enter');
// // // //       await page.keyboard.up('Control');
// // // //       postClicked = true;
// // // //     }

// // // //     await sleep(5000); // Wait for post to be created

// // // //     console.log('✅ Post creation completed!');
// // // //     logToFile(`✅ Post created by ${username}: ${postContent.substring(0, 50)}...`);

// // // //     // Log to CSV
// // // //     await logPostToCSV({
// // // //       actionType: "POST",
// // // //       status: "SUCCESS",
// // // //       username: username,
// // // //       author: username,
// // // //       postContent: postContent,
// // // //       postLink: "",
// // // //       module: "post.js"
// // // //     });

// // // //     await closeBotGracefully(browser, username);
    
// // // //     return { success: true, message: "Post created successfully" };

// // // //   } catch (error) {
// // // //     console.error('❌ Error creating post:', error.message);
// // // //     logToFile(`❌ Error creating post for ${username}: ${error.message}`);
    
// // // //     if (browser) {
// // // //       await closeBotGracefully(browser, username);
// // // //     }
    
// // // //     return { success: false, error: error.message };
// // // //   }
// // // // }

// // // // // Export functions
// // // // export { generateThreadsPost, generateHashtags, createThreadsPost };
















// // // // ============================================================================
// // // // SIMPLIFIED search.js - Trust the Bootstrap Process
// // // // ============================================================================

// // // import { initializeBotWithSession, closeBotGracefully, handleBotError } from "../helpers/botBootstrap.js";
// // // import { logInfo, logSuccess, logError, sleep, randomDelay, logStructured, createLogEntry } from "../utils/logger.js";
// // // import { generateAIComment, generateAIReply } from "../helpers/aiGeneration.js";
// // // import { logPostToCSV } from "../utils/csvLogger.js";


// // // /**
// // //  * Smart scroll function to load more posts without leaving the page
// // //  */
// // // async function performSmartScroll(page) {
// // //   try {
// // //     const scrollResult = await page.evaluate(() => {
// // //       const beforeScroll = window.scrollY;
// // //       const documentHeight = document.documentElement.scrollHeight;
// // //       const viewportHeight = window.innerHeight;
// // //       const currentBottom = beforeScroll + viewportHeight;

// // //       const spaceLeft = documentHeight - currentBottom;
// // //       const nearBottom = spaceLeft < 500;

// // //       // Scroll by 60-80% of viewport height
// // //       const scrollAmount = Math.floor(viewportHeight * (0.6 + Math.random() * 0.2));

// // //       window.scrollBy({
// // //         top: scrollAmount,
// // //         behavior: 'smooth'
// // //       });

// // //       return {
// // //         beforeScroll,
// // //         scrollAmount,
// // //         spaceLeft,
// // //         nearBottom,
// // //         documentHeight,
// // //         viewportHeight
// // //       };
// // //     });

// // //     logInfo(`📜 Scrolled ${scrollResult.scrollAmount}px | Space left: ${scrollResult.spaceLeft}px`);

// // //     await sleep(randomDelay(1500, 2500));

// // //     // Wait longer if near bottom for new content to load
// // //     if (scrollResult.nearBottom) {
// // //       logInfo('⏳ Near bottom, waiting for new content...');
// // //       await sleep(randomDelay(2000, 3000));
// // //     }

// // //     return scrollResult;
// // //   } catch (error) {
// // //     logError(`❌ Error during scroll: ${error.message}`);
// // //     return null;
// // //   }
// // // }

// // // /**
// // //  * Check for notification popup and press Ctrl+Enter if present
// // //  * Also checks for "Changes you made may not be saved" alert
// // //  */
// // // async function handleNotificationPopup(page) {
// // //   try {
// // //     await sleep(1500); // Wait for notification to appear
    
// // //     // Check if a notification/modal popup is visible
// // //     const popupInfo = await page.evaluate(() => {
// // //       // Check for "Changes you made may not be saved" text
// // //       const bodyText = document.body.innerText || document.body.textContent || '';
// // //       const hasUnsavedChangesAlert = bodyText.includes('Changes you made may not be saved') || 
// // //                                       bodyText.includes('changes you made') ||
// // //                                       bodyText.includes('may not be saved');
      
// // //       // Check for various popup indicators
// // //       const checks = {
// // //         unsavedChanges: hasUnsavedChangesAlert,
// // //         dialog: document.querySelector('[role="dialog"]'),
// // //         alertDialog: document.querySelector('[role="alertdialog"]'),
// // //         ariaModal: document.querySelector('[aria-modal="true"]'),
// // //         contentEditable: document.querySelector('div[contenteditable="true"]'),
// // //         textarea: document.querySelector('textarea'),
// // //         // Check for overlay/backdrop (common in modals)
// // //         backdrop: document.querySelector('[style*="position: fixed"]'),
// // //         // Check for z-index layers (popups usually have high z-index)
// // //         highZIndex: Array.from(document.querySelectorAll('div')).find(el => {
// // //           const zIndex = window.getComputedStyle(el).zIndex;
// // //           return zIndex && parseInt(zIndex) > 100;
// // //         })
// // //       };
      
// // //       // Log what we found for debugging
// // //       const found = Object.entries(checks)
// // //         .filter(([key, val]) => val !== null && val !== undefined && val !== false)
// // //         .map(([key]) => key);
      
// // //       // Priority check for unsaved changes alert
// // //       if (hasUnsavedChangesAlert) {
// // //         return { found: true, type: 'unsavedChanges', foundElements: found };
// // //       }
      
// // //       // Check if any element is visible and interactive
// // //       for (const [key, element] of Object.entries(checks)) {
// // //         if (element && typeof element === 'object' && element.offsetParent !== null) {
// // //           // Additional check: is it actually visible on screen?
// // //           const rect = element.getBoundingClientRect();
// // //           if (rect.width > 0 && rect.height > 0) {
// // //             return { found: true, type: key, foundElements: found };
// // //           }
// // //         }
// // //       }
      
// // //       return { found: false, foundElements: found };
// // //     });
    
// // //     if (popupInfo.found) {
// // //       if (popupInfo.type === 'unsavedChanges') {
// // //         logInfo(`⚠️ "Changes you made may not be saved" alert detected, pressing Ctrl+Enter...`);
// // //       } else {
// // //         logInfo(`📬 Notification popup detected (${popupInfo.type}), pressing Ctrl+Enter...`);
// // //       }
      
// // //       // Try to focus on the input field first if it exists
// // //       try {
// // //         await page.focus('div[contenteditable="true"]').catch(() => {});
// // //         await sleep(500);
// // //       } catch (e) {
// // //         // Ignore if focus fails
// // //       }
      
// // //       // Press Ctrl+Enter
// // //       await page.keyboard.down('Control');
// // //       await page.keyboard.press('Enter');
// // //       await page.keyboard.up('Control');
      
// // //       await sleep(1500); // Wait for action to complete
// // //       logSuccess('✅ Pressed Ctrl+Enter on popup/alert');
// // //       return true;
// // //     } else if (popupInfo.foundElements.length > 0) {
// // //       logInfo(`⚠️ Found elements but not visible: ${popupInfo.foundElements.join(', ')}`);
// // //     }
    
// // //     return false;
// // //   } catch (error) {
// // //     logError(`❌ Error handling notification popup: ${error.message}`);
// // //     return false;
// // //   }
// // // }

// // // /**
// // //  * Main search and interact bot function
// // //  * @param {Object} config - Bot configuration
// // //  * @returns {Promise<Object>} Bot results
// // //  */
// // // export async function runSearchBot(config) {
// // //   const {
// // //     username,
// // //     password,
// // //     searchQuery,
// // //     numPosts = 10,
// // //     searchDurationMinutes = 30,
// // //     likeProbability = 0.4,
// // //     commentProbability = 0.13,
// // //     replyProbability = 0.13,
// // //   } = config;

// // //   let browser = null;
// // //   let totalProcessed = 0;

// // //   try {
// // //     logInfo('='.repeat(80));
// // //     logInfo(`🚀 SEARCH BOT STARTING - User: ${username}`);
// // //     logInfo('='.repeat(80));
    
// // //     // ========================================================================
// // //     // PHASE 1: INITIALIZE BROWSER AND LOGIN
// // //     // ========================================================================
// // //     logInfo('📋 PHASE 1: Browser Initialization & Login');
// // //     logInfo('-'.repeat(80));
    
// // //     // ✅ Trust the bootstrap - it handles everything (session restore + login)
// // //     const { browser: browserInstance, page } = await initializeBotWithSession({
// // //       username,
// // //       password,
// // //       botType: 'search',
// // //       headless: config.headless !== undefined ? config.headless : false,
// // //       chromePath: config.chromePath || null,
// // //     });

// // //     browser = browserInstance;
// // //     logSuccess('✅ Bot initialized - Login complete');

// // //     // ========================================================================
// // //     // PHASE 2: VERIFY WE'RE READY
// // //     // ========================================================================
// // //     logInfo('\n📋 PHASE 2: Final Verification');
// // //     logInfo('-'.repeat(80));
    
// // //     // Navigate to home to be sure
// // //     await page.goto('https://www.threads.net/', {
// // //       waitUntil: 'domcontentloaded',
// // //       timeout: 30000,
// // //     });
    
// // //     await sleep(3000);
    
// // //     const currentUrl = page.url();
// // //     logInfo(`📍 Current URL: ${currentUrl}`);
    
// // //     // Final safety check
// // //     if (currentUrl.includes('/login')) {
// // //       await page.screenshot({ path: `search_bot_still_login_${Date.now()}.png` });
// // //       throw new Error('❌ Login verification failed - still on login page');
// // //     }
    
// // //     logSuccess('✅ Ready to start search bot');

// // //     // ========================================================================
// // //     // PHASE 3: START SEARCH BOT
// // //     // ========================================================================
// // //     logInfo('\n📋 PHASE 3: Search Bot Execution');
// // //     logInfo('-'.repeat(80));
// // //     logInfo(`🔍 Search Query: "${searchQuery}"`);
// // //     logInfo(`⚙️ Posts to Process: ${numPosts}`);
// // //     logInfo(`⏱️ Duration: ${searchDurationMinutes} minutes`);
// // //     logInfo(`📊 Like: ${likeProbability * 100}% | Comment: ${commentProbability * 100}% | Reply: ${replyProbability * 100}%`);
// // //     logInfo('-'.repeat(80));

// // //     await logStructured(createLogEntry({
// // //       actionType: "SEARCH_BOT_START",
// // //       details: `Search bot started for query: ${searchQuery}`,
// // //       status: "SUCCESS",
// // //     }), "search_bot.json");

// // //     const endTime = Date.now() + searchDurationMinutes * 60 * 1000;
// // //     let consecutiveErrors = 0;
// // //     const MAX_CONSECUTIVE_ERRORS = 3;
// // //     let processedPostUrls = new Set(); // Track actually processed posts to avoid duplicates
// // //     let needsNewPosts = true;
// // //     const searchUrl = `https://www.threads.net/search?q=${encodeURIComponent(searchQuery)}&serp_type=default`;

// // //     // Perform initial search once
// // //     await performSearch(page, searchQuery);
// // //     await sleep(randomDelay(3000, 5000));

// // //     // Initial scroll to trigger content loading
// // //     await page.evaluate(() => window.scrollBy(0, 200));
// // //     await sleep(2000);

// // //     let consecutiveNoNewPosts = 0;
// // //     const MAX_NO_NEW_POSTS = 5;

// // //     while (Date.now() < endTime && totalProcessed < numPosts) {
// // //       try {
// // //         logInfo(`\n🔄 Processing post ${totalProcessed + 1}/${numPosts}`);
        
// // //         // Extract posts from current search page
// // //         const allPosts = await extractPostsFromSearchPage(page);
        
// // //         if (allPosts.length === 0) {
// // //           logInfo("⚠️ No posts found, scrolling...");
// // //           await performSmartScroll(page);
// // //           consecutiveErrors++;
          
// // //           if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
// // //             logError('❌ Too many consecutive errors finding posts. Stopping.');
// // //             break;
// // //           }
// // //           continue;
// // //         }

// // //         // Find first unprocessed post
// // //         let targetPost = null;
// // //         for (const post of allPosts) {
// // //           if (!processedPostUrls.has(post.postLink)) {
// // //             targetPost = post;
// // //             break;
// // //           }
// // //         }
        
// // //         // If all visible posts are processed, scroll for more
// // //         if (!targetPost) {
// // //           logInfo("⚠️ All visible posts already processed, scrolling for more...");
// // //           await performSmartScroll(page);
// // //           consecutiveNoNewPosts++;
          
// // //           if (consecutiveNoNewPosts >= MAX_NO_NEW_POSTS) {
// // //             logInfo('⚠️ No new posts found after multiple scrolls, ending search');
// // //             break;
// // //           }
// // //           continue;
// // //         }

// // //         // Reset counters when we find new posts
// // //         consecutiveNoNewPosts = 0;
// // //         consecutiveErrors = 0;
        
// // //         // Mark this post as processed
// // //         processedPostUrls.add(targetPost.postLink);
// // //         totalProcessed++;

// // //         logInfo(`📌 POST #${totalProcessed}: ${targetPost.postContent?.substring(0, 50)}...`);
// // //         logInfo(`   Author: @${targetPost.username}`);

// // //         // Scroll the post into view
// // //         await page.evaluate((idx) => {
// // //           const containers = document.querySelectorAll('div[data-pressable-container="true"]');
// // //           if (containers[idx]) {
// // //             containers[idx].scrollIntoView({ block: 'center', behavior: 'smooth' });
// // //           }
// // //         }, targetPost.index);
// // //         await sleep(randomDelay(1000, 2000));

// // //         // Perform interactions on the search page
// // //         const interactionResult = await performInteractionsOnSearchPage(page, targetPost, {
// // //           likeProbability,
// // //           commentProbability,
// // //           replyProbability,
// // //         });

// // //         // If we opened a post for comment/reply, use back button to return
// // //         if (interactionResult.navigatedToPost) {
// // //           logInfo('🔙 Using back button to return to search results...');
          
// // //           // Set up dialog handler BEFORE navigation to catch "Changes you made may not be saved"
// // //           const dialogHandler = async (dialog) => {
// // //             logInfo(`⚠️ Dialog detected: "${dialog.message()}"`);
// // //             if (dialog.message().includes('Changes you made') || 
// // //                 dialog.message().includes('may not be saved') ||
// // //                 dialog.message().includes('leave this page')) {
// // //               logInfo('✅ Accepting unsaved changes dialog...');
// // //               await dialog.accept();
// // //             } else {
// // //               await dialog.accept();
// // //             }
// // //           };
          
// // //           page.once('dialog', dialogHandler);
          
// // //           // Also try to dismiss any visible popups before going back
// // //           try {
// // //             await page.evaluate(() => {
// // //               // Press Escape key to close any modals
// // //               document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
// // //             });
// // //             await sleep(500);
// // //           } catch (e) {
// // //             // Ignore
// // //           }
          
// // //           try {
// // //             await page.goBack({
// // //               waitUntil: "domcontentloaded",
// // //               timeout: 30000,
// // //             });
// // //           } catch (navError) {
// // //             logError(`⚠️ Navigation error: ${navError.message}`);
// // //             // Try pressing Ctrl+Enter to dismiss any blocking popup
// // //             await page.keyboard.down('Control');
// // //             await page.keyboard.press('Enter');
// // //             await page.keyboard.up('Control');
// // //             await sleep(1000);
            
// // //             // Try navigation again
// // //             try {
// // //               await page.goBack({
// // //                 waitUntil: "domcontentloaded",
// // //                 timeout: 30000,
// // //               });
// // //             } catch (retryError) {
// // //               logError(`❌ Retry navigation failed: ${retryError.message}`);
// // //               // Force navigate to search URL as fallback
// // //               await page.goto(searchUrl, {
// // //                 waitUntil: "domcontentloaded",
// // //                 timeout: 30000,
// // //               });
// // //             }
// // //           }
          
// // //           await sleep(randomDelay(1500, 2500));
          
// // //           // Check for any remaining popups after navigation
// // //           await handleNotificationPopup(page);
// // //         }

// // //         // 30% probability to refresh the search page
// // //         const shouldRefresh = Math.random() < 0.3;
// // //         if (shouldRefresh) {
// // //           logInfo('🔄 (30% roll) Refreshing search page...');
// // //           await page.goto(searchUrl, {
// // //             waitUntil: "domcontentloaded",
// // //             timeout: 30000,
// // //           });
// // //           await sleep(randomDelay(2000, 3000));
// // //         }

// // //         // Scroll after processing
// // //         await performSmartScroll(page);
        
// // //       } catch (error) {
// // //         logError(`⚠️ Error processing post: ${error.message}`);
// // //         consecutiveErrors++;
        
// // //         if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
// // //           logError('❌ Too many consecutive errors. Stopping.');
// // //           break;
// // //         }
        
// // //         // Try to navigate back to search results on error
// // //         try {
// // //           await page.goto(searchUrl, {
// // //             waitUntil: "domcontentloaded",
// // //             timeout: 30000,
// // //           });
// // //           logInfo("🔄 Navigated back to search results after error");
// // //           await sleep(2000);
// // //         } catch (navError) {
// // //           logError(`❌ Failed to navigate back: ${navError.message}`);
// // //         }
        
// // //         await sleep(3000);
// // //         continue;
// // //       }
// // //     }

// // //     // ========================================================================
// // //     // PHASE 4: COMPLETION
// // //     // ========================================================================
// // //     logInfo('\n' + '='.repeat(80));
// // //     logSuccess(`✅ SEARCH BOT COMPLETED SUCCESSFULLY`);
// // //     logSuccess(`   Posts Processed: ${totalProcessed}`);
// // //     logInfo('='.repeat(80));

// // //     await logStructured(createLogEntry({
// // //       actionType: "SEARCH_BOT_END",
// // //       details: `Search bot completed: ${totalProcessed} posts processed`,
// // //       status: "SUCCESS",
// // //     }), "search_bot.json");

// // //     await closeBotGracefully(browser, username);

// // //     return {
// // //       success: true,
// // //       postsProcessed: totalProcessed,
// // //     };
// // //   } catch (error) {
// // //     logError('\n' + '='.repeat(80));
// // //     logError(`❌ SEARCH BOT FAILED: ${error.message}`);
// // //     logError('='.repeat(80));
// // //     await handleBotError(browser, error, username);
// // //     return {
// // //       success: false,
// // //       error: error.message,
// // //     };
// // //   }
// // // }

// // // /**
// // //  * Perform search on Threads
// // //  */
// // // async function performSearch(page, searchQuery) {
// // //   try {
// // //     const encodedQuery = encodeURIComponent(searchQuery);
// // //     const searchUrl = `https://www.threads.net/search?q=${encodedQuery}&serp_type=default`;

// // //     logInfo(`🔍 Navigating to search: ${searchQuery}`);
    
// // //     await page.goto(searchUrl, {
// // //       waitUntil: "domcontentloaded",
// // //       timeout: 60000,
// // //     });

// // //     // Wait for search results to load
// // //     await sleep(3000);

// // //     // Check if redirected to login
// // //     const currentUrl = page.url();
// // //     if (currentUrl.includes('/login')) {
// // //       throw new Error('❌ Redirected to login page during search - session expired');
// // //     }

// // //     logSuccess(`✅ Search page loaded`);
// // //   } catch (error) {
// // //     logError(`❌ Search navigation error: ${error.message}`);
// // //     throw error;
// // //   }
// // // }

// // // /**
// // //  * Extract posts from search results page (similar to home feed)
// // //  */
// // // async function extractPostsFromSearchPage(page) {
// // //   try {
// // //     await page.waitForSelector('div[data-pressable-container="true"]', {
// // //       timeout: 10000
// // //     }).catch(() => logInfo('⚠️ Timeout waiting for posts'));

// // //     await sleep(1000);

// // //     const posts = await page.evaluate(() => {
// // //       const containers = document.querySelectorAll('div[data-pressable-container="true"]');
// // //       const extractedPosts = [];

// // //       if (containers.length === 0) {
// // //         return [];
// // //       }

// // //       for (let idx = 0; idx < containers.length; idx++) {
// // //         const container = containers[idx];

// // //         // Extract profile link and username
// // //         const profileLink = container.querySelector('a[role="link"]');
// // //         const username = profileLink ? profileLink.textContent.trim() : "";

// // //         // Extract post content
// // //         const contentSpans = container.querySelectorAll('span');
// // //         let postContent = "";
// // //         for (const span of contentSpans) {
// // //           const text = span.textContent.trim();
// // //           if (text.length > 20 && text.length < 500) {
// // //             postContent = text;
// // //             break;
// // //           }
// // //         }

// // //         // Extract post link (use as unique ID)
// // //         const postLinks = container.querySelectorAll('a[href*="/post/"]');
// // //         const postLink = postLinks.length > 0 ? postLinks[0].getAttribute('href') : "";

// // //         // Only include posts with valid data
// // //         if (username && postLink) {
// // //           extractedPosts.push({
// // //             username,
// // //             postContent,
// // //             postLink,
// // //             index: idx
// // //           });
// // //         }
// // //       }

// // //       return extractedPosts;
// // //     });

// // //     logInfo(`   Found ${posts.length} posts on search page`);
// // //     return posts;
// // //   } catch (error) {
// // //     logError(`❌ Error extracting posts: ${error.message}`);
// // //     return [];
// // //   }
// // // }


// // // /**
// // //  * Navigate to post
// // //  */
// // // async function navigateToPost(page, postUrl) {
// // //   try {
// // //     const fullUrl = postUrl.startsWith('http') 
// // //       ? postUrl 
// // //       : `https://www.threads.net${postUrl}`;
      
// // //     await page.goto(fullUrl, {
// // //       waitUntil: "domcontentloaded",
// // //       timeout: 30000,
// // //     });
    
// // //     logInfo(`   Opened post: ${postUrl.substring(0, 50)}...`);
    
// // //     // Wait for post to load
// // //     await sleep(2000);
    
// // //     // Check if redirected to login
// // //     const currentUrl = page.url();
// // //     if (currentUrl.includes('/login')) {
// // //       throw new Error('Redirected to login when accessing post');
// // //     }
// // //   } catch (error) {
// // //     logError(`❌ Navigation error: ${error.message}`);
// // //     throw error;
// // //   }
// // // }

// // // /**
// // //  * Extract post details
// // //  */
// // // async function extractPostDetails(page) {
// // //   return await page.evaluate(() => {
// // //     let author = "";
// // //     const authorLinks = document.querySelectorAll('a[role="link"][href^="/@"]');
// // //     if (authorLinks.length > 0) {
// // //       const href = authorLinks[0].getAttribute("href");
// // //       author = href ? href.replace("/@", "").split("/")[0] : "";
// // //     }

// // //     let postText = "";
// // //     const textSpans = document.querySelectorAll("span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62");
// // //     for (const span of textSpans) {
// // //       const text = span.textContent?.trim();
// // //       if (text && text.length > 20) {
// // //         postText = text;
// // //         break;
// // //       }
// // //     }

// // //     const postIdMatch = window.location.pathname.match(/post\/([A-Za-z0-9_-]+)/);
// // //     const postId = postIdMatch ? postIdMatch[1] : "";

// // //     return {
// // //       postTitle: postText.substring(0, 100) + (postText.length > 100 ? "..." : ""),
// // //       author: author,
// // //       postLink: window.location.href,
// // //       postId: postId,
// // //       fullText: postText,
// // //     };
// // //   });
// // // }

// // // /**
// // //  * Perform interactions on search page (like on feed, navigate only if needed)
// // //  */
// // // async function performInteractionsOnSearchPage(page, targetPost, probabilities) {
// // //   let interactionsPerformed = 0;
// // //   let navigatedToPost = false;

// // //   // Like post (can be done on search page)
// // //   const likeRoll = Math.random();
// // //   logInfo(`   🎲 Like roll: ${(likeRoll * 100).toFixed(1)}% vs ${(probabilities.likeProbability * 100).toFixed(1)}%`);
// // //   if (likeRoll < probabilities.likeProbability) {
// // //     logInfo(`   👍 Attempting to like post...`);
// // //     const liked = await likePostOnSearchPage(page, targetPost.index);
// // //     if (liked) {
// // //       interactionsPerformed++;
// // //       logSuccess(`   ✅ Liked post`);
// // //     }
// // //   } else {
// // //     logInfo('   ⏭️ Skipped like (probability)');
// // //   }

// // //   // Comment on post (need to navigate to post)
// // //   const commentRoll = Math.random();
// // //   logInfo(`   🎲 Comment roll: ${(commentRoll * 100).toFixed(1)}% vs ${(probabilities.commentProbability * 100).toFixed(1)}%`);
// // //   if (commentRoll < probabilities.commentProbability) {
// // //     logInfo(`   💬 Attempting to comment...`);
// // //     const comment = await generateAIComment(targetPost.postContent || '');
// // //     if (comment) {
// // //       logInfo(`   💬 Generated comment: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"}`);
      
// // //       // Navigate to post
// // //       await navigateToPost(page, targetPost.postLink);
// // //       navigatedToPost = true;
// // //       await sleep(randomDelay(2000, 3000));
      
// // //       const postDetails = await extractPostDetails(page);
// // //       const commented = await postComment(page, comment, postDetails);
// // //       if (commented) {
// // //         interactionsPerformed++;
// // //         logSuccess(`   ✅ Commented: "${comment}"`);
// // //       }
// // //     }
// // //   } else {
// // //     logInfo('   ⏭️ Skipped comment (probability)');
// // //   }

// // //   // Reply to comment (need to navigate to post)
// // //   const replyRoll = Math.random();
// // //   logInfo(`   🎲 Reply roll: ${(replyRoll * 100).toFixed(1)}% vs ${(probabilities.replyProbability * 100).toFixed(1)}%`);
// // //   if (replyRoll < probabilities.replyProbability) {
// // //     logInfo(`   💭 Attempting to reply to comment...`);
    
// // //     // Navigate to post if not already there
// // //     if (!navigatedToPost) {
// // //       await navigateToPost(page, targetPost.postLink);
// // //       navigatedToPost = true;
// // //       await sleep(randomDelay(2000, 3000));
// // //     }
    
// // //     const postDetails = await extractPostDetails(page);
// // //     const replied = await replyToRandomComment(page, postDetails);
// // //     if (replied) {
// // //       interactionsPerformed++;
// // //     }
// // //   } else {
// // //     logInfo('   ⏭️ Skipped reply (probability)');
// // //   }

// // //   logSuccess(`   ✅ ${interactionsPerformed} interaction(s) performed`);
// // //   return { interactionsPerformed, navigatedToPost };
// // // }

// // // /**
// // //  * Like post directly on search page using index
// // //  */
// // // async function likePostOnSearchPage(page, postIndex) {
// // //   try {
// // //     await sleep(randomDelay(1500, 2500));

// // //     const likeResult = await page.evaluate((idx) => {
// // //       const allContainers = document.querySelectorAll('div[data-pressable-container="true"]');
// // //       if (idx >= allContainers.length) {
// // //         return { success: false, alreadyLiked: false, error: 'Container not found' };
// // //       }

// // //       const targetContainer = allContainers[idx];
// // //       let encounteredLiked = false;

// // //       const candidateSelectors = [
// // //         'div[role="button"][aria-label*="Like"]',
// // //         'div[role="button"] svg[aria-label="Like"]',
// // //         'svg[aria-label="Like"]',
// // //       ];

// // //       const clickButton = (node) => {
// // //         const button = node.closest('div[role="button"]') || (node.getAttribute?.('role') === 'button' ? node : null);
// // //         if (!button) return false;

// // //         const labelSource = button.getAttribute('aria-label') || node.getAttribute?.('aria-label') || '';
// // //         const normalizedLabel = labelSource.toLowerCase();

// // //         if (normalizedLabel.includes('unlike')) {
// // //           encounteredLiked = true;
// // //           return false;
// // //         }

// // //         if (!normalizedLabel.includes('like')) {
// // //           return false;
// // //         }

// // //         button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
// // //         button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
// // //         button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
// // //         button.click();

// // //         return true;
// // //       };

// // //       // Search ONLY in the target container
// // //       for (const selector of candidateSelectors) {
// // //         const elements = targetContainer.querySelectorAll(selector);
// // //         for (const el of elements) {
// // //           if (clickButton(el)) {
// // //             return { success: true, alreadyLiked: false };
// // //           }
// // //         }
// // //       }

// // //       return { success: false, alreadyLiked: encounteredLiked };
// // //     }, postIndex);

// // //     if (likeResult.success) {
// // //       await handleNotificationPopup(page);
// // //       return true;
// // //     } else if (likeResult.alreadyLiked) {
// // //       logInfo("   ⚠️ Post already liked");
// // //       return false;
// // //     } else {
// // //       logInfo("   ⚠️ Like button not found");
// // //       return false;
// // //     }
// // //   } catch (error) {
// // //     logError(`   ❌ Like error: ${error.message}`);
// // //     return false;
// // //   }
// // // }

// // // /**
// // //  * Original performInteractions for when we're on a post detail page
// // //  */
// // // async function performInteractions(page, postDetails, probabilities) {
// // //   let interactionsPerformed = 0;

// // //   // Like post
// // //   const likeRoll = Math.random();
// // //   logInfo(`   🎲 Like roll: ${(likeRoll * 100).toFixed(1)}% vs ${(probabilities.likeProbability * 100).toFixed(1)}%`);
// // //   if (likeRoll < probabilities.likeProbability) {
// // //     logInfo(`   👍 Attempting to like post...`);
// // //     const liked = await likePost(page, postDetails);
// // //     if (liked) {
// // //       interactionsPerformed++;
// // //       logSuccess(`   ✅ Liked post`);
// // //     }
// // //   } else {
// // //     logInfo('   ⏭️ Skipped like (probability)');
// // //   }

// // //   // Comment on post
// // //   const commentRoll = Math.random();
// // //   logInfo(`   🎲 Comment roll: ${(commentRoll * 100).toFixed(1)}% vs ${(probabilities.commentProbability * 100).toFixed(1)}%`);
// // //   if (commentRoll < probabilities.commentProbability) {
// // //     logInfo(`   💬 Attempting to comment...`);
// // //     const comment = await generateAIComment(postDetails.fullText);
// // //     if (comment) {
// // //       logInfo(`   💬 Generated comment: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"}`);
// // //       const commented = await postComment(page, comment, postDetails);
// // //       if (commented) {
// // //         interactionsPerformed++;
// // //         logSuccess(`   ✅ Commented: "${comment}"`);
// // //       }
// // //     }
// // //   } else {
// // //     logInfo('   ⏭️ Skipped comment (probability)');
// // //   }

// // //   // Reply to comment
// // //   const replyRoll = Math.random();
// // //   logInfo(`   🎲 Reply roll: ${(replyRoll * 100).toFixed(1)}% vs ${(probabilities.replyProbability * 100).toFixed(1)}%`);
// // //   if (replyRoll < probabilities.replyProbability) {
// // //     logInfo(`   💭 Attempting to reply to comment...`);
// // //     const replied = await replyToRandomComment(page, postDetails);
// // //     if (replied) {
// // //       interactionsPerformed++;
// // //     }
// // //   } else {
// // //     logInfo('   ⏭️ Skipped reply (probability)');
// // //   }

// // //   logSuccess(`   ✅ ${interactionsPerformed} interaction(s) performed`);
// // // }

// // // /**
// // //  * Like a post
// // //  */
// // // async function likePost(page, postDetails) {
// // //   try {
// // //     await sleep(randomDelay(1500, 2500));

// // //     const likeResult = await page.evaluate(() => {
// // //       const allContainers = document.querySelectorAll('div[data-pressable-container="true"]');
// // //       if (allContainers.length === 0) {
// // //         return { success: false, alreadyLiked: false, error: 'No containers found' };
// // //       }

// // //       // Target the first container (main post)
// // //       const targetContainer = allContainers[0];
// // //       let encounteredLiked = false;

// // //       const candidateSelectors = [
// // //         'div[role="button"][aria-label*="Like"]',
// // //         'div[role="button"] svg[aria-label="Like"]',
// // //         'svg[aria-label="Like"]',
// // //       ];

// // //       const clickButton = (node) => {
// // //         const button = node.closest('div[role="button"]') || (node.getAttribute?.('role') === 'button' ? node : null);
// // //         if (!button) return false;

// // //         const labelSource = button.getAttribute('aria-label') || node.getAttribute?.('aria-label') || '';
// // //         const normalizedLabel = labelSource.toLowerCase();

// // //         if (normalizedLabel.includes('unlike')) {
// // //           encounteredLiked = true;
// // //           return false;
// // //         }

// // //         if (!normalizedLabel.includes('like')) {
// // //           return false;
// // //         }

// // //         button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
// // //         button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
// // //         button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
// // //         button.click();

// // //         return true;
// // //       };

// // //       // Search ONLY in the target container
// // //       for (const selector of candidateSelectors) {
// // //         const elements = targetContainer.querySelectorAll(selector);
// // //         for (const el of elements) {
// // //           if (clickButton(el)) {
// // //             return { success: true, alreadyLiked: false };
// // //           }
// // //         }
// // //       }

// // //       return { success: false, alreadyLiked: encounteredLiked };
// // //     });

// // //     if (likeResult.success) {
// // //       await handleNotificationPopup(page);
// // //       await logStructured(createLogEntry({
// // //         actionType: "LIKE",
// // //         author: postDetails.author,
// // //         postTitle: postDetails.postTitle,
// // //         postLink: postDetails.postLink,
// // //         status: "SUCCESS",
// // //       }), "search_bot.json");
      
// // //       // Log to CSV
// // //       await logPostToCSV({
// // //         actionType: "LIKE",
// // //         status: "SUCCESS",
// // //         author: postDetails.author,
// // //         postContent: postDetails.postTitle,
// // //         postLink: postDetails.postLink,
// // //         module: "search.js"
// // //       });
      
// // //       return true;
// // //     } else if (likeResult.alreadyLiked) {
// // //       logInfo("   ⚠️ Post already liked");
// // //       return false;
// // //     } else {
// // //       logInfo("   ⚠️ Like button not found");
// // //       return false;
// // //     }
// // //   } catch (error) {
// // //     logError(`   ❌ Like error: ${error.message}`);
// // //     return false;
// // //   }
// // // }

// // // /**
// // //  * Post a comment
// // //  */
// // // async function postComment(page, commentText, postDetails) {
// // //   try {
// // //     await sleep(randomDelay(2000, 3000));

// // //     // Click reply button on the main post (first container)
// // //     const replyButtonClicked = await page.evaluate(() => {
// // //       const allContainers = document.querySelectorAll('div[data-pressable-container="true"]');
// // //       if (allContainers.length === 0) return false;
      
// // //       const targetContainer = allContainers[0];
      
// // //       // Search for Reply button ONLY in the target container
// // //       const buttons = targetContainer.querySelectorAll('div[role="button"]');
// // //       for (const btn of buttons) {
// // //         const svg = btn.querySelector('svg[aria-label="Reply"]');
// // //         if (svg) {
// // //           btn.click();
// // //           return true;
// // //         }
// // //       }
// // //       return false;
// // //     });

// // //     if (!replyButtonClicked) {
// // //       logInfo("   ⚠️ Reply button not found");
// // //       return false;
// // //     }

// // //     await sleep(randomDelay(2000, 3000));

// // //     const commentInput = await page.waitForSelector('div[contenteditable="true"]', {
// // //       timeout: 10000,
// // //     });

// // //     if (!commentInput) {
// // //       logError("   ❌ Comment input not found");
// // //       return false;
// // //     }

// // //     await commentInput.click();
// // //     await sleep(500);
// // //     await commentInput.type(commentText, { delay: randomDelay(100, 200) });
// // //     await sleep(randomDelay(2000, 3000));

// // //     // Submit via keyboard
// // //     await page.keyboard.down("Control");
// // //     await page.keyboard.press("Enter");
// // //     await page.keyboard.up("Control");
// // //     await sleep(2000);

// // //     await handleNotificationPopup(page);
    
// // //     await logStructured(createLogEntry({
// // //       actionType: "COMMENT",
// // //       author: postDetails.author,
// // //       postTitle: postDetails.postTitle,
// // //       postLink: postDetails.postLink,
// // //       commentText: commentText,
// // //       status: "SUCCESS",
// // //     }), "search_bot.json");
    
// // //     // Log to CSV
// // //     await logPostToCSV({
// // //       actionType: "COMMENT",
// // //       status: "SUCCESS",
// // //       author: postDetails.author,
// // //       postContent: postDetails.postTitle,
// // //       generatedText: commentText,
// // //       postLink: postDetails.postLink,
// // //       module: "search.js"
// // //     });
    
// // //     return true;
// // //   } catch (error) {
// // //     logError(`   ❌ Comment error: ${error.message}`);
// // //     return false;
// // //   }
// // // }

// // // /**
// // //  * Reply to a random comment
// // //  */
// // // async function replyToRandomComment(page, postDetails) {
// // //   try {
// // //     // Extract comments from containers (skip first which is the main post)
// // //     const comments = await page.evaluate(() => {
// // //       const commentContainers = document.querySelectorAll('div[data-pressable-container="true"]');
// // //       const extractedComments = [];

// // //       // Start from index 1 to skip the main post (index 0)
// // //       for (let i = 1; i < Math.min(commentContainers.length, 6); i++) {
// // //         const container = commentContainers[i];

// // //         const authorLink = container.querySelector('a[href^="/@"]');
// // //         const author = authorLink ? authorLink.getAttribute('href').replace('/@', '').split('/')[0] : "";

// // //         const textSpans = container.querySelectorAll('span');
// // //         let commentText = "";
// // //         for (const span of textSpans) {
// // //           const text = span.textContent.trim();
// // //           if (text.length > 10 && text.length < 200 && !text.includes('ago')) {
// // //             commentText = text;
// // //             break;
// // //           }
// // //         }

// // //         if (author && commentText) {
// // //           extractedComments.push({ author, text: commentText, index: i });
// // //         }
// // //       }

// // //       return extractedComments;
// // //     });

// // //     if (comments.length === 0) {
// // //       logInfo(`   ⚠️ No comments found on post`);
// // //       return false;
// // //     }

// // //     logInfo(`   📝 Found ${comments.length} comments`);
// // //     const randomComment = comments[Math.floor(Math.random() * comments.length)];
// // //     logInfo(`   💭 Found comment by @${randomComment.author}: "${randomComment.text.substring(0, 40)}..."`);
    
// // //     const reply = await generateAIReply(randomComment.author, randomComment.text, postDetails.fullText);

// // //     if (reply) {
// // //       logInfo(`   💭 Generated reply: "${reply.substring(0, 50)}${reply.length > 50 ? '...' : ''}"}`);
      
// // //       // Click reply button on the specific comment container
// // //       const replyClicked = await page.evaluate((commentIndex) => {
// // //         const commentContainers = document.querySelectorAll('div[data-pressable-container="true"]');
// // //         if (commentIndex >= commentContainers.length) return false;
        
// // //         const targetContainer = commentContainers[commentIndex];
        
// // //         // Find reply button using the specific selector structure
// // //         const replyButtons = targetContainer.querySelectorAll('div[role="button"]');
// // //         for (const btn of replyButtons) {
// // //           const svg = btn.querySelector('svg[aria-label="Reply"]');
// // //           if (svg) {
// // //             // Scroll into view first
// // //             targetContainer.scrollIntoView({ block: 'center', behavior: 'smooth' });
// // //             btn.click();
// // //             return true;
// // //           }
// // //         }
// // //         return false;
// // //       }, randomComment.index);

// // //       if (!replyClicked) {
// // //         logInfo("   ⚠️ Reply button not found");
// // //         return false;
// // //       }

// // //       await sleep(randomDelay(2000, 3000));
      
// // //       const replyInput = await page.waitForSelector('div[contenteditable="true"]', { 
// // //         timeout: 10000 
// // //       });
      
// // //       if (!replyInput) {
// // //         logError("   ❌ Reply input not found");
// // //         return false;
// // //       }

// // //       await replyInput.click();
// // //       await sleep(500);
// // //       await replyInput.type(reply, { delay: randomDelay(100, 200) });
// // //       await sleep(randomDelay(2000, 3000));
      
// // //       // Submit reply
// // //       await page.keyboard.down("Control");
// // //       await page.keyboard.press("Enter");
// // //       await page.keyboard.up("Control");
// // //       await sleep(2000);
      
// // //       await handleNotificationPopup(page);
      
// // //       logSuccess(`   ✅ Replied to @${randomComment.author}: "${reply}"`);
      
// // //       await logStructured(createLogEntry({
// // //         actionType: "REPLY",
// // //         author: randomComment.author,
// // //         commentText: randomComment.text,
// // //         postLink: postDetails.postLink,
// // //         replyText: reply,
// // //         status: "SUCCESS",
// // //       }), "search_bot.json");
      
// // //       // Log to CSV
// // //       await logPostToCSV({
// // //         actionType: "REPLY",
// // //         status: "SUCCESS",
// // //         username: randomComment.author,
// // //         author: postDetails.author,
// // //         postContent: postDetails.postTitle,
// // //         generatedText: reply,
// // //         postLink: postDetails.postLink,
// // //         module: "search.js"
// // //       });
      
// // //       return true;
// // //     }
    
// // //     return false;
// // //   } catch (error) {
// // //     logError(`   ❌ Reply error: ${error.message}`);
// // //     return false;
// // //   }
// // // }

// // // export default runSearchBot;
