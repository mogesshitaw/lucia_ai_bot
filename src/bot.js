const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const db = require('./database');

const FILES_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

class LuciaBot {
  constructor(token, aiClient) {
    this.bot = new Telegraf(token);
    this.aiClient = aiClient;
    this.userConversations = new Map();
    // 💡 ማሳሰቢያ፡ እዚህ ላይ የቁጥር ID (ለምሳሌ 54321678) በ .env ብታስገባ ይመረጣል
    this.HUMAN_AGENT_CHAT_ID = process.env.HUMAN_AGENT_CHAT_ID || '@Luciaprint'; 
  }

  getConversationHistory(userId) {
    if (!this.userConversations.has(userId)) {
      this.userConversations.set(userId, []);
    }
    return this.userConversations.get(userId);
  }

  updateConversationHistory(userId, userMessage, botResponse) {
    const history = this.getConversationHistory(userId);
    history.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: botResponse }
    );
    if (history.length > 20) {
      this.userConversations.set(userId, history.slice(-20));
    }
  }

  async forwardFileToHumanAgent(ctx, fileInfo, caption = '') {
    try {
      const user = ctx.from;
      const chatId = this.HUMAN_AGENT_CHAT_ID;
      const message = `📁 NEW FILE\nCustomer: ${user.first_name}\nFile: ${fileInfo.file_name || 'photo'}\nMessage: ${caption || 'No message'}`;
      
      if (fileInfo.type === 'photo') {
        await ctx.telegram.sendPhoto(chatId, fileInfo.file_id, { caption: message.substring(0, 1024) });
      } else {
        await ctx.telegram.sendDocument(chatId, fileInfo.file_id, { caption: message.substring(0, 1024) });
      }
      return true;
    } catch (error) {
      console.error('Forward error:', error.message);
      return false;
    }
  }

  // ==================== MAIN MENU KEYBOARD ====================
  mainMenuKeyboard() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('📋 ሁሉም አገልግሎቶች', 'all_services'),
        Markup.button.callback('⭐ ተለይተው የቀረቡ', 'featured_services')
      ],
      [ 
        Markup.button.callback('🛒 ማዘዝ', 'place_order'),
        Markup.button.callback('📞 ደውሉልን', 'call_us')
      ],
      [
        Markup.button.callback('📤 ፋይል ላክ', 'upload_file'),
      ],
      [
        Markup.button.url('🌐 ድረ-ገጻችን', 'https://luciaprinting.et')
      ]
    ]);
  }

  // ✅ ማስተካከያ፡ ይህንን ፋንክሽን በ index.js ላይ ስለምንጠራው፣ እዚህ ውስጥ የቦቱን ህግጋት (Listeners) ብቻ ነው የምናዘጋጀው
  async start() {
    // db.connect() በ index.js ላይ ስለሚሰራ እዚህ ላይ አያስፈልግም፣ ግን ቢኖርም ችግር የለውም

    // ==================== /start ====================
    this.bot.start(async (ctx) => {
      const message = `🌟 **እንኳን ደህና መጡ ወደ ሉቺያ ህትመት!** 🌟

Welcome to Lucia Printing!

💬 **ማንኛውንም ጥያቄ በጽሁፍ መጠየቅ ይችላሉ!** እኔ AI ረዳት ነኝ እና ስለ ሉቺያ ህትመት ሁሉንም ነገር አውቃለሁ።

📋 **ለፈጣን አገልግሎት ከታች ያሉትን ቁልፎች መጫን ይችላሉ!**

💬 You can ask ANY question in text!
I'm an AI assistant and I know everything about Lucia Printing.

📋 You can also use the buttons below for quick access!`;

      await ctx.reply(message, this.mainMenuKeyboard());
    });

    // ==================== BUTTON HANDLERS ====================
    
    this.bot.action('all_services', async (ctx) => {
      await ctx.answerCbQuery();
      const services = await db.getAllServices();
      if (!services || services.length === 0) {
        return ctx.reply('📭 ምንም አገልግሎቶች አልተገኙም።');
      }
      
      let message = '📋 **ሁሉም አገልግሎቶች**\n━━━━━━━━━━━━━━━━━━━━━\n\n';
      const buttons = [];
      
      services.forEach(s => {
        message += `📌 **${s.title}**`;
        if (s.price_range) message += ` - ${s.price_range}`;
        message += `\n📝 ${s.short_description || ''}\n\n`;
        buttons.push([Markup.button.callback(`📖 ${s.title}`, `service_${s.slug}`)]);
      });
      
      buttons.push([Markup.button.callback('🔙 ወደ መጀመሪያ', 'back_to_main')]);
      await ctx.reply(message, Markup.inlineKeyboard(buttons));
    });

    this.bot.action('featured_services', async (ctx) => {
      await ctx.answerCbQuery();
      const services = await db.getFeaturedServices();
      if (!services || services.length === 0) {
        return ctx.reply('📭 ተለይተው የቀረቡ አገልግሎቶች የሉም።');
      }
      
      let message = '⭐ **ተለይተው የቀረቡ**\n━━━━━━━━━━━━━━━━━━━━━\n\n';
      const buttons = [];
      services.forEach(s => {
        message += `🏆 **${s.title}**`;
        if (s.price_range) message += ` - ${s.price_range}`;
        message += `\n📝 ${s.short_description || ''}\n\n`;
        buttons.push([Markup.button.callback(`📖 ${s.title}`, `service_${s.slug}`)]);
      });
      buttons.push([Markup.button.callback('🔙 ወደ መጀመሪያ', 'back_to_main')]);
      await ctx.reply(message, Markup.inlineKeyboard(buttons));
    });

    this.bot.action(/service_(.+)/, async (ctx) => {
      const slug = ctx.match[1];
      await ctx.answerCbQuery();
      const service = await db.getServiceBySlug(slug);
      if (!service) return ctx.reply(`❌ አገልግሎቱ "${slug}" አልተገኘም።`);
      
      let message = `🔍 **${service.title}**\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      if (service.short_description) message += `📝 ${service.short_description}\n\n`;
      if (service.full_description) {
        message += `📋 ${service.full_description.substring(0, 500)}`;
        if (service.full_description.length > 500) message += `...`;
        message += '\n\n';
      }
      if (service.price_range) message += `💰 **ዋጋ:** ${service.price_range}\n`;
      if (service.min_order) message += `📦 **ዝቅተኛ ትዕዛዝ:** ${service.min_order}\n`;
      if (service.turnaround) message += `⏱️ **ጊዜ:** ${service.turnaround}\n`;
      if (service.badge) message += `🏷️ **${service.badge}**\n`;
      if (service.features?.length > 0) {
        message += `\n✨ **ባህሪያት:**\n`;
        service.features.forEach(f => message += `• ${f}\n`);
      }
      if (service.materials?.length > 0) {
        message += `\n📦 **ቁሳቁሶች:**\n${service.materials.join(', ')}`;
      }
      message += `\n\n💡 ማንኛውም ጥያቄ ካለ በጽሁፍ መጠየቅ ይችላሉ!`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.url('🌐 ሙሉ መረጃ በድረ-ገጽ', `https://luciaprinting.et/service-detail.php?slug=${service.slug}`)],
        [Markup.button.callback('🛒 ማዘዝ', `order_${service.slug}`), Markup.button.callback('🔙 ወደ አገልግሎቶች', 'all_services')],
        [Markup.button.callback('🔙 ወደ መጀመሪያ', 'back_to_main')]
      ]);
      await ctx.reply(message, keyboard);
    });

    this.bot.action(/order_(.+)/, async (ctx) => {
      const slug = ctx.match[1];
      await ctx.answerCbQuery();
      const service = await db.getServiceBySlug(slug);
      await ctx.reply(`🛒 **ማዘዝ - ${service ? service.title : slug}**

እባክዎ ይላኩልኝ፦
1️⃣ ሙሉ ስም
2️⃣ ስልክ ቁጥር
3️⃣ ብዛት

ከዚያ ለሰው አገልግሎት እናስተላልፋለን።

Please send:
1️⃣ Full Name
2️⃣ Phone Number
3️⃣ Quantity

We will connect you with a human agent.`);
    });

    this.bot.action('upload_file', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(`📤 **ፋይል መላክ**

እባክዎ ፋይልዎን (PDF, AI, PSD, JPG, PNG, CDR) ይላኩልኝ።
ፋይልዎ ለሰው አገልግሎት ይላካል።

Please send your file (PDF, AI, PSD, JPG, PNG, CDR).
Your file will be forwarded to our human agent.`);
    });

    this.bot.action('place_order', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(`🛒 **ማዘዝ**

እባክዎ ይላኩልኝ፦
1️⃣ ሙሉ ስም
2️⃣ ስልክ ቁጥር
3️⃣ አገልግሎት
4️⃣ ብዛት

Please send:
1️⃣ Full Name
2️⃣ Phone Number
3️⃣ Service
4️⃣ Quantity`);
    });

    this.bot.action('call_us', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(`📞 **ደውሉልን / Call Us**

📱 +251-939-604444 | +251-965-191953
⏰ ሰኞ-ቅዳሜ 2:00-12:30
📧 luciaprintingandadvertising@gmail.com
🌐 https://luciaprinting.et
💬 @Luciaprint`);
    });

    this.bot.action('back_to_main', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('🔙 **ወደ መጀመሪያ**\n\nBack to main menu', this.mainMenuKeyboard());
    });

    // ==================== COMMANDS ====================
    this.bot.command('services', (ctx) => ctx.reply('📋 እያመጣሁ ነው...', this.mainMenuKeyboard()));

    // ==================== FILE UPLOADS ====================
    this.bot.on('document', async (ctx) => {
      try {
        const doc = ctx.message.document;
        await ctx.reply(`📥 ፋይልዎ "${doc.file_name}" ተቀብሏል! ለሰው አገልግሎት ተልኳል።`);
        await this.forwardFileToHumanAgent(ctx, { type: 'document', file_id: doc.file_id, file_name: doc.file_name, size: doc.file_size });
      } catch (error) {
        console.error('Document error:', error);
        await ctx.reply('⚠️ ፋይል ማስተላለፍ አልቻለም።');
      }
    });

    this.bot.on('photo', async (ctx) => {
      try {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        await ctx.reply('📸 ምስልዎ ተቀብሏል! ለሰው አገልግሎት ተልኳል።');
        await this.forwardFileToHumanAgent(ctx, { type: 'photo', file_id: photo.file_id, size: photo.file_size });
      } catch (error) {
        console.error('Photo error:', error);
        await ctx.reply('⚠️ ምስል ማስተላለፍ አልቻለም።');
      }
    });

    // ==================== TEXT MESSAGES - ALL GO TO AI ====================
    this.bot.on('text', async (ctx) => {
      try {
        const userId = ctx.from.id;
        const userMessage = ctx.message.text;
        
        if (userMessage.startsWith('/')) return;
        
        await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
        
        const history = this.getConversationHistory(userId);
        const response = await this.aiClient.sendMessage(userMessage, history);
        
        let replyText = response.message || '⚠️ ይቅርታ መልስ ማግኘት አልቻለም።';
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('📋 ሁሉም አገልግሎቶች', 'all_services')],
          [Markup.button.callback('🛒 ማዘዝ', 'place_order'), Markup.button.callback('📞 ደውሉልን', 'call_us')],
          [Markup.button.callback('🔙 ወደ መጀመሪያ', 'back_to_main')]
        ]);
        
        await ctx.reply(replyText, keyboard);
        this.updateConversationHistory(userId, userMessage, replyText);
        
      } catch (error) {
        console.error('Text error:', error);
        await ctx.reply('⚠️ ይቅርታ ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።');
      }
    });

    this.bot.catch((err) => console.error('Bot error:', err));
    
    // ❌ ማስተካከያ ፡ ከዚህ ቦታ ላይ this.bot.launch() እና process.once መስመሮችን አጥፍተናቸዋል።
    console.log('🤖 LuciaBot Event Listeners Registered Successfully.');
  }
}

module.exports = LuciaBot;