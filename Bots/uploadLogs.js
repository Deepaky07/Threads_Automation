import fs from "fs";
import { google } from "googleapis";

const SERVICE_ACCOUNT_FILE = "./service-account.json";
const SPREADSHEET_ID = "116PYlRpkyOMxEBgkTVrqjwFa5nu7AKuoCIAPHCKuxn8";
const SHEET_NAME = "Sheet1"; // ⚠️ IMPORTANT: Change this to match your actual sheet tab name

/**
 * Parse threads_automation.txt and extract structured data
 * @param {string} logContent - Raw content from threads_automation.txt
 * @returns {Array} Array of structured log entries
 */
function parseLogData(logContent) {
  const lines = logContent.split("\n");
  const structuredData = [];
  let currentEntry = {};
  let currentComment = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and separators (but not lines with POST)
    if (!trimmed || (trimmed.includes("=") && !trimmed.includes("POST")) || trimmed.includes("â•")) {
      continue;
    }

    // Extract timestamp and content from [timestamp] format
    const match = trimmed.match(/^\[(.+?)\]\s*(.*)$/);
    if (!match) continue;

    const timestamp = match[1];
    const content = match[2] || ""; // Handle empty content after timestamp


    // NEW POST - Save previous entry and start new one
    if (content.includes("POST #")) {
      if (currentEntry.timestamp) {
        structuredData.push({ ...currentEntry });
      }
      currentEntry = {
        timestamp: timestamp,
        name: "",
        id: "",
        title: "",
        link: "",
        action: "",
        status: "",
        comment: ""
      };
      currentComment = null;
    }
    // Extract Author (Name)
    else if (content.includes("Author:")) {
      currentEntry.name = content.replace("Author:", "").trim();
    }
    // Extract Post ID
    else if (content.includes("Post ID:")) {
      currentEntry.id = content.replace("Post ID:", "").trim();
    }
    // Extract Title
    else if (content.includes("Title:")) {
      currentEntry.title = content.replace("Title:", "").trim();
    }
    // Extract Link
    else if (content.includes("Link:") && content.includes("threads.com")) {
      currentEntry.link = content.replace("Link:", "").trim();
    }
    // Extract Image Link
    else if (content.includes("Image Link:")) {
      currentEntry.imageLink = content.replace("Image Link:", "").trim();
    }
    // Extract Action (UPVOTED, Skipped, etc.)
    else if (content.includes("ACTION:")) {
      currentEntry.action = content.replace(/ACTION:/g, "").trim();
    }
    // Extract Status and Comment text
    else if (content.includes("STATUS:")) {
      const statusText = content.replace(/STATUS:/g, "").trim();
      currentEntry.status = statusText;

      // Extract comment text from status
      let commentMatch = statusText.match(/top-level comment:\s*["'](.+?)["']/i);
      if (commentMatch) {
        currentEntry.comment = commentMatch[1];
      } else {
        commentMatch = statusText.match(/comment:\s*["'](.+?)["']/i);
        if (commentMatch) {
          currentEntry.comment = commentMatch[1];
        }
      }

      // If no quoted comment found, check for reply status
      if (!currentEntry.comment && statusText.includes("replied")) {
        currentEntry.comment = statusText;
      }
    }
    // Extract reply information
    else if (content.includes("Selected comment by")) {
      currentComment = {
        author: content.replace("Selected comment by", "").replace(":", "").trim(),
        text: ""
      };
    }
    // Extract comment text for replies
    else if (content.includes("Comment text:")) {
      if (currentComment) {
        currentComment.text = content.replace("Comment text:", "").replace(/["']/g, "").trim();
      }
    }
    // Extract reply button search
    else if (content.includes("Looking for Reply button")) {
      currentEntry.replySearch = "Looking for reply button";
    }
    // Extract reply box found
    else if (content.includes("Found reply box")) {
      currentEntry.replyBox = "Found";
    }
    // Extract typed text verification
    else if (content.includes("Verified typed text")) {
      const typedText = content.replace("Verified typed text:", "").trim();
      if (typedText.startsWith('"') && typedText.endsWith('"')) {
        currentEntry.typedText = typedText.slice(1, -1);
      }
    }
    // Extract errors
    else if (content.includes("Comment input selector failed")) {
      currentEntry.error = "Comment input selector failed";
    }
    // Extract navigation errors
    else if (content.includes("Navigation error:")) {
      currentEntry.error = content.replace(/Navigation error:/g, "").trim();
    }
  }

  // Add the last entry
  if (currentEntry.timestamp) {
    // If we have a current comment, add it to the entry
    if (currentComment) {
      currentEntry.commentAuthor = currentComment.author;
      currentEntry.commentText = currentComment.text;
    }
    structuredData.push(currentEntry);
  }

  return structuredData;
}

/**
 * Convert structured data to Google Sheets rows with headers
 * @param {Array} structuredData - Parsed log entries
 * @returns {Array} 2D array for Google Sheets
 */
function convertToSheetRows(structuredData) {
  const rows = [];

  // Header row
  rows.push([
    "Timestamp",
    "Author",
    "Post ID",
    "Title",
    "Link",
    "Image Link",
    "Action",
    "Status",
    "Comment",
    "Comment Author",
    "Comment Text",
    "Reply Search",
    "Reply Box",
    "Typed Text",
    "Error"
  ]);

  // Data rows
  for (const entry of structuredData) {
    rows.push([
      entry.timestamp || "",
      entry.name || "",
      entry.id || "",
      entry.title || "",
      entry.link || "",
      entry.imageLink || "",
      entry.action || "",
      entry.status || "",
      entry.comment || "",
      entry.commentAuthor || "",
      entry.commentText || "",
      entry.replySearch || "",
      entry.replyBox || "",
      entry.typedText || "",
      entry.error || ""
    ]);
  }

  return rows;
}

/**
 * Clear the log file after successful upload
 * @param {string} filePath - Path to threads_automation.txt
 */
function clearLogFile(filePath) {
  try {
    fs.writeFileSync(filePath, "", "utf-8");
    console.log("🗑️ Successfully cleared threads_automation.txt");
  } catch (error) {
    console.error("❌ Error clearing log file:", error.message);
  }
}

/**
 * Main function to upload logs to Google Sheets
 */
async function uploadLogs() {
  const filePath = "./threads_automation.txt";

  try {
    console.log("\n" + "=".repeat(60));
    console.log("🤖 threads BOT LOG UPLOADER");
    console.log("=".repeat(60) + "\n");

    // Step 1: Authenticate with Google Sheets
    console.log("🔐 Step 1: Authenticating with Google Sheets...");
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    console.log("✅ Authentication successful\n");

    // Step 2: Read log file
    console.log("📖 Step 2: Reading threads_automation.txt...");
    if (!fs.existsSync(filePath)) {
      console.error("❌ Error: threads_automation.txt not found!");
      console.log("   Make sure the file exists in the same directory.\n");
      return;
    }

    const fileData = fs.readFileSync(filePath, "utf-8").trim();
    if (!fileData) {
      console.log("⚠️ Warning: threads_automation.txt is empty");
      console.log("   No data to upload.\n");
      return;
    }
    console.log("✅ File read successfully\n");

    // Step 3: Parse log data
    console.log("🔍 Step 3: Parsing log data...");
    const structuredData = parseLogData(fileData);

    if (structuredData.length === 0) {
      console.log("⚠️ Warning: No structured data found in logs");
      console.log("   Check if the log format is correct.\n");
      return;
    }

    console.log(`✅ Successfully parsed ${structuredData.length} entries\n`);

    // Step 4: Convert to sheet rows
    console.log("📊 Step 4: Converting data to sheet format...");
    const rows = convertToSheetRows(structuredData);
    console.log(`✅ Prepared ${rows.length} rows (including header)\n`);

    // Step 5: Check for existing headers
    console.log("🔍 Step 5: Checking for existing headers...");
    let rowsToUpload = rows;

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:O1`,
      });

      if (response.data.values && response.data.values.length > 0) {
        console.log("ℹ️  Headers already exist, skipping header row");
        rowsToUpload = rows.slice(1);
      } else {
        console.log("ℹ️  Sheet is empty, will add headers");
      }
    } catch (err) {
      console.log("ℹ️  Sheet appears empty, will add headers");
    }
    console.log("");

    // Step 6: Upload to Google Sheets
    console.log("📤 Step 6: Uploading to Google Sheets...");
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:O`,
      valueInputOption: "RAW",
      resource: { values: rowsToUpload },
    });

    console.log(`✅ Successfully uploaded ${rowsToUpload.length} rows\n`);

    // Step 7: Clear log file
    console.log("🗑️  Step 7: Cleaning up...");
    clearLogFile(filePath);

    console.log("\n" + "=".repeat(60));
    console.log("✨ UPLOAD COMPLETE!");
    console.log("=".repeat(60));
    console.log("\n📋 Uploaded columns:");
    console.log("   • Timestamp");
    console.log("   • Author");
    console.log("   • Post ID");
    console.log("   • Title");
    console.log("   • Link");
    console.log("   • Image Link");
    console.log("   • Action");
    console.log("   • Status");
    console.log("   • Comment");
    console.log("   • Comment Author");
    console.log("   • Comment Text");
    console.log("   • Reply Search");
    console.log("   • Reply Box");
    console.log("   • Typed Text");
    console.log("   • Error\n");

  } catch (error) {
    console.log("\n" + "=".repeat(60));
    console.error("❌ ERROR OCCURRED");
    console.log("=".repeat(60));
    console.error("\nError details:");
    console.error("   Message:", error.message);
    if (error.code) {
      console.error("   Code:", error.code);
    }
    if (error.errors && error.errors.length > 0) {
      console.error("   Details:", JSON.stringify(error.errors, null, 2));
    }
    console.log("\n🔧 Common fixes:");
    console.log("   1. Check if SHEET_NAME matches your Google Sheet tab name");
    console.log("   2. Verify service-account.json exists and is valid");
    console.log("   3. Ensure the service account has edit access to the sheet\n");
  }
} 

// Run the upload function
uploadLogs();