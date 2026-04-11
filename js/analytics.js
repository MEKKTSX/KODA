// 🚀 KODA Analytics Module (Real Swing Pivots + CORS-Safe API)
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

        // ระบบ Auto-complete Search คงเดิม
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
            
            const FINNHUB_API_KEY = window.ENV_KEYS?.FINNHUB || '';

            // 1. Binance (Crypto)
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
            
            // 2. Finnhub (US Stocks - ปลอดภัยบน Github Pages)
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

            // 3. 📌 [FIX GITHUB PAGES CORS] ใช้ allorigins.win/get ทะลวงบล็อก
            if (!fetched) {
                let yfSym = sym;
                if (sym === 'XAUUSD') yfSym = 'GC=F';
                else if (sym.includes('.HK')) yfSym = sym.split('.')[0].padStart(4, '0') + '.HK';
                else if (sym.includes('.BK')) yfSym = sym; 

                // Encode URL ให้เรียบร้อยเพื่อกัน Error
                const targetUrl = encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${yfSym}?range=6mo&interval=1d`);
                const proxyUrl = `https://api.allorigins.win/get?url=${targetUrl}`;

                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 8000); // ให้เวลาดึง 8 วิ
                    const res = await fetch(proxyUrl, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    
                    if (res.ok) {
                        const rawData = await res.json();
                        // ดึงข้อมูล String ก้อนข้างในมาแปลงเป็น JSON
                        if (rawData.contents) {
                            const data = JSON.parse(rawData.contents);
                            if (data?.chart?.result?.[0]) {
                                const quote = data.chart.result[0].indicators.quote[0];
                                for (let i = 0; i < quote.close.length; i++) {
                                    if (quote.close[i] !== null && quote.high[i] !== null && quote.low[i] !== null) {
                                        highs.push(quote.high[i]); lows.push(quote.low[i]); closes.push(quote.close[i]);
                                    }
                                }
                                if (closes.length > 10) fetched = true;
                            }
                        }
                    }
                } catch(e) {
                    console.warn("Yahoo API Fallback Failed", e);
                }
            }

            if (!fetched || closes.length === 0) throw new Error("No Data Found");
            const lastClose = closes[closes.length - 1];

            // ==========================================
            // 📌 [REAL INVESTOR S/R] Swing Pivots + Clustering
            // ==========================================
            let swingHighs = [];
            let swingLows = [];
            const lookback = 4; // ตรวจจับยอด/ฐานในรอบ 8 วัน (หน้า 4 หลัง 4)
            
            for (let i = lookback; i < closes.length - lookback; i++) {
                let isHigh = true, isLow = true;
                for (let j = 1; j <= lookback; j++) {
                    if (highs[i] < highs[i-j] || highs[i] < highs[i+j]) isHigh = false;
                    if (lows[i] > lows[i-j] || lows[i] > lows[i+j]) isLow = false;
                }
                if (isHigh) swingHighs.push(highs[i]);
                if (isLow) swingLows.push(lows[i]);
            }

            // เพิ่มจุดสูงสุด/ต่ำสุดในระยะสั้นกันเหนียว
            const recentHigh = Math.max(...highs.slice(-60));
            const recentLow = Math.min(...lows.slice(-60));
            swingHighs.push(recentHigh);
            swingLows.push(recentLow);

            // ฟังก์ชันจัดกลุ่ม (Cluster) ราคาที่ซ้อนทับกัน (ห่างกันไม่เกิน 1.5%) ให้เป็นเส้นเดียว
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
                            currentCluster.push(sorted[i]); // อยู่กลุ่มเดียวกัน
                        } else {
                            clustered.push(currentCluster.reduce((a,b)=>a+b)/currentCluster.length);
                            currentCluster = [sorted[i]]; // เริ่มกลุ่มใหม่
                        }
                    }
                }
                if (currentCluster.length > 0) clustered.push(currentCluster.reduce((a,b)=>a+b)/currentCluster.length);
                return clustered;
            };

            // แยกแนวรับ (ต่ำกว่าราคาปัจจุบัน) และ แนวต้าน (สูงกว่าราคาปัจจุบัน)
            let cleanResists = clusterLevels(swingHighs).filter(lvl => lvl > lastClose * 1.005).sort((a,b) => a - b);
            let cleanSupports = clusterLevels(swingLows).filter(lvl => lvl < lastClose * 0.995).sort((a,b) => b - a); // เรียงจากใกล้ไปไกล

            // คำนวณความผันผวนจริง (ATR) เพื่อใช้หาระยะห่างที่สมเหตุสมผล เผื่อกรณีราคาทำ All-time High/Low 
            let atrSum = 0;
            for(let i = closes.length-14; i<closes.length; i++) {
                if(i>0) atrSum += Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1]));
            }
            let atr = (atrSum / 14) || (lastClose * 0.02);
            // บีบให้ระยะห่างอยู่ที่ 1.5% ถึง 4% ตามหลักการเทรด (ไม่กว้างหรือแคบเกินไป)
            atr = Math.max(lastClose * 0.015, Math.min(atr, lastClose * 0.04));

            // เติมช่องว่างให้ครบ 4 ต้าน 5 รับ
            while(cleanResists.length < 4) {
                let nextR = cleanResists.length > 0 ? cleanResists[cleanResists.length-1] + atr : lastClose + atr;
                cleanResists.push(nextR);
            }
            while(cleanSupports.length < 5) {
                let nextS = cleanSupports.length > 0 ? cleanSupports[cleanSupports.length-1] - atr : lastClose - atr;
                if (nextS <= 0) nextS = cleanSupports[cleanSupports.length-1] * 0.9; // กันราคาติดลบ
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
            alert(`ไม่พบข้อมูลกราฟของหุ้น "${symbol}" (เกิดข้อผิดพลาดในการดึงข้อมูล)\nลองเลือกชื่อจาก Dropdown ตอนค้นหาดูครับ`);
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
    // 📌 2. ระบบแท็บย่อยใน Modal (คงเดิม)
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
    // 📌 3. ระบบ DCA (คงเดิม)
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
    // 📌 4. ระบบ Benchmark (Real API & Real Port P/L & Ultra Stable Proxies)
    // ==========================================
    fetchIndexHistory: async (sym, range) => {
        const cacheKey = `koda_idx_${sym}_${range}`;
        const cached = JSON.parse(localStorage.getItem(cacheKey));
        const now = Date.now();

        // แคช 1 ชม. ลดการยิง API ซ้ำซ้อน
        if (cached && (now - cached.timestamp < 3600000) && cached.data && cached.data.length > 0) return cached.data;

        const FINNHUB_API_KEY = window.ENV_KEYS?.FINNHUB || '';

        // 1. Binance สำหรับ Crypto (ไม่มีปัญหา CORS, เร็วที่สุด)
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
        } else {
            // 2. ดึงจาก Finnhub (ถ้ามี API Key และไม่ติด Limit)
            if (FINNHUB_API_KEY) {
                try {
                    const to = Math.floor(Date.now() / 1000);
                    let days = 30; let resType = 'D';
                    if (range === '6mo') days = 180;
                    else if (range === '1y') days = 365;
                    else if (range === '5y') { days = 1825; resType = 'W'; }
                    const from = to - (days * 24 * 60 * 60);

                    const fhRes = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=${resType}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`);
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

            // 3. ทะลวง CORS ดึงจาก Yahoo Finance (เปลี่ยนมาใช้ท่อที่เสถียรที่สุด 3 ชั้น)
            const yfRange = range === '6mo' ? '6mo' : (range === '1y' ? '1y' : (range === '5y' ? '5y' : '1mo'));
            const yfInterval = range === '5y' ? '1wk' : '1d';
            const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${yfRange}&interval=${yfInterval}`;
            
            const proxies = [
                `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
                `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
                `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
            ];
            
            for (let proxyUrl of proxies) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 6000); // รอ 6 วิ ถ้าค้างให้ตัดไปท่ออื่น
                    const res = await fetch(proxyUrl, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (res.ok) {
                        const rawData = await res.json();
                        let yfData = rawData;
                        
                        // ป้องกัน Error จาก AllOrigins ที่ชอบห่อ JSON มาเป็น String
                        if (rawData.contents) {
                            try { yfData = JSON.parse(rawData.contents); } catch(e) {}
                        }

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
                } catch(e) { /* ข้ามท่อที่พังไปทำท่อถัดไปแบบเงียบๆ */ }
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

        // 1. ดึงข้อมูลจริงจาก API แบบเสถียร
        const indexData = await window.KodaAnalytics.fetchIndexHistory(benchSym, range);
        
        if (!indexData || indexData.length === 0) { 
            document.getElementById('bench-index-val').textContent = "Data Error"; 
            document.getElementById('bench-index-val').className = "text-sm font-bold text-danger mt-1";
            return; 
        }

        // 2. คำนวณ P/L พอร์ตจริง (ตัด Cash ออก คิดแค่มูลค่าหุ้น vs ต้นทุนหุ้น)
        const portData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{"holdings":[]}');
        let totalCost = 0, totalVal = 0;
        (portData.holdings || []).forEach(h => {
            totalCost += (h.shares * h.avgCost);
            totalVal += (h.shares * (h.currentPrice || h.avgCost));
        });
        const actualPortPct = totalCost > 0 ? ((totalVal - totalCost) / totalCost) * 100 : 0;

        // 3. เตรียมข้อมูลแกน X (วันที่) และ Y (Index)
        const labels = indexData.map(d => new Date(d.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: range === '5y' ? '2-digit' : undefined }));
        const indexBase = indexData[0].c;
        const indexPct = indexData.map(d => ((d.c - indexBase) / indexBase) * 100);
        const indexFinalPct = indexPct[indexPct.length - 1];

        // 4. วาดกราฟพอร์ตจาก History จริงๆ ของผู้ใช้
        let portPct = new Array(indexData.length).fill(0);
        let portHistory = JSON.parse(localStorage.getItem('koda_equity_history') || '[]');
        
        if (portHistory.length > 0) {
            // หาจุดเริ่มต้นจริงๆ ของพอร์ต (วันแรกที่เงิน > 0)
            let startIdx = 0;
            for (let i = 0; i < portHistory.length; i++) {
                if (portHistory[i].value > 0) { startIdx = i; break; }
            }
            let startVal = portHistory[startIdx].value;
            let endVal = portHistory[portHistory.length - 1].value;
            let valRange = endVal - startVal;

            for (let i = 0; i < indexData.length; i++) {
                // จัด Format วันที่ให้ตรงกัน YYYY-MM-DD
                let d = new Date(indexData[i].t);
                let targetDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                // หาข้อมูลพอร์ตของวันนั้น
                let pEntry = portHistory.find(h => h.date === targetDate);
                if (!pEntry) {
                    // ถ้าไม่มี (เช่น เสาร์-อาทิตย์) ให้ย้อนไปหาวันทำการล่าสุด
                    let prevEntries = portHistory.filter(h => h.date <= targetDate);
                    if (prevEntries.length > 0) pEntry = prevEntries[prevEntries.length - 1];
                }

                // สร้างเส้นกราฟ
                if (pEntry && pEntry.date >= portHistory[startIdx].date) {
                    if (valRange === 0) {
                        portPct[i] = (pEntry.value === startVal) ? 0 : actualPortPct;
                    } else {
                        // ดึงรูปทรงกราฟจริง (รวมฝาก/ถอน) มาปรับสเกลให้ไปจบที่ actualPortPct
                        portPct[i] = actualPortPct * ((pEntry.value - startVal) / valRange);
                    }
                } else {
                    portPct[i] = 0; // ก่อนหน้าวันที่เริ่มพอร์ต ให้กราฟแบนราบที่ 0%
                }
            }
            // ล็อคจุดสุดท้ายให้ตัวเลขตรงกับ Label UI 100%
            portPct[portPct.length - 1] = actualPortPct;
        }

        // 5. อัปเดต UI 
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

document.addEventListener('DOMContentLoaded', () => {
    window.KodaAnalytics.initLabMode(); 
    window.KodaAnalytics.initTabs();     
    window.KodaAnalytics.initDCA();      
});
