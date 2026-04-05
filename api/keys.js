// ไฟล์: api/keys.js (ห้ามให้ HTML เรียกใช้ไฟล์นี้เด็ดขาด)
export default function handler(req, res) {
    const geminiKeys = process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',') : [];
    res.status(200).json({
        GEMINI: geminiKeys,
        FINNHUB: process.env.FINNHUB_KEY || '',
        ALPHAVANTAGE: process.env.ALPHAVANTAGE_KEY || ''
    });
}
