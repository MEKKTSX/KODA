// api/admin-populate-stocks.js (บอทอัปเดตข้อมูลหุ้นกลุ่มเป้าหมายเข้าตารางล่วงหน้า)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 🚀 เปลี่ยนใหม่เป็นดึงจากตาราง ticker_list บน Supabase:
const { data: dbTickers, error: tickerError } = await supabase
    .from('ticker_list')
    .select('symbol')
    .eq('is_active', true);

if (tickerError || !dbTickers) {
    return res.status(500).json({ success: false, error: "คลังรายชื่อหุ้นขัดข้อง: " + tickerError.message });
}

// แปลงผลลัพธ์ให้ออกมาเป็นอาร์เรย์รายชื่อเหมือนเดิมเพื่อส่งไปวิ่งวนลูปต่อ
const TARGET_STOCKS = dbTickers.map(row => row.symbol);

async function generateAiInsights(symbol, companyName, industry, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const prompt = `วิเคราะห์ข้อมูลบริษัท ${companyName} (${symbol}) อุตสาหกรรม ${industry} เพื่อนำไปทำระบบ Business Model Canvas (ภาษาไทย) และ Business Ecosystem (ภาษาอังกฤษ) ส่งผลลัพธ์กลับมาเป็นโครงสร้าง JSON ออบเจกต์ที่มีคีย์หลักชื่อ bmc และ ecosystem ตามปกติเท่านั้น`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } })
        });
        const data = await response.json();
        return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch (e) { return null; }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const rawFhKeys = process.env.FINNHUB_KEY_KEYS || '';
    const fhKey = rawFhKeys.split(',')[0].trim();
    const rawGeminiKeys = process.env.GEMINI_API_KEYS || '';
    const geminiKey = rawGeminiKeys.split(',')[0].trim();

    let logs = [];

    // วนลูปเพื่อไล่กวาดข้อมูลหุ้นทีละตัวใน List สารตั้งต้น
    for (let symbol of TARGET_STOCKS) {
        try {
            const cleanSym = symbol.split(':')[1] || symbol.split('.')[0];
            
            const [profile, shortData, earnings] = await Promise.all([
                fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${cleanSym}&token=${fhKey}`).then(r => r.json()).catch(() => ({})),
                fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${cleanSym}&metric=all&token=${fhKey}`).then(r => r.json()).catch(() => ({})),
                fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${cleanSym}&token=${fhKey}`).then(r => r.json()).catch(() => ([]))
            ]);

            const companyName = profile.name || cleanSym;
            const industry = profile.finnhubIndustry || 'General';

            let beats = 0;
            if (earnings && earnings.length > 0) {
                earnings.slice(0, 4).forEach(q => { if (q.actual > q.estimate) beats++; });
            }
            const earningsStatus = beats >= 3 ? 'BULLISH' : (beats === 2 ? 'NEUTRAL' : 'BEARISH');
            const shortInterest = shortData?.metric?.shortPercentOfFloat || 5;

            const aiInsights = await generateAiInsights(cleanSym, companyName, industry, geminiKey);

            const stockRecord = {
                symbol: symbol,
                company_name: companyName,
                industry: industry,
                ecosystem: aiInsights?.ecosystem || { company: companyName, branches: [] },
                bmc: aiInsights?.bmc || {},
                short_interest: parseFloat(shortInterest),
                earnings_status: earningsStatus,
                last_updated: new Date().toISOString()
            };

            await supabase.from('stock_cache').upsert([stockRecord]);
            logs.push(`Successfully populated data cache for: ${symbol}`);
            
        } catch (err) {
            logs.push(`Error building data cache for ${symbol}: ${err.message}`);
        }
    }

    return res.status(200).json({ success: true, message: "KODA Master Pipeline Synced", logs: logs });
}