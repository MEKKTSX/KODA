window.KodaAI = {
    translationCache: {},
    _queuePromise: Promise.resolve(),

    getSearchKeyword: (headline) => {
        const text = headline.toLowerCase();
        if (text.match(/(war|conflict|missile|attack|military|explosion|bomb|soldier|invasion|israel|gaza|russia|ukraine|iran)/)) return "war,military";
        if (text.match(/(trump|donald trump|white house|us president|biden|usa flag|politics)/)) return "washington,usa";
        if (text.match(/(china|xi jinping|beijing|tariff)/)) return "china,shanghai";
        if (text.match(/(fed|powell|interest rate|inflation|finance|central bank)/)) return "finance,money";
        if (text.match(/(stock market|wall street|nasdaq|trading|chart)/)) return "stock-market,trading";
        if (text.match(/(oil|energy|crude|petroleum)/)) return "oil,energy";
        if (text.match(/(gold|precious metal)/)) return "gold";
        
        return "business,news";
    },

    generateFixedId: (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash) % 1000; 
    },

    findImage: (headline) => {
        const keyword = window.KodaAI.getSearchKeyword(headline);
        const fixedId = window.KodaAI.generateFixedId(headline); 
        return `https://loremflickr.com/400/300/${keyword}?lock=${fixedId}`;
    },

    translateText: async (text) => {
        if (!text) return text;
        const isTranslateOn = localStorage.getItem('koda_translate_th') === 'true';
        if (!isTranslateOn) return text; 

        if (window.KodaAI.translationCache[text]) {
            return window.KodaAI.translationCache[text];
        }

        // 📌 ระบบคิวที่ป้องกันการค้าง 100%
        return new Promise((resolve) => {
            window.KodaAI._queuePromise = window.KodaAI._queuePromise.then(async () => {
                try {
                    await new Promise(r => setTimeout(r, 200)); 
                    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=th&dt=t&q=${encodeURIComponent(text)}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data[0]) {
                            const th = data[0].map(item => (item && item[0]) ? item[0] : '').join('');
                            window.KodaAI.translationCache[text] = th;
                            return resolve(th);
                        }
                    }
                } catch (e) {}

                try {
                    const fallbackRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|th`);
                    const fallbackData = await fallbackRes.json();
                    if (fallbackData && fallbackData.responseData && fallbackData.responseData.translatedText) {
                        if (!fallbackData.responseData.translatedText.includes("MYMEMORY WARNING")) {
                            window.KodaAI.translationCache[text] = fallbackData.responseData.translatedText;
                            return resolve(fallbackData.responseData.translatedText);
                        }
                    }
                } catch (fallbackErr) {}

                resolve(text); // ถ้าพังหมดให้ส่งภาษาอังกฤษกลับไป ไม่ให้แอปค้าง
            }).catch(() => {
                resolve(text);
            });
        });
    }
};