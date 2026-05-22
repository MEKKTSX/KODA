// api/admin-populate-stocks.js (ระบบจัดคิวรอบละ 5 ตัวเพื่อป้องกันท่อล่ม)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function generateAiInsights(symbol, companyName, industry, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const prompt = `วิเคราะห์ข้อมูลบริษัท ${companyName} (${symbol}) อุตสาหกรรม ${industry} เพื่อทำระบบ Business Model Canvas (ภาษาไทย) และ Business Ecosystem ส่งกลับมาเป็นโครงสร้าง JSON ออบเจกต์ที่มีคีย์หลักชื่อ bmc และ ecosystem เท่านั้น`;

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

    try {
        // 🚀 1. ค้นหาหุ้นจาก ticker_list ที่ "ยังไม่มี" ในตาราง stock_cache หรือมีแต่เก่าที่สุดมาทำก่อนรอบละ 5 ตัว
        // เทคนิคใช้ตรรกะ Left Join ด้วยคำสั่งตรรกะของ Supabase หรือใช้วิธีเปรียบเทียบเวลาอัปเดตเก่าที่สุด
        const { data: dbTickers, error: tickerError } = await supabase
            .from('ticker_list')
            .select(`
                symbol,
                stock_cache ( last_updated )
            `)
            .eq('is_active', true)
            .order('created_at', { ascending: true }) // นำหุ้นสารตั้งต้นมาตั้งคิว
            .limit(30); // ดึงมากรองสุ่มหากลุ่มทำงาน

        if (tickerError || !dbTickers) throw new Error(tickerError?.message || "ดึงรายชื่อหุ้นล่ม");

        // 🚀 2. กรองหาหุ้นที่ระบบยังไม่เคยมีแคช หรือแคชหมดอายุ คัดเลือกเน้นๆ รอบละ 5 ตัว
        let queue = [];
        const { data: currentCaches } = await supabase.from('stock_cache').select('symbol');
        const cachedSymbols = new Set((currentCaches || []).map(c => c.symbol));

        for(let t of dbTickers) {
            if(!cachedSymbols.has(t.symbol)) {
                queue.push(t.symbol);
            }
            if(queue.length >= 5) break; // คัดเลือกเจอครบ 5 ตัวแล้วหยุดเอาเข้าคิวรอบนี้ทันที
        }

        // ถ้าหุ้น 2,000 ตัวถูกเก็บข้อมูลลงตารางจนครบแล้ว ให้สลับมาเก็บหุ้นที่ข้อมูลเก่าที่สุดรอบละ 5 ตัวแทน
        if (queue.length === 0) {
            const { data: oldCaches } = await supabase
                .from('stock_cache')
                .select('symbol')
                .order('last_updated', { ascending: true })
                .limit(5);
            queue = (oldCaches || []).map(c => c.symbol);
        }

        if (queue.length === 0) {
            return res.status(200).json({ success: true, message: "ไม่มีคิวหุ้นคงค้างในระบบ" });
        }

        let logs = [];
        
        // 🚀 3. เริ่มลูปยิงอัปเดตหุ้นทั้ง 5 ตัวเข้าคลังข้อมูล
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
            logs.push(`Populated data for: ${symbol}`);
        }

        return res.status(200).json({ success: true, processed: queue, logs: logs });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}