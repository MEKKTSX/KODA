document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 📌 1. Keys & Config
    // ==========================================
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
    let currentStockName = symbol;

    document.getElementById('detail-symbol').textContent = symbol.toUpperCase();

    const isCrypto = symbol.includes('BINANCE:') || symbol.includes('COINBASE:');
    const isThaiStock = symbol.includes('.BK');

    // Global สำหรับ TA Chart
    let currentTAMode = 'short';
    let currentTATF = 'daily';
    let taChartInstance = null;
    let taSeries = null;
    let taVolumeSeries = null;

    // ==========================================
    // 📌 2. SWR Caching
    // ==========================================
    async function fetchWithSWR(endpoint, cacheKey, renderCallback, forceRefresh = false) {
        const cached = localStorage.getItem(cacheKey);
        if (cached && !forceRefresh) {
            try { renderCallback(JSON.parse(cached)); } catch(e){}
        }

        try {
            const res = await fetch(endpoint, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                localStorage.setItem(cacheKey, JSON.stringify(data));
                renderCallback(data);
            }
        } catch (error) {
            console.error(`SWR failed: ${endpoint}`, error);
        }
    }

    // ==========================================
    // 📌 3. TABS
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
                c.classList.toggle('hidden', c.id !== targetId);
                c.classList.toggle('block', c.id === targetId);
            });

            if (targetId === 'tab-company' && !loadedTabs.company) {
                fetchCompanySummary();
                loadedTabs.company = true;
            }
            if (targetId === 'tab-analysis' && !loadedTabs.analysis) {
                fetchAnalysisData();
                loadedTabs.analysis = true;
            }
            if (targetId === 'tab-quarterly' && !loadedTabs.quarterly) {
                fetchQuarterlyEarnings();
                loadedTabs.quarterly = true;
            }
            if (targetId === 'tab-financials' && !loadedTabs.financials) {
                fetchFinancialData();
                loadedTabs.financials = true;
            }
            if (targetId === 'tab-news' && !loadedTabs.news) {
                fetchLatestNews();
                loadedTabs.news = true;
            }
        });
    });

    // ==========================================
    // 📌 4. Watchlist Star
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
    // 📌 5. Render Price UI
    // ==========================================
    function renderPriceUI(data) {
        const priceEl = document.getElementById('detail-price');
        const changeEl = document.getElementById('detail-change');
        const extContainer = document.getElementById('extended-price-container');
        const extLabelEl = document.getElementById('extended-label');
        const extPriceEl = document.getElementById('extended-price');
        const extChangeEl = document.getElementById('extended-change');
        const dotEl = document.getElementById('market-status-dot');

        let currentPrice = data.regularMarketPrice || data.preMarketPrice || data.postMarketPrice || data.c || 0;
        let change = data.regularMarketChange !== undefined ? data.regularMarketChange : (data.d || 0);
        let percentChange = data.regularMarketChangePercent !== undefined ? data.regularMarketChangePercent : (data.dp || 0);
        let currencyCode = data.currency || (symbol.includes('.HK') ? 'HKD' : (symbol.includes('.SS') ? 'CNY' : 'USD'));
        let isPositive = change >= 0;

        let extPrice = null, extChange = null, extPercent = null, stateText = '';
        const marketState = data.marketState || 'REGULAR';

        if (marketState === 'PRE') {
            extPrice = data.preMarketPrice || data.regularMarketPreviousClose;
            extChange = data.preMarketChange || 0;
            extPercent = data.preMarketChangePercent || 0;
            stateText = '☀️ ก่อนตลาดเปิด';
        } else if (marketState === 'POST' || marketState === 'CLOSED') {
            extPrice = data.postMarketPrice || currentPrice;
            extChange = data.postMarketChange || 0;
            extPercent = data.postMarketChangePercent || 0;
            stateText = '🌑 หลังตลาดปิด';
        }
        
        if (marketState === 'REGULAR') {
            if(dotEl) { dotEl.classList.remove('hidden', 'bg-slate-600'); dotEl.classList.add('bg-success'); }
        } else {
            if(dotEl) { dotEl.classList.remove('hidden', 'bg-success'); dotEl.classList.add('bg-slate-600'); }
        }

        const fmtPrice = (num) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        if (priceEl && priceEl.dataset.rawPrice && parseFloat(priceEl.dataset.rawPrice) !== currentPrice) {
            priceEl.classList.remove('price-update');
            void priceEl.offsetWidth; 
            priceEl.classList.add('price-update');
        }
        
        if(priceEl) {
            priceEl.dataset.rawPrice = currentPrice;
            priceEl.textContent = fmtPrice(currentPrice);
        }
        if(document.getElementById('detail-currency')) document.getElementById('detail-currency').textContent = currencyCode;
        
        if(changeEl) {
            changeEl.className = `text-sm font-bold flex items-center gap-1 mt-1 ${isPositive ? 'text-success' : 'text-danger'}`;
            changeEl.innerHTML = `<span class="material-symbols-outlined text-[16px]">${isPositive ? 'arrow_upward' : 'arrow_downward'}</span> ${Math.abs(change).toFixed(2)} (${Math.abs(percentChange).toFixed(2)}%)`;
        }

        if (extContainer && extPrice !== null && extPrice !== undefined) {
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
            
            if(document.getElementById('extended-currency')) document.getElementById('extended-currency').textContent = currencyCode;
            
            if (extPercent === 0 || !extPercent) {
                if(extChangeEl) extChangeEl.textContent = `(0.00%)`;
                if(extChangeEl) extChangeEl.className = `font-bold text-[11px] mt-0.5 text-slate-500`;
            } else {
                const isExtPos = extPercent > 0;
                const sign = isExtPos ? '+' : ''; 
                if(extChangeEl) extChangeEl.textContent = `${sign}${extPercent.toFixed(2)}%`;
                if(extChangeEl) extChangeEl.className = `font-bold text-[11px] mt-0.5 ml-1 ${isExtPos ? 'text-success' : 'text-danger'}`;
            }
        } else if (extContainer) {
            extContainer.classList.remove('flex');
            extContainer.classList.add('hidden');
        }
    }

    // ==========================================
    // 📌 6. Fetch Candle Data
    // ==========================================
    const fetchCandleData = async (tfRange) => {
        const rangeMap = { '1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', '2Y': '2y', '5Y': '5y' }; 
        const intervalMap = { '1M': '1d', '3M': '1d', '6M': '1d', '1Y': '1d', '2Y': '1d', '5Y': '1wk' };
        const daysMap = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730, '5Y': 1825 };
        const fhResMap = { '1M': 'D', '3M': 'D', '6M': 'D', '1Y': 'D', '2Y': 'D', '5Y': 'W' };

        let cleanSym = symbol.split(':')[1] || symbol.split('.')[0];
        
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

        const yfRange = rangeMap[tfRange] || '1y';
        const yfInterval = intervalMap[tfRange] || '1d';
        let yfSym = symbol;
        if (symbol === 'XAUUSD') yfSym = 'GC=F';
        else if (symbol.includes('.HK')) yfSym = symbol.split('.')[0].padStart(4, '0') + '.HK';

        const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSym}?range=${yfRange}&interval=${yfInterval}`;
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
        ];

        for (let proxy of proxies) {
            try {
                const res = await fetch(proxy);
                if (!res.ok) continue;
                const raw = await res.json();
                let yfData = raw;
                if (raw.contents) yfData = JSON.parse(raw.contents);
                
                if (yfData?.chart?.result?.[0]) {
                    const q = yfData.chart.result[0].indicators.quote[0];
                    return { 
                        timestamps: yfData.chart.result[0].timestamp, 
                        opens: q.open, highs: q.high, lows: q.low, closes: q.close, volumes: q.volume 
                    };
                }
            } catch (err) {}
        }
        return null;
    };

    function loadLightweightCharts() {
        return new Promise(resolve => {
            if (window.LightweightCharts) return resolve();
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // ==========================================
    // 📌 7. KODA Realtime Chart + WebSocket
    // ==========================================
    let chartInstance = null;
    let candleSeries = null;
    let activePriceLines = [];
    let chartWebSocket = null;

    async function initKodaChart() {
        const container = document.getElementById('koda-chart-container');
        if (chartInstance) return;

        await loadLightweightCharts();

        chartInstance = window.LightweightCharts.createChart(container, {
            width: container.clientWidth,
            height: 380,
            layout: { background: { type: 'solid', color: '#0a0e17' }, textColor: '#848e9c' },
            grid: { vertLines: { color: 'rgba(42,46,57,0.2)' }, horzLines: { color: 'rgba(42,46,57,0.2)' } },
            rightPriceScale: { borderColor: 'rgba(42,46,57,0.8)' },
            timeScale: { borderColor: 'rgba(42,46,57,0.8)', timeVisible: true }
        });

        candleSeries = chartInstance.addCandlestickSeries({
            upColor: '#00c076', downColor: '#ff4d4d',
            borderUpColor: '#00c076', borderDownColor: '#ff4d4d',
            wickUpColor: '#00c076', wickDownColor: '#ff4d4d'
        });

        // โหลดข้อมูลประวัติศาสตร์ 1Y ครั้งแรก
        const initialDataRaw = await fetchCandleData('1Y');
        if (initialDataRaw) {
            const candles = initialDataRaw.timestamps.map((t, i) => ({ 
                time: t, open: Number(initialDataRaw.opens[i]), high: Number(initialDataRaw.highs[i]), 
                low: Number(initialDataRaw.lows[i]), close: Number(initialDataRaw.closes[i]) 
            })).filter(c => isFinite(c.close)).sort((a, b) => a.time - b.time);
            
            candleSeries.setData(candles);
            chartInstance.timeScale().fitContent();
        }

        // TradingView Button Logic
        const tvContainer = document.getElementById('tv-chart-container');
        const btnTV = document.getElementById('btn-chart-tv');
        const btnKoda = document.getElementById('btn-chart-koda');

        const initTV = () => {
            let tvSym = symbol;
            if (symbol === 'XAUUSD') tvSym = 'OANDA:XAUUSD';
            else if (symbol.includes(':')) tvSym = symbol;
            new TradingView.widget({
                "autosize": true, "symbol": tvSym, "interval": "D",
                "timezone": "Etc/UTC", "theme": "dark", "style": "1", "locale": "en",
                "enable_publishing": false, "backgroundColor": "#0a0e17",
                "gridColor": "rgba(42, 46, 57, 0.5)", "hide_top_toolbar": false,
                "hide_legend": false, "save_image": false, "container_id": "tv-chart-container",
                "allow_symbol_change": false, "withdateranges": true,
                "studies": ["Volume@tv-basicstudies"]
            });
        };

        if (window.TradingView) initTV();
        else {
            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/tv.js';
            script.onload = initTV;
            document.head.appendChild(script);
        }

        btnKoda.addEventListener('click', () => {
            btnKoda.className = "px-3 py-1.5 rounded-md bg-primary/20 text-primary transition-colors";
            btnTV.className = "px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-300 transition-colors";
            tvContainer.style.display = 'none';
            container.style.display = 'block';
        });

        btnTV.addEventListener('click', () => {
            btnTV.className = "px-3 py-1.5 rounded-md bg-primary/20 text-primary transition-colors";
            btnKoda.className = "px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-300 transition-colors";
            tvContainer.style.display = 'block';
            container.style.display = 'none';
        });

        connectWebSocket();
    }

    function connectWebSocket() {
        if (chartWebSocket) chartWebSocket.close();
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        chartWebSocket = new WebSocket(`${protocol}//${window.location.host}/ws/chart/${symbol}`);

        chartWebSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'chart_update') {
                renderPriceUI(data.price);

                if (data.sr_levels && candleSeries) {
                    activePriceLines.forEach(line => candleSeries.removePriceLine(line));
                    activePriceLines = [];

                    data.sr_levels.forEach(lvl => {
                        const line = candleSeries.createPriceLine({
                            price: lvl.price,
                            color: lvl.type === 'sup' ? 'rgba(0,192,118,0.85)' : 'rgba(255,77,77,0.85)',
                            lineWidth: lvl.strength === 3 ? 2 : 1,
                            lineStyle: lvl.strength === 3 ? 0 : 2,
                            axisLabelVisible: true
                        });
                        activePriceLines.push(line);
                    });
                }
            }
        };

        chartWebSocket.onclose = () => setTimeout(connectWebSocket, 3000);
    }

    // ==========================================
    // 📌 8. Company Summary (POST)
    // ==========================================
    async function fetchCompanySummary(force = false) {
        const cacheKey = `koda_company_${symbol}`;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached && !force) {
            renderCompanySummary(JSON.parse(cached));
            return;
        }

        document.getElementById('ai-company-content').innerHTML = `<div class="flex flex-col items-center justify-center py-6"><div class="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3"></div><p class="text-primary font-bold text-xs animate-pulse">AI กำลังวิเคราะห์ปัจจัยพื้นฐาน...</p></div>`;

        try {
            const res = await fetch('/api/company-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: symbol, companyName: currentStockName })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem(cacheKey, JSON.stringify(data));
                renderCompanySummary(data);
            }
        } catch (e) {
            console.error(e);
        }
    }

    function renderCompanySummary(data) {
        if (data && data.html) {
            document.getElementById('ai-company-content').innerHTML = data.html;
            const dateEl = document.getElementById('ai-summary-date');
            if(dateEl) dateEl.textContent = `Last updated: ${new Date().toLocaleDateString('th-TH')}`;
        }
    }

    // ==========================================
    // 📌 9. Analysis (Analyst, Target, TA)
    // ==========================================
    async function fetchAnalysisData() {
        const cacheKey = `koda_analysis_${symbol}`;
        const cached = localStorage.getItem(cacheKey);
        const now = Date.now();
        
        document.getElementById('analysis-loading').classList.remove('hidden');
        document.getElementById('analysis-content').classList.add('hidden');

        if (cached) {
            const parsed = JSON.parse(cached);
            if (now - parsed.timestamp < 3600000) {
                renderAnalysis(parsed.data);
                return;
            }
        }

        try {
            const cleanSym = symbol.split(':')[1] || symbol.split('.')[0];
            const res = await fetch(`/api/price?symbol=${encodeURIComponent(cleanSym)}&mode=analysis`);
            const data = await res.json();
            
            if (data.success) {
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: data }));
                renderAnalysis(data);
            } else {
                throw new Error();
            }
        } catch(e) {
            document.getElementById('analysis-loading').textContent = 'ไม่พบข้อมูลบทวิเคราะห์ของหุ้นตัวนี้';
            document.getElementById('analysis-loading').classList.add('text-danger');
            document.getElementById('analysis-loading').classList.remove('animate-pulse');
        }
    }

    async function renderAnalysis(data) {
        // --- 1. Analyst Ratings ---
        const rec = data.recommendation;
        const total = rec ? (rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell) : 0;
        const container = document.getElementById('analyst-bars');
        const badge = document.getElementById('analyst-consensus-badge');
        document.getElementById('analyst-subtitle').textContent = `อิงตามนักวิเคราะห์ ${total || '--'} คน`;

        if (total === 0) {
            badge.textContent = "N/A";
            container.innerHTML = `<p class="text-slate-500 text-xs">ไม่มีข้อมูลนักวิเคราะห์</p>`;
        } else {
            const mapTH = { 'strongBuy': 'ซื้อทันที', 'buy': 'ซื้อ', 'hold': 'ถือ', 'sell': 'ต่ำกว่าค่าเฉลี่ย', 'strongSell': 'ขาย' };
            const colors = { 'strongBuy': '#00c076', 'buy': '#22c55e', 'hold': '#eab308', 'sell': '#64748b', 'strongSell': '#ff4d4d' };
            
            let consensusText = "N/A";
            if (rec.consensus === 'strong_buy') consensusText = "ซื้อทันที";
            else if (rec.consensus === 'buy') consensusText = "ซื้อ";
            else if (rec.consensus === 'hold') consensusText = "ถือ";
            else if (rec.consensus === 'underperform') consensusText = "ต่ำกว่าค่าเฉลี่ย";
            else if (rec.consensus === 'sell') consensusText = "ขาย";

            badge.textContent = consensusText;

            container.innerHTML = ['strongBuy', 'buy', 'hold', 'sell', 'strongSell'].map(key => {
                const pct = Math.round((rec[key] / total) * 100);
                return `
                <div class="flex items-center gap-3">
                    <span class="text-slate-300 text-xs w-20 text-right">${mapTH[key]}</span>
                    <div class="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div class="h-full rounded-full" style="width: ${pct}%; background-color: ${colors[key]}"></div>
                    </div>
                    <span class="text-slate-400 text-xs w-8 text-right">${pct}%</span>
                </div>`;
            }).join('');
        }

        // --- 2. Target Price Chart ---
        const targets = data.targets;
        const fmt = (num) => num ? num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
        const cur = targets.current; const high = targets.high; const low = targets.low; const mean = targets.mean;

        if (cur && high && low && mean) {
            const highPct = ((high - cur) / cur) * 100;
            const meanPct = ((mean - cur) / cur) * 100;
            const lowPct = ((low - cur) / cur) * 100;

            document.getElementById('target-subtitle').textContent = `สำหรับการคาดการณ์ราคาในหนึ่งปี ค่าเฉลี่ยราคาเป้าหมายอยู่ที่ ${fmt(mean)} โดยมีค่าสูงสุดที่ ${fmt(high)} และค่าต่ำสุดที่ ${fmt(low)}`;

            const hist = await fetchCandleData('1Y');
            let chartPoints = hist && hist.closes && hist.closes.length > 0 ? hist.closes.filter(c => c !== null) : [cur*0.8, cur*0.9, cur]; 
            const paddingLen = Math.floor(chartPoints.length * 0.25); 
            const labels = new Array(chartPoints.length + paddingLen).fill('');
            
            const histData = [...chartPoints, ...new Array(paddingLen).fill(null)];
            const highLine = new Array(chartPoints.length + paddingLen).fill(null);
            const meanLine = new Array(chartPoints.length + paddingLen).fill(null);
            const lowLine = new Array(chartPoints.length + paddingLen).fill(null);
            const curLine = new Array(chartPoints.length + paddingLen).fill(null);
            
            for(let i = chartPoints.length - 1; i < labels.length; i++) {
                highLine[i] = high; meanLine[i] = mean; lowLine[i] = low; curLine[i] = cur;
            }

            const ctx = document.getElementById('target-line-chart');
            if (window.targetLineChartInstance) window.targetLineChartInstance.destroy();
            
            const yMin = Math.min(...chartPoints, low) * 0.95;
            const yMax = Math.max(...chartPoints, high) * 1.05;

            window.targetLineChartInstance = new Chart(ctx, {
                type: 'line',
                data: { 
                    labels: labels, 
                    datasets: [
                        { data: histData, borderColor: '#34a8eb', borderWidth: 2, tension: 0.1, pointRadius: 0 },
                        { data: highLine, borderColor: '#00c076', borderWidth: 2, borderDash: [5, 5], pointRadius: 0 },
                        { data: meanLine, borderColor: '#26a69a', borderWidth: 2, borderDash: [5, 5], pointRadius: 0 },
                        { data: lowLine, borderColor: '#ff4d4d', borderWidth: 2, borderDash: [5, 5], pointRadius: 0 },
                        { data: curLine, borderColor: '#34a8eb', borderWidth: 1, borderDash: [2, 4], pointRadius: 0 }
                    ] 
                },
                options: { 
                    responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
                    scales: { x: { display: false }, y: { display: false, min: yMin, max: yMax } },
                    layout: { padding: { top: 15, bottom: 15, right: 120 } }, animation: { duration: 0 } 
                }
            });

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
        }

        // --- 3. TA Chart Binding ---
        document.querySelectorAll('.ta-mode-btn').forEach(btn => {
            btn.onclick = (e) => {
                document.querySelectorAll('.ta-mode-btn').forEach(b => { b.className = 'ta-mode-btn flex-1 text-slate-400 hover:text-white text-xs font-bold py-2 rounded-md flex items-center justify-center gap-1 transition-all'; });
                e.currentTarget.className = 'ta-mode-btn flex-1 bg-[#00c076] text-white text-xs font-bold py-2 rounded-md flex items-center justify-center gap-1 transition-all';
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

        await renderTAChart();

        document.getElementById('analysis-loading').classList.add('hidden');
        document.getElementById('analysis-content').classList.remove('hidden');
    }

    async function renderTAChart() {
        const container = document.getElementById('ta-chart-container');
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-full gap-2"><div class="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>`;
        try {
            await loadLightweightCharts();
            let rangeToFetch = currentTATF === 'daily' ? '2Y' : '5Y';
            const candleResult = await fetchCandleData(rangeToFetch);
            if (!candleResult) throw new Error("No data");

            const { timestamps, opens, highs, lows, closes, volumes } = candleResult;
            let chartData = timestamps.map((t, i) => ({ time: t, open: Number(opens[i]), high: Number(highs[i]), low: Number(lows[i]), close: Number(closes[i]), value: Number(volumes[i] || 0) })).filter(c => isFinite(c.close)).sort((a, b) => a.time - b.time);

            container.innerHTML = '';
            if (taChartInstance) taChartInstance.remove();
            
            taChartInstance = window.LightweightCharts.createChart(container, {
                width: container.clientWidth, height: 220,
                layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#848e9c', fontSize: 10 },
                grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(42, 46, 57, 0.4)' } },
                rightPriceScale: { borderColor: 'rgba(42, 46, 57, 0)' }, timeScale: { borderColor: 'rgba(42, 46, 57, 0)', timeVisible: false }
            });
            
            taSeries = taChartInstance.addCandlestickSeries({ upColor: '#00c076', downColor: '#ff4d4d', borderUpColor: '#00c076', borderDownColor: '#ff4d4d', wickUpColor: '#00c076', wickDownColor: '#ff4d4d' });
            taSeries.setData(chartData);

            taVolumeSeries = taChartInstance.addHistogramSeries({ color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '', scaleMargins: { top: 0.8, bottom: 0 } });
            taVolumeSeries.setData(chartData.map(d => ({ time: d.time, value: d.value, color: d.close >= d.open ? 'rgba(0, 192, 118, 0.5)' : 'rgba(255, 77, 77, 0.5)' })));

            let bullCount = 0, bearCount = 0; const markers = []; const sma20 = [];
            chartData.forEach((d, i) => {
                if (i >= 20) {
                    const slice = chartData.slice(i-20, i); const avg = slice.reduce((a,b)=>a+b.close,0)/20; sma20.push({time: d.time, value: avg});
                    if (i > 25 && i % Math.max(5, Math.floor(chartData.length/40)) === 0) { 
                        if (d.close > avg) { markers.push({ time: d.time, position: 'belowBar', color: '#00c076', shape: 'circle', text: 'B' }); bullCount++; } 
                        else { markers.push({ time: d.time, position: 'aboveBar', color: '#ff4d4d', shape: 'circle', text: 'S' }); bearCount++; }
                    }
                }
            });
            if (markers.length > 0) taSeries.setMarkers(markers);
            
            const titleEl = document.getElementById('ta-signal-title');
            if (bullCount > bearCount + 2) { titleEl.textContent = 'หลักฐานสัญญาณขาขึ้นที่แข็งแกร่งมาก'; titleEl.className = 'text-[#00c076] text-base font-bold mb-1'; } 
            else if (bullCount > bearCount) { titleEl.textContent = 'หลักฐานสัญญาณขาขึ้น'; titleEl.className = 'text-[#00c076] text-base font-bold mb-1'; } 
            else if (bearCount > bullCount) { titleEl.textContent = 'หลักฐานสัญญาณขาลง'; titleEl.className = 'text-[#ff4d4d] text-base font-bold mb-1'; } 
            else { titleEl.textContent = 'สัญญาณผสม (ไม่มีเทรนด์ชัดเจน)'; titleEl.className = 'text-yellow-500 text-base font-bold mb-1'; }

            document.getElementById('ta-bull-badge').innerHTML = `<span class="material-symbols-outlined text-[12px]">call_made</span> ${bullCount} ขาขึ้น`;
            document.getElementById('ta-bear-badge').innerHTML = `<span class="material-symbols-outlined text-[12px]">call_received</span> ${bearCount} ขาลง`;

            if (currentTAMode === 'short') { const lookback = currentTATF === 'daily' ? 60 : 12; const from = chartData[Math.max(0, chartData.length - lookback)].time; taChartInstance.timeScale().setVisibleRange({ from: from, to: chartData[chartData.length-1].time }); } 
            else if (currentTAMode === 'medium') { const lookback = currentTATF === 'daily' ? 120 : 24; const from = chartData[Math.max(0, chartData.length - lookback)].time; taChartInstance.timeScale().setVisibleRange({ from: from, to: chartData[chartData.length-1].time }); } 
            else { taChartInstance.timeScale().fitContent(); }
        } catch (e) { container.innerHTML = `<p class="text-danger text-xs text-center mt-10">ไม่สามารถโหลดข้อมูลเทคนิคได้ (เซิร์ฟเวอร์ปฏิเสธ)</p>`; }
    }

    // ==========================================
    // 📌 10. สรุปไตรมาส (Quarterly - 3 Fallbacks)
    // ==========================================
    async function fetchQuarterlyEarnings() {
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

            // ก๊อกที่ 1: Python Backend (Yahoo)
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

            // ก๊อกที่ 2: AlphaVantage
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

            // ก๊อกที่ 3: Finnhub 
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
                    <div class="col-span-3"><p class="text-white font-bold">${q.quarter}</p></div>
                    <div class="col-span-3 text-right text-slate-400 font-medium">${q.estimate !== null && q.estimate !== undefined ? q.estimate.toFixed(2) : '-'}</div>
                    <div class="col-span-3 text-right ${actColor} font-bold">${q.actual !== null && q.actual !== undefined ? q.actual.toFixed(2) : '-'}</div>
                    <div class="col-span-3 text-right"><span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${isSurprise ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}">${isSurprise ? '+' : ''}${q.surprise !== null && q.surprise !== undefined ? q.surprise.toFixed(2) : '0.00'}%</span></div>
                </div>`;
            }).join('');

            container.innerHTML = html;
            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, html: html, nextDateText: nextDateText }));

        } catch(e) {
            container.innerHTML = `<p class="text-center text-danger text-xs py-8">ไม่มีประวัติผลประกอบการ หรือ API ขัดข้อง</p>`;
        }
    }

    // ==========================================
    // 📌 11. ข้อมูลการเงิน (Financials)
    // ==========================================
    let finDataCache = [];
    let currentFinMetric = 'totalRevenue';
    let finChartInstance = null;
    const metricColors = { totalRevenue: '#34a8eb', grossProfit: '#a855f7', operatingIncome: '#eab308', netIncome: '#00c076' };

    // Event listener ต้องครอบอยู่เพื่อรอคลิก
    document.querySelectorAll('.fin-metric-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.fin-metric-btn').forEach(b => {
                b.classList.remove('active', 'bg-slate-700', 'text-white', 'shadow-md');
                b.classList.add('bg-transparent', 'text-slate-400', 'hover:text-slate-200');
            });
            btn.classList.add('active', 'bg-slate-700', 'text-white', 'shadow-md');
            btn.classList.remove('bg-transparent', 'text-slate-400', 'hover:text-slate-200');
            currentFinMetric = btn.getAttribute('data-metric');
            if(finDataCache.length > 0) renderFinChartAndLegend();
        });
    });

    async function fetchFinancialData() {
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
    }

    function renderFinChartAndLegend() {
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
            if (prevVal && prevVal !== 0) pctChanges.push(((currentVal - prevVal) / Math.abs(prevVal)) * 100);
            else pctChanges.push(0);
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

        let legendHtml = `<div class="flex flex-col gap-1.5 justify-end items-end pr-2 border-r border-border-dark py-1"><span class="size-2 rounded-full" style="background-color: ${metricColors[currentFinMetric]}"></span><span class="size-2 rounded-full bg-fuchsia-500"></span></div>`;

        chartData.forEach((q, idx) => {
            const pct = pctChanges[idx]; const pctColor = pct >= 0 ? 'text-success' : 'text-danger';
            legendHtml += `
            <div class="flex flex-col gap-1 items-center justify-end py-1">
                <span class="text-[9px] text-slate-400 font-bold">${q.quarter}</span>
                <span class="text-[10px] text-white font-bold">$${formatB(q[currentFinMetric])}</span>
                <span class="text-[10px] font-bold ${pctColor}">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</span>
            </div>`;
        });
        legendContainer.innerHTML = legendHtml;
    }

    // ==========================================
    // 📌 12. ข่าวล่าสุด (News & AI Summarizer)
    // ==========================================
    async function fetchLatestNews() {
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
    }

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

    // ==========================================
    // 📌 Initialize
    // ==========================================
    initKodaChart();           
    fetchWithSWR(`/api/price?symbol=${symbol}`, `koda_price_${symbol}`, renderPriceUI);

    window.addEventListener('beforeunload', () => {
        if (chartWebSocket) chartWebSocket.close();
    });

    console.log('%c✅ KODA stock-detail.js loaded with FastAPI + Realtime WebSocket', 'color:#34a8eb; font-weight:bold');
});
