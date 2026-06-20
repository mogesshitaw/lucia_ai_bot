const dotenv = require('dotenv');
dotenv.config();

const config = require('./config');
const LuciaBot = require('./bot');
const db = require('./database');

// 1. የቦት ቶከን ፍተሻ
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ CRITICAL ERROR: TELEGRAM_BOT_TOKEN missing in .env');
  process.exit(1);
}

// 2. የ AI Client ማዋቀር
let aiClient;
try {
  // አንድ ጊዜ ሪኳየር ማድረግ ይበቃል
  const AIModule = require('./ai-client'); 
  
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_API_KEY') {
    // GeminiClient በDestructuring ወይም በቀጥታ እንደ ክላስ መሆኑን አረጋግጥ
    aiClient = new AIModule(process.env.GEMINI_API_KEY);
    console.log('✅ Using REAL Gemini AI');
  } else {
    // MockClient በተመሳሳይ ፋይል ውስጥ ካለ
    aiClient = new AIModule('mock');
    console.log('⚠️ Using MOCK AI (no API key)');
  }
} catch (error) {
  console.error('⚠️ Warning during AI initialization:', error.message);
  // ፋይሉ ካልተገኘ ወይም ከተሳሳተ ፌልባክ
  try {
    const AIModule = require('./ai-client');
    aiClient = new AIModule('mock');
  } catch (e) {
    aiClient = { sendMessage: async () => ({ message: '⚠️ AI ለጊዜው አልሰራም።' }) };
  }
  console.log('⚠️ Using MOCK AI (error loading Gemini)');
}

// 3. 🛠️ የክሮን ጆብ እና የሄልዝ ቼክ ማስተካከያ (አጭር ምላሽ)
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK'); // 👈 ይህች "OK" የምትለው ጽሁፍ የCron-Job.orgን 'Output too large' ኤረር ሙሉ በሙሉ ትፈታለች!
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Health check server listening on port ${PORT}`);
});

// 4. ቦቱን ማስነሳት
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