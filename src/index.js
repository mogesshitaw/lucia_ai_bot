const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const config = require('./config');
const LuciaBot = require('./bot');
const db = require('./database');

// ============================================================
// HEALTH CHECK SERVER (ለRender እና ሌሎች ሆስቶች)
// ============================================================
const app = express();
const port = process.env.PORT || 3000;

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Lucia Printing Bot',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ሰርቨሩን ያስነሱ
const server = app.listen(port, () => {
    console.log(`✅ Health check server listening on port ${port}`);
    console.log(`📡 Health check: http://localhost:${port}/health`);
});

// ============================================================
// ቦቱን ያስነሱ
// ============================================================

let aiClient;

try {
    // Try to load Gemini client
    const GeminiClient = require('./ai-client');
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
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
    try {
        const MockClient = require('./ai-client');
        aiClient = new MockClient('mock');
        console.log('⚠️ Using MOCK AI (error loading Gemini)');
    } catch (err) {
        // Ultra simple fallback
        aiClient = {
            async sendMessage(msg) {
                return { 
                    success: true, 
                    message: '📝 እባክዎ ከታች ያሉትን ቁልፎች ይጠቀሙ / Please use the buttons below' 
                };
            }
        };
        console.log('⚠️ Using ULTRA SIMPLE AI fallback');
    }
}

// Validate telegram token
if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN missing in .env');
    server.close(() => {
        process.exit(1);
    });
    return;
}

// ============================================================
// ቦቱን ያስጀምሩ
// ============================================================
const bot = new LuciaBot(process.env.TELEGRAM_BOT_TOKEN, aiClient);

async function startBot() {
    try {
        // ዳታቤዝ ያገናኙ
        console.log('🔄 Connecting to database...');
        const connected = await db.connect();
        
        if (connected) {
            const services = await db.getAllServices();
            console.log(`📊 Database connected! Found ${services.length} services`);
        } else {
            console.log('⚠️ Database not available - some features may not work');
        }
        
        // ቦቱን ያስነሱ
        await bot.start();
        console.log('🚀 Lucia Printing Bot is live with Database + Buttons!');
        console.log('📁 Uploads folder: uploads/');
        console.log(`📡 Health check available at: http://localhost:${port}/health`);
        console.log('🤖 Bot is ready to receive messages!');
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        throw error;
    }
}

startBot().catch(err => {
    console.error('❌ Fatal error:', err);
    setTimeout(() => {
        server.close(() => {
            process.exit(1);
        });
    }, 2000);
});

// ============================================================
// ለሆስቲንግ የሚያስፈልግ ግርዶሽ አያያዝ
// ============================================================
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// ያልተያዙ ስህተቶችን ያስተናግዱ
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // ለመዝጋት አንገደድም - ቦቱ መስራቱን ይቀጥላል
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});