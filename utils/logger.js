// ============================================================================
// utils/logger.js - Logging utilities
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sleep utility
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Random delay utility
 */
export function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Format timestamp
 */
function getTimestamp() {
  return new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

/**
 * Log to console with timestamp
 */
export function logInfo(message) {
  const timestamp = getTimestamp();
  console.log(`[${timestamp}] [INFO] ${message}`);
}

/**
 * Log success message
 */
export function logSuccess(message) {
  const timestamp = getTimestamp();
  console.log(`[${timestamp}] [SUCCESS] ${message}`);
}

/**
 * Log error message
 */
export function logError(message) {
  const timestamp = getTimestamp();
  console.error(`[${timestamp}] [ERROR] ${message}`);
}

/**
 * Log warning message
 */
export function logWarning(message) {
  const timestamp = getTimestamp();
  console.warn(`[${timestamp}] [WARNING] ${message}`);
}

/**
 * Log to file
 */
export function logToFile(message, filename = 'bot.log') {
  try {
    const timestamp = getTimestamp();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logPath = path.join(logDir, filename);
    fs.appendFileSync(logPath, logMessage, 'utf8');
  } catch (error) {
    console.error('Error writing to log file:', error.message);
  }
}

/**
 * Log structured data (for JSON logs)
 */
export async function logStructured(data, filename = 'structured.json') {
  try {
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logPath = path.join(logDir, filename);
    
    // Read existing logs
    let logs = [];
    if (fs.existsSync(logPath)) {
      try {
        const content = fs.readFileSync(logPath, 'utf8');
        logs = JSON.parse(content);
      } catch (parseError) {
        logs = [];
      }
    }
    
    // Add new entry
    logs.push({
      timestamp: new Date().toISOString(),
      ...data
    });
    
    // Keep only last 1000 entries
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }
    
    // Write back
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf8');
  } catch (error) {
    logError(`Failed to write structured log: ${error.message}`);
  }
}

/**
 * Create log entry object
 */
export function createLogEntry(data) {
  return {
    timestamp: new Date().toISOString(),
    ...data
  };
}

/**
 * Clear old logs (older than X days)
 */
export function clearOldLogs(daysToKeep = 7) {
  try {
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) return;
    
    const files = fs.readdirSync(logDir);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
    
    files.forEach(file => {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        logInfo(`Deleted old log: ${file}`);
      }
    });
  } catch (error) {
    logError(`Failed to clear old logs: ${error.message}`);
  }
}

export default {
  sleep,
  randomDelay,
  logInfo,
  logSuccess,
  logError,
  logWarning,
  logToFile,
  logStructured,
  createLogEntry,
  clearOldLogs
};