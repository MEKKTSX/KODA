export default async function handler(req, res) {
    // 📌 1. จัดการเรื่อง CORS ให้หน้าเว็บ Frontend ยิงมาหา API นี้ได้
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    
    // ตอบกลับ OPTIONS ทันที (Preflight request ของเบราว์เซอร์)
    if (req.method === 'OPTIONS') { 
        res.status(200).end(); 
        return; 
    }

    const { mode, q, symbols } = req.query;
    let targetUrl = '';

    // 📌 2. แยก Mode การทำงาน
    if (mode === 'search') {
        targetUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0`;
    } else if (mode === 'trending') {
        targetUrl = `https://query1.finance.yahoo.com/v1/finance/trending/US?count=10`;
    } else if (mode === 'quote') {
        targetUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;
    } else {
        return res.status(400).json({ error: 'Invalid mode. Use search, trending, or quote.' });
    }

    try {
        // 📌 3. ยิง Request ไปหา Yahoo พร้อมปลอมตัวเป็นเบราว์เซอร์ปกติ
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Yahoo responded with status: ${response.status}`);
        }

        const data = await response.json();
        res.status(200).json(data);

    } catch (error) {
        console.error("Yahoo API Proxy Error:", error.message);
        res.status(500).json({ error: "Failed to fetch data from Yahoo", details: error.message });
    }
}
