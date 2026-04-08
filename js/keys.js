const originalAddEventListener = document.addEventListener;
document.addEventListener = function(type, listener, options) {
    if (type === 'DOMContentLoaded' && (document.readyState === 'interactive' || document.readyState === 'complete')) {
        setTimeout(listener, 1);
        return;
    }
    originalAddEventListener.call(this, type, listener, options);
};

window.loadKodaConfig = async () => {
    const cachedKeys = sessionStorage.getItem('koda_secure_keys');
    if (cachedKeys) { window.ENV_KEYS = JSON.parse(cachedKeys); return true; }

    try {
        const response = await fetch('/api/keys');
        const data = await response.json();
        
        if (typeof data.GEMINI === 'string' && data.GEMINI.trim() !== '') data.GEMINI = data.GEMINI.split(',').map(k => k.trim()); else data.GEMINI = [];
        if (typeof data.SERPER === 'string' && data.SERPER.trim() !== '') data.SERPER = data.SERPER.split(',').map(k => k.trim()); else data.SERPER = [];
        
        // 📌 หั่นคีย์ Finnhub เป็น Array
        if (typeof data.FINNHUB === 'string' && data.FINNHUB.trim() !== '') data.FINNHUB = data.FINNHUB.split(',').map(k => k.trim()); else data.FINNHUB = [];
        
        window.ENV_KEYS = data;
        sessionStorage.setItem('koda_secure_keys', JSON.stringify(data));
        return true;
    } catch (error) {
        window.ENV_KEYS = { GEMINI: [], SERPER: [], FINNHUB: [], ALPHAVANTAGE: '' };
        return false;
    }
};
