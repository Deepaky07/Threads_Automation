// ============================================================================
// COMPLETE FIXED post.js - Ready to Use
// ============================================================================

import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";
import { logPostToCSV } from "../utils/csvLogger.js";
import { initializeBotWithSession, closeBotGracefully } from "../helpers/botBootstrap.js";
import { sleep, randomDelay } from "../utils/logger.js";

dotenv.config();

const THREADS_CHARACTER_LIMIT = 500;

function logToFile(message) {
  const timestamp = new Date().toLocaleString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync("threads_post_creation.txt", logMessage, "utf8");
  } catch (error) {
    console.error("Error writing to log:", error.message);
  }
}

function ensureCharacterLimit(text, limit = THREADS_CHARACTER_LIMIT) {
  if (text.length <= limit) {
    return { text, truncated: false, originalLength: text.length };
  }

  const truncated = text.substring(0, limit - 3) + "...";
  logToFile(`⚠️ Text truncated: ${text.length} → ${truncated.length} characters`);
  
  return {
    text: truncated,
    truncated: true,
    originalLength: text.length,
    newLength: truncated.length,
  };
}

function getFallbackPost(topic, options = {}) {
  const { tone = 'casual', includeQuestion = false, includeEmojis = true } = options;
  
  const emoji = includeEmojis ? ' 💭' : '';
  const question = includeQuestion ? ' What do you think?' : '';
  
  const posts = {
    ai: `Artificial Intelligence is reshaping how we work and live. From automation to creativity, AI tools are becoming essential in every industry.${question}${emoji}`,
    tech: `Technology evolves faster than ever! What seemed impossible yesterday is routine today. The future is being built right now.${question}${emoji}`,
    technology: `Technology continues to advance at an incredible pace. Innovation is happening in every sector, transforming how we solve problems.${question}${emoji}`,
    automation: `Automation isn't about replacing humans—it's about freeing us to focus on what matters most. Smart workflows save time and reduce errors.${question}${emoji}`,
    social: `Social media has changed how we connect and communicate. Building authentic relationships online is more important than ever.${question}${emoji}`,
    business: `Business success today requires adapting to change quickly. The most innovative companies are those that embrace new technologies.${question}${emoji}`,
    marketing: `Marketing in the digital age is about authentic connections. People want real stories, not just sales pitches.${question}${emoji}`,
    productivity: `Productivity isn't about doing more—it's about doing what matters. Focus on high-impact tasks and eliminate distractions.${question}${emoji}`,
    default: `Let's talk about ${topic}! This is a fascinating subject that deserves more attention. There's so much to explore and learn here.${question}${emoji}`
  };
  
  const key = topic.toLowerCase().trim().split(' ')[0];
  return posts[key] || posts.default;
}

function getFallbackHashtags(postText, count = 3) {
  const genericHashtags = [
    '#Threads', '#Content', '#Tech', '#AI', '#Automation', 
    '#Innovation', '#Digital', '#Future', '#Community', '#SocialMedia'
  ];
  
  const words = postText.split(' ').filter(word => word.length > 5 && word.length < 15);
  const extracted = words.slice(0, 2).map(word => {
    const clean = word.replace(/[^a-zA-Z]/g, '');
    return `#${clean.charAt(0).toUpperCase() + clean.slice(1)}`;
  });
  
  const combined = [...new Set([...extracted, ...genericHashtags])];
  return combined.slice(0, count);
}

async function generateThreadsPost(topic, options = {}) {
  try {
    const {
      tone = 'casual',
      length = 'medium',
      includeQuestion = false,
      includeEmojis = true,
      image = null
    } = options;

    const apikey = process.env.OPENROUTER_API_KEY;

    if (!apikey) {
      console.log("⚠️ OPENROUTER_API_KEY not found, using fallback post");
      logToFile("⚠️ Using fallback post - no API key");
      return getFallbackPost(topic, options);
    }

    const lengthMap = {
      short: '50-100 words (around 300 characters)',
      medium: '100-150 words (around 400 characters)',
      long: '150-200 words (around 480 characters)'
    };

    let prompt;
    let messages;
    let model;

    if (image) {
      console.log(`🖼️ Generating post from image with topic: ${topic || 'auto-detect'}`);
      logToFile(`🖼️ Using vision AI to analyze image`);

      prompt = `You are creating an engaging Threads post based on this image.
${topic ? `Topic context: "${topic}"` : 'Analyze the image and create a relevant post.'}

Write a ${tone} Threads post (${lengthMap[length]}, MAXIMUM 480 characters) that:
- Describes or relates to what you see in the image
- Is conversational and authentic
- ${includeEmojis ? 'Uses 2-4 emojis naturally throughout' : 'Uses minimal or no emojis'}
- ${includeQuestion ? 'Ends with an engaging question to spark discussion' : 'Has a strong closing statement'}
- Feels personal and relatable
- Uses line breaks for readability
- STAYS UNDER 480 CHARACTERS

IMPORTANT: Return ONLY the post text, no quotes, no explanations, no hashtags.`;

      messages = [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: image } }
          ]
        }
      ];

      model = "google/gemini-2.0-flash-exp:free";
    } else {
      prompt = `You are creating an engaging Threads post.
Topic: "${topic}"

Write a ${tone} Threads post (${lengthMap[length]}, MAXIMUM 480 characters) that:
- Is conversational and authentic
- ${includeEmojis ? 'Uses 2-4 emojis naturally throughout' : 'Uses minimal or no emojis'}
- ${includeQuestion ? 'Ends with an engaging question to spark discussion' : 'Has a strong closing statement'}
- Feels personal and relatable
- Avoids being overly promotional
- Uses line breaks for readability
- STAYS UNDER 480 CHARACTERS

IMPORTANT: Return ONLY the post text, no quotes, no explanations, no hashtags.`;

      messages = [{ role: "user", content: prompt }];
      model = "meta-llama/llama-3.2-3b-instruct:free";
    }

    console.log(`🤖 Generating post${image ? ' from image' : ''} for topic: ${topic || 'image analysis'}`);

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: model,
        messages: messages,
        max_tokens: 300,
        temperature: 0.8,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apikey}`,
          "HTTP-Referer": "https://threads-automation.app",
          "X-Title": "Threads Post Generator",
        },
      }
    );

    let postText = response.data.choices[0].message.content.trim();
    postText = postText.replace(/^["']/g, "").replace(/["']$/g, "");
    
    const checked = ensureCharacterLimit(postText);
    logToFile(`✅ AI post generated: ${checked.text.substring(0, 50)}...`);
    
    return checked.text;

  } catch (error) {
    console.error("Error generating AI post:", error.response?.data || error.message);
    logToFile(`❌ AI post generation failed: ${error.message}`);
    
    if (error.response?.data?.error?.code === 402) {
      console.log("⚠️ OpenRouter credits exhausted, using fallback post");
      logToFile("⚠️ Using fallback post - no credits");
    }
    
    return getFallbackPost(topic, options);
  }
}

async function generateHashtags(postText, count = 3) {
  try {
    const apikey = process.env.OPENROUTER_API_KEY;

    if (!apikey) {
      console.log("⚠️ OPENROUTER_API_KEY not found, using fallback hashtags");
      return getFallbackHashtags(postText, count);
    }

    const prompt = `Based on this Threads post, suggest ${count} relevant, trending hashtags.
Post: "${postText}"

Return ONLY the hashtags, one per line, with # symbol. No explanations.`;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "meta-llama/llama-3.2-3b-instruct:free",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0.7,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apikey}`,
          "HTTP-Referer": "https://threads-automation.app",
          "X-Title": "Threads Hashtag Generator",
        },
      }
    );

    const hashtags = response.data.choices[0].message.content
      .trim()
      .split("\n")
      .filter(tag => tag.startsWith("#"))
      .slice(0, count);

    if (hashtags.length === 0) {
      return getFallbackHashtags(postText, count);
    }

    console.log(`✅ Hashtags generated: ${hashtags.join(' ')}`);
    return hashtags;

  } catch (error) {
    console.error("Error generating hashtags:", error.response?.data || error.message);
    
    if (error.response?.data?.error?.code === 402) {
      console.log("⚠️ OpenRouter credits exhausted, using fallback hashtags");
    }
    
    return getFallbackHashtags(postText, count);
  }
}

async function navigateToComposeViaProfile(page) {
  console.log('👤 Clicking Profile button...');
  logToFile('👤 Clicking Profile button to navigate to profile page');

  const profileClicked = await page.evaluate(() => {
    const profileSvgs = document.querySelectorAll('svg[aria-label="Profile"]');
    for (const svg of profileSvgs) {
      const profileButton = svg.closest('div');
      if (profileButton) {
        const rect = profileButton.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          profileButton.scrollIntoView({ block: 'center', behavior: 'smooth' });
          profileButton.click();
          return true;
        }
      }
    }
    
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      const svg = div.querySelector('svg[aria-label="Profile"]');
      if (svg) {
        const rect = div.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          div.scrollIntoView({ block: 'center', behavior: 'smooth' });
          div.click();
          return true;
        }
      }
    }
    
    return false;
  });

  if (!profileClicked) {
    throw new Error('Could not find Profile button');
  }

  console.log('✅ Profile button clicked, waiting for profile page to load...');
  logToFile('✅ Profile button clicked');
  await sleep(randomDelay(3000, 4000));

  console.log('🔍 Looking for compose area on profile page...');
  logToFile('🔍 Looking for "What\'s new?" compose area');

  const composeAreaClicked = await page.evaluate(() => {
    const composeArea = document.querySelector('div[aria-label="Empty text field. Type to compose a new post."]');
    if (composeArea) {
      const rect = composeArea.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        composeArea.scrollIntoView({ block: 'center', behavior: 'smooth' });
        composeArea.click();
              return true;
      }
    }
    
    const allElements = document.querySelectorAll('div[role="button"]');
    for (const el of allElements) {
      const text = el.textContent || '';
      if (text.includes("What's new?") || text.includes("What's on your mind")) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.click();
                return true;
            }
          }
        }
        
        return false;
      });
      
  if (!composeAreaClicked) {
    throw new Error('Could not find compose area on profile page');
  }

  console.log('✅ Compose area clicked, waiting for compose modal/page...');
  logToFile('✅ Compose area clicked');
        await sleep(randomDelay(2000, 3000));
        
        const isComposePage = await page.evaluate(() => {
          return document.querySelector('div[contenteditable="true"]') !== null;
        });
        
  if (!isComposePage) {
    throw new Error('Compose page did not open after clicking compose area');
  }

  console.log('✅ Compose page opened successfully');
  logToFile('✅ Compose page opened');
}

async function createThreadsPost(postContent, username, password, imageBase64 = null) {
  let browser = null;
  
  try {
    console.log('🔍 Starting post creation process...');
    console.log(`👤 User: ${username}`);
    console.log(`📄 Content: ${postContent.substring(0, 50)}...`);
    console.log(`🖼️ Image provided: ${imageBase64 ? 'YES' : 'NO'}`);
    
    logToFile(`🔍 Starting post creation for ${username}`);
    logToFile(`🖼️ Image provided: ${imageBase64 ? 'YES' : 'NO'}`);

    const { browser: browserInstance, page } = await initializeBotWithSession({
      username: username,
      password: password,
      botType: 'post_creator',
      headless: false,
      chromePath: null,
    });

    browser = browserInstance;

    console.log('✅ Login successful, navigating to Threads...');

    await page.goto("https://www.threads.net/", {
          waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await sleep(randomDelay(3000, 4000));

    await navigateToComposeViaProfile(page);

    if (imageBase64) {
      console.log('🖼️ Uploading image...');
      logToFile('🖼️ Starting image upload process...');
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        logToFile(`📊 Image buffer size: ${buffer.length} bytes`);
        
        const tempImagePath = `./temp_upload_${Date.now()}.png`;
        fs.writeFileSync(tempImagePath, buffer);
        logToFile(`💾 Temp image saved: ${tempImagePath}`);
        
        const fileInput = await page.$('input[type="file"][accept*="image"]');
        if (fileInput) {
          await fileInput.uploadFile(tempImagePath);
          console.log('✅ Image uploaded');
          logToFile('✅ Image uploaded successfully');
          await sleep(3000);
        } else {
          console.log('⚠️ File input not found, trying alternative method...');
          logToFile('⚠️ File input with accept="image" not found, trying alternative...');
          const anyFileInput = await page.$('input[type="file"]');
          if (anyFileInput) {
            await anyFileInput.uploadFile(tempImagePath);
            console.log('✅ Image uploaded (alternative method)');
            logToFile('✅ Image uploaded (alternative method)');
            await sleep(3000);
          } else {
            logToFile('❌ No file input found on page');
          }
        }
        
        fs.unlinkSync(tempImagePath);
        logToFile('🗑️ Temp file cleaned up');
      } catch (imageError) {
        console.error('⚠️ Image upload failed:', imageError.message);
        console.error('Stack:', imageError.stack);
        logToFile(`❌ Image upload error: ${imageError.message}`);
      }
    } else {
      logToFile('ℹ️ No image provided, posting text only');
    }

    console.log('✏️ Typing post content...');

    const textArea = await page.waitForSelector('div[contenteditable="true"]', {
      timeout: 10000,
    });
    
    if (!textArea) {
      throw new Error('Could not find text input area');
    }

    await textArea.click();
    await sleep(500);
    
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await sleep(300);

    await textArea.type(postContent, { delay: randomDelay(50, 100) });
    await sleep(randomDelay(2000, 3000));

    console.log('📤 Submitting post using Ctrl+Enter...');
    
      await page.keyboard.down('Control');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Control');
    
    console.log('✅ Post submitted');

    console.log('⏳ Waiting for post submission confirmation...');
    await sleep(3000);

    // Check for success alert
    let postStatus = "PENDING";
    let postLink = "";
    let postId = "";
    
    try {
      console.log('🔍 Checking for post success alert...');
      
      // Wait for the success alert to appear (up to 10 seconds)
      const alertFound = await page.waitForFunction(() => {
        // Look for the alert div with "Posted" text
        const alerts = document.querySelectorAll('div[class*="x9f619"][class*="x1n2onr6"][class*="x1ja2u2z"]');
        for (const alert of alerts) {
          const text = alert.textContent || '';
          if (text.includes('Posted')) {
                return true;
              }
            }
        return false;
      }, { timeout: 10000 }).catch(() => null);

      if (alertFound) {
        console.log('✅ Success alert found! Post was successful.');
        logToFile('✅ Post success alert detected');
        postStatus = "SUCCESS";
        
        // Extract post link from the "View" link in the alert
        try {
          const alertData = await page.evaluate(() => {
            const alerts = document.querySelectorAll('div[class*="x9f619"][class*="x1n2onr6"][class*="x1ja2u2z"]');
            for (const alert of alerts) {
              const text = alert.textContent || '';
              if (text.includes('Posted')) {
                // Find the "View" link
                const viewLink = alert.querySelector('a[href*="/post/"]');
                if (viewLink) {
                  const href = viewLink.getAttribute('href');
                  return href;
                }
              }
            }
            return null;
          });
          
          if (alertData) {
            postLink = alertData;
            // Extract post ID from link
            const idMatch = postLink.match(/\/post\/([^/?]+)/);
            if (idMatch) {
              postId = idMatch[1];
            }
            console.log(`✅ Post link extracted from alert: ${postLink}`);
            logToFile(`✅ Post link from alert: ${postLink}`);
          }
        } catch (linkError) {
          console.log(`⚠️ Could not extract link from alert: ${linkError.message}`);
        }
      } else {
        console.log('⚠️ Success alert not found, checking URL...');
        logToFile('⚠️ Success alert not found, trying alternative method');
        postStatus = "PENDING";
      }
    } catch (alertError) {
      console.log(`⚠️ Error checking for alert: ${alertError.message}`);
      logToFile(`⚠️ Error checking alert: ${alertError.message}`);
    }

    // If no link from alert, try to extract from URL
    if (!postLink) {
      try {
        console.log('🔍 Extracting post link from URL...');
        
      const currentUrl = page.url();
      if (currentUrl.includes('/post/')) {
        const urlMatch = currentUrl.match(/\/post\/([^/?]+)/);
        if (urlMatch) {
          postId = urlMatch[1];
          const pathMatch = currentUrl.match(/\/@([^/]+)\/post\/([^/?]+)/);
          if (pathMatch) {
            const urlUsername = pathMatch[1];
            if (urlUsername === username) {
              postLink = `/@${urlUsername}/post/${pathMatch[2]}`;
              console.log(`✅ Found post link from URL: ${postLink}`);
            } else {
              postLink = `/@${username}/post/${postId}`;
              console.log(`✅ Constructed post link: ${postLink}`);
            }
          } else {
            postLink = `/@${username}/post/${postId}`;
            console.log(`✅ Constructed post link from postId: ${postLink}`);
          }
        }
      }
      
      if (!postLink) {
        console.log('⚠️ Could not extract post link, will save without link');
        logToFile('⚠️ Post link extraction failed - post may not be visible yet');
      } else {
        console.log(`✅ Post link extracted successfully: ${postLink}`);
        logToFile(`✅ Post link: ${postLink}`);
      }
    } catch (linkError) {
      console.error(`⚠️ Error extracting post link: ${linkError.message}`);
      logToFile(`⚠️ Error extracting post link: ${linkError.message}`);
      }
    }

    // Update status to SUCCESS if we found the link
    if (postLink && postStatus === "PENDING") {
      postStatus = "SUCCESS";
    }

    console.log(`✅ Post creation completed! Status: ${postStatus}`);
    logToFile(`✅ Post created by ${username}: ${postContent.substring(0, 50)}... Status: ${postStatus}`);

    await logPostToCSV({
      actionType: "POST_CREATED",
      status: postStatus,
      username: username,
      author: username,
      postContent: postContent,
      generatedText: imageBase64 ? "Image: Yes" : "Image: No",
      postLink: postLink || "",
      module: "post.js"
    });

    await closeBotGracefully(browser, username);
    
    return { success: true, message: "Post created successfully" };

  } catch (error) {
    console.error('❌ Error creating post:', error.message);
    logToFile(`❌ Error creating post for ${username}: ${error.message}`);
    
    if (browser) {
      await closeBotGracefully(browser, username);
    }
    
    return { success: false, error: error.message };
  }
}

async function createThreadsPostWithExistingPage(page, postContent, username, imageBase64 = null) {
  try {
    console.log('🔍 Creating post with existing session...');
    logToFile(`🔍 Creating scheduled post for ${username}`);
    logToFile(`🖼️ Image provided: ${imageBase64 ? 'YES' : 'NO'}`);

    await page.goto("https://www.threads.net/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await sleep(randomDelay(3000, 4000));

    await navigateToComposeViaProfile(page);

    if (imageBase64) {
      console.log('🖼️ Uploading image...');
      logToFile('🖼️ Starting image upload process...');
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        logToFile(`📊 Image buffer size: ${buffer.length} bytes`);
        
        const tempImagePath = `./temp_upload_${Date.now()}.png`;
        fs.writeFileSync(tempImagePath, buffer);
        logToFile(`💾 Temp image saved: ${tempImagePath}`);
        
        const fileInput = await page.$('input[type="file"][accept*="image"]');
        if (fileInput) {
          await fileInput.uploadFile(tempImagePath);
          console.log('✅ Image uploaded');
          logToFile('✅ Image uploaded successfully');
          await sleep(3000);
        } else {
          const anyFileInput = await page.$('input[type="file"]');
          if (anyFileInput) {
            await anyFileInput.uploadFile(tempImagePath);
            console.log('✅ Image uploaded (alternative method)');
            logToFile('✅ Image uploaded (alternative method)');
            await sleep(3000);
          }
        }
        
        fs.unlinkSync(tempImagePath);
        logToFile('🗑️ Temp file cleaned up');
      } catch (imageError) {
        console.error('⚠️ Image upload failed:', imageError.message);
        logToFile(`❌ Image upload error: ${imageError.message}`);
      }
    }

    console.log('✏️ Typing post content...');

    const textArea = await page.waitForSelector('div[contenteditable="true"]', {
      timeout: 10000,
    });
    
    if (!textArea) {
      throw new Error('Could not find text input area');
    }

    await textArea.click();
    await sleep(500);
    
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await sleep(300);

    await textArea.type(postContent, { delay: randomDelay(50, 100) });
    await sleep(randomDelay(2000, 3000));

    console.log('📤 Submitting post using Ctrl+Enter...');
    
      await page.keyboard.down('Control');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Control');
    
    console.log('✅ Post submitted');

    console.log('⏳ Waiting for post submission confirmation...');
    await sleep(3000);

    // Check for success alert
    let postStatus = "PENDING";
    let postLink = "";
    let postId = "";
    
    try {
      console.log('🔍 Checking for post success alert...');
      
      // Wait for the success alert to appear (up to 10 seconds)
      const alertFound = await page.waitForFunction(() => {
        // Look for the alert div with "Posted" text
        const alerts = document.querySelectorAll('div[class*="x9f619"][class*="x1n2onr6"][class*="x1ja2u2z"]');
        for (const alert of alerts) {
          const text = alert.textContent || '';
          if (text.includes('Posted')) {
                return true;
              }
            }
        return false;
      }, { timeout: 10000 }).catch(() => null);

      if (alertFound) {
        console.log('✅ Success alert found! Post was successful.');
        logToFile('✅ Post success alert detected');
        postStatus = "SUCCESS";
        
        // Extract post link from the "View" link in the alert
        try {
          const alertData = await page.evaluate(() => {
            const alerts = document.querySelectorAll('div[class*="x9f619"][class*="x1n2onr6"][class*="x1ja2u2z"]');
            for (const alert of alerts) {
              const text = alert.textContent || '';
              if (text.includes('Posted')) {
                // Find the "View" link
                const viewLink = alert.querySelector('a[href*="/post/"]');
                if (viewLink) {
                  const href = viewLink.getAttribute('href');
                  return href;
                }
              }
            }
            return null;
          });
          
          if (alertData) {
            postLink = alertData;
            // Extract post ID from link
            const idMatch = postLink.match(/\/post\/([^/?]+)/);
            if (idMatch) {
              postId = idMatch[1];
            }
            console.log(`✅ Post link extracted from alert: ${postLink}`);
            logToFile(`✅ Post link from alert: ${postLink}`);
          }
        } catch (linkError) {
          console.log(`⚠️ Could not extract link from alert: ${linkError.message}`);
        }
      } else {
        console.log('⚠️ Success alert not found, checking URL...');
        logToFile('⚠️ Success alert not found, trying alternative method');
        postStatus = "PENDING";
      }
    } catch (alertError) {
      console.log(`⚠️ Error checking for alert: ${alertError.message}`);
      logToFile(`⚠️ Error checking alert: ${alertError.message}`);
    }

    // If no link from alert, try to extract from URL
    if (!postLink) {
      try {
        console.log('🔍 Extracting post link from URL...');
        
      const currentUrl = page.url();
      if (currentUrl.includes('/post/')) {
        const urlMatch = currentUrl.match(/\/post\/([^/?]+)/);
        if (urlMatch) {
          postId = urlMatch[1];
          const pathMatch = currentUrl.match(/\/@([^/]+)\/post\/([^/?]+)/);
          if (pathMatch) {
            const urlUsername = pathMatch[1];
            if (urlUsername === username) {
              postLink = `/@${urlUsername}/post/${pathMatch[2]}`;
              console.log(`✅ Found post link from URL: ${postLink}`);
            } else {
              postLink = `/@${username}/post/${postId}`;
              console.log(`✅ Constructed post link: ${postLink}`);
            }
          } else {
            postLink = `/@${username}/post/${postId}`;
            console.log(`✅ Constructed post link from postId: ${postLink}`);
          }
        }
      }
      
      if (!postLink) {
          console.log('🔍 Navigating to profile to find newest post...');
        try {
          await page.goto(`https://www.threads.net/@${username}`, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });
            await sleep(5000);
            
            const profilePostLink = await page.evaluate((expectedContent, username) => {
              const containers = document.querySelectorAll('div[data-pressable-container="true"]');
              
              for (let i = 0; i < Math.min(containers.length, 5); i++) {
                const container = containers[i];
                const containerText = container.textContent || '';
                
                const contentMatch = expectedContent && expectedContent.length > 20
                  ? containerText.includes(expectedContent.substring(0, 20))
                  : false;
                
                const postLinks = container.querySelectorAll('a[href*="/post/"]');
                if (postLinks.length > 0) {
                  for (const link of postLinks) {
                    const href = link.getAttribute('href') || '';
                    if (href.includes('/post/')) {
                      const linkUsername = href.match(/\/@([^/]+)\/post\//)?.[1];
                      if (linkUsername === username) {
                        if (contentMatch || i === 0) {
                          return href;
                        }
                      }
                    }
                  }
                }
              }
              
              const allPostLinks = document.querySelectorAll('a[href*="/post/"]');
              for (const link of allPostLinks) {
                const href = link.getAttribute('href') || '';
                if (href.includes('/post/')) {
                  const linkUsername = href.match(/\/@([^/]+)\/post\//)?.[1];
                  if (linkUsername === username) {
                    return href;
                  }
                }
              }
              
              return '';
            }, postContent.substring(0, 50), username);
            
            if (profilePostLink) {
              postLink = profilePostLink;
              const idMatch = postLink.split('/post/')[1]?.split('?')[0];
              if (idMatch) {
                postId = idMatch;
              }
              console.log(`✅ Found post link from profile: ${postLink}`);
          }
        } catch (profileError) {
          console.log(`⚠️ Could not extract from profile: ${profileError.message}`);
        }
      }
      
      if (postLink && !postLink.startsWith('/')) {
        const urlMatch = postLink.match(/\/@[^/]+\/post\/[^/?]+/);
        if (urlMatch) {
          postLink = urlMatch[0];
        }
      }
      
      if (!postLink) {
        console.log('⚠️ Could not extract post link, will save without link');
        logToFile('⚠️ Post link extraction failed - post may not be visible yet');
      } else {
        console.log(`✅ Post link extracted successfully: ${postLink}`);
        logToFile(`✅ Post link: ${postLink}`);
      }
    } catch (linkError) {
      console.error(`⚠️ Error extracting post link: ${linkError.message}`);
      logToFile(`⚠️ Error extracting post link: ${linkError.message}`);
      }
    }

    // Update status to SUCCESS if we found the link
    if (postLink && postStatus === "PENDING") {
      postStatus = "SUCCESS";
    }

    console.log(`✅ Post creation completed! Status: ${postStatus}`);
    logToFile(`✅ Post created by ${username}: ${postContent.substring(0, 50)}... Status: ${postStatus}`);

    await logPostToCSV({
      actionType: "POST_CREATED",
      status: postStatus,
      username: username,
      author: username,
      postContent: postContent,
      generatedText: imageBase64 ? "Image: Yes" : "Image: No",
      postLink: postLink || "",
      module: "post.js"
    });

    return { success: true, message: "Post created successfully", postContent, postLink, postId };
  } catch (error) {
    console.error('❌ Error creating post:', error.message);
    logToFile(`❌ Error creating post for ${username}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export { generateThreadsPost, generateHashtags, createThreadsPost, createThreadsPostWithExistingPage };