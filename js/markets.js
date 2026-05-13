document.addEventListener('DOMContentLoaded', () => {
    
    const FINNHUB_API_KEY = window.ENV_KEYS.FINNHUB;
    const earningsContainer = document.getElementById('earnings-container');
    const anomalyContainer = document.getElementById('anomaly-container');

        const getWatchlistSymbols = () => {
        if (window.kodaApiData && window.kodaApiData.watchlist) {
            return window.kodaApiData.watchlist.map(s => s.symbol);
        }
        const savedData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{}');
        
        // Data Migration: ถ้ายังเป็นระบบเก่า (Array แบนๆ)
        if (savedData.watchlist && Array.isArray(savedData.watchlist)) {
            return savedData.watchlist.map(s => s.symbol);
        }

        // ระบบใหม่แยกแฟ้ม: ดึงหุ้นจากทุกหมวดหมู่มารวมกันแล้วตัดตัวซ้ำทิ้ง
        if (savedData.watchlists) {
            const allSymbols = new Set();
            Object.values(savedData.watchlists).forEach(list => {
                list.forEach(s => allSymbols.add(s.symbol));
            });
            return Array.from(allSymbols);
        }
        return [];
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

        // ==========================================
    // 📌 ระบบ Earnings Calendar แบบตาราง 5 วัน
    // ==========================================
    let currentCalWeekStart = new Date(); 
    // ปรับค่าเริ่มต้นให้เป็นวันจันทร์ของสัปดาห์ปัจจุบัน
    const dayOfWeek = currentCalWeekStart.getDay();
    const diff = currentCalWeekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    currentCalWeekStart.setDate(diff);

    const renderEarningsCalendar = async () => {
        const gridContainer = document.getElementById('earnings-calendar-grid');
        const displayDate = document.getElementById('earnings-week-display');
        if (!gridContainer || !displayDate) return;

        // คำนวณหาวันจันทร์ และ วันศุกร์
        const monday = new Date(currentCalWeekStart);
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        const formatDateStr = (d) => d.toISOString().split('T')[0];
        const fromStr = formatDateStr(monday);
        const toStr = formatDateStr(friday);

        // แสดงผลช่วงวันที่ด้านบนปฏิทิน
        displayDate.textContent = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${friday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

        // ระบบ Cache อัปเดตวันละ 1 ครั้ง (86400000 ms)
        const cacheKey = `koda_earn_cal_v2_${fromStr}`;
        const cached = JSON.parse(localStorage.getItem(cacheKey));
        const now = Date.now();

        if (cached && (now - cached.timestamp < 86400000)) {
            drawCalendarGrid(cached.data);
            return;
        }

        gridContainer.innerHTML = `<div class="col-span-5 flex justify-center py-10"><div class="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>`;

        try {
            const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${fromStr}&to=${toStr}&token=${FINNHUB_API_KEY}`);
            const data = await res.json();

            if (data && data.earningsCalendar) {
                // แยกข้อมูลเป็น 5 วัน (จันทร์=0, อังคาร=1, ..., ศุกร์=4)
                const weekData = [[], [], [], [], []];
                
                data.earningsCalendar.forEach(item => {
                    const itemDate = new Date(item.date);
                    const dayIndex = itemDate.getDay() - 1; 
                    if (dayIndex >= 0 && dayIndex <= 4) {
                        weekData[dayIndex].push(item);
                    }
                });

                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: weekData }));
                drawCalendarGrid(weekData);
            } else {
                throw new Error("No data");
            }
        } catch (e) {
            gridContainer.innerHTML = `<div class="col-span-5 text-center text-danger text-xs py-4">Failed to load calendar data.</div>`;
        }
    };

        const drawCalendarGrid = (weekData) => {
        const gridContainer = document.getElementById('earnings-calendar-grid');
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        
        // 🚀 1. ดึงรายชื่อหุ้นใน Watchlist มาเตรียมไว้เพื่อใช้ตรวจสอบ
        const wlSymbols = getWatchlistSymbols();

        // 📌 ฟังก์ชันดึงโลโก้ (เพิ่มการเช็คสถานะดาว)
        const getLogoHtml = (sym) => {
            const isStarred = wlSymbols.includes(sym);
            const logo1 = `https://assets.parqet.com/logos/symbol/${sym}?format=png`;
            const logo2 = `https://financialmodelingprep.com/image-stock/${sym}.png`;
            
            return `
            <div class="w-full flex flex-col items-center justify-center p-1 relative group" title="${sym}">
                ${isStarred ? '<span class="absolute -top-1.5 -right-0.5 text-[10px] text-yellow-500 drop-shadow-md z-10 animate-pulse">⭐</span>' : ''}
                
                <img src="${logo1}" 
                     class="h-[22px] w-auto max-w-full object-contain filter drop-shadow-md ${isStarred ? 'ring-1 ring-yellow-500/50 rounded-sm' : ''}" 
                     onerror="this.onerror=null; this.src='${logo2}'; this.onerror=function(){ this.style.display='none'; };">
                <span class="text-[8px] font-bold ${isStarred ? 'text-yellow-500' : 'text-slate-300'} text-center leading-tight mt-1">${sym}</span>
            </div>`;
        };

        let html = '';

        weekData.forEach((dayItems, index) => {
            const beforeOpen = dayItems.filter(i => i.hour === 'bmo');
            const afterClose = dayItems.filter(i => i.hour === 'amc' || i.hour === 'dmh');

            // 🚀 2. ปรับปรุงระบบคัดเลือก: หุ้นใน Watchlist ต้องได้ขึ้นก่อน ตัวท็อปที่เหลือตามมา
            const sortWithWatchlistPriority = (arr) => {
                // แยกกลุ่มหุ้นใน Watchlist ออกมา
                const starred = arr.filter(i => wlSymbols.includes(i.symbol));
                
                // กลุ่มหุ้นอื่นๆ เรียงตามรายได้คาดการณ์เหมือนเดิม
                const others = arr.filter(i => !wlSymbols.includes(i.symbol))
                                  .sort((a, b) => (b.revenueEstimate || 0) - (a.revenueEstimate || 0));
                
                // รวมร่าง: Watchlist ขึ้นก่อน -> ตามด้วยตัวท็อปอื่นๆ -> แล้วตัดเหลือ 6 ตัว
                return [...starred, ...others].slice(0, 6);
            };

            const topBefore = sortWithWatchlistPriority(beforeOpen);
            const topAfter = sortWithWatchlistPriority(afterClose);

            const colDate = new Date(currentCalWeekStart);
            colDate.setDate(colDate.getDate() + index);
            const dateNum = colDate.getDate();

            const realToday = new Date();
            const isToday = colDate.getDate() === realToday.getDate() && 
                            colDate.getMonth() === realToday.getMonth() && 
                            colDate.getFullYear() === realToday.getFullYear();

            const colHighlightClass = isToday ? 'highlight-today-col' : ''; 
            const dayTextClass = isToday ? 'text-success font-bold' : 'text-slate-400 font-medium';
            const numTextClass = isToday ? 'text-success' : 'text-white';

            html += `
            <div class="flex flex-col gap-[6px] h-full pt-1 px-0.5">
                <div class="text-center ${dayTextClass} text-[10px] py-1.5 border-b border-border-dark/50 whitespace-nowrap ${colHighlightClass}">
                    <span class="${numTextClass} font-bold">${dateNum}</span> ${dayNames[index]}
                </div>

                <div class="${isToday ? 'bg-surface-dark/80' : 'bg-surface-dark/60'} border border-border-dark/40 rounded-xl flex flex-col items-center pb-2 min-h-[160px] relative z-0">
                    <span class="text-slate-400 text-[8px] font-bold py-1.5 whitespace-nowrap">Before Open</span>
                    <div class="flex flex-col w-full px-1 gap-1.5">
                        ${topBefore.length > 0 ? topBefore.map(item => getLogoHtml(item.symbol)).join('') : '<span class="text-slate-600 text-[8px] text-center py-2">-</span>'}
                    </div>
                </div>

                <div class="${isToday ? 'bg-surface-dark/80' : 'bg-surface-dark/60'} border border-border-dark/40 rounded-xl flex flex-col items-center pb-2 min-h-[160px] relative z-0">
                    <span class="text-slate-400 text-[8px] font-bold py-1.5 whitespace-nowrap">After Close</span>
                    <div class="flex flex-col w-full px-1 gap-1.5">
                        ${topAfter.length > 0 ? topAfter.map(item => getLogoHtml(item.symbol)).join('') : '<span class="text-slate-600 text-[8px] text-center py-2">-</span>'}
                    </div>
                </div>
            </div>`;
        });

        gridContainer.innerHTML = html;
    };


    // 📌 กดเปลี่ยนสัปดาห์ (ซ้าย-ขวา)
    document.addEventListener('click', (e) => {
        const btnPrev = e.target.closest('#btn-prev-week');
        const btnNext = e.target.closest('#btn-next-week');

        if (btnPrev) {
            currentCalWeekStart.setDate(currentCalWeekStart.getDate() - 7);
            renderEarningsCalendar();
        }
        if (btnNext) {
            currentCalWeekStart.setDate(currentCalWeekStart.getDate() + 7);
            renderEarningsCalendar();
        }
    });

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
        renderEarningsCalendar();;
        fetchMarketAlerts();
        lastAlertFetchTime = Date.now();
    }, 500);

    setInterval(runMasterController, 60000);
});
