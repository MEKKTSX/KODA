import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 🧠 ฟังก์ชันใช้ Gemini แปลและสรุปจั่วหัวข่าวเป็นภาษาไทยแบบกระชับสั้นๆ
async function translateHeadlineToThai(englishTitle, sourceName, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
    
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

// 🛡️ ปรับปรุงระบบสกัดข่าวสารจาก RSS: ปลอมตัวตนหลบเลี่ยงการบล็อกจาก Cloudflare และรองรับแท็กเว้นบรรทัด
async function fetchNewsFromRss(feedUrl, sourceName) {
    try {
        const res = await fetch(feedUrl, { 
            headers: { 
                // 🚀 ยัดค่า Headers สมจริงเสมือนเปิดผ่าน Chrome เพื่อหลบเลี่ยงการโดนดีดคำสั่งทิ้งจาก Seeking Alpha และ RSSHub
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/xml, text/xml, */*'
            }, 
            signal: AbortSignal.timeout(10000) 
        });
        
        if (!res.ok) {
            console.error(`[Fetch Blocked] ${sourceName} returned status: ${res.status}`);
            return [];
        }
        
        const text = await res.text();
        const items = text.split(/<item>/i).slice(1, 6); // หยิบเช็ก 5 ข่าวล่าสุดต่อรอบ
        
        return items.map(item => {
            // 🚀 ปรับปรุง Regex สกัดคำ: ใช้การกวาดข้อความภาพรวมแล้วสั่งล้างสัญลักษณ์ CDATA ทิ้งทีหลัง เพื่อกันปัญหาเว้นบรรทัดพัง
            const title = (item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/gi, '').trim();
            const link = (item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/gi, '').trim();
            let summaryText = (item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/gi, '');
            
            summaryText = summaryText.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 200).trim();

            return {
                title: title,
                link: link,
                summary: summaryText || 'คลิกเปิดกล่องเครื่องมือ KODA AI เพื่อสั่งวิเคราะห์ผลกระทบเชิงลึกทางภูมิรัฐศาสตร์',
                source: sourceName,
                created_at: new Date().toISOString()
            };
        }).filter(news => news.title && news.link);
    } catch (e) {
        console.error(`[RSS Fetch Error] Source: ${sourceName} ->`, e.message);
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
        
        // 💡 หมายเหตุ: หากชื่อตารางในฐานข้อมูลของคุณใช้ "world-news" (ขีดกลาง) ให้สลับมาแก้เครื่องหมายตรงนี้ครับ
        const tableName = 'world_news'; 

        for (let news of aggregatedNews) {
            // ตรวจสอบข่าวซ้ำในคลังด้วย link
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
                if (savedCount >= 4) break; // ดึงรอบละ 4 ข่าวใหม่พอ เพื่อป้องกัน Tokens วิ่งชนเพดานไว
            }
        }

        // ⚔️ บังคับคุมจำนวนข้อมูลท้ายตาราง ล็อกยอดไว้ไม่เกิน 15 ข่าวล่าสุดเสมอ
        const { data: totalNews } = await supabase
            .from(tableName)
            .select('id')
            .order('created_at', { ascending: false });

        if (totalNews && totalNews.length > 15) {
            const idsToDelete = totalNews.slice(15).map(item => item.id);
            await supabase.from(tableName).delete().in('id', idsToDelete);
        }

        // 🚀 ดึงชุดข้อมูล 15 ข่าวล่าสุดที่อัปเดตเรียบร้อย ส่งยัดใส่คีย์ data กลับไปให้หน้าบ้านโหลดทำงานทันที
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
