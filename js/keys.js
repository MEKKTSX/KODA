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
    // 🚨 ลบ cache เก่าทั้งหมดทิ้ง (v4-v7) เพื่อกันคีย์ค้างจากรอบก่อน
    ['koda_secure_keys_v4', 'koda_secure_keys_v5', 'koda_secure_keys_v6', 'koda_secure_keys_v7']
        .forEach((k) => sessionStorage.removeItem(k));

    try {
        // 🌐 ดึงจาก Vercel Backend เท่านั้น (ทุกครั้ง)
        const response = await fetch('/api/get_keys?_=' + Date.now());
        if (!response.ok) throw new Error('Vercel API fetch failed');
        
        const rawData = await response.json();
        
        // รองรับคีย์หลายแบบคั่น: comma / newline / semicolon
        // และรองรับกรณีคีย์ FINNHUB ถูกแปะติดกันยาว ๆ (ไม่มีตัวคั่น)
        const smartSplit = (str, fixedLength = 0) => {
            if (!str) return [];
            const raw = String(str).trim();

            if (fixedLength > 0 && !/[\n,;]/.test(raw) && raw.length >= fixedLength * 2 && raw.length % fixedLength === 0) {
                const chunks = raw.match(new RegExp(`.{1,${fixedLength}}`, 'g')) || [];
                return chunks.map(k => k.trim()).filter(Boolean);
            }

            return raw
                .split(/[\n,;]+/)
                .map(k => k.trim())
                .filter(Boolean);
        };

        const data = {
            GEMINI: smartSplit(rawData.GEMINI),
            SERPER: smartSplit(rawData.SERPER),
            ALPHAVANTAGE: rawData.ALPHAVANTAGE,
            FINNHUB_ARRAY: smartSplit(rawData.FINNHUB, 20)
        };
        data.FINNHUB = data.FINNHUB_ARRAY[0] || '';

        window.ENV_KEYS = data;
        return true;

    } catch (error) {
        // ถ้า API ใช้ไม่ได้ ให้เป็นค่าว่างทันที (ไม่ใช้ cache เก่า)
        console.error("🔥 Fatal Error: ไม่สามารถดึงคีย์จาก Vercel ได้", error);
        window.ENV_KEYS = { GEMINI: [], SERPER: [], FINNHUB: '', FINNHUB_ARRAY: [], ALPHAVANTAGE: '' };
        return false;
    }
};
