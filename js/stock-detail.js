document.addEventListener('DOMContentLoaded', () => {
    
    const FINNHUB_API_KEY = window.ENV_KEYS.FINNHUB;
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
            
            // กรองขยะซ้ำทิ้งไปก่อน
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
    // 📌 2. ระบบสร้างกราฟ (ปลดล็อก TradingView Advanced Chart)
    // ==========================================
    const renderChart = () => {
        const containerId = 'tv-widget-container';
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        container.innerHTML = `<div class="w-full h-full relative p-4"><canvas id="detail-sr-chart"></canvas></div>`;

        const renderTradingViewFallback = () => {
            container.innerHTML = '';
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = () => {
                let tvSym = symbol;
                if (symbol === 'XAUUSD') tvSym = 'OANDA:XAUUSD';
                else if (symbol.includes(':')) tvSym = symbol;

                new TradingView.widget({
                    "autosize": true,
                    "symbol": tvSym,
                    "interval": "D",
                    "timezone": "Etc/UTC",
                    "theme": "dark",
                    "style": "1",
                    "locale": "en",
                    "enable_publishing": false,
                    "backgroundColor": "#0a0e17",
                    "gridColor": "#161c2b",
                    "hide_top_toolbar": false,
                    "hide_legend": false,
                    "save_image": false,
                    "container_id": containerId,
                    "allow_symbol_change": false,
                    "withdateranges": true,
                    "studies": [
                        "Volume@tv-basicstudies"
                    ]
                });
            };
            container.appendChild(script);
        };

        // หมายเหตุ: ใช้ Advanced SR กับทุกตลาดก่อน เพื่อให้เห็นแนวรับ/แนวต้านจริงบนกราฟ
        // หากโหลดข้อมูลไม่สำเร็จสำหรับ non-Thai ให้ fallback ไป TradingView เพื่อคงความเสถียร

        let srChartInstance = null;

        const loadScript = (src) => new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });

        const loadChartJs = async () => {
            if (!window.Chart) await loadScript('https://cdn.jsdelivr.net/npm/chart.js');
            if (!window.Hammer) await loadScript('https://cdn.jsdelivr.net/npm/hammerjs');
            if (!window.ChartZoom) await loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.2.0/dist/chartjs-plugin-zoom.min.js');
            if (window.Chart && window.ChartZoom && !window.__kodaZoomRegistered) {
                Chart.register(window.ChartZoom);
                window.__kodaZoomRegistered = true;
            }
        };

        const detectSwingPoints = (highs, lows, left = 4, right = 4) => {
            const swings = [];
            for (let i = left; i < highs.length - right; i++) {
                const h = highs[i];
                const l = lows[i];
                if (h === null || l === null || Number.isNaN(h) || Number.isNaN(l)) continue;

                let isSwingHigh = true;
                let isSwingLow = true;
                for (let j = 1; j <= left; j++) {
                    if (highs[i - j] !== null && highs[i - j] >= h) isSwingHigh = false;
                    if (lows[i - j] !== null && lows[i - j] <= l) isSwingLow = false;
                }
                for (let j = 1; j <= right; j++) {
                    if (highs[i + j] !== null && highs[i + j] > h) isSwingHigh = false;
                    if (lows[i + j] !== null && lows[i + j] < l) isSwingLow = false;
                }

                if (isSwingHigh) swings.push({ idx: i, price: h, type: 'resistance', method: 'swing-high' });
                if (isSwingLow) swings.push({ idx: i, price: l, type: 'support', method: 'swing-low' });
            }
            return swings;
        };

        const scoreLevel = (point, highs, lows, closes, currentPrice) => {
            const i = point.idx;
            const isSupport = point.type === 'support';
            const price = point.price;

            const left = Math.max(0, i - 6);
            const right = Math.min(closes.length - 1, i + 6);
            let touchCount = 0;
            let rejectionPower = 0;
            const touchBand = Math.max(currentPrice * 0.003, price * 0.003);

            for (let k = left; k <= right; k++) {
                const hk = highs[k];
                const lk = lows[k];
                if (hk === null || lk === null || Number.isNaN(hk) || Number.isNaN(lk)) continue;
                if (Math.abs(hk - price) <= touchBand || Math.abs(lk - price) <= touchBand) touchCount++;
            }

            const prevClose = closes[i - 1] ?? closes[i];
            const nextClose = closes[i + 1] ?? closes[i];
            if (isSupport) {
                rejectionPower = Math.max(0, (nextClose - price) / Math.max(price, 1));
                if (prevClose < price) rejectionPower += 0.2;
            } else {
                rejectionPower = Math.max(0, (price - nextClose) / Math.max(price, 1));
                if (prevClose > price) rejectionPower += 0.2;
            }

            const recency = (i + 1) / closes.length;
            const proximity = 1 - Math.min(Math.abs(price - currentPrice) / Math.max(currentPrice, 1), 1);
            const strength = (touchCount * 1.2) + (rejectionPower * 120) + (recency * 2.5) + (proximity * 1.5);

            return {
                price,
                type: point.type,
                strength,
                method: point.method,
                idx: i
            };
        };

        const dedupeCloseLevels = (levels, mergeThresholdPct = 0.008) => {
            const groupedByType = {
                support: levels.filter(l => l.type === 'support').sort((a, b) => a.price - b.price),
                resistance: levels.filter(l => l.type === 'resistance').sort((a, b) => a.price - b.price)
            };

            const merged = [];
            ['support', 'resistance'].forEach(type => {
                let bucket = [];
                groupedByType[type].forEach(level => {
                    if (!bucket.length) {
                        bucket.push(level);
                        return;
                    }
                    const anchor = bucket[bucket.length - 1];
                    const threshold = Math.max(anchor.price, level.price) * mergeThresholdPct;
                    if (Math.abs(level.price - anchor.price) <= threshold) {
                        bucket.push(level);
                    } else {
                        const best = bucket.sort((a, b) => b.strength - a.strength)[0];
                        merged.push(best);
                        bucket = [level];
                    }
                });
                if (bucket.length) {
                    const best = bucket.sort((a, b) => b.strength - a.strength)[0];
                    merged.push(best);
                }
            });
            return merged;
        };

        const pickTopLevels = (levels, type, limit = 5) => {
            return levels
                .filter(l => l.type === type)
                .sort((a, b) => b.strength - a.strength)
                .slice(0, limit)
                .sort((a, b) => a.price - b.price);
        };

        const renderAdvancedSR = async () => {
            try {
                await loadChartJs();

                let timestamps = [], closes = [], highs = [], lows = [], latestPrice = null;
                if (isThaiStock) {
                    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1d`;
                    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
                    const res = await fetch(proxyUrl).then(r => r.json());
                    const yfData = JSON.parse(res.contents);
                    const result = yfData.chart.result[0];
                    const quote = result.indicators.quote[0];
                    timestamps = result.timestamp || [];
                    closes = quote.close || [];
                    highs = quote.high || [];
                    lows = quote.low || [];
                    latestPrice = result.meta?.regularMarketPrice || closes[closes.length - 1];
                } else if (isCrypto) {
                    const coin = symbol.split(':')[1];
                    const data = await fetch(`https://api.binance.com/api/v3/klines?symbol=${coin}&interval=1d&limit=365`).then(r => r.json());
                    timestamps = data.map(k => Math.floor(k[0] / 1000));
                    highs = data.map(k => parseFloat(k[2]));
                    lows = data.map(k => parseFloat(k[3]));
                    closes = data.map(k => parseFloat(k[4]));
                    latestPrice = closes[closes.length - 1];
                } else {
                    const to = Math.floor(Date.now() / 1000);
                    const from = to - (365 * 24 * 60 * 60);
                    const cleanSym = symbol === 'XAUUSD' ? 'OANDA:XAU_USD' : symbol;
                    const fh = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${cleanSym}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`).then(r => r.json());
                    if (fh?.s !== 'ok' || !fh.c?.length) throw new Error('No chart data');
                    timestamps = fh.t;
                    closes = fh.c;
                    highs = fh.h;
                    lows = fh.l;
                    latestPrice = closes[closes.length - 1];
                }

                if (!closes.length) throw new Error('No chart points');

                const labels = timestamps.map(t => new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                const validClose = closes.filter(v => v !== null && !Number.isNaN(v));
                const validHigh = highs.filter(v => v !== null && !Number.isNaN(v));
                const validLow = lows.filter(v => v !== null && !Number.isNaN(v));
                const cLast = validClose[validClose.length - 1] || latestPrice || 0;

                const swings = detectSwingPoints(highs, lows, 4, 4);
                const scoredLevels = swings.map(p => scoreLevel(p, highs, lows, closes, cLast));
                const mergedLevels = dedupeCloseLevels(scoredLevels, 0.008);
                const supportLevels = pickTopLevels(mergedLevels, 'support', 5);
                const resistanceLevels = pickTopLevels(mergedLevels, 'resistance', 5);
                const selectedLevels = [...supportLevels, ...resistanceLevels];

                const makeLevelDataset = (level) => {
                    const normalized = Math.min(1, Math.max(0, level.strength / 16));
                    const alpha = 0.35 + (normalized * 0.45);
                    const width = 1 + (normalized * 2.2);
                    const isSupport = level.type === 'support';
                    const baseColor = isSupport ? `rgba(16,185,129,${alpha.toFixed(2)})` : `rgba(244,63,94,${alpha.toFixed(2)})`;
                    return {
                        label: `${isSupport ? 'Support' : 'Resistance'} ${level.price.toFixed(2)}`,
                        data: labels.map(() => level.price),
                        borderColor: baseColor,
                        borderWidth: width,
                        borderDash: normalized > 0.72 ? [] : [5, 4],
                        pointRadius: 0,
                        tension: 0,
                        order: 1
                    };
                };

                if (srChartInstance) srChartInstance.destroy();
                srChartInstance = new Chart(document.getElementById('detail-sr-chart'), {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [
                            { label: 'Price', data: closes, borderColor: '#34a8eb', borderWidth: 1.8, pointRadius: 0, tension: 0.15, order: 2 },
                            ...selectedLevels.map(makeLevelDataset)
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)}`
                                }
                            },
                            zoom: {
                                limits: {
                                    x: { min: 'original', max: 'original' },
                                    y: { min: 'original', max: 'original' }
                                },
                                pan: {
                                    enabled: true,
                                    mode: 'xy',
                                    modifierKey: null
                                },
                                zoom: {
                                    wheel: { enabled: true },
                                    pinch: { enabled: true },
                                    drag: { enabled: true },
                                    mode: 'xy'
                                }
                            }
                        },
                        scales: {
                            x: { display: false, grid: { color: '#1b2332' } },
                            y: { position: 'right', grid: { color: '#232b3e' }, ticks: { color: '#94a3b8' } }
                        }
                    }
                });
            } catch (e) {
                console.error(e);
                if (!isThaiStock) {
                    renderTradingViewFallback();
                    return;
                }
                container.innerHTML = `<p class="text-slate-500 text-sm flex items-center justify-center h-full">Chart Unavailable</p>`;
            }
        };
        renderAdvancedSR();
    };
    renderChart(); 

    const fetchSafePrice = async () => {
        if (isCrypto) {
            try {
                const coin = symbol.split(':')[1];
                const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${coin}`).then(res=>res.json());
                return { c: parseFloat(r.lastPrice), d: parseFloat(r.priceChange), dp: parseFloat(r.priceChangePercent) };
            } catch(e) {}
        }
        try {
            let fSym = symbol === 'XAUUSD' ? 'OANDA:XAU_USD' : symbol;
            const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${fSym}&token=${FINNHUB_API_KEY}`).then(res=>res.json());
            if (r && r.c > 0) return r;
        } catch(e) {}
        return null;
    };

    // ==========================================
    // 📌 3. ระบบดึงข้อมูลราคาและข่าว 
    // ==========================================
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
                        fetchSafePrice(),
                        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${cleanSym}&token=${FINNHUB_API_KEY}`).then(r=>r.json()),
                        fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${cleanSym}&metric=all&token=${FINNHUB_API_KEY}`).then(r=>r.json()),
                        fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${cleanSym}&token=${FINNHUB_API_KEY}`).then(r=>r.json()),
                        fetch(`https://finnhub.io/api/v1/stock/insider-transactions?symbol=${cleanSym}&token=${FINNHUB_API_KEY}`).then(r=>r.json())
                    ]);
                    quote = qRes; profile = pRes; metricsObj = mRes; consensusData = cRes; insiderData = iRes;
                } catch (e) { console.warn("Basic data fetch error"); }
            } else {
                quote = await fetchSafePrice();
            }

            // --- ดึงข่าว ---
            if (!isThaiStock) {
                if (isCrypto || isForex || symbol === 'XAUUSD') {
                    const category = isCrypto ? 'crypto' : 'forex';
                    let catNews = await fetch(`https://finnhub.io/api/v1/news?category=${category}&token=${FINNHUB_API_KEY}`).then(r=>r.json());
                    newsData = catNews;
                } else {
                    let compNews = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${cleanSym}&from=${formatDate(past15Days)}&to=${formatDate(today)}&token=${FINNHUB_API_KEY}`).then(r=>r.json()).catch(()=>[]);
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

            // --- อัปเดต UI พื้นฐาน ---
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
                        let fallbackText = `Based on financial data, ${symbol} is showing revenue growth of ${formatNum(m.revenueGrowthTTMYoy, '%')}.`;
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
        }
        
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
