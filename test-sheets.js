import { google } from "googleapis";

const SERVICE_ACCOUNT_FILE = "./service-account.json";
const SPREADSHEET_ID = "116PYlRpkyOMxEBgkTVrqjwFa5nu7AKuoCIAPHCKuxn8";
const SHEET_NAME = "Sheet1";

async function testGoogleSheets() {
  try {
    console.log("🧪 Testing Google Sheets integration...");

    // Initialize Google Sheets
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    console.log("✅ Google Sheets client created successfully");

    // Test 1: Check if we can read from the spreadsheet
    console.log("\n📖 Test 1: Reading spreadsheet data...");
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:Z100`,
      });
      console.log(`✅ Successfully read data. Found ${response.data.values?.length || 0} rows`);
    } catch (error) {
      console.error(`❌ Failed to read spreadsheet: ${error.message}`);
      return;
    }

    // Test 2: Try to append test data
    console.log("\n📝 Test 2: Appending test data...");
    const testRow = [
      new Date().toLocaleString(),
      "Test Author",
      "TEST123",
      "Test post content",
      "https://test.com",
      "https://test.jpg",
      "Test Action",
      "Success",
      "Test comment",
      1,
      "Test comment list",
      ""
    ];

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:L`,
        valueInputOption: "RAW",
        resource: { values: [testRow] },
      });
      console.log("✅ Successfully appended test data to Google Sheets");
    } catch (error) {
      console.error(`❌ Failed to append data: ${error.message}`);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return;
    }

    console.log("\n🎉 All tests passed! Google Sheets integration is working correctly.");

  } catch (error) {
    console.error("\n❌ Google Sheets setup error:", error.message);
    console.error("Full error:", error);
  }
}

testGoogleSheets();
