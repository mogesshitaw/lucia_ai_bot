const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  geminiApiKey: process.env.GEMINI_API_KEY,
  
  // Validate required variables
  validate: () => {
    if (!module.exports.telegramBotToken) {
      throw new Error('❌ TELEGRAM_BOT_TOKEN is missing in .env file');
    }
    if (!module.exports.geminiApiKey) {
      throw new Error('❌ GEMINI_API_KEY is missing in .env file');
    }
    console.log('✅ Configuration loaded successfully');
  }
};