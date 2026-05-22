import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const RSS_SOURCES = [
    { name: 'Investing.com', url: 'https://th.investing.com/rss/news_14.rss', type: 'geo' },
    { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', type: 'geo' },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', type: 'tech' }
];

async function parseRssFeed(url) {
    try {
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.items || [];
    } catch (e) { return []; }
}

async function translateWithGemini(title, summary) {
    // 🚀 ปรับซ่อมให้อ่านค่าจาก GEMINI_API_KEYS ตามหน้าจอ Vercel ของคุณ
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

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let { data: cachedNews } = await supabase.from('world_news').select('*').order('published_time', { ascending: false }).limit(15);
    const isCacheOld = cachedNews && cachedNews.length > 0 ? (Date.now() - new Date(cachedNews[0].created_at).getTime() > 3600000) : true;

    if (cachedNews && cachedNews.length > 0 && !isCacheOld) {
        return res.status(200).json({ success: true, data: cachedNews });
    }
    processNextUpdates().catch(e => console.error(e));
    return res.status(200).json({ success: true, data: cachedNews || [] });
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
                await supabase.from('world_news').insert([{ title: aiResult.th_title, summary: aiResult.th_summary, source_url: sourceUrl, source_name: source.name, news_type: source.type, published_time: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString() }]);
                newItemsCount++;
                if (newItemsCount >= 3) break;
            }
        }
    }
}