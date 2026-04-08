export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    res.status(200).json({
        GEMINI: process.env.GEMINI_API_KEYS || "",
        SERPER: process.env.SERPER_API_KEYS || "",
        // 📌 ดักจับทุกชื่อเผื่อพิมพ์ผิดใน Vercel รับรองว่าคีย์ไม่หายชัวร์
        FINNHUB: process.env.FINNHUB_API_KEYS || process.env.FINNHUB_KEY_KEYS || process.env.FINNHUB_API_KEY || "",
        ALPHAVANTAGE: process.env.ALPHAVANTAGE_API_KEY || ""
    });
}
