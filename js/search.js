document.addEventListener('DOMContentLoaded', () => {
    
    const FINNHUB_API_KEY = window.ENV_KEYS.FINNHUB;

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

    const trendingStocks = [
        { displaySymbol: 'BINANCE:BTCUSDT', description: 'Bitcoin / USDT' },
        { displaySymbol: 'XAUUSD',           description: 'Gold Spot / US Dollar' },
        { displaySymbol: 'OANDA:EUR_USD',    description: 'Euro / US Dollar' },
        { displaySymbol: 'VOO',              description: 'Vanguard S&P 500 ETF' },
        { displaySymbol: 'NVDA',             description: 'NVIDIA Corp' },
        { displaySymbol: 'CPALL.BK',         description: 'CP ALL PCL (Thai Stock)' }
    ];

    // สีพื้นหลัง avatar สำหรับ initials
    const AVATAR_COLORS = ['#1a56a4','#0e7b5a','#8b2fc9','#b45309','#c0392b','#1abc9c','#d35400'];
    const avatarColor = (sym) => AVATAR_COLORS[sym.charCodeAt(0) % AVATAR_COLORS.length];

    const renderResults = (items, isTrending = false) => {
        if (items.length === 0) {
            searchResults.innerHTML = `<p class="text-slate-500 text-sm text-center py-10">No matching assets found.</p>`;
            return;
        }

        const title = isTrending
            ? `<p class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3 px-2 flex items-center gap-1"><span class="material-symbols-outlined text-[14px] text-primary">trending_up</span> Trending Assets</p>`
            : `<p class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3 px-2">Market Search Results</p>`;

        const listHTML = items.map(item => {
            const sym  = item.displaySymbol;
            const initials = sym.replace(/[^A-Z0-9]/g, '').substring(0, 2) || sym.substring(0, 2).toUpperCase();
            const bg   = avatarColor(sym);
            // โหลดรูปโลโก้ lazy — ถ้าโหลดไม่ได้จะเห็น initials ข้างล่างแทน ไม่บล็อก render
            let logoSrc = `https://assets.parqet.com/logos/symbol/${sym}?format=png`;
            if (sym.includes('BINANCE:')) {
                const coin = sym.replace('BINANCE:', '').replace('USDT', '');
                logoSrc = `https://assets.parqet.com/logos/symbol/${coin}?format=png`;
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
                <span class="material-symbols-outlined text-slate-600 group-hover:text-primary transition-colors">chevron_right</span>
            </a>`;
        }).join('');

        searchResults.innerHTML = title + listHTML;
    };

    // ---- Cache helper (sessionStorage, 5 นาที) ----
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
        return trendingStocks.filter(item => {
            const sym = item.displaySymbol.toUpperCase();
            const desc = item.description.toUpperCase();
            return sym.includes(query) || desc.includes(query);
        });
    };

    const fetchWithTimeout = (url, ms = 4500) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
    };

    let timeoutId;
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toUpperCase();
        clearTimeout(timeoutId);

        if (query.length === 0) {
            renderResults(trendingStocks, true);
            return;
        }

        // ✅ มี cache → แสดงทันที ไม่ต้อง spin
        const cached = cacheGet(query);
        if (cached) {
            renderResults(cached, false);
            return;
        }

        const local = localMatches(query);
        if (local.length > 0) renderResults(local, false);
        searchResults.innerHTML = `<div class="flex flex-col items-center justify-center py-10 gap-3"><div class="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div><p class="text-slate-500 text-sm">Searching global exchanges...</p></div>`;

        // ✅ ลด debounce 400 → 120ms และมี fallback ทันทีถ้า Finnhub ช้า
        timeoutId = setTimeout(async () => {
            try {
                const res = await fetchWithTimeout(`https://finnhub.io/api/v1/search?q=${query}&token=${FINNHUB_API_KEY}`, 4500);
                const data = await res.json();
                if (data && data.result) {
                    const results = data.result.slice(0, 15);
                    cacheSet(query, results);
                    renderResults(results, false);
                } else if (local.length > 0) {
                    renderResults(local, false);
                } else {
                    searchResults.innerHTML = `<p class="text-slate-500 text-sm text-center py-10">No matching assets found.</p>`;
                }
            } catch (error) {
                if (local.length > 0) {
                    renderResults(local, false);
                } else {
                    searchResults.innerHTML = `<p class="text-danger text-sm text-center py-10">Search temporarily unavailable.</p>`;
                }
            }
        }, 120);
    });

    const openSearch = () => {
        searchModal.classList.remove('hidden');
        searchModal.classList.add('flex');
        setTimeout(() => {
            searchModal.classList.remove('opacity-0');
            searchModal.classList.add('opacity-100');
            searchInput.focus();
        }, 10);
        renderResults(trendingStocks, true);
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