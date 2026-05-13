document.addEventListener('DOMContentLoaded', () => {
    
    const FINNHUB_API_KEY = window.ENV_KEYS?.FINNHUB || '';

    const searchHTML = `
    <div id="koda-search-modal" class="fixed inset-0 z-[100] hidden bg-background-dark/95 backdrop-blur-md flex-col opacity-0 transition-opacity duration-200">
        <div class="p-4 pt-6 flex items-center gap-3 border-b border-border-dark bg-surface-dark/50">
            <span class="material-symbols-outlined text-slate-400">search</span>
            <input type="text" id="koda-search-input" class="flex-1 bg-transparent border-none text-white focus:ring-0 placeholder-slate-500 text-lg outline-none" placeholder="Search Stocks, Crypto, Forex, ETF..." autocomplete="off">
            <button id="koda-search-close" class="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors active:scale-90">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
        <div id="koda-search-results" class="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar pb-20"></div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', searchHTML);

    const searchModal  = document.getElementById('koda-search-modal');
    const searchInput  = document.getElementById('koda-search-input');
    const searchResults = document.getElementById('koda-search-results');
    const searchClose  = document.getElementById('koda-search-close');

    // ฟังก์ชันช่วย fetch แบบมี Timeout
    const fetchWithTimeout = (url, ms = 4500) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    };

    let dynamicTrending = [];

    // 🚀 ฟังก์ชันดึง Top 10 Trending & Top Performance
    const fetchTrendingAssets = async () => {
        // ใช้ Session Cache (5 นาที) เพื่อไม่ให้โหลด API พร่ำเพรื่อ
        const cacheStr = sessionStorage.getItem('koda_trending_assets');
        if (cacheStr) {
            const cacheData = JSON.parse(cacheStr);
            if (Date.now() - cacheData.ts < 5 * 60 * 1000) {
                dynamicTrending = cacheData.data;
                return dynamicTrending;
            }
        }

        let symbols = ['NVDA', 'TSLA', 'AAPL', 'AMD', 'PLTR', 'MSTR', 'META', 'AMZN', 'COIN', 'BTC-USD'];
        
        try {
            // 1. ดึง 10 อันดับที่คนสนใจมากที่สุด (Trending) จาก Yahoo Finance
            const trendRes = await fetchWithTimeout('/api/yahoo?mode=trending', 3000);
            const trendData = await trendRes.json();
            if (trendData?.finance?.result?.[0]?.quotes) {
                const fetchedSymbols = trendData.finance.result[0].quotes.map(q => q.symbol);
                if (fetchedSymbols.length > 0) symbols = fetchedSymbols;
            }
        } catch (e) {}

        try {
            // 2. ดึงราคาและ % เปลี่ยนแปลง เพื่อเอามาจัดอันดับ
            const quoteUrl = `/api/yahoo?mode=quote&symbols=${symbols.join(',')}`;
            const quoteRes = await fetchWithTimeout(quoteUrl, 4000);
            const quoteData = await quoteRes.json();

            if (quoteData?.quoteResponse?.result) {
                let results = quoteData.quoteResponse.result.map(q => ({
                    displaySymbol: q.symbol === 'BTC-USD' ? 'BINANCE:BTCUSDT' : q.symbol,
                    description: q.shortName || q.longName || q.symbol,
                    changePct: q.regularMarketChangePercent || 0
                }));

                // 3. เรียงลำดับจาก % บวกมากสุด ไปลบมากสุด (Top Performance)
                results.sort((a, b) => b.changePct - a.changePct);

                dynamicTrending = results;
                sessionStorage.setItem('koda_trending_assets', JSON.stringify({ ts: Date.now(), data: results }));
                return results;
            }
        } catch (e) {}

        // Fallback กรณีเน็ตพัง
        dynamicTrending = symbols.map(s => ({ displaySymbol: s, description: 'Trending Asset', changePct: 0 }));
        return dynamicTrending;
    };

    const AVATAR_COLORS = ['#1a56a4','#0e7b5a','#8b2fc9','#b45309','#c0392b','#1abc9c','#d35400'];
    const avatarColor = (sym) => AVATAR_COLORS[sym.charCodeAt(0) % AVATAR_COLORS.length];

    const renderResults = (items, isTrending = false) => {
        if (items.length === 0) {
            searchResults.innerHTML = `<p class="text-slate-500 text-sm text-center py-10">ไม่พบข้อมูลที่ค้นหา</p>`;
            return;
        }

        const title = isTrending
            ? `<p class="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3 px-2 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px] text-[#fbbf24]">local_fire_department</span> Top Trending Performance</p>`
            : `<p class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3 px-2">Market Search Results</p>`;

        const listHTML = items.map(item => {
            const sym  = item.displaySymbol;
            const initials = sym.replace(/[^A-Z0-9]/g, '').substring(0, 2) || sym.substring(0, 2).toUpperCase();
            const bg   = avatarColor(sym);
            
            let logoSrc = `https://assets.parqet.com/logos/symbol/${sym}?format=png`;
            if (sym.includes('BINANCE:')) {
                const coin = sym.replace('BINANCE:', '').replace('USDT', '');
                logoSrc = `https://assets.parqet.com/logos/symbol/${coin}?format=png`;
            }

            // 📌 Badge แสดงเปอร์เซ็นต์สำหรับหน้า Trending
            let performanceBadge = '<span class="material-symbols-outlined text-slate-600 group-hover:text-primary transition-colors">chevron_right</span>';
            if (isTrending && item.changePct !== undefined && item.changePct !== 0) {
                const isPos = item.changePct > 0;
                const color = isPos ? 'text-success' : 'text-danger';
                const bgClass = isPos ? 'bg-success/10' : 'bg-danger/10';
                performanceBadge = `<div class="shrink-0 px-2 py-1 rounded-lg ${bgClass}"><span class="${color} text-[11px] font-bold">${isPos ? '+' : ''}${item.changePct.toFixed(2)}%</span></div>`;
            }

            return `
            <a href="stock-detail.html?symbol=${sym}" class="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800 active:bg-slate-700 transition-colors border border-transparent hover:border-border-dark group">
                <div class="flex items-center gap-3">
                    <div class="size-10 rounded-full flex items-center justify-center overflow-hidden shrink-0 relative" style="background:${bg};">
                        <span class="text-white font-bold text-[11px] select-none">${initials}</span>
                        <img src="${logoSrc}" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover rounded-full" onerror="this.remove();">
                    </div>
                    <div class="flex flex-col">
                        <span class="text-white font-bold text-base">${sym}</span>
                        <span class="text-slate-500 text-[10px] truncate max-w-[180px]">${item.description}</span>
                    </div>
                </div>
                ${performanceBadge}
            </a>`;
        }).join('');

        searchResults.innerHTML = title + listHTML;
    };

    // ---- Cache helper สำหรับค้นหา (แยกจาก Trending) ----
    const CACHE_TTL = 5 * 60 * 1000;
    const cacheGet = (q) => {
        try {
            const raw = sessionStorage.getItem('ks_' + q);
            if (!raw) return null;
            const { ts, data } = JSON.parse(raw);
            if (Date.now() - ts < CACHE_TTL) return data;
        } catch(_) {}
        return null;
    };
    const cacheSet = (q, data) => {
        try { sessionStorage.setItem('ks_' + q, JSON.stringify({ ts: Date.now(), data })); } catch(_) {}
    };

    const localMatches = (q) => {
        const query = q.toUpperCase();
        return dynamicTrending.filter(item => {
            const sym = item.displaySymbol.toUpperCase();
            const desc = item.description.toUpperCase();
            return sym.includes(query) || desc.includes(query);
        });
    };

    let timeoutId;
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toUpperCase();
        clearTimeout(timeoutId);

        if (query.length === 0) {
            renderResults(dynamicTrending, true);
            return;
        }

        const cached = cacheGet(query);
        if (cached) {
            renderResults(cached, false);
            return;
        }

        const local = localMatches(query);
        if (local.length > 0) renderResults(local, false);
        
        searchResults.innerHTML = `<div class="flex flex-col items-center justify-center py-10 gap-3"><div class="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div><p class="text-slate-500 text-sm">กำลังค้นหาข้อมูล...</p></div>`;

        timeoutId = setTimeout(async () => {
            try {
                // 🚀 ใช้ Yahoo Finance ค้นหา (เร็วและแม่นยำ)
                const yfUrl = `/api/yahoo?mode=search&q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`;
                const res = await fetchWithTimeout(yfUrl, 4500);
                const data = await res.json();
                
                if (data && data.quotes && data.quotes.length > 0) {
                    const results = data.quotes
                        .filter(q => q.symbol && !q.symbol.includes('=')) 
                        .map(q => {
                            let typeText = q.quoteType === 'EQUITY' ? 'Stock' : (q.quoteType || 'Asset');
                            let exchange = q.exchDisp || '';
                            return {
                                displaySymbol: q.symbol,
                                description: `${q.shortname || q.longname || q.symbol} • ${typeText} ${exchange ? '('+exchange+')' : ''}`
                            };
                        });
                        
                    cacheSet(query, results);
                    renderResults(results, false);
                } else if (local.length > 0) {
                    renderResults(local, false);
                } else {
                    searchResults.innerHTML = `<p class="text-slate-500 text-sm text-center py-10">ไม่พบสินทรัพย์ที่ค้นหา</p>`;
                }
            } catch (error) {
                if (local.length > 0) renderResults(local, false);
                else searchResults.innerHTML = `<p class="text-danger text-sm text-center py-10">ระบบค้นหาขัดข้องชั่วคราว โปรดลองใหม่</p>`;
            }
        }, 600); 
    });

    const openSearch = async () => {
        searchModal.classList.remove('hidden');
        searchModal.classList.add('flex');
        setTimeout(() => {
            searchModal.classList.remove('opacity-0');
            searchModal.classList.add('opacity-100');
            searchInput.focus();
        }, 10);
        
        // โชว์ Loading สวยๆ ก่อนดึงข้อมูล Trending API
        searchResults.innerHTML = `<div class="flex flex-col items-center justify-center py-10 gap-3"><div class="size-6 border-2 border-[#fbbf24] border-t-transparent rounded-full animate-spin"></div><p class="text-[#fbbf24] font-bold text-sm">Scanning Market Trends...</p></div>`;
        
        const trends = await fetchTrendingAssets();
        renderResults(trends, true);
    };

    const closeSearch = () => {
        searchModal.classList.remove('opacity-100');
        searchModal.classList.add('opacity-0');
        searchInput.value = '';
        searchInput.blur();
        setTimeout(() => { searchModal.classList.add('hidden'); searchModal.classList.remove('flex'); }, 200);
    };

    searchClose.addEventListener('click', closeSearch);

    document.querySelectorAll('button').forEach(btn => {
        if (btn.innerHTML.includes('>search<') || btn.textContent.trim() === 'search') {
            btn.addEventListener('click', (e) => { e.preventDefault(); openSearch(); });
        }
    });
});
