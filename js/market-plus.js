// 🚀 KODA Market Plus Module (Phase 1 - Stability & Anti-Spam Upgrade)
// แยกไฟล์อิสระ ป้องกันการกระทบโค้ดเดิม 100%

window.KodaMarketPlus = {
    RATE_KEY: 'koda_usd_thb_rate',
    TIME_KEY: 'koda_usd_thb_time',
    MODE_KEY: 'koda_currency_mode',

    getExchangeRate: async () => {
        const cachedRate = localStorage.getItem(window.KodaMarketPlus.RATE_KEY);
        const cachedTime = localStorage.getItem(window.KodaMarketPlus.TIME_KEY);
        const now = Date.now();

        if (cachedRate && cachedTime && (now - parseInt(cachedTime) < 3600000)) {
            return parseFloat(cachedRate);
        }

        try {
            const res = await fetch('https://open.er-api.com/v6/latest/USD');
            const data = await res.json();
            if (data && data.rates && data.rates.THB) {
                localStorage.setItem(window.KodaMarketPlus.RATE_KEY, data.rates.THB);
                localStorage.setItem(window.KodaMarketPlus.TIME_KEY, now.toString());
                return data.rates.THB;
            }
        } catch(e) {}
        return 35.0; 
    },

    // 📌 ปรับสูตร RSI ให้คำนวณแม่นยำตามมาตรฐาน
    calcRSI: (closes) => {
        if (!closes || closes.length < 15) return 50;
        let gains = 0, losses = 0;
        
        // คำนวณ 14 วันแรก
        for (let i = 1; i <= 14; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff > 0) gains += diff;
            else if (diff < 0) losses -= diff;
        }
        let avgGain = gains / 14;
        let avgLoss = losses / 14;
        
        // คำนวณแบบ Smoothed Moving Average สำหรับวันที่เหลือ
        for (let i = 15; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            const gain = diff > 0 ? diff : 0;
            const loss = diff < 0 ? -diff : 0;
            avgGain = (avgGain * 13 + gain) / 14;
            avgLoss = (avgLoss * 13 + loss) / 14;
        }
        
        if (avgLoss === 0) return 100;
        return 100 - (100 / (1 + (avgGain / avgLoss)));
    },

    // 📌 ดึงข้อมูลจาก Yahoo Finance แบบทะลวง Cache ป้องกันการโดนบล็อก
    getYahooHistory: async (sym, range) => {
        let yfSym = sym;
        if (sym === 'XAUUSD') yfSym = 'GC=F';
        else if (sym.includes('.HK')) yfSym = sym.split('.')[0].padStart(4, '0') + '.HK';
        else if (sym.includes('OANDA:')) yfSym = sym.split(':')[1].replace('_', '') + '=X';
        else if (sym.includes('BINANCE:')) yfSym = sym.split(':')[1].replace('USDT', '-USD').replace('USD', '-USD');

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSym}?range=${range}&interval=1d&_=${Date.now()}`;
        
        // ท่อที่ 1: Codetabs (มีความเสถียรสูงสำหรับ Yahoo)
        try {
            const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
            const res = await fetch(proxyUrl);
            const data = await res.json();
            if (data.chart && data.chart.result && data.chart.result[0]) {
                const closes = data.chart.result[0].indicators.quote[0].close;
                return closes.filter(c => c !== null); 
            }
        } catch(e) {}

        // ท่อที่ 2: AllOrigins (สำรอง)
        try {
            const proxyUrl2 = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const res2 = await fetch(proxyUrl2);
            const data2 = await res2.json();
            if (data2 && data2.contents) {
                const yfData = JSON.parse(data2.contents);
                if (yfData.chart && yfData.chart.result && yfData.chart.result[0]) {
                    const closes = yfData.chart.result[0].indicators.quote[0].close;
                    return closes.filter(c => c !== null); 
                }
            }
        } catch(e) {}

        return null;
    },

    // --- ระบบจัดคิวโหลด RSI ป้องกันการโดนแบน IP (เรียงคิวโหลด) ---
    loadRSI: async (forceRefresh = false) => {
        const rsiContainer = document.getElementById('rsi-heatmap-container');
        if (!rsiContainer) return;

        const cacheKey = 'koda_rsi_heatmap_cache';
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        const savedData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{}');
        const wl = savedData.watchlist || [];
        
        // 📌 กรองชื่อหุ้นซ้ำ (Deduplicate) เผื่อในพอร์ตแอดหุ้นตัวเดียวกันไว้ 2 ไม้
        const uniqueSymbols = [...new Set(wl.map(s => s.symbol))];
        const wlSymbolsStr = JSON.stringify(uniqueSymbols); 

        const btnIcon = document.getElementById('btn-refresh-rsi');

        if (!forceRefresh && cached && cached.symbols === wlSymbolsStr && cached.html) {
            rsiContainer.innerHTML = cached.html;
            return;
        }

        if (uniqueSymbols.length === 0) {
            rsiContainer.innerHTML = `<p class="text-slate-500 text-[10px] text-center py-4">Add assets to see RSI</p>`;
            return;
        }

        if (btnIcon) btnIcon.classList.add('animate-spin', 'text-primary');
        
        if (forceRefresh || !cached) {
            rsiContainer.innerHTML = `<div class="flex justify-center py-8"><div class="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>`;
        }

        const results = [];
        
        // 📌 เปลี่ยนมาใช้ for...of ต่อคิวโหลดทีละตัว + หน่วงเวลา 200ms ป้องกัน Proxy แบนเราจากการยิงรัวๆ
        for (const sym of uniqueSymbols) {
            const closes = await window.KodaMarketPlus.getYahooHistory(sym, '3mo');
            if (closes && closes.length > 15) {
                results.push({ symbol: sym, rsi: window.KodaMarketPlus.calcRSI(closes) });
            }
            await new Promise(resolve => setTimeout(resolve, 200)); // หน่วงเวลาเล็กน้อย
        }
        
        if (btnIcon) btnIcon.classList.remove('animate-spin', 'text-primary');

        if (results.length === 0) {
            rsiContainer.innerHTML = `<p class="text-slate-500 text-[10px] text-center py-4 border border-dashed border-border-dark rounded-xl">Data unavailable. Try syncing again.</p>`;
        } else {
            results.sort((a,b) => b.rsi - a.rsi); 
            
            const html = `<div class="bg-surface-dark border border-border-dark rounded-xl overflow-y-auto no-scrollbar shadow-sm max-h-[220px]">` + 
                results.map(r => {
                    let color = 'bg-slate-700', text = 'NEUTRAL';
                    if (r.rsi >= 70) { color = 'bg-danger'; text = 'OVERBOUGHT'; }
                    else if (r.rsi >= 60) { color = 'bg-orange-500'; text = 'WARM'; }
                    else if (r.rsi <= 30) { color = 'bg-success'; text = 'OVERSOLD'; }
                    else if (r.rsi <= 40) { color = 'bg-primary'; text = 'COOL'; }
                    return `<div class="flex items-center justify-between p-3 border-b border-border-dark/50 last:border-0">
                        <span class="text-white font-bold text-xs">${r.symbol}</span>
                        <div class="flex items-center gap-2">
                            <span class="text-slate-400 text-[9px] uppercase font-bold tracking-wider">${text}</span>
                            <div class="w-8 text-center rounded text-[10px] font-bold py-0.5 text-white ${color}">${r.rsi.toFixed(0)}</div>
                        </div>
                    </div>`;
                }).join('') + `</div>`;
            
            rsiContainer.innerHTML = html;
            localStorage.setItem(cacheKey, JSON.stringify({ symbols: wlSymbolsStr, html: html }));
        }
    },

    // --- ระบบจัดคิวโหลด Sector Rotation ---
    loadSector: async (forceRefresh = false) => {
        const sectorContainer = document.getElementById('sector-rotation-container');
        if (!sectorContainer) return;

        const cacheKey = 'koda_sector_rotation_cache';
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        const btnIcon = document.getElementById('btn-refresh-sector');

        if (!forceRefresh && cached && cached.html) {
            sectorContainer.innerHTML = cached.html;
            return;
        }

        if (btnIcon) btnIcon.classList.add('animate-spin', 'text-primary');

        if (forceRefresh || !cached) {
            sectorContainer.innerHTML = `<div class="flex justify-center py-8"><div class="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>`;
        }
        
        const SECTORS = [
            { name: 'Technology', symbol: 'XLK' },
            { name: 'Financials', symbol: 'XLF' },
            { name: 'Healthcare', symbol: 'XLV' },
            { name: 'Energy', symbol: 'XLE' },
            { name: 'Cons Discr', symbol: 'XLY' },
            { name: 'Industrials', symbol: 'XLI' },
            { name: 'Comm Svcs', symbol: 'XLC' },
            { name: 'Materials', symbol: 'XLB' },
            { name: 'Real Estate', symbol: 'XLRE' },
            { name: 'Utilities', symbol: 'XLU' },
            { name: 'Cons Staples', symbol: 'XLP' }
        ];
        
        const results = [];

        // 📌 ต่อคิวโหลด Sector ทีละตัว ลดภาระ Proxy ป้องกัน Data Unavailable
        for (const sec of SECTORS) {
            const closes = await window.KodaMarketPlus.getYahooHistory(sec.symbol, '1mo');
            if (closes && closes.length > 5) {
                const cur = closes[closes.length - 1];
                const past = closes[closes.length - 6]; 
                if (cur && past) {
                    results.push({ ...sec, change: ((cur - past) / past) * 100 });
                }
            }
            await new Promise(resolve => setTimeout(resolve, 200)); // หน่วงเวลาเล็กน้อย
        }

        if (btnIcon) btnIcon.classList.remove('animate-spin', 'text-primary');

        if (results.length === 0) {
            sectorContainer.innerHTML = `<p class="text-slate-500 text-[10px] text-center py-4 border border-dashed border-border-dark rounded-xl">Data unavailable. Try syncing again.</p>`;
        } else {
            results.sort((a,b) => b.change - a.change); 
            const maxC = Math.max(...results.map(r => Math.abs(r.change)));
            
            const html = `<div class="bg-surface-dark border border-border-dark rounded-xl p-3 space-y-4 shadow-sm overflow-y-auto no-scrollbar max-h-[220px]">` + 
                results.map(r => {
                    const isUp = r.change >= 0;
                    const w = Math.max(5, (Math.abs(r.change) / maxC) * 100);
                    const cCls = isUp ? 'bg-success' : 'bg-danger';
                    const tCls = isUp ? 'text-success' : 'text-danger';
                    return `<div>
                        <div class="flex justify-between text-[11px] font-bold mb-1.5">
                            <span class="text-slate-300">${r.name}</span>
                            <span class="${tCls}">${isUp ? '+' : ''}${r.change.toFixed(2)}%</span>
                        </div>
                        <div class="w-full bg-background-dark rounded-full h-1.5 overflow-hidden">
                            <div class="${cCls} h-full rounded-full" style="width: ${w}%"></div>
                        </div>
                    </div>`;
                }).join('') + `</div>`;
            
            sectorContainer.innerHTML = html;
            localStorage.setItem(cacheKey, JSON.stringify({ html: html }));
        }
    },

    // 6. แทรกปุ่ม Refresh และเริ่มต้นระบบ
    initDynamics: () => {
        const rsiContainer = document.getElementById('rsi-heatmap-container');
        if (rsiContainer) {
            const rsiHeader = rsiContainer.previousElementSibling;
            if (rsiHeader && !document.getElementById('btn-refresh-rsi')) {
                rsiHeader.classList.remove('gap-1.5');
                rsiHeader.classList.add('justify-between');
                rsiHeader.innerHTML = `
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-primary text-[16px]">thermostat</span> RSI Heatmap
                    </div>
                    <span id="btn-refresh-rsi" class="material-symbols-outlined text-slate-400 hover:text-primary cursor-pointer text-[16px] transition-colors" title="Sync Data">sync</span>
                `;
                document.getElementById('btn-refresh-rsi').addEventListener('click', () => window.KodaMarketPlus.loadRSI(true));
            }
            window.KodaMarketPlus.loadRSI(false);
        }

        const sectorContainer = document.getElementById('sector-rotation-container');
        if (sectorContainer) {
            const sectorHeader = sectorContainer.previousElementSibling;
            if (sectorHeader && !document.getElementById('btn-refresh-sector')) {
                sectorHeader.classList.remove('gap-1.5');
                sectorHeader.classList.add('justify-between');
                sectorHeader.innerHTML = `
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-primary text-[16px]">donut_large</span> Sector Flow
                    </div>
                    <span id="btn-refresh-sector" class="material-symbols-outlined text-slate-400 hover:text-primary cursor-pointer text-[16px] transition-colors" title="Sync Data">sync</span>
                `;
                document.getElementById('btn-refresh-sector').addEventListener('click', () => window.KodaMarketPlus.loadSector(true));
            }
            window.KodaMarketPlus.loadSector(false);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.KodaMarketPlus.getExchangeRate(); 
    if (document.getElementById('rsi-heatmap-container')) {
        window.KodaMarketPlus.initDynamics();
    }
});