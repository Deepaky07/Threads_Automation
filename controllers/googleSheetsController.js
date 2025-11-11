import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

export const getGoogleSheetData = async () => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${process.env.SHEET_NAME}!A:Z`,
    });

    if (!response.data.values || response.data.values.length === 0) {
      return { headers: [], rows: [] };
    }

    return {
      headers: response.data.values[0],
      rows: response.data.values.slice(1)
    };
  } catch (error) {
    console.error('Error fetching Google Sheet data:', error);
    throw error;
  }
};
