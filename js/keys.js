// ไฟล์: js/keys.js

// 📌 1. โค้ดตัวแก้บัค (Hack) ช่วยให้สคริปต์ที่โหลดช้าทำงานได้ปกติ
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
    // 🚨 1. เปลี่ยนชื่อเป็น v5 เพื่อบังคับเบราว์เซอร์ทิ้งคีย์เน่าๆ ของเก่า
    const cachedKeys = sessionStorage.getItem('koda_secure_keys_v5');
    if (cachedKeys) {
        window.ENV_KEYS = JSON.parse(cachedKeys);
        return true;
    }

    try {
        // 🚨 2. ใส่ ?_=[เวลาปัจจุบัน] ต่อท้าย URL เพื่อหลอกให้เบราว์เซอร์คิดว่าเป็นไฟล์ใหม่เสมอ (ทะลุ Service Worker)
        const response = await fetch('/api/get_keys?_=' + Date.now());
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        if (typeof data.GEMINI === 'string' && data.GEMINI.trim() !== '') data.GEMINI = data.GEMINI.split(',').map(k => k.trim()); else data.GEMINI = [];
        if (typeof data.SERPER === 'string' && data.SERPER.trim() !== '') data.SERPER = data.SERPER.split(',').map(k => k.trim()); else data.SERPER = [];
        
        if (typeof data.FINNHUB === 'string' && data.FINNHUB.trim() !== '') {
            const allKeys = data.FINNHUB.split(',').map(k => k.trim());
            data.FINNHUB_ARRAY = allKeys; 
            data.FINNHUB = allKeys[0];    
        } else {
            data.FINNHUB_ARRAY = [];
            data.FINNHUB = '';
        }
        
        window.ENV_KEYS = data;
        // 🚨 3. เซฟลงชื่อใหม่ v5
        sessionStorage.setItem('koda_secure_keys_v5', JSON.stringify(data));
        return true;

    } catch (error) {
        console.error("KODA API Keys fetch error:", error);
        window.ENV_KEYS = { GEMINI: [], SERPER: [], FINNHUB: '', FINNHUB_ARRAY: [], ALPHAVANTAGE: '' };
        return false;
    }
};
