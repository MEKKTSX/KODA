export default function handler(req, res) {
    // กำหนด Header ให้รองรับการเรียกใช้งาน (CORS) เผื่อกรณีจำเป็น
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // ดึงค่าจาก Environment Variables ของ Vercel ส่งออกไปเป็น JSON
    res.status(200).json({
        GEMINI: process.env.GEMINI_API_KEYS || "",
        SERPER: process.env.SERPER_API_KEYS || "",
        FINNHUB: process.env.FINNHUB_API_KEY || "",
        ALPHAVANTAGE: process.env.ALPHAVANTAGE_API_KEY || ""
    });
}
