const dotenv = require('dotenv');
dotenv.config();

const config = require('./config');
const LuciaBot = require('./bot');
const db = require('./database');

// Validate telegram token early
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ CRITICAL ERROR: TELEGRAM_BOT_TOKEN missing in .env');
  process.exit(1);
}

// Try to use real Gemini AI, fallback to mock
let aiClient;

try {
  // 🛠️ ማስተካከያ 1: ከ Mock AI ፋይልህ ስም ጋር እንዳይጋጭ ጥንቃቄ ማድረግ
  const GeminiClient = require('./ai-client'); 
  
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_API_KEY') {
    aiClient = new GeminiClient(process.env.GEMINI_API_KEY);
    console.log('✅ Using REAL Gemini AI');
  } else {
    // 🛠️ ማስተካከያ 2: የ MockClient ክላስህ ሌላ ፋይል ከሆነ እሱን መጥራት (e.g., ./mock-client)
    // እዚህ ጋ MockClient ራሱ ai-client ውስጥ ያለ ሌላ Export ከሆነ እንደ ሁኔታው ማስተካከል ይቻላል።
    const MockClient = require('./ai-client'); 
    aiClient = new MockClient('mock');
    console.log('⚠️ Using MOCK AI (no API key)');
  }
} catch (error) {
  console.error('⚠️ Warning during AI initialization:', error.message);
  const MockClient = require('./ai-client');
  aiClient = new MockClient('mock');
  console.log('⚠️ Using MOCK AI (error loading Gemini)');
}

// 🛠️ ማስተካከያ 3: ለ Render Deployment የሚያስፈልግ አጭር የ Web Health Check ሰርቨር ማከል
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Lucia Bot Status: ACTIVE\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Health check server listening on port ${PORT}`);
});

// Start the bot
const bot = new LuciaBot(process.env.TELEGRAM_BOT_TOKEN, aiClient);
bot.start()
  .then(() => {
    console.log('🚀 Lucia Printing Bot is live with Database + Buttons!');
    console.log('📁 Uploads folder: uploads/');
  })
  .catch(err => {
    console.error('❌ Failed to start Telegraf Bot:', err);
    process.exit(1);
  });