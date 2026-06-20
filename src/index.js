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

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Lucia Printing Bot',
        version: '1.0.0',
        mode: 'webhook',
        webhook: process.env.WEBHOOK_URL || 'Not set',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        mode: 'webhook',
        uptime: process.uptime()
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
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10) {
        aiClient = new GeminiClient(process.env.GEMINI_API_KEY);
        console.log('✅ Using REAL Gemini AI');
    } else {
        const MockClient = require('./ai-client');
        aiClient = new MockClient('mock');
        console.log('⚠️ Using MOCK AI');
    }
} catch (error) {
    aiClient = {
        async sendMessage(msg) {
            return { success: true, message: '📝 እባክዎ ከታች ያሉትን ቁልፎች ይጠቀሙ' };
        }
    };
    console.log('⚠️ Using simple AI fallback');
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
            `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}/webhook`;
        await bot.bot.telegram.deleteWebhook();
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
        console.log('🔄 Connecting to database...');
        await db.connect();
        
        const services = await db.getAllServices();
        console.log(`📊 Database connected! Found ${services.length} services`);
        
        // ============================================================
        // ✅ ትክክለኛው ዘዴ: ሁሉንም አያያዝ ያስመዝግቡ
        // ============================================================
        console.log('🔄 Starting bot in webhook mode...');
        
        // ✅ ይህ ሁሉንም አያያዝ (handlers) ያስመዝግባል
        await bot.startWebhook();  // ወይም bot.start() መጠቀም ይችላሉ
        
        // ============================================================
        // ✅ Webhook ያዘጋጁ
        // ============================================================
        const webhookUrl = process.env.WEBHOOK_URL || 
            `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}/webhook`;
        
        console.log(`🔗 Setting webhook to: ${webhookUrl}`);
        
        try {
            await bot.bot.telegram.deleteWebhook();
            await bot.bot.telegram.setWebhook(webhookUrl);
            console.log('✅ Webhook set successfully!');
        } catch (webhookError) {
            console.error('❌ Webhook error:', webhookError.message);
            console.log('💡 Set webhook manually:');
            console.log(`curl -X POST "https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook" -H "Content-Type: application/json" -d '{"url": "${webhookUrl}"}'`);
        }
        
        console.log('🚀 ====================================');
        console.log('🚀 LUCIA PRINTING BOT IS LIVE!');
        console.log('🚀 Mode: Webhook');
        console.log('🚀 ====================================');
        console.log(`📡 Health: http://localhost:${port}/health`);
        console.log(`📡 Webhook: ${webhookUrl}`);
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