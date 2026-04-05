// ตัวช่วยให้สคริปต์โหลดทัน
const originalAddEventListener = document.addEventListener;
document.addEventListener = function(type, listener, options) {
    if (type === 'DOMContentLoaded' && (document.readyState === 'interactive' || document.readyState === 'complete')) {
        setTimeout(listener, 1);
        return;
    }
    originalAddEventListener.call(this, type, listener, options);
};

// ไฟล์: js/keys.js
window.loadKodaConfig = async () => {
    // เช็ก Cache ก่อนเพื่อความเร็ว
    const cachedKeys = sessionStorage.getItem('koda_secure_keys');
    if (cachedKeys) {
        window.ENV_KEYS = JSON.parse(cachedKeys);
        return true;
    }

    try {
        const response = await fetch('/api/keys');
        const data = await response.json();
        
        // ถ้าได้มาเป็น String ยาวๆ ให้ Split เป็น Array
        if (typeof data.GEMINI === 'string') {
            data.GEMINI = data.GEMINI.split(',').map(k => k.trim());
        }
        
        window.ENV_KEYS = data;
        sessionStorage.setItem('koda_secure_keys', JSON.stringify(data));
        return true;
    } catch (error) {
        window.ENV_KEYS = { GEMINI: [], FINNHUB: '', ALPHAVANTAGE: '' };
        return false;
    }
};
