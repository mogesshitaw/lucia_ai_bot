const axios = require('axios');

class Database {
  constructor() {
    // PHP API Configuration
    this.apiBaseUrl = process.env.API_BASE_URL || 'https://luciaprinting.et/api/bot-api.php';
    this.apiKey = process.env.API_KEY || 'LuciaPrinting2025SecureKey123!@#';
    this.isConnected = false;
    this.timeout = 15000; // 15 ሰከንድ
  }

  async connect() {
    try {
      console.log('🔄 Connecting to PHP API...');
      console.log(`📡 API URL: ${this.apiBaseUrl}`);
      
      const response = await this.apiRequest('test');
      
      if (response && response.success) {
        this.isConnected = true;
        console.log('✅ API connected successfully!');
        if (response.data) {
          console.log(`📊 Database: ${response.data.database || 'N/A'}`);
          console.log(`📍 Host: ${response.data.host || 'N/A'}`);
        }
        return true;
      }
      
      console.log('❌ API connection failed');
      this.isConnected = false;
      return false;
      
    } catch (error) {
      console.error('❌ API connection error:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  // ==================== ዋናው API ጥያቄ ተግባር ====================
  async apiRequest(action, params = {}) {
    try {
      const url = new URL(this.apiBaseUrl);
      url.searchParams.append('action', action);
      url.searchParams.append('api_key', this.apiKey);
      
      // ተጨማሪ መለኪያዎችን ያክሉ
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, value);
        }
      }

      console.log(`📤 API Request: ${action} with params:`, params);

      const response = await axios.get(url.toString(), {
        headers: {
          'X-API-Key': this.apiKey,
          'Accept': 'application/json',
          'User-Agent': 'LuciaPrintingBot/1.0'
        },
        timeout: this.timeout
      });

      return response.data;
      
    } catch (error) {
      console.error(`❌ API Error (${action}):`, error.message);
      
      if (error.code === 'ECONNABORTED') {
        console.error('⏰ Request timeout - server took too long to respond');
      } else if (error.response) {
        console.error('📝 Server response:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('📝 No response received from server');
      }
      
      return { 
        success: false, 
        error: error.message,
        data: null
      };
    }
  }

  // ==================== አገልግሎቶች ====================

  // ሁሉንም አገልግሎቶች ማግኘት
  async getAllServices() {
    if (!this.isConnected) {
      console.warn('⚠️ API not connected - returning empty array');
      return [];
    }
    
    try {
      const result = await this.apiRequest('getAllServices');
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Error fetching services:', error);
      return [];
    }
  }

  // በSlug አገልግሎት ማግኘት
  async getServiceBySlug(slug) {
    if (!this.isConnected) {
      console.warn('⚠️ API not connected - returning null');
      return null;
    }
    
    try {
      const result = await this.apiRequest('getServiceBySlug', { slug });
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Error fetching service by slug:', error);
      return null;
    }
  }

  // ሁሉንም ምድቦች ማግኘት
  async getAllCategories() {
    if (!this.isConnected) {
      console.warn('⚠️ API not connected - returning empty array');
      return [];
    }
    
    try {
      const result = await this.apiRequest('getCategories');
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  // በምድብ አገልግሎቶች ማግኘት
  async getServicesByCategory(category) {
    if (!this.isConnected) {
      console.warn('⚠️ API not connected - returning empty array');
      return [];
    }
    
    try {
      const result = await this.apiRequest('getServicesByCategory', { category });
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Error fetching services by category:', error);
      return [];
    }
  }

  // ተለይተው የቀረቡ አገልግሎቶች
  async getFeaturedServices() {
    if (!this.isConnected) {
      console.warn('⚠️ API not connected - returning empty array');
      return [];
    }
    
    try {
      const result = await this.apiRequest('getFeatured');
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Error fetching featured services:', error);
      return [];
    }
  }

  // ታዋቂ አገልግሎቶች
  async getPopularServices() {
    if (!this.isConnected) {
      console.warn('⚠️ API not connected - returning empty array');
      return [];
    }
    
    try {
      const result = await this.apiRequest('getPopular');
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Error fetching popular services:', error);
      return [];
    }
  }

  // ፍለጋ
  async searchServices(keyword) {
    if (!this.isConnected) {
      console.warn('⚠️ API not connected - returning empty array');
      return [];
    }
    
    try {
      const result = await this.apiRequest('search', { keyword });
      return result.success ? result.data : [];
    } catch (error) {
      console.error('Error searching services:', error);
      return [];
    }
  }

  // ==================== ለሙከራ ====================
  
  // API ግንኙነት ለመፈተሽ
  async testConnection() {
    try {
      const result = await this.apiRequest('test');
      return result.success;
    } catch (error) {
      console.error('Test connection failed:', error);
      return false;
    }
  }

  // የሁኔታ መረጃ ለማግኘት
  async getStatus() {
    return {
      connected: this.isConnected,
      apiUrl: this.apiBaseUrl,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new Database();