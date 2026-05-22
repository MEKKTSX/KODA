// api/get-world-news.js (โค้ดเครื่องยนต์หลังบ้านแบบเต็มระบบ)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// รายชื่อแหล่งข่าวสารตั้งต้น
const RSS_SOURCES = [
    { name: 'Investing.com', url: 'https://th.investing.com/rss/news_14.rss', type: 'geo' },
    { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', type: 'geo' },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', type: 'tech' }
];

// ฟังก์ชันแกะ XML RSS แบบง่ายดายบนหลังบ้าน
async function parseRssFeed(url) {
    try {
        // ใช้บริการ rss2json api ฟรีในการช่วยแปลง XML เป็น JSON บนหลังบ้านเพื่อความเสถียร
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.items || [];
    } catch (e) {
        return [];
    }
}

// ฟังก์ชันสั่ง Gemini แปลและสรุปหัวข้อข่าวสาร
async function translateWithGemini(title, summary) {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `คุณคือบอทอัจฉริยะของแอป KODA โปรดแปลพาดหัวข่าวต่อไปนี้เป็น "ภาษาไทย" ให้สั้น กระชับ น่าตื่นเต้น ความยาวไม่เกิน 1-2 บรรทัด สำหรับนักลงทุน 
    และสรุปเนื้อหาเนื้อข่าวย่อสั้นๆ เป็นภาษาไทย 2 บรรทัดจบ
    ส่งผลลัพธ์กลับมาเป็นโครงสร้าง JSON รูปแบบนี้เท่านั้น ห้ามมีข้อความอื่นหรือเครื่องหมายอัญประกาศเด็ดขาด:
    {"th_title": "พาดหัวภาษาไทย", "th_summary": "สรุปภาษาไทย"}
    
    นี่คือข่าวที่คุณต้องจัดการ:
    Headline: ${title}
    Snippet: ${summary}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
        });
        const data = await response.json();
        const jsonText = data.candidates[0].content.parts[0].text;
        return JSON.parse(jsonText);
    } catch (e) {
        return { th_title: title, th_summary: summary }; // ถ้า AI พัง ให้ใช้ภาษาอังกฤษไปก่อนกันระบบล่ม
    }
}

export default async function handler(req, res) {
    // กำหนดให้ API นี้รองรับ Cross-Origin (CORS) เผื่อเรียกใช้งานข้ามโดเมน
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // 1. ดึงข่าวจาก Database ส่วนตัวของเราออกไปโชว์หน้าบ้านก่อนเพื่อความเร็วสะใจ
    let { data: cachedNews } = await supabase
        .from('world_news')
        .select('*')
        .order('published_time', { ascending: false })
        .limit(15);

    // เช็คว่าข่าวล่าสุดในตารางเก่าเกิน 1 ชั่วโมงหรือยัง?
    const isCacheOld = cachedNews && cachedNews.length > 0
        ? (Date.now() - new Date(cachedNews[0].created_at).getTime() > 3600000)
        : true;

    // 2. หากข้อมูลในแคชยังมีอยู่และยังไม่เก่าเกินไป ให้ปิดจ๊อบส่งข้อมูลคืนหน้าบ้านทันทีใน 0.05 วินาที
    if (cachedNews && cachedNews.length > 0 && !isCacheOld) {
        return res.status(200).json({ success: true, data: cachedNews });
    }

    // 3. 🚀 [Background Worker] ถ้าไม่มีข้อมูลหรือแคชหมดอายุ ให้หลังบ้านทำงานกวาดข้อมูลใหม่เงียบๆ
    // เรารันกระบวนการนี้แบบไม่รอสาย (Asynchronous) เพื่อให้ผู้ใช้ได้เห็นข้อมูลเก่าไปก่อน ไม่ต้องจอกลมหมุนค้าง
    processNextUpdates(cachedNews).catch(e => console.error(e));

    // ส่งข้อมูลเท่าที่มีคืนไปก่อน เพื่อไม่ให้หน้าบ้านเกิดอาการหน่วงค้าง
    return res.status(200).json({ success: true, data: cachedNews || [] });
}

// ฟังก์ชันเบื้องหลังในการเคลียร์คิว คัดกรอง และสั่ง AI แปลข่าวบันทึกลง Supabase
async function processNextUpdates(cachedNews) {
    let newItemsCount = 0;

    for (let source of RSS_SOURCES) {
        if (newItemsCount >= 3) break; // จำกัดการแปลข่าวใหม่ไม่เกิน 3 ข่าวต่อรอบเพื่อป้องกัน AI โควตาฟรีระเบิด
        
        const feedItems = await parseRssFeed(source.url);
        
        for (let item of feedItems) {
            const sourceUrl = item.link;
            
            // ตรวจสอบกับฐานข้อมูลว่าข่าวลิงก์นี้เคยมีเก็บไว้แล้วหรือยัง?
            const { data: existing } = await supabase
                .from('world_news')
                .select('id')
                .eq('source_url', sourceUrl)
                .maybeSingle();

            if (!existing) {
                // ข่าวยังไม่เคยมีในระบบ -> ส่งให้ Gemini แปลภาษาไทยทันที
                const cleanDesc = (item.description || item.content || "").replace(/<\/?[^>]+(>|$)/g, "").substring(0, 300);
                const aiResult = await translateWithGemini(item.title, cleanDesc);
                
                // บันทึกข่าวภาษาไทยผลลัพธ์ลง Supabase
                await supabase.from('world_news').insert([{
                    title: aiResult.th_title,
                    summary: aiResult.th_summary,
                    source_url: sourceUrl,
                    source_name: source.name,
                    news_type: source.type,
                    published_time: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
                }]);

                newItemsCount++;
                if (newItemsCount >= 3) break;
            }
        }
    }
}
