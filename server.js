import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import router from "./routes.js";
import { connectDatabase, isDatabaseConnected, getDatabaseState } from "./config/database.js";
import { getSessionStats } from "./services/SessionManager.js";
import { google } from "googleapis";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Google Sheets Configuration
const GOOGLE_API_KEY = "bb0ca1006881dd3decd613f78fa379b62c686968";
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const sheets = google.sheets('v4');

// Environment validation
const requiredEnvVars = ['OPENROUTER_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn(`⚠️ Missing environment variables: ${missingEnvVars.join(', ')}`);
}

// Logging middleware
app.use(morgan("dev"));

// ===== Global CORS Configuration =====
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:8082',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With', 'x-username'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static("public"));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const dbConnected = isDatabaseConnected();
    const dbState = getDatabaseState();
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        state: dbState
      },
      environment: process.env.NODE_ENV || 'development',
      cookiesEnabled: true,
      sessionManagement: "✅ Enabled with MongoDB persistence",
      googleSheetsAPI: GOOGLE_SHEET_ID ? "✅ Configured" : "⚠️ Not configured"
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Threads Automation Server Running! Session Management Enabled");
});

app.use(router);

// Analytics endpoint - Fetch from Google Sheets
app.get('/api/analytics/spreadsheet', async (req, res) => {
  try {
    console.log('📊 Fetching analytics from Google Sheets...');

    if (!GOOGLE_SHEET_ID) {
      console.log('⚠️ Google Sheets ID not configured in .env');
      return res.json({
        error: 'Google Sheets ID not configured',
        message: 'Please set GOOGLE_SHEETS_ID in your .env file',
        stats: {
          totalReach: 0,
          totalEngagement: 0,
          totalPosts: 0,
          averageEngagementRate: 0,
        },
        weeklyActivity: [],
        engagementByType: [],
        reachData: [],
      });
    }

    // Fetch data from Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: 'Sheet1!A:Z',
      key: GOOGLE_API_KEY,
    });

    const rows = response.data.values;
    console.log('📝 Total rows fetched:', rows?.length || 0);

    if (!rows || rows.length === 0) {
      console.log('⚠️ No data found in spreadsheet');
      return res.json({
        stats: {
          totalReach: 0,
          totalEngagement: 0,
          totalPosts: 0,
          averageEngagementRate: 0,
        },
        weeklyActivity: [],
        engagementByType: [],
        reachData: [],
      });
    }

    // Parse header row (convert to lowercase)
    const headers = rows[0].map(h => h ? h.toLowerCase().trim() : '');
    console.log('📋 Headers found:', headers);

    // Extract data rows
    const dataRows = rows.slice(1).filter(row => row.length > 0);
    console.log('📊 Data rows found:', dataRows.length);

    if (dataRows.length === 0) {
      console.log('⚠️ No data rows found (only headers)');
      return res.json({
        stats: {
          totalReach: 0,
          totalEngagement: 0,
          totalPosts: 0,
          averageEngagementRate: 0,
        },
        weeklyActivity: [],
        engagementByType: [],
        reachData: [],
      });
    }

    // Helper function to find column index (case-insensitive)
    const findColumnIndex = (headerName) => {
      return headers.findIndex(h => h && h.includes(headerName));
    };

    // Find column indices
    const reachIndex = findColumnIndex('reach');
    const engagementIndex = findColumnIndex('engagement');
    const postsIndex = findColumnIndex('posts');
    const engagementRateIndex = findColumnIndex('engagement_rate') || findColumnIndex('rate');
    const likesIndex = findColumnIndex('likes');
    const commentsIndex = findColumnIndex('comments');
    const sharesIndex = findColumnIndex('shares');
    const repliesIndex = findColumnIndex('replies');
    const impressionsIndex = findColumnIndex('impressions');
    const dayIndex = findColumnIndex('day');

    console.log('🔍 Column indices:', {
      reach: reachIndex,
      engagement: engagementIndex,
      posts: postsIndex,
      engagementRate: engagementRateIndex,
      likes: likesIndex,
      comments: commentsIndex,
    });

    // Extract stats from first row
    const firstRow = dataRows[0];
    const stats = {
      totalReach: parseInt(firstRow[reachIndex] || 0),
      totalEngagement: parseInt(firstRow[engagementIndex] || 0),
      totalPosts: parseInt(firstRow[postsIndex] || 0),
      averageEngagementRate: parseFloat(firstRow[engagementRateIndex] || 0),
    };

    console.log('📈 Stats:', stats);

    // Format weekly activity data
    const weeklyActivity = dataRows.map((row, idx) => ({
      day: row[dayIndex] || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx % 7],
      posts: parseInt(row[postsIndex] || 0),
      engagement: parseInt(row[engagementIndex] || 0),
      reach: parseInt(row[reachIndex] || 0),
    }));

    // Format engagement by type
    const engagementByType = [
      {
        name: 'Likes',
        value: parseInt(firstRow[likesIndex] || 0),
        percentage: 37.4
      },
      {
        name: 'Comments',
        value: parseInt(firstRow[commentsIndex] || 0),
        percentage: 29.6
      },
      {
        name: 'Shares',
        value: parseInt(firstRow[sharesIndex] || 0),
        percentage: 21.2
      },
      {
        name: 'Replies',
        value: parseInt(firstRow[repliesIndex] || 0),
        percentage: 11.8
      }
    ];

    // Format reach data
    const reachData = dataRows.slice(0, 7).map((row, idx) => ({
      date: `2025-10-${25 + idx}`,
      reach: parseInt(row[reachIndex] || 0),
      impressions: parseInt(row[impressionsIndex] || 0),
    }));

    const analyticsData = {
      stats,
      weeklyActivity,
      engagementByType,
      reachData,
    };

    console.log('✅ Analytics data prepared successfully');
    res.json(analyticsData);

  } catch (error) {
    console.error('❌ Error fetching analytics:', error.message);
    res.status(500).json({
      error: 'Failed to fetch analytics data',
      message: error.message,
      stats: {
        totalReach: 0,
        totalEngagement: 0,
        totalPosts: 0,
        averageEngagementRate: 0,
      },
      weeklyActivity: [],
      engagementByType: [],
      reachData: [],
    });
  }
});

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Initialize server
async function startServer() {
  try {
    const dbConnected = await connectDatabase();
    if (!dbConnected) {
      console.warn('⚠️ Database connection failed. Session management will not work.');
    } else {
      console.log('✅ Database connected. Session management active.');

      // Start session cleanup job (runs every 24 hours)
      setInterval(async () => {
        try {
          console.log('🧹 Running session cleanup...');
          const { cleanupExpiredSessions } = await import("./services/SessionManager.js");
          const result = await cleanupExpiredSessions();
          console.log(`✅ Cleaned ${result} expired sessions`);
        } catch (error) {
          console.error('❌ Session cleanup error:', error);
        }
      }, 24 * 60 * 60 * 1000);

      // Log session stats every 6 hours
      setInterval(async () => {
        try {
          const stats = await getSessionStats();
          if (stats && stats.length > 0) {
            console.log('📊 Session Statistics:', stats[0]);
          }
        } catch (error) {
          console.error('Session stats error:', error);
        }
      }, 6 * 60 * 60 * 1000);
    }

    app.listen(port, () => {
      console.log(`✅ Server is running on http://localhost:${port}`);
      console.log(`💾 Session persistence: MongoDB with 30-day expiration`);
      console.log(`🧹 Auto-cleanup: Enabled (24h interval)`);
      console.log(`📊 Google Sheets API: ${GOOGLE_SHEET_ID ? 'Configured' : 'NOT CONFIGURED'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  try {
    const { disconnectDatabase } = await import("./config/database.js");
    await disconnectDatabase();
  } catch (error) {
    console.error('Disconnect error:', error);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📴 SIGINT received, shutting down gracefully...');
  try {
    const { disconnectDatabase } = await import("./config/database.js");
    await disconnectDatabase();
  } catch (error) {
    console.error('Disconnect error:', error);
  }
  process.exit(0);
});

startServer();

export default app;
