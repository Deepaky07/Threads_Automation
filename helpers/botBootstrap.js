// ============================================================================
// FIXED helpers/botBootstrap.js - PROXY OPTIMIZED with Better Wait Logic
// ============================================================================

import puppeteer from 'puppeteer';
import { logInfo, logSuccess, logError, sleep } from '../utils/logger.js';

import {
  getSession,
  saveSession,
  hasValidSession,
  getSessionDetails,
  invalidateSession
} from '../services/SessionManager.js';

/**
 * ✅ FIXED: Initialize bot with proxy-optimized settings
 */
export async function initializeBotWithSession(config) {
  const { username, password, botType, headless = false, chromePath = null } = config;

  logInfo(`🚀 Initializing ${botType} bot for ${username}`);

  let browser = null;
  let page = null;

  try {
    // Step 1: Launch browser with proxy-optimized settings
    const launchOptions = {
      headless: headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        // ✅ PROXY-SPECIFIC: Optimize for proxy performance
        `--proxy-server=${process.env.PROXY_SERVER}`,
        '--proxy-bypass-list=<-loopback>',
        '--disable-web-security', // For proxy CORS issues
        '--disable-features=IsolateOrigins,site-per-process',
        '--ignore-certificate-errors', // For proxy SSL
        '--allow-running-insecure-content',
      ],
      defaultViewport: null,
      // ✅ NEW: Longer timeouts for proxy
      timeout: 60000,
    };

    if (chromePath) {
      launchOptions.executablePath = chromePath;
    }

    browser = await puppeteer.launch(launchOptions);
    
    // Get first page
    const pages = await browser.pages();
    page = pages.length > 0 ? pages[0] : await browser.newPage();

    // ✅ CRITICAL: Proxy authentication
    await page.authenticate({
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    });

    // ✅ INCREASED: Longer timeouts for proxy
    page.setDefaultNavigationTimeout(90000); // 90s for proxy
    page.setDefaultTimeout(60000); // 60s for selectors

    // ✅ CRITICAL: Anti-detection measures
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    // Step 2: Try session restore first (if available)
    logInfo(`✅ Checking for existing session for ${username}`);
    
    try {
      const hasSession = await hasValidSession(username);
      
      if (hasSession) {
        logInfo(`♻️ Found existing session for ${username} - attempting restore`);
        
        const sessionData = await getSession(username);
        
        if (sessionData && sessionData.cookies && sessionData.cookies.length > 0) {
          try {
            // Navigate to Threads first
            await page.goto('https://www.threads.net/', {
              waitUntil: 'domcontentloaded',
              timeout: 30000,
            });

            // ✅ FIXED: Convert Mongoose documents to plain objects
            const cookiesArray = sessionData.cookies.map(cookie => ({
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain || '.threads.net',
              path: cookie.path || '/',
              expires: cookie.expires,
              httpOnly: cookie.httpOnly || false,
              secure: cookie.secure || false,
              sameSite: cookie.sameSite || 'Lax'
            }));

            await page.setCookie(...cookiesArray);
            logInfo('🍪 Cookies restored');

            // Restore localStorage if available
            if (sessionData.localStorage && Object.keys(sessionData.localStorage).length > 0) {
              await page.evaluate((localStorageData) => {
                for (const [key, value] of Object.entries(localStorageData)) {
                  try {
                    localStorage.setItem(key, value);
                  } catch (e) {
                    console.warn(`Failed to set localStorage key: ${key}`);
                  }
                }
              }, sessionData.localStorage);
              logInfo('💾 localStorage restored');
            }

            // Reload with cookies and wait longer
            await page.reload({ waitUntil: 'networkidle2' });
            await sleep(5000); // ✅ INCREASED: More time for feed to load
            
            // Scroll to trigger feed loading
            await page.evaluate(() => window.scrollBy(0, 100));
            await sleep(2000);

            // ✅ CRITICAL: STRICT login check with retries
            const isLoggedIn = await checkIfLoggedIn(page);

            if (isLoggedIn) {
              logSuccess('✅ Session restored successfully');
              return { browser, page };
            } else {
              logInfo('⚠️ Session cookies invalid. Switching to direct login.');
              await invalidateSession(username);
            }
          } catch (sessionError) {
            logError(`Session restore failed: ${sessionError.message}`);
            await invalidateSession(username);
          }
        }
      }
    } catch (sessionCheckError) {
      logInfo('⚠️ Session check failed, proceeding with fresh login');
    }

    // Step 3: Fresh login if session restore failed
    logInfo('🔐 Starting direct Threads login...');
    const loginSuccess = await performThreadsLogin(page, username, password);

    if (!loginSuccess) {
      throw new Error('Login failed - still on login page');
    }

    logSuccess('✅ Login successful');

    // Step 4: Save new session
    try {
      const cookies = await page.cookies();
      const localStorage = await page.evaluate(() => {
        const items = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          items[key] = window.localStorage.getItem(key);
        }
        return items;
      });

      const sessionStorage = await page.evaluate(() => {
        const items = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          items[key] = window.sessionStorage.getItem(key);
        }
        return items;
      });

      const userAgent = await page.evaluate(() => navigator.userAgent);

      await saveSession(username, {
        cookies,
        localStorage,
        sessionStorage,
        userAgent,
        botType,
      });

      logInfo('💾 Session saved for future use');
    } catch (saveError) {
      logError(`⚠️ Failed to save session: ${saveError.message}`);
    }

    return { browser, page };
  } catch (error) {
    logError(`❌ Failed to initialize: ${error.message}`);
    if (browser) {
      await browser.close().catch(() => {});
    }
    throw error;
  }
}

/**
 * ✅ FIXED: Robust login with proxy-friendly waits
 */
async function performThreadsLogin(page, username, password) {
  try {
    logInfo('🌐 Navigating to Threads login page...');
    
    await page.goto('https://www.threads.net/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await sleep(3000);

    // Check if already logged in
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      logSuccess('✅ Already logged in');
      return true;
    }

    logInfo('🔑 Entering credentials...');

    // ✅ FIXED: Better selector handling with retries
    const usernameInput = await waitForSelectorWithRetry(
      page,
      'input[name="username"], input[type="text"], input[placeholder*="Username"]',
      10000
    );

    if (!usernameInput) {
      throw new Error('Username input not found');
    }

    await usernameInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await sleep(500);
    await usernameInput.type(username, { delay: 100 });
    logSuccess('✅ Username entered');

    await sleep(1000);

    const passwordInput = await waitForSelectorWithRetry(
      page,
      'input[name="password"], input[type="password"]',
      10000
    );

    if (!passwordInput) {
      throw new Error('Password input not found');
    }

    await passwordInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await sleep(500);
    await passwordInput.type(password, { delay: 100 });
    logSuccess('✅ Password entered');

    await sleep(2000);

    // Click login button
    logInfo('🔄 Clicking login button...');
    
    const loginClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
      const loginBtn = buttons.find(btn => 
        btn.textContent.toLowerCase().includes('log in') ||
        btn.textContent.toLowerCase().includes('login')
      );
      
      if (loginBtn) {
        loginBtn.click();
        return true;
      }
      return false;
    });

    if (!loginClicked) {
      logInfo('⌨️ Fallback: Pressing Enter to submit');
      await page.keyboard.press('Enter');
    }

    // ✅ CRITICAL: Wait for navigation with extended timeout for proxy
    logInfo('⏳ Waiting for login to complete (proxy may be slow)...');
    
    await Promise.race([
      page.waitForNavigation({ 
        waitUntil: 'domcontentloaded',
        timeout: 20000 // ✅ INCREASED for proxy
      }).catch(() => logInfo('Navigation timeout - checking URL manually')),
      sleep(20000)
    ]);

    await sleep(5000); // Extra wait for page to settle

    // Verify login success
    const finalUrl = page.url();
    logInfo(`🔍 Current URL: ${finalUrl}`);
    
    // ✅ NEW: Check for challenge page (multiple patterns)
    const isChallengePage = finalUrl.includes('/challenge/') || 
                            finalUrl.includes('/checkpoint/') ||
                            finalUrl.includes('/accounts/suspended/');
    
    if (isChallengePage) {
      logInfo('⚠️ Instagram/Threads security challenge detected!');
      logInfo('🧑 Please complete the challenge manually in the browser window...');
      logInfo('⏰ You have 5 minutes to complete the challenge');
      
      const challengeResolved = await waitForChallengeCompletion(page);
      if (!challengeResolved) {
        throw new Error('Challenge timeout - please complete the challenge within 5 minutes');
      }
      
      logSuccess('✅ Challenge completed!');
      return true;
    }
    
    const isLoginPage = finalUrl.includes('/login');

    if (isLoginPage) {
      const errorMessage = await page.evaluate(() => {
        const errorEl = document.querySelector('[role="alert"], .error, [class*="error"]');
        return errorEl ? errorEl.textContent : null;
      });

      if (errorMessage) {
        throw new Error(`Login failed: ${errorMessage}`);
      }
      
      logError('❌ Still on login page - credentials may be incorrect');
      throw new Error('Login failed - still on login page');
    }

    logSuccess('✅ Login page left - checking if fully logged in...');
    
    // ✅ CRITICAL: Wait longer for feed to load after login (especially with proxy)
    await sleep(5000);
    
    // Navigate to home feed explicitly to ensure we're on the right page
    try {
      await page.goto('https://www.threads.net/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await sleep(5000);
      
      // Scroll to trigger feed loading
      await page.evaluate(() => window.scrollBy(0, 200));
      await sleep(3000);
    } catch (navError) {
      logInfo(`⚠️ Navigation to home feed failed, continuing with current page: ${navError.message}`);
    }
    
    // ✅ CRITICAL: STRICT verification with retries
    const isLoggedIn = await checkIfLoggedIn(page);
    if (!isLoggedIn) {
      logError('❌ Not properly logged in - missing logged-in indicators');
      throw new Error('Login verification failed');
    }

    return true;
  } catch (error) {
    logError(`❌ Login error: ${error.message}`);
    return false;
  }
}

/**
 * ✅ NEW: Wait for user to complete security challenge
 */
async function waitForChallengeCompletion(page, maxWaitTime = 300000) {
  logInfo('⏳ Waiting up to 5 minutes for challenge completion...');
  logInfo('📱 Please complete the challenge in the browser window');
  const startTime = Date.now();
  let checkCount = 0;
  
  while (Date.now() - startTime < maxWaitTime) {
    const currentUrl = page.url();
    checkCount++;
    
    // Check if still on challenge page (multiple patterns)
    const isOnChallenge = currentUrl.includes('/challenge/') || 
                          currentUrl.includes('/checkpoint/') ||
                          currentUrl.includes('/accounts/suspended/');
    
    if (!isOnChallenge) {
      logInfo('✅ Challenge page left - verifying login...');
      
      // Wait a bit for page to settle
      await sleep(3000);
      
      // Check if actually logged in
      const isLoggedIn = await checkIfLoggedIn(page);
      if (isLoggedIn) {
        return true;
      }
      
      // If not logged in, might have landed on login page again
      if (currentUrl.includes('/login')) {
        logError('❌ Challenge failed - returned to login page');
        return false;
      }
    }
    
    // Log progress every 10 seconds
    if (checkCount % 20 === 0) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.floor((maxWaitTime - (Date.now() - startTime)) / 1000);
      logInfo(`⏳ Challenge still pending... (${elapsed}s elapsed, ${remaining}s remaining)`);
    }
    
    await sleep(500);
  }
  
  logError('❌ Challenge timeout - took too long to complete');
  return false;
}

/**
 * ✅ NEW: Helper to wait for selector with retries
 */
async function waitForSelectorWithRetry(page, selector, timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const element = await page.$(selector);
      if (element) {
        return element;
      }
    } catch (error) {
      // Continue trying
    }
    await sleep(500);
  }
  
  logError(`❌ Selector not found: ${selector}`);
  return null;
}

/**
 * ✅ CRITICAL FIX: Better feed content detection with retry for slow proxy
 */
async function checkIfLoggedIn(page) {
  try {
    const url = page.url();
    
    // Fail fast if on login or challenge page
    if (url.includes('/login')) {
      logInfo('❌ URL contains /login');
      return false;
    }
    
    if (url.includes('/challenge/')) {
      logInfo('⚠️ URL contains /challenge - challenge not completed');
      return false;
    }

    // ✅ CRITICAL: Check for login popup
    const hasLoginPopup = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      return bodyText.includes('Log in or sign up for Threads') || 
             bodyText.includes('Continue with Instagram') ||
             bodyText.includes('Log in with username instead');
    });

    if (hasLoginPopup) {
      logError('❌ Login popup detected - NOT logged in');
      return false;
    }

    // ✅ NEW: Retry logic - wait for feed to load (proxy can be slow)
    let retries = 5; // Increased retries for slower connections/proxy
    while (retries > 0) {
      const loggedIn = await page.evaluate(() => {
        // Check for ANY feed indicators with more comprehensive selectors
        const indicators = [
          // Feed posts (primary selector)
          document.querySelectorAll('[data-pressable-container="true"]').length > 0,
          // Profile links
          document.querySelectorAll('a[href^="/@"]').length > 0,
          // Main feed area
          document.querySelector('div[role="main"]') !== null,
          // Post containers (alternative selector)
          document.querySelectorAll('article').length > 0,
          // Threads logo/header (indicates logged in page)
          document.querySelector('a[href="/"]') !== null,
          // Navigation bar (indicates logged in)
          document.querySelector('nav') !== null,
          // Any post-like content
          document.querySelectorAll('div[class*="post"], div[class*="thread"]').length > 0,
        ];

        const passedCount = indicators.filter(Boolean).length;
        // More lenient: only need 1 indicator (in case some selectors change)
        return passedCount >= 1;
      });

      if (loggedIn) {
        logSuccess('✅ Verified logged in - feed content present');
        return true;
      }

      retries--;
      if (retries > 0) {
        logInfo(`⏳ Feed not loaded yet, retrying... (${retries} left)`);
        await sleep(3000); // Increased wait time
        // Scroll more to trigger lazy loading
        await page.evaluate(() => {
          window.scrollBy(0, 500);
        });
        await sleep(2000);
      }
    }

    logError('❌ No feed content after retries - not logged in');
    return false;
  } catch (error) {
    logError(`Check login error: ${error.message}`);
    return false;
  }
}

/**
 * ✅ FIXED: Graceful browser close
 */
export async function closeBotGracefully(browser, username) {
  if (browser) {
    try {
      const pages = await browser.pages();
      for (const page of pages) {
        await page.close().catch(() => {});
      }
      await browser.close();
      logSuccess(`✅ Browser closed for ${username}`);
    } catch (error) {
      logError(`⚠️ Browser close error: ${error.message}`);
    }
  }
}

/**
 * ✅ FIXED: Error handler with cleanup
 */
export async function handleBotError(browser, error, username) {
  logError(`❌ Bot error: ${error.message}`);
  await closeBotGracefully(browser, username);
}

/**
 * ✅ NEW: Helper function for creating log entries
 */
export function createLogEntry(data) {
  return {
    timestamp: new Date().toISOString(),
    ...data
  };
}