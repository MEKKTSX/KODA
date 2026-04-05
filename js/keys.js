// ไฟล์: js/keys.js

// ตัวช่วยให้สคริปต์โหลดทัน
const originalAddEventListener = document.addEventListener;
document.addEventListener = function(type, listener, options) {
    if (type === 'DOMContentLoaded' && (document.readyState === 'interactive' || document.readyState === 'complete')) {
        setTimeout(listener, 1);
        return;
    }
    originalAddEventListener.call(this, type, listener, options);
};

window.loadKodaConfig = async () => {
    // 📌 1. เช็ก Cache ใน Session ก่อน (แก้ปัญหาเว็บโหลดช้า)
    const cachedKeys = sessionStorage.getItem('koda_secure_keys');
    if (cachedKeys) {
        window.ENV_KEYS = JSON.parse(cachedKeys);
        return true;
    }

    try {
        // 📌 2. ถ้าเข้าเว็บครั้งแรก ค่อยวิ่งไปขอ Key จาก Vercel
        const response = await fetch('/api/keys');
        if (!response.ok) throw new Error('Failed to fetch config');
        const data = await response.json();
        
        window.ENV_KEYS = data;
        // เซฟจำไว้ใน Session (ปิดแท็บเบราว์เซอร์ถึงจะหายไป ปลอดภัยแน่นอน)
        sessionStorage.setItem('koda_secure_keys', JSON.stringify(data)); 
        
        console.log("✅ KODA Config Loaded via Vercel Bridge");
        return true;
    } catch (error) {
        console.error("❌ Config Loading Error:", error);
        window.ENV_KEYS = { GEMINI: [], FINNHUB: '', ALPHAVANTAGE: '' };
        return false;
    }
};
