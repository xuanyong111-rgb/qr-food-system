const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 450, body: "Method Not Allowed" };
  }

  try {
    const { shopId, tableId, cartItems } = JSON.parse(event.body);
    const db = admin.database();

    // 1. 从服务端拉取真实菜单价格（绝不信任前端传来的金额）
    const menuSnapshot = await db.ref(`menu_config/${shopId}/group_menu`).once('value');
    const officialMenu = menuSnapshot.val() || [];
    const priceMap = {};
    officialMenu.forEach(item => { if (item.name) priceMap[item.name] = parseFloat(item.price) || 0; });

    // 2. 服务端重新核算账单总价与构建安全的 safeCart
    let validatedCart = {};
    let calculatedSubtotal = 0;

    for (let rawKey in cartItems) {
      const item = cartItems[rawKey];
      const count = parseInt(item.count) || 1;
      
      // 提取纯菜品名称匹配真实价格
      let baseName = rawKey.replace(/\s*[\(（].+?[\)）]/g, '').trim();
      let realUnitPrice = priceMap[baseName] || 0;

      validatedCart[rawKey] = {
        count: count,
        price: realUnitPrice,
        spec: item.spec || ""
      };
      calculatedSubtotal += realUnitPrice * count;
    }

    // 3. 构建安全订单数据结构
    const isTakeaway = (!tableId || tableId === "外带");
    const safeTableId = tableId ? tableId.replace(/[^a-zA-Z0-9]/g, '') : "";
    const targetOrderId = isTakeaway ? `ORD_${Date.now()}` : `ORD_${shopId.substring(0, 4)}_${safeTableId}`;

    const secureOrderData = {
      shopId,
      tableNumber: tableId || "外带",
      items: validatedCart,
      kitchenItems: validatedCart,
      subtotal: calculatedSubtotal,
      status: "pending",
      timestamp: new Date().toISOString()
    };

    // 4. 由具备最高权限的 SDK 直接安全写入 Firebase（无需前端暴露任何 Token）
    await db.ref(`orders/${targetOrderId}`).set(secureOrderData);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, orderId: targetOrderId })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "安全校验失败" })
    };
  }
};