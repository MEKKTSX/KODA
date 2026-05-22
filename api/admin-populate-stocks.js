import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function generateAiSummary(symbol, companyName, industry, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `ในฐานะผู้เชี่ยวชาญด้านธุรกิจและการลงทุน โปรดวิเคราะห์เชิงลึกเกี่ยวกับ Business Model, พื้นฐาน, และ Ecosystem ของบริษัท ${companyName} (${symbol}) อุตสาหกรรม: ${industry}
    
    กฎเหล็กการวิเคราะห์:
    1. วิเคราะห์ตามเนื้อผ้าและ Data จริงเท่านั้น ห้ามใช้คำอวยเกินจริง ห้ามโฆษณาชวนเชื่อหรือชี้นำการลงทุน
    2. อธิบายเป็น "ภาษาไทย" แบบเห็นภาพชัดเจน เขียนเนื้อหาเจาะลึกและครอบคลุมประเด็นยาวต่อเนื่อง ไม่ต้องสรุปย่อจนสั้นเกินไป
    3. บังคับใช้โครงสร้าง HTML นี้ในการตอบ (ห้ามเปลี่ยนชื่อหัวข้อ และห้ามมีเครื่องหมาย \`\`\`html ครอบเด็ดขาด):
    
    <div style="margin-bottom: 14px; line-height: 1.6;"><strong>🏢 ทำธุรกิจอะไร (Core Business):</strong> [เนื้อหาเจาะลึก]</div>
    <div style="margin-bottom: 14px; line-height: 1.6;"><strong>🌐 Ecosystem & รายได้ (How they make money):</strong> [เนื้อหาเจาะลึก]</div>
    <div style="margin-bottom: 14px; line-height: 1.6;"><strong>⚔️ จุดเด่น / คู่แข่ง (Moat & Competitors):</strong> [เนื้อหาเจาะลึก]</div>
    <div style="padding: 14px; background: rgba(52,168,235,0.1); border-radius: 12px; border: 1px solid rgba(52,168,235,0.3); color: #34a8eb; margin-top: 16px; line-height: 1.6;"><strong>💡 โอกาสในอนาคต (Future Catalysts):</strong> [เนื้อหาเจาะลึก]</div>`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        const data = await response.json();
        
        if (data.error) {
            return `Gemini API Error: ${data.error.message} (${data.error.status})`;
        }
        if (!data.candidates || data.candidates.length === 0) {
            return `Gemini Error: No candidates returned.`;
        }
        
        let rawText = data.candidates[0].content.parts[0].text;
        return rawText.replace(/```html/g, '').replace(/```/g, '').trim();
    } catch (e) {
        return `Technical Catch Error: ${e.message}`;
    }
}

// ... (ส่วนฟังก์ชัน generateAiSummary คงไว้เหมือนเดิม) ...

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const rawFhKeys = process.env.FINNHUB_KEY_KEYS || '';
    const fhKey = rawFhKeys.split(',')[0].trim();
    
    // โหลดคีย์ Gemini ทั้งหมดมาเตรียมไว้เป็น Array
    const rawGeminiKeys = process.env.GEMINI_API_KEYS || '';
    const keysArray = rawGeminiKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);

    try {
        const { data: dbTickers, error: tickerError } = await supabase.from('ticker_list').select('symbol').eq('is_active', true).limit(250); 
        if (tickerError || !dbTickers) throw new Error(tickerError?.message || "ดึงรายชื่อหุ้นล่ม");

        const { data: currentCaches } = await supabase.from('stock_cache').select('symbol, ai_summary, last_updated');
        const cachedMap = new Map((currentCaches || []).map(c => [c.symbol, { summary: c.ai_summary, updated: c.last_updated }]));

        let queue = [];
        for (let t of dbTickers) {
            const cache = cachedMap.get(t.symbol);
            if (!cache) {
                queue.push(t.symbol);
            } else {
                const currentSummary = cache.summary || '';
                const isError = currentSummary.includes('Error') || currentSummary.includes('ขัดข้อง') || currentSummary.includes('NULL') || currentSummary.includes('overloaded');
                
                const timePassed = Date.now() - new Date(cache.updated).getTime();
                const oneHour = 60 * 60 * 1000; 

                if (isError && timePassed > oneHour) {
                    queue.push(t.symbol);
                }
            }
            if (queue.length >= 2) break; 
        }

        if (queue.length === 0) {
            return res.status(200).json({ success: true, message: "หุ้นรอบนี้ติดคูลดาวน์กักตัว รอรอบหน้า" });
        }

        let logs = [];
        for (let symbol of queue) {
            // 🚀 ย้ายการสุ่ม Gemini Key มาไว้ใน Loop: หุ้น 1 ตัว สุ่มหยิบ 1 คีย์ กระจายโหลดได้จริง
            const geminiKey = keysArray[Math.floor(Math.random() * keysArray.length)];
            
            const cleanSym = symbol.split(':')[1] || symbol.split('.')[0];
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

            // ส่ง geminiKey ที่สุ่มได้ของรอบนี้เข้าไปทำงาน
            const aiSummaryText = await generateAiSummary(cleanSym, companyName, industry, geminiKey);

            const stockRecord = {
                symbol: symbol,
                company_name: companyName,
                industry: industry,
                short_interest: parseFloat(shortInterest),
                earnings_status: earningsStatus,
                ai_summary: aiSummaryText,
                last_updated: new Date().toISOString()
            };

            await supabase.from('stock_cache').upsert([stockRecord]);
            logs.push(`Processed: ${symbol}`);
        }

        return res.status(200).json({ success: true, processed: queue, logs: logs });
    } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
}
