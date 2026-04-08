// ตัวช่วยให้สคริปต์โหลดทัน (คงเดิมไว้ตามคำสั่ง)
const originalAddEventListener = document.addEventListener;
document.addEventListener = function(type, listener, options) {
    if (type === 'DOMContentLoaded' && (document.readyState === 'interactive' || document.readyState === 'complete')) {
        setTimeout(listener, 1);
        return;
    }
    originalAddEventListener.call(this, type, listener, options);
};

// ไฟล์: js/keys.js (ฉบับอัปเดต รองรับ 3 Serper Keys)
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
        
        // 📌 จัดการคีย์ GEMINI (ถ้ามาเป็น String ให้แตกเป็น Array)
        if (typeof data.GEMINI === 'string') {
            data.GEMINI = data.GEMINI.split(',').map(k => k.trim());
        }

        // 📌 จัดการคีย์ SERPER (เพิ่มใหม่: เพื่อให้รองรับ 3 คีย์สลับกัน)
        if (typeof data.SERPER === 'string') {
            data.SERPER = data.SERPER.split(',').map(k => k.trim());
        } else if (!data.SERPER) {
            data.SERPER = []; // ป้องกันกรณี Error ถ้าไม่มีคีย์ส่งมา
        }
        
        window.ENV_KEYS = data;
        sessionStorage.setItem('koda_secure_keys', JSON.stringify(data));
        return true;
    } catch (error) {
        console.error("Config Load Error:", error);
        // Fallback กรณีพัง ให้มี Array ว่างรอไว้ไม่ให้แอปค้าง
        window.ENV_KEYS = { GEMINI: [], SERPER: [], FINNHUB: '', ALPHAVANTAGE: '' };
        return false;
    }
};
