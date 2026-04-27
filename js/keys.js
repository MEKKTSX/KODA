// ไฟล์: js/keys.js (สำหรับ GitHub)

const originalAddEventListener = document.addEventListener;
document.addEventListener = function(type, listener, options) {
    if (type === 'DOMContentLoaded' && (document.readyState === 'interactive' || document.readyState === 'complete')) {
        setTimeout(listener, 1);
        return;
    }
    originalAddEventListener.call(this, type, listener, options);
};

window.loadKodaConfig = async () => {
    // ใช้ v4 ตามเดิมที่คุณคุ้นเคย
    const cachedKeys = sessionStorage.getItem('koda_secure_keys_v4');
    if (cachedKeys) {
        window.ENV_KEYS = JSON.parse(cachedKeys);
        return true;
    }

    try {
        // วิ่งไปดึงจาก Vercel (api/keys.py)
        const response = await fetch('/api/keys');
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
        sessionStorage.setItem('koda_secure_keys_v4', JSON.stringify(data));
        return true;

    } catch (error) {
        console.error("KODA API Keys fetch error:", error);
        window.ENV_KEYS = { GEMINI: [], SERPER: [], FINNHUB: '', FINNHUB_ARRAY: [], ALPHAVANTAGE: '' };
        return false;
    }
};
