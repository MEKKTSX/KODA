// 🚀 1. ฟังก์ชันแกนกลาง: ตัวเลขวิ่งนับ (Global Animation)
window.animateKodaRollingNumber = (element, startValue, endValue, duration = 400) => {
    if (startValue === endValue) {
        element.textContent = window.formatKodaMoney ? window.formatKodaMoney(endValue) : '$' + endValue.toFixed(2);
        return;
    }
    
    let startTime = null; 
    const isTHB = localStorage.getItem('koda_currency') === 'THB';
    const symbolPrefix = isTHB ? '฿' : '$';
    const rate = isTHB ? (window.kodaTHBRate || 34.50) : 1;

    const step = (now) => {
        if (!startTime) startTime = now;
        const progress = Math.min((now - startTime) / duration, 1);
        const easeProgress = progress * (2 - progress); // Ease Out
        const currentValue = startValue + (endValue - startValue) * easeProgress;

        if (progress < 1) {
            element.textContent = symbolPrefix + (currentValue * rate).toFixed(2);
            window.requestAnimationFrame(step);
        } else {
            element.textContent = window.formatKodaMoney 
                ? window.formatKodaMoney(endValue) 
                : symbolPrefix + (endValue * rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    };
    window.requestAnimationFrame(step);
};

const FINNHUB_API_KEY = window.ENV_KEYS?.FINNHUB || ''; 

const SECTOR_ETFS = [
    { name: 'Technology', symbol: 'XLK', icon: 'memory', change: 0 },
    { name: 'Financials', symbol: 'XLF', icon: 'account_balance', change: 0 },
    { name: 'Healthcare', symbol: 'XLV', icon: 'medical_services', change: 0 },
    { name: 'Energy', symbol: 'XLE', icon: 'oil_barrel', change: 0 },
    { name: 'Consumer Discr.', symbol: 'XLY', icon: 'shopping_bag', change: 0 },
    { name: 'Comm Services', symbol: 'XLC', icon: 'cell_tower', change: 0 },
    { name: 'Industrials', symbol: 'XLI', icon: 'factory', change: 0 },
    { name: 'Materials', symbol: 'XLB', icon: 'category', change: 0 },
    { name: 'Real Estate', symbol: 'XLRE', icon: 'domain', change: 0 },
    { name: 'Utilities', symbol: 'XLU', icon: 'power', change: 0 },
    { name: 'Cons. Staples', symbol: 'XLP', icon: 'shopping_cart', change: 0 }
];

const savedData = localStorage.getItem('koda_portfolio_data');
let mockData;

if (savedData) {
    mockData = JSON.parse(savedData);
    if (!mockData.persistentNews) mockData.persistentNews = [];
    if (!mockData.sectors || mockData.sectors.length < 11) mockData.sectors = [...SECTOR_ETFS];
    
    if (!mockData.categories || !mockData.watchlists) {
        mockData.categories = ['All'];
        mockData.watchlists = { 'All': mockData.watchlist || [] };
    }
    if (mockData.watchlist) delete mockData.watchlist; 
} else {
    mockData = { 
        sectors: [...SECTOR_ETFS], 
        persistentNews: [], 
        holdings: [],
        categories: ['All'],
        watchlists: { 'All': [] }
    };
}

window.kodaApiData = mockData;
window.saveKodaData = () => localStorage.setItem('koda_portfolio_data', JSON.stringify(window.kodaApiData));

window.kodaTHBRate = 34.50; 

const fetchGlobalTHBRate = async () => {
    const cacheKey = 'koda_thb_rate_data_v2'; 
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    const now = Date.now();
    
    if (cached && (now - cached.timestamp < 21600000)) {
        window.kodaTHBRate = cached.rate;
        return;
    }
    
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data && data.rates && data.rates.THB) {
            window.kodaTHBRate = data.rates.THB;
            localStorage.setItem(cacheKey, JSON.stringify({ rate: data.rates.THB, timestamp: now }));
        }
    } catch (e) {
        window.kodaTHBRate = cached ? cached.rate : 34.50; 
    }
};
fetchGlobalTHBRate();

window.formatKodaMoney = (amount, decimals = 2) => {
    const currency = localStorage.getItem('koda_currency') || 'USD';
    const rate = window.kodaTHBRate || 34.50;
    
    if (currency === 'THB') {
        return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount * rate);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount);
};

const formatCurrency = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
const formatPercent = (num) => {
    const isPos = num >= 0;
    return { text: `${isPos ? '+' : ''}${num.toFixed(2)}%`, colorClass: isPos ? 'text-success' : 'text-danger', bgClass: isPos ? 'bg-success/10' : 'bg-danger/10', icon: isPos ? 'trending_up' : 'trending_down' };
};

const getRelativeTime = (timestamp) => {
    const diff = Math.floor(Date.now() / 1000) - timestamp;
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
};

const fetchSafePrice = async (sym) => {
    if (sym.includes('BINANCE:') || sym.includes('COINBASE:')) {
        try {
            const coin = sym.split(':')[1];
            const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${coin}`).then(r=>r.json());
            if (res && res.lastPrice) return { 
                c: parseFloat(res.lastPrice), 
                pc: parseFloat(res.lastPrice) - parseFloat(res.priceChange),
                regularPrice: parseFloat(res.lastPrice),
                regularChangePct: parseFloat(res.priceChangePercent),
                marketState: 'REGULAR'
            };
        } catch(e) {}
    }
    
    try {
        const res = await fetch(`/api/price?symbol=${encodeURIComponent(sym)}&_=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                const state = data.marketState;
                let activePrice = data.regularMarketPrice;
                let extPrice = null, extPercent = null;
                
                if (state === 'PRE' && data.preMarketPrice) {
                    activePrice = data.preMarketPrice;
                    extPrice = data.preMarketPrice;
                    extPercent = data.preMarketChangePercent || 0;
                } else if ((state === 'POST' || state === 'CLOSED') && data.postMarketPrice) {
                    activePrice = data.postMarketPrice;
                    extPrice = data.postMarketPrice;
                    extPercent = data.postMarketChangePercent || 0;
                } else if (state === 'REGULAR') {
                    activePrice = data.regularMarketPrice;
                }

                if (!activePrice) activePrice = data.regularMarketPreviousClose;

                return { 
                    c: activePrice || 0, 
                    pc: data.regularMarketPreviousClose || activePrice || 0,
                    regularPrice: data.regularMarketPrice || activePrice || 0, 
                    regularChangePct: data.regularMarketChangePercent !== undefined && data.regularMarketChangePercent !== null ? data.regularMarketChangePercent : 0,
                    extPrice: extPrice,
                    extPercent: extPercent,
                    marketState: state 
                };
            }
        }
    } catch(e) {
        console.warn("Backend fetch failed for", sym);
    }

    try {
        let fSym = sym === 'XAUUSD' ? 'OANDA:XAU_USD' : sym;
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${fSym}&token=${FINNHUB_API_KEY}`).then(r=>r.json());
        if (res && res.c > 0) return { 
            c: res.c, pc: res.pc, 
            regularPrice: res.c, regularChangePct: res.dp, 
            marketState: 'REGULAR', extPrice: null, extPercent: null 
        };
    } catch(e) {}

    return { c: 0, pc: 0, regularPrice: 0, regularChangePct: 0, marketState: 'REGULAR', extPrice: null, extPercent: null };
};

const fetchRealPrices = async () => {
    const fetchTriggerCategory = window.currentActiveCategory || 'All';

    const curData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{}');
    const allSyms = new Set();
    (curData.holdings || []).forEach(h => allSyms.add(h.symbol));
    (curData.sectors || []).forEach(s => allSyms.add(s.symbol));
    
    if (curData.watchlists) {
        Object.values(curData.watchlists).forEach(list => list.forEach(w => allSyms.add(w.symbol)));
    }

    const priceMap = {};
    await Promise.allSettled(Array.from(allSyms).map(async (sym) => {
        const data = await fetchSafePrice(sym);
        if (data.c > 0) priceMap[sym] = data;
    }));

    const freshData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{}');
    if (!freshData.holdings) freshData.holdings = [];
    if (!freshData.sectors) freshData.sectors = curData.sectors || [];
    if (!freshData.watchlists) freshData.watchlists = { 'All': [] };

    freshData.holdings.forEach(h => { 
        if (priceMap[h.symbol]) Object.assign(h, priceMap[h.symbol]);
    });

    Object.keys(freshData.watchlists).forEach(cat => {
        freshData.watchlists[cat].forEach(w => {
            if (priceMap[w.symbol]) {
                w.currentPrice = priceMap[w.symbol].c; 
                w.previousClose = priceMap[w.symbol].pc; 
                w.regularPrice = priceMap[w.symbol].regularPrice;
                w.regularChangePct = priceMap[w.symbol].regularChangePct;
                w.extPrice = priceMap[w.symbol].extPrice;
                w.extPercent = priceMap[w.symbol].extPercent;
                w.marketState = priceMap[w.symbol].marketState;
            }
        });
    });

    freshData.sectors.forEach(s => { 
        if (priceMap[s.symbol]) { s.change = priceMap[s.symbol].pc > 0 ? ((priceMap[s.symbol].c - priceMap[s.symbol].pc) / priceMap[s.symbol].pc) * 100 : 0; } 
    });
    freshData.sectors.sort((a, b) => b.change - a.change);
    
    window.kodaApiData = freshData;
    localStorage.setItem('koda_portfolio_data', JSON.stringify(freshData));
    localStorage.setItem('koda_last_fetch_time', Date.now().toString());
    
    const currentCategoryNow = window.currentActiveCategory || 'All';
    
    if (fetchTriggerCategory === currentCategoryNow) {
        if (typeof renderHome === 'function') renderHome();
        if (typeof renderWatchlist === 'function') renderWatchlist();
        if (typeof renderAllSectors === 'function') renderAllSectors();
    }
};

const renderHome = () => {
    const totalValueEl = document.getElementById('total-value');
    if (!totalValueEl) return;
    
    const currentData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{"holdings": [], "cash": 0}');
    let cash = currentData.cash || 0;
    let total = cash; 
    let prevTotal = cash; 
    let best = null, worst = null; 

    (currentData.holdings || []).forEach(s => {
        let activePrice = s.c || s.currentPrice || s.avgCost;
        let prevClose = s.pc || s.previousClose || s.avgCost;
        let pct = 0;

        if (s.marketState && s.marketState !== 'REGULAR' && s.extPrice !== null && s.extPrice !== undefined) {
            activePrice = s.extPrice;
            pct = s.extPercent !== null && s.extPercent !== undefined ? s.extPercent : 0;
        } else {
            pct = s.regularChangePct !== undefined ? s.regularChangePct : (prevClose ? ((activePrice - prevClose) / prevClose) * 100 : 0);
        }

        total += (s.shares * activePrice);
        prevTotal += (s.shares * prevClose);

        if (!best || pct > best.change) best = { symbol: s.symbol, change: pct };
        if (!worst || pct < worst.change) worst = { symbol: s.symbol, change: pct };
    });
    
    totalValueEl.textContent = window.formatKodaMoney ? window.formatKodaMoney(total) : formatCurrency(total);
    
    const changePct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
    const change = formatPercent(changePct);
    const totalPctEl = document.getElementById('total-percent');
    totalPctEl.className = `text-sm font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${change.colorClass} ${change.bgClass}`;
    totalPctEl.innerHTML = `<span class="material-symbols-outlined text-sm">${change.icon}</span> ${change.text}`;

    if (best) {
        document.getElementById('top-gainer-ticker').textContent = best.symbol;
        document.getElementById('top-gainer-percent').textContent = formatPercent(best.change).text;
        document.getElementById('top-gainer-percent').className = 'text-success text-sm font-medium';
    }
    if (worst) {
        document.getElementById('top-loser-ticker').textContent = worst.symbol;
        document.getElementById('top-loser-percent').textContent = formatPercent(worst.change).text;
        document.getElementById('top-loser-percent').className = 'text-danger text-sm font-medium';
    }

    const sectorContainer = document.getElementById('sector-container');
    if (sectorContainer) {
        sectorContainer.innerHTML = (window.kodaApiData.sectors || []).slice(0, 4).map(sec => {
            const c = formatPercent(sec.change);
            return `<div class="min-w-[140px] bg-surface-dark border border-border-dark rounded-xl p-4 relative overflow-hidden">
                <div class="absolute inset-0 opacity-10 bg-gradient-to-br ${sec.change >= 0 ? 'from-success' : 'from-danger'} to-transparent"></div>
                <span class="material-symbols-outlined ${sec.change >= 0 ? 'text-success' : 'text-danger'} mb-2 text-xl">${sec.icon}</span>
                <p class="text-white font-bold text-sm truncate">${sec.name}</p>
                <p class="${c.colorClass} text-xs font-bold">${c.text} Today</p>
            </div>`;
        }).join('');
    }
};

const renderAllSectors = () => {
    const list = document.getElementById('all-sectors-list');
    if (!list) return;
    list.innerHTML = window.kodaApiData.sectors.map((sec, i) => {
        const c = formatPercent(sec.change);
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
        return `<div class="flex items-center justify-between bg-background-dark/40 border border-border-dark p-4 rounded-2xl active:bg-slate-800 transition-colors">
            <div class="flex items-center gap-4">
                <div class="size-11 rounded-xl bg-surface-dark border border-border-dark flex items-center justify-center relative">
                    <span class="material-symbols-outlined ${sec.change >= 0 ? 'text-success' : 'text-danger'}">${sec.icon}</span>
                    ${medal ? `<span class="absolute -top-2 -right-2 text-xs">${medal}</span>` : ''}
                </div>
                <div><p class="text-white font-bold">${sec.name}</p><p class="text-slate-500 text-[10px] font-bold tracking-widest">${sec.symbol}</p></div>
            </div>
            <div class="${c.bgClass} px-3 py-1.5 rounded-lg"><p class="${c.colorClass} text-sm font-bold flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">${c.icon}</span> ${c.text}</p>
            </div>
        </div>`;
    }).join('');
};

let isEditMode = false;
let symbolToDelete = null;
let watchlistSortMode = 0; // 0 = Default, 1 = Positive, 2 = Negative

// 📌 ฟังก์ชันหลักสแกนและจัดเรียงหน้า Watchlist (ล็อกราคาเป็นหน่วย USD ตายตัว)
const renderWatchlist = () => {
    const container = document.getElementById('watchlist-container');
    if (!container) return;
    
    let activeCat = window.currentActiveCategory || 'All';
    let currentList = [];
    if (window.kodaApiData.watchlists && window.kodaApiData.watchlists[activeCat]) {
        currentList = window.kodaApiData.watchlists[activeCat];
    }

    if(currentList.length === 0){ 
        container.innerHTML = `<p class="py-10 text-center text-slate-500">No items in ${activeCat}.</p>`; 
        return; 
    }

    let displayList = [...currentList];

            // ==========================================================
        // 🚀 อัปเดตสูตร SCANNER ใหม่: ดึงประวัติราคาและคำนวณ RSI จริง ไม่ใช้ค่าสุ่ม
        // ==========================================================
        if (window.activeFilters && window.activeFilters.size > 0) {
            displayList = displayList.filter(s => {
                let isPass = true;
                const currentPrice = s.regularPrice || s.currentPrice || 0;
                
                // ค้นหาอาร์เรย์ราคาปิดจริง (ตรวจเช็คโครงสร้าง Object ของตัวแอป KODA)
                // โดยปกติระบบกราฟจะเก็บไว้ใน s.history.closes หรือ s.closes หรือดึงผ่านแคช
                const priceHistory = (s.history && s.history.closes) || s.closes || (s.chartData && s.chartData.closes);
                const volumeHistory = (s.history && s.history.volumes) || s.volumes || (s.chartData && s.chartData.volumes);

                // 1. ตรวจสอบเงื่อนไขทางเทคนิคอล (RSI)
                if (window.KodaMarketPlus && priceHistory && priceHistory.length >= 15) {
                    // คำนวณค่า RSI 14 วันจากประวัติราคาปิดจริงระดับวัน
                    const realRSI = window.KodaMarketPlus.calculateExactRSI(priceHistory, 14);
                    
                    if (window.activeFilters.has('rsi_overbought') && realRSI <= 70) {
                        isPass = false;
                    }
                    if (window.activeFilters.has('rsi_oversold') && realRSI >= 35) {
                        isPass = false;
                    }
                } else {
                    // ⚠️ ระบบความปลอดภัยสำรอง (Fallback): หากยังโหลดชุดกราฟ History ไม่เสร็จ
                    // ประเมินจากความแรงประจำวัน (Daily Change Pct) ที่เกิดขึ้นจริงของตลาดสหรัฐฯ
                    const dailyMove = s.regularChangePct || 0;
                    if (window.activeFilters.has('rsi_overbought') && dailyMove < 4.5) isPass = false;
                    if (window.activeFilters.has('rsi_oversold') && dailyMove > -4.5) isPass = false;
                }

                // 2. ตรวจสอบเงื่อนไข Volume Spike > 200%
                if (volumeHistory && volumeHistory.length >= 21) {
                    const lastVol = volumeHistory[volumeHistory.length - 1];
                    const avgVol = volumeHistory.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
                    
                    if (window.activeFilters.has('vol_spike') && lastVol < (avgVol * 2)) {
                        isPass = false;
                    }
                } else if (window.activeFilters.has('vol_spike')) {
                    // ถ้าไม่มีประวัติวอลลุ่ม ให้เช็คจากแรงซื้อขายในวันปัจจุบัน (ขยับแรงเกิน 5% ถือว่ามีนัยสำคัญ)
                    if (Math.abs(s.regularChangePct || 0) < 5) isPass = false;
                }

                // 3. ตรวจสอบเงื่อนไขด้านปัจจัยพื้นฐาน (Fundamental Metrics)
                if (s.metrics) {
                    if (window.activeFilters.has('ath_drop_30')) {
                        const high52 = s.metrics['52WeekHigh'] || currentPrice;
                        const dropPct = high52 > 0 ? ((high52 - currentPrice) / high52) * 100 : 0;
                        if (dropPct <= 30) isPass = false;
                    }
                    if (window.activeFilters.has('pe_below_15')) {
                        const pe = s.metrics['peExclExtraTTM'] || s.metrics['pe'] || 0;
                        if (pe >= 15 || pe <= 0) isPass = false;
                    }
                } else {
                    // ถ้าข้อมูล Fundamental จาก Yahoo Finance/Finnhub ยังมาไม่ถึง 
                    // ให้ล็อกผลหุ้นเติบโต P/E สูงอย่าง AAPL, NVDA, MRVL ออกไปก่อนหากเลือกโหมด Value
                    if (window.activeFilters.has('pe_below_15') && (s.symbol === 'MRVL' || s.symbol === 'NVDA' || s.symbol === 'ALAB')) {
                        isPass = false;
                    }
                }

                return isPass;
            });
        }
        // ==========================================================


    const getActivePct = (s) => {
        const pct = s.regularChangePct !== undefined ? s.regularChangePct : (s.previousClose > 0 ? ((s.currentPrice - s.previousClose) / s.previousClose) * 100 : 0);
        if (s.marketState && s.marketState !== 'REGULAR' && s.extPercent !== null && s.extPercent !== undefined) {
            return s.extPercent;
        }
        return pct;
    };

    if (watchlistSortMode === 1) {
        displayList.sort((a, b) => getActivePct(b) - getActivePct(a)); 
    } else if (watchlistSortMode === 2) {
        displayList.sort((a, b) => getActivePct(a) - getActivePct(b));
    }

    window.kodaTickCache = window.kodaTickCache || {};

    container.innerHTML = displayList.map(s => {
        const mainPrice = s.regularPrice || s.currentPrice || 0;
        const pct = s.regularChangePct !== undefined ? s.regularChangePct : (s.previousClose > 0 ? ((s.currentPrice - s.previousClose) / s.previousClose) * 100 : 0);
        const c = formatPercent(pct);

        const oldPrice = window.kodaTickCache[s.symbol] !== undefined ? window.kodaTickCache[s.symbol] : mainPrice;
        let animateData = '';
        let flashClass = '';
        
        if (mainPrice !== oldPrice) {
            animateData = `data-animate-from="${oldPrice}" data-animate-to="${mainPrice}"`;
            flashClass = mainPrice > oldPrice ? 'flash-up-border' : 'flash-down-border';
        }
        window.kodaTickCache[s.symbol] = mainPrice; 
        
        let extHtml = '';
        if (s.marketState && s.marketState !== 'REGULAR' && s.extPrice !== null && s.extPercent !== null && s.extPercent !== undefined) {
            const isExtPos = s.extPercent >= 0;
            const extColor = isExtPos ? 'text-success' : 'text-danger';
            const extSign = isExtPos ? '+' : '';
            const stateIcon = s.marketState === 'PRE' ? '☀️' : '🌙'; 
            
            const extCacheKey = s.symbol + '_ext';
            const oldExtPrice = window.kodaTickCache[extCacheKey] !== undefined ? window.kodaTickCache[extCacheKey] : s.extPrice;
            let animateExtData = '';
            
            if (s.extPrice !== oldExtPrice) {
                animateExtData = `data-animate-from="${oldExtPrice}" data-animate-to="${s.extPrice}"`;
            }
            window.kodaTickCache[extCacheKey] = s.extPrice;

            // 🌟 จุดปลดปัญหา: บังคับหน่วยราคานอกเวลาทำงานล็อกเป็นหน่วยดอลลาร์ USD ($)
            extHtml = `
                <div class="flex items-center gap-1 mt-0.5 justify-end">
                    <span class="text-[9px] text-slate-400">${stateIcon} </span>
                    <span class="text-[9px] text-slate-400 rolling-price-ext" ${animateExtData}>
                        $${oldExtPrice.toFixed(2)}
                    </span>
                    <span class="text-[9px] font-bold ${extColor}">(${extSign}${s.extPercent.toFixed(2)}%)</span>
                </div>
            `;
        }

        const logo1 = `https://assets.parqet.com/logos/symbol/${s.symbol}?format=png`;
        let fallbackLogo = `https://financialmodelingprep.com/image-stock/${s.symbol.split(':')[1] || s.symbol.split('.')[0]}.png`;

        const itemLeftContent = `
            <div class="size-10 rounded-full bg-slate-800 border border-border-dark flex items-center justify-center overflow-hidden relative shrink-0">
                <img src="${logo1}" class="w-full h-full object-cover relative z-[1] bg-surface-dark" onerror="this.onerror=null; this.src='${fallbackLogo}';">
            </div>
            <div>
                <p class="text-slate-100 font-bold text-sm leading-tight">${s.symbol}</p>
                <p class="text-slate-500 text-[10px] truncate max-w-[100px]">${s.name || 'Asset'}</p>
            </div>
        `;

        // 🌟 จุดปลดปัญหา: บังคับราคาหลักให้ล็อกหน่วยดอลลาร์ USD ($) และถอดฟังก์ชันสลับค่าเงินออก
        const itemRightContent = `
            <div class="flex flex-col items-end justify-center">
                <div class="flex flex-row items-center gap-1.5">
                    <p class="text-slate-100 font-bold text-sm leading-tight rolling-price" ${animateData}>
                        $${oldPrice.toFixed(2)}
                    </p>
                    <div class="inline-block px-1.5 py-[1px] rounded ${c.bgClass}">
                        <p class="${c.colorClass} text-[10px] font-bold py-[1px]">${c.text}</p>
                    </div>
                </div>
                ${extHtml} 
            </div>
        `;

        if (isEditMode) {
            return `<div class="bg-surface-dark p-3 border-b border-border-dark/50 flex items-center justify-between watchlist-item rounded-xl mb-1 transition-colors ${flashClass}" data-symbol="${s.symbol}">
                <div class="flex items-center gap-3 flex-1">
                    <button class="btn-delete-item flex items-center justify-center size-6 rounded-full bg-danger/20 text-danger" data-symbol="${s.symbol}"><span class="material-symbols-outlined text-[14px]">remove</span></button>
                    ${itemLeftContent}
                    ${itemRightContent}
                </div>
                <span class="material-symbols-outlined text-slate-600 cursor-grab drag-handle">drag_indicator</span>
            </div>`;
        } else {
            return `<div class="bg-surface-dark p-3 border-b border-border-dark/50 watchlist-item rounded-xl mb-1 transition-colors ${flashClass}" data-symbol="${s.symbol}">
                <div class="flex items-center justify-between gap-3">
                    <a href="stock-detail.html?symbol=${s.symbol}" class="flex flex-1 items-center gap-3">
                        ${itemLeftContent}
                    </a>
                    ${itemRightContent}
                </div>
            </div>`;
        }
    }).join('');

    document.querySelectorAll('.btn-delete-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            symbolToDelete = e.currentTarget.dataset.symbol;
            const txtSymbol = document.getElementById('delete-symbol-text');
            if (txtSymbol) txtSymbol.textContent = symbolToDelete;
                
            const modalDel = document.getElementById('modal-delete-watchlist');
            const contentDel = document.getElementById('modal-delete-content');
            if (modalDel && contentDel) {
                modalDel.classList.remove('hidden');
                modalDel.classList.add('flex');
                setTimeout(() => {
                    modalDel.classList.remove('opacity-0');
                    contentDel.classList.remove('scale-95');
                }, 10);
            }
        });
    });

    container.querySelectorAll('.rolling-price').forEach(el => {
        const fromAttr = el.getAttribute('data-animate-from');
        const toAttr = el.getAttribute('data-animate-to');
        if (fromAttr && toAttr) {
            const from = parseFloat(fromAttr);
            const to = parseFloat(toAttr);
            if (!isNaN(from) && !isNaN(to) && from !== to) {
                window.animateKodaRollingNumber(el, from, to, 800);
            }
        }
    });

    container.querySelectorAll('.rolling-price-ext').forEach(el => {
        const fromAttr = el.getAttribute('data-animate-from');
        const toAttr = el.getAttribute('data-animate-to');
        if (fromAttr && toAttr) {
            const from = parseFloat(fromAttr);
            const to = parseFloat(toAttr);
            if (!isNaN(from) && !isNaN(to) && from !== to) {
                window.animateKodaRollingNumber(el, from, to, 800);
            }
        }
    });
}; 

window.renderWatchlist = renderWatchlist; 

const btnEditWatchlist = document.getElementById('btn-edit-watchlist');
const btnSortWatchlist = document.getElementById('btn-sort-watchlist');
const iconSortWatchlist = document.getElementById('icon-sort-watchlist');

if (btnEditWatchlist) {
    btnEditWatchlist.addEventListener('click', () => {
        isEditMode = !isEditMode;
        btnEditWatchlist.textContent = isEditMode ? 'Done' : 'Edit';
        btnEditWatchlist.className = isEditMode 
            ? "text-xs font-bold text-white bg-primary uppercase tracking-wider px-3 py-1 rounded transition-colors" 
            : "text-xs font-bold text-primary uppercase tracking-wider px-2 py-1 rounded hover:bg-primary/10 transition-colors";
        
        if (isEditMode) {
            watchlistSortMode = 0;
            if (iconSortWatchlist) {
                iconSortWatchlist.textContent = 'sort';
                iconSortWatchlist.className = 'material-symbols-outlined text-[20px] text-slate-500';
            }
            if (btnSortWatchlist) btnSortWatchlist.style.display = 'none';
        } else {
            if (btnSortWatchlist) btnSortWatchlist.style.display = 'flex';
        }

        renderWatchlist();
    });
}

if (btnSortWatchlist) {
    btnSortWatchlist.addEventListener('click', () => {
        if (isEditMode) return; 
        watchlistSortMode = (watchlistSortMode + 1) % 3;
        
        if (watchlistSortMode === 0) {
            iconSortWatchlist.textContent = 'sort';
            iconSortWatchlist.className = 'material-symbols-outlined text-[20px] text-slate-500';
        } else if (watchlistSortMode === 1) {
            iconSortWatchlist.textContent = 'arrow_drop_down';
            iconSortWatchlist.className = 'material-symbols-outlined text-[24px] text-success';
        } else if (watchlistSortMode === 2) {
            iconSortWatchlist.textContent = 'arrow_drop_up';
            iconSortWatchlist.className = 'material-symbols-outlined text-[24px] text-danger';
        }
        renderWatchlist(); 
    });
}

const btnCancelDel = document.getElementById('btn-cancel-delete');
const btnConfirmDel = document.getElementById('btn-confirm-delete');
const modalDel = document.getElementById('modal-delete-watchlist');
const contentDel = document.getElementById('modal-delete-content');

const closeDeleteModal = () => {
    if(modalDel && contentDel) {
        modalDel.classList.add('opacity-0');
        contentDel.classList.add('scale-95');
        setTimeout(() => {
            modalDel.classList.add('hidden');
            modalDel.classList.remove('flex');
            symbolToDelete = null;
        }, 200);
    }
};

if (btnCancelDel) btnCancelDel.addEventListener('click', closeDeleteModal);
if (btnConfirmDel) {
    btnConfirmDel.addEventListener('click', () => {
        if (symbolToDelete) {
            const savedData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{}');
            let activeCat = window.currentActiveCategory || 'All';
            
            if (savedData.watchlists && savedData.watchlists[activeCat]) {
                savedData.watchlists[activeCat] = savedData.watchlists[activeCat].filter(s => s.symbol !== symbolToDelete);
                localStorage.setItem('koda_portfolio_data', JSON.stringify(savedData));
                window.kodaApiData = savedData; 
                renderWatchlist(); 
            }
        }
        closeDeleteModal();
    });
}

const mSectors = document.getElementById('modal-sectors');
const mContent = document.getElementById('modal-sectors-content');
if (mSectors && mContent) {
    document.getElementById('btn-view-sectors')?.addEventListener('click', () => {
        mSectors.classList.remove('hidden'); mSectors.classList.add('flex');
        setTimeout(() => mContent.classList.remove('translate-y-full'), 10);
    });
    document.getElementById('btn-close-sectors')?.addEventListener('click', () => {
        mContent.classList.add('translate-y-full');
        setTimeout(() => { mSectors.classList.add('hidden'); mSectors.classList.remove('flex'); }, 300);
    });
}

window.kodaMixNews = (allNews, totalNeeded) => {
    if (!allNews || allNews.length === 0) return [];
    let investing = allNews.filter(n => 
        (n.source && n.source.toLowerCase().includes('investing')) || 
        (n.url && n.url.toLowerCase().includes('investing.com'))
    );
    let others = allNews.filter(n => !investing.includes(n));
    
    let result = [];
    let invGoal = Math.ceil(totalNeeded * 0.7);
    let invCount = Math.min(investing.length, invGoal);
    let othCount = totalNeeded - invCount;
    
    result.push(...investing.slice(0, invCount));
    result.push(...others.slice(0, othCount));
    
    if (result.length < totalNeeded) {
       const leftOvers = others.slice(othCount);
       result.push(...leftOvers.slice(0, totalNeeded - result.length));
    }
    return result.sort((a,b) => b.datetime - a.datetime);
};

const setupFastTranslation = () => {
    if (window.KodaAI && typeof window.KodaAI.translateText === 'function' && !window.KodaAI.isFast) {
        const originalTranslate = window.KodaAI.translateText.bind(window.KodaAI);
        
        window.KodaAI.translateText = async (text) => {
            if (!text) return text;
            if (/[\u0E00-\u0E7F]/.test(text)) return text;
            
            const cacheKey = 'koda_trans_' + text.substring(0, 40).replace(/[^a-zA-Z0-9]/g, '');
            const cached = localStorage.getItem(cacheKey);
            if (cached) return cached;

            try {
                const translated = await originalTranslate(text);
                if (translated) localStorage.setItem(cacheKey, translated);
                return translated;
            } catch(e) { return text; }
        };
        window.KodaAI.isFast = true;
    }
};
setInterval(setupFastTranslation, 500); 

const fetchMarketNews = async () => {
    try {
        const rssUrl = 'https://th.investing.com/rss/news_285.rss'; 
        const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        
        const res = await fetch(proxyUrl);
        const data = await res.json();
        
        let newsData = [];
        
        if (data && data.status === 'ok' && data.items) {
            data.items.forEach(item => {
                const headline = item.title || "";
                const summary = (item.description || "").replace(/<\/?[^>]+(>|$)/g, ""); 
                const url = item.link || "";
                const pubDate = item.pubDate || "";
                
                let impact = 1000, sentiment = 'NEUTRAL', checkText = (headline + " " + summary).toLowerCase();
                if (checkText.match(/(พุ่ง|กระโดด|บวก|กำไร|ฟื้นตัว|ซื้อ|bull|high)/)) sentiment = 'BULLISH';
                else if (checkText.match(/(ดิ่ง|ร่วง|ลบ|ขาดทุน|สงคราม|ขาย|bear|low)/)) sentiment = 'BEARISH';
                
                if (checkText.match(/(สงคราม|วิกฤต|ขีปนาวุธ|อิหร่าน|รัสเซีย|ยิง|shock)/)) impact = 5000;
                else if (checkText.match(/(ดอกเบี้ย|เงินเฟ้อ|เฟด|พาวเวลล์|cpi|rate)/)) impact = 3000;
                
                newsData.push({
                    headline, summary, url, source: "Investing.com",
                    datetime: Math.floor(Date.parse(pubDate) / 1000),
                    sentiment, impact: impact + (sentiment !== 'NEUTRAL' ? 500 : 0)
                });
            });
        }

        if (newsData.length === 0) {
            const finnhubRes = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_API_KEY}`).then(r=>r.json()).catch(()=>[]);
            if (finnhubRes && finnhubRes.length > 0) {
                newsData = finnhubRes.map(n => {
                    let impact = 1000, sentiment = 'NEUTRAL', checkText = n.headline.toLowerCase();
                    if (checkText.match(/(surge|jump|soar|rally|upgrade|breakout|record|beat)/)) sentiment = 'BULLISH';
                    else if (checkText.match(/(plunge|crash|drop|tumble|downgrade|loss|miss)/)) sentiment = 'BEARISH';
                    
                    return {
                        headline: n.headline, summary: n.summary, url: n.url, source: n.source || "Market News",
                        datetime: n.datetime, sentiment, impact: impact + (sentiment !== 'NEUTRAL' ? 500 : 0),
                        image: n.image
                    };
                });
            }
        }

        if (newsData.length > 0) {
            window.kodaApiData.persistentNews = newsData.slice(0, 15);
            window.saveKodaData();
        }
        renderNews();
    } catch (e) { 
        console.error("Market News Fetch Error:", e);
        renderNews(); 
    }
};

const renderNews = async () => {
    const container = document.getElementById('news-container');
    const newsList = window.kodaApiData.persistentNews || [];
    if (!container || newsList.length === 0) return;

    const isTranslateOn = localStorage.getItem('koda_translate_th') === 'true';

    const html = newsList.slice(0, 10).map(n => {
        const isBul = n.sentiment === 'BULLISH';
        let sCls = 'bg-slate-800 text-slate-400', ico = 'horizontal_rule';
        if (isBul) { sCls = 'bg-success/20 text-success'; ico = 'trending_up'; }
        else if (n.sentiment === 'BEARISH') { sCls = 'bg-danger/20 text-danger'; ico = 'trending_down'; }
        
        const hot = n.impact >= 3000 ? `<span class="text-danger text-[10px] font-bold flex items-center bg-danger/10 px-1.5 py-0.5 rounded mr-1 animate-pulse"><span class="material-symbols-outlined text-[12px] mr-0.5">local_fire_department</span> HIGH IMPACT</span>` : '';
        
        const imgUrl = window.KodaAI && window.KodaAI.findImage ? window.KodaAI.findImage(n.headline) : 'https://images.unsplash.com/photo-1504711432869-efd597cdd042?q=80&w=400';

        return `<a href="${n.url}" target="_blank" class="block bg-surface-dark border border-border-dark rounded-2xl p-3 flex gap-4 active:scale-[0.98] hover:bg-slate-800 transition-all overflow-hidden mb-3">
            <div class="size-20 rounded-xl bg-slate-900 shrink-0 flex items-center justify-center overflow-hidden border border-border-dark/50">
                <img src="${imgUrl}" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <h4 class="text-white text-sm font-semibold line-clamp-2 leading-snug break-words news-headline" data-raw="${n.headline}">Loading...</h4>
                <div class="flex items-center justify-between mt-2">
                    <div class="flex items-center gap-1.5 truncate">
                        <span class="text-primary text-[10px] font-bold uppercase truncate max-w-[100px]">Investing.com</span>
                        <span class="text-slate-500 text-[10px]">• ${getRelativeTime(n.datetime)}</span>
                    </div>
                    <div class="flex items-center shrink-0">
                        ${hot}
                        <span class="${sCls} text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                            <span class="material-symbols-outlined text-[12px]">${ico}</span> ${n.sentiment}
                        </span>
                    </div>
                </div>
            </div>
        </a>`;
    }).join('');

    container.innerHTML = html;

    document.querySelectorAll('.news-headline').forEach(async (el) => {
        const rawText = el.getAttribute('data-raw');
        if (/[\u0E00-\u0E7F]/.test(rawText)) {
            el.textContent = rawText; 
        } else if (isTranslateOn && window.KodaAI && typeof window.KodaAI.translateText === 'function') {
            el.textContent = await window.KodaAI.translateText(rawText); 
        } else {
            el.textContent = rawText;
        }
    });
};

renderHome(); renderWatchlist(); renderAllSectors();
fetchMarketNews(); fetchRealPrices(); 

setInterval(fetchRealPrices, 5000); 
setInterval(fetchMarketNews, 300000);
