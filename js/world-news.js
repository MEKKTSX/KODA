document.addEventListener('DOMContentLoaded', () => {
    
    // 🔑 1. ระบบ API Key Pool (สลับอัตโนมัติเมื่อติด Limit)
    const GEMINI_API_KEYS = [
        'AIzaSyDFOnO00yIXiuYYcJJp5TJlkUKaihWnLxs',
        'AIzaSyCeXmhGxm3eAFjgkykDoo0ZSZCsd4srG6w',
        'AIzaSyBbA0rpSyA7VarA4eZS2fXFOxLHRo0CHRY'
    ];
    let currentKeyIdx = 0; 

    // UI Elements
    const tabTimeline = document.getElementById('tab-timeline');
    const tabIntel = document.getElementById('tab-intel');
    const contentTimeline = document.getElementById('content-timeline');
    const contentIntel = document.getElementById('content-intel');
    const timelineContainer = document.getElementById('timeline-container');
    const videoContainer = document.getElementById('video-container'); // ใช้เป็น Container ของ Tech News
    const btnRefresh = document.getElementById('btn-refresh-world');

    // 📌 เปลี่ยนชื่อแท็บจาก Video Intel เป็น Tech & AI ทันที
    if (tabIntel) {
        tabIntel.innerHTML = `<span class="material-symbols-outlined text-[16px]">rocket_launch</span> Tech & AI`;
    }

    // 📌 สลับแท็บ Timeline vs Tech
    tabTimeline.addEventListener('click', () => {
        tabTimeline.className = 'flex-1 text-xs font-bold py-2 rounded-md bg-danger text-white transition-all';
        tabIntel.className = 'flex-1 text-xs font-bold py-2 rounded-md text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1';
        contentTimeline.classList.remove('hidden');
        contentIntel.classList.add('hidden');
    });

    tabIntel.addEventListener('click', () => {
        tabIntel.className = 'flex-1 text-xs font-bold py-2 rounded-md bg-blue-500 text-white transition-all flex items-center justify-center gap-1';
        tabTimeline.className = 'flex-1 text-xs font-bold py-2 rounded-md text-slate-400 hover:text-white transition-all';
        contentIntel.classList.remove('hidden');
        contentTimeline.classList.add('hidden');
    });

    const politicalKeywords = /war|conflict|missile|attack|military|explosion|bomb|soldier|invasion|israel|gaza|russia|ukraine|iran|hormuz|china|taiwan|tariff|sanction|election|biden|trump|putin|xi|geopolitical|สงคราม|ทหาร|อิหร่าน|สหรัฐ|จีน|รัสเซีย|ขีปนาวุธ|ผู้นำ|คว่ำบาตร|เศรษฐกิจ|วิกฤต|เจรจา|น้ำมัน/i;

    // ==========================================
    // 📌 2. ฟังก์ชันดึง AI แบบฉลาด (สลับ Key อัตโนมัติเมื่อติด Limit)
    // ==========================================
    const fetchGeminiAPI = async (prompt, isJson = false) => {
        let retries = 4;

        while (retries > 0) {
            try {
                const activeKey = GEMINI_API_KEYS[currentKeyIdx];
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
                
                const config = { temperature: 0.5 };
                if (isJson) config.responseMimeType = "application/json";

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: [{ text: prompt }] }],
                        generationConfig: config
                    })
                });

                if (response.status === 429) {
                    console.warn(`[AI Pool] Key ${currentKeyIdx} Limit Reached. Switching...`);
                    currentKeyIdx = (currentKeyIdx + 1) % GEMINI_API_KEYS.length;
                    retries--;
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }

                const data = await response.json();
                if (data.candidates && data.candidates[0].content.parts[0].text) {
                    return data.candidates[0].content.parts[0].text;
                }
                throw new Error("Empty AI Response");
            } catch (e) {
                retries--;
                if (retries === 0) throw e;
                await new Promise(r => setTimeout(r, 1500));
            }
        }
    };

    // ==========================================
    // 📌 3. ดึงข่าวจัดทำ Timeline (ผสานข่าวโลก + Truth Social)
    // ==========================================
    const fetchTimeline = async (forceRefresh = false) => {
        const cacheKey = 'koda_world_timeline_v18'; 
        const cached = JSON.parse(localStorage.getItem(cacheKey));
        const now = Date.now();

        if (!forceRefresh && cached && (now - cached.timestamp < 3600000)) {
            renderTimeline(cached.data);
            return;
        }

        timelineContainer.innerHTML = `<div class="flex flex-col items-center justify-center py-10 gap-3"><div class="size-5 border-2 border-danger border-t-transparent rounded-full animate-spin"></div><p class="text-slate-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">Scanning Global Radars...</p></div>`;

        try {
            let allNews = [];

            // ดึงข่าว Geo-Politics ปกติ
            const rssSources = [
                'https://th.investing.com/rss/news_14.rss',  
                'https://th.investing.com/rss/news_285.rss', 
                'http://feeds.bbci.co.uk/news/world/rss.xml',
                'https://search.cnbc.com/api/v1/search/rss/outbound/rss/content?type=story'
            ];

            for (let url of rssSources) {
                const proxies = [
                    `https://api.allorigins.win/raw?url=${encodeURIComponent(url + '?_=' + Date.now())}`,
                    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
                ];

                for (let proxyUrl of proxies) {
                    try {
                        const res = await fetch(proxyUrl);
                        if (!res.ok) continue;
                        
                        const text = await res.text();
                        const parser = new DOMParser();
                        const xml = parser.parseFromString(text, "text/xml");
                        const items = xml.querySelectorAll("item");
                        const sourceTitle = xml.querySelector("title")?.textContent || "Global News";
                        
                        items.forEach(item => {
                            const title = item.querySelector("title")?.textContent || "";
                            const desc = (item.querySelector("description")?.textContent || "").replace(/<\/?[^>]+(>|$)/g, "");
                            const pubDateStr = item.querySelector("pubDate")?.textContent;
                            if (!pubDateStr) return;

                            const pubDate = new Date(pubDateStr);
                            if (isNaN(pubDate.getTime()) || pubDate.getTime() > now + 86400000) return;

                            if (politicalKeywords.test(title) || politicalKeywords.test(desc)) {
                                const dateStr = pubDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                                const timeStr = pubDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';

                                allNews.push({
                                    originalTitle: title, 
                                    title: title, 
                                    summary: desc,
                                    url: item.querySelector("link")?.textContent || "",
                                    source: sourceTitle.replace(' - Investing.com', '').replace('BBC News - ', ''),
                                    time: pubDate.getTime(),
                                    timeStr: `${dateStr} • ${timeStr}`,
                                    newsType: 'geo'
                                });
                            }
                        });
                        break; 
                    } catch(e) { continue; }
                }
            }

            // ดึง Truth Social ของ @realDonaldTrump
            try {
                const truthUrl = 'https://trumpstruth.org/feed';
                const proxies = [
                    `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(truthUrl)}&_=${Date.now()}`,
                    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(truthUrl)}`
                ];

                for (let p of proxies) {
                    try {
                        const res = await fetch(p);
                        if (!res.ok) continue;

                        let items = [];
                        if (p.includes('rss2json')) {
                            const data = await res.json();
                            if (data && data.items) items = data.items;
                        } else {
                            const text = await res.text();
                            const parser = new DOMParser();
                            const xml = parser.parseFromString(text, "text/xml");
                            const xmlItems = xml.querySelectorAll("item");
                            xmlItems.forEach(x => {
                                items.push({
                                    description: x.querySelector("description")?.textContent || "",
                                    pubDate: x.querySelector("pubDate")?.textContent || "",
                                    link: x.querySelector("link")?.textContent || ""
                                });
                            });
                        }

                        if (items.length > 0) {
                            items.forEach(item => {
                                const rawDesc = item.description || "";
                                const desc = rawDesc.replace(/<\/?[^>]+(>|$)/g, "").trim();
                                if (!desc) return;

                                const pubDate = new Date(item.pubDate);
                                if (isNaN(pubDate.getTime()) || pubDate.getTime() > now + 86400000) return;

                                const dateStr = pubDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                                const timeStr = pubDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';

                                allNews.push({
                                    originalTitle: "ทรัมป์โพสต์ว่า: " + desc.substring(0, 150),
                                    title: desc.substring(0, 80) + '...', 
                                    summary: desc,
                                    url: item.link || "https://truthsocial.com/@realDonaldTrump",
                                    source: "Truth Social",
                                    time: pubDate.getTime(),
                                    timeStr: `${dateStr} • ${timeStr}`,
                                    newsType: 'truth'
                                });
                            });
                            break;
                        }
                    } catch(e) { continue; }
                }
            } catch(e) { console.warn("Truth Social fetch failed"); }

            allNews.sort((a, b) => b.time - a.time);

            const uniqueNews = [];
            const seenTitles = new Set();
            for (let n of allNews) {
                if (!seenTitles.has(n.originalTitle)) {
                    seenTitles.add(n.originalTitle);
                    uniqueNews.push(n);
                }
            }

            if (uniqueNews.length > 0) {
                const topNews = uniqueNews.slice(0, 15);
                
                timelineContainer.innerHTML = `<div class="flex flex-col items-center justify-center py-10 gap-3"><div class="size-5 border-2 border-danger border-t-transparent rounded-full animate-spin"></div><p class="text-slate-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">AI is translating headlines...</p></div>`;
                
                try {
                    const prompt = `แปลและปรับเขียนหัวข้อข่าวต่อไปนี้ใหม่เป็น "ภาษาไทย" ให้กระชับ น่าตื่นเต้น เข้าใจง่ายแบบพาดหัวข่าวด่วน (ห้ามเยิ่นเย้อ ความยาวไม่เกิน 1-2 บรรทัด) 
                    ตอบกลับมาเป็น JSON Format ที่มี key ชื่อ "headlines" ซึ่งบรรจุ Array ของ String ตามลำดับข่าวนี้เท่านั้น ห้ามมีข้อความอื่น:
                    ${topNews.map((n, i) => `${i+1}. ${n.originalTitle.replace(/["\r\n`]/g, ' ').trim()}`).join('\n')}`;

                    const rawAiText = await fetchGeminiAPI(prompt, true);
                    const match = rawAiText.match(/\{[\s\S]*\}/);
                    const parsedData = match ? JSON.parse(match[0]) : JSON.parse(rawAiText);

                    if (parsedData && parsedData.headlines && Array.isArray(parsedData.headlines)) {
                        topNews.forEach((n, i) => {
                            if (parsedData.headlines[i]) n.title = parsedData.headlines[i];
                        });
                    }
                } catch (e) { console.warn("AI Headline rewrite failed"); }

                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: topNews }));
                renderTimeline(topNews);
            } else {
                timelineContainer.innerHTML = `<p class="text-slate-500 text-xs py-10 text-center">No major geopolitical updates detected recently.</p>`;
            }

        } catch (error) {
            timelineContainer.innerHTML = `<p class="text-danger text-xs py-10 text-center">Error connecting to global radars.</p>`;
        }
    };

    const renderTimeline = (newsList) => {
        timelineContainer.innerHTML = newsList.map(n => {
            const isTruth = n.newsType === 'truth';
            const isDanger = !isTruth && /war|attack|missile|strike|ยิง|สงคราม|โจมตี|ขีปนาวุธ|ปะทะ|คว่ำบาตร|วิกฤต/i.test(n.title);
            const dotColor = isTruth ? '#8b5cf6' : (isDanger ? '#ff4d4d' : '#34a8eb');

            const sourceHtml = isTruth 
                ? `<span class="bg-purple-500/20 text-purple-400 text-[9px] px-2 py-0.5 rounded font-black tracking-widest uppercase border border-purple-500/30 flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">campaign</span> @realDonaldTrump</span>`
                : `<span class="text-slate-500 text-[9px] uppercase font-bold">${n.source}</span>`;

            return `
            <div class="relative mb-6 group cursor-pointer" onclick="window.openWorldModal(\`${encodeURIComponent(n.title)}\`, \`${encodeURIComponent(n.summary)}\`, \`${encodeURIComponent(n.url)}\`, \`${encodeURIComponent(n.source)}\`, \`${encodeURIComponent(n.timeStr)}\`, \`${n.newsType}\`)">
                <style>.dot-${n.time}:before { background-color: ${dotColor}; border-color: ${isTruth ? 'rgba(139,92,246,0.3)' : (isDanger ? 'rgba(255,77,77,0.3)' : 'rgba(52,168,235,0.3)')}; border-width: 3px; left: -22px; width: 12px; height: 12px; z-index: 0 !important; }</style>
                <div class="timeline-dot dot-${n.time}"></div>
                <div class="bg-surface-dark border ${isTruth ? 'border-purple-500/50 shadow-[0_0_15px_rgba(139,92,246,0.15)]' : 'border-border-dark shadow-sm'} p-3 rounded-xl hover:border-${isTruth ? 'purple-500' : 'danger/50'} transition-all">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-${isTruth ? 'purple-400' : (isDanger ? 'danger' : 'primary')} text-[11px] font-black tracking-widest bg-background-dark px-2 py-0.5 rounded border border-border-dark/50">${n.timeStr}</span>
                        ${sourceHtml}
                    </div>
                    <h4 class="text-white text-sm font-bold leading-snug line-clamp-2">${n.title}</h4>
                    <p class="text-slate-400 text-xs mt-1.5 line-clamp-2 opacity-70">${n.summary}</p>
                </div>
            </div>`;
        }).join('');
    };

    // ==========================================
    // 📌 4. ระบบสแกนนวัตกรรมและเทคโนโลยีใหม่ (Tech & AI Innovations) อัปเกรด
    // ==========================================
    
    // 📌 ฟังก์ชันสุ่มดึงรูปภาพเท่ๆ มาแทนที่จรวด กรณีข่าวไม่มีภาพแนบมา
    const getFallbackTechImage = (titleText) => {
        const fallbacks = [
            'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=400', // AI Eye
            'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=400', // Microchip
            'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=400', // Cyber Security / Code
            'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=400', // Programmer
            'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=400', // Matrix Code
            'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=400', // Server Network
            'https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=400', // Abstract AI Brain
            'https://images.unsplash.com/photo-1531297172864-45d448408930?q=80&w=400'  // Digital Tech Space
        ];
        // ใช้จำนวนตัวอักษรของหัวข่าวในการเลือกรูป เพื่อให้ข่าวเดิมได้รูปเดิมเสมอ ไม่สุ่มมั่วไปมา
        const hash = titleText.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return fallbacks[hash % fallbacks.length];
    };

    const fetchTechInnovations = async (forceRefresh = false) => {
        const cacheKey = 'koda_tech_innovations_v2';
        const cached = JSON.parse(localStorage.getItem(cacheKey));
        const now = Date.now();

        if (!forceRefresh && cached && (now - cached.timestamp < 3600000)) {
            renderTechInnovations(cached.data);
            return;
        }

        videoContainer.innerHTML = `<div class="flex flex-col items-center justify-center py-10 gap-3"><div class="size-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div><p class="text-slate-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">Scanning Tech Radars...</p></div>`;

        try {
            let allTechNews = [];

            // ดึงข่าวจาก TechCrunch และ The Verge ผ่าน rss2json
            const techSources = [
                'https://techcrunch.com/feed/',
                'https://search.cnbc.com/api/v1/search/rss/outbound/rss/content?nodeId=19854910' // CNBC Tech
            ];

            for (let url of techSources) {
                try {
                    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&_=${Date.now()}`;
                    const res = await fetch(proxyUrl);
                    const data = await res.json();

                    if (data && data.items) {
                        data.items.forEach(item => {
                            const title = item.title || "";
                            const desc = (item.description || item.content || "").replace(/<\/?[^>]+(>|$)/g, "").trim();
                            const pubDateStr = item.pubDate;
                            if (!pubDateStr || !title) return;

                            const pubDate = new Date(pubDateStr);
                            if (isNaN(pubDate.getTime()) || pubDate.getTime() > now + 86400000) return;

                            const dateStr = pubDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                            const timeStr = pubDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
                            
                            let imgUrl = item.thumbnail || (item.enclosure && item.enclosure.link) || "";

                            allTechNews.push({
                                originalTitle: title,
                                title: title,
                                summary: desc,
                                url: item.link || "",
                                source: data.feed?.title || "Tech News",
                                time: pubDate.getTime(),
                                timeStr: `${dateStr} • ${timeStr}`,
                                imgUrl: imgUrl,
                                newsType: 'tech' 
                            });
                        });
                    }
                } catch(e) { console.warn("Failed fetching tech source", url); }
            }

            allTechNews.sort((a, b) => b.time - a.time);

            const uniqueTech = [];
            const seenTechTitles = new Set();
            for (let n of allTechNews) {
                if (!seenTechTitles.has(n.originalTitle)) {
                    seenTechTitles.add(n.originalTitle);
                    uniqueTech.push(n);
                }
            }

            if (uniqueTech.length > 0) {
                // 📌 เปลี่ยนเป็นดึง 20 ข่าว
                const topTech = uniqueTech.slice(0, 20);
                
                videoContainer.innerHTML = `<div class="flex flex-col items-center justify-center py-10 gap-3"><div class="size-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div><p class="text-slate-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">AI is rewriting tech headlines...</p></div>`;
                
                try {
                    const prompt = `แปลและปรับเขียนหัวข้อข่าวเกี่ยวกับเทคโนโลยีและนวัตกรรมใหม่ๆ ต่อไปนี้ ให้เป็น "ภาษาไทย" ให้ดูล้ำสมัย น่าตื่นตาตื่นใจ (ความยาวไม่เกิน 1-2 บรรทัด) 
                    ตอบกลับมาเป็น JSON Format ที่มี key ชื่อ "headlines" ซึ่งบรรจุ Array ของ String ตามลำดับข่าวนี้เท่านั้น ห้ามมีข้อความอื่น:
                    ${topTech.map((n, i) => `${i+1}. ${n.originalTitle.replace(/["\r\n`]/g, ' ').trim()}`).join('\n')}`;

                    const rawAiText = await fetchGeminiAPI(prompt, true);
                    const match = rawAiText.match(/\{[\s\S]*\}/);
                    const parsedData = match ? JSON.parse(match[0]) : JSON.parse(rawAiText);

                    if (parsedData && parsedData.headlines && Array.isArray(parsedData.headlines)) {
                        topTech.forEach((n, i) => {
                            if (parsedData.headlines[i]) n.title = parsedData.headlines[i];
                        });
                    }
                } catch (e) { console.warn("AI Tech Headline rewrite failed"); }

                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: topTech }));
                renderTechInnovations(topTech);
            } else {
                videoContainer.innerHTML = `<p class="text-slate-500 text-xs py-10 text-center">No major tech updates detected recently.</p>`;
            }

        } catch (error) {
            videoContainer.innerHTML = `<p class="text-danger text-xs py-10 text-center">Error connecting to tech radars.</p>`;
        }
    };

    const renderTechInnovations = (newsList) => {
        videoContainer.innerHTML = newsList.map((n, i) => {
            // 📌 เช็คว่าเป็นข่าวเด่นไหม (ติด Top 2 ข่าวล่าสุด หรือมีคีย์เวิร์ดระดับโลก)
            const hotKeywords = /openai|gpt|gemini|nvidia|apple|google|breakthrough|revolution|launch|announce|ai|robot|meta|microsoft/i;
            const isHot = i < 2 || hotKeywords.test(n.originalTitle);

            // 📌 จัดการรูปภาพ (ถ้าไม่มี ส่งให้ AI Fallback สุ่มให้)
            let finalImgUrl = n.imgUrl || getFallbackTechImage(n.originalTitle);

            // 📌 ดีไซน์: ถ้าเป็นข่าว Hot จะใส่กรอบสีรุ้งไล่เฉด (Pink -> Purple -> Blue) 
            const borderWrapClass = isHot 
                ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 p-[1.5px] rounded-[18px] shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)]'
                : 'bg-border-dark p-[1px] rounded-[18px] hover:border-blue-500/50';

            const badgeHtml = isHot 
                ? `<span class="text-white text-[9px] font-black tracking-widest bg-gradient-to-r from-pink-500 to-purple-500 px-2 py-0.5 rounded uppercase flex items-center gap-1 shadow-lg"><span class="material-symbols-outlined text-[12px]">local_fire_department</span> HOT TECH</span>`
                : `<span class="text-blue-400 text-[9px] font-black tracking-widest bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase flex items-center gap-1"><span class="material-symbols-outlined text-[10px]">memory</span> INNOVATION</span>`;

            return `
            <div class="relative mb-4 group cursor-pointer" onclick="window.openWorldModal(\`${encodeURIComponent(n.title)}\`, \`${encodeURIComponent(n.summary)}\`, \`${encodeURIComponent(n.url)}\`, \`${encodeURIComponent(n.source)}\`, \`${encodeURIComponent(n.timeStr)}\`, \`${n.newsType}\`)">
                <div class="${borderWrapClass} transition-all duration-300">
                    <div class="bg-surface-dark rounded-[16px] p-3 flex gap-4 items-center h-full w-full">
                        <div class="size-20 rounded-xl bg-background-dark border border-border-dark overflow-hidden shrink-0 relative">
                            <img src="${finalImgUrl}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                            ${isHot ? `<div class="absolute inset-0 bg-purple-500/10 mix-blend-overlay"></div>` : ''}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between mb-1.5">
                                ${badgeHtml}
                                <span class="text-slate-500 text-[9px] font-bold truncate ml-2 max-w-[80px]">${n.source}</span>
                            </div>
                            <h4 class="text-white text-sm font-bold leading-snug line-clamp-2">${n.title}</h4>
                            <p class="text-slate-500 text-[10px] mt-1.5 flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">schedule</span> ${n.timeStr}</p>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    };

    // ==========================================
    // 📌 5. ระบบ AI Summary (ประมวลผลธีมตามประเภทข่าว)
    // ==========================================
    const runAiAnalysis = async (title, summary, newsType, cacheKey, visualHtml, sourceBadgeHtml, dateStr, modalBody) => {
        let accentColor = 'danger';
        let accentText = 'danger';
        let aiPrompt = '';

        if (newsType === 'truth') {
            accentColor = 'purple-500'; accentText = 'purple-400';
            aiPrompt = `ในฐานะนักวิเคราะห์การเมืองและเศรษฐกิจ โปรดวิเคราะห์โพสต์ของ Donald Trump นี้:
            Headline: ${title}
            Description: ${summary}
            โปรดวิเคราะห์เป็น "ภาษาไทย" โครงสร้าง: <p>📝 <strong style="color:#fff;">สรุปเหตุการณ์:</strong>...</p> <p>🌍 <strong style="color:#fff;">ผลกระทบ:</strong>...</p> <div style="background:rgba(52,168,235,0.1); border:1px solid rgba(52,168,235,0.3); padding:12px; border-radius:8px; margin-top:16px;">💡 <strong style="color:#34a8eb;">สรุปย่อ (TL;DR):</strong>...</div> ตอบด้วย HTML ล้วน`;
        } else if (newsType === 'tech') {
            accentColor = 'blue-500'; accentText = 'blue-400';
            aiPrompt = `ในฐานะผู้เชี่ยวชาญด้านเทคโนโลยีและนวัตกรรม โปรดวิเคราะห์ข่าวนวัตกรรมนี้:
            Headline: ${title}
            Description: ${summary}
            โปรดวิเคราะห์เป็น "ภาษาไทย" โครงสร้าง: <p>📝 <strong style="color:#fff;">สรุปนวัตกรรม:</strong> (อธิบายสั้นๆว่าคืออะไร ล้ำยังไง)</p> <p>🚀 <strong style="color:#fff;">ผลกระทบต่ออนาคต:</strong> (วิเคราะห์ผลกระทบต่ออุตสาหกรรม หรือผู้ใช้)</p> <div style="background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.3); padding:12px; border-radius:8px; margin-top:16px;">💡 <strong style="color:#3b82f6;">สรุปย่อ (TL;DR):</strong>...</div> ตอบด้วย HTML ล้วน`;
        } else {
            aiPrompt = `ในฐานะนักวิเคราะห์ภูมิรัฐศาสตร์ โปรดอ่านหัวข้อข่าวนี้:
            Headline: ${title}
            Description: ${summary}
            โปรดวิเคราะห์เป็น "ภาษาไทย" โครงสร้าง: <p>📝 <strong style="color:#fff;">สรุปเหตุการณ์:</strong>...</p> <p>🌍 <strong style="color:#fff;">ผลกระทบ:</strong>...</p> <div style="background:rgba(52,168,235,0.1); border:1px solid rgba(52,168,235,0.3); padding:12px; border-radius:8px; margin-top:16px;">💡 <strong style="color:#34a8eb;">สรุปย่อ (TL;DR):</strong>...</div> ตอบด้วย HTML ล้วน`;
        }

        modalBody.innerHTML = `
            ${visualHtml}
            <div class="flex flex-col items-center justify-center py-6">
                <div class="size-8 border-2 border-${accentColor} border-t-transparent rounded-full animate-spin mb-4"></div>
                <p class="text-${accentText} text-sm font-bold animate-pulse">KODA Intel is analyzing...</p>
                <p class="text-slate-500 text-[10px] mt-1 uppercase tracking-wider text-center">Processing ${newsType === 'tech' ? 'Technological' : 'Geopolitical'} Impacts</p>
            </div>
        `;

        try {
            let rawAiText = await fetchGeminiAPI(aiPrompt, false);
            let aiResponse = rawAiText.replace(/```html/g, '').replace(/```/g, '').trim();
            
            localStorage.setItem(cacheKey, aiResponse);

            modalBody.innerHTML = `
                ${visualHtml}
                <h4 class="text-white text-lg font-bold leading-snug mb-2">${title}</h4>
                <div class="flex items-center gap-2 pb-3 mb-3 border-b border-border-dark/50">
                    ${sourceBadgeHtml}
                    <span class="text-slate-500 text-[10px]">${dateStr}</span>
                </div>
                <div class="text-slate-300 text-sm leading-relaxed space-y-4 font-medium">${aiResponse}</div>
            `;
        } catch (e) {
            modalBody.innerHTML = `
                ${visualHtml}
                <h4 class="text-white text-lg font-bold leading-snug mb-2">${title}</h4>
                <div class="flex items-center gap-2 pb-3 mb-3 border-b border-border-dark/50">
                    ${sourceBadgeHtml}
                    <span class="text-slate-500 text-[10px]">${dateStr}</span>
                </div>
                <div class="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 mb-4">
                    <p class="text-orange-400 text-[11px] font-bold flex items-center gap-1 mb-1"><span class="material-symbols-outlined text-[14px]">warning</span> ระบบ AI กำลังยุ่ง (Limit Reached)</p>
                    <p class="text-orange-500/70 text-[10px] leading-tight">แสดงผลเนื้อหาต้นฉบับชั่วคราว คุณสามารถอ่านรายละเอียดได้ด้านล่าง หรือกดปุ่มลองให้ AI วิเคราะห์ใหม่อีกครั้ง</p>
                </div>
                <div class="text-slate-300 text-sm leading-relaxed space-y-4 font-medium bg-background-dark/50 p-4 rounded-xl border border-border-dark">
                    ${summary || 'No further description available.'}
                </div>
                <button id="btn-retry-ai-fallback" class="mt-4 w-full bg-surface-dark border border-border-dark hover:border-primary/50 text-white px-4 py-3 rounded-xl font-bold text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-95">
                    <span class="material-symbols-outlined text-[16px] text-primary">refresh</span> ลองให้ AI วิเคราะห์ใหม่อีกครั้ง
                </button>
            `;
            document.getElementById('btn-retry-ai-fallback').addEventListener('click', () => {
                runAiAnalysis(title, summary, newsType, cacheKey, visualHtml, sourceBadgeHtml, dateStr, modalBody);
            });
        }
    };

    window.openWorldModal = async (encTitle, encSummary, encUrl, encSource, encDateStr, newsType = 'geo') => {
        const title   = decodeURIComponent(encTitle);
        const summary = decodeURIComponent(encSummary);
        const url     = decodeURIComponent(encUrl);
        const source  = decodeURIComponent(encSource);
        const dateStr = decodeURIComponent(encDateStr);

        const modal       = document.getElementById('modal-world-detail');
        const modalContent = document.getElementById('modal-world-content');
        const modalBody   = document.getElementById('world-modal-body');
        const modalLink   = document.getElementById('world-modal-link');
        if (!modal) return;

        modal.classList.remove('hidden'); modal.classList.add('flex');
        setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);
        modalLink.href = url;

        const cacheKey = 'koda_ai_world_v18_' + title.replace(/[^a-zA-Z0-9\u0E00-\u0E7F]/g, '').substring(0, 40);
        const cachedContent = localStorage.getItem(cacheKey);

        // 📌 ตั้งค่า UI ของหน้าต่าง Modal
        let visualHtml = `<div class="size-14 bg-danger/20 rounded-full flex items-center justify-center mb-4"><span class="material-symbols-outlined text-danger text-3xl">public</span></div>`;
        let sourceBadgeHtml = `<span class="bg-danger/20 text-danger text-[10px] px-2 py-0.5 rounded font-bold uppercase">${source}</span>`;
        let btnClass = 'bg-danger/80 hover:bg-danger border border-danger/60 text-white';

        if (newsType === 'truth') {
            visualHtml = `<div class="size-14 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 border border-purple-500/50 shadow-[0_0_20px_rgba(139,92,246,0.3)]"><span class="material-symbols-outlined text-purple-400 text-3xl">campaign</span></div>`;
            sourceBadgeHtml = `<span class="bg-purple-500/20 text-purple-400 text-[10px] px-2 py-0.5 rounded font-black uppercase border border-purple-500/30">@realDonaldTrump</span>`;
            btnClass = 'bg-purple-600/80 hover:bg-purple-500 border border-purple-500/60 text-white';
        } else if (newsType === 'tech') {
            // 📌 สำหรับ Tech News ใน Modal ก็จะโชว์รูปเหมือนกัน!
            let modalImg = getFallbackTechImage(title);
            visualHtml = `<img src="${modalImg}" class="w-full h-40 object-cover rounded-xl border border-border-dark/50 shadow-inner mb-3">`;
            sourceBadgeHtml = `<span class="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded font-black uppercase border border-blue-500/30">${source}</span>`;
            btnClass = 'bg-blue-600/80 hover:bg-blue-500 border border-blue-500/60 text-white';
        }

        if (cachedContent) {
            modalBody.innerHTML = `
                ${visualHtml}
                <h4 class="text-white text-lg font-bold leading-snug mb-2">${title}</h4>
                <div class="flex items-center gap-2 pb-3 mb-3 border-b border-border-dark/50">
                    ${sourceBadgeHtml}
                    <span class="text-slate-500 text-[10px]">${dateStr}</span>
                </div>
                <div class="text-slate-300 text-sm leading-relaxed space-y-4 font-medium">${cachedContent}</div>
            `;
            return;
        }

        const snippet = summary.length > 250 ? summary.substring(0, 250) + '…' : summary;

        modalBody.innerHTML = `
            ${visualHtml}
            <h4 class="text-white text-lg font-bold leading-snug mb-2">${title}</h4>
            <div class="flex items-center gap-2 pb-3 mb-3 border-b border-border-dark/50">
                ${sourceBadgeHtml}
                <span class="text-slate-500 text-[10px]">${dateStr}</span>
            </div>
            <p class="text-slate-400 text-sm leading-relaxed mb-5">${snippet}</p>
            <button id="btn-ai-analyze" class="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl ${btnClass} text-sm font-bold transition-all active:scale-95">
                <span class="material-symbols-outlined text-[18px]">psychology</span>
                ให้ AI วิเคราะห์${newsType === 'tech' ? 'เจาะลึกนวัตกรรม' : 'เชิงภูมิรัฐศาสตร์'}
            </button>
        `;

        document.getElementById('btn-ai-analyze').addEventListener('click', () => {
            runAiAnalysis(title, summary, newsType, cacheKey, visualHtml, sourceBadgeHtml, dateStr, modalBody);
        });
    };

    document.addEventListener('click', (e) => {
        const btnClose = e.target.closest('#btn-close-world-modal');
        const isClickOutside = e.target.id === 'modal-world-detail';
        if (btnClose || isClickOutside) {
            const modal = document.getElementById('modal-world-detail');
            const modalContent = document.getElementById('modal-world-content');
            if (modal) {
                modal.classList.add('opacity-0'); modalContent.classList.add('scale-95');
                setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 200);
            }
        }
    });

    btnRefresh.addEventListener('click', () => {
        btnRefresh.classList.add('animate-spin');
        fetchTimeline(true);
        fetchTechInnovations(true);
        setTimeout(() => btnRefresh.classList.remove('animate-spin'), 1000);
    });

    fetchTimeline();
    fetchTechInnovations(); 
});