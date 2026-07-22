const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

try {
    if (getApps().length === 0) {
        initializeApp({
            credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
            // 物理写死 URL，断绝环境变量读取。修改保存后，务必部署/Push 到 Netlify 才能在线上生效
            databaseURL: "https://qr-foor-orders-default-rtdb.asia-southeast1.firebasedatabase.app"
        });
    }
} catch (error) {
    if (error.code !== 'app/duplicate-app') {
        console.error("Firebase 初始化异常:", error);
    }
}

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const orderData = JSON.parse(event.body);
        
        const db = getDatabase();
        const newOrderRef = db.ref('group_orders').push();

        await newOrderRef.set({
            ...orderData,
            serverTimestamp: Date.now() 
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, orderId: newOrderRef.key })
        };
    } catch (error) {
        console.error("写入数据库失败:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};