import { google } from "googleapis";

const SERVICE_ACCOUNT_FILE = "./service-account.json";
const SPREADSHEET_ID = "116PYlRpkyOMxEBgkTVrqjwFa5nu7AKuoCIAPHCKuxn8";
const SHEET_NAME = "Sheet1";

async function checkPermissions() {
  try {
    console.log("🔍 Checking Google Sheets permissions...\n");

    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    console.log("✅ Google Sheets client created");

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:Z10`,
    });

    console.log("🎉 SUCCESS! Permissions are working.");
    console.log(`📊 Found ${response.data.values?.length || 0} rows in the spreadsheet`);
    console.log("\n✅ Your Google Sheets integration is ready!");

    return true;
  } catch (error) {
    console.log("❌ Permission check failed:");
    console.log(`   Error: ${error.message}`);

    if (error.message.includes("does not have permission")) {
      console.log("\n🔧 To fix this:");
      console.log("1. Open your Google Spreadsheet");
      console.log("2. Click 'Share' button in top right");
      console.log("3. Enter: deepak@calcium-spanner-476105-k9.iam.gserviceaccount.com");
      console.log("4. Set role to 'Editor'");
      console.log("5. Click 'Share'");
      console.log("\n6. Run this script again to verify");
    }

    return false;
  }
}

checkPermissions();
