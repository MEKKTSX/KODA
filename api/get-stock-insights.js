// api/get-stock-insights.js (เวอร์ชันเน้นเฉพาะเนื้อหาสรุปบริษัทอย่างตรงไปตรงมา)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function generateAiSummary(symbol, companyName, industry, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    // 📌 บังคับใช้ตรรกะห้ามอวยเด็ดขาด และเน้น Data ตามเงื่อนไขส่วนตัวของคุณ
    const prompt = `วิเคราะห์และสรุปภาพรวมธุรกิจเชิงลึกของบริษัท ${companyName} (${symbol}) อุตสาหกรรม ${industry}
    กฎเหล็ก: วิเคราะห์ตามเนื้อผ้าและตัวเลขจริงเท่านั้น ห้ามใช้คำอวยเกินจริง ห้ามโฆษณาชวนเชื่อ 
    เน้นการใช้ Data อธิบายโครงสร้างรายได้และการแข่งขันในตลาดปัจจุบันให้เข้าใจง่ายๆ ความยาว 3-4 บรรทัดจบ
    ส่งผลลัพธ์กลับมาเป็นโครงสร้าง JSON รูปแบบนี้เท่านั้น ห้ามมีตัวหนังสืออื่นผสม:
    {
      "summary": "ข้อความสรุปวิเคราะห์ตามตรงและใช้ข้อมูลอธิบาย"
    }`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } })
        });
        const data = await response.json();
        const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
        return parsed.summary || '';
    } catch (e) {
        return 'ระบบประมวลผลข้อมูลดิบขัดข้องชั่วคราว';
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ success: false, error: "Missing symbol" });
    const upperSymbol = symbol.toUpperCase();

    try {
        const { data: cachedData } = await supabase.from('stock_cache').select('*').eq('symbol', upperSymbol).maybeSingle();
        const isCacheValid = cachedData && cachedData.ai_summary && (Date.now() - new Date(cachedData.last_updated).getTime() < 15 * 24 * 60 * 60 * 1000);

        if (cachedData && isCacheValid) {
            return res.status(200).json({ success: true, data: cachedData });
        }

        const rawFhKeys = process.env.FINNHUB_KEY_KEYS || '';
        const fhKey = rawFhKeys.split(',')[0].trim();
        const rawGeminiKeys = process.env.GEMINI_API_KEYS || '';
        const geminiKey = rawGeminiKeys.split(',')[0].trim();
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
        const shortInterest = shortData?.metric?.shortPercentOfFloat || 5;

        // สั่งสร้างบทวิเคราะห์แบบ Data-Driven หลังบ้าน
        const aiSummaryText = await generateAiSummary(cleanSym, companyName, industry, geminiKey);

        const finalStockData = {
            symbol: upperSymbol,
            company_name: companyName,
            industry: industry,
            short_interest: parseFloat(shortInterest),
            earnings_status: earningsStatus,
            ai_summary: aiSummaryText, // บันทึกข้อความสรุปลงตัวแปร
            last_updated: new Date().toISOString()
        };

        await supabase.from('stock_cache').upsert([finalStockData]);
        return res.status(200).json({ success: true, data: finalStockData });
    } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
}