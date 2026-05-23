import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 🧠 ฟังก์ชันใช้ Gemini แปลและสรุปจั่วหัวข่าวเป็นภาษาไทยแบบกระชับสั้นๆ
async function translateHeadlineToThai(englishTitle, sourceName, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    
    const prompt = `คุณคือบรรณาธิการข่าวการเงินและการลงทุนระดับโลก 
    โปรดแปลและเรียบเรียงจั่วหัวข่าวภาษาอังกฤษต่อไปนี้ ให้เป็น "ภาษาไทยที่กระชับ สั้นพาดหัวได้ในประโยคเดียว" 
    อ่านแล้วเข้าใจทันที ตรงไปตรงมา ห้ามเติมสีสันหรือใช้น้ำเยอะ

    ข่าวจากแหล่งข่าว: ${sourceName}
    จั่วหัวอังกฤษ: ${englishTitle}

    ตอบกลับเป็นข้อความภาษาไทยสั้นๆ ล้วน ห้ามมีเครื่องหมายคำพูด ห้ามมีคำเกริ่นนำใดๆ ทั้งสิ้น`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    } catch (e) {
        return englishTitle; 
    }
}

// 🚀 ถอดแบบกลไกดึงข้อมูลจากชุดโค้ดเก่า: ดึงผ่าน rss2json proxy เพื่อเลี่ยงการโดน Cloudflare บล็อกบน Vercel
async function fetchNewsViaProxy(feedUrl, sourceName) {
    try {
        const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&_=${Date.now()}`;
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
        
        if (!res.ok) return [];
        
        const data = await res.json();
        if (!data || !data.items || !Array.isArray(data.items)) return [];
        
        // ดึงมาเฉพาะ 4 ข่าวใหม่ล่าสุดของแต่ละแหล่งข่าวเพื่อประหยัด Tokens
        return data.items.slice(0, 4).map(item => {
            let summaryText = item.description || item.content || '';
            // ล้างแท็ก HTML และคุมความยาวสรุปเนื้อข่าว
            summaryText = summaryText.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 200).trim();
            
            return {
                title: (item.title || '').trim(),
                link: (item.link || '').trim(),
                summary: summaryText || 'คลิกเปิดกล่องเครื่องมือ KODA AI เพื่อสั่งวิเคราะห์ผลกระทบเชิงลึกทางภูมิรัฐศาสตร์',
                source: sourceName,
                created_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
            };
        }).filter(news => news.title && news.link);
    } catch (e) {
        console.error(`[Proxy Fetch Failure] Source: ${sourceName} ->`, e.message);
        return [];
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const rawGeminiKeys = process.env.GEMINI_API_KEYS || '';
    const keysArray = rawGeminiKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);

    try {
        const sources = [
            { name: 'Donald Trump (Truth Social)', url: 'https://rsshub.app/truthsocial/user/realDonaldTrump' },
            { name: 'Seeking Alpha', url: 'https://seekingalpha.com/feed.xml' },
            { name: 'Investing.com', url: 'https://www.investing.com/rss/news.rss' },
            { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' }
        ];

        // ยิงกวาดฟีดข่าวผ่าน Proxy พร้อมกันทั้งหมด
        const allFeeds = await Promise.all(sources.map(s => fetchNewsViaProxy(s.url, s.name)));
        const aggregatedNews = allFeeds.flat();

        let savedCount = 0;
        const tableName = 'world_news';

        for (let news of aggregatedNews) {
            const { data: exists } = await supabase.from(tableName).select('id').eq('link', news.link).maybeSingle();
            
            if (!exists) {
                const currentKey = keysArray[Math.floor(Math.random() * keysArray.length)];
                const thaiTitle = await translateHeadlineToThai(news.title, news.source, currentKey);
                
                await supabase.from(tableName).insert([{
                    title: thaiTitle,
                    link: news.link,
                    summary: news.summary,
                    source: news.source,
                    created_at: news.created_at
                }]);
                
                savedCount++;
                if (savedCount >= 4) break; // จำกัดการแปลรอบละ 4 ข่าวใหม่
            }
        }

        // ⚔️ กฎควบคุมฐานข้อมูล: ล็อกยอดข่าวเก่า-ใหม่รวมกันแน่นๆ ไม่เกิน 15 ข่าวล่าสุด
        const { data: totalNews } = await supabase
            .from(tableName)
            .select('id')
            .order('created_at', { ascending: false });

        if (totalNews && totalNews.length > 15) {
            const idsToDelete = totalNews.slice(15).map(item => item.id);
            await supabase.from(tableName).delete().in('id', idsToDelete);
        }

        // ดึงชุดข้อมูลข่าวล่าสุด 15 แถวส่งกลับไปให้ไฟล์ world-news.js หน้าบ้านประมวลผลทันที
        const { data: freshNewsData } = await supabase
            .from(tableName)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(15);

        return res.status(200).json({ 
            success: true, 
            data: freshNewsData || [], 
            processed: savedCount 
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
