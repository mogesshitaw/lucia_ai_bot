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
      
      // 📝 ወደ HTML የተቀየረ መልዕክት (የማርክዳውን ስህተትን ሙሉ በሙሉ ለመከላከል)
      const message = `<b>📁 አዲስ ፋይል ከደንበኛ</b>\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━\n` +
                      `👤 <b>ደንበኛ:</b> ${user.first_name} ${user.last_name || ''}\n` +
                      `🆔 <b>ID:</b> <code>${user.id}</code>\n` +
                      `📄 <b>ፋይል:</b> ${fileInfo.file_name || 'ፎቶ/ምስል'}\n` +
                      `📝 <b>መልዕክት:</b> ${caption || 'ምንም ተጨማሪ መልዕክት የለም'}\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━`;
      
      if (fileInfo.type === 'photo') {
        await ctx.telegram.sendPhoto(chatId, fileInfo.file_id, { 
          caption: message.substring(0, 1024), 
          parse_mode: 'HTML' 
        });
      } else {
        await ctx.telegram.sendDocument(chatId, fileInfo.file_id, { 
          caption: message.substring(0, 1024), 
          parse_mode: 'HTML' 
        });
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
        Markup.button.callback('📂 ምድቦች', 'categories'),
        Markup.button.callback('📞 ደውሉልን', 'call_us')
      ],
      [
        Markup.button.callback('📤 ፋይል ላክ', 'upload_file'),
        Markup.button.callback('🛒 ማዘዝ', 'place_order')
      ],
      [
        Markup.button.url('🌐 ድረ-ገጻችን', 'https://luciaprinting.et')
      ]
    ]);
  }

  async start() {
    await db.connect();

    // ==================== /start ====================
    this.bot.start(async (ctx) => {
      // ወደ HTML ፎርማት ተቀይሯል
      const message = `🌟 <b>እንኳን ደህና መጡ ወደ ሉቺያ ህትመት!</b> 🌟\n\n` +
                      `Welcome to Lucia Printing!\n\n` +
                      `💬 <b>ማንኛውንም ጥያቄ በጽሁፍ መጠየቅ ይችላሉ!</b>\n` +
                      `እኔ AI ረዳት ነኝ ስለ ሉቺያ ህትመት መረጃ እሰጥዎታለሁ።\n\n` +
                      `📋 <b>ለፈጣን አገልግሎት ከታች ያሉትን ቁልፎች መጫን ይችላሉ!</b>\n\n` +
                      `💬 You can ask ANY question in text!\n` +
                      `📋 You can also use the buttons below for quick access!`;

      await ctx.reply(message, { parse_mode: 'HTML', ...this.mainMenuKeyboard() });
    });

    // ==================== BUTTON HANDLERS ====================
    
    this.bot.action('all_services', async (ctx) => {
      await ctx.answerCbQuery();
      const services = await db.getAllServices();
      if (!services || services.length === 0) {
        return ctx.reply('📭 ምንም አገልግሎቶች አልተገኙም።');
      }
      
      let message = '📋 <b>ሁሉም አገልግሎቶች</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n';
      const buttons = [];
      
      services.forEach(s => {
        message += `📌 <b>${s.title}</b>`;
        if (s.price_range) message += ` - ${s.price_range}`;
        message += `\n📝 ${s.short_description || ''}\n\n`;
        buttons.push([Markup.button.callback(`📖 ${s.title}`, `service_${s.slug}`)]);
      });
      
      buttons.push([Markup.button.callback('🔙 ወደ መጀመሪያ', 'back_to_main')]);
      await ctx.reply(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
    });

    this.bot.action('featured_services', async (ctx) => {
      await ctx.answerCbQuery();
      const services = await db.getFeaturedServices();
      if (!services || services.length === 0) {
        return ctx.reply('📭 ተለይተው የቀረቡ አገልግሎቶች የሉም።');
      }
      
      let message = '⭐ <b>ተለይተው የቀረቡ</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n';
      const buttons = [];
      services.forEach(s => {
        message += `🏆 <b>${s.title}</b>`;
        if (s.price_range) message += ` - ${s.price_range}`;
        message += `\n📝 ${s.short_description || ''}\n\n`;
        buttons.push([Markup.button.callback(`📖 ${s.title}`, `service_${s.slug}`)]);
      });
      buttons.push([Markup.button.callback('🔙 ወደ መጀመሪያ', 'back_to_main')]);
      await ctx.reply(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
    });

    this.bot.action('categories', async (ctx) => {
      await ctx.answerCbQuery();
      const categories = await db.getAllCategories();
      if (!categories || categories.length === 0) {
        return ctx.reply('📭 ምንም ምድቦች አልተገኙም።');
      }
      
      let message = '📂 <b>ምድቦች</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n';
      const buttons = [];
      categories.forEach(c => {
        message += `📁 <b>${c.name}</b>\n📝 ${c.description || ''}\n\n`;
        buttons.push([Markup.button.callback(`📂 ${c.name}`, `category_${c.slug}`)]);
      });
      buttons.push([Markup.button.callback('🔙 ወደ መጀመሪያ', 'back_to_main')]);
      await ctx.reply(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
    });

    this.bot.action(/category_(.+)/, async (ctx) => {
      const slug = ctx.match[1];
      await ctx.answerCbQuery();
      const categories = await db.getAllCategories();
      const category = categories.find(c => c.slug === slug);
      if (!category) return ctx.reply('❌ ምድቡ አልተገኘም።');
      
      const services = await db.getServicesByCategory(category.name);
      if (!services || services.length === 0) {
        return ctx.reply(`📭 በ"${category.name}" ምድብ ውስጥ ምንም አገልግሎቶች የሉም።`);
      }
      
      let message = `📂 <b>${category.name}</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      const buttons = [];
      services.forEach(s => {
        message += `📌 <b>${s.title}</b>`;
        if (s.price_range) message += ` - ${s.price_range}`;
        message += `\n📝 ${s.short_description || ''}\n\n`;
        buttons.push([Markup.button.callback(`📖 ${s.title}`, `service_${s.slug}`)]);
      });
      buttons.push([Markup.button.callback('🔙 ወደ ምድቦች', 'categories')]);
      buttons.push([Markup.button.callback('🔙 ወደ መጀመሪያ', 'back_to_main')]);
      await ctx.reply(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
    });

    this.bot.action(/service_(.+)/, async (ctx) => {
      const slug = ctx.match[1];
      await ctx.answerCbQuery();
      const service = await db.getServiceBySlug(slug);
      if (!service) return ctx.reply(`❌ አገልግሎቱ "${slug}" አልተገኘም።`);
      
      let message = `🔍 <b>${service.title}</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      if (service.short_description) message += `📝 ${service.short_description}\n\n`;
      if (service.full_description) {
        message += `📋 ${service.full_description.substring(0, 500)}`;
        if (service.full_description.length > 500) message += `...`;
        message += '\n\n';
      }
      if (service.price_range) message += `💰 <b>ዋጋ:</b> ${service.price_range}\n`;
      if (service.min_order) message += `📦 <b>ዝቅተኛ ትዕዛዝ:</b> ${service.min_order}\n`;
      if (service.turnaround) message += `⏱️ <b>ጊዜ:</b> ${service.turnaround}\n`;
      if (service.badge) message += `🏷️ <b>${service.badge}</b>\n`;
      
      // አስተማማኝ ድርድር (Array) ፍተሻ
      if (service.features && Array.isArray(service.features) && service.features.length > 0) {
        message += `\n✨ <b>ባህሪያት:</b>\n`;
        service.features.forEach(f => message += `• ${f}\n`);
      }
      if (service.materials && Array.isArray(service.materials) && service.materials.length > 0) {
        message += `\n📦 <b>ቁሳቁሶች:</b>\n${service.materials.join(', ')}`;
      }
      message += `\n\n💡 ማንኛውም ጥያቄ ካለ በጽሁፍ መጠየቅ ይችላሉ!`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.url('🌐 ሙሉ መረጃ በድረ-ገጽ', `https://luciaprinting.et/service-detail.php?slug=${service.slug}`)],
        [Markup.button.callback('🛒 ማዘዝ', `order_${service.slug}`), Markup.button.callback('🔙 ወደ አገልግሎቶች', 'all_services')],
        [Markup.button.callback('🔙 ወደ መጀመሪያ', 'back_to_main')]
      ]);
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    });

    this.bot.action(/order_(.+)/, async (ctx) => {
      const slug = ctx.match[1];
      await ctx.answerCbQuery();
      const service = await db.getServiceBySlug(slug);
      await ctx.reply(`🛒 <b>ማዘዝ - ${service ? service.title : slug}</b>\n\n` +
                      `እባክዎ ይላኩልኝ፦\n1️⃣ ሙሉ ስም\n2️⃣ ስልክ ቁጥር\n3️⃣ ብዛት\n\nከዚያ ለሰው አገልግሎት እናስተላልፋለን።\n\n` +
                      `Please send:\n1️⃣ Full Name\n2️⃣ Phone Number\n3️⃣ Quantity\n\nWe will connect you with a human agent.`, { parse_mode: 'HTML' });
    });

    this.bot.action('upload_file', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(`📤 <b>ፋይል መላክ</b>\n\n` +
                      `እባክዎ ፋይልዎን (PDF, AI, PSD, JPG, PNG, CDR) ይላኩልኝ።\nፋይልዎ ለሰው አገልግሎት ይላካል።\n\n` +
                      `Please send your file (PDF, AI, PSD, JPG, PNG, CDR).`, { parse_mode: 'HTML' });
    });

    this.bot.action('place_order', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(`🛒 <b>ማዘዝ</b>\n\nእባክዎ ይላኩልኝ፦\n1️⃣ ሙሉ ስም\n2️⃣ ስልክ ቁጥር\n3️⃣ አገልግሎት\n4️⃣ ብዛት`, { parse_mode: 'HTML' });
    });

    this.bot.action('call_us', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(`📞 <b>ደውሉልን / Call Us</b>\n\n📱 +251-911-234567 | +251-912-345678\n⏰ ሰኞ-ቅዳሜ 8:30-6:30\n📧 info@luciaprinting.et\n🌐 https://luciaprinting.et\n💬 @Luciaprint`, { parse_mode: 'HTML' });
    });

    this.bot.action('back_to_main', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('🔙 <b>ወደ መጀመሪያ</b>\n\nBack to main menu', { parse_mode: 'HTML', ...this.mainMenuKeyboard() });
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
    
    await this.bot.launch();
    console.log('🤖 Bot is running with Gemini AI!');
    
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }
}

module.exports = LuciaBot;