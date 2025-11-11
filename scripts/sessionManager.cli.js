#!/usr/bin/env node

/**
 * CLI tool for managing Threads bot sessions
 * Usage: node scripts/sessionManager.cli.js <command> [args]
 */

import { connectDatabase, disconnectDatabase } from "../config/database.js";
import {
  hasValidSession,
  deleteSession,
  cleanupExpiredSessions,
  getSessionStats,
} from "../services/SessionManager.js";
import ThreadsSession from "../models/ThreadsSession.js";
import dotenv from "dotenv";

dotenv.config();

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Display help menu
 */
function showHelp() {
  log('\n📚 Threads Session Manager CLI\n', 'cyan');
  log('Commands:', 'blue');
  log('  list              - List all sessions');
  log('  check <username>  - Check if user has valid session');
  log('  delete <username> - Delete user session');
  log('  cleanup           - Cleanup expired sessions');
  log('  stats             - Show session statistics');
  log('  info <username>   - Show detailed session info');
  log('  help              - Show this help menu');
  log('\nExamples:', 'yellow');
  log('  node scripts/sessionManager.cli.js list');
  log('  node scripts/sessionManager.cli.js check john_doe');
  log('  node scripts/sessionManager.cli.js delete john_doe');
  log('  node scripts/sessionManager.cli.js stats\n');
}

/**
 * List all sessions
 */
async function listSessions() {
  try {
    const sessions = await ThreadsSession.find().sort({ lastLogin: -1 });
    
    if (sessions.length === 0) {
      log('ℹ️  No sessions found', 'yellow');
      return;
    }

    log(`\n📋 Found ${sessions.length} session(s):\n`, 'cyan');
    
    sessions.forEach((session, index) => {
      const age = session.getSessionAge();
      const isValid = session.isSessionValid();
      const status = isValid ? '✅ Valid' : '❌ Expired';
      const statusColor = isValid ? 'green' : 'red';
      
      log(`${index + 1}. ${session.username}`, 'blue');
      log(`   Status: ${status}`, statusColor);
      log(`   Age: ${age} hours`);
      log(`   Bot Type: ${session.metadata.botType || 'N/A'}`);
      log(`   Login Count: ${session.metadata.loginCount}`);
      log(`   Last Login: ${session.lastLogin.toLocaleString()}`);
      log(`   Cookies: ${session.cookies.length}`);
      log('');
    });
  } catch (error) {
    log(`❌ Error listing sessions: ${error.message}`, 'red');
  }
}

/**
 * Check if user has valid session
 */
async function checkSession(username) {
  try {
    if (!username) {
      log('❌ Username is required', 'red');
      return;
    }

    const hasSession = await hasValidSession(username);
    
    if (hasSession) {
      const session = await ThreadsSession.findOne({ username });
      const age = session.getSessionAge();
      log(`✅ ${username} has a valid session (${age}h old)`, 'green');
    } else {
      log(`❌ ${username} has no valid session`, 'red');
    }
  } catch (error) {
    log(`❌ Error checking session: ${error.message}`, 'red');
  }
}

/**
 * Delete user session
 */
async function deleteUserSession(username) {
  try {
    if (!username) {
      log('❌ Username is required', 'red');
      return;
    }

    const session = await ThreadsSession.findOne({ username });
    
    if (!session) {
      log(`❌ No session found for ${username}`, 'red');
      return;
    }

    await deleteSession(username);
    log(`✅ Session deleted for ${username}`, 'green');
  } catch (error) {
    log(`❌ Error deleting session: ${error.message}`, 'red');
  }
}

/**
 * Cleanup expired sessions
 */
async function cleanupSessions() {
  try {
    log('🧹 Cleaning up expired sessions...', 'yellow');
    const cleaned = await cleanupExpiredSessions();
    log(`✅ Cleaned ${cleaned} expired session(s)`, 'green');
  } catch (error) {
    log(`❌ Error cleaning sessions: ${error.message}`, 'red');
  }
}

/**
 * Show session statistics
 */
async function showStats() {
  try {
    const stats = await getSessionStats();
    
    if (!stats) {
      log('❌ Failed to get statistics', 'red');
      return;
    }

    log('\n📊 Session Statistics:\n', 'cyan');
    log(`Total Sessions: ${stats.total}`, 'blue');
    log(`Valid: ${stats.valid}`, 'green');
    log(`Expired: ${stats.expired}`, 'red');
    log(`Average Age: ${stats.avgAge} hours`, 'yellow');
    
    if (Object.keys(stats.byBotType).length > 0) {
      log('\nBy Bot Type:', 'cyan');
      Object.entries(stats.byBotType).forEach(([type, count]) => {
        log(`  ${type}: ${count}`);
      });
    }
    
    if (stats.oldestSession) {
      log(`\nOldest Session: ${stats.oldestSession.username} (${stats.oldestSession.age}h)`, 'yellow');
    }
    
    if (stats.newestSession) {
      log(`Newest Session: ${stats.newestSession.username} (${stats.newestSession.age}h)`, 'green');
    }
    
    log('');
  } catch (error) {
    log(`❌ Error getting stats: ${error.message}`, 'red');
  }
}

/**
 * Show detailed session info
 */
async function showSessionInfo(username) {
  try {
    if (!username) {
      log('❌ Username is required', 'red');
      return;
    }

    const session = await ThreadsSession.findOne({ username });
    
    if (!session) {
      log(`❌ No session found for ${username}`, 'red');
      return;
    }

    const age = session.getSessionAge();
    const isValid = session.isSessionValid();
    
    log(`\n📄 Session Info for ${username}:\n`, 'cyan');
    log(`Status: ${isValid ? '✅ Valid' : '❌ Expired'}`, isValid ? 'green' : 'red');
    log(`Age: ${age} hours`);
    log(`Bot Type: ${session.metadata.botType || 'N/A'}`);
    log(`Login Count: ${session.metadata.loginCount}`);
    log(`Last Login: ${session.lastLogin.toLocaleString()}`);
    log(`Last Used: ${session.metadata.lastUsed ? session.metadata.lastUsed.toLocaleString() : 'Never'}`);
    log(`Cookies: ${session.cookies.length}`);
    log(`LocalStorage Items: ${Object.keys(session.localStorage).length}`);
    log(`SessionStorage Items: ${Object.keys(session.sessionStorage).length}`);
    log(`User Agent: ${session.userAgent?.substring(0, 80)}...`);
    log('');
  } catch (error) {
    log(`❌ Error getting session info: ${error.message}`, 'red');
  }
}

/**
 * Main CLI handler
 */
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  // Connect to database
  const connected = await connectDatabase();
  if (!connected) {
    log('❌ Failed to connect to database', 'red');
    process.exit(1);
  }

  try {
    switch (command) {
      case 'list':
        await listSessions();
        break;
      
      case 'check':
        await checkSession(arg);
        break;
      
      case 'delete':
        await deleteUserSession(arg);
        break;
      
      case 'cleanup':
        await cleanupSessions();
        break;
      
      case 'stats':
        await showStats();
        break;
      
      case 'info':
        await showSessionInfo(arg);
        break;
      
      case 'help':
      case undefined:
        showHelp();
        break;
      
      default:
        log(`❌ Unknown command: ${command}`, 'red');
        showHelp();
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
}

// Run CLI
main();