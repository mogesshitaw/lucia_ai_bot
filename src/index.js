const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const LuciaBot = require('./bot');
const db = require('./database');

// ============================================================
// HEALTH CHECK SERVER
// ============================================================
const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// Health check endpoints
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Lucia Printing Bot',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        webhook: process.env.WEBHOOK_URL || 'Not set',
        port: port
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        port: port
    });
});

app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Health check server on port ${port}`);
    console.log(`📡 Health: http://localhost:${port}/health`);
});

// ============================================================
// AI CLIENT
// ============================================================
let aiClient;

try {
    const GeminiClient = require('./ai-client');
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10 && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
        aiClient = new GeminiClient(process.env.GEMINI_API_KEY);
        console.log('✅ Using REAL Gemini AI');
    } else {
        const MockClient = require('./ai-client');
        aiClient = new MockClient('mock');
        console.log('⚠️ Using MOCK AI');
    }
} catch (error) {
    try {
        const MockClient = require('./ai-client');
        aiClient = new MockClient('mock');
        console.log('⚠️ Using MOCK AI (fallback)');
    } catch (err) {
        aiClient = {
            async sendMessage(msg) {
                return { 
                    success: true, 
                    message: '📝 እባክዎ ከታች ያሉትን ቁልፎች ይጠቀሙ' 
                };
            }
        };
        console.log('⚠️ Using ULTRA SIMPLE AI');
    }
}

if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN missing');
    server.close(() => process.exit(1));
    return;
}

// ============================================================
// CREATE BOT
// ============================================================
const bot = new LuciaBot(process.env.TELEGRAM_BOT_TOKEN, aiClient);

// ============================================================
// WEBHOOK ENDPOINTS
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

app.get('/webhook-info', async (req, res) => {
    try {
        const info = await bot.bot.telegram.getWebhookInfo();
        res.json({ success: true, webhook: info });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/set-webhook', async (req, res) => {
    try {
        const webhookUrl = process.env.WEBHOOK_URL || 
            (process.env.RENDER_EXTERNAL_HOSTNAME ? 
                `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/webhook` : 
                `http://localhost:${port}/webhook`);
        const result = await bot.bot.telegram.setWebhook(webhookUrl);
        res.json({ success: true, message: 'Webhook set', url: webhookUrl, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/delete-webhook', async (req, res) => {
    try {
        const result = await bot.bot.telegram.deleteWebhook();
        res.json({ success: true, message: 'Webhook deleted', result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// START BOT
// ============================================================
async function startBot() {
    try {
        // ቦቱን ያስነሱ
        console.log('🔄 Starting bot...');
        await bot.start();
        
        // Webhook ማዘጋጀት (Render ላይ)
        const useWebhook = process.env.USE_WEBHOOK === 'true' || process.env.RENDER_EXTERNAL_HOSTNAME;
        
        if (useWebhook) {
            const webhookUrl = process.env.WEBHOOK_URL || 
                `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/webhook`;
            console.log(`🔗 Setting webhook to: ${webhookUrl}`);
            
            try {
                await bot.bot.telegram.deleteWebhook();
                await bot.bot.telegram.setWebhook(webhookUrl);
                console.log('✅ Webhook set successfully!');
            } catch (webhookError) {
                console.error('❌ Webhook error:', webhookError.message);
            }
        } else {
            console.log('🔄 Using long polling mode');
            await bot.bot.telegram.deleteWebhook();
        }
        
        console.log('🚀 ====================================');
        console.log('🚀 LUCIA PRINTING BOT IS LIVE!');
        console.log('🚀 ====================================');
        console.log(`📡 Health: http://localhost:${port}/health`);
        console.log(`📡 Webhook info: http://localhost:${port}/webhook-info`);
        console.log('🤖 Bot is ready!');
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        throw error;
    }
}

startBot().catch(err => {
    console.error('❌ Fatal error:', err);
    setTimeout(() => {
        server.close(() => process.exit(1));
    }, 2000);
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received');
    server.close(() => process.exit(0));
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
});