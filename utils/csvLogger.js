// ============================================================================
// UPDATED CSV Logger Utility - Comprehensive Post Logging
// ============================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base logs directory
const LOGS_DIR = path.join(__dirname, "../logs");

// Get user-specific CSV file path
function getUserCSVPath(username = "default") {
  const sanitizedUsername = username.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(LOGS_DIR, `${sanitizedUsername}_logs.csv`);
}

// Legacy export for backward compatibility
export const CSV_FILE_PATH = path.join(LOGS_DIR, "posts_logs.csv");

// Ensure logs directory exists
function ensureLogsDir() {
  const logsDir = path.join(__dirname, "../logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(`✅ Created logs directory: ${logsDir}`);
  }
}

// CSV Headers - Essential fields only
const CSV_HEADERS = [
  "Timestamp",
  "Date",
  "Time",
  "Action Type",
  "Status",
  "Username",
  "Author",
  "Post Content",
  "Generated Text",
  "Post Link",
  "Module"
];

// Initialize CSV file with headers if it doesn't exist
export function initializeCSV(username = "default") {
  try {
    ensureLogsDir();
    const csvFile = getUserCSVPath(username);

    if (!fs.existsSync(csvFile)) {
      const headers = CSV_HEADERS.join(",");
      fs.writeFileSync(csvFile, headers + "\n", "utf8");
      console.log(`✅ CSV file initialized for user ${username}: ${csvFile}`);
    } else {
      console.log(`✅ CSV file exists for user ${username}: ${csvFile}`);
    }
  } catch (error) {
    console.error(`❌ Error initializing CSV: ${error.message}`);
  }
}

// Escape CSV values (handle commas, quotes, newlines, special chars)
function escapeCSVValue(value) {
  if (value === null || value === undefined) return "";

  const stringValue = String(value).trim();
  
  // Remove any existing wrapping quotes
  let cleaned = stringValue.replace(/^["']|["']$/g, '');
  
  // Replace line breaks with spaces
  cleaned = cleaned.replace(/[\r\n]+/g, ' ');
  
  // Check if value needs to be quoted
  if (cleaned.includes(",") || cleaned.includes('"') || cleaned.includes("'")) {
    // Escape internal quotes by doubling them
    cleaned = cleaned.replace(/"/g, '""');
    return `"${cleaned}"`;
  }

  return cleaned;
}

// Generate session ID for tracking
let currentSessionId = null;
function getSessionId() {
  if (!currentSessionId) {
    currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  return currentSessionId;
}

// Main function to log post actions to CSV
export function logPostToCSV(data) {
  try {
    // Extract username first to determine which CSV file to use
    const userForFile = data.username || data.author || "default";
    const csvFile = getUserCSVPath(userForFile);
    initializeCSV(userForFile);

    const {
      actionType = "UNKNOWN",        // LIKE, COMMENT, REPLY, POST_CREATED, etc.
      status = "UNKNOWN",             // SUCCESS, FAILED, PENDING, SKIPPED
      username = "",                  // Bot username (who's performing action)
      author = "",                    // Post/comment author
      postContent = "",               // Original post content
      generatedText = "",             // AI-generated comment/reply
      postLink = "",                  // Link to post
      module = "unknown",             // index.js, notification.js, post.js, search.js
    } = data;

    const now = new Date();
    const timestamp = now.toISOString();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = now.toTimeString().split(' ')[0]; // HH:MM:SS

    // Create CSV row with essential fields only
    const row = [
      timestamp,
      date,
      time,
      actionType,
      status,
      username,
      author,
      postContent.substring(0, 200), // Limit length
      generatedText.substring(0, 200), // Limit length
      postLink,
      module
    ]
      .map(escapeCSVValue)
      .join(",");

    // Append to CSV file
    fs.appendFileSync(csvFile, row + "\n", "utf8");

    // Console log for debugging
    const emoji = status === "SUCCESS" ? "✅" : status === "FAILED" ? "❌" : "⚠️";
    console.log(`${emoji} [CSV] ${actionType} | @${author || username} | ${status}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error writing to CSV: ${error.message}`);
    return false;
  }
}

// Get comprehensive CSV statistics for a specific user or all users
export function getCSVStats(username = null) {
  try {
    let files = [];
    
    if (username) {
      // Get stats for specific user
      const csvFile = getUserCSVPath(username);
      if (fs.existsSync(csvFile)) {
        files = [csvFile];
      }
      
      // Also include legacy posts_logs.csv for backward compatibility
      if (fs.existsSync(CSV_FILE_PATH)) {
        files.push(CSV_FILE_PATH);
      }
      
      if (files.length === 0) {
        return null;
      }
    } else {
      // Get stats for all users - aggregate all CSV files
      ensureLogsDir();
      const allFiles = fs.readdirSync(LOGS_DIR);
      files = allFiles
        .filter(file => file.endsWith('_logs.csv'))
        .map(file => path.join(LOGS_DIR, file));
      
      // Also include legacy posts_logs.csv
      if (fs.existsSync(CSV_FILE_PATH)) {
        files.push(CSV_FILE_PATH);
      }
      
      if (files.length === 0) {
        return null;
      }
    }

    // Aggregate stats from all files
    let totalRows = 0;
    const actionCounts = {};
    const statusCounts = {};
    const moduleCounts = {};
    const userCounts = {};
    let totalSize = 0;
    let lastModified = null;

    for (const csvFile of files) {
      const content = fs.readFileSync(csvFile, "utf8");
      const lines = content.split("\n").filter((line) => line.trim());
      const fileRows = lines.length - 1; // Subtract header
      totalRows += fileRows;

      if (fileRows === 0) continue;

      const fileStats = fs.statSync(csvFile);
      totalSize += fileStats.size;
      if (!lastModified || fileStats.mtime > lastModified) {
        lastModified = fileStats.mtime;
      }

      // Parse each line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // Simple CSV parsing (handles quoted fields)
        const parts = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            parts.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        parts.push(current.trim());

        // Extract data (based on CSV_HEADERS order)
        const actionType = parts[3] || "UNKNOWN";
        const status = parts[4] || "UNKNOWN";
        const username = parts[5] || "";
        const module = parts[10] || "unknown";

        // Count by action type
        actionCounts[actionType] = (actionCounts[actionType] || 0) + 1;

        // Count by status
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        // Count by module
        moduleCounts[module] = (moduleCounts[module] || 0) + 1;

        // Count by user
        if (username) {
          userCounts[username] = (userCounts[username] || 0) + 1;
        }
      }
    }

    return {
      totalEntries: totalRows,
      fileCount: files.length,
      fileSize: totalSize,
      lastModified: lastModified,
      byActionType: actionCounts,
      byStatus: statusCounts,
      byModule: moduleCounts,
      byUser: userCounts
    };
  } catch (error) {
    console.error(`❌ Error reading CSV stats: ${error.message}`);
    return null;
  }
}

// Optimized function to get only POST entries from CSV (filters early for performance)
export function getPostEntriesFromCSV(username = null, limit = null) {
  try {
    let files = [];
    
    if (username) {
      // Check for user-specific CSV file
      const csvFile = getUserCSVPath(username);
      if (fs.existsSync(csvFile)) {
        files = [csvFile];
      }
      
      // Also check legacy posts_logs.csv for backward compatibility
      if (fs.existsSync(CSV_FILE_PATH)) {
        files.push(CSV_FILE_PATH);
      }
      
      if (files.length === 0) {
        return { success: false, message: `No CSV files found for user: ${username}`, data: [] };
      }
    } else {
      ensureLogsDir();
      const allFiles = fs.readdirSync(LOGS_DIR);
      files = allFiles
        .filter(file => file.endsWith('_logs.csv'))
        .map(file => path.join(LOGS_DIR, file));
      
      // Also include legacy posts_logs.csv
      if (fs.existsSync(CSV_FILE_PATH)) {
        files.push(CSV_FILE_PATH);
      }
      
      if (files.length === 0) {
        return { success: false, message: "No CSV files found", data: [] };
      }
    }

    const postEntries = [];
    const headers = CSV_HEADERS;
    const actionTypeIndex = 3; // Action Type is at index 3
    
    for (const csvFile of files) {
      const content = fs.readFileSync(csvFile, "utf8");
      const lines = content.split("\n");

      if (lines.length < 2) {
        continue;
      }

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // Early filtering: Check if line contains POST_CREATED or POST before full parsing
        // This is a quick check to skip most lines without parsing
        if (!line.includes('POST_CREATED') && !line.includes(',POST,')) {
          continue;
        }

        // Parse the line only if it might be a POST entry
        const parts = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            parts.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            current = '';
          } else {
            current += char;
          }
        }
        parts.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

        // Check action type early (before creating full object)
        const actionType = parts[actionTypeIndex] || "";
        if (actionType !== 'POST_CREATED' && actionType !== 'POST') {
          continue;
        }

        // Create object from parts only for POST entries
        const row = {};
        headers.forEach((header, index) => {
          row[header] = parts[index] || "";
        });

        postEntries.push(row);
        
        // Early exit if limit is reached
        if (limit && postEntries.length >= limit) {
          break;
        }
      }
      
      // Early exit if limit is reached
      if (limit && postEntries.length >= limit) {
        break;
      }
    }

    return { success: true, data: postEntries, totalEntries: postEntries.length };
  } catch (error) {
    console.error(`❌ Error getting post entries from CSV: ${error.message}`);
    return { success: false, message: error.message, data: [] };
  }
}

// Export CSV data as JSON for specific user or all users
export function exportCSVAsJSON(username = null) {
  try {
    let files = [];
    
    if (username) {
      // Check for user-specific CSV file
      const csvFile = getUserCSVPath(username);
      if (fs.existsSync(csvFile)) {
        files = [csvFile];
      }
      
      // Also check legacy posts_logs.csv for backward compatibility
      if (fs.existsSync(CSV_FILE_PATH)) {
        files.push(CSV_FILE_PATH);
      }
      
      if (files.length === 0) {
        return { success: false, message: `No CSV files found for user: ${username}` };
      }
    } else {
      ensureLogsDir();
      const allFiles = fs.readdirSync(LOGS_DIR);
      files = allFiles
        .filter(file => file.endsWith('_logs.csv'))
        .map(file => path.join(LOGS_DIR, file));
      
      // Also include legacy posts_logs.csv
      if (fs.existsSync(CSV_FILE_PATH)) {
        files.push(CSV_FILE_PATH);
      }
      
      if (files.length === 0) {
        return { success: false, message: "No CSV files found" };
      }
    }

    const allData = [];
    
    for (const csvFile of files) {
      const content = fs.readFileSync(csvFile, "utf8");
      const lines = content.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        return [];
      }

      const headers = CSV_HEADERS;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const parts = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            parts.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            current = '';
          } else {
            current += char;
          }
        }
        parts.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

        // Create object from parts
        const row = {};
        headers.forEach((header, index) => {
          row[header] = parts[index] || "";
        });

        allData.push(row);
      }
    }

    return { success: true, data: allData, totalEntries: allData.length };
  } catch (error) {
    console.error(`❌ Error exporting CSV to JSON: ${error.message}`);
    return [];
  }
}

// Download CSV file for specific user
export function downloadCSV(username = null) {
  try {
    const csvFile = username ? getUserCSVPath(username) : CSV_FILE_PATH;
    
    if (!fs.existsSync(csvFile)) {
      return { success: false, message: `CSV file not found${username ? ` for user: ${username}` : ''}` };
    }

    const content = fs.readFileSync(csvFile, "utf8");
    const filename = username ? `${username}_logs.csv` : "posts_logs.csv";
    
    return {
      success: true,
      content,
      filename,
      mimeType: "text/csv",
    };
  } catch (error) {
    console.error(`❌ Error downloading CSV: ${error.message}`);
    return null;
  }
}

// Clear CSV file for specific user or all users (keep headers)
export function clearCSV(username = null) {
  try {
    const headers = CSV_HEADERS.join(",");
    
    if (username) {
      const csvFile = getUserCSVPath(username);
      fs.writeFileSync(csvFile, headers + "\n", "utf8");
      console.log(`✅ CSV file cleared for user ${username}: ${csvFile}`);
      return { success: true, message: `CSV file cleared for user: ${username}` };
    } else {
      // Clear all user CSV files
      ensureLogsDir();
      const allFiles = fs.readdirSync(LOGS_DIR);
      const csvFiles = allFiles.filter(file => file.endsWith('_logs.csv'));
      
      csvFiles.forEach(file => {
        const filePath = path.join(LOGS_DIR, file);
        fs.writeFileSync(filePath, headers + "\n", "utf8");
      });
      
      console.log(`✅ All CSV files cleared (${csvFiles.length} files)`);
      return { success: true, message: `All CSV files cleared (${csvFiles.length} files)` };
    }
  } catch (error) {
    console.error(`❌ Error clearing CSV: ${error.message}`);
    return false;
  }
}

// Filter CSV data by criteria
export function filterCSVData(filters = {}, username = null) {
  try {
    const data = exportCSVAsJSON(username).data;
    
    if (!data || data.length === 0) {
      return [];
    }

    let filtered = data;

    // Filter by action type
    if (filters.actionType) {
      filtered = filtered.filter(row => 
        row["Action Type"] === filters.actionType
      );
    }

    // Filter by status
    if (filters.status) {
      filtered = filtered.filter(row => 
        row["Status"] === filters.status
      );
    }

    // Filter by username
    if (filters.username) {
      filtered = filtered.filter(row => 
        row["Username"].toLowerCase().includes(filters.username.toLowerCase())
      );
    }

    // Filter by author
    if (filters.author) {
      filtered = filtered.filter(row => 
        row["Author"].toLowerCase().includes(filters.author.toLowerCase())
      );
    }

    // Filter by module
    if (filters.module) {
      filtered = filtered.filter(row => 
        row["Module"] === filters.module
      );
    }

    // Filter by date range
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      filtered = filtered.filter(row => 
        new Date(row["Date"]) >= startDate
      );
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      filtered = filtered.filter(row => 
        new Date(row["Date"]) <= endDate
      );
    }

    return filtered;
  } catch (error) {
    console.error(`❌ Error filtering CSV data: ${error.message}`);
    return [];
  }
}

// Get recent logs (last N entries)
export function getRecentLogs(limit = 50, username = null) {
  try {
    const data = exportCSVAsJSON(username).data;
    return data.slice(-limit).reverse(); // Get last N and reverse for newest first
  } catch (error) {
    console.error(`❌ Error getting recent logs: ${error.message}`);
    return [];
  }
}

// Backup CSV file for specific user or all users
export function backupCSV(username = null) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    
    if (username) {
      const csvFile = getUserCSVPath(username);
      if (!fs.existsSync(csvFile)) {
        return { success: false, message: `CSV file not found for user: ${username}` };
      }
      
      const backupFile = csvFile.replace(".csv", `_backup_${timestamp}.csv`);
      fs.copyFileSync(csvFile, backupFile);
      console.log(`✅ CSV backup created for user ${username}: ${backupFile}`);
      return { success: true, message: `Backup created for user: ${username}`, backupFile };
    } else {
      // Backup all user CSV files
      ensureLogsDir();
      const allFiles = fs.readdirSync(LOGS_DIR);
      const csvFiles = allFiles.filter(file => file.endsWith('_logs.csv'));
      const backupFiles = [];
      
      csvFiles.forEach(file => {
        const filePath = path.join(LOGS_DIR, file);
        const backupFile = filePath.replace(".csv", `_backup_${timestamp}.csv`);
        fs.copyFileSync(filePath, backupFile);
        backupFiles.push(backupFile);
      });
      
      console.log(`✅ All CSV files backed up (${backupFiles.length} files)`);
      return { success: true, message: `All CSV files backed up (${backupFiles.length} files)`, backupFiles };
    }
  } catch (error) {
    console.error(`❌ Error backing up CSV: ${error.message}`);
    return null;
  }
}

export default {
  initializeCSV,
  logPostToCSV,
  getCSVStats,
  exportCSVAsJSON,
  downloadCSV,
  clearCSV,
  filterCSVData,
  getRecentLogs,
  backupCSV
};