import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 🧠 ฟังก์ชันใช้ Gemini แปลและสรุปจั่วหัวข่าวเป็นภาษาไทยแบบกระชับสั้นๆ
async function translateHeadlineToThai(englishTitle, sourceName, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    
    const prompt = `คุณคือบรรณาธิการข่าวการเงินและการลงทุนระดับโลก 
    โปรดแปลและเรียบเรียงจั่วหัวข่าวภาษาอังกฤษต่อไปนี้ ให้เป็น "ภาษาไทยที่กระชับ สั้นพาดหัวได้ในประโยคเดียว" 
    อ่านแล้วเข้าใจทันที ตรงไปตรงมา ห้ามเติมสีสันหรืออวยเกินจริง 

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
        return englishTitle; // ถ้าแปลพลาด ให้ใช้ตัวอังกฤษเดิมไปก่อนเพื่อไม่ให้ระบบล่ม
    }
}

// ปรับปรุงฟังก์ชันสกัดข่าวใน api/get-world-news.js ให้ดึงสรุปเนื้อหาข่าวสารมาด้วย
async function fetchNewsFromRss(feedUrl, sourceName) {
    try {
        const res = await fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const text = await res.text();
        
        const items = text.split('<item>').slice(1, 4); 
        return items.map(item => {
            const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
            const linkMatch = item.match(/<link>(.*?)<\/link>/);
            
            // 🚀 เพิ่มระบบเจาะสกัดเนื้อหาข่าว (Description) จากในแท็ก RSS
            const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/);
            let summaryText = descMatch ? descMatch[1] : '';
            // ล้างโค้ดรหัส HTML แปลกๆ ออกให้เหลือแต่ข้อความล้วนสะอาดๆ
            summaryText = summaryText.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 200).trim();

            return {
                title: titleMatch ? titleMatch[1] : '',
                link: linkMatch ? linkMatch[1] : '',
                summary: summaryText, // แนบข้อความสรุปข่าวสารกลับออกไปด้วย
                source: sourceName,
                created_at: new Date().toISOString()
            };
        }).filter(news => news.title && news.link);
    } catch (e) {
        return [];
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // 🔑 โหลดคีย์ Gemini แบบกระจายน้ำหนัก
    const rawGeminiKeys = process.env.GEMINI_API_KEYS || '';
    const keysArray = rawGeminiKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);

    try {
        // 🌐 1. รวมศูนย์แหล่งข่าวที่คุณต้องการ (ดึง Seeking Alpha และ Truth Social ผ่านท่อ RSS สาธารณะ)
        const sources = [
            { name: 'Donald Trump (Truth Social)', url: 'https://rsshub.app/truthsocial/user/realDonaldTrump' },
            { name: 'Seeking Alpha', url: 'https://seekingalpha.com/feed.xml' },
            { name: 'Investing.com', url: 'https://www.investing.com/rss/news.rss' },
            { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' }
        ];

        // วิ่งไปกวาดข่าวจากทุกแหล่งพร้อมกัน
        const allFeeds = await Promise.all(sources.map(s => fetchNewsFromRss(s.url, s.name)));
        const aggregatedNews = allFeeds.flat();

        if (aggregatedNews.length === 0) {
            return res.status(200).json({ success: true, message: "ไม่มีข่าวใหม่ในรอบนี้" });
        }

        // 🧠 2. แปลจั่วหัวข่าวเป็นภาษาไทยรายตัวด้วย Gemini
        let savedCount = 0;
        for (let news of aggregatedNews) {
            // เช็กก่อนว่าข่าวนั้นมีอยู่แล้วในระบบไหม (กันบันทึกซ้ำซ้อนด้วย Link)
            const { data: exists } = await supabase.from('world_news').select('id').eq('link', news.link).maybeSingle();
            
            if (!exists) {
                const currentKey = keysArray[Math.floor(Math.random() * keysArray.length)];
                
                // สั่งแปลหัวข่าวเป็นไทยกระชับ
                const thaiTitle = await translateHeadlineToThai(news.title, news.source, currentKey);
                
                // บันทึกลงฐานข้อมูล (สมมติว่าตารางชื่อ world_news)
                await supabase.from('world_news').insert([{
                    title: thaiTitle,
                    link: news.link,
                    summary: news.summary,
                    source: news.source,
                    created_at: news.created_at
                }]);
                
                savedCount++;
                if (savedCount >= 3) break; // บันทึกรอบละไม่เกิน 3 ข่าวใหม่พอ เพื่อป้องกัน Tokens เต็มไว
            }
        }

        // ⚔️ 3. กฎเหล็ก: ควบคุมจำนวนข้อมูลให้แน่นอยู่ที่ 15 ข่าวล่าสุดเสมอ
        const { data: totalNews } = await supabase
            .from('world_news')
            .select('id')
            .order('created_at', { ascending: false });

        if (totalNews && totalNews.length > 15) {
            // ดึงไอดีที่อยู่อันดับที่ 16 เป็นต้นไปออกมารวมกันเป็นอาร์เรย์
            const idsToDelete = totalNews.slice(15).map(item => item.id);
            
            // สั่งล้างแถวข้อมูลเก่าที่เกินสิทธิ์ทิ้งทันที
            await supabase
                .from('world_news')
                .delete()
                .in('id', idsToDelete);
        }

        return res.status(200).json({ success: true, processed: savedCount, current_total: totalNews?.length || 0 });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
