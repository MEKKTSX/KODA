// ไฟล์: js/keys.js

// 📌 1. โค้ดตัวแก้บัค (Hack) ที่ผมเขียนชดใช้กรรม ช่วยให้สคริปต์ที่โหลดช้าทำงานได้ปกติ
const originalAddEventListener = document.addEventListener;
document.addEventListener = function(type, listener, options) {
    // ถ้าหน้าเว็บโหลดเสร็จไปแล้ว แต่มีไฟล์ JS มารอจังหวะ DOMContentLoaded ให้สั่งรันทันที!
    if (type === 'DOMContentLoaded' && (document.readyState === 'interactive' || document.readyState === 'complete')) {
        setTimeout(listener, 1);
        return;
    }
    originalAddEventListener.call(this, type, listener, options);
};

// 📌 2. ฟังก์ชันดึงกุญแจจาก Vercel (ตัวเดิม)
window.loadKodaConfig = async () => {
    try {
        const response = await fetch('/api/keys');
        if (!response.ok) throw new Error('Failed to fetch config');
        const data = await response.json();
        
        window.ENV_KEYS = data;
        console.log("✅ KODA Config Loaded via Vercel Bridge");
        return true;
    } catch (error) {
        console.error("❌ Config Loading Error:", error);
        window.ENV_KEYS = { GEMINI: [], FINNHUB: '', ALPHAVANTAGE: '' };
        return false;
    }
};
