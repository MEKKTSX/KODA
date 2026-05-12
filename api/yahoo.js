export default async function handler(req, res) {
    // 📌 อนุญาตให้หน้าเว็บเรารับข้อมูลได้ (แก้ปัญหา CORS)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const { mode, q, symbols } = req.query;
    let targetUrl = '';

    // 📌 แยก Mode การทำงาน (ค้นหา, เทรนด์, ราคา)
    if (mode === 'search') {
        targetUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0`;
    } else if (mode === 'trending') {
        targetUrl = `https://query1.finance.yahoo.com/v1/finance/trending/US?count=10`;
    } else if (mode === 'quote') {
        targetUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;
    } else {
        return res.status(400).json({ error: 'Invalid mode' });
    }

    try {
        const response = await fetch(targetUrl);
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error("Yahoo API Proxy Error:", error);
        res.status(500).json({ error: "Failed to fetch from Yahoo" });
    }
}
