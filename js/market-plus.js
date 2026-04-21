// 🚀 KODA Market Plus Module (Phase 1.1 - Ultimate Stability & Speed)
window.KodaMarketPlus = {
    // 📌 ตั้งค่าดัชนีที่ต้องการโชว์ (ใช้ ETF เพื่อให้เห็น Pre/Post Market)
    INDICES_CONFIG: [
        { name: 'S&P 500', symbol: 'SPY', icon: 'show_chart' },
        { name: 'NASDAQ', symbol: 'QQQ', icon: 'rocket_launch' },
        { name: 'DOW JONES', symbol: 'DIA', icon: 'account_balance' },
        { name: 'RUSSELL 2000', symbol: 'IWM', icon: 'analytics' }
    ],

    fetchPriceData: async (sym) => {
        try {
            const res = await fetch(`/api/price?symbol=${encodeURIComponent(sym)}&_=${Date.now()}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    const state = data.marketState;
                    let activePrice = data.regularMarketPrice || data.regularMarketPreviousClose;
                    let extPrice = null, extPercent = null;
                    
                    if (state === 'PRE' && data.preMarketPrice) {
                        activePrice = data.preMarketPrice;
                        extPrice = data.preMarketPrice;
                        extPercent = data.preMarketChangePercent || 0;
                    } else if ((state === 'POST' || state === 'CLOSED') && data.postMarketPrice) {
                        activePrice = data.postMarketPrice;
                        extPrice = data.postMarketPrice;
                        extPercent = data.postMarketChangePercent || 0;
                    }
                    return { 
                        price: activePrice, 
                        change: data.regularMarketChangePercent || 0,
                        extPrice, extPercent, state
                    };
                }
            }
        } catch(e) { return null; }
    },

    loadRSI: async (forceRefresh = false) => {
        const rsiContainer = document.getElementById('rsi-heatmap-container');
        if (!rsiContainer) return;

        const cacheKey = 'koda_rsi_heatmap_cache_v3';
        const savedData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{}');
        const wl = savedData.watchlist || [];
        const uniqueSymbols = [...new Set(wl.map(s => s.symbol))];

        if (!forceRefresh) {
            const cached = JSON.parse(localStorage.getItem(cacheKey));
            if (cached && cached.symbols === JSON.stringify(uniqueSymbols)) {
                rsiContainer.innerHTML = cached.html;
                return;
            }
        }

        rsiContainer.innerHTML = `<div class="flex justify-center py-8"><div class="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>`;

        const results = [];
        
        // 📌 แก้บัคระบบค้าง: ยิง API แบ่งเป็นกลุ่มละ 3 ตัว ป้องกันการโดน Proxy แบน IP
        for (let i = 0; i < uniqueSymbols.length; i += 3) {
            const chunk = uniqueSymbols.slice(i, i + 3);
            const chunkPromises = chunk.map(async (sym) => {
                const closes = await window.KodaMarketPlus.getYahooHistory(sym, '1mo');
                if (closes && closes.length > 14) {
                    return { symbol: sym, rsi: window.KodaMarketPlus.calcRSI(closes) };
                }
                return null;
            });
            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults.filter(r => r !== null));
        }

        results.sort((a, b) => b.rsi - a.rsi);

        const html = `<div class="bg-surface-dark border border-border-dark rounded-xl overflow-y-auto no-scrollbar shadow-sm max-h-[260px]">` + 
            results.map(r => {
                let color = 'bg-slate-700', text = 'NEUTRAL';
                if (r.rsi >= 70) { color = 'bg-danger'; text = 'OVERBOUGHT'; }
                else if (r.rsi <= 30) { color = 'bg-success'; text = 'OVERSOLD'; }
                return `<div class="flex items-center justify-between p-3 border-b border-border-dark/50 last:border-0">
                    <span class="text-white font-bold text-[10px]">${r.symbol}</span>
                    <div class="w-8 text-center rounded text-[10px] font-bold py-0.5 text-white ${color}">${r.rsi.toFixed(0)}</div>
                </div>`;
            }).join('') + `</div>`;

        rsiContainer.innerHTML = html;
        localStorage.setItem(cacheKey, JSON.stringify({ symbols: JSON.stringify(uniqueSymbols), html }));
    },

    loadIndices: async () => {
        const container = document.getElementById('indices-container');
        if (!container) return;

        container.innerHTML = `<div class="flex justify-center py-8"><div class="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>`;

        const indexPromises = window.KodaMarketPlus.INDICES_CONFIG.map(async (idx) => {
            const data = await window.KodaMarketPlus.fetchPriceData(idx.symbol);
            return { ...idx, data };
        });

        const results = await Promise.all(indexPromises);

        const html = `<div class="bg-surface-dark border border-border-dark rounded-xl overflow-y-auto no-scrollbar shadow-sm max-h-[260px]">` + 
            results.map(res => {
                const d = res.data;
                if (!d) return '';
                const isUp = d.change >= 0;
                const colorCls = isUp ? 'text-success' : 'text-danger';
                
                let extHtml = '';
                if (d.extPrice) {
                    const extColor = d.extPercent >= 0 ? 'text-success' : 'text-danger';
                    extHtml = `<p class="text-[9px] font-bold ${extColor}">${d.extPercent >= 0 ? '+' : ''}${d.extPercent.toFixed(2)}%</p>`;
                }

                return `<div class="flex items-center justify-between p-3 border-b border-border-dark/50 last:border-0">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-slate-500 text-sm">${res.icon}</span>
                        <span class="text-white font-bold text-[10px]">${res.name}</span>
                    </div>
                    <div class="text-right">
                        <div class="flex items-center gap-1.5 justify-end">
                            <span class="text-white font-bold text-[10px]">$${d.price.toFixed(2)}</span>
                            <span class="${colorCls} text-[9px] font-bold">${isUp ? '+' : ''}${d.change.toFixed(2)}%</span>
                        </div>
                        ${extHtml}
                    </div>
                </div>`;
            }).join('') + `</div>`;

        container.innerHTML = html;
    },

    calcRSI: (closes) => {
        if (!closes || closes.length < 15) return 50;
        let gains = 0, losses = 0;
        for (let i = 1; i <= 14; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff > 0) gains += diff; else if (diff < 0) losses -= diff;
        }
        let avgGain = gains / 14, avgLoss = losses / 14;
        for (let i = 15; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            avgGain = (avgGain * 13 + (diff > 0 ? diff : 0)) / 14;
            avgLoss = (avgLoss * 13 + (diff < 0 ? -diff : 0)) / 14;
        }
        return avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
    },

    getYahooHistory: async (sym, range) => {
        let yfSym = sym;
        if (sym === 'XAUUSD') yfSym = 'GC=F';
        else if (sym.includes('BINANCE:')) yfSym = sym.split(':')[1].replace('USDT', '-USD');
        
        const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSym}?range=${range}&interval=1d&_=${Date.now()}`;
        
        // 📌 เพิ่ม Proxy สำรอง กรณี Allorigins ล่มหรือจำกัดความเร็ว
        const proxies = [
            `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
            `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`
        ];

        for (let proxyUrl of proxies) {
            try {
                // 📌 เพิ่มระบบตัดจบ (Timeout) ถ้าโหลดเกิน 5 วินาที ให้หยุดทันทีระบบจะได้ไม่ค้าง
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const res = await fetch(proxyUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    let yfData = data.contents ? JSON.parse(data.contents) : data;
                    if (yfData && yfData.chart && yfData.chart.result) {
                        const closes = yfData.chart.result[0].indicators.quote[0].close;
                        return closes.filter(c => c !== null);
                    }
                }
            } catch(e) {
                continue; // ถ้า Proxy ตัวแรกโหลดไม่ขึ้น/พัง ให้วนไปลอง Proxy ตัวสำรอง
            }
        }
        return null;
    },

    initDynamics: () => {
        window.KodaMarketPlus.loadRSI(false);
        window.KodaMarketPlus.loadIndices();
        
        document.getElementById('btn-refresh-rsi')?.addEventListener('click', () => window.KodaMarketPlus.loadRSI(true));
        document.getElementById('btn-refresh-indices')?.addEventListener('click', () => window.KodaMarketPlus.loadIndices());
    }
};

// 📌 แก้บัคโหลดไม่ขึ้น (ตรวจสอบว่าโหลด DOM เสร็จหรือยังก่อนเรียกใช้)
const initMarketPlusApp = () => {
    if (document.getElementById('rsi-heatmap-container')) {
        window.KodaMarketPlus.initDynamics();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMarketPlusApp);
} else {
    initMarketPlusApp(); // สั่งรันทันทีถ้าหน้าเว็บโหลดเสร็จไปแล้ว
}
