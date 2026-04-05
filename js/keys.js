// ไฟล์: js/keys.js (ตัวนี้คือตัวที่เบราว์เซอร์อ่าน)
window.loadKodaConfig = async () => {
    try {
        // วิ่งไปขอ API Keys จาก Vercel Serverless Function
        const response = await fetch('/api/keys');
        if (!response.ok) throw new Error('Failed to fetch config');
        
        const data = await response.json();
        
        // เอา Key ที่ได้มา ยัดใส่ Global Variable ให้ทุกไฟล์เรียกใช้ได้
        window.ENV_KEYS = data;
        console.log("✅ KODA Config Loaded via Vercel Bridge");
        return true;
    } catch (error) {
        console.error("❌ Config Loading Error:", error);
        // Fallback กรณีรันหน้าคอมตัวเองเล่นๆ (Local) แล้วหา API ไม่เจอ
        window.ENV_KEYS = { GEMINI: [], FINNHUB: '', ALPHAVANTAGE: '' };
        return false;
    }
};
