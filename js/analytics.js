// 🚀 KODA Analytics Module (Ultimate Stable Version)
window.KodaAnalytics = {
    benchmarkChartInstance: null,
    activeBenchmark: 'SPY', 
    activeRange: '1mo',     

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

        if (symInput) {
            const parentDiv = symInput.closest('.flex-1');
            if (parentDiv) {
                parentDiv.classList.add('relative');
                const dropdown = document.createElement('div');
                dropdown.id = 'lab-search-dropdown';
                dropdown.className = 'hidden absolute left-0 right-0 top-full mt-2 bg-surface-dark border border-border-dark rounded-xl shadow-2xl z-[200] max-h-[200px] overflow-y-auto no-scrollbar';
                parentDiv.appendChild(dropdown);

                let searchTimeout;
                symInput.addEventListener('input', (e) => {
                    const query = e.target.value.trim().toUpperCase();
                    clearTimeout(searchTimeout);
                    if (query.length < 1) { dropdown.classList.add('hidden'); return; }

                    dropdown.classList.remove('hidden');
                    dropdown.innerHTML = `<div class="p-3 text-center text-xs text-slate-500 animate-pulse">Searching...</div>`;

                    searchTimeout = setTimeout(async () => {
                        const FINNHUB_API_KEY = window.ENV_KEYS?.FINNHUB || '';
                        try {
                            const res = await fetch(`https://finnhub.io/api/v1/search?q=${query}&token=${FINNHUB_API_KEY}`);
                            const data = await res.json();
                            if (data && data.result && data.result.length > 0) {
                                dropdown.innerHTML = data.result.slice(0, 5).map(item => `
                                    <div class="px-3 py-2.5 border-b border-border-dark/50 hover:bg-slate-800 cursor-pointer text-white text-sm transition-colors flex justify-between items-center lab-search-item" data-sym="${item.displaySymbol}">
                                        <span class="font-bold">${item.displaySymbol}</span>
                                        <span class="text-slate-500 text-[10px] truncate max-w-[120px] ml-2">${item.description}</span>
                                    </div>
                                `).join('');

                                document.querySelectorAll('.lab-search-item').forEach(el => {
                                    el.addEventListener('click', () => {
                                        symInput.value = el.getAttribute('data-sym');
                                        dropdown.classList.add('hidden');
                                        window.KodaAnalytics.fetchRealSR(symInput.value); 
                                    });
                                });
                            } else {
                                dropdown.innerHTML = `<div class="p-3 text-center text-xs text-slate-500">No results found</div>`;
                            }
                        } catch (err) {
                            dropdown.innerHTML = `<div class="p-3 text-center text-xs text-danger">Search failed</div>`;
                        }
                    }, 300);
                });

                document.addEventListener('click', (e) => {
                    if (!symInput.contains(e.target) && !dropdown.contains(e.target)) {
                        dropdown.classList.add('hidden');
                    }
                });
            }
        }

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

            // 🚀 ก๊อกที่ 1: Crypto ดึงจาก Binance
            if (sym === 'BTC' || sym === 'ETH') sym += 'USDT';
            if (sym.includes('USDT') || sym.includes('BINANCE:')) {
                const coin = sym.replace('BINANCE:', '');
                try {
                    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${coin}&interval=1d&limit=180`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.length > 0) {
                            data.forEach(k => { highs.push(parseFloat(k[2])); lows.push(parseFloat(k[3])); closes.push(parseFloat(k[4])); });
                            fetched = true;
                        }
                    }
                } catch(e) {}
            } 
            
            // 🚀 ก๊อกที่ 2: หุ้นปกติ ยิงเข้า Vercel Yahoo Proxy เป็นหลัก! (ข้อมูลแม่นยำที่สุด)
            if (!fetched) {
                let yfSym = sym;
                if (sym === 'XAUUSD') yfSym = 'GC=F';
                else if (sym.includes('.HK')) yfSym = sym.split('.')[0].padStart(4, '0') + '.HK';
                else if (sym.includes('.BK')) yfSym = sym; 

                try {
                    const proxyUrl = `/api/yf-chart/${yfSym}?range=6mo&interval=1d`;
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 6000); 
                    const res = await fetch(proxyUrl, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    
                    if (res.ok) {
                        const yfData = await res.json();
                        if (yfData?.chart?.result?.[0]) {
                            const quote = yfData.chart.result[0].indicators.quote[0];
                            for (let i = 0; i < quote.close.length; i++) {
                                if (quote.close[i] !== null && quote.high[i] !== null && quote.low[i] !== null) {
                                    highs.push(quote.high[i]); lows.push(quote.low[i]); closes.push(quote.close[i]);
                                }
                            }
                            if (closes.length > 10) fetched = true;
                        }
                    }
                } catch(e) { console.warn("Vercel Yahoo Proxy failed in Lab:", e); }
            }

            // 🚀 ก๊อกที่ 3: Finnhub (เผื่อฉุกเฉิน)
            if (!fetched && !sym.includes('.BK')) {
                const FINNHUB_API_KEY = window.ENV_KEYS?.FINNHUB || '';
                if(FINNHUB_API_KEY) {
                    try {
                        const to = Math.floor(Date.now() / 1000);
                        const from = to - (180 * 24 * 60 * 60); 
                        const fhSym = sym === 'XAUUSD' ? 'OANDA:XAU_USD' : sym;
                        const fhRes = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${fhSym}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`);
                        if (fhRes.ok) {
                            const fhData = await fhRes.json();
                            if (fhData && fhData.s === 'ok' && fhData.c.length > 0) {
                                highs = fhData.h; lows = fhData.l; closes = fhData.c;
                                fetched = true;
                            }
                        }
                    } catch(e) {}
                }
            }

            if (!fetched || closes.length === 0) throw new Error("No Data Found");
            const lastClose = closes[closes.length - 1];

            // --- อัลกอริทึมคำนวณ S/R ---
            let swingHighs = [];
            let swingLows = [];
            const lookback = 4; 
            
            for (let i = lookback; i < closes.length - lookback; i++) {
                let isHigh = true, isLow = true;
                for (let j = 1; j <= lookback; j++) {
                    if (highs[i] < highs[i-j] || highs[i] < highs[i+j]) isHigh = false;
                    if (lows[i] > lows[i-j] || lows[i] > lows[i+j]) isLow = false;
                }
                if (isHigh) swingHighs.push(highs[i]);
                if (isLow) swingLows.push(lows[i]);
            }

            const recentHigh = Math.max(...highs.slice(-60));
            const recentLow = Math.min(...lows.slice(-60));
            swingHighs.push(recentHigh);
            swingLows.push(recentLow);

            const clusterLevels = (levels) => {
                let sorted = [...levels].sort((a, b) => a - b);
                let clustered = [];
                let currentCluster = [];
                for (let i = 0; i < sorted.length; i++) {
                    if (currentCluster.length === 0) {
                        currentCluster.push(sorted[i]);
                    } else {
                        let avg = currentCluster.reduce((a,b)=>a+b)/currentCluster.length;
                        if (Math.abs(sorted[i] - avg) / avg < 0.015) {
                            currentCluster.push(sorted[i]);
                        } else {
                            clustered.push(currentCluster.reduce((a,b)=>a+b)/currentCluster.length);
                            currentCluster = [sorted[i]];
                        }
                    }
                }
                if (currentCluster.length > 0) clustered.push(currentCluster.reduce((a,b)=>a+b)/currentCluster.length);
                return clustered;
            };

            let cleanResists = clusterLevels(swingHighs).filter(lvl => lvl > lastClose * 1.005).sort((a,b) => a - b);
            let cleanSupports = clusterLevels(swingLows).filter(lvl => lvl < lastClose * 0.995).sort((a,b) => b - a);

            let atrSum = 0;
            for(let i = closes.length-14; i<closes.length; i++) {
                if(i>0) atrSum += Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1]));
            }
            let atr = (atrSum / 14) || (lastClose * 0.02);
            atr = Math.max(lastClose * 0.015, Math.min(atr, lastClose * 0.04));

            while(cleanResists.length < 4) {
                let nextR = cleanResists.length > 0 ? cleanResists[cleanResists.length-1] + atr : lastClose + atr;
                cleanResists.push(nextR);
            }
            while(cleanSupports.length < 5) {
                let nextS = cleanSupports.length > 0 ? cleanSupports[cleanSupports.length-1] - atr : lastClose - atr;
                if (nextS <= 0) nextS = cleanSupports[cleanSupports.length-1] * 0.9; 
                cleanSupports.push(nextS);
            }

            const decimals = lastClose < 1 ? 4 : 2;
            const format = (v) => parseFloat(v.toFixed(decimals));
            
            window.KodaAnalytics.tradeMatrixData.resistances = cleanResists.slice(0, 4).map(format);
            window.KodaAnalytics.tradeMatrixData.supports = cleanSupports.slice(0, 5).map(format);
            
            window.KodaAnalytics.renderTradeMatrix();
            
            const symInput = document.getElementById('lab-symbol-input');
            if (symInput) symInput.value = sym;

        } catch(e) {
            alert(`ไม่พบข้อมูลกราฟของหุ้น "${symbol}"\nลองใช้ Ticker อื่น (เช่น NVDA, AAPL)`);
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

    initTabs: () => {
        const tabs = ['simulator', 'avgcost', 'benchmark', 'metrics', 'aifund']; 
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

    // 📌 [NEW] เพิ่มฟังก์ชัน Simulator 
    initSimulator: () => {
        let selectedWhatIfAsset = null;

        const calculateWhatIf = () => {
            if (!selectedWhatIfAsset) return;
            const targetInput = document.getElementById('whatif-target');
            const resultEl = document.getElementById('whatif-result');
            const resultPctEl = document.getElementById('whatif-result-pct');
            if (!targetInput || !resultEl || !resultPctEl) return;

            const targetPrice = parseFloat(targetInput.value);
            if (isNaN(targetPrice)) {
                resultEl.textContent = "$0.00";
                resultPctEl.textContent = "0.00%";
                return;
            }

            const totalCost = selectedWhatIfAsset.shares * selectedWhatIfAsset.cost;
            const projectedValue = selectedWhatIfAsset.shares * targetPrice;
            const profit = projectedValue - totalCost;
            const profitPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
            const isUp = profit >= 0;

            resultEl.textContent = `${isUp ? '+' : ''}$${Math.abs(profit).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            resultEl.className = `text-3xl font-black text-center transition-colors ${isUp ? 'text-success' : 'text-danger'}`;
            
            resultPctEl.textContent = `${isUp ? '+' : ''}${profitPct.toFixed(2)}%`;
            resultPctEl.className = `text-center text-sm font-bold mt-1 ${isUp ? 'text-success/80' : 'text-danger/80'}`;
        };

        const btn = document.getElementById('whatif-asset-btn');
        const menu = document.getElementById('whatif-asset-menu');
        const label = document.getElementById('whatif-asset-label');

        if (btn && menu) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('hidden');
                
                const data = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{"holdings":[]}');
                const holdings = data.holdings || [];
                
                menu.innerHTML = '';
                if (holdings.length === 0) {
                    menu.innerHTML = '<div class="px-4 py-3 text-slate-500 text-sm font-bold">Portfolio is empty</div>';
                    return;
                }

                holdings.forEach(h => {
                    const item = document.createElement('div');
                    item.className = 'px-4 py-3 border-b border-border-dark/50 hover:bg-slate-800 cursor-pointer text-white font-bold text-sm transition-colors flex justify-between items-center';
                    item.innerHTML = `<span>${h.symbol}</span> <span class="text-slate-500 text-[10px] font-normal bg-background-dark px-2 py-0.5 rounded border border-border-dark">${h.shares} sh</span>`;
                    
                    item.addEventListener('click', () => {
                        label.textContent = `${h.symbol} (${h.shares} sh)`;
                        label.classList.remove('text-slate-400');
                        label.classList.add('text-white');
                        menu.classList.add('hidden');
                        
                        selectedWhatIfAsset = { symbol: h.symbol, shares: h.shares, cost: h.avgCost };
                        document.getElementById('whatif-avg-cost').value = `$${h.avgCost.toFixed(2)}`;
                        document.getElementById('whatif-target').value = (h.currentPrice || h.avgCost).toFixed(2);
                        
                        calculateWhatIf();
                    });
                    menu.appendChild(item);
                });
            });

            document.addEventListener('click', (e) => {
                if (!btn.contains(e.target) && !menu.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            });
        }

        document.getElementById('whatif-target')?.addEventListener('input', calculateWhatIf);
    },

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

        const fetchSupportsForDCA = async (symbol, lastCloseFallback) => {
            try {
                let sym = symbol.toUpperCase().trim();
                let highs = [], lows = [], closes = [];
                let fetched = false;

                // 🚀 ก๊อก 1: Crypto (Binance)
                if (sym === 'BTC' || sym === 'ETH') sym += 'USDT';
                if (sym.includes('USDT') || sym.includes('BINANCE:')) {
                    const coin = sym.replace('BINANCE:', '');
                    try {
                        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${coin}&interval=1d&limit=180`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data && data.length > 0) {
                                data.forEach(k => { highs.push(parseFloat(k[2])); lows.push(parseFloat(k[3])); closes.push(parseFloat(k[4])); });
                                fetched = true;
                            }
                        }
                    } catch(e) {}
                } 
                
                // 🚀 ก๊อก 2: Yahoo Finance (Vercel Proxy)
                if (!fetched) {
                    let yfSym = sym;
                    if (sym === 'XAUUSD') yfSym = 'GC=F';
                    else if (sym.includes('.HK')) yfSym = sym.split('.')[0].padStart(4, '0') + '.HK';
                    else if (sym.includes('.BK')) yfSym = sym; 
                    
                    try {
                        const proxyUrl = `/api/yf-chart/${yfSym}?range=6mo&interval=1d`;
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 5000); 
                        const res = await fetch(proxyUrl, { signal: controller.signal });
                        clearTimeout(timeoutId);
                        
                        if (res.ok) {
                            const yfData = await res.json();
                            if (yfData?.chart?.result?.[0]) {
                                const quote = yfData.chart.result[0].indicators.quote[0];
                                for (let i = 0; i < quote.close.length; i++) {
                                    if (quote.close[i] !== null && quote.high[i] !== null && quote.low[i] !== null) {
                                        highs.push(quote.high[i]); lows.push(quote.low[i]); closes.push(quote.close[i]);
                                    }
                                }
                                if (closes.length > 10) fetched = true;
                            }
                        }
                    } catch(e) {}
                }

                // 🚀 ก๊อก 3: Finnhub
                if (!fetched && !sym.includes('.BK')) {
                    const FINNHUB_API_KEY = window.ENV_KEYS?.FINNHUB || '';
                    if (FINNHUB_API_KEY) {
                        try {
                            const to = Math.floor(Date.now() / 1000);
                            const from = to - (180 * 24 * 60 * 60); 
                            const fhSym = sym === 'XAUUSD' ? 'OANDA:XAU_USD' : sym;
                            const fhRes = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${fhSym}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`);
                            if (fhRes.ok) {
                                const fhData = await fhRes.json();
                                if (fhData && fhData.s === 'ok' && fhData.c.length > 0) {
                                    highs = fhData.h; lows = fhData.l; closes = fhData.c;
                                    fetched = true;
                                }
                            }
                        } catch(e) {}
                    }
                }

                if (!fetched || closes.length === 0) throw new Error("No Data");
                
                const lastClose = closes[closes.length - 1];
                let swingLows = [];
                const lookback = 4; 
                for (let i = lookback; i < closes.length - lookback; i++) {
                    let isLow = true;
                    for (let j = 1; j <= lookback; j++) { if (lows[i] > lows[i-j] || lows[i] > lows[i+j]) isLow = false; }
                    if (isLow) swingLows.push(lows[i]);
                }
                swingLows.push(Math.min(...lows.slice(-60)));

                const clusterLevels = (levels) => {
                    let sorted = [...levels].sort((a, b) => a - b);
                    let clustered = [];
                    let currentCluster = [];
                    for (let i = 0; i < sorted.length; i++) {
                        if (currentCluster.length === 0) currentCluster.push(sorted[i]);
                        else {
                            let avg = currentCluster.reduce((a,b)=>a+b)/currentCluster.length;
                            if (Math.abs(sorted[i] - avg) / avg < 0.015) currentCluster.push(sorted[i]);
                            else { clustered.push(currentCluster.reduce((a,b)=>a+b)/currentCluster.length); currentCluster = [sorted[i]]; }
                        }
                    }
                    if (currentCluster.length > 0) clustered.push(currentCluster.reduce((a,b)=>a+b)/currentCluster.length);
                    return clustered;
                };

                let cleanSupports = clusterLevels(swingLows).filter(lvl => lvl < lastClose * 0.995).sort((a,b) => b - a);

                let atrSum = 0;
                for(let i = closes.length-14; i<closes.length; i++) {
                    if(i>0) atrSum += Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1]));
                }
                let atr = (atrSum / 14) || (lastClose * 0.02);
                atr = Math.max(lastClose * 0.015, Math.min(atr, lastClose * 0.04));

                while(cleanSupports.length < 5) {
                    let nextS = cleanSupports.length > 0 ? cleanSupports[cleanSupports.length-1] - atr : lastClose - atr;
                    if (nextS <= 0) nextS = cleanSupports[cleanSupports.length-1] * 0.9; 
                    cleanSupports.push(nextS);
                }
                
                const decimals = lastClose < 1 ? 4 : 2;
                return cleanSupports.slice(0, 5).map(v => parseFloat(v.toFixed(decimals)));
            } catch (e) {
                const p = lastCloseFallback || 100;
                const decimals = p < 1 ? 4 : 2;
                return [p*0.95, p*0.90, p*0.85, p*0.80, p*0.75].map(v => parseFloat(v.toFixed(decimals)));
            }
        };
        
        const createRow = (idx, priceVal = '') => {
            const row = document.createElement('div');
            row.className = 'flex items-center gap-1.5 tranche-row mt-2';
            row.innerHTML = `
                <span class="text-slate-500 font-bold text-[10px] w-4 text-center shrink-0">S${idx}</span>
                <input type="number" placeholder="Shares" class="flex-1 min-w-0 bg-surface-dark border border-border-dark rounded-md px-2 py-1.5 text-white text-xs font-medium outline-none focus:border-primary tranche-shares" step="any">
                <span class="text-slate-600 font-bold text-[10px] shrink-0">x</span>
                <div class="flex-1 min-w-0 relative">
                    <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-bold">$</span>
                    <input type="number" placeholder="Price" class="w-full bg-surface-dark border border-border-dark rounded-md pl-5 pr-2 py-1.5 text-white text-xs font-medium outline-none focus:border-primary tranche-price" step="any" value="${priceVal}">
                </div>
                <button type="button" class="text-danger hover:text-red-400 p-1 btn-remove-tranche opacity-50 hover:opacity-100 shrink-0"><span class="material-symbols-outlined text-[14px]">close</span></button>
            `;
            return row;
        };

        const dcaAssetInput = document.getElementById('dca-asset-input');
        const dcaAssetMenu = document.getElementById('dca-asset-menu');
        const dcaBaseShares = document.getElementById('dca-base-shares');
        const dcaBaseCost = document.getElementById('dca-base-cost');
        const container = document.getElementById('dca-tranches');

        if (dcaAssetInput && dcaAssetMenu) {
            let searchTimeout;

            dcaAssetInput.addEventListener('focus', () => {
                if (dcaAssetInput.value.trim().length === 0) {
                    const portData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{"holdings":[]}');
                    const holdings = portData.holdings || [];
                    
                    if (holdings.length > 0) {
                        dcaAssetMenu.classList.remove('hidden');
                        dcaAssetMenu.innerHTML = `<div class="p-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest border-b border-border-dark/50">My Portfolio</div>` + 
                        holdings.map(h => `
                            <div class="px-3 py-2.5 border-b border-border-dark/50 hover:bg-slate-800 cursor-pointer text-white text-sm transition-colors flex justify-between items-center dca-search-item" data-sym="${h.symbol}">
                                <div class="flex items-center gap-1">
                                    <span class="font-bold">${h.symbol}</span>
                                    <span class="text-slate-400 text-[10px] ml-2 font-medium">(${h.shares} sh)</span>
                                </div>
                                <span class="material-symbols-outlined text-yellow-500 text-[14px] fill-icon drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]">star</span>
                            </div>
                        `).join('');
                        attachClickEvents(holdings);
                    }
                }
            });

            dcaAssetInput.addEventListener('input', (e) => {
                const query = e.target.value.trim().toUpperCase();
                clearTimeout(searchTimeout);
                
                const portData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{"holdings":[]}');
                const holdings = portData.holdings || [];

                if (query.length < 1) { 
                    dcaAssetInput.dispatchEvent(new Event('focus'));
                    return; 
                }

                dcaAssetMenu.classList.remove('hidden');
                dcaAssetMenu.innerHTML = `<div class="p-3 text-center text-xs text-slate-500 animate-pulse">Searching global markets...</div>`;

                searchTimeout = setTimeout(async () => {
                    const FINNHUB_API_KEY = window.ENV_KEYS?.FINNHUB || '';
                    try {
                        const res = await fetch(`https://finnhub.io/api/v1/search?q=${query}&token=${FINNHUB_API_KEY}`);
                        const data = await res.json();

                        if (data && data.result && data.result.length > 0) {
                            dcaAssetMenu.innerHTML = `<div class="p-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest border-b border-border-dark/50">Search Results</div>` + 
                            data.result.slice(0, 6).map(item => {
                                const sym = item.displaySymbol;
                                const holding = holdings.find(h => h.symbol === sym);
                                
                                const starIcon = holding ? `<span class="material-symbols-outlined text-yellow-500 text-[14px] fill-icon drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]">star</span>` : '';
                                const sharesInfo = holding ? `<span class="text-slate-400 text-[10px] ml-2 font-medium">(${holding.shares} sh)</span>` : '';

                                return `
                                <div class="px-3 py-2.5 border-b border-border-dark/50 hover:bg-slate-800 cursor-pointer text-white text-sm transition-colors flex justify-between items-center dca-search-item" data-sym="${sym}">
                                    <div class="flex items-center gap-1 truncate pr-2">
                                        <span class="font-bold">${sym}</span>
                                        ${sharesInfo}
                                    </div>
                                    <div class="flex items-center gap-2 shrink-0">
                                        <span class="text-slate-500 text-[10px] truncate max-w-[120px]">${item.description}</span>
                                        ${starIcon}
                                    </div>
                                </div>
                            `}).join('');
                            attachClickEvents(holdings);
                        } else {
                            dcaAssetMenu.innerHTML = `<div class="p-3 text-center text-xs text-slate-500">No results found</div>`;
                        }
                    } catch (err) {
                        dcaAssetMenu.innerHTML = `<div class="p-3 text-center text-xs text-danger">Search failed</div>`;
                    }
                }, 300);
            });

            const attachClickEvents = (holdings) => {
                document.querySelectorAll('.dca-search-item').forEach(el => {
                    el.addEventListener('click', async () => {
                        const sym = el.getAttribute('data-sym');
                        dcaAssetInput.value = sym;
                        dcaAssetMenu.classList.add('hidden');
                        
                        const holding = holdings.find(h => h.symbol === sym);
                        
                        if (holding) {
                            dcaBaseShares.value = holding.shares;
                            dcaBaseCost.value = holding.avgCost.toFixed(2);
                        } else {
                            dcaBaseShares.value = 0;
                            dcaBaseCost.value = 0;
                        }
                        calculateDCA();

                        dcaAssetInput.disabled = true;
                        const origColor = dcaAssetInput.className;
                        dcaAssetInput.classList.add('text-primary', 'animate-pulse');
                        dcaAssetInput.value = `Calculating S/R for ${sym}...`;
                        
                        let currentPrice = holding ? (holding.currentPrice || holding.avgCost) : 100; 
                        const supports = await fetchSupportsForDCA(sym, currentPrice);
                        
                        dcaAssetInput.value = sym;
                        dcaAssetInput.className = origColor;
                        dcaAssetInput.disabled = false;

                        if(container) {
                            container.innerHTML = ''; 
                            supports.forEach((s, idx) => {
                                const row = createRow(idx + 1, s);
                                container.appendChild(row);
                                row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', calculateDCA));
                                row.querySelector('.btn-remove-tranche').addEventListener('click', (e) => {
                                    e.target.closest('.tranche-row').remove();
                                    calculateDCA();
                                });
                            });
                            calculateDCA();
                        }
                    });
                });
            };

            document.addEventListener('click', (e) => {
                if (!dcaAssetInput.contains(e.target) && !dcaAssetMenu.contains(e.target)) {
                    dcaAssetMenu.classList.add('hidden');
                }
            });
        }

        document.getElementById('btn-add-tranche')?.addEventListener('click', () => {
            if(container) {
                const currentRows = container.querySelectorAll('.tranche-row').length;
                const row = createRow(currentRows + 1);
                container.appendChild(row);
                row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', calculateDCA));
                row.querySelector('.btn-remove-tranche').addEventListener('click', (e) => {
                    e.target.closest('.tranche-row').remove();
                    calculateDCA();
                });
            }
        });

        document.querySelectorAll('.tranche-shares, .tranche-price').forEach(inp => inp.addEventListener('input', calculateDCA));
        document.querySelectorAll('.btn-remove-tranche').forEach(btn => btn.addEventListener('click', (e) => {
            e.target.closest('.tranche-row').remove();
            calculateDCA();
        }));
    },

    fetchIndexHistory: async (sym, range) => {
        const cacheKey = `koda_idx_v2_${sym}_${range}`;
        const cached = JSON.parse(localStorage.getItem(cacheKey));
        const now = Date.now();

        // แคชไว้ 1 ชม. ลดการยิง API ถี่เกินไป
        if (cached && (now - cached.timestamp < 3600000) && cached.data && cached.data.length > 0) return cached.data;

        // 🚀 ก๊อก 1: ถ้าเป็น BTC ดึงตรงจาก Binance เร็วที่สุด
        if (sym === 'BTC-USD') {
            try {
                let limit = 30; let interval = '1d';
                if (range === '6mo') limit = 180;
                else if (range === '1y') limit = 365;
                else if (range === '5y') { limit = 1825; } // บังคับรายวัน
                
                // Binance รับได้สูงสุด 1000 แท่ง
                if (limit > 1000) limit = 1000; 
                
                const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`);
                const data = await res.json();
                if (data && data.length > 0) {
                    const cleanData = data.map(k => ({ t: k[0], c: parseFloat(k[4]) }));
                    localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: cleanData }));
                    return cleanData;
                }
            } catch(e) {}
        } 
        // 🚀 ก๊อก 2: หุ้น/ดัชนี (SPY, QQQ) ดึงผ่าน Vercel Yahoo Proxy โดยตรง
        else {
            const yfRange = range === '6mo' ? '6mo' : (range === '1y' ? '1y' : (range === '5y' ? '5y' : '1mo'));
            const yfInterval = '1d'; // บังคับรายวันเสมอ
            const proxyUrl = `/api/yf-chart/${sym}?range=${yfRange}&interval=${yfInterval}`;
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000); 
                const res = await fetch(proxyUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const yfData = await res.json();

                    if (yfData?.chart?.result?.[0]) {
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
                }
            } catch(e) { console.warn("Vercel Yahoo Proxy failed for Benchmark:", e); }

            // 🚀 ก๊อก 3: Fallback Finnhub (กันเหนียว)
            const FINNHUB_API_KEY = window.ENV_KEYS?.FINNHUB || '';
            if (FINNHUB_API_KEY) {
                try {
                    const to = Math.floor(Date.now() / 1000);
                    let days = 30;
                    if (range === '6mo') days = 180;
                    else if (range === '1y') days = 365;
                    else if (range === '5y') days = 1825; 
                    const from = to - (days * 24 * 60 * 60);

                    const fhRes = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`);
                    if (fhRes.ok) {
                        const fhData = await fhRes.json();
                        if (fhData && fhData.s === 'ok' && fhData.c && fhData.c.length > 0) {
                            const cleanData = fhData.c.map((price, idx) => ({ t: fhData.t[idx] * 1000, c: price }));
                            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: cleanData }));
                            return cleanData;
                        }
                    }
                } catch(e) {}
            }
        }
        
        return null;
    },

    renderBenchmark: async () => {
        const ctx = document.getElementById('benchmark-chart');
        if (!ctx) return;

        const benchSym = window.KodaAnalytics.activeBenchmark;
        const range = window.KodaAnalytics.activeRange;
        const benchNameMap = { 'SPY': 'S&P 500', 'QQQ': 'NASDAQ', 'BTC-USD': 'Bitcoin' };
        const rangeNameMap = { '1mo': '1M', '6mo': '6M', '1y': '1Y', '5y': '5Y' };
        
        document.getElementById('bench-index-name').textContent = `${benchNameMap[benchSym]} (${rangeNameMap[range]})`;
        document.getElementById('bench-port-name').textContent = `My Portfolio (${rangeNameMap[range]})`;
        
        document.getElementById('bench-index-val').textContent = "Loading...";
        document.getElementById('bench-index-val').className = "text-sm font-bold text-slate-500 mt-1 animate-pulse";

        const indexData = await window.KodaAnalytics.fetchIndexHistory(benchSym, range);
        
        if (!indexData || indexData.length === 0) { 
            document.getElementById('bench-index-val').textContent = "Data Error"; 
            document.getElementById('bench-index-val').className = "text-sm font-bold text-danger mt-1";
            return; 
        }

        const portData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{"holdings":[]}');
        let totalCost = 0, totalVal = 0;
        (portData.holdings || []).forEach(h => {
            totalCost += (h.shares * h.avgCost);
            totalVal += (h.shares * (h.currentPrice || h.avgCost));
        });
        const actualPortPct = totalCost > 0 ? ((totalVal - totalCost) / totalCost) * 100 : 0;

        const labels = indexData.map(d => new Date(d.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: range === '5y' ? '2-digit' : undefined }));
        const indexBase = indexData[0].c;
        const indexPct = indexData.map(d => ((d.c - indexBase) / indexBase) * 100);
        const indexFinalPct = indexPct[indexPct.length - 1];

        let portPct = new Array(indexData.length).fill(0);
        let portHistory = JSON.parse(localStorage.getItem('koda_equity_history') || '[]');
        
        if (portHistory.length > 0) {
            let startIdx = 0;
            for (let i = 0; i < portHistory.length; i++) {
                if (portHistory[i].value > 0) { startIdx = i; break; }
            }
            let startVal = portHistory[startIdx].value;
            let endVal = portHistory[portHistory.length - 1].value;
            let valRange = endVal - startVal;

            for (let i = 0; i < indexData.length; i++) {
                let d = new Date(indexData[i].t);
                let targetDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                let pEntry = portHistory.find(h => h.date === targetDate);
                if (!pEntry) {
                    let prevEntries = portHistory.filter(h => h.date <= targetDate);
                    if (prevEntries.length > 0) pEntry = prevEntries[prevEntries.length - 1];
                }

                if (pEntry && pEntry.date >= portHistory[startIdx].date) {
                    if (valRange === 0) {
                        portPct[i] = (pEntry.value === startVal) ? 0 : actualPortPct;
                    } else {
                        portPct[i] = actualPortPct * ((pEntry.value - startVal) / valRange);
                    }
                } else {
                    portPct[i] = 0; 
                }
            }
            portPct[portPct.length - 1] = actualPortPct;
        }

        const pEl = document.getElementById('bench-port-val');
        pEl.textContent = `${actualPortPct >= 0 ? '+' : ''}${actualPortPct.toFixed(2)}%`;
        pEl.className = `text-xl font-black ${actualPortPct >= 0 ? 'text-success' : 'text-danger'}`;

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
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw >= 0 ? '+' : ''}${ctx.raw.toFixed(2)}%` } } },
                scales: { x: { display: false }, y: { position: 'right', grid: { color: '#232b3e' }, ticks: { color: '#94a3b8', callback: (val) => val + '%' } } },
                interaction: { intersect: false, mode: 'index' }
            }
        });
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

// 📌 [FIX] ระบบ Auto-Init ปลุกสคริปต์ให้ทำงาน 100%
const initKodaAnalytics = () => {
    if (window.KodaAnalytics) {
        window.KodaAnalytics.initLabMode(); 
        window.KodaAnalytics.initTabs();  
        window.KodaAnalytics.initSimulator(); // 📌 เพิ่มฟังก์ชันนี้เข้ามาให้ปุ่มกดได้ 
        window.KodaAnalytics.initDCA();   
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKodaAnalytics);
} else {
    initKodaAnalytics(); 
}
