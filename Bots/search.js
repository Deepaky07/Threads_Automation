// ============================================================================
// SIMPLIFIED search.js - Trust the Bootstrap Process
// ============================================================================

import { initializeBotWithSession, closeBotGracefully, handleBotError } from "../helpers/botBootstrap.js";
import { logInfo, logSuccess, logError, sleep, randomDelay, logStructured, createLogEntry } from "../utils/logger.js";
import { generateAIComment, generateAIReply } from "../helpers/aiGeneration.js";
import { logPostToCSV } from "../utils/csvLogger.js";


/**
 * Smart scroll function to load more posts without leaving the page
 */
async function performSmartScroll(page) {
  try {
    const scrollResult = await page.evaluate(() => {
      const beforeScroll = window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const currentBottom = beforeScroll + viewportHeight;

      const spaceLeft = documentHeight - currentBottom;
      const nearBottom = spaceLeft < 500;

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
        viewportHeight
      };
    });

    logInfo(`📜 Scrolled ${scrollResult.scrollAmount}px | Space left: ${scrollResult.spaceLeft}px`);

    await sleep(randomDelay(1500, 2500));

    // Wait longer if near bottom for new content to load
    if (scrollResult.nearBottom) {
      logInfo('⏳ Near bottom, waiting for new content...');
      await sleep(randomDelay(2000, 3000));
    }

    return scrollResult;
  } catch (error) {
    logError(`❌ Error during scroll: ${error.message}`);
    return null;
  }
}

/**
 * Check for notification popup and press Ctrl+Enter if present
 * Also checks for "Changes you made may not be saved" alert
 */
async function handleNotificationPopup(page) {
  try {
    await sleep(1500); // Wait for notification to appear
    
    // Check if a notification/modal popup is visible
    const popupInfo = await page.evaluate(() => {
      // Check for "Changes you made may not be saved" text
      const bodyText = document.body.innerText || document.body.textContent || '';
      const hasUnsavedChangesAlert = bodyText.includes('Changes you made may not be saved') || 
                                      bodyText.includes('changes you made') ||
                                      bodyText.includes('may not be saved');
      
      // Check for error alerts like "Post failed to upload"
      const alertSelectors = [
        'div[class*="html-div"]',
        'div[role="alert"]',
        'div[aria-live="polite"]',
        'div[aria-live="assertive"]',
      ];
      
      let errorAlert = null;
      for (const selector of alertSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent?.trim();
          if (!text || text.length < 3) continue;
          
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          
          const lowerText = text.toLowerCase();
          if (lowerText.includes('failed') || 
              lowerText.includes('failed to upload') ||
              lowerText.includes('error') || 
              lowerText.includes('couldn\'t') || 
              lowerText.includes('unable to') ||
              lowerText.includes('something went wrong')) {
            errorAlert = { found: true, type: 'error', message: text };
            break;
          }
        }
        if (errorAlert) break;
      }
      
      // Check for various popup indicators
      const checks = {
        unsavedChanges: hasUnsavedChangesAlert,
        errorAlert: errorAlert,
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
        .filter(([key, val]) => val !== null && val !== undefined && val !== false)
        .map(([key]) => key);
      
      // Priority check for error alerts
      if (errorAlert) {
        return { found: true, type: 'error', message: errorAlert.message, foundElements: found };
      }
      
      // Priority check for unsaved changes alert
      if (hasUnsavedChangesAlert) {
        return { found: true, type: 'unsavedChanges', foundElements: found };
      }
      
      // Check if any element is visible and interactive
      for (const [key, element] of Object.entries(checks)) {
        if (element && typeof element === 'object' && element.offsetParent !== null) {
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
      if (popupInfo.type === 'error') {
        logError(`❌ Error alert detected: ${popupInfo.message || 'Unknown error'}`);
        return true; // Return true to indicate error was detected
      } else if (popupInfo.type === 'unsavedChanges') {
        logInfo(`⚠️ "Changes you made may not be saved" alert detected, pressing Ctrl+Enter...`);
      } else {
        logInfo(`📬 Notification popup detected (${popupInfo.type}), pressing Ctrl+Enter...`);
      }
      
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
      logSuccess('✅ Pressed Ctrl+Enter on popup/alert');
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

/**
 * Main search and interact bot function
 * @param {Object} config - Bot configuration
 * @returns {Promise<Object>} Bot results
 */
export async function runSearchBot(config) {
  const {
    username,
    password,
    searchQuery,
    numPosts = 10,
    searchDurationMinutes = 30,
    likeProbability = 0.4,
    commentProbability = 0.13,
    replyProbability = 0.13,
  } = config;

  let browser = null;
  let totalProcessed = 0;
  
  // ✅ Track interaction stats
  const stats = {
    likes: 0,
    comments: 0,
    replies: 0,
  };

  try {
    logInfo('='.repeat(80));
    logInfo(`🚀 SEARCH BOT STARTING - User: ${username}`);
    logInfo('='.repeat(80));
    
    // ========================================================================
    // PHASE 1: INITIALIZE BROWSER AND LOGIN
    // ========================================================================
    logInfo('📋 PHASE 1: Browser Initialization & Login');
    logInfo('-'.repeat(80));
    
    // ✅ Trust the bootstrap - it handles everything (session restore + login)
    const { browser: browserInstance, page } = await initializeBotWithSession({
      username,
      password,
      botType: 'search',
      headless: config.headless !== undefined ? config.headless : false,
      chromePath: config.chromePath || null,
    });

    browser = browserInstance;
    logSuccess('✅ Bot initialized - Login complete');

    // ========================================================================
    // PHASE 2: VERIFY WE'RE READY
    // ========================================================================
    logInfo('\n📋 PHASE 2: Final Verification');
    logInfo('-'.repeat(80));
    
    // Navigate to home to be sure
    await page.goto('https://www.threads.net/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    await sleep(3000);
    
    const currentUrl = page.url();
    logInfo(`📍 Current URL: ${currentUrl}`);
    
    // Final safety check
    if (currentUrl.includes('/login')) {
      await page.screenshot({ path: `search_bot_still_login_${Date.now()}.png` });
      throw new Error('❌ Login verification failed - still on login page');
    }
    
    logSuccess('✅ Ready to start search bot');

    // ========================================================================
    // PHASE 3: START SEARCH BOT
    // ========================================================================
    logInfo('\n📋 PHASE 3: Search Bot Execution');
    logInfo('-'.repeat(80));
    logInfo(`🔍 Search Query: "${searchQuery}"`);
    logInfo(`⚙️ Posts to Process: ${numPosts}`);
    logInfo(`⏱️ Duration: ${searchDurationMinutes} minutes`);
    logInfo(`📊 Probabilities: Like=${(likeProbability * 100).toFixed(1)}% | Comment=${(commentProbability * 100).toFixed(1)}% | Reply=${(replyProbability * 100).toFixed(1)}%`);
    logInfo(`📊 Probability values: likeProbability=${likeProbability}, commentProbability=${commentProbability}, replyProbability=${replyProbability}`);
    logInfo('-'.repeat(80));

    await logStructured(createLogEntry({
      actionType: "SEARCH_BOT_START",
      details: `Search bot started for query: ${searchQuery}`,
      status: "SUCCESS",
    }), "search_bot.json");

    const endTime = Date.now() + searchDurationMinutes * 60 * 1000;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;
    let processedPostUrls = new Set(); // Track actually processed posts to avoid duplicates
    let needsNewPosts = true;
    const searchUrl = `https://www.threads.net/search?q=${encodeURIComponent(searchQuery)}&serp_type=default`;

    // Perform initial search once
    await performSearch(page, searchQuery);
    await sleep(randomDelay(3000, 5000));

    // Initial scroll to trigger content loading
    await page.evaluate(() => window.scrollBy(0, 200));
    await sleep(2000);

    let consecutiveNoNewPosts = 0;
    const MAX_NO_NEW_POSTS = 10; // Increased from 5 to 10 for better persistence

    while (Date.now() < endTime && totalProcessed < numPosts) {
      try {
        logInfo(`\n🔄 Processing post ${totalProcessed + 1}/${numPosts}`);
        
        // Extract posts from current search page
        const allPosts = await extractPostsFromSearchPage(page);
        
        if (allPosts.length === 0) {
          logInfo("⚠️ No posts found, scrolling...");
          await performSmartScroll(page);
          consecutiveErrors++;
          
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            logError('❌ Too many consecutive errors finding posts. Stopping.');
            break;
          }
          continue;
        }

        // Find first unprocessed post
        let targetPost = null;
        for (const post of allPosts) {
          if (!processedPostUrls.has(post.postLink)) {
            targetPost = post;
            break;
          }
        }
        
        // If all visible posts are processed, scroll for more
        if (!targetPost) {
          logInfo(`⚠️ All visible posts already processed (${allPosts.length} posts), scrolling for more... (attempt ${consecutiveNoNewPosts + 1}/${MAX_NO_NEW_POSTS})`);
          
          // Try multiple scroll strategies
          await performSmartScroll(page);
          await sleep(randomDelay(2000, 3000));
          
          // If still no new posts, try refreshing the search page
          if (consecutiveNoNewPosts >= 3 && consecutiveNoNewPosts % 3 === 0) {
            logInfo('🔄 Refreshing search page to load more results...');
            await page.goto(searchUrl, {
              waitUntil: "domcontentloaded",
              timeout: 30000,
            });
            await sleep(randomDelay(3000, 5000));
            // Re-extract posts after refresh
            const refreshedPosts = await extractPostsFromSearchPage(page);
            logInfo(`📊 Found ${refreshedPosts.length} posts after refresh`);
          }
          
          consecutiveNoNewPosts++;
          
          if (consecutiveNoNewPosts >= MAX_NO_NEW_POSTS) {
            logInfo(`⚠️ No new posts found after ${MAX_NO_NEW_POSTS} attempts. Processed ${totalProcessed}/${numPosts} posts.`);
            logInfo(`💡 This might mean the search query has limited results, or we've reached the end of available posts.`);
            break;
          }
          continue;
        }

        // Reset counters when we find new posts
        consecutiveNoNewPosts = 0;
        consecutiveErrors = 0;
        
        // Mark this post as processed
        processedPostUrls.add(targetPost.postLink);
        totalProcessed++;

        logInfo(`📌 POST #${totalProcessed}: ${targetPost.postContent?.substring(0, 50)}...`);
        logInfo(`   Author: @${targetPost.username}`);

        // Scroll the post into view
        await page.evaluate((idx) => {
          const containers = document.querySelectorAll('div[data-pressable-container="true"]');
          if (containers[idx]) {
            containers[idx].scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }, targetPost.index);
        await sleep(randomDelay(1000, 2000));

        // Perform interactions on the search page
        const probabilities = {
          likeProbability,
          commentProbability,
          replyProbability,
        };
        
        // Log probabilities being used
        logInfo(`   📊 Using probabilities: Like=${(likeProbability * 100).toFixed(1)}%, Comment=${(commentProbability * 100).toFixed(1)}%, Reply=${(replyProbability * 100).toFixed(1)}%`);
        
        const interactionResult = await performInteractionsOnSearchPage(page, targetPost, probabilities, username);
        
        // Update stats from interactions
        if (interactionResult.liked) stats.likes++;
        if (interactionResult.commented) stats.comments++;
        if (interactionResult.replied) stats.replies++;

        // If we opened a post for comment/reply, use back button to return
        if (interactionResult.navigatedToPost) {
          logInfo('🔙 Using back button to return to search results...');
          
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
          
          // Also try to dismiss any visible popups before going back
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
            await page.goBack({
              waitUntil: "domcontentloaded",
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
              await page.goBack({
                waitUntil: "domcontentloaded",
                timeout: 30000,
              });
            } catch (retryError) {
              logError(`❌ Retry navigation failed: ${retryError.message}`);
              // Force navigate to search URL as fallback
              await page.goto(searchUrl, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
              });
            }
          }
          
          // Remove dialog listener after navigation
          page.off('dialog', dialogHandler);
          
          await sleep(randomDelay(1500, 2500));
          
          // Check for any remaining popups after navigation
          await handleNotificationPopup(page);
        }

        // 30% probability to refresh the search page
        const shouldRefresh = Math.random() < 0.3;
        if (shouldRefresh) {
          logInfo('🔄 (30% roll) Refreshing search page...');
          await page.goto(searchUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          await sleep(randomDelay(2000, 3000));
        }

        // Scroll after processing
        await performSmartScroll(page);
        
        // Log progress with stats
        logInfo(`📊 Progress: ${totalProcessed}/${numPosts} posts | ❤️ ${stats.likes} likes | 💬 ${stats.comments} comments | 💭 ${stats.replies} replies`);
        
        // Delay after processing each post
        await sleep(randomDelay(4000, 7000));
        
      } catch (error) {
        logError(`⚠️ Error processing post: ${error.message}`);
        consecutiveErrors++;
        
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          logError('❌ Too many consecutive errors. Stopping.');
          break;
        }
        
        // Try to navigate back to search results on error
        try {
          await page.goto(searchUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          logInfo("🔄 Navigated back to search results after error");
          await sleep(2000);
        } catch (navError) {
          logError(`❌ Failed to navigate back: ${navError.message}`);
        }
        
        await sleep(3000);
        continue;
      }
    }

    // ========================================================================
    // PHASE 4: COMPLETION
    // ========================================================================
    logInfo('\n' + '='.repeat(80));
    logSuccess(`✅ SEARCH BOT COMPLETED SUCCESSFULLY`);
    logSuccess(`   Posts Processed: ${totalProcessed}`);
    logSuccess(`   ❤️ Likes: ${stats.likes}`);
    logSuccess(`   💬 Comments: ${stats.comments}`);
    logSuccess(`   💭 Replies: ${stats.replies}`);
    logSuccess(`   📊 Total Interactions: ${stats.likes + stats.comments + stats.replies}`);
    logInfo('='.repeat(80));

    await logStructured(createLogEntry({
      actionType: "SEARCH_BOT_END",
      details: `Search bot completed: ${totalProcessed} posts processed, ${stats.likes} likes, ${stats.comments} comments, ${stats.replies} replies`,
      status: "SUCCESS",
    }), "search_bot.json");

    await closeBotGracefully(browser, username);

    return {
      success: true,
      postsProcessed: totalProcessed,
      stats: {
        likes: stats.likes,
        comments: stats.comments,
        replies: stats.replies,
        totalInteractions: stats.likes + stats.comments + stats.replies,
      },
    };
  } catch (error) {
    logError('\n' + '='.repeat(80));
    logError(`❌ SEARCH BOT FAILED: ${error.message}`);
    logError('='.repeat(80));
    await handleBotError(browser, error, username);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Perform search on Threads
 */
async function performSearch(page, searchQuery) {
  try {
    const encodedQuery = encodeURIComponent(searchQuery);
    const searchUrl = `https://www.threads.net/search?q=${encodedQuery}&serp_type=default`;

    logInfo(`🔍 Navigating to search: ${searchQuery}`);
    
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Wait for search results to load
    await sleep(3000);

    // Check if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('❌ Redirected to login page during search - session expired');
    }

    logSuccess(`✅ Search page loaded`);
  } catch (error) {
    logError(`❌ Search navigation error: ${error.message}`);
    throw error;
  }
}

/**
 * Extract posts from search results page (similar to home feed)
 */
async function extractPostsFromSearchPage(page) {
  try {
    await page.waitForSelector('div[data-pressable-container="true"]', {
      timeout: 10000
    }).catch(() => logInfo('⚠️ Timeout waiting for posts'));

    await sleep(1000);

    const posts = await page.evaluate(() => {
      const containers = document.querySelectorAll('div[data-pressable-container="true"]');
      const extractedPosts = [];

      if (containers.length === 0) {
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

        // Only include posts with valid data
        if (username && postLink) {
          extractedPosts.push({
            username,
            postContent,
            postLink,
            index: idx
          });
        }
      }

      return extractedPosts;
    });

    logInfo(`   Found ${posts.length} posts on search page`);
    return posts;
  } catch (error) {
    logError(`❌ Error extracting posts: ${error.message}`);
    return [];
  }
}


/**
 * Navigate to post
 */
async function navigateToPost(page, postUrl) {
  try {
    const fullUrl = postUrl.startsWith('http') 
      ? postUrl 
      : `https://www.threads.net${postUrl}`;
      
    await page.goto(fullUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    
    logInfo(`   Opened post: ${postUrl.substring(0, 50)}...`);
    
    // Wait for post to load
    await sleep(2000);
    
    // Check if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('Redirected to login when accessing post');
    }
  } catch (error) {
    logError(`❌ Navigation error: ${error.message}`);
    throw error;
  }
}

/**
 * Extract post details
 */
async function extractPostDetails(page) {
  return await page.evaluate(() => {
    let author = "";
    const authorLinks = document.querySelectorAll('a[role="link"][href^="/@"]');
    if (authorLinks.length > 0) {
      const href = authorLinks[0].getAttribute("href");
      author = href ? href.replace("/@", "").split("/")[0] : "";
    }

    let postText = "";
    const textSpans = document.querySelectorAll("span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62");
    for (const span of textSpans) {
      const text = span.textContent?.trim();
      if (text && text.length > 20) {
        postText = text;
        break;
      }
    }

    const postIdMatch = window.location.pathname.match(/post\/([A-Za-z0-9_-]+)/);
    const postId = postIdMatch ? postIdMatch[1] : "";

    return {
      postTitle: postText.substring(0, 100) + (postText.length > 100 ? "..." : ""),
      author: author,
      postLink: window.location.href,
      postId: postId,
      fullText: postText,
    };
  });
}

/**
 * Perform interactions on search page (like on feed, navigate only if needed)
 */
async function performInteractionsOnSearchPage(page, targetPost, probabilities, username) {
  let interactionsPerformed = 0;
  let navigatedToPost = false;
  let liked = false;
  let commented = false;
  let replied = false;

  // Validate probabilities are valid numbers
  const likeProb = typeof probabilities.likeProbability === 'number' && !isNaN(probabilities.likeProbability) ? probabilities.likeProbability : 0;
  const commentProb = typeof probabilities.commentProbability === 'number' && !isNaN(probabilities.commentProbability) ? probabilities.commentProbability : 0;
  const replyProb = typeof probabilities.replyProbability === 'number' && !isNaN(probabilities.replyProbability) ? probabilities.replyProbability : 0;

  // Like post (can be done on search page)
  const likeRoll = Math.random();
  logInfo(`   🎲 Like roll: ${(likeRoll * 100).toFixed(1)}% vs ${(likeProb * 100).toFixed(1)}% (threshold)`);
  if (likeRoll < likeProb) {
    logInfo(`   👍 Attempting to like post...`);
    liked = await likePostOnSearchPage(page, targetPost.index, username, targetPost);
    if (liked) {
      interactionsPerformed++;
      logSuccess(`   ✅ Liked post`);
    }
  } else {
    logInfo('   ⏭️ Skipped like (probability)');
  }

  // Comment on post (need to navigate to post)
  const commentRoll = Math.random();
  logInfo(`   🎲 Comment roll: ${(commentRoll * 100).toFixed(1)}% vs ${(commentProb * 100).toFixed(1)}% (threshold)`);
  if (commentRoll < commentProb) {
    logInfo(`   💬 Attempting to comment...`);
    const comment = await generateAIComment(targetPost.postContent || '');
    if (comment) {
      logInfo(`   💬 Generated comment: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"}`);
      
      // Navigate to post
      await navigateToPost(page, targetPost.postLink);
      navigatedToPost = true;
      await sleep(randomDelay(2000, 3000));
      
      const postDetails = await extractPostDetails(page);
      commented = await postComment(page, comment, postDetails, username);
      if (commented) {
        interactionsPerformed++;
        logSuccess(`   ✅ Commented: "${comment}"`);
      }
    }
  } else {
    logInfo('   ⏭️ Skipped comment (probability)');
  }

  // Reply to comment (need to navigate to post)
  const replyRoll = Math.random();
  logInfo(`   🎲 Reply roll: ${(replyRoll * 100).toFixed(1)}% vs ${(replyProb * 100).toFixed(1)}% (threshold)`);
  if (replyRoll < replyProb) {
    logInfo(`   💭 Attempting to reply to comment...`);
    
    // Navigate to post if not already there
    if (!navigatedToPost) {
      await navigateToPost(page, targetPost.postLink);
      navigatedToPost = true;
      await sleep(randomDelay(2000, 3000));
    }
    
    const postDetails = await extractPostDetails(page);
    replied = await replyToRandomComment(page, postDetails, username);
    if (replied) {
      interactionsPerformed++;
    }
  } else {
    logInfo('   ⏭️ Skipped reply (probability)');
  }

  logSuccess(`   ✅ ${interactionsPerformed} interaction(s) performed`);
  return { interactionsPerformed, navigatedToPost, liked, commented, replied };
}

/**
 * Like post directly on search page using index
 */
async function likePostOnSearchPage(page, postIndex, username, targetPost) {
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
      
      // Log to CSV
      await logPostToCSV({
        actionType: "LIKE",
        status: "SUCCESS",
        username: username, // Bot username
        author: targetPost.username, // Post author
        postContent: targetPost.postContent || '',
        postLink: targetPost.postLink || '',
        module: "search.js"
      });
      
      return true;
    } else if (likeResult.alreadyLiked) {
      logInfo("   ⚠️ Post already liked");
      return false;
    } else {
      logInfo("   ⚠️ Like button not found");
      return false;
    }
  } catch (error) {
    logError(`   ❌ Like error: ${error.message}`);
    return false;
  }
}

/**
 * Original performInteractions for when we're on a post detail page
 */
async function performInteractions(page, postDetails, probabilities) {
  let interactionsPerformed = 0;

  // Validate probabilities are valid numbers
  const likeProb = typeof probabilities.likeProbability === 'number' && !isNaN(probabilities.likeProbability) ? probabilities.likeProbability : 0;
  const commentProb = typeof probabilities.commentProbability === 'number' && !isNaN(probabilities.commentProbability) ? probabilities.commentProbability : 0;
  const replyProb = typeof probabilities.replyProbability === 'number' && !isNaN(probabilities.replyProbability) ? probabilities.replyProbability : 0;

  // Like post
  const likeRoll = Math.random();
  logInfo(`   🎲 Like roll: ${(likeRoll * 100).toFixed(1)}% vs ${(likeProb * 100).toFixed(1)}% (threshold)`);
  if (likeRoll < likeProb) {
    logInfo(`   👍 Attempting to like post...`);
    const liked = await likePost(page, postDetails);
    if (liked) {
      interactionsPerformed++;
      logSuccess(`   ✅ Liked post`);
    }
  } else {
    logInfo('   ⏭️ Skipped like (probability)');
  }

  // Comment on post
  const commentRoll = Math.random();
  logInfo(`   🎲 Comment roll: ${(commentRoll * 100).toFixed(1)}% vs ${(commentProb * 100).toFixed(1)}% (threshold)`);
  if (commentRoll < commentProb) {
    logInfo(`   💬 Attempting to comment...`);
    const comment = await generateAIComment(postDetails.fullText);
    if (comment) {
      logInfo(`   💬 Generated comment: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"}`);
      const commented = await postComment(page, comment, postDetails);
      if (commented) {
        interactionsPerformed++;
        logSuccess(`   ✅ Commented: "${comment}"`);
      }
    }
  } else {
    logInfo('   ⏭️ Skipped comment (probability)');
  }

  // Reply to comment
  const replyRoll = Math.random();
  logInfo(`   🎲 Reply roll: ${(replyRoll * 100).toFixed(1)}% vs ${(replyProb * 100).toFixed(1)}% (threshold)`);
  if (replyRoll < replyProb) {
    logInfo(`   💭 Attempting to reply to comment...`);
    const replied = await replyToRandomComment(page, postDetails);
    if (replied) {
      interactionsPerformed++;
    }
  } else {
    logInfo('   ⏭️ Skipped reply (probability)');
  }

  logSuccess(`   ✅ ${interactionsPerformed} interaction(s) performed`);
}

/**
 * Like a post
 */
async function likePost(page, postDetails) {
  try {
    await sleep(randomDelay(1500, 2500));

    const likeResult = await page.evaluate(() => {
      const allContainers = document.querySelectorAll('div[data-pressable-container="true"]');
      if (allContainers.length === 0) {
        return { success: false, alreadyLiked: false, error: 'No containers found' };
      }

      // Target the first container (main post)
      const targetContainer = allContainers[0];
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
    });

    if (likeResult.success) {
      await handleNotificationPopup(page);
      await logStructured(createLogEntry({
        actionType: "LIKE",
        author: postDetails.author,
        postTitle: postDetails.postTitle,
        postLink: postDetails.postLink,
        status: "SUCCESS",
      }), "search_bot.json");
      
      // Log to CSV
      await logPostToCSV({
        actionType: "LIKE",
        status: "SUCCESS",
        username: username, // Bot username
        author: postDetails.author,
        postContent: postDetails.postTitle,
        postLink: postDetails.postLink,
        module: "search.js"
      });
      
      return true;
    } else if (likeResult.alreadyLiked) {
      logInfo("   ⚠️ Post already liked");
      return false;
    } else {
      logInfo("   ⚠️ Like button not found");
      return false;
    }
  } catch (error) {
    logError(`   ❌ Like error: ${error.message}`);
    return false;
  }
}

/**
 * Post a comment
 */
async function postComment(page, commentText, postDetails, username) {
  try {
    await sleep(randomDelay(2000, 3000));

    // Click reply button on the main post (first container)
    const replyButtonClicked = await page.evaluate(() => {
      const allContainers = document.querySelectorAll('div[data-pressable-container="true"]');
      if (allContainers.length === 0) return false;
      
      const targetContainer = allContainers[0];
      
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
    });

    if (!replyButtonClicked) {
      logInfo("   ⚠️ Reply button not found");
      return false;
    }

    await sleep(randomDelay(2000, 3000));

    const commentInput = await page.waitForSelector('div[contenteditable="true"]', {
      timeout: 10000,
    });

    if (!commentInput) {
      logError("   ❌ Comment input not found");
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
    
    await logStructured(createLogEntry({
      actionType: "COMMENT",
      author: postDetails.author,
      postTitle: postDetails.postTitle,
      postLink: postDetails.postLink,
      commentText: commentText,
      status: "SUCCESS",
    }), "search_bot.json");
    
    // Log to CSV
    await logPostToCSV({
      actionType: "COMMENT",
      status: "SUCCESS",
      username: username, // Bot username
      author: postDetails.author,
      postContent: postDetails.postTitle,
      generatedText: commentText,
      postLink: postDetails.postLink,
      module: "search.js"
    });
    
    return true;
  } catch (error) {
    logError(`   ❌ Comment error: ${error.message}`);
    return false;
  }
}

/**
 * Reply to a random comment
 */
async function replyToRandomComment(page, postDetails, username) {
  try {
    // Extract comments from containers (skip first which is the main post)
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

    if (comments.length === 0) {
      logInfo(`   ⚠️ No comments found on post`);
      return false;
    }

    logInfo(`   📝 Found ${comments.length} comments`);
    const randomComment = comments[Math.floor(Math.random() * comments.length)];
    logInfo(`   💭 Found comment by @${randomComment.author}: "${randomComment.text.substring(0, 40)}..."`);
    
    const reply = await generateAIReply(randomComment.author, randomComment.text, postDetails.fullText);

    if (reply) {
      logInfo(`   💭 Generated reply: "${reply.substring(0, 50)}${reply.length > 50 ? '...' : ''}"}`);
      
      // Click reply button on the specific comment container
      const replyClicked = await page.evaluate((commentIndex) => {
        const commentContainers = document.querySelectorAll('div[data-pressable-container="true"]');
        if (commentIndex >= commentContainers.length) return false;
        
        const targetContainer = commentContainers[commentIndex];
        
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
      }, randomComment.index);

      if (!replyClicked) {
        logInfo("   ⚠️ Reply button not found");
        return false;
      }

      await sleep(randomDelay(2000, 3000));
      
      const replyInput = await page.waitForSelector('div[contenteditable="true"]', { 
        timeout: 10000 
      });
      
      if (!replyInput) {
        logError("   ❌ Reply input not found");
        return false;
      }

      await replyInput.click();
      await sleep(500);
      await replyInput.type(reply, { delay: randomDelay(100, 200) });
      await sleep(randomDelay(2000, 3000));
      
      // Submit reply
      await page.keyboard.down("Control");
      await page.keyboard.press("Enter");
      await page.keyboard.up("Control");
      await sleep(2000);
      
      await handleNotificationPopup(page);
      
      logSuccess(`   ✅ Replied to @${randomComment.author}: "${reply}"`);
      
      await logStructured(createLogEntry({
        actionType: "REPLY",
        author: randomComment.author,
        commentText: randomComment.text,
        postLink: postDetails.postLink,
        replyText: reply,
        status: "SUCCESS",
      }), "search_bot.json");
      
      // Log to CSV
      await logPostToCSV({
        actionType: "REPLY",
        status: "SUCCESS",
        username: username, // Bot username (who's performing the action)
        author: randomComment.author, // Comment author (who we're replying to)
        postContent: postDetails.postTitle,
        generatedText: reply,
        postLink: postDetails.postLink,
        module: "search.js"
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    logError(`   ❌ Reply error: ${error.message}`);
    return false;
  }
}

export default runSearchBot;