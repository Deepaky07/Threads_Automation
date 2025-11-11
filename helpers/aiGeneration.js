// ============================================================================
// FIXED helpers/aiGeneration.js - With proper API key handling
// ============================================================================

import axios from 'axios';
import { logInfo, logError, logSuccess } from '../utils/logger.js';

/**
 * ✅ FIXED: Validate API key before making requests
 */
function getValidatedApiKey() {
  const apikey = process.env.OPENROUTER_API_KEY || process.env.REACT_APP_OPENROUTER_API_KEY;
  
  if (!apikey) {
    throw new Error(
      '❌ OPENROUTER_API_KEY not found in environment variables. ' +
      'Please add it to your .env file. Get a key at: https://openrouter.ai/keys'
    );
  }

  if (apikey.length < 20) {
    throw new Error(
      '❌ OPENROUTER_API_KEY appears to be invalid (too short). ' +
      'Please check your .env file.'
    );
  }

  return apikey;
}

/**
 * ✅ FIXED: Generate AI comment with proper error handling
 */
export async function generateAIComment(postContent, existingComments = []) {
  try {
    const apikey = getValidatedApiKey();

    const tones = ['enthusiastic', 'curious', 'supportive', 'thoughtful', 'casual', 'friendly'];
    const randomTone = tones[Math.floor(Math.random() * tones.length)];

    let contextComments = '';
    if (existingComments.length > 0) {
      contextComments =
        '\n\nExisting comments:\n' +
        existingComments
          .slice(0, 3)
          .map((c, i) => `${i + 1}. @${c.author}: "${c.text}"`)
          .join('\n');
    }

    const prompt = `You are commenting on a Threads post. Adopt a ${randomTone} tone.

Post content: "${postContent}"${contextComments}

Write a natural, authentic COMMENT (10-40 words) that:
- Responds naturally to the post content
- Sounds conversational and human
- Uses casual language
- Can include 1-2 relevant emojis
- Adds value or shows genuine interest
- Matches the ${randomTone} tone
- IMPORTANT: Return ONLY the comment text, no quotes, no explanations

Generate ONE authentic comment now:`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 1.0,
        top_p: 0.95,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apikey}`,
          'HTTP-Referer': 'https://github.com/threads-bot',
          'X-Title': 'Threads Automation Bot',
        },
        timeout: 30000, // 30 second timeout
      }
    );

    let aiComment = response.data.choices[0].message.content.trim();
    aiComment = aiComment.replace(/^[\"\']+|[\"\']+$/g, '');
    
    if (aiComment.length > 280) {
      aiComment = aiComment.substring(0, 277) + '...';
    }

    logSuccess(`✅ AI comment generated: "${aiComment.substring(0, 50)}..."`);
    return aiComment;

  } catch (error) {
    // ✅ FIXED: Better error messages
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;

      if (status === 401) {
        logError('❌ API Key Error: Invalid or missing OpenRouter API key');
        logError('   Get a key at: https://openrouter.ai/keys');
        logError('   Add it to your .env file as: OPENROUTER_API_KEY=your_key_here');
      } else if (status === 402) {
        logError('❌ Payment Required: Your OpenRouter account needs credits');
        logError('   Add credits at: https://openrouter.ai/credits');
      } else if (status === 429) {
        logError('❌ Rate Limited: Too many requests to OpenRouter API');
        logError('   Wait a few minutes and try again');
      } else {
        logError(`❌ API Error (${status}): ${JSON.stringify(errorData)}`);
      }
    } else if (error.message.includes('OPENROUTER_API_KEY')) {
      logError(error.message);
    } else {
      logError(`❌ AI comment generation failed: ${error.message}`);
    }

    return null;
  }
}

/**
 * ✅ FIXED: Generate AI reply with validation
 */
export async function generateAIReply(author, commentText, postContent) {
  try {
    const apikey = getValidatedApiKey();

    const tones = ['agreeing', 'curious', 'thoughtful', 'supportive', 'friendly', 'casual'];
    const randomTone = tones[Math.floor(Math.random() * tones.length)];

    const prompt = `You are replying to a comment on Threads. Adopt a ${randomTone} tone.

Original post: "${postContent}"
@${author} commented: "${commentText}"

Write a natural, human-like REPLY (8-30 words) that:
- Directly responds to @${author}'s comment
- Sounds conversational and authentic
- Uses casual language
- Can use 1-2 emojis max
- Matches the ${randomTone} tone
- IMPORTANT: Return ONLY the reply text, no quotes, no explanations

Generate ONE authentic reply now:`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 1.0,
        top_p: 0.95,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apikey}`,
          'HTTP-Referer': 'https://github.com/threads-bot',
          'X-Title': 'Threads Automation Bot',
        },
        timeout: 30000,
      }
    );

    let aiReply = response.data.choices[0].message.content.trim();
    aiReply = aiReply.replace(/^[\"\']+|[\"\']+$/g, '');
    
    if (aiReply.length > 280) {
      aiReply = aiReply.substring(0, 277) + '...';
    }

    logSuccess(`✅ AI reply generated: "${aiReply.substring(0, 50)}..."`);
    return aiReply;

  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        logError('❌ API Key Error: Check your OPENROUTER_API_KEY in .env');
      } else if (status === 402) {
        logError('❌ Payment Required: Add credits at https://openrouter.ai/credits');
      } else {
        logError(`❌ API Error (${status}): ${error.response.data}`);
      }
    } else if (error.message.includes('OPENROUTER_API_KEY')) {
      logError(error.message);
    } else {
      logError(`❌ AI reply generation failed: ${error.message}`);
    }

    return null;
  }
}

/**
 * ✅ NEW: Check API key validity
 */
export async function validateApiKey() {
  try {
    const apikey = getValidatedApiKey();
    
    // Make a minimal test request
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apikey}`,
        },
        timeout: 10000,
      }
    );

    logSuccess('✅ OpenRouter API Key is valid');
    return { valid: true, message: 'API key is working' };

  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        return { 
          valid: false, 
          message: 'Invalid API key - check your .env file' 
        };
      } else if (status === 402) {
        return { 
          valid: false, 
          message: 'Valid key but no credits - add credits at openrouter.ai' 
        };
      }
    }
    
    return { 
      valid: false, 
      message: error.message 
    };
  }
}