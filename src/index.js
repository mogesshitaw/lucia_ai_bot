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
const port = process.env.PORT || 443;
// ለWebhook JSON መቀበል
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Lucia Printing Bot',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        webhook: process.env.WEBHOOK_URL || 'Not set'
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        webhook: process.env.WEBHOOK_URL || 'Not set'
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

// ============================================================
// WEBHOOK ENDPOINT (ለቴሌግራም)
// ============================================================
app.post('/webhook', async (req, res) => {
    try {
        console.log('📩 Webhook received:', req.body.message?.text || 'No text');
        await bot.bot.handleUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.sendStatus(500);
    }
});

// Webhook ሁኔታ ለማየት
app.get('/webhook-info', async (req, res) => {
    try {
        const info = await bot.bot.telegram.getWebhookInfo();
        res.json({
            success: true,
            webhook: info
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Webhook ለማዘጋጀት
app.get('/set-webhook', async (req, res) => {
    try {
        const webhookUrl = process.env.WEBHOOK_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}:${port}/webhook`;
        const result = await bot.bot.telegram.setWebhook(webhookUrl);
        res.json({
            success: true,
            message: 'Webhook set successfully',
            url: webhookUrl,
            result: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Webhook ለማጥፋት
app.get('/delete-webhook', async (req, res) => {
    try {
        const result = await bot.bot.telegram.deleteWebhook();
        res.json({
            success: true,
            message: 'Webhook deleted successfully',
            result: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

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
        
        // ============================================================
        // WEBHOOK ያዘጋጁ
        // ============================================================
        const useWebhook = process.env.USE_WEBHOOK === 'true' || process.env.RENDER_EXTERNAL_HOSTNAME;
        
        if (useWebhook) {
            // Webhook ሞድ
            const webhookUrl = process.env.WEBHOOK_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}:${port}/webhook`;
            console.log(`🔗 Setting webhook to: ${webhookUrl}`);
            
            try {
                await bot.bot.telegram.setWebhook(webhookUrl);
                console.log('✅ Webhook set successfully!');
            } catch (webhookError) {
                console.error('❌ Failed to set webhook:', webhookError.message);
                console.log('🔄 Falling back to polling mode...');
                await bot.start();
            }
        } else {
            // Long Polling ሞድ (ለሙከራ)
            console.log('🔄 Using long polling mode...');
            await bot.start();
        }
        
        console.log('🚀 Lucia Printing Bot is live!');
        console.log('📁 Uploads folder: uploads/');
        console.log(`📡 Health check: http://localhost:${port}/health`);
        console.log(`📡 Webhook info: http://localhost:${port}/webhook-info`);
        console.log('🤖 Bot is ready to receive messages!');
        
        // Webhook ሁኔታ አሳይ
        try {
            const info = await bot.bot.telegram.getWebhookInfo();
            console.log('📊 Webhook status:', info.url || 'Not set');
        } catch (e) {
            // ignore
        }
        
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
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});