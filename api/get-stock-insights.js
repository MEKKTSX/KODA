// api/get-stock-insights.js (เวอร์ชันเจาะลึกแบบยาวเป็นประเด็น + ดักจับแคชเสีย)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function generateAiSummary(symbol, companyName, industry, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    // 🚀 ย้ายกล่อง Prompt โครงสร้างเดิมของคุณมาไว้ตรงนี้ พร้อมคุมกฎเรื่องข้อมูลตรงไปตรงมา
    const prompt = `ในฐานะผู้เชี่ยวชาญด้านธุรกิจและการลงทุน โปรดวิเคราะห์เชิงลึกเกี่ยวกับ Business Model, พื้นฐาน, และ Ecosystem ของบริษัท ${companyName} (${symbol}) อุตสาหกรรม: ${industry}
    
    กฎเหล็กการวิเคราะห์:
    1. วิเคราะห์ตามเนื้อผ้าและ Data จริงเท่านั้น ห้ามใช้คำอวยเกินจริง ห้ามโฆษณาชวนเชื่อหรือชี้นำการลงทุน
    2. อธิบายเป็น "ภาษาไทย" แบบเห็นภาพชัดเจน เขียนเนื้อหาเจาะลึกและครอบคลุมประเด็นยาวต่อเนื่อง ไม่ต้องสรุปย่อจนสั้นเกินไป
    3. บังคับใช้โครงสร้าง HTML นี้ในการตอบ (ห้ามเปลี่ยนชื่อหัวข้อ และห้ามมีเครื่องหมาย \`\`\`html ครอบเด็ดขาด):
    
    <div style="margin-bottom: 14px; line-height: 1.6;"><strong>🏢 ทำธุรกิจอะไร (Core Business):</strong> [เขียนอธิบายเนื้อหาเจาะลึกตรงนี้]</div>
    <div style="margin-bottom: 14px; line-height: 1.6;"><strong>🌐 Ecosystem & รายได้ (How they make money):</strong> [เขียนอธิบายเนื้อหาเจาะลึกตรงนี้]</div>
    <div style="margin-bottom: 14px; line-height: 1.6;"><strong>⚔️ จุดเด่น / คู่แข่ง (Moat & Competitors):</strong> [เขียนอธิบายเนื้อหาเจาะลึกตรงนี้]</div>
    <div style="padding: 14px; background: rgba(52,168,235,0.1); border-radius: 12px; border: 1px solid rgba(52,168,235,0.3); color: #34a8eb; margin-top: 16px; line-height: 1.6;"><strong>💡 โอกาสในอนาคต (Future Catalysts):</strong> [เขียนอธิบายเนื้อหาเจาะลึกตรงนี้]</div>

    ส่งผลลัพธ์กลับมาเป็นโครงสร้าง JSON รูปแบบนี้เท่านั้น ห้ามมีตัวหนังสืออื่นผสมนอกออบเจกต์:
    {
      "summary": "นำโค้ดรหัส HTML ทั้งหมดที่เขียนเสร็จแล้วมาใส่ในคีย์นี้ โดยระวังเรื่องเครื่องหมายอัญประกาศคู่ (Double Quote) ข้างในข้อความ ให้ใช้เป็น Single Quote แทนเพื่อไม่ให้โครงสร้าง JSON พัง"
    }`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ role: "user", parts: [{ text: prompt }] }], 
                generationConfig: { responseMimeType: "application/json", temperature: 0.3 } 
            })
        });
        const data = await response.json();
        const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
        return parsed.summary || 'ไม่สามารถวิเคราะห์ข้อมูลได้';
    } catch (e) {
        return 'ระบบประมวลผลข้อมูลขัดข้อง กรุณากดรีเฟรชใหม่อีกครั้ง';
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ success: false, error: "Missing symbol" });
    const upperSymbol = symbol.toUpperCase();

    try {
        const { data: cachedData } = await supabase.from('stock_cache').select('*').eq('symbol', upperSymbol).maybeSingle();
        
        // 🚀 ดักจับแคชพัง: ถ้าข้อมูลไม่มี หรือมีแต่เป็นข้อความระบบขัดข้องเดิม ให้บังคับดึงใหม่ทันที
        const isCacheValid = cachedData && 
                             cachedData.ai_summary && 
                             !cachedData.ai_summary.includes('ขัดข้องชั่วคราว') && 
                             (Date.now() - new Date(cachedData.last_updated).getTime() < 15 * 24 * 60 * 60 * 1000);

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

        const aiSummaryText = await generateAiSummary(cleanSym, companyName, industry, geminiKey);

        const finalStockData = {
            symbol: upperSymbol,
            company_name: companyName,
            industry: industry,
            short_interest: parseFloat(shortInterest),
            earnings_status: earningsStatus,
            ai_summary: aiSummaryText,
            last_updated: new Date().toISOString()
        };

        await supabase.from('stock_cache').upsert([finalStockData]);
        return res.status(200).json({ success: true, data: finalStockData });
    } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
}