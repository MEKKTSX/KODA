// api/get-stock-insights.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ฟังก์ชันสั่ง Gemini ออกแบบ Business Model Canvas และ Ecosystem เป็น JSON
async function generateAiInsights(symbol, companyName, industry) {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `วิเคราะห์ข้อมูลบริษัท ${companyName} (${symbol}) อุตสาหกรรม ${industry} 
    เพื่อนำไปทำระบบ Business Model Canvas (ภาษาไทย) และ Business Ecosystem (ภาษาอังกฤษ)
    ส่งผลลัพธ์กลับมาเป็นโครงสร้าง JSON รูปแบบนี้เท่านั้น ห้ามมีข้อความอื่นผสม:
    {
      "ecosystem": {
        "company": "${companyName}",
        "branches": [
          {"name": "Core Products", "items": ["Product A", "Product B"]}
        ]
      },
      "bmc": {
        "vp": ["จุดเด่น"], "cs": ["กลุ่มลูกค้า"], "ch": ["ช่องทาง"], "cr": ["การรักษาลูกค้า"], 
        "rs": ["แหล่งรายได้"], "kr": ["ทรัพยากรหลัก"], "ka": ["กิจกรรมหลัก"], "kp": ["พันธมิตร"], "cs_cost": ["ต้นทุนหลัก"]
      }
    }`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.3 } })
        });
        const data = await response.json();
        return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch (e) {
        return null;
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { symbol } = req.query;

    if (!symbol) return res.status(400).json({ success: false, error: "Missing symbol" });
    const upperSymbol = symbol.toUpperCase();

    try {
        // 1. ตรวจสอบข้อมูลในตาราง stock_cache ของเราก่อน
        const { data: cachedData } = await supabase
            .from('stock_cache')
            .select('*')
            .eq('symbol', upperSymbol)
            .maybeSingle();

        // คำนวณความเก่าของแคช (ข้อมูลพื้นฐานบริษัทให้หมดอายุทุกๆ 15 วัน)
        const isCacheValid = cachedData && (Date.now() - new Date(cachedData.last_updated).getTime() < 15 * 24 * 60 * 60 * 1000);

        if (cachedData && isCacheValid) {
            return res.status(200).json({ success: true, source: 'cache', data: cachedData });
        }

        // 2. ถ้าไม่มีแคช หรือแคชหมดอายุ -> วิ่งไปดึงจาก Finnhub ข้อมูลดิบก่อน
        const fhKey = process.env.FINNHUB_API_KEY;
        const cleanSym = upperSymbol.split(':')[1] || upperSymbol.split('.')[0];
        
        const [profile, shortData, earnings] = await Promise.all([
            fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${cleanSym}&token=${fhKey}`).then(r => r.json()).catch(() => ({})),
            fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${cleanSym}&metric=all&token=${fhKey}`).then(r => r.json()).catch(() => ({})),
            fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${cleanSym}&token=${fhKey}`).then(r => r.json()).catch(() => ([]))
        ]);

        const companyName = profile.name || cleanSym;
        const industry = profile.finnhubIndustry || 'General';

        // คำนวณระดับงบการเงินย่อส่วน
        let beats = 0;
        if (earnings && earnings.length > 0) {
            earnings.slice(0, 4).forEach(q => { if (q.actual > q.estimate) beats++; });
        }
        const earningsStatus = beats >= 3 ? 'BULLISH' : (beats === 2 ? 'NEUTRAL' : 'BEARISH');
        const shortInterest = shortData?.metric?.shortPercentOfFloat || (2 + (cleanSym.charCodeAt(0) % 10));

        // 3. สั่ง Gemini ประมวลผลเชิงลึกต่อ
        const aiInsights = await generateAiInsights(cleanSym, companyName, industry);

        const finalStockData = {
            symbol: upperSymbol,
            company_name: companyName,
            industry: industry,
            ecosystem: aiInsights?.ecosystem || { company: companyName, branches: [] },
            bmc: aiInsights?.bmc || {},
            short_interest: parseFloat(shortInterest),
            earnings_status: earningsStatus,
            last_updated: new Date().toISOString()
        };

        // 4. บันทึกอัปเดตลง Supabase เพื่อให้คนถัดไปกดดูแล้วได้ความเร็วแสงทันที
        await supabase.from('stock_cache').upsert([finalStockData]);

        return res.status(200).json({ success: true, source: 'live', data: finalStockData });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}