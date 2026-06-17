const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./database');

// ================================================================
// BASE SYSTEM PROMPT - ቋሚ መረጃ
// ================================================================
const BASE_SYSTEM_PROMPT = `You are the official AI Customer Service Agent for "Lucia Printing" (luciaprinting.et) - Ethiopia's premier modern printing and advertising company.

## 🏢 ABOUT LUCIA PRINTING
Lucia Printing is a modern printing and advertising company based in Addis Ababa, Ethiopia. We provide high-quality printing services using state-of-the-art technology.

📍 Location: Bole, Addis Ababa, Gerji Mebrat Hail
📞 Phone: +251-939604444| +251-912-345678
⏰ Hours: Monday-Saturday 8:30 AM - 6:30 PM (Sunday closed)
🌐 Website: www.luciaprinting.et
📧 Email: luciaprintingandadvertising@gmail.com
💬 Telegram: @Luciaprint

## 💡 WHY CHOOSE LUCIA PRINTING?
- High quality printing with modern technology
- Competitive prices with bulk discounts
- Fast turnaround times
- Professional customer service
- Free design consultation
- Delivery service available in Addis Ababa
- Experienced team of printing professionals
- 100% customer satisfaction guaranteed

## 🎯 YOUR ROLE AS AI AGENT
- Answer ALL customer questions in a friendly, professional manner
- Provide accurate pricing information (ALWAYS use the service data provided below)
- Explain services in detail when asked
- Help customers choose the right service for their needs
- Respond in the SAME LANGUAGE the customer uses (Amharic or English)
- Be helpful, polite, and informative at all times
- Provide complete and satisfying answers

## 🚨 IMPORTANT RULES
- ALWAYS respond in the customer's language
- ALWAYS use the REAL-TIME service data provided in this prompt
- If a customer asks about a service, provide the full details from the service data
- If unsure about something, say: "ለዚህ ጥያቄ ከሰው አገልግሎታችን ጋር ያነጋግሩ / Please contact our human agent"
- NEVER give prices that are not in the service data
- ALWAYS calculate prices using the formula: Price × Quantity

## 💬 SAMPLE CONVERSATIONS
Customer: "ስለ ሉቺያ ህትመት ንገረኝ"
You: Provide a warm introduction about Lucia Printing, our services, location, and how we can help.

Customer: "ለቲሸርት ህትመት ምን ያህል ነው?"
You: "የአንድ ቲሸርት ዋጋ 150 ብር ነው። ከ10 በላይ ከሆነ 120 ብር እያንዳንዱ ነው። ቁሳቁስ፣ መጠን እና ጊዜ ማብራራት..."

Customer: "ሌዘር ቅርጻቅርጽ በእንጨት 20x30 ምን ያህል ያስከፍላል?"
You: "20×30=600 ካሬ ሴንቲ ሜትር × 2 ብር = 1,200 ብር ነው።"

Customer: "የስራ ሰዓታችሁ ስንት ነው?"
You: "ሰኞ-ቅዳሜ 8:30 AM - 6:30 PM፣ እሁድ ዝግ ነን።"
`;

class GeminiMultiModelClient {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
   this.modelQueue = [
  { 
    name: "gemini-3.5-flash", 
    priority: 1, 
    description: "የመጀመሪያ ምርጫ - እጅግ ፈጣን፣ ዘመናዊ እና ለቦት ስራዎች ምርጥ" 
  },
  { 
    name: "gemini-3.1-flash-lite", 
    priority: 2, 
    description: "ሁለተኛ አማራጭ - በጣም ፈጣን እና እጅግ ርካሽ የፍጥነት ማማ" 
  },
  { 
    name: "gemini-2.5-flash", 
    priority: 3, 
    description: "ሶስተኛ አማራጭ - በምርት ላይ የተረጋገጠ እጅግ ጽኑ እና አስተማማኝ" 
  },
  { 
    name: "gemini-3.1-pro", 
    priority: 4, 
    description: "የመጨረሻ አማራጭ - እጅግ ኃይለኛ የሎጂክ እና የኮዲንግ አእምሮ" 
  }
];
    
    this.currentModelIndex = 0;
    this.activeModel = null;
    this.modelFailures = new Map();
    
    // የዳታቤዝ መረጃ መሸጎጫ (Cache) - በየ5 ደቂቃ ይታደሳል
    this.cachedServices = null;
    this.cachedCategories = null;
    this.cacheTimestamp = null;
    this.cacheTTL = 5 * 60 * 1000; // 5 ደቂቃ
    
    this.initModel();
  }

  async initModel() {
    for (let i = 0; i < this.modelQueue.length; i++) {
      const modelInfo = this.modelQueue[i];
      if (this.modelFailures.get(modelInfo.name) === true) continue;
      
      try {
        const testModel = this.genAI.getGenerativeModel({ 
          model: modelInfo.name,
          generationConfig: { 
            temperature: 0.7, 
            maxOutputTokens: 2048,
            topP: 0.95
          }
        });
        await testModel.generateContent("Say 'OK'");
        this.activeModel = testModel;
        this.currentModelIndex = i;
        console.log(`✅ ACTIVE MODEL: ${modelInfo.name}`);
        return true;
      } catch (error) {
        this.modelFailures.set(modelInfo.name, true);
      }
    }
    return false;
  }

  async switchToNextModel() {
    this.modelFailures.set(this.modelQueue[this.currentModelIndex].name, true);
    this.currentModelIndex++;
    if (this.currentModelIndex >= this.modelQueue.length) return false;
    return await this.initModel();
  }

  // ================================================================
  // ከዳታቤዝ በቀጥታ መረጃ ማግኘት (Real-time)
  // ================================================================
  async getFreshServiceData() {
    try {
      // መሸጎጫ ትክክለኛ ከሆነ ይጠቀሙ
      if (this.cachedServices && this.cacheTimestamp && 
          (Date.now() - this.cacheTimestamp) < this.cacheTTL) {
        console.log('📊 Using cached service data');
        return { services: this.cachedServices, categories: this.cachedCategories };
      }

      console.log('📊 Fetching fresh data from database...');
      
      // ሁሉንም አገልግሎቶች ያግኙ
      const services = await db.getAllServices();
      
      // ሁሉንም ምድቦች ያግኙ
      const categories = await db.getAllCategories();
      
      // ለእያንዳንዱ አገልግሎት ዝርዝር መረጃ ያግኙ
      const enrichedServices = [];
      for (const service of services) {
        const fullService = await db.getServiceBySlug(service.slug);
        enrichedServices.push(fullService || service);
      }
      
      // መሸጎጫ ያዘምኑ
      this.cachedServices = enrichedServices;
      this.cachedCategories = categories;
      this.cacheTimestamp = Date.now();
      
      console.log(`📊 Cached ${enrichedServices.length} services and ${categories.length} categories`);
      return { services: enrichedServices, categories };
      
    } catch (error) {
      console.error('Error fetching service data:', error);
      return { services: [], categories: [] };
    }
  }

  // ================================================================
  // የዳታቤዝ መረጃን ወደ ጽሁፍ መቀየር (ለAI)
  // ================================================================
  buildServiceDataText(services, categories) {
    let text = '\n## 📋 REAL-TIME SERVICE DATA FROM DATABASE\n';
    text += '⚠️ ይህ መረጃ በቀጥታ ከዳታቤዝ የተወሰደ ነው! ሁልጊዜ አዲስ ነው!\n';
    text += '⚠️ This data is fetched directly from the database! Always up-to-date!\n\n';
    
    // ምድቦች
    if (categories.length > 0) {
      text += '### 📂 CATEGORIES / ምድቦች:\n';
      categories.forEach(c => {
        text += `- ${c.name} (${c.slug})`;
        if (c.description) text += ` - ${c.description}`;
        text += '\n';
      });
      text += '\n';
    }
    
    // ሁሉም አገልግሎቶች
    text += '### 🎯 ALL SERVICES WITH CURRENT PRICES / ሁሉም አገልግሎቶች ከዋጋ ጋር:\n\n';
    
    services.forEach((s, index) => {
      text += `#### ${index + 1}. ${s.title || 'N/A'}\n`;
      text += `- **Slug:** ${s.slug || 'N/A'}\n`;
      text += `- **ማጠቃለያ / Short Description:** ${s.short_description || 'N/A'}\n`;
      if (s.full_description) {
        text += `- **ዝርዝር / Full Description:** ${s.full_description.substring(0, 300)}${s.full_description.length > 300 ? '...' : ''}\n`;
      }
      text += `- **💰 ዋጋ / Price:** ${s.price_range || 'N/A'}\n`;
      text += `- **📦 ዝቅተኛ ትዕዛዝ / Min Order:** ${s.min_order || 'N/A'}\n`;
      text += `- **⏱️ ጊዜ / Turnaround:** ${s.turnaround || 'N/A'}\n`;
      text += `- **📁 ምድብ / Category:** ${s.category || 'N/A'}\n`;
      
      if (s.features && s.features.length > 0) {
        text += `- **✨ ባህሪያት / Features:** ${s.features.join(', ')}\n`;
      }
      
      if (s.materials && s.materials.length > 0) {
        text += `- **📦 ቁሳቁሶች / Materials:** ${s.materials.join(', ')}\n`;
      }
      
      if (s.formats && s.formats.length > 0) {
        text += `- **📐 ቅርጸቶች / Formats:** ${s.formats.join(', ')}\n`;
      }
      
      if (s.colors && s.colors.length > 0) {
        text += `- **🎨 ቀለሞች / Colors:** ${s.colors.join(', ')}\n`;
      }
      
      if (s.faqs && s.faqs.length > 0) {
        text += `- **❓ ተደጋጋሚ ጥያቄዎች / FAQs:**\n`;
        s.faqs.slice(0, 3).forEach(faq => {
          text += `  Q: ${faq.question}\n  A: ${faq.answer}\n`;
        });
        if (s.faqs.length > 3) {
          text += `  ... ${s.faqs.length - 3} more FAQs\n`;
        }
      }
      
      // የምስል መረጃ
      if (s.images && s.images.length > 0) {
        text += `- **🖼️ ምስሎች / Images:** ${s.images.length} available\n`;
      }
      
      text += '\n---\n\n';
    });
    
    text += `\n📊 **በድምሩ ${services.length} አገልግሎቶች ከዳታቤዝ ተገኝተዋል!**\n`;
    text += `📊 **Total ${services.length} services fetched from database!**\n\n`;
    text += '⚠️ **ማስታወሻ:** ይህ መረጃ በቀጥታ ከዳታቤዝ የተወሰደ ነው። ማንኛውም ለውጥ በዳታቤዝ ላይ ሲደረግ እዚህ ይንጸባረቃል!';
    text += '\n⚠️ **Note:** This data is directly from the database. Any changes in the database will be reflected here!';
    
    return text;
  }

  // ================================================================
  // ዋናው sendMessage - ከዳታቤዝ ጋር በቀጥታ የተዋሃደ
  // ================================================================
  async sendMessage(userMessage, conversationHistory = []) {
    if (!this.activeModel) {
      const initialized = await this.initModel();
      if (!initialized) {
        return {
          success: false,
          message: '⚠️ AI አገልግሎቱ ለጊዜው አይገኝም። እባክዎ ቆይተው ይሞክሩ።'
        };
      }
    }

    try {
      console.log('💬 Processing message:', userMessage.substring(0, 50) + '...');
      
      // ============================================================
      // 1. ከዳታቤዝ ትኩስ መረጃ ያግኙ (Real-time)
      // ============================================================
      const { services, categories } = await this.getFreshServiceData();
      const serviceDataText = this.buildServiceDataText(services, categories);
      
      // ============================================================
      // 2. የውይይት ታሪክ ያግኙ
      // ============================================================
      let historyText = '';
      if (conversationHistory && conversationHistory.length > 0) {
        historyText = '\n=== PREVIOUS CONVERSATION ===\n';
        const recentHistory = conversationHistory.slice(-8);
        for (const msg of recentHistory) {
          const role = msg.role === 'user' ? 'Customer' : 'Lucia Printing Assistant';
          historyText += `${role}: ${msg.content}\n`;
        }
        historyText += '\n';
      }
      
      // ============================================================
      // 3. ሙሉ ፕሮምፕት ይገንቡ
      // ============================================================
      let fullPrompt = BASE_SYSTEM_PROMPT;
      fullPrompt += serviceDataText;
      fullPrompt += historyText;
      fullPrompt += `\n=== CURRENT CUSTOMER MESSAGE ===\nCustomer: ${userMessage}\n\n=== YOUR RESPONSE ===\nLucia Printing Assistant:`;
      
      // ============================================================
      // 4. ወደ AI ይላኩ
      // ============================================================
      const result = await this.activeModel.generateContent(fullPrompt);
      const response = await result.response;
      const aiReply = response.text();
      
      console.log('✅ AI response generated successfully');
      
      return {
        success: true,
        message: aiReply,
        model: this.modelQueue[this.currentModelIndex].name,
        dataUpdated: true,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('AI Error:', error.message);

      if (error.message.includes('503') || error.message.includes('429') || error.message.includes('404')) {
        const switched = await this.switchToNextModel();
        if (switched) {
          return await this.sendMessage(userMessage, conversationHistory);
        }
      }

      return {
        success: false,
        message: '⚠️ ይቅርታ አገልግሎቱ ለጊዜው አይገኝም። እባክዎ ቆይተው ይሞክሩ።\n\nSorry, service temporarily unavailable. Please try again.'
      };
    }
  }

  // ================================================================
  // መሸጎጫ ለማጽዳት (በእጅ ሲፈለግ)
  // ================================================================
  clearCache() {
    this.cachedServices = null;
    this.cachedCategories = null;
    this.cacheTimestamp = null;
    console.log('🔄 Cache cleared - next request will fetch fresh data');
  }
}

module.exports = GeminiMultiModelClient;