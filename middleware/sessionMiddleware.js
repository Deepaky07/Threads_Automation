import { loadSession, hasValidSession } from '../SessionManager.js';

export async function autoRestoreSession(req, res, next) {
  try {
    const { username } = req.body;
    
    if (!username) {
      return next();
    }
    
    const sessionExists = await hasValidSession(username);
    
    if (sessionExists) {
      res.locals.sessionRestored = true;
      res.locals.username = username;
      console.log(`✅ Session auto-restored for ${username}`);
    }
    
    next();
  } catch (error) {
    console.error('Session restoration error:', error);
    next();
  }
}

export default autoRestoreSession;
