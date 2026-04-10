document.addEventListener('DOMContentLoaded', () => {
    
    // 📌 ระบบสลับ Key อัตโนมัติ (Round Robin)
    const finnhubKeys = (window.ENV_KEYS.FINNHUB_ARRAY && window.ENV_KEYS.FINNHUB_ARRAY.length > 0) 
                        ? window.ENV_KEYS.FINNHUB_ARRAY 
                        : (window.ENV_KEYS.FINNHUB ? window.ENV_KEYS.FINNHUB.split(',').map(k => k.trim()).filter(Boolean) : []);
    let fhKeyIndex = 0;
    const getFHKey = () => {
        if (!finnhubKeys.length) return '';
        const key = finnhubKeys[fhKeyIndex % finnhubKeys.length];
        fhKeyIndex++;
        return key;
    };

    const AV_API_KEY = window.ENV_KEYS.ALPHAVANTAGE;

    const urlParams = new URLSearchParams(window.location.search);
    const symbol = urlParams.get('symbol') || 'TSLA'; 

    document.getElementById('detail-symbol').textContent = symbol.toUpperCase();
    let currentStockName = symbol; 

    const isCrypto = symbol.includes('BINANCE:') || symbol.includes('COINBASE:');
    const isForex = symbol.includes('OANDA:') || symbol.includes('FX:');
    const isThaiStock = symbol.includes('.BK');

    // ==========================================
    // 📌 1. ระบบจัดการปุ่มดาว (Watchlist)
    // ==========================================
    const btnStar = document.getElementById('btn-toggle-star');
    const iconStar = document.getElementById('icon-star');
    const modalRemove = document.getElementById('modal-remove-star');
    const modalContent = document.getElementById('modal-remove-content');

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
            
            const unique = [];
            const seen = new Set();
            data.watchlist.forEach(item => {
                if (item && item.symbol && !seen.has(item.symbol)) {
                    seen.add(item.symbol);
                    unique.push(item);
                }
            });
            data.watchlist = unique;

            const exists = data.watchlist.some(s => s.symbol === symbol);
            
            if (exists) {
                const textEl = document.getElementById('remove-symbol-text');
                if(textEl) textEl.textContent = symbol;
                modalRemove?.classList.remove('hidden');
                modalRemove?.classList.add('flex');
                setTimeout(() => { 
                    modalRemove?.classList.remove('opacity-0'); 
                    modalContent?.classList.remove('scale-95'); 
                }, 10);
            } else {
                data.watchlist.push({ 
                    symbol: symbol, 
                    name: currentStockName, 
                    currentPrice: parseFloat(document.getElementById('detail-price').dataset.rawPrice || 0), 
                    previousClose: 0
                });
                localStorage.setItem('koda_portfolio_data', JSON.stringify(data));
                if (window.kodaApiData) window.kodaApiData.watchlist = data.watchlist; 
                updateStarUI();
            }
        });
    }

    document.getElementById('btn-cancel-remove')?.addEventListener('click', () => {
        modalRemove?.classList.add('opacity-0');
        modalContent?.classList.add('scale-95');
        setTimeout(() => { modalRemove?.classList.add('hidden'); modalRemove?.classList.remove('flex'); }, 200);
    });

    document.getElementById('btn-confirm-remove')?.addEventListener('click', () => {
        let data = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{"watchlist":[]}');
        data.watchlist = data.watchlist.filter(s => s.symbol !== symbol);
        localStorage.setItem('koda_portfolio_data', JSON.stringify(data));
        if (window.kodaApiData) window.kodaApiData.watchlist = data.watchlist; 
        updateStarUI();
        document.getElementById('btn-cancel-remove')?.click();
    });

    // ==========================================
    // 📌 2. ระบบสร้างกราฟ + S/R + Timeframe
    // ==========================================
    const renderChart = () => {
        const containerId = 'tv-widget-container';
        const container = document.getElementById(containerId);
        if (!container) return;

        const chartSection = container.parentElement;
        if (!document.getElementById('chart-controls-wrapper')) {
            const controlsHTML = `
                <div id="chart-controls-wrapper" class="bg-background-dark border-b border-border-dark/30">
                    <div class="flex justify-between items-center px-4 py-2">
                        <div class="bg-surface-dark border border-border-dark rounded-lg p-0.5 flex text-[10px] font-bold uppercase tracking-wider">
                            <button id="btn-chart-koda" class="px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-300 transition-colors">KODA SR</button>
                            <button id="btn-chart-tv" class="px-3 py-1.5 rounded-md bg-primary/20 text-primary transition-colors">TradingView</button>
                        </div>
                        <div id="tf-selector" class="flex gap-1" style="display: none;">
                            ${['3M', '6M', '1Y', '3Y'].map(tf => `
                                <button class="tf-btn px-2.5 py-1.5 text-[10px] font-black rounded-md transition-all ${tf === '1Y' ? 'text-primary bg-primary/10' : 'text-slate-500 hover:text-slate-300'}" data-tf="${tf}">${tf}</button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            chartSection.insertAdjacentHTML('afterbegin', controlsHTML);
        }

        const btnKoda = document.getElementById('btn-chart-koda');
        const btnTV = document.getElementById('btn-chart-tv');
        const tfSelector = document.getElementById('tf-selector');
        
        let currentChartMode = 'tv';
        let currentTimeframe = '1Y';
        let kodaChartInstance = null;

        const showLoading = () => {
            container.innerHTML = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;">
                <div style="width:28px;height:28px;border:2px solid #34a8eb;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
                <p style="color:#848e9c;font-size:12px;font-family:Inter,sans-serif;">Loading chart...</p>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
        };

        const showChartError = (message) => {
            if (kodaChartInstance) { kodaChartInstance.remove(); kodaChartInstance = null; }
            container.innerHTML = `
                <div style="width:100%;height:350px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;box-sizing:border-box;">
                    <div style="width:40px;height:40px;border-radius:50%;background:rgba(246,70,93,0.15);display:flex;align-items:center;justify-content:center;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f6465d" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <p style="color:#f6465d;font-size:13px;font-family:Inter,sans-serif;font-weight:700;">ไม่สามารถโหลดข้อมูลได้</p>
                    <p style="color:#848e9c;font-size:11px;font-family:Inter,sans-serif;text-align:center;max-width:240px;line-height:1.6;">${message || 'แหล่งข้อมูลทั้งหมดไม่ตอบสนอง กรุณาลองใหม่อีกครั้ง'}</p>
                    <button id="koda-retry-btn" style="margin-top:4px;padding:6px 16px;background:rgba(52,168,235,0.15);border:1px solid rgba(52,168,235,0.4);border-radius:8px;color:#34a8eb;font-size:11px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;">ลองใหม่</button>
                </div>`;
            document.getElementById('koda-retry-btn')?.addEventListener('click', () => renderAdvancedSR());
        };

        const renderTradingViewFallback = () => {
            if (kodaChartInstance) { kodaChartInstance.remove(); kodaChartInstance = null; }
            tfSelector.style.display = 'none';
            container.innerHTML = '';
            container.style.width = '100%';
            container.style.height = '400px'; 
            const initTV = () => {
                let tvSym = symbol;
                if (symbol === 'XAUUSD') tvSym = 'OANDA:XAUUSD';
                else if (symbol.includes(':')) tvSym = symbol;
                new TradingView.widget({
                    "autosize": true, "symbol": tvSym, "interval": "D",
                    "timezone": "Etc/UTC", "theme": "dark", "style": "1", "locale": "en",
                    "enable_publishing": false, "backgroundColor": "#0a0e17",
                    "gridColor": "rgba(42, 46, 57, 0.5)", "hide_top_toolbar": false,
                    "hide_legend": false, "save_image": false, "container_id": containerId,
                    "allow_symbol_change": false, "withdateranges": true,
                    "studies": ["Volume@tv-basicstudies"]
                });
            };
            if (window.TradingView) { initTV(); }
            else {
                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = 'https://s3.tradingview.com/tv.js';
                script.onload = initTV;
                container.appendChild(script);
            }
        };

        const loadLightweightCharts = () => new Promise((resolve, reject) => {
            if (window.LightweightCharts) { resolve(); return; }
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js';
            script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
        });

        const fetchCandleData = async (tfRange) => {
            const rangeMap = { '3M': 90, '6M': 180, '1Y': 365, '3Y': 1095 };
            const days = rangeMap[tfRange] || 365;

            if (isCrypto) {
                const data = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol.split(':')[1] || symbol}&interval=1d&limit=${days}`).then(r => r.json());
                return { timestamps: data.map(k => Math.floor(k[0] / 1000)), opens: data.map(k => parseFloat(k[1])), highs: data.map(k => parseFloat(k[2])), lows: data.map(k => parseFloat(k[3])), closes: data.map(k => parseFloat(k[4])), volumes: data.map(k => parseFloat(k[5])) };
            }

            const CACHE_KEY = `koda_chart_v3_${symbol}_${tfRange}`;
            try { const cached = localStorage.getItem(CACHE_KEY); if (cached) { const { ts, data } = JSON.parse(cached); if (Date.now() - ts < 12 * 3600000) return data; } } catch(_) {}

            // 🟢 1. Finnhub
            const token = getFHKey();
            if (!isThaiStock && token) {
                try {
                    const cleanSym = symbol.split(':')[1] || symbol.split('.')[0];
                    const toDate = Math.floor(Date.now() / 1000);
                    const fromDate = toDate - (days * 24 * 60 * 60);
                    const res = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${cleanSym}&resolution=D&from=${fromDate}&to=${toDate}&token=${token}`);
                    if (res.status === 429) console.warn(`⚠️ Finnhub 429 Rate Limit`);
                    else if (res.status === 403) console.warn(`⚠️ Finnhub 403 Forbidden`);
                    else {
                        const data = await res.json();
                        if (data && data.s === "ok" && data.t && data.t.length > 0) {
                            const parsed = { timestamps: data.t, opens: data.o, highs: data.h, lows: data.l, closes: data.c, volumes: data.v };
                            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: parsed })); } catch(_) {}
                            return parsed;
                        }
                        console.warn(`⚠️ Finnhub: ${data.s || 'no_data'} → Yahoo fallback`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Finnhub failed:`, e.message);
                }
            }

            // 🟠 2. Yahoo Finance — ลอง server-side proxy ก่อน (น่าเชื่อถือที่สุด)
            const yahooRange = tfRange === '3M' ? '3mo' : tfRange === '6M' ? '6mo' : tfRange === '1Y' ? '1y' : '5y';
            const parseYahoo = (raw) => {
                if (raw?.chart?.result?.[0]) {
                    const q = raw.chart.result[0].indicators.quote[0];
                    return { timestamps: raw.chart.result[0].timestamp, opens: q.open, highs: q.high, lows: q.low, closes: q.close, volumes: q.volume };
                }
                return null;
            };
            const saveAndReturn = (parsed) => {
                try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: parsed })); } catch(_) {}
                return parsed;
            };
            const fetchWithTimeout = (url, ms = 12000) => {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), ms);
                return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
            };

            // 🔵 2a. Server-side proxy (Vercel API) — เลี่ยง CORS ได้ 100%
            try {
                console.log(`🔵 ลอง server-side proxy /api/chart...`);
                const raw = await fetchWithTimeout(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${tfRange}`, 15000).then(r => r.json());
                const parsed = parseYahoo(raw);
                if (parsed) { console.log(`✅ server-side proxy สำเร็จ`); return saveAndReturn(parsed); }
            } catch (e) {
                console.warn(`⚠️ /api/chart ล้มเหลว:`, e.message);
            }

            // 🟠 2b. CORS Proxies (client-side fallbacks)
            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${yahooRange}&interval=1d`;
            const PROXIES = [
                u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
                u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
                u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
                u => `https://thingproxy.freeboard.io/fetch/${u}`,
                u => `https://cors.eu.org/${u}`,
            ];
            for (let i = 0; i < PROXIES.length; i++) {
                try {
                    console.log(`🌐 CORS Proxy ${i + 1}/${PROXIES.length}...`);
                    const raw = await fetchWithTimeout(PROXIES[i](yahooUrl), 12000).then(r => r.json());
                    const parsed = parseYahoo(raw);
                    if (parsed) { console.log(`✅ Proxy ${i + 1} สำเร็จ`); return saveAndReturn(parsed); }
                } catch (err) {
                    console.warn(`❌ Proxy ${i + 1} ล้มเหลว:`, err.message);
                }
            }

            // 🔴 ทุก source ล้มเหลว
            console.error(`🚨 ทุก data source ล้มเหลวสำหรับ ${symbol} [${tfRange}]`);
            return null;
        };

        const calculateSupportResistance = (candles) => {
            if (!candles || candles.length < 20) return [];
            const currentPrice = candles[candles.length - 1].close, highs = candles.map(c => c.high), lows = candles.map(c => c.low), n = candles.length;
            const lookback = Math.max(3, Math.floor(n / 25));
            const swingHighs = [], swingLows = [];
            for (let i = lookback; i < n - lookback; i++) {
                let isHigh = true, isLow = true;
                for (let j = 1; j <= lookback; j++) {
                    if (highs[i] <= highs[i - j] || highs[i] <= highs[i + j]) isHigh = false;
                    if (lows[i] >= lows[i - j] || lows[i] >= lows[i + j]) isLow = false;
                }
                if (isHigh) swingHighs.push({ price: highs[i], score: (i/n) });
                if (isLow) swingLows.push({ price: lows[i], score: (i/n) });
            }
            const threshold = currentPrice * 0.015;
            const pick = (items, filter) => {
                const res = [];
                items.sort((a,b)=>b.score - a.score);
                for (let it of items) {
                    if (filter(it.price) && !res.some(p => Math.abs(p.price - it.price) < threshold)) res.push(it);
                    if (res.length >= 4) break;
                }
                return res;
            };
            const toLvl = (items, type) => items.map((it, idx) => ({ price: it.price, type, strength: idx === 0 ? 3 : 1 }));
            return [...toLvl(pick(swingHighs, p => p > currentPrice), 'res'), ...toLvl(pick(swingLows, p => p < currentPrice), 'sup')];
        };

        const renderAdvancedSR = async () => {
            showLoading();
            tfSelector.style.display = 'flex';
            try {
                await loadLightweightCharts();
                if (kodaChartInstance) { kodaChartInstance.remove(); kodaChartInstance = null; }

                const candleResult = await fetchCandleData(currentTimeframe);

                if (!candleResult) {
                    showChartError('ไม่สามารถโหลดข้อมูลได้ในขณะนี้\nกรุณากดลองใหม่ หรือเปลี่ยน Timeframe');
                    return;
                }

                const { timestamps, opens, highs, lows, closes, volumes } = candleResult;
                
                let candles = timestamps.map((t, i) => ({ time: t, open: Number(opens[i]), high: Number(highs[i]), low: Number(lows[i]), close: Number(closes[i]), volume: Number(volumes[i] || 0) }))
                    .filter(c => [c.open, c.high, c.low, c.close].every(v => isFinite(v) && v > 0))
                    .sort((a, b) => a.time - b.time);
                
                const seen = new Set();
                candles = candles.filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; });

                if (candles.length === 0) {
                    showChartError('ไม่พบข้อมูลแท่งเทียนสำหรับ ' + symbol);
                    return;
                }

                const levels = calculateSupportResistance(candles);

                container.innerHTML = '<div id="detail-sr-chart" style="width:100%;height:100%;min-height:350px;"></div>';
                const chartEl = document.getElementById('detail-sr-chart');
                kodaChartInstance = window.LightweightCharts.createChart(chartEl, {
                    width: chartEl.clientWidth, height: 350,
                    layout: { background: { type: 'solid', color: '#0a0e17' }, textColor: '#848e9c', fontSize: 12 },
                    grid: { vertLines: { color: 'rgba(42, 46, 57, 0.2)' }, horzLines: { color: 'rgba(42, 46, 57, 0.2)' } },
                    rightPriceScale: { borderColor: 'rgba(42, 46, 57, 0.8)', autoScale: true },
                    timeScale: { borderColor: 'rgba(42, 46, 57, 0.8)', timeVisible: true }
                });
                
                const candleSeries = kodaChartInstance.addCandlestickSeries({ 
                    upColor: '#0ecb81', downColor: '#f6465d', 
                    borderUpColor: '#0ecb81', borderDownColor: '#f6465d', 
                    wickUpColor: '#0ecb81', wickDownColor: '#f6465d',
                    priceLineColor: '#fbbf24', priceLineWidth: 2, priceLineStyle: 2          
                });
                candleSeries.setData(candles);

                const volumeSeries = kodaChartInstance.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'volume' });
                kodaChartInstance.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
                volumeSeries.setData(candles.map(c => ({ time: c.time, value: c.volume || 0, color: c.close >= c.open ? 'rgba(14,203,129,0.3)' : 'rgba(246,70,93,0.3)' })));
                
                levels.forEach(lvl => {
                    candleSeries.createPriceLine({
                        price: lvl.price,
                        color: lvl.type === 'sup' ? 'rgba(14,203,129,0.85)' : 'rgba(246,70,93,0.85)',
                        lineWidth: lvl.strength === 3 ? 2 : 1, 
                        lineStyle: lvl.strength === 3 ? 0 : 2, 
                        axisLabelVisible: true, title: '' 
                    });
                });
                
                kodaChartInstance.timeScale().fitContent();

                const ro = new ResizeObserver(entries => {
                    for (const entry of entries) {
                        if (entry.contentRect.width > 0 && entry.contentRect.height > 0 && kodaChartInstance) {
                            kodaChartInstance.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
                        }
                    }
                });
                ro.observe(chartEl);
                window.addEventListener('beforeunload', () => ro.disconnect(), { once: true });

            } catch (e) {
                console.error('KODA Chart error:', e);
                showChartError('เกิดข้อผิดพลาดในการแสดงกราฟ\nกรุณากดลองใหม่อีกครั้ง');
            }
        };

        document.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentTimeframe = btn.dataset.tf;
                document.querySelectorAll('.tf-btn').forEach(b => {
                    b.classList.remove('text-primary', 'bg-primary/10');
                    b.classList.add('text-slate-500');
                });
                btn.classList.add('text-primary', 'bg-primary/10');
                btn.classList.remove('text-slate-500');
                if (currentChartMode === 'koda') renderAdvancedSR();
            });
        });

        btnKoda.addEventListener('click', () => {
            currentChartMode = 'koda';
            btnKoda.className = "px-3 py-1.5 rounded-md bg-primary/20 text-primary transition-colors";
            btnTV.className = "px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-300 transition-colors";
            renderAdvancedSR();
        });

        btnTV.addEventListener('click', () => {
            currentChartMode = 'tv';
            btnTV.className = "px-3 py-1.5 rounded-md bg-primary/20 text-primary transition-colors";
            btnKoda.className = "px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-300 transition-colors";
            renderTradingViewFallback();
        });

        renderTradingViewFallback();
    };
    renderChart();
    
    // ==========================================
    // 📌 3. ระบบดึงข้อมูลราคาและข่าว 
    // ==========================================
 
    const loadPriceFirst = async () => {
        try {
            const cleanSym = symbol.split(':')[1] || symbol.split('.')[0];
            const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${cleanSym}&token=${getFHKey()}`);
            const quote = await res.json();

            if (!quote || !quote.c || quote.c <= 0) return null;

            let currencyCode = 'USD';
            if (symbol.includes('.HK')) currencyCode = 'HKD';
            else if (symbol.includes('.SS')) currencyCode = 'CNY';
            
            const isPositive = quote.d >= 0;
            const priceEl = document.getElementById('detail-price');
            const changeEl = document.getElementById('detail-change');
            
            if (priceEl) {
                priceEl.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(quote.c);
                priceEl.dataset.rawPrice = quote.c;
            }
            if (changeEl) {
                changeEl.className = `text-sm font-bold px-2 py-0.5 rounded flex items-center gap-1 ${isPositive ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`;
                changeEl.innerHTML = `<span class="material-symbols-outlined text-[14px]">${isPositive ? 'trending_up' : 'trending_down'}</span> ${isPositive ? '+' : ''}${quote.d ? quote.d.toFixed(2) : '0.00'} (${quote.dp ? quote.dp.toFixed(2) : '0.00'}%)`;
                changeEl.style.display = 'flex';
            }
            return quote;
        } catch (e) {
            console.error("Price fetch error:", e);
            return null;
        }
    };

    const fetchStockData = async () => {
        try {
            const today = new Date();
            const past15Days = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000);
            const formatDate = (date) => date.toISOString().split('T')[0];
            const cleanSym = symbol.split(':')[1] || symbol.split('.')[0];

            let newsData = []; 
            let quote = null, profile = null, metricsObj = null, consensusData = null, insiderData = null;

            if (!isThaiStock) {
                try {
                    const [qRes, pRes, mRes, cRes, iRes] = await Promise.all([
                        fetch(`https://finnhub.io/api/v1/quote?symbol=${cleanSym}&token=${getFHKey()}`).then(r=>r.json()),
                        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${cleanSym}&token=${getFHKey()}`).then(r=>r.json()),
                        fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${cleanSym}&metric=all&token=${getFHKey()}`).then(r=>r.json()),
                        fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${cleanSym}&token=${getFHKey()}`).then(r=>r.json()),
                        fetch(`https://finnhub.io/api/v1/stock/insider-transactions?symbol=${cleanSym}&token=${getFHKey()}`).then(r=>r.json())
                    ]);
                    quote = qRes; profile = pRes; metricsObj = mRes; consensusData = cRes; insiderData = iRes;
                } catch (e) { console.warn("Basic data fetch error"); }
            }

            if (!isThaiStock) {
                if (isCrypto || isForex || symbol === 'XAUUSD') {
                    const category = isCrypto ? 'crypto' : 'forex';
                    let catNews = await fetch(`https://finnhub.io/api/v1/news?category=${category}&token=${getFHKey()}`).then(r=>r.json());
                    newsData = catNews;
                } else {
                    let compNews = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${cleanSym}&from=${formatDate(past15Days)}&to=${formatDate(today)}&token=${getFHKey()}`).then(r=>r.json()).catch(()=>[]);
                    if (compNews && compNews.length > 0) {
                        newsData = compNews;
                    } else {
                        const rssUrl = 'https://th.investing.com/rss/stock_Market.rss';
                        const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
                        try {
                            const res = await fetch(proxyUrl);
                            const data = await res.json();
                            if (data && data.status === 'ok' && data.items) {
                                newsData = data.items.map(item => ({
                                    headline: item.title || "",
                                    summary: (item.description || "").replace(/<\/?[^>]+(>|$)/g, ""),
                                    url: item.link || "",
                                    source: "Investing.com",
                                    datetime: Math.floor(Date.parse(item.pubDate || "") / 1000)
                                }));
                            }
                        } catch(e) { console.warn("Investing fallback failed"); }
                    }
                }
            }

            let currencyCode = 'USD';
            if (symbol.includes('.HK')) currencyCode = 'HKD';
            else if (symbol.includes('.SS')) currencyCode = 'CNY';

            if (!isThaiStock && quote && quote.c > 0) {
                const isPositive = quote.d >= 0;
                document.getElementById('detail-price').textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(quote.c);
                document.getElementById('detail-price').dataset.rawPrice = quote.c;
                const changeEl = document.getElementById('detail-change');
                changeEl.className = `text-sm font-bold px-2 py-0.5 rounded flex items-center gap-1 ${isPositive ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`;
                changeEl.innerHTML = `<span class="material-symbols-outlined text-[14px]">${isPositive ? 'trending_up' : 'trending_down'}</span> ${isPositive ? '+' : ''}${quote.d.toFixed(2)} (${quote.dp.toFixed(2)}%)`;
                changeEl.style.display = 'flex';
            }

            if (profile && profile.name) {
                currentStockName = profile.name;
                document.getElementById('detail-name').textContent = profile.name;
            }

            const consensusSection = document.getElementById('consensus-section');
            let consensusSummaryText = "";
            if (consensusData && consensusData.length > 0 && consensusSection) {
                consensusSection.style.display = 'block';
                const cur = consensusData[0];
                const total = cur.buy + cur.strongBuy + cur.hold + cur.sell + cur.strongSell;
                if (total > 0) {
                    const buyTotal = cur.buy + cur.strongBuy, sellTotal = cur.sell + cur.strongSell, holdTotal = cur.hold;
                    document.getElementById('consensus-total').textContent = `${total} Ratings`;
                    document.getElementById('consensus-buy').textContent = `${buyTotal} Buy`;
                    document.getElementById('consensus-hold').textContent = `${holdTotal} Hold`;
                    document.getElementById('consensus-sell').textContent = `${sellTotal} Sell`;
                    document.getElementById('consensus-bar').innerHTML = `<div style="width: ${(buyTotal/total)*100}%" class="bg-success h-full"></div><div style="width: ${(holdTotal/total)*100}%" class="bg-slate-400 h-full"></div><div style="width: ${(sellTotal/total)*100}%" class="bg-danger h-full"></div>`;
                    consensusSummaryText = `Buy: ${buyTotal}, Hold: ${holdTotal}, Sell: ${sellTotal}`;
                }
            }

            const insiderSection = document.getElementById('insider-section');
            const insiderContainer = document.getElementById('insider-container');
            if (insiderData && insiderData.data && insiderData.data.length > 0) {
                if (insiderSection) insiderSection.style.display = 'block';
                const txs = insiderData.data.slice(0, 4); 
                insiderContainer.innerHTML = txs.map(tx => {
                    const isBuy = tx.change > 0;
                    const shares = Math.abs(tx.change).toLocaleString();
                    const txDate = tx.transactionDate || tx.filingDate || 'Recent';
                    const name = tx.name ? tx.name.split(' ').slice(0, 2).join(' ') : 'Insider'; 
                    return `<div class="bg-surface-dark border border-border-dark rounded-xl p-3 flex items-center justify-between"><div class="flex items-center gap-3 min-w-0"><div class="size-8 rounded-full ${isBuy ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'} flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[16px]">${isBuy ? 'shopping_cart' : 'payments'}</span></div><div class="truncate pr-2"><p class="text-slate-100 text-sm font-bold truncate">${name}</p><p class="text-slate-500 text-[10px] font-medium mt-0.5">${txDate}</p></div></div><div class="text-right shrink-0"><p class="${isBuy ? 'text-success' : 'text-danger'} text-sm font-bold">${isBuy ? '+' : '-'}${shares}</p><p class="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">Shares</p></div></div>`;
                }).join('');
            } else { if (insiderSection) insiderSection.style.display = 'none'; }

            if (metricsObj && metricsObj.metric) {
                const m = metricsObj.metric;
                const formatNum = (v, s='') => (v !== undefined && v !== null) ? v.toFixed(2) + s : '-';
                document.getElementById('stat-pe').textContent = formatNum(m.peExclExtraTTM);
                document.getElementById('stat-eps').textContent = formatNum(m.epsTTM);
                document.getElementById('stat-mcap').textContent = profile?.marketCapitalization ? (profile.marketCapitalization > 1000 ? (profile.marketCapitalization/1000).toFixed(2)+'B' : profile.marketCapitalization.toFixed(2)+'M') : '-';
                document.getElementById('stat-rev').textContent = formatNum(m.revenuePerShareTTM, ' /sh');
                document.getElementById('stat-ps').textContent = formatNum(m.psTTM);
                document.getElementById('stat-margin').textContent = formatNum(m.netProfitMarginTTM, '%');
                document.getElementById('stat-beta').textContent = formatNum(m.beta);
                document.getElementById('stat-div').textContent = formatNum(m.dividendYieldIndicatedAnnual, '%');
                document.getElementById('stat-yoy').textContent = formatNum(m.revenueGrowthTTMYoy, '%');

                const summaryEl = document.getElementById('ai-financial-summary');
                const cacheKeyAI = `koda_ai_summary_${symbol}`;
                const cachedSummary = localStorage.getItem(cacheKeyAI);
                const now = Date.now();
                const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

                if (cachedSummary) {
                    const parsed = JSON.parse(cachedSummary);
                    if (now - parsed.timestamp < SEVEN_DAYS) {
                        summaryEl.innerHTML = parsed.text;
                    } else {
                        localStorage.removeItem(cacheKeyAI);
                    }
                }

                if (!localStorage.getItem(cacheKeyAI)) {
                    summaryEl.textContent = "KODA AI is analyzing metrics...";
                    try {
                        const GEMINI_API_KEY = window.ENV_KEYS.GEMINI[0];
                        const prompt = `ในฐานะนักวิเคราะห์การเงิน โปรดสรุปข้อมูลหุ้น ${symbol} เป็นภาษาไทย 2-3 บรรทัดให้เข้าใจง่าย อิงจากข้อมูลนี้: PE: ${formatNum(m.peExclExtraTTM)}, EPS: ${formatNum(m.epsTTM)}, Rev Growth: ${formatNum(m.revenueGrowthTTMYoy, '%')}, Margin: ${formatNum(m.netProfitMarginTTM, '%')}, Consensus: ${consensusSummaryText || 'N/A'}`;
                        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } })
                        });
                        const data = await response.json();
                        if (data.candidates && data.candidates[0].content.parts[0].text) {
                            const aiText = data.candidates[0].content.parts[0].text;
                            summaryEl.innerHTML = aiText;
                            localStorage.setItem(cacheKeyAI, JSON.stringify({ timestamp: now, text: aiText }));
                        } else { throw new Error('AI Failed'); }
                    } catch (e) {
                        let fallbackText = `Based on financial data, ${symbol} is showing revenue growth of ${formatNum(metricsObj.metric.revenueGrowthTTMYoy, '%')}.`;
                        summaryEl.textContent = (window.KodaAI && typeof window.KodaAI.translateText === 'function') ? await window.KodaAI.translateText(fallbackText) : fallbackText;
                    }
                }
            }  
            document.getElementById('ai-loading-bar').classList.replace('animate-pulse', 'bg-success');

            const newsContainer = document.getElementById('stock-news-container');
            if (newsContainer) {
                if (isThaiStock) {
                    newsContainer.innerHTML = `<p class="text-slate-500 text-sm text-center py-4">News catalysts not available for Thai stocks.</p>`;
                } else if (newsData.length > 0) {
                    const fifteenDaysAgoUnix = Math.floor(Date.now() / 1000) - (15 * 24 * 60 * 60);
                    let recentNews = newsData.filter(n => n.datetime >= fifteenDaysAgoUnix);

                    if (recentNews.length > 0) {
                        const isTranslateOn = localStorage.getItem('koda_translate_th') === 'true';
                        const newsHTMLPromises = recentNews.map(async n => {
                            const dateStr = new Date(n.datetime*1000).toLocaleDateString();
                            let rawDesc = n.summary ? (n.summary.substring(0, 150) + '...') : 'Tap to read full coverage.';
                            rawDesc = rawDesc.replace(/<\/?[^>]+(>|$)/g, ""); 
                            let imgUrl = n.image || (window.KodaAI && window.KodaAI.findImage ? window.KodaAI.findImage(n.headline) : 'https://images.unsplash.com/photo-1611974714652-96574f9d48b1?q=80&w=400');

                            let finalHeadline = n.headline;
                            let finalDesc = rawDesc;
                            
                            if (isTranslateOn && window.KodaAI && !/[\u0E00-\u0E7F]/.test(finalHeadline)) {
                                finalHeadline = await window.KodaAI.translateText(n.headline);
                                finalDesc = await window.KodaAI.translateText(rawDesc);
                            }

                            return `
                            <div onclick="window.openNewsModal(\`${encodeURIComponent(n.headline)}\`, \`${encodeURIComponent(n.summary || '')}\`, \`${n.url}\`, \`${n.source || 'Investing'}\`, \`${dateStr}\`, \`${imgUrl}\`)" class="block bg-surface-dark border-l-2 border-primary rounded-r-xl p-3 flex gap-3 active:scale-[0.98] hover:bg-slate-800 transition-all mb-3 shadow-sm cursor-pointer">
                                <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                    <div class="flex items-center justify-between mb-1.5"><span class="text-primary text-[10px] font-bold uppercase truncate mr-2">${n.source || 'Investing'}</span><span class="text-slate-500 text-[10px]">${dateStr}</span></div>
                                    <h4 class="text-white text-sm font-semibold line-clamp-2 leading-snug">${finalHeadline}</h4>
                                    <p class="text-slate-400 text-xs mt-1.5 line-clamp-2">${finalDesc}</p>
                                </div>
                                <div class="size-20 rounded-lg bg-slate-900 shrink-0 overflow-hidden border border-border-dark/50">
                                    <img src="${imgUrl}" class="w-full h-full object-cover">
                                </div>
                            </div>`;
                        });
                        newsContainer.innerHTML = (await Promise.all(newsHTMLPromises)).join('');
                    } else {
                        newsContainer.innerHTML = `<p class="text-slate-500 text-sm text-center py-4">No recent news catalysts found within 15 days.</p>`;
                    }
                } else { newsContainer.innerHTML = `<p class="text-slate-500 text-sm text-center py-4">No recent news catalysts found.</p>`; }
            }
        } catch (e) { console.error("Data Fetch Error:", e); }
    };
    loadPriceFirst();
    fetchStockData();

    // ==========================================
    // 📌 4. ระบบ AI Summary สำหรับข่าว
    // ==========================================
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
            modalBody.innerHTML = `
                ${visualHtml}
                <h4 class="text-white text-lg font-bold leading-snug mb-2">${headline}</h4>
                <div class="flex items-center gap-2 pb-3 mb-3 border-b border-border-dark/50">
                    <span class="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded font-bold uppercase">${source}</span>
                    <span class="text-slate-500 text-[10px]">${dateStr}</span>
                </div>
                <div class="text-slate-300 text-sm leading-relaxed space-y-4 font-medium">${cachedContent}</div>
            `;
            return; 
        }
        
        modalBody.innerHTML = `
            ${visualHtml}
            <div class="flex flex-col items-center justify-center py-6">
                <div class="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p class="text-primary text-sm font-bold animate-pulse">KODA AI is analyzing...</p>
                <p class="text-slate-500 text-[10px] mt-1 uppercase tracking-wider text-center">Processing Market Impacts</p>
            </div>
        `;

        try {
            const GEMINI_API_KEY = window.ENV_KEYS.GEMINI[0]; 
            const prompt = `ในฐานะนักวิเคราะห์การเงิน โปรดอ่านหัวข้อข่าวและเนื้อหาย่อต่อไปนี้:
            Headline: ${headline}
            Summary: ${summary}
            
            โปรดวิเคราะห์ข่าวนี้เป็น "ภาษาไทย" ให้เห็นภาพชัดเจน โดยบังคับใช้โครงสร้าง HTML ดังนี้:
            <p>📝 <strong style="color:#fff;">สรุปเหตุการณ์:</strong> (สรุปเหตุการณ์ที่เกิดขึ้นสั้นๆ)</p>
            <p>🌍 <strong style="color:#fff;">ผลกระทบ:</strong> (วิเคราะห์ผลกระทบต่อบริษัท อุตสาหกรรม หรือราคาหุ้น)</p>
            <div style="background: rgba(52,168,235,0.1); border: 1px solid rgba(52,168,235,0.3); padding: 12px; border-radius: 8px; margin-top: 16px;">
                💡 <strong style="color:#34a8eb;">สรุปย่อ (TL;DR):</strong> (เขียนสรุปใจความสำคัญทั้งหมดใน 1-2 ประโยคสั้นๆ เพื่อให้อ่านปุ๊บเข้าใจทันที)
            </div>
            
            ตอบด้วย HTML format ตามที่กำหนดเท่านั้น ห้ามใช้ Markdown (เช่น ** หรือ *) เด็ดขาด`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5 } })
            });

            const data = await response.json();
            if (data.candidates && data.candidates[0].content.parts[0].text) {
                let aiResponse = data.candidates[0].content.parts[0].text.replace(/```html/g, '').replace(/```/g, '').trim();
                localStorage.setItem(cacheKey, aiResponse);
                modalBody.innerHTML = `
                    ${visualHtml}
                    <h4 class="text-white text-lg font-bold leading-snug mb-2">${headline}</h4>
                    <div class="flex items-center gap-2 pb-3 mb-3 border-b border-border-dark/50">
                        <span class="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded font-bold uppercase">${source}</span>
                        <span class="text-slate-500 text-[10px]">${dateStr}</span>
                    </div>
                    <div class="text-slate-300 text-sm leading-relaxed space-y-4 font-medium">${aiResponse}</div>
                `;
            } else { throw new Error('AI Failed'); }
        } catch (e) {
            modalBody.innerHTML = `<p class="text-white text-lg font-bold">${headline}</p><p class="mt-3 text-slate-300 text-sm">${summary}</p>`;
        }
    };

    document.addEventListener('click', (e) => {
        const btnClose = e.target.closest('#btn-close-news');
        const isClickOutside = e.target.id === 'modal-news-detail';
        if (btnClose || isClickOutside) {
            const modal = document.getElementById('modal-news-detail');
            const modalContent = document.getElementById('modal-news-content');
            if (modal) {
                modal.classList.add('opacity-0'); modalContent.classList.add('scale-95');
                setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 200);
            }
        }
    });

    // ==========================================
    // 📌 5. ระบบ Financials
    // ==========================================
    const initFinancials = () => {
        const finBtn = document.getElementById('fin-dropdown-btn');
        if (!finBtn) return;
        let finDataCache = { income: [], balance: [], cashflow: [], years: [] };
        let currentFinTab = 'income';
        let finChartInstance = null;

        const formatFinNumber = (n) => {
            if (n === null || isNaN(n)) return '-';
            const abs = Math.abs(n);
            if (abs >= 1e9) return (n/1e9).toFixed(2) + 'B';
            if (abs >= 1e6) return (n/1e6).toFixed(2) + 'M';
            return n.toLocaleString();
        };

        const renderFinancials = () => {
            const listEl = document.getElementById('fin-data-list');
            const ctx = document.getElementById('financials-chart');
            if (!finDataCache.years.length) { listEl.innerHTML = `<p class="text-center text-slate-500 text-xs py-4">Financial data unavailable.</p>`; return; }

            let datasets = [];
            const latest = finDataCache.years.length - 1, prev = Math.max(0, latest - 1);
            const createRow = (label, curr, p) => {
                const pct = (curr && p) ? ((curr - p)/Math.abs(p)*100).toFixed(2) : '0.00';
                const isUp = parseFloat(pct) >= 0;
                return `<div class="flex items-center justify-between border-b border-border-dark/30 py-2.5 last:border-0"><span class="text-slate-400 text-xs font-medium">${label}</span><div class="flex items-center gap-4 w-1/2 justify-end"><span class="text-white text-sm font-bold">${formatFinNumber(curr)}</span><span class="${isUp ? 'text-success' : 'text-danger'} text-[10px] font-bold">${isUp ? '↑' : '↓'}${Math.abs(pct)}%</span></div></div>`;
            };

            if (currentFinTab === 'income') {
                datasets = [{ label: 'Revenue', data: finDataCache.income.map(d=>d.revenue), backgroundColor: '#34a8eb' }, { label: 'Net Income', data: finDataCache.income.map(d=>d.netIncome), backgroundColor: '#eab308' }];
                const c = finDataCache.income[latest], p = finDataCache.income[prev];
                listEl.innerHTML = createRow('Revenue', c.revenue, p.revenue) + createRow('Net Income', c.netIncome, p.netIncome) + createRow('EBITDA', c.ebitda, p.ebitda);
            } else if (currentFinTab === 'balance') {
                datasets = [{ label: 'Assets', data: finDataCache.balance.map(d=>d.assets), backgroundColor: '#34a8eb' }, { label: 'Liabilities', data: finDataCache.balance.map(d=>d.liabilities), backgroundColor: '#eab308' }];
                const c = finDataCache.balance[latest], p = finDataCache.balance[prev];
                listEl.innerHTML = createRow('Total Assets', c.assets, p.assets) + createRow('Total Liabilities', c.liabilities, p.liabilities) + createRow('Total Equity', c.equity, p.equity);
            } else if (currentFinTab === 'cashflow') {
                datasets = [{ label: 'Net Change', data: finDataCache.cashflow.map(d=>d.change), backgroundColor: '#34a8eb' }];
                const c = finDataCache.cashflow[latest], p = finDataCache.cashflow[prev];
                listEl.innerHTML = createRow('Net Income', c.netIncome, p.netIncome) + createRow('Cash from Operations', c.ops, p.ops) + createRow('Cash from Investing', c.inv, p.inv) + createRow('Cash from Financing', c.fin, p.fin) + createRow('Net Change in Cash', c.change, p.change);
            }

            if (!window.Chart) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
                script.onload = () => renderFinancials();
                document.head.appendChild(script);
                return;
            }

            if (finChartInstance) finChartInstance.destroy();
            finChartInstance = new Chart(ctx, { type: 'bar', data: { labels: finDataCache.years, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } }, y: { position: 'right', grid: { color: '#232b3e' }, ticks: { color: '#94a3b8', font: { size: 10 }, callback: v => formatFinNumber(v) } } } } });
        };
        
        const fetchFinancialData = async () => {
            if (isCrypto || isForex) { document.getElementById('fin-data-list').innerHTML = `<p class="text-center text-slate-500 text-xs py-4">Only available for stocks.</p>`; return; }
            const cacheKey = `koda_fin_data_${symbol}`, cached = localStorage.getItem(cacheKey), now = Date.now();
            if (cached) { const p = JSON.parse(cached); if (now - p.timestamp < 30 * 86400000) { finDataCache = p.data; renderFinancials(); return; } }

            document.getElementById('fin-data-list').innerHTML = `<div class="flex justify-center py-6"><div class="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>`;

            try {
                let avSym = symbol.endsWith('.BK') ? symbol.replace('.BK', '.BKK') : symbol;
                const d = ms => new Promise(r => setTimeout(r, ms));
                const fetchAV = f => fetch(`https://www.alphavantage.co/query?function=${f}&symbol=${avSym}&apikey=${AV_API_KEY}`).then(r=>r.json());

                const incRaw = await fetchAV('INCOME_STATEMENT'); await d(1200);
                const balRaw = await fetchAV('BALANCE_SHEET'); await d(1200);
                const cashRaw = await fetchAV('CASH_FLOW');

                if (!incRaw.annualReports) throw new Error(incRaw.Note || "API Limit");
                const inc = incRaw.annualReports.slice(0, 4).reverse(), bal = balRaw.annualReports.slice(0, 4).reverse(), cash = cashRaw.annualReports.slice(0, 4).reverse();
                const p = v => parseFloat(v) || 0;
                finDataCache = {
                    years: inc.map(i => i.fiscalDateEnding.split('-')[0]),
                    income: inc.map(i => ({ revenue: p(i.totalRevenue), opEx: p(i.operatingExpenses), netIncome: p(i.netIncome), ebitda: p(i.ebitda || i.operatingIncome) })),
                    balance: bal.map(b => ({ assets: p(b.totalAssets), liabilities: p(b.totalLiabilities), cash: p(b.cashAndCashEquivalentsAtCarryingValue), equity: p(b.totalShareholderEquity) })),
                    cashflow: cash.map(c => ({ netIncome: p(c.netIncome), ops: p(c.operatingCashflow), inv: p(c.cashflowFromInvestment), fin: p(c.cashflowFromFinancing), change: p(c.changeInCashAndCashEquivalents) }))
                };
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: finDataCache }));
                renderFinancials();
            } catch (e) { document.getElementById('fin-data-list').innerHTML = `<div class="flex flex-col items-center justify-center py-6"><span class="material-symbols-outlined text-3xl text-danger mb-2">error</span><p class="text-center text-slate-400 text-xs font-bold px-4">API Limit Error</p></div>`; }
        };

        const finMenu = document.getElementById('fin-dropdown-menu'), finIcon = document.getElementById('fin-dropdown-icon');
        document.getElementById('fin-dropdown-btn').addEventListener('click', e => { e.stopPropagation(); finMenu.classList.toggle('hidden'); finIcon.classList.toggle('rotate-180'); });
        document.querySelectorAll('.fin-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentFinTab = btn.getAttribute('data-tab');
                document.getElementById('fin-current-tab').textContent = btn.textContent;
                finMenu.classList.add('hidden'); finIcon.classList.remove('rotate-180');
                renderFinancials();
            });
        });
        fetchFinancialData();
    };
    initFinancials();
});
