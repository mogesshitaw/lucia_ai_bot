const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./database');

// ሙሉ የስርዓት መመሪያ (ከላይ እንደነበረው)
const SYSTEM_PROMPT = `You are the official AI Customer Service Agent for "Lucia Printing" (luciaprinting.et) - Ethiopia's premier modern printing and advertising company.

### LANGUAGE RULES (VERY IMPORTANT!):
- Customer writes in Amharic (አማርኛ) → Reply ONLY in Amharic
- Customer writes in English → Reply ONLY in English

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 SERVICE 1: DTF T-SHIRT PRINTING (ዲቲኤፍ ቲሸርት)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

አማርኛ:
• የአንድ ቲሸርት ዋጋ: 150 ብር
• ከ10 በላይ ሲሆን: 120 ብር ለአንድ (የጅምላ ቅናሽ)
• ቁሳቁስ: 100% ጥጥ, ፖሊስተር, ብሌንድ
• መጠን: XS እስከ 5XL
• ጊዜ: 2-3 ቀን ስራ

English:
• Single shirt: 150 ETB
• Bulk (10+ shirts): 120 ETB each
• Material: Cotton, Polyester, Blend
• Sizes: XS to 5XL
• Turnaround: 2-3 business days

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 SERVICE 2: LASER ENGRAVING (ሌዘር ቅርጻቅርጽ)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

አማርኛ:
• ዋጋ: 2 ብር በካሬ ሴንቲ ሜትር (cm²)
• ቀመር: ርዝመት × ስፋት × 2 ብር × ብዛት
• ቁሳቁሶች: እንጨት(2), አክሬሊክ(2.5), ቆዳ(3), ብርጭቆ(4), ብረት(5)

English:
• Price: 2 ETB per cm²
• Formula: Length × Width × 2 ETB × Quantity
• Materials: Wood(2), Acrylic(2.5), Leather(3), Glass(4), Metal(5)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 SERVICE 3: BANNER & BRANDING (ባነር)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

አማርኛ:
• ዋጋ በካሬ ሜትር: መደበኛ(350), መረብ(450), UV(550), ፕሪሚየም(650)

English:
• Price per m²: Standard(350), Mesh(450), UV(550), Premium(650)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 ORDER PROCESS - HUMAN AGENT HANDOFF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHEN CUSTOMER WANTS TO ORDER:
1. Collect: Full Name, Phone Number, Service & Quantity
2. Say: "✅ ማዘዣዎ ተዘጋጅቷል! ወደ ሰው አገልግሎታችን ይሂዱ: https://t.me/Luciaprint"
3. Save order to JSON file.`;

class GeminiMultiModelClient {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    
   // የሚሞከሩ ሞዴሎች በቅደም ተከተል (Fallback order) - Updated for 2026 Stable Stack
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
    this.modelFailures = new Map(); // የወደቁ ሞዴሎችን ለማስታወስ
    
    // በራስ-ሰር የመጀመሪያውን ሞዴል ይሞክሩ
    this.initModel();
  }

  async initModel() {
    for (let i = 0; i < this.modelQueue.length; i++) {
      const modelInfo = this.modelQueue[i];
      
      // ይህ ሞዴል ከዚህ በፊት ወድቋል?
      if (this.modelFailures.get(modelInfo.name) === true) {
        console.log(`⏭️ Skipping failed model: ${modelInfo.name}`);
        continue;
      }
      
      try {
        console.log(`🔄 Trying model: ${modelInfo.name} (${modelInfo.description})`);
        
        const testModel = this.genAI.getGenerativeModel({ 
          model: modelInfo.name,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          }
        });
        
        // ቀላል ሙከራ ለማድረግ
        const testResult = await testModel.generateContent("Say 'OK'");
        await testResult.response;
        
        // ሞዴሉ ሰርቷል!
        this.activeModel = testModel;
        this.currentModelIndex = i;
        console.log(`✅ ACTIVE MODEL: ${modelInfo.name} - ${modelInfo.description}`);
        return true;
        
      } catch (error) {
        console.warn(`❌ Model ${modelInfo.name} failed: ${error.message}`);
        this.modelFailures.set(modelInfo.name, true);
      }
    }
    
    console.error('❌ No Gemini models available!');
    return false;
  }

  async switchToNextModel() {
    console.log('🔄 Switching to next available model...');
    this.modelFailures.set(this.modelQueue[this.currentModelIndex].name, true);
    this.currentModelIndex++;
    
    if (this.currentModelIndex >= this.modelQueue.length) {
      console.error('❌ All models failed!');
      return false;
    }
    
    return await this.initModel();
  }

  async sendMessage(userMessage, conversationHistory = []) {
    // ሞዴል ከሌለ መጀመሪያ ያስጀምሩ
    if (!this.activeModel) {
      const initialized = await this.initModel();
      if (!initialized) {
        return {
          success: false,
          message: '⚠️ ይቅርታ ምንም አይነት AI ሞዴል አይገኝም። እባክዎ ቆይተው ይሞክሩ።\n\nNo AI model available. Please try again.'
        };
      }
    }
    
    try {
      // Build conversation prompt
      let fullPrompt = SYSTEM_PROMPT + "\n\n";
      
      if (conversationHistory && conversationHistory.length > 0) {
        fullPrompt += "Previous conversation:\n";
        const recentHistory = conversationHistory.slice(-8);
        for (const msg of recentHistory) {
          fullPrompt += `${msg.role === 'user' ? 'Customer' : 'Lucia'}: ${msg.content}\n`;
        }
        fullPrompt += "\n";
      }
      
      fullPrompt += `Current customer message: ${userMessage}\n\nLucia Printing Assistant:`;
      
      // ጥያቄውን ለንቁ ሞዴል ላክ
      const result = await this.activeModel.generateContent(fullPrompt);
      const response = await result.response;
      const aiReply = response.text();
      
      return {
        success: true,
        message: aiReply,
        model: this.modelQueue[this.currentModelIndex].name,
        usage: { tokens: response.usageMetadata?.totalTokenCount || 'N/A' }
      };
      
    } catch (error) {
      console.error(`Error with ${this.modelQueue[this.currentModelIndex].name}:`, error.message);
      
      // የ 503, 429, 404 ስህተቶች ከሆኑ ወደሚቀጥለው ሞዴል ቀይር
      if (error.message.includes('503') || 
          error.message.includes('429') || 
          error.message.includes('404') ||
          error.message.includes('unavailable')) {
        
        console.log(`⚠️ Model failed, switching to next...`);
        const switched = await this.switchToNextModel();
        
        if (switched) {
          // ከአዲሱ ሞዴል ጋር እንደገና ሞክር
          return await this.sendMessage(userMessage, conversationHistory);
        }
      }
      
      // ለደንበኛ ማሳያ መልዕክት
      let errorMessage = '⚠️ ይቅርታ አገልግሎቱ ለጊዜው አይገኝም። እባክዎ ቆይተው ይሞክሩ።\n\nSorry, service temporarily unavailable.';
      
      if (error.message.includes('API key') || error.message.includes('auth')) {
        errorMessage = '❌ የGemini API ቁልፍ ትክክል አይደለም።\n\nInvalid Gemini API key.';
      }
      
      return {
        success: false,
        error: error.message,
        message: errorMessage
      };
    }
  }
}

module.exports = GeminiMultiModelClient;