const dotenv = require('dotenv');
dotenv.config();

const config = require('./config');
const LuciaBot = require('./bot');
const db = require('./database');

// Try to use real Gemini AI, fallback to mock
let aiClient;

try {
  // Try to load Gemini client
  const GeminiClient = require('./ai-client');
  if (process.env.GEMINI_API_KEY) {
    aiClient = new GeminiClient(process.env.GEMINI_API_KEY);
    console.log('✅ Using REAL Gemini AI');
  } else {
    // Use mock client
    const MockClient = require('./ai-client');
    aiClient = new MockClient('mock');
    console.log('⚠️ Using MOCK AI (no API key)');
  }
} catch (error) {
  // Fallback to simple mock
  const MockClient = require('./ai-client');
  aiClient = new MockClient('mock');
  console.log('⚠️ Using MOCK AI (error loading Gemini)');
}

// Validate telegram token
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN missing in .env');
  process.exit(1);
}

const bot = new LuciaBot(process.env.TELEGRAM_BOT_TOKEN, aiClient);
bot.start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

console.log('🚀 Lucia Printing Bot is live with Database + Buttons!');
console.log('📁 Uploads folder: uploads/');