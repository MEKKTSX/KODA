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

    const searchModal = document.getElementById('koda-search-modal');
    const searchInput = document.getElementById('koda-search-input');
    const searchResults = document.getElementById('koda-search-results');
    const searchClose = document.getElementById('koda-search-close');

    // 📌 เพิ่มรายการแนะนำที่มีทั้ง Crypto, Forex และ ETF
    const trendingStocks = [
        { displaySymbol: 'BINANCE:BTCUSDT', description: 'Bitcoin / USDT' },
        { displaySymbol: 'XAUUSD', description: 'Gold Spot / US Dollar' },
        { displaySymbol: 'OANDA:EUR_USD', description: 'Euro / US Dollar' },
        { displaySymbol: 'VOO', description: 'Vanguard S&P 500 ETF' },
        { displaySymbol: 'NVDA', description: 'NVIDIA Corp' },
        { displaySymbol: 'CPALL.BK', description: 'CP ALL PCL (Thai Stock)' }
    ];

    const renderResults = (items, isTrending = false) => {
        if (items.length === 0) {
            searchResults.innerHTML = `<p class="text-slate-500 text-sm text-center py-10">No matching assets found.</p>`;
            return;
        }

        const title = isTrending ? `<p class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3 px-2 flex items-center gap-1"><span class="material-symbols-outlined text-[14px] text-primary">trending_up</span> Trending Assets</p>` : `<p class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3 px-2">Market Search Results</p>`;

        const listHTML = items.map(item => {
            const sym = item.displaySymbol;
            // 📌 ระบบจัดการโลโก้สำหรับหลายสินทรัพย์
            let logo1 = `https://assets.parqet.com/logos/symbol/${sym}?format=png`;
            let logo2 = `https://financialmodelingprep.com/image-stock/${sym.split(':')[1] || sym.split('.')[0]}.png`;
            
            // ถ้าเป็น Crypto บางเจ้าต้องใช้สัญลักษณ์ตัวหลัง เช่น BTCUSDT -> BTC
            if(sym.includes('BINANCE:')) logo2 = `https://financialmodelingprep.com/image-stock/${sym.replace('BINANCE:','').replace('USDT','')}.png`;

            return `
            <a href="stock-detail.html?symbol=${sym}" class="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800 active:bg-slate-700 transition-colors border border-transparent hover:border-border-dark group">
                <div class="flex items-center gap-3">
                    <div class="size-10 rounded-full bg-slate-800 border border-border-dark flex items-center justify-center overflow-hidden relative shrink-0">
                        <span class="text-white font-bold text-[10px] absolute">${sym.substring(0,2)}</span>
                        <img src="${logo1}" class="w-full h-full object-cover relative z-10 bg-surface-dark" onerror="this.onerror=null; this.src='${logo2}'; this.onerror=function(){this.style.display='none'};">
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

    let timeoutId;
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toUpperCase();
        clearTimeout(timeoutId);

        if (query.length === 0) {
            renderResults(trendingStocks, true);
            return;
        }

        searchResults.innerHTML = `<div class="flex flex-col items-center justify-center py-10 gap-3"><div class="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div><p class="text-slate-500 text-sm">Searching global exchanges...</p></div>`;

        timeoutId = setTimeout(async () => {
            try {
                const res = await fetch(`https://finnhub.io/api/v1/search?q=${query}&token=${FINNHUB_API_KEY}`);
                const data = await res.json();
                if (data && data.result) {
                    renderResults(data.result.slice(0, 15), false);
                }
            } catch (error) {
                searchResults.innerHTML = `<p class="text-danger text-sm text-center py-10">Error fetching data.</p>`;
            }
        }, 400); 
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

    const allButtons = document.querySelectorAll('button');
    allButtons.forEach(btn => {
        if (btn.innerHTML.includes('>search<') || btn.textContent.trim() === 'search') {
            btn.addEventListener('click', (e) => { e.preventDefault(); openSearch(); });
        }
    });
});