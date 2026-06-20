const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./database');

// ================================================================
// BASE SYSTEM PROMPT - ቋሚ መረጃ
// ================================================================
const BASE_SYSTEM_PROMPT = `You are the official AI Customer Service Agent for "Lucia Printing" (luciaprinting.et) - Ethiopia's premier modern printing and advertising company.
### LANGUAGE RULES (VERY IMPORTANT!):
- Customer writes in Amharic (አማርኛ) → Reply ONLY in Amharic
- Customer writes in English → Reply ONLY in English
## 🏢 ABOUT LUCIA PRINTING
Lucia Printing is a modern printing and advertising company based in Addis Ababa, Ethiopia. We provide high-quality printing services using state-of-the-art technology.

📍 Location: Bole, Addis Ababa, Gerji Mebrat Hail
📞 Phone: +251-939-604444| +251-965-191953
⏰ Hours: Monday-Saturday 2:00 AM - 12:30 AM (Sunday closed)
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
Customer: "ስለ ሉሲያ ህትመት ንገረኝ"
You: Provide a warm introduction about Lucia Printing, our services, location, and how we can help.

Customer: "ለቲሸርት ህትመት ምን ያህል ነው?"
You: "የአንድ ቲሸርት ዋጋ 150 ብር ነው። ከ10 በላይ ከሆነ 120 ብር እያንዳንዱ ነው። ቁሳቁስ፣ መጠን እና ጊዜ ማብራራት..."

Customer: "ሌዘር ቅርጻቅርጽ በእንጨት 20x30 ምን ያህል ያስከፍላል?"
You: "20×30=600 ካሬ ሴንቲ ሜትር × 2 ብር = 1,200 ብር ነው።"

Customer: "የስራ ሰዓታችሁ ስንት ነው?"
You: "ሰኞ-ቅዳሜ 2:00 AM - 12:30 AM፣ እሁድ ዝግ ነን።"
`;

// ================================================================
// MOCK AI - ኮታ ሲያልቅ የሚሰራ
// ================================================================
class MockAI {
  async sendMessage(userMessage, conversationHistory = []) {
    const lowerMsg = userMessage.toLowerCase();
    
    // ስለ ሉሲያ ጥያቄ
    if (lowerMsg.includes('ሉሲያ') || lowerMsg.includes('lucia') || lowerMsg.includes('ኩባንያ') || lowerMsg.includes('company')) {
      return {
        success: true,
        message: `🏢 **ስለ ሉሲያ ህትመት / About Lucia Printing**

ሉሲያ ህትመት በኢትዮጵያ ውስጥ ዘመናዊ የህትመት እና የማስታወቂያ አገልግሎት ሰጪ ኩባንያ ነው።

📍 **አድራሻ:** ቦሌ ፣ ገርጂ ፣ ብርሃን ህንፃ
📞 **ስልክ:** +251-939-604444 | +251-965-191953
⏰ **የስራ ሰዓት:** ሰኞ-ቅዳሜ 2:00 AM - 12:30 AM (እሁድ ዝግ)
🌐 **ድረ-ገጽ:** www.luciaprinting.et
📧 **ኢሜይል:** luciaprintingandadvertising@gmail.com
💬 **ቴሌግራም:** @Luciaprint

**አገልግሎቶቻችን:**
1. 👕 ዲቲኤፍ ቲሸርት ህትመት
2. 🔴 ሌዘር ቅርጻቅርጽ እና መቁረጥ
3. 📢 ባነር እና ማስታወቂያ
4. 📇 ቢዝነስ ካርድ
5. 📎 ስቲከር ህትመት

ለበለጠ መረጃ ከሰው አገልግሎታችን ጋር ያነጋግሩ!`
      };
    }
    
    // አገልግሎቶች
    if (lowerMsg.includes('አገልግሎት') || lowerMsg.includes('service')) {
      return {
        success: true,
        message: `📋 **የሉሲያ ህትመት አገልግሎቶች / Lucia Printing Services**

1. 👕 **ዲቲኤፍ ቲሸርት ህትመት**
   • አንድ: 150 ብር | 10+: 120 ብር
   • ጥጥ, ፖሊስተር, ብሌንድ
   • ጊዜ: 2-3 ቀን

2. 🔴 **ሌዘር ቅርጻቅርጽ**
   • 2 ብር/ሴሜ²
   • እንጨት, አክሬሊክ, ቆዳ, ብርጭቆ
   • ጊዜ: 1-3 ቀን

3. 📢 **ባነር እና ማስታወቂያ**
   • 350-650 ብር/m²
   • ጊዜ: 2-4 ቀን

4. 📇 **ቢዝነስ ካርድ** - 500 ብር/100 ቁራጭ
5. 📎 **ስቲከር** - 5 ብር/ቁራጭ (50+)

ለበለጠ መረጃ ከሰው አገልግሎታችን ጋር ያነጋግሩ!`
      };
    }
    
    // ማዘዝ
    if (lowerMsg.includes('ማዘዝ') || lowerMsg.includes('order')) {
      return {
        success: true,
        message: `🛒 **ማዘዝ / Place Order**

እባክዎ የሚከተሉትን መረጃዎች ይላኩልኝ:

1️⃣ ሙሉ ስም / Full Name
2️⃣ ስልክ ቁጥር / Phone Number
3️⃣ የሚፈልጉት አገልግሎት / Service
4️⃣ ብዛት / Quantity

ከዚያ ለሰው አገልግሎት እናስተላልፋለን።

👤 @Luciaprint`
      };
    }
    
    // አድራሻ
    if (lowerMsg.includes('አድራሻ') || lowerMsg.includes('address') || lowerMsg.includes('location')) {
      return {
        success: true,
        message: `📍 **አድራሻ / Address**

ቦሌ ፣ ገርጂ ፣ ብርሃን ህንፃ

Bole, Gerji, Mebrat Hail Building

📞 +251-939-604444 | +251-965-191953
🌐 www.luciaprinting.et
💬 @Luciaprint`
      };
    }
    
    // የስራ ሰዓት
    if (lowerMsg.includes('ሰዓት') || lowerMsg.includes('hours') || lowerMsg.includes('time')) {
      return {
        success: true,
        message: `⏰ **የስራ ሰዓት / Business Hours**

ሰኞ - ቅዳሜ: 2:00 AM - 12:30 AM
እሁድ: ዝግ / Closed

Monday - Saturday: 2:00 AM - 12:30 AM
Sunday: Closed`
      };
    }
    
    // ዋጋ ማስላት
    const numbers = userMessage.match(/\d+/g);
    if (lowerMsg.includes('ቲሸርት') || lowerMsg.includes('tshirt')) {
      let qty = 1;
      if (numbers && numbers.length > 0) {
        qty = parseInt(numbers[0]);
      }
      const price = qty >= 10 ? 120 : 150;
      const total = qty * price;
      return {
        success: true,
        message: `👕 **ቲሸርት ህትመት / T-Shirt Printing**

${qty} ቲሸርት(ቶች):
• በአንድ: ${price} ብር
• ድምር: ${total} ብር

${qty >= 10 ? '✅ የጅምላ ቅናሽ አግኝተዋል! (10+ ቲሸርቶች)' : '💡 ከ10 በላይ ከሆነ 120 ብር እያንዳንዱ ነው!'}

ለማዘዝ: @Luciaprint`
      };
    }
    
    if (lowerMsg.includes('ሌዘር') || lowerMsg.includes('laser')) {
      if (numbers && numbers.length >= 2) {
        const length = parseInt(numbers[0]);
        const width = parseInt(numbers[1]);
        const area = length * width;
        const price = area * 2;
        return {
          success: true,
          message: `🔴 **ሌዘር ቅርጻቅርጽ / Laser Engraving**

ርዝመት: ${length} ሴ.ሜ
ስፋት: ${width} ሴ.ሜ
አካባቢ: ${area} ሴሜ²
ዋጋ: ${area} × 2 ብር = ${price} ብር

💡 ለሌሎች ቁሳቁሶች ዋጋ ሊለያይ ይችላል

ለማዘዝ: @Luciaprint`
        };
      }
      return {
        success: true,
        message: `🔴 **ሌዘር ቅርጻቅርጽ / Laser Engraving**

ዋጋ: 2 ብር በካሬ ሴ.ሜ (cm²)
ቀመር: ርዝመት × ስፋት × 2 ብር

ምሳሌ: 10cm × 20cm = 200 ሴሜ² × 2 = 400 ብር

ርዝመት እና ስፋት ይንገሩኝ!`
      };
    }
    
    // መደበኛ ምላሽ
    return {
      success: true,
      message: `🌟 **ሉሲያ ህትመት / Lucia Printing**

እንኳን ደህና መጡ! እኔ የሉሲያ ህትመት ረዳት ነኝ።

**አገልግሎቶቻችን / Our Services:**
1. 👕 ዲቲኤፍ ቲሸርት - 150-120 ብር
2. 🔴 ሌዘር ቅርጻቅርጽ - 2 ብር/ሴሜ²
3. 📢 ባነር - 350-650 ብር/m²
4. 📇 ቢዝነስ ካርድ - 500 ብር/100 ቁራጭ
5. 📎 ስቲከር - 5 ብር/ቁራጭ

💬 ማንኛውንም ጥያቄ መጠየቅ ይችላሉ!
📞 @Luciaprint`
    };
  }
}

// ================================================================
// GEMINI AI CLIENT (ከQuota መፍትሄ ጋር)
// ================================================================
class GeminiMultiModelClient {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelQueue = [
      { name: "gemini-3.5-flash", priority: 1, description: "የመጀመሪያ ምርጫ - እጅግ ፈጣን" },
      { name: "gemini-3.1-flash-lite", priority: 2, description: "ሁለተኛ አማራጭ - ፈጣን እና ርካሽ" },
      { name: "gemini-2.5-flash", priority: 3, description: "ሶስተኛ አማራጭ - የተረጋጋ" },
      { name: "gemini-3.1-pro", priority: 4, description: "የመጨረሻ አማራጭ - ኃይለኛ" }
    ];
    
    this.currentModelIndex = 0;
    this.activeModel = null;
    this.modelFailures = new Map();
    this.quotaExhausted = false;
    this.useMockFallback = true; // ኮታ ሲያልቅ ወደ ሞክ ይቀየር
    
    // Mock AI instance
    this.mockAI = new MockAI();
    
    // የዳታቤዝ መረጃ መሸጎጫ
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
        // ኮታ ከሆነ ወደ ሞክ ይቀየር
        if (error.message.includes('429') || error.message.includes('quota')) {
          console.log('⚠️ Quota exceeded! Switching to Mock mode...');
          this.quotaExhausted = true;
          return false;
        }
      }
    }
    return false;
  }

  async switchToNextModel() {
    this.modelFailures.set(this.modelQueue[this.currentModelIndex].name, true);
    this.currentModelIndex++;
    if (this.currentModelIndex >= this.modelQueue.length) {
      // ሁሉም ሞዴሎች ከተሳኑ ወደ ሞክ ይቀየር
      this.quotaExhausted = true;
      console.log('⚠️ All models failed! Switching to Mock mode...');
      return false;
    }
    return await this.initModel();
  }

  // ================================================================
  // ከዳታቤዝ መረጃ ማግኘት
  // ================================================================
  async getFreshServiceData() {
    try {
      if (this.cachedServices && this.cacheTimestamp && 
          (Date.now() - this.cacheTimestamp) < this.cacheTTL) {
        console.log('📊 Using cached service data');
        return { services: this.cachedServices, categories: this.cachedCategories };
      }

      console.log('📊 Fetching fresh data from database...');
      
      const services = await db.getAllServices();
      const categories = await db.getAllCategories();
      
      const enrichedServices = [];
      for (const service of services) {
        const fullService = await db.getServiceBySlug(service.slug);
        enrichedServices.push(fullService || service);
      }
      
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
  // የዳታቤዝ መረጃን ወደ ጽሁፍ መቀየር
  // ================================================================
  buildServiceDataText(services, categories) {
    let text = '\n## 📋 REAL-TIME SERVICE DATA FROM DATABASE\n';
    text += '⚠️ ይህ መረጃ በቀጥታ ከዳታቤዝ የተወሰደ ነው!\n\n';
    
    if (categories.length > 0) {
      text += '### 📂 CATEGORIES / ምድቦች:\n';
      categories.forEach(c => {
        text += `- ${c.name} (${c.slug})`;
        if (c.description) text += ` - ${c.description}`;
        text += '\n';
      });
      text += '\n';
    }
    
    text += '### 🎯 ALL SERVICES WITH CURRENT PRICES:\n\n';
    
    services.forEach((s, index) => {
      text += `#### ${index + 1}. ${s.title || 'N/A'}\n`;
      text += `- **Slug:** ${s.slug || 'N/A'}\n`;
      text += `- **ማጠቃለያ:** ${s.short_description || 'N/A'}\n`;
      if (s.full_description) {
        text += `- **ዝርዝር:** ${s.full_description.substring(0, 200)}${s.full_description.length > 200 ? '...' : ''}\n`;
      }
      text += `- **💰 ዋጋ / Price:** ${s.price_range || 'N/A'}\n`;
      text += `- **📦 ዝቅተኛ ትዕዛዝ:** ${s.min_order || 'N/A'}\n`;
      text += `- **⏱️ ጊዜ:** ${s.turnaround || 'N/A'}\n`;
      text += `- **📁 ምድብ:** ${s.category || 'N/A'}\n`;
      
      if (s.features && s.features.length > 0) {
        text += `- **✨ ባህሪያት:** ${s.features.join(', ')}\n`;
      }
      
      if (s.materials && s.materials.length > 0) {
        text += `- **📦 ቁሳቁሶች:** ${s.materials.join(', ')}\n`;
      }
      
      text += '\n---\n\n';
    });
    
    text += `\n📊 **በድምሩ ${services.length} አገልግሎቶች ከዳታቤዝ ተገኝተዋል!**\n`;
    
    return text;
  }

  // ================================================================
  // ዋናው sendMessage
  // ================================================================
  async sendMessage(userMessage, conversationHistory = []) {
    // ኮታ ካልቀረ ወይም ሞክ ሞድ ከሆነ
    if (this.quotaExhausted || !this.activeModel) {
      console.log('🔄 Using Mock AI (quota exhausted or no model available)');
      return await this.mockAI.sendMessage(userMessage, conversationHistory);
    }

    try {
      console.log('💬 Processing message:', userMessage.substring(0, 50) + '...');
      
      const { services, categories } = await this.getFreshServiceData();
      const serviceDataText = this.buildServiceDataText(services, categories);
      
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
      
      let fullPrompt = BASE_SYSTEM_PROMPT;
      fullPrompt += serviceDataText;
      fullPrompt += historyText;
      fullPrompt += `\n=== CURRENT CUSTOMER MESSAGE ===\nCustomer: ${userMessage}\n\n=== YOUR RESPONSE ===\nLucia Printing Assistant:`;
      
      const result = await this.activeModel.generateContent(fullPrompt);
      const response = await result.response;
      const aiReply = response.text();
      
      console.log('✅ AI response generated successfully');
      
      return {
        success: true,
        message: aiReply,
        model: this.modelQueue[this.currentModelIndex].name,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('AI Error:', error.message);

      // ኮታ ከሆነ ወደ ሞክ ይቀየር
      if (error.message.includes('429') || error.message.includes('quota')) {
        this.quotaExhausted = true;
        console.log('⚠️ Quota exceeded! Switching to Mock mode...');
        return await this.mockAI.sendMessage(userMessage, conversationHistory);
      }

      if (error.message.includes('503') || error.message.includes('404')) {
        const switched = await this.switchToNextModel();
        if (switched) {
          return await this.sendMessage(userMessage, conversationHistory);
        }
      }

      return {
        success: false,
        message: '⚠️ ይቅርታ አገልግሎቱ ለጊዜው አይገኝም። እባክዎ ቆይተው ይሞክሩ።'
      };
    }
  }

  clearCache() {
    this.cachedServices = null;
    this.cachedCategories = null;
    this.cacheTimestamp = null;
    console.log('🔄 Cache cleared');
  }
}

module.exports = GeminiMultiModelClient;