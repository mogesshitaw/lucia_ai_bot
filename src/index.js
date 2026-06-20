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
// WEBHOOK ENDPOINT - ቴሌግራም መልዕክቶች የሚደርሱበት
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
        const webhookUrl = process.env.WEBHOOK_URL || 
            `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}/webhook`;
        
        // ቀድሞ የነበረውን Webhook ያጥፉ
        await bot.bot.telegram.deleteWebhook();
        
        // አዲስ Webhook ያዘጋጁ
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

// ============================================================
// START BOT (Webhook ሞድ)
// ============================================================
async function startBot() {
    try {
        console.log('🔄 Connecting to database...');
        await db.connect();
        
        const services = await db.getAllServices();
        console.log(`📊 Database connected! Found ${services.length} services`);
        
        // ============================================================
        // ✅ ቦቱን በWebhook ሞድ ያስነሱ
        // ============================================================
        console.log('🔄 Starting bot in webhook mode...');
        
        // ቦቱን ለWebhook ዝግጁ ያድርጉ
        await bot.bot.launch();
        console.log('✅ Bot launched for webhook mode');
        
        // ============================================================
        // ✅ Webhook ያዘጋጁ
        // ============================================================
        const webhookUrl = process.env.WEBHOOK_URL || 
            `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/webhook`;
        
        console.log(`🔗 Setting webhook to: ${webhookUrl}`);
        
        try {
            // ቀድሞ የነበረውን Webhook ያጥፉ
            await bot.bot.telegram.deleteWebhook();
            
            // አዲስ Webhook ያዘጋጁ
            const result = await bot.bot.telegram.setWebhook(webhookUrl);
            console.log('✅ Webhook set successfully!');
            console.log('📊 Webhook info:', result);
        } catch (webhookError) {
            console.error('❌ Failed to set webhook:', webhookError.message);
            console.log('💡 Please set webhook manually:');
            console.log(`curl -X POST "https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook" -H "Content-Type: application/json" -d '{"url": "${webhookUrl}"}'`);
        }
        
        console.log('🚀 ====================================');
        console.log('🚀 LUCIA PRINTING BOT IS LIVE!');
        console.log('🚀 Mode: Webhook');
        console.log('🚀 ====================================');
        console.log(`📡 Health check: http://localhost:${port}/health`);
        console.log(`📡 Webhook URL: ${webhookUrl}`);
        console.log(`📡 Webhook info: http://localhost:${port}/webhook-info`);
        console.log('🤖 Bot is ready to receive messages via Webhook!');
        
        // Webhook ሁኔታ አሳይ
        try {
            const info = await bot.bot.telegram.getWebhookInfo();
            console.log('📊 Webhook status:', info.url || 'Not set');
            console.log('📊 Pending updates:', info.pending_update_count || 0);
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
        server.close(() => process.exit(1));
    }, 2000);
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
});