document.addEventListener('DOMContentLoaded', () => {
    
    // 📌 1. ดึง Keys ปลอดภัย
    const finnhubKeys = (window.ENV_KEYS?.FINNHUB_ARRAY && window.ENV_KEYS.FINNHUB_ARRAY.length > 0) 
                        ? window.ENV_KEYS.FINNHUB_ARRAY 
                        : (window.ENV_KEYS?.FINNHUB ? window.ENV_KEYS.FINNHUB.split(',').map(k => k.trim()).filter(Boolean) : ['']);
    let fhKeyIndex = 0;
    const getFHKey = () => {
        if (!finnhubKeys.length) return '';
        const key = finnhubKeys[fhKeyIndex % finnhubKeys.length];
        fhKeyIndex++;
        return key;
    };
    
    const AV_API_KEY = window.ENV_KEYS?.ALPHAVANTAGE || ''; 

    const urlParams = new URLSearchParams(window.location.search);
    const symbol = urlParams.get('symbol') || 'TSLA'; 

    document.getElementById('detail-symbol').textContent = symbol.toUpperCase();
    let currentStockName = symbol; 

    const isCrypto = symbol.includes('BINANCE:') || symbol.includes('COINBASE:');
    const isThaiStock = symbol.includes('.BK');

    // ==========================================
    // 📌 ระบบ TABS 
    // ==========================================
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    let loadedTabs = { chart: true, company: false, analysis: false, quarterly: false, financials: false, news: false };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active', 'text-primary', 'border-primary'));
            tabs.forEach(t => t.classList.add('text-slate-400'));
            tab.classList.add('active', 'text-primary', 'border-primary');
            tab.classList.remove('text-slate-400');

            const targetId = tab.getAttribute('data-target');
            contents.forEach(c => {
                if (c.id === targetId) { 
                    c.classList.remove('hidden'); 
                    c.classList.add('block'); 
                } 
                else { 
                    c.classList.remove('block'); 
                    c.classList.add('hidden'); 
                }
            });

            if (targetId === 'tab-company' && !loadedTabs.company) { fetchCompanySummary(); loadedTabs.company = true; }
            
            // 📌 จุดแก้บัค: เมื่อกดแท็บ "บทวิเคราะห์"
            if (targetId === 'tab-analysis') {
                if (!loadedTabs.analysis) {
                    fetchAnalysisData(); 
                    loadedTabs.analysis = true; 
                } else if (taChartInstance) {
                    // ถ้าโหลดไว้แล้ว ให้บังคับ Resize กราฟใหม่ เพื่อแก้บัคกราฟแอบซ่อน
                    setTimeout(() => {
                        const container = document.getElementById('ta-chart-container');
                        if (container && container.clientWidth > 0) {
                            taChartInstance.resize(container.clientWidth, 220);
                            taChartInstance.timeScale().fitContent(); // ขยับสเกลให้พอดีจอ
                        }
                    }, 50); // ดีเลย์นิดนึงให้กล่องโชว์ออกมาก่อน
                }
            }
            
            if (targetId === 'tab-quarterly' && !loadedTabs.quarterly) { fetchQuarterlyEarnings(); loadedTabs.quarterly = true; }
            if (targetId === 'tab-financials' && !loadedTabs.financials) { fetchFinancialData(); loadedTabs.financials = true; }
            if (targetId === 'tab-news' && !loadedTabs.news) { fetchLatestNews(); loadedTabs.news = true; }
        });
    });

    // ==========================================
    // 📌 Watchlist (Star) 
    // ==========================================
    const btnStar = document.getElementById('btn-toggle-star');
    const iconStar = document.getElementById('icon-star');
    const modalRemove = document.getElementById('modal-remove-star');

    const updateStarUI = () => {
        if (!iconStar) return;
        const data = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{"watchlist":[]}');
        const isStarred = data.watchlist && data.watchlist.some(s => s.symbol === symbol);
        if (isStarred) {
            iconStar.classList.add('fill-icon', 'text-primary');
            iconStar.classList.remove('text-slate-300');
        } else {
            iconStar.classList.remove('fill-icon', 'text-primary');
            iconStar.classList.add('text-slate-300');
        }
    };

    if (btnStar) {
        updateStarUI(); 
        btnStar.addEventListener('click', () => {
            let data = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{"watchlist":[]}');
            if (!data.watchlist) data.watchlist = [];
            
            const exists = data.watchlist.some(s => s.symbol === symbol);
            if (exists) {
                document.getElementById('remove-symbol-text').textContent = symbol;
                modalRemove.classList.remove('hidden');
                modalRemove.classList.add('flex');
                setTimeout(() => modalRemove.classList.remove('opacity-0'), 10);
            } else {
                data.watchlist.push({ symbol: symbol, name: currentStockName, currentPrice: parseFloat(document.getElementById('detail-price').dataset.rawPrice || 0), previousClose: 0 });
                localStorage.setItem('koda_portfolio_data', JSON.stringify(data));
                updateStarUI();
            }
        });
    }

    document.getElementById('btn-cancel-remove')?.addEventListener('click', () => {
        modalRemove.classList.add('opacity-0');
        setTimeout(() => { modalRemove.classList.add('hidden'); modalRemove.classList.remove('flex'); }, 200);
    });

    document.getElementById('btn-confirm-remove')?.addEventListener('click', () => {
        let data = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{"watchlist":[]}');
        data.watchlist = data.watchlist.filter(s => s.symbol !== symbol);
        localStorage.setItem('koda_portfolio_data', JSON.stringify(data));
        updateStarUI();
        document.getElementById('btn-cancel-remove')?.click();
    });

    // ==========================================
    // 📌 ดึงข้อมูลราคา (Real-Time 5 วินาที)
    // ==========================================
    const fetchYFQuote = async (sym) => {
        try {
            const res = await fetch(`/api/price?symbol=${encodeURIComponent(sym)}&_=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) return null;
            const data = await res.json();
            if (data.success) return data; 
        } catch (e) {}
        return null;
    };

    const renderPriceUI = (data, source = 'yf') => {
        const priceEl = document.getElementById('detail-price');
        const changeEl = document.getElementById('detail-change');
        const extContainer = document.getElementById('extended-price-container');
        const extLabelEl = document.getElementById('extended-label');
        const extPriceEl = document.getElementById('extended-price');
        const extChangeEl = document.getElementById('extended-change');
        const dotEl = document.getElementById('market-status-dot');

        let currentPrice, change, percentChange, currencyCode, isPositive;
        let extPrice = null, extChange = null, extPercent = null, stateText = '';

        if (source === 'yf') {
            currentPrice = data.regularMarketPrice || data.preMarketPrice || data.postMarketPrice;
            change = data.regularMarketChange !== undefined ? data.regularMarketChange : 0;
            percentChange = data.regularMarketChangePercent !== undefined ? data.regularMarketChangePercent : 0;
            currencyCode = data.currency || 'USD';
            isPositive = change >= 0;

            const marketState = data.marketState;

            if (marketState === 'PRE') {
                extPrice = data.preMarketPrice || data.regularMarketPreviousClose;
                extChange = data.preMarketChange || 0;
                extPercent = data.preMarketChangePercent || 0;
                stateText = '☀️ ก่อนตลาดเปิด';
            } else if (marketState === 'REGULAR') {
                extPrice = null; 
            } else if (marketState === 'POST' || marketState === 'CLOSED') {
                extPrice = data.postMarketPrice || currentPrice;
                extChange = data.postMarketChange || 0;
                extPercent = data.postMarketChangePercent || 0;
                stateText = '🌑 หลังตลาดปิด';
            }
            
            if (marketState === 'REGULAR') {
                dotEl.classList.remove('hidden', 'bg-slate-600');
                dotEl.classList.add('bg-success'); 
            } else {
                dotEl.classList.remove('hidden', 'bg-success');
                dotEl.classList.add('bg-slate-600'); 
            }
        } else {
            currentPrice = data.c;
            change = data.d;
            percentChange = data.dp;
            currencyCode = symbol.includes('.HK') ? 'HKD' : (symbol.includes('.SS') ? 'CNY' : 'USD');
            isPositive = change >= 0;
            extPrice = null;
            dotEl.classList.add('hidden');
        }

        if (currentPrice === undefined || currentPrice === null) return;

        const fmtPrice = (num) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        if (priceEl.dataset.rawPrice && parseFloat(priceEl.dataset.rawPrice) !== currentPrice) {
            priceEl.classList.remove('price-update');
            void priceEl.offsetWidth; 
            priceEl.classList.add('price-update');
        }
        
        priceEl.dataset.rawPrice = currentPrice;
        priceEl.textContent = fmtPrice(currentPrice);
        document.getElementById('detail-currency').textContent = currencyCode;
        
        changeEl.className = `text-sm font-bold flex items-center gap-1 mt-1 ${isPositive ? 'text-success' : 'text-danger'}`;
        changeEl.innerHTML = `<span class="material-symbols-outlined text-[16px]">${isPositive ? 'arrow_upward' : 'arrow_downward'}</span> ${Math.abs(change).toFixed(2)} (${Math.abs(percentChange).toFixed(2)}%)`;

        if (extPrice !== null && extPrice !== undefined) {
            extContainer.classList.remove('hidden');
            extContainer.classList.add('flex'); 
            extLabelEl.textContent = stateText;
            
            if (extPriceEl.dataset.rawPrice && parseFloat(extPriceEl.dataset.rawPrice) !== extPrice) {
                extPriceEl.classList.remove('price-update');
                void extPriceEl.offsetWidth; 
                extPriceEl.classList.add('price-update');
            }
            extPriceEl.dataset.rawPrice = extPrice;
            extPriceEl.textContent = fmtPrice(extPrice);
            
            document.getElementById('extended-currency').textContent = currencyCode;
            
            if (extPercent === 0 || !extPercent) {
                extChangeEl.textContent = `(0.00%)`;
                extChangeEl.className = `font-bold text-[11px] mt-0.5 text-slate-500`;
            } else {
                const isExtPos = extPercent > 0;
                const sign = isExtPos ? '+' : ''; 
                extChangeEl.textContent = `${sign}${extPercent.toFixed(2)}%`;
                extChangeEl.className = `font-bold text-[11px] mt-0.5 ml-1 ${isExtPos ? 'text-success' : 'text-danger'}`;
            }
        } else {
            extContainer.classList.remove('flex');
            extContainer.classList.add('hidden');
        }
        // ==========================================
        // 📌 อัปเดตกราฟ KODA & RSI แบบ Real-time (ทุก 5 วิ)
        // ==========================================
        if (window.kodaCandleSeries && window.kodaChartCandles && window.kodaChartCandles.length > 0) {
            let lastCandle = window.kodaChartCandles[window.kodaChartCandles.length - 1];
            
            // 1. ดันราคาแท่งเทียนแท่งล่าสุดให้ขยับตาม Real-time
            lastCandle.close = currentPrice;
            if (currentPrice > lastCandle.high) lastCandle.high = currentPrice;
            if (currentPrice < lastCandle.low) lastCandle.low = currentPrice;
            
            window.kodaCandleSeries.update(lastCandle);

            // 2. คำนวณ RSI จุดสุดท้ายใหม่ตามราคาที่เพิ่งขยับ
            if (window.kodaRsiSeries && window.kodaChartCandles.length > 14) {
                let closes = window.kodaChartCandles.map(c => c.close);
                let gains = [], losses = [];
                
                for (let i = 1; i < closes.length; i++) {
                    let diff = closes[i] - closes[i - 1];
                    gains.push(Math.max(0, diff));
                    losses.push(Math.max(0, -diff));
                }
                
                let sumGain = 0, sumLoss = 0;
                for(let i=0; i<14; i++) { sumGain += gains[i]; sumLoss += losses[i]; }
                let avgGain = sumGain / 14, avgLoss = sumLoss / 14;
                
                for (let i = 15; i < closes.length; i++) {
                    avgGain = ((avgGain * 13) + gains[i-1]) / 14;
                    avgLoss = ((avgLoss * 13) + losses[i-1]) / 14;
                }
                
                let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                let currentRSI = 100 - (100 / (1 + rs));
                
                window.kodaRsiSeries.update({ time: lastCandle.time, value: currentRSI });
            }
        }
    };

    let isRealtimeRunning = false;
    const startRealtimeEngine = () => {
        const fetchAndUpdateYF = async () => {
            try {
                const yfData = await fetchYFQuote(symbol);
                if (yfData) {
                    renderPriceUI(yfData, 'yf');
                } else {
                    const cleanSym = symbol.split(':')[1] || symbol.split('.')[0];
                    const fhData = await fetch(`https://finnhub.io/api/v1/quote?symbol=${cleanSym}&token=${getFHKey()}&_=${Date.now()}`).then(r=>r.json());
                    if(fhData && fhData.c > 0) renderPriceUI(fhData, 'finnhub');
                }
            } catch(e) {}
        };
        fetchAndUpdateYF(); 
        if(!isRealtimeRunning) {
            // 🚀 อัปเดตทุกๆ 5 วิ
            setInterval(fetchAndUpdateYF, 5000); 
            isRealtimeRunning = true;
        }
    };

    const loadPriceAndOHLC = async () => {
        try {
            const cleanSym = symbol.split(':')[1] || symbol.split('.')[0];
            const quoteRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${cleanSym}&token=${getFHKey()}`);
            const quote = await quoteRes.json();
            if (quote && quote.c > 0) renderPriceUI(quote, 'finnhub');
            
            startRealtimeEngine(); 

            let metricObj = null, profile = null;
            if (!isThaiStock && !isCrypto) {
                const [mRes, pRes] = await Promise.all([
                    fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${cleanSym}&metric=all&token=${getFHKey()}`).then(r=>r.json()),
                    fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${cleanSym}&token=${getFHKey()}`).then(r=>r.json())
                ]);
                metricObj = mRes; profile = pRes;
            }

            if (profile && profile.name) {
                currentStockName = profile.name;
                document.getElementById('detail-name').textContent = profile.name;
            }

            if (quote && quote.c > 0) {
                const fmt = (num, suffix='') => (num !== undefined && num !== null) ? num.toFixed(2) + suffix : '-';
                document.getElementById('stat-open').textContent = fmt(quote.o);
                document.getElementById('stat-prev').textContent = fmt(quote.pc);
                document.getElementById('stat-high').textContent = fmt(quote.h);
                document.getElementById('stat-low').textContent = fmt(quote.l);
                
                if (metricObj && metricObj.metric) {
                    const m = metricObj.metric;
                    document.getElementById('stat-52high').textContent = fmt(m['52WeekHigh']);
                    document.getElementById('stat-52low').textContent = fmt(m['52WeekLow']);
                    document.getElementById('stat-pe').textContent = fmt(m.peExclExtraTTM);
                    document.getElementById('stat-ps').textContent = fmt(m.psTTM);
                    document.getElementById('stat-eps').textContent = fmt(m.epsTTM);
                    document.getElementById('stat-div').textContent = fmt(m.dividendYieldIndicatedAnnual, '%');
                    // 🚀 4 ค่าการเงินใหม่ (อัปเดตให้ FCF ดึงข้อมูลได้ครอบคลุมขึ้น)
                    const fcfValue = m.freeCashFlowPerShareTTM || m.cashFlowPerShareTTM || m.freeCashFlowAnnual || m.cashFlowPerShareAnnual;
                    
                    document.getElementById('stat-fcf').textContent = fmt(fcfValue);
                    document.getElementById('stat-roe').textContent = fmt(m.roeTTM, '%');
                    document.getElementById('stat-cr').textContent = fmt(m.currentRatioQuarterly || m.currentRatioAnnual);
                    document.getElementById('stat-de').textContent = fmt(m['totalDebt/totalEquityQuarterly'] || m['totalDebt/totalEquityAnnual']);
                }
                if (profile && profile.marketCapitalization) {
                    const mcap = profile.marketCapitalization;
                    document.getElementById('stat-mcap').textContent = mcap > 1000 ? (mcap/1000).toFixed(2)+'B' : mcap.toFixed(2)+'M';
                }
            }
        } catch (e) { console.error("OHLC fetch error:", e); }
    };
    loadPriceAndOHLC();

    // ==========================================
    // 📌 ตัวดึงกราฟหลัก (อัปเกรด โหลดตรงไปตรงมา ไม่หมุนรอนาน)
    // ==========================================
    const loadLightweightCharts = () => new Promise((resolve) => {
        if (window.LightweightCharts) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js';
        script.onload = resolve; document.head.appendChild(script);
    });
    
    const fetchCandleData = async (tfRange) => {
    const rangeMap = { '1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', '2Y': '2y', '5Y': '5y' }; 
    const intervalMap = { '1M': '1d', '3M': '1d', '6M': '1d', '1Y': '1d', '2Y': '1d', '5Y': '1wk' };
    const daysMap = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730, '5Y': 1825 };
    const fhResMap = { '1M': 'D', '3M': 'D', '6M': 'D', '1Y': 'D', '2Y': 'D', '5Y': 'W' };

    let cleanSym = symbol.split(':')[1] || symbol.split('.')[0];
    
    // 🚀 ก๊อกที่ 1: คริปโต (Binance) - ฟรีและดีที่สุด
    if (isCrypto) {
        try {
            let coin = cleanSym.replace('USDT', '').replace('USD', '') + 'USDT';
            let limit = daysMap[tfRange] || 365;
            let interval = tfRange === '5Y' ? '1w' : '1d';
            const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${coin}&interval=${interval}&limit=${limit}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    return {
                        timestamps: data.map(k => k[0] / 1000),
                        opens: data.map(k => parseFloat(k[1])),
                        highs: data.map(k => parseFloat(k[2])),
                        lows: data.map(k => parseFloat(k[3])),
                        closes: data.map(k => parseFloat(k[4])),
                        volumes: data.map(k => parseFloat(k[5]))
                    };
                }
            }
        } catch(e) {}
    }

    // 🚀 ก๊อกที่ 2: หุ้นทั่วไป (ยิง Yahoo Finance ผ่านท่อ Vercel Proxy ของเราเอง)
    const yfRange = rangeMap[tfRange] || '1y';
    const yfInterval = intervalMap[tfRange] || '1d';
    let yfSym = symbol;
    if (symbol === 'XAUUSD') yfSym = 'GC=F';
    else if (symbol.includes('.HK')) yfSym = symbol.split('.')[0].padStart(4, '0') + '.HK';

    if (!isThaiStock && !isCrypto) {
        try {
            // ยิงเข้าหา Vercel Backend ตัวเอง (ไม่ต้องพึ่งเว็บ Proxy นอกแล้ว)
            const proxyUrl = `/api/yf-chart/${yfSym}?range=${yfRange}&interval=${yfInterval}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // รอสูงสุด 5 วิ
            const res = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const yfData = await res.json();
                
                if (yfData?.chart?.result?.[0]) {
                    const q = yfData.chart.result[0].indicators.quote[0];
                    const tRaw = yfData.chart.result[0].timestamp;
                    const timestamps = [], opens = [], highs = [], lows = [], closes = [], volumes = [];
                    for(let i=0; i<tRaw.length; i++) {
                        if(q.close[i] !== null && q.open[i] !== null && q.high[i] !== null && q.low[i] !== null) {
                            timestamps.push(tRaw[i]); opens.push(q.open[i]); highs.push(q.high[i]);
                            lows.push(q.low[i]); closes.push(q.close[i]); volumes.push(q.volume[i] || 0);
                        }
                    }
                    if (closes.length > 0) return { timestamps, opens, highs, lows, closes, volumes };
                }
            }
        } catch(err) { 
            console.warn('Vercel Yahoo Proxy failed:', err); 
        }
    }

    // 🚀 ก๊อกที่ 3: Fallback Finnhub (กันเหนียวสุดๆ)
    if (!isThaiStock && !isCrypto) {
        try {
            const to = Math.floor(Date.now() / 1000);
            const from = to - (daysMap[tfRange] * 24 * 60 * 60);
            const res = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${cleanSym}&resolution=${fhResMap[tfRange]}&from=${from}&to=${to}&token=${getFHKey()}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.s === 'ok' && data.c && data.c.length > 0) {
                    return { timestamps: data.t, opens: data.o, highs: data.h, lows: data.l, closes: data.c, volumes: data.v };
                }
            }
        } catch(e) {}
    }

    return null;
};
    
    // ==========================================
    // 📌 TAB 1: กราฟ KODA S/R + Profit Matrix
    // ==========================================
    window.KodaTradeMatrix = { capital: 200, supports: [], resistances: [] };

    const renderTradeMatrix = () => {
        const head = document.getElementById('detail-matrix-head');
        const body = document.getElementById('detail-matrix-body');
        if (!head || !body) return;

        const { capital, supports, resistances } = window.KodaTradeMatrix;
        if(supports.length === 0) return;

        let headHTML = `<tr><th class="p-3 border-r border-border-dark bg-background-dark/80 w-24 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.2)]"><span class="text-yellow-500 font-bold text-sm uppercase tracking-wider">ซื้อที่</span></th>`;
        resistances.forEach((r, i) => {
            headHTML += `<th class="p-3 border-r border-border-dark min-w-[95px] bg-background-dark/30"><div class="text-primary font-black text-sm mb-1">R${i+1}</div><div class="flex items-center justify-center text-slate-300 font-bold text-xs">$ <input type="number" value="${r}" data-idx="${i}" class="input-r w-16 bg-transparent text-center border-b border-transparent focus:border-primary outline-none transition-colors p-0 m-0"></div></th>`;
        });
        headHTML += `</tr>`;
        head.innerHTML = headHTML;

        let bodyHTML = '';
        supports.forEach((s, sIdx) => {
            bodyHTML += `<tr><td class="p-3 border-r border-t border-border-dark bg-surface-dark sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.2)]"><div class="text-yellow-500 font-black text-sm mb-1">S${sIdx+1}</div><div class="flex items-center justify-center text-slate-300 font-bold text-xs">$ <input type="number" value="${s}" data-idx="${sIdx}" class="input-s w-16 bg-transparent text-center border-b border-transparent focus:border-yellow-500 outline-none transition-colors p-0 m-0"></div></td>`;
            resistances.forEach((r) => {
                const pct = s > 0 ? ((r - s) / s) * 100 : 0;
                const profit = (pct / 100) * capital;
                const isPos = profit >= 0;
                const colorCls = isPos ? 'text-success' : 'text-danger';
                const sign = isPos ? '+' : '';
                bodyHTML += `<td class="p-3 border-r border-t border-border-dark hover:bg-slate-800 transition-colors"><div class="${colorCls} font-black text-[15px] mb-0.5">${sign}$${Math.abs(profit).toFixed(2)}</div><div class="${colorCls} font-bold text-[10px]">(${sign}${pct.toFixed(2)}%)</div></td>`;
            });
            bodyHTML += `</tr>`;
        });
        body.innerHTML = bodyHTML;

        document.querySelectorAll('.input-r').forEach(inp => inp.addEventListener('change', (e) => { window.KodaTradeMatrix.resistances[e.target.dataset.idx] = parseFloat(e.target.value) || 0; renderTradeMatrix(); }));
        document.querySelectorAll('.input-s').forEach(inp => inp.addEventListener('change', (e) => { window.KodaTradeMatrix.supports[e.target.dataset.idx] = parseFloat(e.target.value) || 0; renderTradeMatrix(); }));
    };

    const capInput = document.getElementById('detail-capital-input');
    if (capInput) capInput.addEventListener('input', (e) => { window.KodaTradeMatrix.capital = parseFloat(e.target.value) || 0; renderTradeMatrix(); });

    const renderChart = () => {
        const tvContainer = document.getElementById('tv-chart-container');
        const kodaContainer = document.getElementById('koda-chart-container');
        const btnTV = document.getElementById('btn-chart-tv');
        const btnKoda = document.getElementById('btn-chart-koda');
        const tfSelector = document.getElementById('tf-selector');
        
        let currentChartMode = 'koda'; // 📌 ตั้ง KODA เป็น Default
        let currentTimeframe = '1Y';
        let kodaChartInstance = null;

        const initTV = () => {
            let tvSym = symbol;
            if (symbol === 'XAUUSD') tvSym = 'OANDA:XAUUSD';
            else if (symbol.includes(':')) tvSym = symbol;
            new TradingView.widget({
                "autosize": true, "symbol": tvSym, "interval": "D", "timezone": "Etc/UTC", "theme": "dark", "style": "1", "locale": "en",
                "enable_publishing": false, "backgroundColor": "#0a0e17", "gridColor": "rgba(42, 46, 57, 0.5)", "hide_top_toolbar": false,
                "hide_legend": false, "save_image": false, "container_id": "tv-chart-container", "allow_symbol_change": false, "withdateranges": true,
                "studies": ["Volume@tv-basicstudies"]
            });
        };

        if (window.TradingView) initTV();
        else { const script = document.createElement('script'); script.src = 'https://s3.tradingview.com/tv.js'; script.onload = initTV; document.head.appendChild(script); }

        const renderAdvancedSR = async () => {
            kodaContainer.innerHTML = `<div class="flex flex-col items-center justify-center h-full gap-2"><div class="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div><p class="text-slate-500 text-xs" id="koda-chart-status">กำลังโหลดกราฟ S/R...</p></div>`;
            try {
                await loadLightweightCharts();
                
                const candleCacheKey = `koda_sr_candles_v6_${symbol}_${currentTimeframe}`;
                const cachedCandles = JSON.parse(localStorage.getItem(candleCacheKey));
                const now = Date.now();
                let candles;

                if (cachedCandles && (now - cachedCandles.timestamp < 24 * 60 * 60 * 1000)) {
                    candles = cachedCandles.data;
                } else {
                    let candleResult = await fetchCandleData(currentTimeframe);
                    if (!candleResult) { 
                        kodaContainer.innerHTML = `<div class="flex flex-col items-center justify-center h-full"><p class="text-danger text-xs font-bold">ไม่สามารถดึงข้อมูลกราฟได้ในขณะนี้</p></div>`; 
                        return; 
                    }
                    candles = candleResult.timestamps.map((t, i) => ({ time: t, open: Number(candleResult.opens[i]), high: Number(candleResult.highs[i]), low: Number(candleResult.lows[i]), close: Number(candleResult.closes[i]), volume: Number(candleResult.volumes[i] || 0) }))
                        .filter(c => [c.open, c.high, c.low, c.close].every(v => isFinite(v) && v > 0)).sort((a, b) => a.time - b.time);
                    localStorage.setItem(candleCacheKey, JSON.stringify({ timestamp: now, data: candles }));
                }

                // 📌 อัลกอริทึมหา S/R แบบเดียวกับใน KODA Lab (แม่นยำสูง)
                const closes = candles.map(c => c.close);
                const highs = candles.map(c => c.high);
                const lows = candles.map(c => c.low);
                const lastClose = closes[closes.length - 1];

                let swingHighs = [], swingLows = [];
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
                swingHighs.push(Math.max(...highs.slice(-60)));
                swingLows.push(Math.min(...lows.slice(-60)));

                const clusterLevels = (levels) => {
                    let sorted = [...levels].sort((a, b) => a - b);
                    let clustered = [], currentCluster = [];
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

                let cleanResists = clusterLevels(swingHighs).filter(lvl => lvl > lastClose * 1.005).sort((a,b) => a - b);
                let cleanSupports = clusterLevels(swingLows).filter(lvl => lvl < lastClose * 0.995).sort((a,b) => b - a);

                let atrSum = 0;
                for(let i = closes.length-14; i<closes.length; i++) { if(i>0) atrSum += Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1])); }
                let atr = (atrSum / 14) || (lastClose * 0.02);
                atr = Math.max(lastClose * 0.015, Math.min(atr, lastClose * 0.04));

                while(cleanResists.length < 4) cleanResists.push((cleanResists.length > 0 ? cleanResists[cleanResists.length-1] : lastClose) + atr);
                while(cleanSupports.length < 5) {
                    let nextS = (cleanSupports.length > 0 ? cleanSupports[cleanSupports.length-1] : lastClose) - atr;
                    cleanSupports.push(nextS > 0 ? nextS : lastClose * 0.9);
                }

                const decimals = lastClose < 1 ? 4 : 2;
                window.KodaTradeMatrix.resistances = cleanResists.slice(0, 4).map(v => parseFloat(v.toFixed(decimals)));
                window.KodaTradeMatrix.supports = cleanSupports.slice(0, 5).map(v => parseFloat(v.toFixed(decimals)));
                
                renderTradeMatrix(); // วาดตารางด้านล่าง

                // วาดกราฟ
                kodaContainer.innerHTML = '';
                if (kodaChartInstance) kodaChartInstance.remove();
                
                kodaChartInstance = window.LightweightCharts.createChart(kodaContainer, {
                    width: kodaContainer.clientWidth, height: 380,
                    layout: { background: { type: 'solid', color: '#0a0e17' }, textColor: '#848e9c', fontSize: 12 },
                    grid: { vertLines: { color: 'rgba(42, 46, 57, 0.2)' }, horzLines: { color: 'rgba(42, 46, 57, 0.2)' } },
                    rightPriceScale: { 
                        borderColor: 'rgba(42, 46, 57, 0.8)', 
                        autoScale: true,
                        // 📌 บีบกราฟราคาหลักให้เหลือแค่ 75% ด้านบน เพื่อเว้นที่ให้ RSI
                        scaleMargins: { top: 0.05, bottom: 0.25 } 
                    },
                    timeScale: { borderColor: 'rgba(42, 46, 57, 0.8)', timeVisible: true }
                });
                
                const candleSeries = kodaChartInstance.addCandlestickSeries({ 
                    upColor: '#00c076', downColor: '#ff4d4d', borderUpColor: '#00c076', borderDownColor: '#ff4d4d', wickUpColor: '#00c076', wickDownColor: '#ff4d4d',
                    priceLineVisible: true, priceLineColor: '#eab308', priceLineWidth: 2, priceLineStyle: 2, lastValueVisible: true
                });
                candleSeries.setData(candles);

                // 📌 ประกาศตัวแปรให้ระบบ Real-time มองเห็น
                window.kodaCandleSeries = candleSeries;
                window.kodaChartCandles = candles;

                // ==========================================
                // 📌 สูตรคำนวณค่า RSI (14 วัน)
                // ==========================================
                const rsiSeries = kodaChartInstance.addLineSeries({
                    color: '#a855f7',
                    lineWidth: 1.5,
                    priceScaleId: 'rsiScale',
                    lastValueVisible: true,
                    title: 'RSI(14)'
                });
                
                // 📌 ประกาศตัวแปร RSI ให้ระบบ Real-time มองเห็น
                window.kodaRsiSeries = rsiSeries;

                // ==========================================
                // 📌 วาดเส้น RSI ไว้ด้านล่างสุดของหน้าจอ
                // ==========================================
                const rsiSeries = kodaChartInstance.addLineSeries({
                    color: '#a855f7', // สีม่วง (Fuchsia) ให้อารมณ์เหมือน TradingView
                    lineWidth: 1.5,
                    priceScaleId: 'rsiScale',
                    lastValueVisible: true,
                    title: 'RSI(14)'
                });

                kodaChartInstance.priceScale('rsiScale').applyOptions({
                    // 📌 ให้อยู่ 20% ล่างสุดของกราฟเท่านั้น ไม่ทับกราฟแท่งเทียน
                    scaleMargins: { top: 0.8, bottom: 0 }, 
                    borderColor: 'rgba(42, 46, 57, 0.8)',
                });

                rsiSeries.setData(rsiData);

                // 📌 ขีดเส้น Overbought (70) และ Oversold (30) เป็นเส้นประบางๆ ไว้ดูง่ายๆ
                rsiSeries.createPriceLine({ price: 70, color: 'rgba(255,77,77,0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
                rsiSeries.createPriceLine({ price: 30, color: 'rgba(0,192,118,0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });


                // 📌 วาดเส้นบนกราฟจาก Matrix เป๊ะๆ
                window.KodaTradeMatrix.resistances.forEach((r, i) => {
                    candleSeries.createPriceLine({ price: r, color: 'rgba(255,77,77,0.85)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `R${i+1}` });
                });
                window.KodaTradeMatrix.supports.forEach((s, i) => {
                    candleSeries.createPriceLine({ price: s, color: 'rgba(0,192,118,0.85)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `S${i+1}` });
                });
                
                kodaChartInstance.timeScale().fitContent();
            } catch (e) { console.error(e); kodaContainer.innerHTML = `<p class="text-danger text-xs text-center mt-10">เกิดข้อผิดพลาดในการวาดกราฟ</p>`; }
        };

        btnKoda.addEventListener('click', () => {
            currentChartMode = 'koda';
            btnKoda.className = "px-3 py-1.5 rounded-md bg-primary/20 text-primary transition-colors";
            btnTV.className = "px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-300 transition-colors";
            tfSelector.style.display = 'flex';
            tvContainer.style.display = 'none';
            kodaContainer.style.display = 'block';
            renderAdvancedSR();
        });

        btnTV.addEventListener('click', () => {
            currentChartMode = 'tv';
            btnTV.className = "px-3 py-1.5 rounded-md bg-primary/20 text-primary transition-colors";
            btnKoda.className = "px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-300 transition-colors";
            tfSelector.style.display = 'none';
            tvContainer.style.display = 'block';
            kodaContainer.style.display = 'none';
        });

        document.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentTimeframe = btn.dataset.tf;
                document.querySelectorAll('.tf-btn').forEach(b => { b.classList.remove('text-primary', 'bg-primary/10'); b.classList.add('text-slate-500'); });
                btn.classList.add('text-primary', 'bg-primary/10'); btn.classList.remove('text-slate-500');
                if (currentChartMode === 'koda') renderAdvancedSR();
            });
        });

        // 📌 เปิดมาโหลด KODA S/R ทันที
        renderAdvancedSR();
    };
    renderChart();
    
    // ==========================================
    // 📌 TAB 2: สรุปบริษัท AI 
    // ==========================================
    const fetchCompanySummary = async (force = false) => {
        const container = document.getElementById('ai-company-content');
        const dateEl = document.getElementById('ai-summary-date');
        const cacheKey = `koda_company_summary_v3_${symbol}`;
        const cached = JSON.parse(localStorage.getItem(cacheKey));
        const now = Date.now();

        if (!force && cached && (now - cached.timestamp < 90 * 24 * 60 * 60 * 1000)) {
            container.innerHTML = cached.html;
            dateEl.textContent = `Last updated: ${new Date(cached.timestamp).toLocaleDateString('th-TH')}`;
            return;
        }

        container.innerHTML = `<div class="flex flex-col items-center justify-center py-6"><div class="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3"></div><p class="text-primary font-bold text-xs animate-pulse">AI กำลังวิเคราะห์ปัจจัยพื้นฐาน...</p></div>`;

        try {
            const cleanSym = symbol.split(':')[1] || symbol.split('.')[0];
            const profile = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${cleanSym}&token=${getFHKey()}`).then(r=>r.json());
            const industry = profile.finnhubIndustry || 'General';
            
            const GEMINI_API_KEY = window.ENV_KEYS?.GEMINI ? window.ENV_KEYS.GEMINI[0] : '';
            if (!GEMINI_API_KEY) throw new Error('No Gemini Key');

            const prompt = `ในฐานะผู้เชี่ยวชาญด้านธุรกิจและการลงทุน โปรดสรุป Business Model, พื้นฐาน, และ Ecosystem ของบริษัท ${symbol} (${currentStockName}) อุตสาหกรรม: ${industry}
            ให้อธิบายเป็น "ภาษาไทย" แบบเห็นภาพชัดเจน เข้าใจง่ายสำหรับนักลงทุนรายย่อย (หลีกเลี่ยงศัพท์แสงที่ยากเกินไป)
            บังคับใช้โครงสร้าง HTML นี้ในการตอบ:
            <div style="margin-bottom: 12px;"><strong>🏢 ทำธุรกิจอะไร (Core Business):</strong> ...</div>
            <div style="margin-bottom: 12px;"><strong>🌐 Ecosystem & รายได้ (How they make money):</strong> ...</div>
            <div style="margin-bottom: 12px;"><strong>⚔️ จุดเด่น / คู่แข่ง (Moat & Competitors):</strong> ...</div>
            <div style="padding: 12px; background: rgba(52,168,235,0.1); border-radius: 8px; border: 1px solid rgba(52,168,235,0.3); color: #34a8eb;"><strong>💡 โอกาสในอนาคต (Future Catalysts):</strong> ...</div>
            ตอบด้วยรหัส HTML ล้วน ห้ามมีเครื่องหมาย \`\`\`html`;

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
            });
            const data = await res.json();
            
            if (data.candidates && data.candidates[0].content.parts[0].text) {
                const aiHtml = data.candidates[0].content.parts[0].text.replace(/```html/g, '').replace(/```/g, '').trim();
                container.innerHTML = aiHtml;
                dateEl.textContent = `Last updated: ${new Date().toLocaleDateString('th-TH')}`;
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, html: aiHtml }));
            } else { throw new Error('AI Error'); }
        } catch(e) {
            container.innerHTML = `<p class="text-danger text-sm text-center py-4">ไม่สามารถสรุปข้อมูลบริษัทได้</p>`;
        }
    };
    document.getElementById('btn-refresh-summary').addEventListener('click', () => fetchCompanySummary(true));

    // ==========================================
    // 📌 TAB ใหม่: บทวิเคราะห์ (Analysis / TA)
    // 🚀 ปรับแก้วิธีวาดกราฟเป้าหมายให้เป็น Webull Clone (ใช้ HTML ซ้อนทับ ไม่พังชัวร์)
    // ==========================================
    let taChartInstance = null;
    let taSeries = null;
    let taVolumeSeries = null;

    const renderAnalystRatings = (rec) => {
        const total = rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell;
        const container = document.getElementById('analyst-bars');
        const badge = document.getElementById('analyst-consensus-badge');
        document.getElementById('analyst-subtitle').textContent = `อิงตามนักวิเคราะห์ ${total || '--'} คน`;

        if (total === 0) {
            badge.textContent = "N/A";
            container.innerHTML = `<p class="text-slate-500 text-xs">ไม่มีข้อมูลนักวิเคราะห์</p>`;
            return;
        }

        const mapTH = { 'strongBuy': 'ซื้อทันที', 'buy': 'ซื้อ', 'hold': 'ถือ', 'sell': 'ต่ำกว่าค่าเฉลี่ย', 'strongSell': 'ขาย' };
        const colors = { 'strongBuy': '#00c076', 'buy': '#22c55e', 'hold': '#eab308', 'sell': '#64748b', 'strongSell': '#ff4d4d' };
        
        let consensusText = "N/A";
        if (rec.consensus === 'strong_buy') consensusText = "ซื้อทันที";
        else if (rec.consensus === 'buy') consensusText = "ซื้อ";
        else if (rec.consensus === 'hold') consensusText = "ถือ";
        else if (rec.consensus === 'underperform') consensusText = "ต่ำกว่าค่าเฉลี่ย";
        else if (rec.consensus === 'sell') consensusText = "ขาย";

        badge.textContent = consensusText;

        const rows = ['strongBuy', 'buy', 'hold', 'sell', 'strongSell'].map(key => {
            const pct = Math.round((rec[key] / total) * 100);
            return `
            <div class="flex items-center gap-3">
                <span class="text-slate-300 text-xs w-20 text-right">${mapTH[key]}</span>
                <div class="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div class="h-full rounded-full" style="width: ${pct}%; background-color: ${colors[key]}"></div>
                </div>
                <span class="text-slate-400 text-xs w-8 text-right">${pct}%</span>
            </div>`;
        });
        
        container.innerHTML = rows.join('');
    };

    const renderTargetPrice = async (targets) => {
        const fmt = (num) => num ? num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
        const cur = targets.current;
        const high = targets.high;
        const low = targets.low;
        const mean = targets.mean;

        if (!cur || !high || !low || !mean) {
            document.getElementById('target-subtitle').textContent = "ไม่มีข้อมูลราคาเป้าหมาย";
            return;
        }

        const highPct = ((high - cur) / cur) * 100;
        const meanPct = ((mean - cur) / cur) * 100;
        const lowPct = ((low - cur) / cur) * 100;

        document.getElementById('target-subtitle').textContent = `สำหรับการคาดการณ์ราคาในหนึ่งปี ค่าเฉลี่ยราคาเป้าหมายอยู่ที่ ${fmt(mean)} โดยมีค่าสูงสุดที่ ${fmt(high)} และค่าต่ำสุดที่ ${fmt(low)}`;

        // ดึงกราฟราคาย้อนหลัง 1 ปี 
        const hist = await fetchCandleData('1Y');
        let chartPoints = [];
        if (hist && hist.closes && hist.closes.length > 0) {
            chartPoints = hist.closes.filter(c => c !== null);
        } else {
            // ถ้าเน็ตพัง ให้สร้างกราฟเฉียงขึ้นเนียนๆ
            chartPoints = [cur*0.8, cur*0.85, cur*0.9, cur*0.95, cur]; 
        }

        const ctx = document.getElementById('target-line-chart');
        if (window.targetLineChartInstance) window.targetLineChartInstance.destroy();
        
        const yMin = Math.min(...chartPoints, low) * 0.95;
        const yMax = Math.max(...chartPoints, high) * 1.05;

        // วาดแค่กราฟประวัติสีฟ้าอย่างเดียว
        window.targetLineChartInstance = new Chart(ctx, {
            type: 'line',
            data: { 
                labels: new Array(chartPoints.length).fill(''), 
                datasets: [
                    { data: chartPoints, borderColor: '#34a8eb', borderWidth: 2, tension: 0.1, pointRadius: 0 }
                ] 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
                scales: { x: { display: false }, y: { display: false, min: yMin, max: yMax } },
                // เว้นที่ว่างด้านขวาให้กล่อง Label 120px
                layout: { padding: { top: 15, bottom: 15, right: 120 } },
                animation: { duration: 0 } 
            }
        });

        // 🚀 แปะ Badge ตัวเลขลงไปด้านขวา และลากเส้นประจากเส้นกราฟหลักให้เนียนๆ เหมือน Webull
        const badgesContainer = document.getElementById('target-badges-container');
        const yRange = yMax - yMin;
        const getTopPct = (val) => Math.max(5, Math.min(95, 100 - ((val - yMin) / yRange) * 100));

        badgesContainer.innerHTML = `
            <div class="absolute right-0 flex items-center gap-2 -translate-y-1/2" style="top: ${getTopPct(high)}%; width: 100%;">
                <div class="flex-1 border-t border-dashed border-[#00c076] opacity-50"></div>
                <div class="bg-[#00c076] text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap">สูงสุด ${fmt(high)} ${highPct>0?'+':''}${highPct.toFixed(2)}%</div>
            </div>
            <div class="absolute right-0 flex items-center gap-2 -translate-y-1/2" style="top: ${getTopPct(mean)}%; width: 100%;">
                <div class="flex-1 border-t border-dashed border-[#26a69a] opacity-50"></div>
                <div class="bg-[#26a69a] text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap">เฉลี่ย ${fmt(mean)} ${meanPct>0?'+':''}${meanPct.toFixed(2)}%</div>
            </div>
            <div class="absolute right-0 flex items-center gap-2 -translate-y-1/2" style="top: ${getTopPct(cur)}%; width: 100%;">
                <div class="flex-1 border-t border-dashed border-primary opacity-50"></div>
                <div class="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap">${fmt(cur)}</div>
            </div>
            <div class="absolute right-0 flex items-center gap-2 -translate-y-1/2" style="top: ${getTopPct(low)}%; width: 100%;">
                <div class="flex-1 border-t border-dashed border-[#ff4d4d] opacity-50"></div>
                <div class="bg-[#ff4d4d] text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap">ต่ำสุด ${fmt(low)} ${lowPct>0?'+':''}${lowPct.toFixed(2)}%</div>
            </div>
        `;
    };

    let currentTAMode = 'short'; 
    let currentTATF = 'daily'; 
    
    // 🚀 กราฟวิเคราะห์ทางเทคนิค
    const renderTAChart = async () => {
        const container = document.getElementById('ta-chart-container');
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-full gap-2"><div class="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>`;
        
        try {
            await loadLightweightCharts();
            
            let rangeToFetch = currentTATF === 'daily' ? '2Y' : '5Y';
            const candleResult = await fetchCandleData(rangeToFetch);
            
            if (!candleResult) { 
                container.innerHTML = `<div class="flex flex-col items-center justify-center h-full"><p class="text-danger text-xs font-bold text-center">ไม่สามารถโหลดข้อมูลเทคนิคได้</p></div>`;
                return;
            }

            const { timestamps, opens, highs, lows, closes, volumes } = candleResult;
            
            let chartData = timestamps.map((t, i) => ({ 
                time: t, open: Number(opens[i]), high: Number(highs[i]), low: Number(lows[i]), close: Number(closes[i]), value: Number(volumes[i] || 0) 
            })).filter(c => isFinite(c.close)).sort((a, b) => a.time - b.time);

            container.innerHTML = '';
            if (taChartInstance) taChartInstance.remove();

            // 📌 ป้องกันบัคความกว้าง 0px
            const chartWidth = container.clientWidth > 0 ? container.clientWidth : (container.parentElement.clientWidth || 300);
            
            taChartInstance = window.LightweightCharts.createChart(container, {
                width: chartWidth, height: 220,
                layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#848e9c', fontSize: 10 },
                grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(42, 46, 57, 0.4)' } },
                rightPriceScale: { borderColor: 'rgba(42, 46, 57, 0)' },
                timeScale: { borderColor: 'rgba(42, 46, 57, 0)', timeVisible: false }
            });

            // 📌 ทำให้กราฟอัปเดตขนาดอัตโนมัติตอนเปลี่ยนแท็บ
            new ResizeObserver(entries => {
                if (entries.length === 0 || entries[0].target !== container) return;
                const newRect = entries[0].contentRect;
                if (newRect.width > 0 && newRect.height > 0) {
                    taChartInstance.applyOptions({ width: newRect.width, height: newRect.height });
                }
            }).observe(container);
            
            taSeries = taChartInstance.addCandlestickSeries({ 
                upColor: '#00c076', downColor: '#ff4d4d', borderUpColor: '#00c076', borderDownColor: '#ff4d4d', wickUpColor: '#00c076', wickDownColor: '#ff4d4d'
            });
            taSeries.setData(chartData);

            // 📌 ลดขนาด Volume ไม่ให้เกะกะสายตา (ดันลงไปด้านล่างสุด)
            taVolumeSeries = taChartInstance.addHistogramSeries({
                color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '', scaleMargins: { top: 0.85, bottom: 0 }
            });
            taVolumeSeries.setData(chartData.map(d => ({ time: d.time, value: d.value, color: d.close >= d.open ? 'rgba(0, 192, 118, 0.5)' : 'rgba(255, 77, 77, 0.5)' })));

            let bullCount = 0, bearCount = 0;
            const markers = [];
            const sma20 = [];
            
            chartData.forEach((d, i) => {
                if (i >= 20) {
                    const slice = chartData.slice(i-20, i);
                    const avg = slice.reduce((a,b)=>a+b.close,0)/20;
                    sma20.push({time: d.time, value: avg});
                    
                    if (i > 25 && i % Math.max(5, Math.floor(chartData.length/40)) === 0) { 
                        if (d.close > avg) { 
                            markers.push({ time: d.time, position: 'belowBar', color: '#00c076', shape: 'circle', text: 'B' });
                            bullCount++;
                        } else {
                            markers.push({ time: d.time, position: 'aboveBar', color: '#ff4d4d', shape: 'circle', text: 'S' });
                            bearCount++;
                        }
                    }
                }
            });

            if (markers.length > 0) taSeries.setMarkers(markers);
            
            const titleEl = document.getElementById('ta-signal-title');
            const isBull = bullCount > bearCount;
            const isBear = bearCount > bullCount;

            if (bullCount > bearCount + 2) {
                titleEl.textContent = 'หลักฐานสัญญาณขาขึ้นที่แข็งแกร่งมาก';
                titleEl.className = 'text-[#00c076] text-base font-bold mb-1';
            } else if (isBull) {
                titleEl.textContent = 'หลักฐานสัญญาณขาขึ้น';
                titleEl.className = 'text-[#00c076] text-base font-bold mb-1';
            } else if (isBear) {
                titleEl.textContent = 'หลักฐานสัญญาณขาลง';
                titleEl.className = 'text-[#ff4d4d] text-base font-bold mb-1';
            } else {
                titleEl.textContent = 'สัญญาณผสม (ไม่มีเทรนด์ชัดเจน)';
                titleEl.className = 'text-yellow-500 text-base font-bold mb-1';
            }

            document.getElementById('ta-bull-badge').innerHTML = `<span class="material-symbols-outlined text-[12px]">call_made</span> ${bullCount} ขาขึ้น`;
            document.getElementById('ta-bear-badge').innerHTML = `<span class="material-symbols-outlined text-[12px]">call_received</span> ${bearCount} ขาลง`;

            // 📌 เปลี่ยนสีปุ่มและลูกศรให้ตรงกับเทรนด์ (เขียวขึ้น / แดงลง)
            let activeColor = '#eab308'; 
            let arrowIcon = 'trending_flat';
            if (isBull) { activeColor = '#00c076'; arrowIcon = 'north_east'; }
            if (isBear) { activeColor = '#ff4d4d'; arrowIcon = 'south_east'; }

            document.querySelectorAll('.ta-mode-btn').forEach(btn => {
                let modeText = btn.dataset.mode === 'short' ? 'ระยะสั้น' : (btn.dataset.mode === 'medium' ? 'ระยะกลาง' : 'ระยะยาว');
                if (btn.dataset.mode === currentTAMode) {
                    btn.className = `ta-mode-btn flex-1 text-white text-xs font-bold py-2 rounded-md flex items-center justify-center gap-1 transition-all`;
                    btn.style.backgroundColor = activeColor;
                    btn.innerHTML = `${modeText} <span class="material-symbols-outlined text-[14px]">${arrowIcon}</span>`;
                } else {
                    btn.className = `ta-mode-btn flex-1 text-slate-400 hover:text-white text-xs font-bold py-2 rounded-md flex items-center justify-center gap-1 transition-all bg-surface-dark border border-border-dark`;
                    btn.style.backgroundColor = 'transparent';
                    btn.innerHTML = `${modeText} <span class="material-symbols-outlined text-[14px] ${isBear ? 'text-danger/50' : (isBull ? 'text-success/50' : 'text-yellow-500/50')}">${arrowIcon}</span>`;
                }
            });

            if (currentTAMode === 'short') {
                const lookback = currentTATF === 'daily' ? 60 : 12; 
                const from = chartData[Math.max(0, chartData.length - lookback)].time;
                taChartInstance.timeScale().setVisibleRange({ from: from, to: chartData[chartData.length-1].time });
            } else if (currentTAMode === 'medium') {
                const lookback = currentTATF === 'daily' ? 120 : 24; 
                const from = chartData[Math.max(0, chartData.length - lookback)].time;
                taChartInstance.timeScale().setVisibleRange({ from: from, to: chartData[chartData.length-1].time });
            } else {
                taChartInstance.timeScale().fitContent();
            }
        } catch (e) {
            container.innerHTML = `<p class="text-danger text-xs text-center mt-10">ไม่สามารถโหลดข้อมูลเทคนิคได้</p>`;
        }
    };

    const fetchAnalysisData = async () => {
        const loadingEl = document.getElementById('analysis-loading');
        const contentEl = document.getElementById('analysis-content');
        
        loadingEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
        
        const cacheKey = `koda_analysis_v4_${symbol}`;
        const cached = JSON.parse(localStorage.getItem(cacheKey));
        const now = Date.now();

        // 📌 ฟังก์ชันจัดการ UI ช่วยแก้บัคการแสดงผล
        const setupUI = async (data) => {
            renderAnalystRatings(data.recommendation);
            await renderTargetPrice(data.targets);
            
            // 🚨 แก้บัค: เปิดกล่องให้แสดงผล "ก่อน" ที่จะวาดกราฟ กราฟจะได้รู้ขนาดตัวเอง
            loadingEl.classList.add('hidden');
            contentEl.classList.remove('hidden');

            document.querySelectorAll('.ta-mode-btn').forEach(btn => {
                btn.onclick = (e) => {
                    currentTAMode = e.currentTarget.dataset.mode;
                    renderTAChart();
                };
            });
            document.querySelectorAll('.ta-tf-btn').forEach(btn => {
                btn.onclick = (e) => {
                    document.querySelectorAll('.ta-tf-btn').forEach(b => { b.className = 'ta-tf-btn text-slate-400 hover:text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors'; });
                    e.currentTarget.className = 'ta-tf-btn bg-slate-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors';
                    currentTATF = e.currentTarget.dataset.tf;
                    renderTAChart();
                };
            });

            // หน่วงเวลา 50ms ให้เบราว์เซอร์เตรียมกล่องเสร็จ แล้ววาดกราฟทันที (ไม่ต้องกดย้ำ)
            setTimeout(() => {
                renderTAChart();
            }, 50);
        };

        if (cached && (now - cached.timestamp < 15 * 24 * 60 * 60 * 1000)) {
            await setupUI(cached.data);
            return;
        }

        try {
            const cleanSym = symbol.split(':')[1] || symbol.split('.')[0];
            const res = await fetch(`/api/price?symbol=${encodeURIComponent(cleanSym)}&mode=analysis`);
            const data = await res.json();

            if (data.success) {
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: data }));
                await setupUI(data);
            } else {
                throw new Error();
            }
        } catch(e) {
            loadingEl.textContent = 'ไม่พบข้อมูลบทวิเคราะห์ของหุ้นตัวนี้';
            loadingEl.classList.add('text-danger');
            loadingEl.classList.remove('animate-pulse');
        }
    };


    // ==========================================
    // 📌 TAB 3: สรุปไตรมาส (ระบบ 3 ก๊อก ป้องกันจอแดง 100%)
    // ==========================================
    const fetchQuarterlyEarnings = async () => {
        const container = document.getElementById('quarterly-list');
        const nextDateEl = document.getElementById('quarterly-next-date');
        
        const cacheKey = `koda_quarterly_v5_${symbol}`; 
        const cached = JSON.parse(localStorage.getItem(cacheKey));
        const now = Date.now();

        if (cached && (now - cached.timestamp < 12 * 60 * 60 * 1000)) { 
            container.innerHTML = cached.html;
            if (cached.nextDateText) {
                nextDateEl.textContent = cached.nextDateText;
                nextDateEl.classList.remove('hidden');
            }
            return;
        }

        try {
            const cleanSym = symbol.split(':')[1] || symbol.split('.')[0];
            let earningsData = [];
            let nextDateText = null;

            // 🚀 ก๊อกที่ 1: Python Backend (Yahoo Finance)
            try {
                const res = await fetch(`/api/price?symbol=${encodeURIComponent(cleanSym)}&mode=financials`);
                const data = await res.json();
                if (data.success && data.earnings && data.earnings.length > 0) {
                    earningsData = data.earnings;
                    if (data.nextEarningsDate) {
                        nextDateText = `Next: ${new Date(data.nextEarningsDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                    }
                }
            } catch(e) {}

            // 🚀 ก๊อกที่ 2: AlphaVantage
            if (earningsData.length === 0 && AV_API_KEY) {
                try {
                    const avRes = await fetch(`https://www.alphavantage.co/query?function=EARNINGS&symbol=${cleanSym}&apikey=${AV_API_KEY}`);
                    const avData = await avRes.json();
                    if (avData && avData.quarterlyEarnings && avData.quarterlyEarnings.length > 0) {
                        earningsData = avData.quarterlyEarnings.map(q => {
                            const est = parseFloat(q.estimatedEPS);
                            const act = parseFloat(q.reportedEPS);
                            return {
                                quarter: `Q${Math.ceil((new Date(q.reportedDate).getMonth() + 1) / 3)} ${new Date(q.reportedDate).getFullYear()}`,
                                estimate: isNaN(est) ? null : est,
                                actual: isNaN(act) ? null : act,
                                surprise: parseFloat(q.surprisePercentage) || 0
                            };
                        });
                    }
                } catch(e) {}
            }

            // 🚀 ก๊อกที่ 3: Finnhub 
            if (earningsData.length === 0) {
                try {
                    const fhRes = await fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${cleanSym}&token=${getFHKey()}`);
                    const fhData = await fhRes.json();
                    if (fhData && fhData.length > 0) {
                        earningsData = fhData.map(q => ({
                            quarter: `Q${Math.ceil((new Date(q.period).getMonth() + 1) / 3)} ${new Date(q.period).getFullYear()}`,
                            estimate: q.estimate,
                            actual: q.actual,
                            surprise: q.surprisePercent || (q.actual && q.estimate ? ((q.actual - q.estimate)/Math.abs(q.estimate)*100) : 0)
                        }));
                    }
                } catch(e) {}
            }

            if (earningsData.length === 0) throw new Error("No data");

            if (nextDateText) {
                nextDateEl.textContent = nextDateText;
                nextDateEl.classList.remove('hidden');
            }

            const html = earningsData.slice(0, 10).map(q => {
                const isSurprise = q.surprise > 0;
                const actColor = (q.actual !== null && q.estimate !== null && q.actual >= q.estimate) ? 'text-success' : 'text-danger';
                return `
                <div class="grid grid-cols-12 p-3 items-center text-xs hover:bg-slate-800 transition-colors">
                    <div class="col-span-3">
                        <p class="text-white font-bold">${q.quarter}</p>
                    </div>
                    <div class="col-span-3 text-right text-slate-400 font-medium">${q.estimate !== null && q.estimate !== undefined ? q.estimate.toFixed(2) : '-'}</div>
                    <div class="col-span-3 text-right ${actColor} font-bold">${q.actual !== null && q.actual !== undefined ? q.actual.toFixed(2) : '-'}</div>
                    <div class="col-span-3 text-right">
                        <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${isSurprise ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}">
                            ${isSurprise ? '+' : ''}${q.surprise !== null && q.surprise !== undefined ? q.surprise.toFixed(2) : '0.00'}%
                        </span>
                    </div>
                </div>`;
            }).join('');

            container.innerHTML = html;
            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, html: html, nextDateText: nextDateText }));

        } catch(e) {
            container.innerHTML = `<p class="text-center text-danger text-xs py-8">ไม่มีประวัติผลประกอบการ หรือ API ขัดข้อง</p>`;
        }
    };

    // ==========================================
    // 📌 TAB 4: ข้อมูลการเงิน
    // ==========================================
    let finDataCache = [];
    let currentFinMetric = 'totalRevenue';
    let finChartInstance = null;

    const metricColors = {
        totalRevenue: '#34a8eb', grossProfit: '#a855f7', operatingIncome: '#eab308', netIncome: '#00c076'
    };

    document.querySelectorAll('.fin-metric-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.fin-metric-btn').forEach(b => {
                b.classList.remove('active', 'bg-slate-700', 'text-white', 'shadow-md');
                b.classList.add('bg-transparent', 'text-slate-400', 'hover:text-slate-200');
            });
            btn.classList.add('active', 'bg-slate-700', 'text-white', 'shadow-md');
            btn.classList.remove('bg-transparent', 'text-slate-400', 'hover:text-slate-200');
            
            currentFinMetric = btn.getAttribute('data-metric');
            renderFinChartAndLegend();
        });
    });

    const fetchFinancialData = async () => {
        const errorEl = document.getElementById('fin-error-msg');
        const cacheKey = `koda_fin_master_yf_${symbol}`; 
        const cached = JSON.parse(localStorage.getItem(cacheKey));
        const now = Date.now();

        if (cached && (now - cached.timestamp < 12 * 60 * 60 * 1000)) {
            finDataCache = cached.data;
            renderFinChartAndLegend();
            return;
        }

        try {
            const cleanSym = symbol.split(':')[1] || symbol.split('.')[0];
            const res = await fetch(`/api/price?symbol=${encodeURIComponent(cleanSym)}&mode=financials`);
            const data = await res.json();

            if (data.success && data.financials && data.financials.length > 0) {
                const sortedData = [...data.financials].reverse(); 
                finDataCache = sortedData;
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: sortedData }));
                errorEl.innerHTML = '';
                renderFinChartAndLegend();
            } else {
                throw new Error("No Financial Data");
            }
        } catch (e) {
            errorEl.innerHTML = `
            <div class="bg-background-dark border border-border-dark p-4 rounded-xl mt-6 text-center shadow-inner">
                <span class="material-symbols-outlined text-danger text-3xl mb-2">error</span>
                <p class="text-slate-400 text-xs leading-relaxed">ระบบไม่พบข้อมูลการเงินรายไตรมาสของหุ้นตัวนี้<br>
            </div>`;
            document.getElementById('financials-legend').innerHTML = '';
            if (finChartInstance) finChartInstance.destroy();
        }
    };

    const renderFinChartAndLegend = () => {
        const ctx = document.getElementById('financials-chart');
        const legendContainer = document.getElementById('financials-legend');
        if (!ctx || finDataCache.length === 0) return;

        const formatB = (num) => {
            if (num === 0 || num === undefined) return '-';
            const abs = Math.abs(num);
            if (abs >= 1e9) return (num / 1e9).toFixed(2) + 'B';
            if (abs >= 1e6) return (num / 1e6).toFixed(2) + 'M';
            return num.toLocaleString();
        };

        const chartData = finDataCache.slice(-4); 
        const pctChanges = [];
        const startIndex = finDataCache.length - 4;
        
        chartData.forEach((q, idx) => {
            const currentVal = q[currentFinMetric];
            const prevVal = finDataCache[startIndex + idx - 1]?.[currentFinMetric];
            if (prevVal && prevVal !== 0) {
                pctChanges.push(((currentVal - prevVal) / Math.abs(prevVal)) * 100);
            } else {
                pctChanges.push(0);
            }
        });

        if (finChartInstance) finChartInstance.destroy();
        
        finChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.map(d => d.quarter),
                datasets: [
                    { type: 'line', label: '% Change', data: pctChanges, borderColor: '#d946ef', backgroundColor: '#d946ef', borderWidth: 2, pointRadius: 4, yAxisID: 'y1', tension: 0.3 },
                    { type: 'bar', label: 'Value', data: chartData.map(d => d[currentFinMetric]), backgroundColor: `${metricColors[currentFinMetric]}80`, borderColor: metricColors[currentFinMetric], borderWidth: 1, borderRadius: 4, yAxisID: 'y' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9 } } },
                    y: { type: 'linear', display: true, position: 'right', grid: { color: '#232b3e' }, ticks: { color: '#94a3b8', font: { size: 9 }, callback: v => formatB(v) } },
                    y1: { type: 'linear', display: false, position: 'left', grid: { display: false } }
                }
            }
        });

        let legendHtml = `<div class="flex flex-col gap-1.5 justify-end items-end pr-2 border-r border-border-dark py-1">
            <span class="size-2 rounded-full" style="background-color: ${metricColors[currentFinMetric]}"></span>
            <span class="size-2 rounded-full bg-fuchsia-500"></span>
        </div>`;

        chartData.forEach((q, idx) => {
            const pct = pctChanges[idx];
            const pctColor = pct >= 0 ? 'text-success' : 'text-danger';
            legendHtml += `
            <div class="flex flex-col gap-1 items-center justify-end py-1">
                <span class="text-[9px] text-slate-400 font-bold">${q.quarter}</span>
                <span class="text-[10px] text-white font-bold">$${formatB(q[currentFinMetric])}</span>
                <span class="text-[10px] font-bold ${pctColor}">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</span>
            </div>`;
        });
        legendContainer.innerHTML = legendHtml;
    };


    // ==========================================
    // 📌 TAB 5: ข่าวล่าสุด
    // ==========================================
    const fetchLatestNews = async () => {
        const container = document.getElementById('stock-news-container');
        try {
            const cleanSym = symbol.split(':')[1] || symbol.split('.')[0];
            const today = new Date();
            const past15Days = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000);
            const formatDate = (date) => date.toISOString().split('T')[0];

            let newsData = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${cleanSym}&from=${formatDate(past15Days)}&to=${formatDate(today)}&token=${getFHKey()}`).then(r=>r.json()).catch(()=>[]);

            if (newsData && newsData.length > 0) {
                const isTranslateOn = localStorage.getItem('koda_translate_th') === 'true';
                
                const htmlPromises = newsData.map(async n => {
                    const dateStr = new Date(n.datetime*1000).toLocaleDateString('th-TH');
                    let imgUrl = n.image || 'https://images.unsplash.com/photo-1611974714652-96574f9d48b1?q=80&w=400';
                    let finalHeadline = n.headline;
                    if (isTranslateOn && window.KodaAI && !/[\u0E00-\u0E7F]/.test(finalHeadline)) {
                        finalHeadline = await window.KodaAI.translateText(n.headline);
                    }
                    return `
                    <div onclick="window.openNewsModal(\`${encodeURIComponent(n.headline)}\`, \`${encodeURIComponent(n.summary || '')}\`, \`${n.url}\`, \`${n.source || 'News'}\`, \`${dateStr}\`, \`${imgUrl}\`)" class="block bg-surface-dark border-l-2 border-primary rounded-r-xl p-3 flex gap-3 active:scale-[0.98] hover:bg-slate-800 transition-all shadow-sm cursor-pointer mb-3">
                        <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                            <div class="flex items-center justify-between mb-1.5"><span class="text-primary text-[10px] font-bold uppercase truncate mr-2">${n.source || 'News'}</span><span class="text-slate-500 text-[10px]">${dateStr}</span></div>
                            <h4 class="text-white text-sm font-semibold line-clamp-2 leading-snug">${finalHeadline}</h4>
                        </div>
                        <div class="size-20 rounded-lg bg-slate-900 shrink-0 overflow-hidden border border-border-dark/50"><img src="${imgUrl}" class="w-full h-full object-cover"></div>
                    </div>`;
                });
                container.innerHTML = (await Promise.all(htmlPromises)).join('');
            } else {
                container.innerHTML = `<p class="text-slate-500 text-sm text-center py-8">ไม่พบข่าวล่าสุดในช่วง 15 วันที่ผ่านมา</p>`;
            }
        } catch(e) {
            container.innerHTML = `<p class="text-danger text-sm text-center py-8">ไม่สามารถดึงข้อมูลข่าวได้</p>`;
        }
    };

    window.openNewsModal = async (encHeadline, encSummary, url, source, dateStr, imgUrl) => {
        const headline = decodeURIComponent(encHeadline);
        const summary = decodeURIComponent(encSummary);
        
        const modal = document.getElementById('modal-news-detail');
        const modalContent = document.getElementById('modal-news-content');
        const modalBody = document.getElementById('news-modal-body');
        const modalLink = document.getElementById('news-modal-link');
        if (!modal) return;
        
        modal.classList.remove('hidden'); modal.classList.add('flex');
        setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);
        modalLink.href = url;

        const cacheKey = 'koda_ai_news_v3_' + headline.replace(/[^a-zA-Z0-9\u0E00-\u0E7F]/g, '').substring(0, 30);
        const cachedContent = localStorage.getItem(cacheKey);
        const visualHtml = `<img src="${imgUrl}" class="w-full h-40 object-cover rounded-xl border border-border-dark/50 shadow-inner mb-3">`;

        if (cachedContent) {
            modalBody.innerHTML = `${visualHtml}<h4 class="text-white text-lg font-bold leading-snug mb-2">${headline}</h4><div class="flex items-center gap-2 pb-3 mb-3 border-b border-border-dark/50"><span class="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded font-bold uppercase">${source}</span><span class="text-slate-500 text-[10px]">${dateStr}</span></div><div class="text-slate-300 text-sm leading-relaxed space-y-4 font-medium">${cachedContent}</div>`;
            return; 
        }
        
        modalBody.innerHTML = `${visualHtml}<div class="flex flex-col items-center justify-center py-6"><div class="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div><p class="text-primary text-sm font-bold animate-pulse">KODA AI is analyzing...</p></div>`;

        try {
            const GEMINI_API_KEY = window.ENV_KEYS?.GEMINI ? window.ENV_KEYS.GEMINI[0] : ''; 
            if (!GEMINI_API_KEY) throw new Error('No Key');
            
            const prompt = `ในฐานะนักวิเคราะห์การเงิน โปรดอ่านหัวข้อข่าวและเนื้อหาย่อต่อไปนี้:\nHeadline: ${headline}\nSummary: ${summary}\nโปรดวิเคราะห์ข่าวนี้เป็น "ภาษาไทย" ให้เห็นภาพชัดเจน โดยบังคับใช้โครงสร้าง HTML ดังนี้:\n<p>📝 <strong style="color:#fff;">สรุปเหตุการณ์:</strong>...</p>\n<p>🌍 <strong style="color:#fff;">ผลกระทบ:</strong>...</p>\n<div style="background: rgba(52,168,235,0.1); border: 1px solid rgba(52,168,235,0.3); padding: 12px; border-radius: 8px; margin-top: 16px;">💡 <strong style="color:#34a8eb;">สรุปย่อ (TL;DR):</strong>...</div>\nตอบด้วย HTML format ห้ามใช้ Markdown`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
            });

            const data = await response.json();
            if (data.candidates && data.candidates[0].content.parts[0].text) {
                let aiResponse = data.candidates[0].content.parts[0].text.replace(/```html/g, '').replace(/```/g, '').trim();
                localStorage.setItem(cacheKey, aiResponse);
                modalBody.innerHTML = `${visualHtml}<h4 class="text-white text-lg font-bold leading-snug mb-2">${headline}</h4><div class="flex items-center gap-2 pb-3 mb-3 border-b border-border-dark/50"><span class="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded font-bold uppercase">${source}</span><span class="text-slate-500 text-[10px]">${dateStr}</span></div><div class="text-slate-300 text-sm leading-relaxed space-y-4 font-medium">${aiResponse}</div>`;
            } else { throw new Error('AI Failed'); }
        } catch (e) {
            modalBody.innerHTML = `<p class="text-white text-lg font-bold">${headline}</p><p class="mt-3 text-slate-300 text-sm">${summary}</p>`;
        }
    };

    document.addEventListener('click', (e) => {
        const btnClose = e.target.closest('#btn-close-news');
        if (btnClose || e.target.id === 'modal-news-detail') {
            const modal = document.getElementById('modal-news-detail');
            const modalContent = document.getElementById('modal-news-content');
            if (modal) {
                modal.classList.add('opacity-0'); modalContent.classList.add('scale-95');
                setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 200);
            }
        }
    });

});
