// api/get-world-news.js (เวอร์ชันแก้บัค Vercel Freeze + Field Mapping)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const RSS_SOURCES = [
    { name: 'Investing.com', url: 'https://th.investing.com/rss/news_14.rss', type: 'geo' },
    { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', type: 'geo' },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', type: 'tech' }
];

// ฟังก์ชันแปลงรูปแบบเวลาให้ตรงกับที่ frontend (world-news.js) ต้องการใช้แสดงผล
function formatNewsDate(isoString) {
    const pubDate = new Date(isoString);
    const dateStr = pubDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    const timeStr = pubDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
    return `${dateStr} • ${timeStr}`;
}

async function parseRssFeed(url) {
    try {
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.items || [];
    } catch (e) { return []; }
}

async function translateWithGemini(title, summary) {
    const rawKeys = process.env.GEMINI_API_KEYS || '';
    const apiKey = rawKeys.split(',')[0].trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const prompt = `คุณคือบอทอัจฉริยะของแอป KODA โปรดแปลพาดหัวข่าวต่อไปนี้เป็น "ภาษาไทย" ให้สั้น บังคับส่งผลกลับมาเป็น JSON รูปแบบนี้เท่านั้น: {"th_title": "พาดหัวภาษาไทย", "th_summary": "สรุปภาษาไทย"} ข่าว: Headline: ${title} Snippet: ${summary}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
        });
        const data = await response.json();
        return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch (e) { return { th_title: title, th_summary: summary }; }
}

async function processNextUpdates() {
    let newItemsCount = 0;
    for (let source of RSS_SOURCES) {
        if (newItemsCount >= 3) break;
        const feedItems = await parseRssFeed(source.url);
        for (let item of feedItems) {
            const sourceUrl = item.link;
            const { data: existing } = await supabase.from('world_news').select('id').eq('source_url', sourceUrl).maybeSingle();
            if (!existing) {
                const cleanDesc = (item.description || item.content || "").replace(/<\/?[^>]+(>|$)/g, "").substring(0, 300);
                const aiResult = await translateWithGemini(item.title, cleanDesc);
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

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // ดึงข้อมูลแคชข่าวในตารางขึ้นมาตรวจสอบ
    let { data: dbNews } = await supabase.from('world_news').select('*').order('published_time', { ascending: false }).limit(15);
    
    // แก้บัค Vercel Freeze: ถ้าตารางว่างเปล่า ให้บังคับรันบอทกวาดข่าวให้เสร็จสมบูรณ์ก่อนส่งกลับรอบแรก
    if (!dbNews || dbNews.length === 0) {
        await processNextUpdates();
        const { data: updatedNews } = await supabase.from('world_news').select('*').order('published_time', { ascending: false }).limit(15);
        dbNews = updatedNews;
    } else {
        const isCacheOld = (Date.now() - new Date(dbNews[0].created_at).getTime() > 3600000);
        if (isCacheOld) {
            processNextUpdates().catch(e => console.error(e));
        }
    }

    // แมปปิ้งโครงสร้างข้อมูลให้ตรงกับที่ไฟล์หน้าบ้าน (world-news.js) เรียกใช้เป๊ะๆ
    const formattedData = (dbNews || []).map(n => ({
        title: n.title,
        summary: n.summary,
        url: n.source_url,
        source: n.source_name,  // แปลงให้หน้าบ้านรู้จัก
        newsType: n.news_type,  // แปลงให้หน้าบ้านรู้จัก
        timeStr: formatNewsDate(n.published_time), // สร้างข้อความเวลาภาษาไทย
        time: new Date(n.published_time).getTime()
    }));

    return res.status(200).json({ success: true, data: formattedData });
}