// ไฟล์: js/keys.js

// 📌 1. โค้ดตัวแก้บัค (Hack) ที่ผมเขียนชดใช้กรรม ช่วยให้สคริปต์ที่โหลดช้าทำงานได้ปกติ
const originalAddEventListener = document.addEventListener;
document.addEventListener = function(type, listener, options) {
    if (type === 'DOMContentLoaded' && (document.readyState === 'interactive' || document.readyState === 'complete')) {
        setTimeout(listener, 1);
        return;
    }
    originalAddEventListener.call(this, type, listener, options);
};

// 📌 2. KODA Config Loader
window.loadKodaConfig = async () => {
    const cachedKeys = sessionStorage.getItem('koda_secure_keys');
    if (cachedKeys) {
        window.ENV_KEYS = JSON.parse(cachedKeys);
        return true;
    }

    try {
        const response = await fetch('/api/keys');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        if (typeof data.GEMINI === 'string' && data.GEMINI.trim() !== '') data.GEMINI = data.GEMINI.split(',').map(k => k.trim()); else data.GEMINI = [];
        if (typeof data.SERPER === 'string' && data.SERPER.trim() !== '') data.SERPER = data.SERPER.split(',').map(k => k.trim()); else data.SERPER = [];
        
        // 📌 [SUPER FIX] จัดการคีย์ Finnhub อย่างฉลาด
        if (typeof data.FINNHUB === 'string' && data.FINNHUB.trim() !== '') {
            const allKeys = data.FINNHUB.split(',').map(k => k.trim());
            data.FINNHUB_ARRAY = allKeys; // ส่ง Array ให้ระบบใหม่ (kodalab1.js) ใช้สลับ 3 คีย์
            data.FINNHUB = allKeys[0];    // ส่ง String คีย์แรก ให้ระบบเก่า (api.js, markets.js) ใช้ตามปกติ
        } else {
            data.FINNHUB_ARRAY = [];
            data.FINNHUB = '';
        }
        
        window.ENV_KEYS = data;
        sessionStorage.setItem('koda_secure_keys', JSON.stringify(data));
        return true;

    } catch (error) {
        console.error("KODA API Keys fetch error:", error);
        window.ENV_KEYS = { GEMINI: [], SERPER: [], FINNHUB: '', FINNHUB_ARRAY: [], ALPHAVANTAGE: '' };
        return false;
    }
};