# Threads Automation Bot

A **simplified** AI-powered automation bot for Instagram Threads that continuously scrolls through posts, randomly likes, comments, or replies using advanced web scraping and AI-generated content.

## 🚀 Features

### Simple Continuous Automation
- **Login & Scroll**: Automatically logs in and continuously scrolls through the Threads feed
- **Random Actions**: Randomly decides to like, comment, or reply to posts based on configurable probabilities
- **AI-Powered Content**: Uses OpenRouter API to generate natural, contextual comments and replies
- **Comprehensive Logging**: All activities are logged to `threads_automation.txt`

### Core Functionality
- **Like Posts**: Automatically finds and likes posts with multiple selector strategies
- **Smart Comments**: AI generates relevant comments based on post content and existing comments
- **Contextual Replies**: AI creates replies to existing comments with appropriate context
- **Continuous Operation**: Runs indefinitely, scrolling through new posts as they load

## 📋 Prerequisites

- Node.js v16 or higher
- MongoDB (local or Atlas cloud)
- Instagram Threads account
- OpenRouter API key (for AI-generated content)
- Google Chrome or Chromium browser

## 🛠️ Installation

1. **Navigate to the project directory**
   ```bash
   cd "Threads Automation"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy the example environment file:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and fill in your actual values:
     ```env
     # Server Configuration
     PORT=3000
     NODE_ENV=development

     # OpenRouter AI API Key (Required)
     # Get your key at: https://openrouter.ai/keys
     OPENROUTER_API_KEY=your_openrouter_api_key_here

     # MongoDB Configuration
     # Local: mongodb://localhost:27017/threads_bot
     # Atlas: mongodb+srv://username:password@cluster.mongodb.net/threads_bot
     MONGODB_URI=mongodb://localhost:27017/threads_bot

     # Google Sheets Integration (Optional)
     GOOGLE_SHEETS_ID=your_google_sheet_id_here

     # Chrome/Chromium Path (Optional - only if Chrome is not in default location)
     CHROME_PATH=
     ```

4. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

## ⚙️ Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `LIKE_PROBABILITY` | 0.4 | Probability of liking a post (0.0-1.0) |
| `COMMENT_PROBABILITY` | 0.2 | Probability of commenting on a post (0.0-1.0) |
| `REPLY_PROBABILITY` | 0.2 | Probability of replying to comments (0.0-1.0) |
| `MIN_DELAY` | 3000 | Minimum delay between actions (ms) |
| `MAX_DELAY` | 5000 | Maximum delay between actions (ms) |
| `HEADLESS_MODE` | false | Run browser in headless mode |

## 🚀 Usage

### Basic Usage
```bash
node index.js
```

### With Custom Configuration
```bash
# High activity mode
LIKE_PROBABILITY=0.7 COMMENT_PROBABILITY=0.4 REPLY_PROBABILITY=0.3 node index.js

# Conservative mode
LIKE_PROBABILITY=0.2 COMMENT_PROBABILITY=0.1 REPLY_PROBABILITY=0.1 node index.js

# Headless mode (no visible browser)
HEADLESS_MODE=true node index.js
```

## 📊 How It Works

1. **Login**: Automatically logs into Threads using your credentials
2. **Navigate**: Goes to the home feed
3. **Continuous Loop**:
   - Finds posts using advanced CSS selectors
   - Extracts post details (author, content, links)
   - Randomly decides on an action (like/comment/reply/skip)
   - Performs the chosen action
   - Logs everything to `threads_automation.txt`
   - Scrolls down to load more posts
   - Repeats indefinitely

## 📝 Logging

All bot activities are logged to `threads_automation.txt` with detailed information:
- Post details (author, content, links)
- Actions performed (like, comment, reply)
- AI-generated content used
- Timestamps for all activities
- Error messages and debugging info

## 🔧 Technical Features

### Advanced Post Detection
- Multiple CSS selectors for finding posts in current Threads interface
- Shadow DOM support for robust element detection
- Fallback mechanisms for different page structures

### Smart Action Detection
- Multiple selectors for like buttons, comment inputs, reply buttons
- State verification (checks if already liked)
- Fallback methods for different UI elements

### AI Integration
- OpenRouter API integration for natural language generation
- Context-aware comment generation
- Multiple conversation tones (enthusiastic, curious, supportive, etc.)
- Clean, human-like content generation

## ⚠️ Important Notes

1. **Rate Limiting**: Includes random delays to mimic human behavior
2. **Account Safety**: Use at your own risk - excessive automation may violate platform terms
3. **API Costs**: AI-generated content requires OpenRouter API credits
4. **Browser Compatibility**: Works best with Chromium-based browsers

## 🛡️ Safety Features

- **Random delays** between actions to avoid detection
- **Configurable probabilities** to control activity levels
- **Error handling** with graceful recovery
- **Comprehensive logging** for monitoring

## 📄 License

This project is for educational purposes only. Please respect platform terms of service.
