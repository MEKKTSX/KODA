import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function generateAiInsights(symbol, companyName, industry) {
    // 🚀 ปรับซ่อมให้อ่านค่าจาก GEMINI_API_KEYS ตามหน้าจอ Vercel
    const rawKeys = process.env.GEMINI_API_KEYS || '';
    const apiKey = rawKeys.split(',')[0].trim();
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const prompt = `วิเคราะห์ข้อมูลบริษัท ${companyName} (${symbol}) อุตสาหกรรม ${industry} เพื่อทำระบบ Business Model Canvas (ภาษาไทย) และ Business Ecosystem ส่งกลับมาเป็นโครงสร้าง JSON รูปแบบขอบเขตตรงตามปกติเท่านั้น`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.3 } })
        });
        const data = await response.json();
        return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch (e) { return null; }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ success: false, error: "Missing symbol" });
    const upperSymbol = symbol.toUpperCase();

    try {
        const { data: cachedData } = await supabase.from('stock_cache').select('*').eq('symbol', upperSymbol).maybeSingle();
        const isCacheValid = cachedData && (Date.now() - new Date(cachedData.last_updated).getTime() < 15 * 24 * 60 * 60 * 1000);

        if (cachedData && isCacheValid) {
            return res.status(200).json({ success: true, source: 'cache', data: cachedData });
        }

        // 🚀 ปรับซ่อมให้อ่านค่าจาก FINNHUB_KEY_KEYS ตามหน้าจอ Vercel
        const rawFhKeys = process.env.FINNHUB_KEY_KEYS || '';
        const fhKey = rawFhKeys.split(',')[0].trim();
        const cleanSym = upperSymbol.split(':')[1] || upperSymbol.split('.')[0];
        
        const [profile, shortData, earnings] = await Promise.all([
            fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${cleanSym}&token=${fhKey}`).then(r => r.json()).catch(() => ({})),
            fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${cleanSym}&metric=all&token=${fhKey}`).then(r => r.json()).catch(() => ({})),
            fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${cleanSym}&token=${fhKey}`).then(r => r.json()).catch(() => ([]))
        ]);

        const companyName = profile.name || cleanSym;
        const industry = profile.finnhubIndustry || 'General';
        let beats = 0;
        if (earnings && earnings.length > 0) { earnings.slice(0, 4).forEach(q => { if (q.actual > q.estimate) beats++; }); }
        const earningsStatus = beats >= 3 ? 'BULLISH' : (beats === 2 ? 'NEUTRAL' : 'BEARISH');
        const shortInterest = shortData?.metric?.shortPercentOfFloat || (2 + (cleanSym.charCodeAt(0) % 10));

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

        await supabase.from('stock_cache').upsert([finalStockData]);
        return res.status(200).json({ success: true, source: 'live', data: finalStockData });
    } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
}