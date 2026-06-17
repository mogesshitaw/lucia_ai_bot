const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
  console.log('Fetching available models...\n');
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  try {
    // Try to list models (this might not work with all API keys)
    const models = await genAI.listModels();
    console.log('✅ Available models:');
    models.forEach(model => {
      console.log(`  - ${model.name}`);
    });
  } catch (error) {
    console.log('⚠️ Cannot list models, trying common names...\n');
    
    // Test common model names
    const modelNames = [
      "gemini-1.5-flash",
      "gemini-1.5-pro", 
      "gemini-1.0-pro",
      "gemini-1.0-pro-vision",
      "gemini-pro-vision",
      "models/gemini-1.5-flash"
    ];
    
    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Say 'OK'");
        await result.response;
        console.log(`✅ WORKING: ${modelName}`);
        break;
      } catch (err) {
        console.log(`❌ FAILED: ${modelName}`);
      }
    }
  }
}

listModels();