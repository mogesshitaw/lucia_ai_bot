const fs = require('fs');
const path = require('path');

const ORDERS_DIR = path.join(__dirname, '..', 'orders');

// Ensure orders directory exists
if (!fs.existsSync(ORDERS_DIR)) {
  fs.mkdirSync(ORDERS_DIR);
}

class OrderStorage {
  static saveOrder(userId, username, customerName, phoneNumber, conversationSummary) {
    const orderData = {
      orderId: `ORD-${Date.now()}-${userId}`,
      timestamp: new Date().toISOString(),
      userId: userId,
      username: username || 'unknown',
      customerName: customerName,
      phoneNumber: phoneNumber,
      conversationSummary: conversationSummary,
      status: 'pending'
    };

    const filename = `${orderData.orderId}.json`;
    const filepath = path.join(ORDERS_DIR, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(orderData, null, 2));
    
    console.log(`✅ Order saved: ${filename}`);
    return orderData.orderId;
  }

  static getRecentOrders(limit = 10) {
    const files = fs.readdirSync(ORDERS_DIR);
    const orders = [];
    
    for (const file of files.slice(-limit)) {
      const content = fs.readFileSync(path.join(ORDERS_DIR, file), 'utf8');
      orders.push(JSON.parse(content));
    }
    
    return orders.reverse();
  }
}

module.exports = OrderStorage;