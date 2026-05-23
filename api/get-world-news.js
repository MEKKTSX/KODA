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
        return englishTitle; 
    }
}

// 🛡️ ปรับปรุงระบบสกัดข่าวสารจาก RSS ใหม่ทั้งหมดให้ยืดหยุ่นและทนทานต่ออักขระพิเศษสากล
async function fetchNewsFromRss(feedUrl, sourceName) {
    try {
        const res = await fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
        const text = await res.text();
        
        // แยกชิ้นส่วนไอเทมข่าวสารแบบไม่สนใจพิมพ์เล็กพิมพ์ใหญ่
        const items = text.split(/<item>/i).slice(1, 5); 
        return items.map(item => {
            // 🚀 แก้บั๊กใหญ่: ใช้ [\s\S]*? เพื่อสั่งให้ค้นหาข้ามบรรทัดได้ และรองรับช่องว่างที่แทรกอยู่รอบๆ แท็ก XML
            const titleMatch = item.match(/<title>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))\s*<\/title>/i);
            const linkMatch = item.match(/<link>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))\s*<\/link>/i);
            const descMatch = item.match(/<description>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))\s*<\/description>/i);
            
            const title = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : '';
            const link = linkMatch ? (linkMatch[1] || linkMatch[2] || '').trim() : '';
            let summaryText = descMatch ? (descMatch[1] || descMatch[2] || '').trim() : '';
            
            // ล้างรหัสแท็ก HTML ขยะออกจากบทสรุป
            summaryText = summaryText.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 200).trim();

            return {
                title: title,
                link: link,
                summary: summaryText || 'คลิกเปิดกล่องเครื่องมือ KODA AI เพื่อสั่งวิเคราะห์ผลกระทบเชิงลึก',
                source: sourceName,
                created_at: new Date().toISOString()
            };
        }).filter(news => news.title && news.link); // คัดกรองเฉพาะข่าวที่มีส่วนประกอบสมบูรณ์จริง
    } catch (e) {
        console.error(`[RSS Fetch Failure] Source: ${sourceName}`, e.message);
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

        const allFeeds = await Promise.all(sources.map(s => fetchNewsFromRss(s.url, s.name)));
        const aggregatedNews = allFeeds.flat();

        let savedCount = 0;
        for (let news of aggregatedNews) {
            const { data: exists } = await supabase.from('world_news').select('id').eq('link', news.link).maybeSingle();
            
            if (!exists) {
                const currentKey = keysArray[Math.floor(Math.random() * keysArray.length)];
                const thaiTitle = await translateHeadlineToThai(news.title, news.source, currentKey);
                
                await supabase.from('world_news').insert([{
                    title: thaiTitle,
                    link: news.link,
                    summary: news.summary,
                    source: news.source,
                    created_at: news.created_at
                }]);
                
                savedCount++;
                if (savedCount >= 3) break; // จำกัดสปีดไว้ไม่เกิน 3 ข่าวใหม่ต่อรอบ เพื่อป้องกันโทเคนเต็ม
            }
        }

        // ⚔️ ควบคุมจำนวนข้อมูลให้ไม่เกิน 15 ข่าวล่าสุดสากล
        const { data: totalNews } = await supabase
            .from('world_news')
            .select('id')
            .order('created_at', { ascending: false });

        if (totalNews && totalNews.length > 15) {
            const idsToDelete = totalNews.slice(15).map(item => item.id);
            await supabase.from('world_news').delete().in('id', idsToDelete);
        }

        // 🚀 🛠️ แก้บั๊กหน้าบ้านค้าง: สั่งดึงข้อมูล 15 ข่าวล่าสุดจากฐานข้อมูล ยัดกลับเข้าไปในคีย์ "data" ส่งออกไปหน้าบ้าน
        const { data: freshNewsData } = await supabase
            .from('world_news')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(15);

        return res.status(200).json({ 
            success: true, 
            data: freshNewsData || [], // ✅ ส่งก้อนข้อมูลชุดนี้ไปให้หน้าบ้านวาดหน้าจอ UI
            processed: savedCount 
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
