// api/admin-populate-stocks.js (เวอร์ชันแก้บัค 500 + ผูกเข้าระบบ ai_summary แข็งแกร่ง 100%)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function generateAiSummary(symbol, companyName, industry, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
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
    } catch (e) { return 'ระบบประมวลผลข้อมูลดิบขัดข้องชั่วคราว'; }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const rawFhKeys = process.env.FINNHUB_KEY_KEYS || '';
    const fhKey = rawFhKeys.split(',')[0].trim();
    const rawGeminiKeys = process.env.GEMINI_API_KEYS || '';
    const geminiKey = rawGeminiKeys.split(',')[0].trim();

    try {
        // 🚀 แก้บั๊ก 500: เปลี่ยนมาดึงคอลัมน์เดี่ยวๆ ป้องกันตรรกะตรวจสอบระบบโครงสร้างเชื่อมโยงพัง
        const { data: dbTickers, error: tickerError } = await supabase
            .from('ticker_list')
            .select('symbol')
            .eq('is_active', true)
            .limit(100); 

        if (tickerError || !dbTickers) throw new Error(tickerError?.message || "ดึงรายชื่อหุ้นล่ม");

        // ดึงรายการหุ้นที่มีข้อมูลอยู่แล้วขึ้นมาประเมินแบบแยกคำสั่งอิสระเด็ดขาด
        const { data: currentCaches, error: cacheError } = await supabase
            .from('stock_cache')
            .select('symbol, last_updated');
            
        if (cacheError) throw new Error(cacheError.message);

        const cachedSymbolsMap = new Map((currentCaches || []).map(c => [c.symbol, c.last_updated]));

        // คัดกรองหาหุ้นที่ยังว่างเปล่าไม่มีข้อมูลในคลังมารันก่อนรอบละ 5 ตัว
        let queue = [];
        for (let t of dbTickers) {
            if (!cachedSymbolsMap.has(t.symbol)) {
                queue.push(t.symbol);
            }
            if (queue.length >= 5) break; 
        }

        // หากหุ้นในคลังถูกเก็บจนครบแล้ว ให้สลับมาดึงหุ้นที่ข้อมูลเก่าที่สุดขึ้นมาปัดฝุ่นใหม่รอบละ 5 ตัวแทน
        if (queue.length === 0 && currentCaches && currentCaches.length > 0) {
            const sortedOldest = [...currentCaches].sort((a, b) => new Date(a.last_updated) - new Date(b.last_updated));
            queue = sortedOldest.slice(0, 5).map(c => c.symbol);
        }

        if (queue.length === 0) {
            return res.status(200).json({ success: true, message: "ไม่มีคิวหุ้นคงค้าง" });
        }

        let logs = [];
        for (let symbol of queue) {
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

            // สั่งประมวลผลเฉพาะข้อมูลสรุปบริษัทแบบ Data-driven 3-4 บรรทัด ไม่เอาระบบ Canvas แล้ว
            const aiSummaryText = await generateAiSummary(cleanSym, companyName, industry, geminiKey);

            const stockRecord = {
                symbol: symbol,
                company_name: companyName,
                industry: industry,
                short_interest: parseFloat(shortInterest),
                earnings_status: earningsStatus,
                ai_summary: aiSummaryText, // บันทึกเข้าคอลัมน์ใหม่ที่เราอัปเดตไป
                last_updated: new Date().toISOString()
            };

            await supabase.from('stock_cache').upsert([stockRecord]);
            logs.push(`Populated summary for: ${symbol}`);
        }

        return res.status(200).json({ success: true, processed: queue, logs: logs });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}