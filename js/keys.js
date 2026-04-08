// ตัวช่วยให้สคริปต์โหลดทัน
const originalAddEventListener = document.addEventListener;
document.addEventListener = function(type, listener, options) {
    if (type === 'DOMContentLoaded' && (document.readyState === 'interactive' || document.readyState === 'complete')) {
        setTimeout(listener, 1);
        return;
    }
    originalAddEventListener.call(this, type, listener, options);
};

// KODA Config Loader
window.loadKodaConfig = async () => {
    // เช็ก Cache ใน sessionStorage ก่อนเพื่อความเร็ว
    const cachedKeys = sessionStorage.getItem('koda_secure_keys');
    if (cachedKeys) {
        window.ENV_KEYS = JSON.parse(cachedKeys);
        return true;
    }

    try {
        const response = await fetch('/api/keys');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        // 📌 จัดการคีย์ GEMINI ให้เป็น Array
        if (typeof data.GEMINI === 'string' && data.GEMINI.trim() !== '') {
            data.GEMINI = data.GEMINI.split(',').map(k => k.trim());
        } else {
            data.GEMINI = [];
        }

        // 📌 จัดการคีย์ SERPER ให้เป็น Array
        if (typeof data.SERPER === 'string' && data.SERPER.trim() !== '') {
            data.SERPER = data.SERPER.split(',').map(k => k.trim());
        } else {
            data.SERPER = [];
        }
        
        // เซฟลง Global Variable และ Cache
        window.ENV_KEYS = data;
        sessionStorage.setItem('koda_secure_keys', JSON.stringify(data));
        return true;

    } catch (error) {
        console.error("KODA API Keys fetch error:", error);
        // Fallback กันแอปค้างกรณีเน็ตพัง
        window.ENV_KEYS = { GEMINI: [], SERPER: [], FINNHUB: '', ALPHAVANTAGE: '' };
        return false;
    }
};
