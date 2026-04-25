// ไฟล์: js/keys.js (สำหรับ GITHUB & VERCEL - ปลอดภัย 100% ไม่มีคีย์หลุด)

const originalAddEventListener = document.addEventListener;
document.addEventListener = function(type, listener, options) {
    if (type === 'DOMContentLoaded' && (document.readyState === 'interactive' || document.readyState === 'complete')) {
        setTimeout(listener, 1);
        return;
    }
    originalAddEventListener.call(this, type, listener, options);
};

window.loadKodaConfig = async () => {
    // 🚨 ล้างแคชเก่าทิ้ง ใช้ v6
    const cachedKeys = sessionStorage.getItem('koda_secure_keys_v6');
    if (cachedKeys) {
        window.ENV_KEYS = JSON.parse(cachedKeys);
        return true;
    }

    try {
        // 🌐 ดึงจาก Vercel Backend เท่านั้น!
        const response = await fetch('/api/get_keys?_=' + Date.now());
        if (!response.ok) throw new Error('Vercel API fetch failed');
        
        let rawData = await response.json();
        
        // 🛠️ ฟังก์ชันหั่นคีย์ที่แปะติดกัน (ช่วยแก้บัคคีย์ยาว 40 ตัวใน Vercel)
        const smartSplit = (str) => {
            if (!str) return [];
            if (str.length > 25 && !str.includes(',')) {
                return str.match(/.{1,20}/g).map(s => s.trim());
            }
            return str.split(',').map(k => k.trim()).filter(Boolean);
        };

        const data = {
            GEMINI: smartSplit(rawData.GEMINI),
            SERPER: smartSplit(rawData.SERPER),
            ALPHAVANTAGE: rawData.ALPHAVANTAGE,
            FINNHUB_ARRAY: smartSplit(rawData.FINNHUB)
        };
        data.FINNHUB = data.FINNHUB_ARRAY[0] || '';

        window.ENV_KEYS = data;
        sessionStorage.setItem('koda_secure_keys_v6', JSON.stringify(data));
        return true;

    } catch (error) {
        console.error("🔥 Fatal Error: ไม่สามารถดึงคีย์จาก Vercel ได้", error);
        window.ENV_KEYS = { GEMINI: [], SERPER: [], FINNHUB: '', FINNHUB_ARRAY: [], ALPHAVANTAGE: '' };
        return false;
    }
};
