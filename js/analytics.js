// 🚀 KODA Analytics Module (Price Action Swing Pivots + Fibonacci Matrix)
window.KodaAnalytics = {
    benchmarkChartInstance: null,
    activeBenchmark: 'SPY', 
    activeRange: '1mo',     

    // ==========================================
    // 📌 1. ระบบ KODA Lab (Trade Matrix หลัก 5 รับ 4 ต้าน)
    // ==========================================
    tradeMatrixData: {
        capital: 1000,
        supports: [49.46, 47.68, 44.96, 42.98, 37.67],
        resistances: [52.13, 56.51, 62.17, 69.31]
    },

    initLabMode: () => {
        const btnHoldings = document.getElementById('mode-holdings');
        const btnLabMain = document.getElementById('mode-lab-main'); 
        const btnOpenModal = document.getElementById('btn-open-lab-modal'); 
        const portContainer = document.getElementById('portfolio-container');
        const labContainer = document.getElementById('lab-container');
        const modalWhatif = document.getElementById('modal-whatif'); 

        if (btnHoldings && btnLabMain && portContainer && labContainer) {
            btnHoldings.addEventListener('click', () => {
                btnHoldings.className = 'flex-1 text-xs font-bold py-2 rounded-md bg-primary text-white transition-all shadow-md';
                btnLabMain.className = 'flex-1 text-xs font-bold py-2 rounded-l-md text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1 bg-surface-dark border border-border-dark border-r-0 hover:bg-slate-800';
                portContainer.classList.remove('hidden');
                labContainer.classList.add('hidden');
            });

            btnLabMain.addEventListener('click', () => {
                btnLabMain.className = 'flex-1 text-xs font-bold py-2 rounded-l-md bg-primary text-white transition-all shadow-md flex items-center justify-center gap-1';
                btnHoldings.className = 'flex-1 text-xs font-bold py-2 rounded-md text-slate-400 hover:text-white transition-all bg-surface-dark border border-transparent';
                portContainer.classList.add('hidden');
                labContainer.classList.remove('hidden');
                window.KodaAnalytics.renderTradeMatrix(); 
            });
        }

        if (btnOpenModal && modalWhatif) {
            btnOpenModal.addEventListener('click', () => {
                modalWhatif.classList.remove('hidden');
                modalWhatif.classList.add('flex');
                setTimeout(() => {
                    modalWhatif.classList.remove('opacity-0');
                    document.getElementById('modal-whatif-content')?.classList.remove('translate-y-full');
                }, 10);
            });
        }
        
        const btnCloseWhatif = document.getElementById('btn-close-whatif');
        if (btnCloseWhatif && modalWhatif) {
            btnCloseWhatif.addEventListener('click', () => {
                modalWhatif.classList.add('opacity-0');
                document.getElementById('modal-whatif-content')?.classList.add('translate-y-full');
                setTimeout(() => {
                    modalWhatif.classList.add('hidden');
                    modalWhatif.classList.remove('flex');
                }, 300);
            });
        }

        const btnFetch = document.getElementById('btn-fetch-sr');
        const symInput = document.getElementById('lab-symbol-input');
        if (btnFetch && symInput) {
            btnFetch.addEventListener('click', () => {
                const sym = symInput.value.trim().toUpperCase();
                if(sym) window.KodaAnalytics.fetchRealSR(sym);
            });
            symInput.addEventListener('keypress', (e) => {
                if(e.key === 'Enter') {
                    const sym = symInput.value.trim().toUpperCase();
                    if(sym) window.KodaAnalytics.fetchRealSR(sym);
                }
            });
        }

        const btnReset = document.getElementById('btn-reset-matrix');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                window.KodaAnalytics.tradeMatrixData.capital = 1000;
                window.KodaAnalytics.tradeMatrixData.supports = [49.46, 47.68, 44.96, 42.98, 37.67];
                window.KodaAnalytics.tradeMatrixData.resistances = [52.13, 56.51, 62.17, 69.31];
                
                const capInput = document.getElementById('lab-capital-input');
                if (capInput) capInput.value = 1000;
                if (symInput) symInput.value = '';
                
                window.KodaAnalytics.renderTradeMatrix();
                btnReset.classList.add('animate-spin');
                setTimeout(() => btnReset.classList.remove('animate-spin'), 500);
            });
        }

        const capInput = document.getElementById('lab-capital-input');
        if (capInput) {
            capInput.addEventListener('input', (e) => {
                window.KodaAnalytics.tradeMatrixData.capital = parseFloat(e.target.value) || 0;
                window.KodaAnalytics.renderTradeMatrix();
            });
        }
    },

    fetchRealSR: async (symbol) => {
        const loading = document.getElementById('matrix-loading');
        if(loading) {
            loading.classList.remove('hidden');
            loading.classList.add('flex');
        }
        
        try {
            let sym = symbol.toUpperCase().trim();
            let highs = [], lows = [], closes = [];
            let fetched = false;
            
            const FINNHUB_API_KEY = window.ENV_KEYS?.FINNHUB || '';

            // 🚀 STEP 1: Crypto ดึงตรงจาก Binance
            if (sym === 'BTC' || sym === 'ETH') sym += 'USDT';
            
            if (sym.includes('USDT') || sym.includes('BINANCE:')) {
                const coin = sym.replace('BINANCE:', '');
                const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${coin}&interval=1d&limit=180`);
                const data = await res.json();
                if (data && data.length > 0) {
                    data.forEach(k => { highs.push(parseFloat(k[2])); lows.push(parseFloat(k[3])); closes.push(parseFloat(k[4])); });
                    fetched = true;
                }
            } 
            
            // 🚀 STEP 2: Finnhub เป็นท่อหลัก
            if (!fetched && !sym.includes('.BK')) {
                try {
                    const to = Math.floor(Date.now() / 1000);
                    const from = to - (180 * 24 * 60 * 60); 
                    const fhSym = sym === 'XAUUSD' ? 'OANDA:XAU_USD' : sym;
                    const fhRes = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${fhSym}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`);
                    const fhData = await fhRes.json();
                    if (fhData && fhData.s === 'ok' && fhData.c.length > 0) {
                        highs = fhData.h; lows = fhData.l; closes = fhData.c;
                        fetched = true;
                    }
                } catch(e) {}
            }

            // 🚀 STEP 3: 📌 อัปเกรดท่อ Proxy ของ Yahoo Finance ให้ทะลุทะลวง (ดึง ASML ได้แน่นอน)
            if (!fetched) {
                let yfSym = sym;
                if (sym === 'XAUUSD') yfSym = 'GC=F';
                else if (sym.includes('.HK')) yfSym = sym.split('.')[0].padStart(4, '0') + '.HK';
                else if (sym.includes('.BK')) yfSym = sym; 

                const yfUrls = [
                    `https://query1.finance.yahoo.com/v8/finance/chart/${yfSym}?range=6mo&interval=1d`,
                    `https://query2.finance.yahoo.com/v8/finance/chart/${yfSym}?range=6mo&interval=1d`
                ];

                const proxies = [
                    url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, // ใช้ /get จะเสถียรกว่า raw
                    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
                ];

                for (let url of yfUrls) {
                    if (fetched) break;
                    for (let proxy of proxies) {
                        try {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 6000); 
                            const res = await fetch(proxy(url), { signal: controller.signal });
                            clearTimeout(timeoutId);
                            
                            if (!res.ok) continue;
                            const rawData = await res.json();
                            
                            // จัดการฟอร์แมตข้อมูลจาก Proxy
                            let data;
                            if (rawData.contents) {
                                try { data = JSON.parse(rawData.contents); } catch(e) { data = rawData.contents; }
                            } else {
                                data = rawData;
                            }
                            
                            if (data?.chart?.result?.[0]) {
                                const quote = data.chart.result[0].indicators.quote[0];
                                for (let i = 0; i < quote.close.length; i++) {
                                    if (quote.close[i] !== null && quote.high[i] !== null && quote.low[i] !== null) {
                                        highs.push(quote.high[i]); lows.push(quote.low[i]); closes.push(quote.close[i]);
                                    }
                                }
                                if (closes.length > 10) { fetched = true; break; }
                            }
                        } catch(e) { continue; }
                    }
                }
            }

            if (!fetched || closes.length === 0) throw new Error("No Data Found");
            const lastClose = closes[closes.length - 1];

            // ==========================================
            // 📌 [SUPER ALGORITHM] "Swing Action + Fibonacci Clusters"
            // ==========================================
            const macroHigh = Math.max(...highs);
            const macroLow = Math.min(...lows);
            const range = macroHigh - macroLow;
            
            const fibRatios = [-0.618, -0.236, 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618];
            const fibLevels = fibRatios.map(r => macroLow + (range * r));

            let pivots = [];
            const windowSize = 5; 
            for (let i = windowSize; i < closes.length - windowSize; i++) {
                let isHigh = true, isLow = true;
                for (let j = 1; j <= windowSize; j++) {
                    if (highs[i] <= highs[i-j] || highs[i] <= highs[i+j]) isHigh = false;
                    if (lows[i] >= lows[i-j] || lows[i] >= lows[i+j]) isLow = false;
                }
                if (isHigh) pivots.push(highs[i]);
                if (isLow) pivots.push(lows[i]);
            }

            let allLevels = [...fibLevels, ...pivots, macroHigh, macroLow];
            allLevels.sort((a, b) => a - b);

            let uniqueLevels = [];
            allLevels.forEach(lvl => {
                if (uniqueLevels.length === 0) uniqueLevels.push(lvl);
                else {
                    const last = uniqueLevels[uniqueLevels.length - 1];
                    if (Math.abs(lvl - last) / last > 0.015) {
                        uniqueLevels.push(lvl);
                    } else {
                        uniqueLevels[uniqueLevels.length - 1] = (last + lvl) / 2; 
                    }
                }
            });

            let resist = uniqueLevels.filter(l => l > lastClose * 1.005); 
            let supp = uniqueLevels.filter(l => l < lastClose * 0.995).reverse(); 

            let atrSum = 0;
            for(let i = closes.length-14; i<closes.length; i++) {
                if(i>0) atrSum += Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1]));
            }
            let atr = (atrSum / 14) || (lastClose * 0.02);
            if(atr < lastClose * 0.015) atr = lastClose * 0.015;
            
            while(resist.length < 4) resist.push(resist.length > 0 ? resist[resist.length-1] + atr : lastClose + atr);
            while(supp.length < 5) supp.push(supp.length > 0 ? supp[supp.length-1] - atr : lastClose - atr);

            const decimals = lastClose < 0.1 ? 5 : (lastClose < 10 ? 3 : 2);
            const format = (v) => parseFloat(v.toFixed(decimals));
            
            window.KodaAnalytics.tradeMatrixData.resistances = resist.slice(0, 4).map(format);
            window.KodaAnalytics.tradeMatrixData.supports = supp.slice(0, 5).map(format);
            
            window.KodaAnalytics.renderTradeMatrix();
            
            const symInput = document.getElementById('lab-symbol-input');
            if (symInput) symInput.value = sym;

        } catch(e) {
            alert(`ไม่พบข้อมูลกราฟของหุ้น "${symbol}" (อาจเป็นหุ้นที่ระบบ API ยังไม่รองรับ หรือเซิร์ฟเวอร์ขัดข้อง)\nกรุณาตรวจสอบชื่อย่ออีกครั้ง (เช่น TSLA, BTC)`);
        } finally {
            if(loading) {
                loading.classList.remove('flex');
                loading.classList.add('hidden');
            }
        }
    },

    renderTradeMatrix: () => {
        const head = document.getElementById('matrix-head');
        const body = document.getElementById('matrix-body');
        if (!head || !body) return;

        const { capital, supports, resistances } = window.KodaAnalytics.tradeMatrixData;

        let headHTML = `<tr>
            <th class="p-3 border-r border-border-dark bg-background-dark/80 w-24 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                <span class="text-yellow-500 font-bold text-sm uppercase tracking-wider">ซื้อที่</span>
            </th>`;
        
        resistances.forEach((r, i) => {
            headHTML += `
            <th class="p-3 border-r border-border-dark min-w-[95px] bg-background-dark/30">
                <div class="text-primary font-black text-sm mb-1">R${i+1}</div>
                <div class="flex items-center justify-center text-slate-300 font-bold text-xs">
                    $ <input type="number" value="${r}" data-idx="${i}" class="input-r w-16 bg-transparent text-center border-b border-transparent focus:border-primary outline-none transition-colors p-0 m-0">
                </div>
            </th>`;
        });
        headHTML += `</tr>`;
        head.innerHTML = headHTML;

        let bodyHTML = '';
        supports.forEach((s, sIdx) => {
            bodyHTML += `<tr>`;
            bodyHTML += `
            <td class="p-3 border-r border-t border-border-dark bg-surface-dark sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                <div class="text-yellow-500 font-black text-sm mb-1">S${sIdx+1}</div>
                <div class="flex items-center justify-center text-slate-300 font-bold text-xs">
                    $ <input type="number" value="${s}" data-idx="${sIdx}" class="input-s w-16 bg-transparent text-center border-b border-transparent focus:border-yellow-500 outline-none transition-colors p-0 m-0">
                </div>
            </td>`;

            resistances.forEach((r) => {
                const pct = s > 0 ? ((r - s) / s) * 100 : 0;
                const profit = (pct / 100) * capital;
                
                const isPos = profit >= 0;
                const colorCls = isPos ? 'text-success' : 'text-danger';
                const sign = isPos ? '+' : '';

                bodyHTML += `
                <td class="p-3 border-r border-t border-border-dark hover:bg-slate-800 transition-colors">
                    <div class="${colorCls} font-black text-[15px] mb-0.5">${sign}$${Math.abs(profit).toFixed(2)}</div>
                    <div class="${colorCls} font-bold text-[10px]">(${sign}${pct.toFixed(2)}%)</div>
                </td>`;
            });
            bodyHTML += `</tr>`;
        });
        body.innerHTML = bodyHTML;

        document.querySelectorAll('.input-r').forEach(inp => {
            inp.addEventListener('change', (e) => {
                window.KodaAnalytics.tradeMatrixData.resistances[e.target.dataset.idx] = parseFloat(e.target.value) || 0;
                window.KodaAnalytics.renderTradeMatrix();
            });
        });

        document.querySelectorAll('.input-s').forEach(inp => {
            inp.addEventListener('change', (e) => {
                window.KodaAnalytics.tradeMatrixData.supports[e.target.dataset.idx] = parseFloat(e.target.value) || 0;
                window.KodaAnalytics.renderTradeMatrix();
            });
        });
    },

    // ==========================================
    // 📌 2. ระบบแท็บย่อยใน Modal
    // ==========================================
    initTabs: () => {
        const tabs = ['simulator', 'avgcost', 'benchmark', 'metrics']; 
        tabs.forEach(tabId => {
            const btn = document.getElementById(`tab-${tabId}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    tabs.forEach(t => {
                        const b = document.getElementById(`tab-${t}`);
                        if(b) { b.classList.remove('bg-primary', 'text-white'); b.classList.add('text-slate-500'); }
                        const c = document.getElementById(`content-${t}`);
                        if(c) c.classList.add('hidden');
                    });
                    btn.classList.add('bg-primary', 'text-white');
                    btn.classList.remove('text-slate-500');
                    const targetContent = document.getElementById(`content-${tabId}`);
                    if (targetContent) targetContent.classList.remove('hidden');

                    if (tabId === 'benchmark') window.KodaAnalytics.renderBenchmark();
                    if (tabId === 'metrics') window.KodaAnalytics.calculateMetrics();
                });
            }
        });

        document.querySelectorAll('.bench-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.bench-btn').forEach(b => { b.classList.remove('bg-primary', 'text-white'); b.classList.add('text-slate-500'); });
                e.target.classList.add('bg-primary', 'text-white'); e.target.classList.remove('text-slate-500');
                window.KodaAnalytics.activeBenchmark = e.target.dataset.val;
                window.KodaAnalytics.renderBenchmark();
            });
        });

        document.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tf-btn').forEach(b => { b.classList.remove('bg-slate-700', 'text-white'); b.classList.add('text-slate-500'); });
                e.target.classList.add('bg-slate-700', 'text-white'); e.target.classList.remove('text-slate-500');
                window.KodaAnalytics.activeRange = e.target.dataset.val;
                window.KodaAnalytics.renderBenchmark();
            });
        });
    },

    // ==========================================
    // 📌 3. ระบบ DCA 
    // ==========================================
    initDCA: () => {
        const calculateDCA = () => {
            const baseShares = parseFloat(document.getElementById('dca-base-shares').value) || 0;
            const baseCost = parseFloat(document.getElementById('dca-base-cost').value) || 0;

            let totalShares = baseShares;
            let totalCost = baseShares * baseCost;

            document.querySelectorAll('.tranche-row').forEach(row => {
                const tShares = parseFloat(row.querySelector('.tranche-shares').value) || 0;
                const tPrice = parseFloat(row.querySelector('.tranche-price').value) || 0;
                if (tShares > 0 && tPrice >= 0) {
                    totalShares += tShares;
                    totalCost += (tShares * tPrice);
                }
            });

            const newAvgCost = totalShares > 0 ? (totalCost / totalShares) : 0;
            document.getElementById('dca-result-cost').textContent = '$' + newAvgCost.toFixed(2);
            document.getElementById('dca-total-shares').textContent = totalShares.toLocaleString(undefined, {maximumFractionDigits: 4});
            document.getElementById('dca-total-value').textContent = '$' + totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
        };

        const dcaAssetBtn = document.getElementById('dca-asset-btn');
        const dcaAssetMenu = document.getElementById('dca-asset-menu');
        const dcaAssetLabel = document.getElementById('dca-asset-label');
        const dcaBaseShares = document.getElementById('dca-base-shares');
        const dcaBaseCost = document.getElementById('dca-base-cost');

        if (dcaAssetBtn) {
            dcaAssetBtn.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                dcaAssetMenu.classList.toggle('hidden'); 
                
                const data = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{"holdings":[]}');
                const holdings = data.holdings || [];
                
                dcaAssetMenu.innerHTML = '';
                if (holdings.length === 0) {
                    dcaAssetMenu.innerHTML = '<div class="px-4 py-3 text-slate-500 text-sm font-bold">Portfolio is empty</div>';
                    return;
                }
                
                holdings.forEach(h => {
                    const item = document.createElement('div');
                    item.className = 'px-4 py-3 border-b border-border-dark/50 hover:bg-slate-800 cursor-pointer text-white font-bold text-sm transition-colors flex justify-between items-center';
                    item.innerHTML = `<span>${h.symbol}</span> <span class="text-slate-500 text-[10px] font-normal bg-background-dark px-2 py-0.5 rounded border border-border-dark">${h.shares} sh</span>`;
                    item.addEventListener('click', () => {
                        dcaAssetLabel.textContent = `${h.symbol} (${h.shares} sh)`;
                        dcaAssetLabel.classList.remove('text-slate-400');
                        dcaAssetLabel.classList.add('text-white');
                        dcaAssetMenu.classList.add('hidden');
                        
                        dcaBaseShares.value = h.shares;
                        dcaBaseCost.value = h.avgCost.toFixed(2);
                        calculateDCA();
                    });
                    dcaAssetMenu.appendChild(item);
                });
            });

            document.addEventListener('click', (e) => {
                if (!dcaAssetBtn.contains(e.target) && !dcaAssetMenu.contains(e.target)) {
                    dcaAssetMenu.classList.add('hidden');
                }
            });
        }

        document.getElementById('btn-add-tranche')?.addEventListener('click', () => {
            const container = document.getElementById('dca-tranches');
            const row = document.createElement('div');
            row.className = 'flex items-center gap-2 tranche-row mt-2';
            row.innerHTML = `
                <input type="number" placeholder="Shares" class="flex-1 bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-white text-sm font-medium outline-none focus:border-primary tranche-shares" step="any">
                <span class="text-slate-500 font-bold text-xs">x</span>
                <input type="number" placeholder="Price ($)" class="flex-1 bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-white text-sm font-medium outline-none focus:border-primary tranche-price" step="any">
                <button type="button" class="text-danger hover:text-red-400 p-1 btn-remove-tranche opacity-50 hover:opacity-100"><span class="material-symbols-outlined text-[16px]">close</span></button>
            `;
            container.appendChild(row);

            row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', calculateDCA));
            row.querySelector('.btn-remove-tranche').addEventListener('click', (e) => {
                e.target.closest('.tranche-row').remove();
                calculateDCA();
            });
        });

        document.querySelectorAll('.tranche-shares, .tranche-price').forEach(inp => inp.addEventListener('input', calculateDCA));
        document.querySelectorAll('.btn-remove-tranche').forEach(btn => btn.addEventListener('click', (e) => {
            e.target.closest('.tranche-row').remove();
            calculateDCA();
        }));
    },

    // ==========================================
    // 📌 4. ระบบ Benchmark & Metrics
    // ==========================================
    fetchIndexHistory: async (sym, range) => {
        const cacheKey = `koda_idx_${sym}_${range}`;
        const cached = JSON.parse(localStorage.getItem(cacheKey));
        const now = Date.now();

        if (cached && (now - cached.timestamp < 43200000) && cached.data && cached.data.length > 0) return cached.data;

        const FINNHUB_API_KEY = window.ENV_KEYS?.FINNHUB || '';

        if (sym === 'BTC-USD') {
            try {
                let limit = 30; let interval = '1d';
                if (range === '6mo') limit = 180;
                else if (range === '1y') limit = 365;
                else if (range === '5y') { limit = 260; interval = '1w'; }
                
                const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`);
                const data = await res.json();
                if (data && data.length > 0) {
                    const cleanData = data.map(k => ({ t: k[0], c: parseFloat(k[4]) }));
                    localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: cleanData }));
                    return cleanData;
                }
            } catch(e) {}
        }

        if ((sym === 'SPY' || sym === 'QQQ') && FINNHUB_API_KEY) {
            try {
                const to = Math.floor(Date.now() / 1000);
                let days = 30; let resType = 'D';
                if (range === '6mo') days = 180;
                else if (range === '1y') days = 365;
                else if (range === '5y') { days = 1825; resType = 'W'; }
                const from = to - (days * 24 * 60 * 60);

                const fhRes = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=${resType}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`);
                const fhData = await fhRes.json();
                if (fhData && fhData.s === 'ok' && fhData.c.length > 0) {
                    const cleanData = fhData.c.map((price, idx) => ({ t: fhData.t[idx] * 1000, c: price }));
                    localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: cleanData }));
                    return cleanData;
                }
            } catch(e) {}
        }

        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=${range}&interval=${range === '5y' ? '1wk' : '1d'}`;
        const proxies = [
            `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
        ];
        
        for (let proxy of proxies) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); 
                const res = await fetch(proxy, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!res.ok) continue;
                
                const rawData = await res.json();
                let yfData;
                if (rawData.contents) {
                    try { yfData = JSON.parse(rawData.contents); } catch(e) { yfData = rawData.contents; }
                } else {
                    yfData = rawData;
                }

                if (yfData && yfData.chart && yfData.chart.result && yfData.chart.result[0]) {
                    const result = yfData.chart.result[0];
                    const closes = result.indicators.quote[0].close;
                    const timestamps = result.timestamp;
                    
                    const cleanData = [];
                    for(let i=0; i < closes.length; i++) {
                        if(closes[i] !== null) cleanData.push({ t: timestamps[i] * 1000, c: closes[i] });
                    }
                    
                    if (cleanData.length > 0) {
                        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: cleanData }));
                        return cleanData;
                    }
                }
            } catch(e) { console.warn("Proxy fallback triggered/failed"); }
        }
        return null;
    },

    renderBenchmark: async () => {
        const ctx = document.getElementById('benchmark-chart');
        if (!ctx) return;

        try {
            const portHistory = JSON.parse(localStorage.getItem('koda_equity_history') || '[]');
            const portData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{"holdings":[]}');
            let totalCost = 0;
            (portData.holdings || []).forEach(h => { totalCost += (h.shares * h.avgCost); });

            const benchSym = window.KodaAnalytics.activeBenchmark;
            const range = window.KodaAnalytics.activeRange;
            
            const benchNameMap = { 'SPY': 'S&P 500', 'QQQ': 'NASDAQ', 'BTC-USD': 'Bitcoin' };
            const rangeNameMap = { '1mo': '1M', '6mo': '6M', '1y': '1Y', '5y': '5Y' };
            
            document.getElementById('bench-index-name').textContent = `${benchNameMap[benchSym]} (${rangeNameMap[range]})`;
            document.getElementById('bench-port-name').textContent = `My Portfolio (${rangeNameMap[range]})`;
            
            document.getElementById('bench-index-val').textContent = "...";
            document.getElementById('bench-index-val').className = "text-sm font-bold text-slate-500 mt-1 animate-pulse";

            const indexData = await window.KodaAnalytics.fetchIndexHistory(benchSym, range);
            
            if (!indexData || indexData.length === 0) { 
                document.getElementById('bench-index-val').textContent = "API Error"; 
                document.getElementById('bench-index-val').className = "text-sm font-bold text-danger mt-1";
                return; 
            }

            const labels = indexData.map(d => new Date(d.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: range === '5y' ? '2-digit' : undefined }));
            const indexBase = indexData[0].c;
            const indexPct = indexData.map(d => ((d.c - indexBase) / indexBase) * 100);

            let portPct = new Array(indexData.length).fill(0); 
            
            if (portHistory.length > 0 && totalCost > 0) {
                const validPortDays = Math.min(portHistory.length, indexData.length);
                for (let i = 1; i <= validPortDays; i++) {
                    const pVal = portHistory[portHistory.length - i].value;
                    if (pVal > 0) portPct[indexData.length - i] = ((pVal - totalCost) / totalCost) * 100;
                    else portPct[indexData.length - i] = 0;
                }
            }

            const portFinalPct = portPct[portPct.length - 1] || 0;
            const indexFinalPct = indexPct[indexPct.length - 1] || 0;

            const pEl = document.getElementById('bench-port-val');
            pEl.textContent = `${portFinalPct >= 0 ? '+' : ''}${portFinalPct.toFixed(2)}%`;
            pEl.className = `text-xl font-black ${portFinalPct >= 0 ? 'text-success' : 'text-danger'}`;

            const iEl = document.getElementById('bench-index-val');
            iEl.textContent = `${indexFinalPct >= 0 ? '+' : ''}${indexFinalPct.toFixed(2)}%`;
            iEl.className = `text-xl font-black ${indexFinalPct >= 0 ? 'text-success' : 'text-danger'}`;

            if (window.KodaAnalytics.benchmarkChartInstance) window.KodaAnalytics.benchmarkChartInstance.destroy();

            window.KodaAnalytics.benchmarkChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'My Portfolio P/L', data: portPct, borderColor: '#34a8eb', borderWidth: 3, pointRadius: 0, tension: 0.3 },
                        { label: benchNameMap[benchSym], data: indexPct, borderColor: '#64748b', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, tension: 0.3 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw >= 0 ? '+' : ''}${ctx.raw.toFixed(2)}%` } } },
                    scales: { x: { display: false }, y: { position: 'right', grid: { color: '#232b3e' }, ticks: { color: '#94a3b8', callback: (val) => val + '%' } } }
                }
            });
        } catch (error) {
            document.getElementById('bench-index-val').textContent = "Chart Error"; 
            document.getElementById('bench-index-val').className = "text-sm font-bold text-danger mt-1";
        }
    },

    calculateMetrics: () => {
        const data = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{"holdings":[]}');
        const holdings = data.holdings || [];
        if (holdings.length === 0) { document.getElementById('stat-winrate').textContent = "0%"; document.getElementById('stat-top-asset').textContent = "N/A"; return; }

        let greenCount = 0; let topAsset = null; let topPct = -9999; let totalPortValue = 0;

        holdings.forEach(h => {
            const price = h.currentPrice || h.avgCost; const value = h.shares * price; const profitPct = ((price - h.avgCost) / h.avgCost) * 100;
            if (profitPct > 0) greenCount++;
            if (profitPct > topPct) { topPct = profitPct; topAsset = h.symbol; }
            h.calculatedValue = value; totalPortValue += value;
        });

        const winRate = (greenCount / holdings.length) * 100;
        document.getElementById('stat-winrate').textContent = `${winRate.toFixed(0)}%`;
        document.getElementById('stat-winrate').className = `text-3xl font-black ${winRate >= 50 ? 'text-success' : 'text-danger'}`;

        const topAssetEl = document.getElementById('stat-top-asset'); const topValEl = document.getElementById('stat-top-val');
        if (topPct > 0) {
            topAssetEl.textContent = topAsset; topAssetEl.className = "text-xl font-black text-white truncate w-full px-2";
            topValEl.textContent = `+${topPct.toFixed(2)}%`; topValEl.className = "text-sm font-bold text-success mt-0.5";
        } else {
            topAssetEl.textContent = "No Winners"; topAssetEl.className = "text-sm font-bold text-slate-500 mt-2"; topValEl.textContent = "";
        }

        const barContainer = document.getElementById('stat-allocation-bar'); const labelContainer = document.getElementById('stat-allocation-labels');
        const colors = ['#34a8eb', '#00c076', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];
        holdings.sort((a, b) => b.calculatedValue - a.calculatedValue);
        
        let barHtml = ''; let labelHtml = '';
        holdings.forEach((h, index) => {
            const weight = (h.calculatedValue / totalPortValue) * 100; const color = colors[index % colors.length];
            if (weight > 0) {
                barHtml += `<div style="width: ${weight}%; background-color: ${color};" class="h-full border-r border-background-dark last:border-0 transition-all"></div>`;
                labelHtml += `<div class="flex items-center gap-1.5 bg-background-dark border border-border-dark px-2 py-1 rounded-md"><div class="size-2 rounded-full" style="background-color: ${color};"></div><span class="text-[10px] font-bold text-slate-300">${h.symbol} <span class="text-slate-500 font-normal ml-0.5">${weight.toFixed(0)}%</span></span></div>`;
            }
        });
        barContainer.innerHTML = barHtml; labelContainer.innerHTML = labelHtml;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.KodaAnalytics.initLabMode(); 
    window.KodaAnalytics.initTabs();     
    window.KodaAnalytics.initDCA();      
});
