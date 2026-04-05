document.addEventListener('DOMContentLoaded', () => {
    
    const FINNHUB_API_KEY = window.ENV_KEYS.FINNHUB;
    const earningsContainer = document.getElementById('earnings-container');
    const anomalyContainer = document.getElementById('anomaly-container');

    const getWatchlistSymbols = () => {
        if (window.kodaApiData && window.kodaApiData.watchlist) {
            return window.kodaApiData.watchlist.map(s => s.symbol);
        }
        const savedData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{}');
        const wl = savedData.watchlist || [];
        return wl.map(s => s.symbol);
    };

    const isUSMarketOpen = () => {
        const estTime = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
        const day = estTime.getDay(); 
        const hours = estTime.getHours();
        const mins = estTime.getMinutes();
        const currentMins = (hours * 60) + mins;
        return (day >= 1 && day <= 5 && currentMins >= 570 && currentMins <= 960);
    };

    // 📌 กู้คืน Market Sentiment
    const fetchFearAndGreed = async () => {
        const statusEl = document.getElementById('fng-status');
        const valEl = document.getElementById('fng-value');
        const pin = document.getElementById('fng-pin');

        const now = Date.now();
        const cachedData = localStorage.getItem('koda_fng_data');
        const cachedTime = localStorage.getItem('koda_fng_timestamp');

        const applyFnGData = (val, status) => {
            if(valEl) valEl.textContent = val;
            if(statusEl) {
                statusEl.textContent = status.toUpperCase();
                statusEl.className = 'text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider transition-colors ';
                if(val <= 25) statusEl.classList.add('bg-danger/20', 'text-danger');
                else if(val <= 45) statusEl.classList.add('bg-orange-500/20', 'text-orange-500');
                else if(val <= 55) statusEl.classList.add('bg-yellow-500/20', 'text-yellow-500');
                else statusEl.classList.add('bg-success/20', 'text-success');
            }
            if(pin) pin.style.left = `${val}%`;
        };

        if (cachedData && cachedTime && (now - parseInt(cachedTime) < 3600000)) {
            const { val, status } = JSON.parse(cachedData);
            applyFnGData(val, status);
            return; 
        }

        if(statusEl) {
            statusEl.textContent = "LOADING...";
            statusEl.className = 'text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider bg-slate-800 text-slate-300 transition-colors';
        }

        try {
            const cnnUrl = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata?_=' + now;
            
            const proxies = [
                `https://api.allorigins.win/raw?url=`,
                `https://api.codetabs.com/v1/proxy?quest=`,
                `https://corsproxy.io/?url=`
            ];
            
            let cnnData = null;
            for (let proxy of proxies) {
                try {
                    const res = await fetch(proxy + encodeURIComponent(cnnUrl));
                    if (res.ok) {
                        cnnData = await res.json();
                        if (cnnData && cnnData.fear_and_greed) break; 
                    }
                } catch(e) { continue; }
            }

            if (cnnData && cnnData.fear_and_greed) {
                const val = Math.round(cnnData.fear_and_greed.score);
                const status = cnnData.fear_and_greed.rating.replace(/_/g, ' ');

                localStorage.setItem('koda_fng_data', JSON.stringify({ val, status }));
                localStorage.setItem('koda_fng_timestamp', now.toString());

                applyFnGData(val, status);
            } else {
                throw new Error("No data returned");
            }
        } catch(e) { 
            if (cachedData) {
                const { val, status } = JSON.parse(cachedData);
                applyFnGData(val, status);
                return;
            }

            if(statusEl) {
                statusEl.textContent = "OFFLINE";
                statusEl.className = 'text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider bg-slate-800 text-slate-500 transition-colors';
            }
        }
    };

    // 📌 ระบบ Anomaly Alerts ของเดิมที่ใช้งานได้ดีอยู่แล้ว
    const fetchMarketAlerts = async () => {
        if (!anomalyContainer) return;
        const wlSymbols = getWatchlistSymbols();
        let allAlerts = [];

        try {
            const btcRes = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT').then(r=>r.json());
            
            const change = parseFloat(btcRes.priceChangePercent);
            
            if (Math.abs(change) >= 4.0) {
                const type = change < 0 ? 'LIQUIDATION' : 'BREAKOUT';
                const color = change < 0 ? 'danger' : 'success';
                allAlerts.push(`
                    <div class="block bg-surface-dark border border-${color}/50 rounded-xl p-3 relative overflow-hidden mb-3">
                        <div class="absolute top-0 left-0 w-1.5 h-full bg-${color}"></div>
                        <div class="flex justify-between items-center mb-1.5 pl-2">
                            <span class="bg-${color} text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                                <span class="material-symbols-outlined text-[10px]">bolt</span> MARKET ${type}
                            </span>
                            <span class="text-slate-500 text-[9px] font-medium flex items-center gap-1"><span class="size-1.5 bg-danger rounded-full animate-pulse"></span> LIVE</span>
                        </div>
                        <div class="pl-2 mt-2">
                            <h3 class="text-white font-bold text-sm leading-tight">
                                BTC experiencing high volatility: ${change.toFixed(2)}% move in 24h.
                            </h3>
                        </div>
                    </div>
                `);
            }

            const cryptoNews = await fetch(`https://finnhub.io/api/v1/news?category=crypto&token=${FINNHUB_API_KEY}`).then(r=>r.json());
            let whaleRaw = cryptoNews.filter(n => 
                n.headline.toLowerCase().includes('whale') || 
                n.headline.toLowerCase().includes('massive transfer') ||
                n.headline.toLowerCase().includes('dump')
            );
            const whaleNews = window.kodaMixNews ? window.kodaMixNews(whaleRaw, 2) : whaleRaw.slice(0, 2);
            
            for (let wn of whaleNews) {
                const timeAgo = Math.floor((Date.now() / 1000 - wn.datetime) / 3600);
                const timeText = timeAgo < 1 ? 'Just now' : `${timeAgo}h ago`;
                const translatedHeadline = window.KodaAI && typeof window.KodaAI.translateText === 'function' ? await window.KodaAI.translateText(wn.headline) : wn.headline;
                
                allAlerts.push(`
                    <a href="${wn.url}" target="_blank" class="block bg-surface-dark border border-primary/30 rounded-xl p-3 relative overflow-hidden hover:bg-slate-800 transition-colors mb-3">
                        <div class="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                        <div class="flex justify-between items-center mb-1.5 pl-1.5">
                            <span class="bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border border-primary/20 flex items-center gap-1">
                                <span class="material-symbols-outlined text-[10px]">radar</span> WHALE ALERT
                            </span>
                            <span class="text-slate-500 text-[9px] font-medium">${timeText}</span>
                        </div>
                        <div class="pl-1.5">
                            <h3 class="text-white font-bold text-sm leading-tight line-clamp-2">
                                ${translatedHeadline}
                            </h3>
                        </div>
                    </a>
                `);
            }
        } catch(e) {}

        if (wlSymbols.length > 0) {
            try {
                const today = new Date();
                const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000); 
                const formatDate = (date) => date.toISOString().split('T')[0];

                await Promise.all(wlSymbols.map(async (sym) => {
                    if (sym.includes('.BK') || sym.includes(':')) return; 
                    try {
                        const res = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${sym}&from=${formatDate(threeDaysAgo)}&to=${formatDate(today)}&token=${FINNHUB_API_KEY}`);
                        let newsList = await res.json();
                        
                        if (newsList && newsList.length > 0) {
                            if (window.kodaMixNews) newsList = window.kodaMixNews(newsList, 5);
                            let topNews = newsList[0];
                            let impactScore = 0;
                            let alertType = 'News';
                            let alertColor = 'primary';

                            newsList.forEach(news => {
                                const text = (news.headline + " " + (news.summary || "")).toLowerCase();
                                if (text.match(/(surge|jump|soar|rally|upgrade|breakout|record|beat)/)) {
                                    if(impactScore < 100) { impactScore = 100; topNews = news; alertType = 'Bullish'; alertColor = 'success'; }
                                } else if (text.match(/(plunge|crash|drop|tumble|downgrade|loss|miss)/)) {
                                    if(impactScore < 100) { impactScore = 100; topNews = news; alertType = 'Bearish'; alertColor = 'danger'; }
                                }
                            });

                            if (impactScore > 0) {
                                const timeAgo = Math.floor((Date.now() / 1000 - topNews.datetime) / 3600);
                                const timeText = timeAgo < 1 ? 'Just now' : `${timeAgo}h ago`;
                                const translatedHeadline = await window.KodaAI.translateText(topNews.headline);

                                allAlerts.push(`
                                    <a href="${topNews.url}" target="_blank" class="block bg-surface-dark border border-${alertColor}/30 rounded-xl p-3 relative overflow-hidden mb-3">
                                        <div class="absolute top-0 left-0 w-1 h-full bg-${alertColor}"></div>
                                        <div class="flex justify-between items-center mb-1.5 pl-1.5">
                                            <span class=\"bg-${alertColor}/10 text-${alertColor} text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border border-${alertColor}/20\">${alertType}</span>
                                            <span class=\"text-slate-500 text-[9px] font-medium\">${timeText}</span>
                                        </div>
                                        <div class=\"pl-1.5\">
                                            <h3 class=\"text-white font-bold text-sm leading-tight line-clamp-2\">
                                                <span class=\"text-${alertColor} mr-1\">[${sym}]</span>${translatedHeadline}
                                            </h3>
                                        </div>
                                    </a>
                                `);
                            }
                        }
                    } catch (e) {}
                }));
            } catch (error) {}
        }

        if (allAlerts.length === 0) {
            anomalyContainer.innerHTML = `<p class="text-slate-500 text-sm text-center py-4 border border-dashed border-border-dark rounded-xl">No significant market anomalies right now.</p>`;
        } else {
            anomalyContainer.innerHTML = allAlerts.join('');
        }
    };

    const renderMiniBarChart = (earningsHistory) => {
        if (!earningsHistory || earningsHistory.length === 0) return `<span class="text-slate-600 text-[9px] font-medium">No history</span>`;
        const recentHistory = earningsHistory.slice(0, 4).reverse();
        let maxVal = 1;
        recentHistory.forEach(q => {
            if (Math.abs(q.estimate || 0) > maxVal) maxVal = Math.abs(q.estimate);
            if (Math.abs(q.actual || 0) > maxVal) maxVal = Math.abs(q.actual);
        });
        const barsHTML = recentHistory.map(q => {
            const actColorClass = (q.actual !== null && q.estimate !== null && q.actual >= q.estimate) ? 'bg-success' : 'bg-danger';
            return `<div class="flex items-end gap-[2px]"><div class="w-1.5 bg-slate-600 rounded-t-sm" style="height: ${Math.max(10, (Math.abs(q.estimate||0)/maxVal)*100)}%"></div><div class="w-1.5 ${actColorClass} rounded-t-sm" style="height: ${Math.max(10, (Math.abs(q.actual||0)/maxVal)*100)}%"></div></div>`;
        }).join('');
        return `<div class="flex items-end gap-1.5 h-6 border-b border-border-dark/50 pb-0.5">${barsHTML}</div>`;
    };

    // 📌 [SUPER FIX] ระบบ Upcoming Catalysts (Hybrid Fetch ประหยัด API ไม่ติด Limit แน่นอน)
    const fetchEarningsData = async () => {
        if (!earningsContainer) return;
        const wlSymbols = getWatchlistSymbols();
        if (wlSymbols.length === 0) {
            earningsContainer.innerHTML = `<p class="text-slate-500 text-sm text-center py-10 border border-dashed border-border-dark rounded-xl">Add stocks to see catalysts.</p>`;
            return;
        }

        const todayStr = new Date().toDateString(); 
        const wlSymbolsStr = JSON.stringify(wlSymbols); 
        const cached = JSON.parse(localStorage.getItem('koda_catalysts_cache_v4') || 'null'); // เคลียร์ Cache Error อันเก่าทิ้ง

        if (cached && cached.date === todayStr && cached.symbols === wlSymbolsStr) {
            earningsContainer.innerHTML = cached.html;
            return;
        }

        earningsContainer.innerHTML = `<div class="flex justify-center py-6"><div class="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>`;

        try {
            const fromStr = new Date().toISOString().split('T')[0];
            const toStr = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]; // ขยายเวลาค้นหาเป็น 90 วัน
            
            let upcoming = [];
            const validSymbols = wlSymbols.filter(sym => !sym.includes('BINANCE:') && !sym.includes('OANDA:') && !sym.includes('FX:'));

            // 🚀 STEP 1: ดึงปฏิทินรวมระดับโลกมาหาหุ้นก่อน (ยิง API แค่ 1 ครั้ง ได้หุ้นหลักเกือบหมด)
            try {
                const globalRes = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${fromStr}&to=${toStr}&token=${FINNHUB_API_KEY}`);
                if (globalRes.ok) {
                    const globalData = await globalRes.json();
                    if (globalData && globalData.earningsCalendar) {
                        const matched = globalData.earningsCalendar.filter(e => validSymbols.includes(e.symbol));
                        upcoming.push(...matched);
                    }
                }
            } catch(e) { console.warn("Global calendar fetch failed, falling back to individual fetch."); }

            // 🚀 STEP 2: ตรวจหาหุ้นที่ปฏิทินรวมทำตกหล่น (เช่น TSM, ASML) แล้วเจาะจงดึงเฉพาะตัวที่หายไป
            const foundSymbols = upcoming.map(u => u.symbol);
            const missingSymbols = validSymbols.filter(sym => !foundSymbols.includes(sym));

            for (const sym of missingSymbols) {
                let retries = 3;
                while (retries > 0) {
                    try {
                        const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${fromStr}&to=${toStr}&symbol=${sym}&token=${FINNHUB_API_KEY}`);
                        
                        if (res.status === 429) { 
                            retries--; 
                            await new Promise(r => setTimeout(r, 2000)); // ติดลิมิต? พัก 2 วิแล้วดึงใหม่ ไม่ข้าม!
                            continue; 
                        }
                        
                        if (res.ok) {
                            const data = await res.json();
                            if (data && data.earningsCalendar && data.earningsCalendar.length > 0) {
                                upcoming.push(data.earningsCalendar[0]);
                            }
                        }
                        break; // ดึงสำเร็จออกจาก Loop Retry
                    } catch(e) { break; }
                }
                await new Promise(r => setTimeout(r, 200)); // หน่วงเวลา 200ms ป้องกันโดนแบน
            }
            
            // กรองเอาเฉพาะวันประกาศที่ใกล้ที่สุดของแต่ละบริษัท (เผื่อมีมาซ้ำ 2 ไตรมาส)
            const uniqueUpcoming = [];
            const seenSyms = new Set();
            upcoming.forEach(u => {
                if (!seenSyms.has(u.symbol)) {
                    seenSyms.add(u.symbol);
                    uniqueUpcoming.push(u);
                }
            });

            if (uniqueUpcoming.length === 0) {
                const emptyHtml = `<p class="text-slate-500 text-sm text-center py-10 border border-dashed border-border-dark rounded-xl">No upcoming earnings detected.</p>`;
                earningsContainer.innerHTML = emptyHtml;
                localStorage.setItem('koda_catalysts_cache_v4', JSON.stringify({ date: todayStr, symbols: wlSymbolsStr, html: emptyHtml }));
                return;
            }
            
            // 🚀 STEP 3: ดึงประวัติงบการเงิน (History) ทีละตัวแบบระมัดระวัง เพื่อวาดกราฟแท่ง
            const finalData = [];
            for (const company of uniqueUpcoming) {
                let history = [];
                let retries = 3;
                while (retries > 0) {
                    try {
                        const res = await fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${company.symbol}&token=${FINNHUB_API_KEY}`);
                        if (res.status === 429) { 
                            retries--; 
                            await new Promise(r => setTimeout(r, 2000)); 
                            continue; 
                        }
                        if (res.ok) history = await res.json();
                        break;
                    } catch(e) { break; }
                }
                finalData.push({ ...company, history: history || [] });
                await new Promise(r => setTimeout(r, 200)); // ถนอม API ไม่ให้พัง
            }
            
            finalData.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            const renderedHtml = finalData.map(cat => `
                <a href="stock-detail.html?symbol=${cat.symbol}" class="relative block bg-surface-dark border border-border-dark rounded-xl p-3 mt-3 hover:bg-slate-800 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-background-dark border border-border-dark flex flex-col items-center justify-center shrink-0">
                            <span class="text-[8px] font-bold text-danger uppercase leading-none mt-1">${new Date(cat.date).toLocaleString('en-US', { month: 'short' })}</span>
                            <span class="text-lg font-black text-white leading-none mt-0.5">${new Date(cat.date).getDate()}</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="text-white font-bold text-sm truncate">${cat.symbol}</h3>
                            <p class="text-slate-400 text-[10px] mt-0.5">Est EPS: <span class="text-slate-200 font-medium">${cat.epsEstimate !== null && cat.epsEstimate !== undefined ? '$'+cat.epsEstimate.toFixed(2) : 'N/A'}</span></p>
                        </div>
                        <div class="shrink-0 flex flex-col items-end">${renderMiniBarChart(cat.history)}</div>
                    </div>
                </a>`).join('');

            earningsContainer.innerHTML = renderedHtml;
            localStorage.setItem('koda_catalysts_cache_v4', JSON.stringify({ date: todayStr, symbols: wlSymbolsStr, html: renderedHtml }));
            
        } catch (e) { 
            earningsContainer.innerHTML = `<p class="text-danger text-sm text-center py-4">Error loading catalysts. System overloaded.</p>`; 
        }
    };

    let lastAlertFetchTime = 0;
    const runMasterController = () => {
        const now = Date.now();
        if (now - lastAlertFetchTime >= 300000) {
            fetchMarketAlerts();
            fetchFearAndGreed();
            lastAlertFetchTime = now;
        }
    };

    setTimeout(() => {
        fetchFearAndGreed();
        fetchEarningsData();
        fetchMarketAlerts();
        lastAlertFetchTime = Date.now();
    }, 500);

    setInterval(runMasterController, 60000);
});