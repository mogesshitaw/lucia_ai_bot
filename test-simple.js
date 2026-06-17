const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function quickTest() {
  console.log('Testing Gemini API...');
  console.log('API Key exists:', !!process.env.GEMINI_API_KEY);
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  try {
    const result = await model.generateContent("Say 'Hello' in Amharic");
    const response = await result.response;
    console.log('✅ SUCCESS! Response:', response.text());
  } catch (error) {
    console.error('❌ FAILED:', error.message);
  }
}

quickTest();