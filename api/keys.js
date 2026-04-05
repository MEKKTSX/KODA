// api/keys.js
export default function handler(req, res) {
    // ดึงค่าจาก Vercel Environment Variables
    const geminiKeys = process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',') : [];
    
    // ส่งข้อมูลกลับไปที่หน้าบ้าน (คนภายนอกจะไม่เห็นค่าในกระบวนการนี้)
    res.status(200).json({
        GEMINI: geminiKeys,
        FINNHUB: process.env.FINNHUB_KEY || '',
        ALPHAVANTAGE: process.env.ALPHAVANTAGE_KEY || ''
    });
}
