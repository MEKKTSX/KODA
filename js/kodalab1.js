// 🚀 KODA Lab Extension: AI Hedge Fund & Manual Mock Portfolio
// แยกระบบอิสระ ไม่แตะต้องโค้ดหลัก (เวอร์ชัน AI ปลดแอก ท่องตลาด NYSE/NASDAQ หาหุ้นโต >40%)

window.KodaLabAI = {
    chartInstance: null,
    baseChartMode: 'AI', 
    activeBench: 'SPY', 
    activeTF: '1mo', 
    finnhubKeyIdx: 0,
    geminiKeyIdx: 0, 

    fetchSerperContext: async (query) => {
        const keys = window.ENV_KEYS?.SERPER || [];
        if (!keys || keys.length === 0) return "ไม่มีข้อมูลข่าวแบบ Real-time";
        
        for (let key of keys) {
            try {
                const res = await fetch('https://google.serper.dev/search', {
                    method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: query, gl: 'us', hl: 'en' }) 
                });
                if (!res.ok) continue;
                const data = await res.json();
                let snippet = "";
                if(data.answerBox && data.answerBox.snippet) snippet += `- ${data.answerBox.snippet}\n`;
                if(data.organic) { data.organic.slice(0, 4).forEach(r => snippet += `- ${r.title}: ${r.snippet}\n`); }
                return snippet;
            } catch(e) { continue; }
        }
        return "ไม่สามารถดึงข่าวได้ในขณะนี้";
    },

    safeFetch: async (url) => {
        const keys = window.ENV_KEYS?.FINNHUB_ARRAY || [window.ENV_KEYS?.FINNHUB].filter(Boolean);
        if (!keys || !keys.length) return fetch(url);
        let attempts = keys.length;
        while (attempts > 0) {
            try {
                const res = await fetch(`${url}&token=${keys[window.KodaLabAI.finnhubKeyIdx]}`);
                if (res.status === 429) {
                    window.KodaLabAI.finnhubKeyIdx = (window.KodaLabAI.finnhubKeyIdx + 1) % keys.length;
                    attempts--; continue;
                }
                return res;
            } catch (e) { attempts--; }
        }
        return fetch(url);
    },

    loadData: () => {
        const defaultData = { capital: 0, unallocatedCash: 0, aiHoldings: [], aiHistoryLog: [], aiChartHistory: [], manualHoldings: [], manualChartHistory: [] };
        return JSON.parse(localStorage.getItem('koda_hedge_fund') || JSON.stringify(defaultData));
    },
    
    saveData: (data) => {
        localStorage.setItem('koda_hedge_fund', JSON.stringify(data));
        window.KodaLabAI.renderUI();
    },

    syncUIButtons: () => {
        document.querySelectorAll('.mock-bench-btn').forEach(b => {
            if (b.dataset.bench === window.KodaLabAI.activeBench) {
                b.classList.add('bg-primary', 'text-white');
                b.classList.remove('text-slate-500', 'border', 'border-border-dark', 'bg-slate-700');
            } else {
                b.classList.remove('bg-primary', 'text-white', 'bg-slate-700');
                b.classList.add('text-slate-500', 'border', 'border-border-dark');
            }
        });
        
        document.querySelectorAll('.mock-tf-btn').forEach(b => {
            if (b.dataset.tf === window.KodaLabAI.activeTF) {
                b.classList.add('bg-slate-700', 'text-white');
                b.classList.remove('text-slate-500');
            } else {
                b.classList.remove('bg-slate-700', 'text-white');
                b.classList.add('text-slate-500');
            }
        });
        
        const btnAi = document.getElementById('btn-base-ai');
        const btnMan = document.getElementById('btn-base-manual');
        if(window.KodaLabAI.baseChartMode === 'AI') {
            btnAi?.classList.add('bg-primary', 'text-white'); btnAi?.classList.remove('text-slate-500', 'bg-background-dark');
            btnMan?.classList.remove('bg-primary', 'text-white'); btnMan?.classList.add('text-slate-500');
        } else {
            btnMan?.classList.add('bg-primary', 'text-white'); btnMan?.classList.remove('text-slate-500', 'bg-background-dark');
            btnAi?.classList.remove('bg-primary', 'text-white'); btnAi?.classList.add('text-slate-500');
        }
    },

    init: () => {
        const tabAiFund = document.getElementById('tab-aifund');
        const otherTabs = ['simulator', 'avgcost', 'benchmark', 'metrics'];
        
        tabAiFund?.addEventListener('click', () => {
            otherTabs.forEach(t => {
                const b = document.getElementById(`tab-${t}`);
                const c = document.getElementById(`content-${t}`);
                if(b) { b.classList.remove('bg-primary', 'text-white'); b.classList.add('text-slate-500'); }
                if(c) c.classList.add('hidden');
            });
            tabAiFund.classList.add('bg-primary', 'text-white');
            tabAiFund.classList.remove('text-slate-500');
            document.getElementById('content-aifund').classList.remove('hidden');
            window.KodaLabAI.renderUI();
        });

        otherTabs.forEach(t => {
            document.getElementById(`tab-${t}`)?.addEventListener('click', () => {
                document.getElementById('content-aifund')?.classList.add('hidden');
                if (tabAiFund) {
                    tabAiFund.classList.remove('bg-primary', 'text-white');
                    tabAiFund.classList.add('text-slate-500');
                }
            });
        });

        document.getElementById('btn-deposit-capital')?.addEventListener('click', () => {
            const val = parseFloat(prompt("จำนวนเงินที่ต้องการฝากเข้า AI Fund (USD):", "1000"));
            if (isNaN(val) || val <= 0) return;
            const data = window.KodaLabAI.loadData();
            data.capital += val;
            data.unallocatedCash += val; 
            window.KodaLabAI.saveData(data);
            window.KodaLabAI.recordDailyHistory(); 
            window.KodaLabAI.renderChart();
        });

        document.getElementById('btn-withdraw-capital')?.addEventListener('click', () => {
            const val = parseFloat(prompt("จำนวนเงินที่ต้องการถอน (USD):", "500"));
            if (isNaN(val) || val <= 0) return;
            const data = window.KodaLabAI.loadData();
            if (val > data.unallocatedCash) {
                alert(`ถอนไม่ได้! คุณมีเงินสดว่าง (Unallocated Cash) แค่ $${data.unallocatedCash.toFixed(2)}\nกรุณากด Rebalance เพื่อให้ AI ขายหุ้นทำกำไรก่อนครับ`);
                return;
            }
            data.capital -= val;
            data.unallocatedCash -= val;
            window.KodaLabAI.saveData(data);
            window.KodaLabAI.recordDailyHistory();
            window.KodaLabAI.renderChart();
        });

        document.getElementById('btn-add-manual')?.addEventListener('click', () => {
            const sym = document.getElementById('manual-input-sym').value.toUpperCase().trim();
            const shares = parseFloat(document.getElementById('manual-input-shares').value);
            const price = parseFloat(document.getElementById('manual-input-price').value);
            
            if (!sym || isNaN(shares) || isNaN(price)) return alert('กรุณากรอกข้อมูลให้ครบถ้วนครับ');
            
            const data = window.KodaLabAI.loadData();
            const existing = data.manualHoldings.find(h => h.symbol === sym);
            
            if (existing) {
                const totalOldCost = existing.shares * existing.avgCost;
                const newCost = shares * price;
                existing.shares += shares;
                existing.avgCost = (totalOldCost + newCost) / existing.shares;
            } else {
                data.manualHoldings.push({ symbol: sym, shares, avgCost: price });
            }
            
            document.getElementById('manual-input-sym').value = '';
            document.getElementById('manual-input-shares').value = '';
            document.getElementById('manual-input-price').value = '';
            window.KodaLabAI.saveData(data);
            window.KodaLabAI.recordDailyHistory();
            window.KodaLabAI.renderChart();
        });

        document.getElementById('btn-run-aifund')?.addEventListener('click', window.KodaLabAI.runAIRebalance);

        document.getElementById('btn-base-ai')?.addEventListener('click', () => {
            window.KodaLabAI.baseChartMode = 'AI';
            window.KodaLabAI.syncUIButtons();
            window.KodaLabAI.renderChart();
        });
        
        document.getElementById('btn-base-manual')?.addEventListener('click', () => {
            window.KodaLabAI.baseChartMode = 'MANUAL';
            window.KodaLabAI.syncUIButtons();
            window.KodaLabAI.renderChart();
        });

        document.querySelectorAll('.mock-bench-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                window.KodaLabAI.activeBench = e.currentTarget.dataset.bench; 
                window.KodaLabAI.syncUIButtons();
                window.KodaLabAI.renderChart();
            });
        });

        document.querySelectorAll('.mock-tf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                window.KodaLabAI.activeTF = e.currentTarget.dataset.tf;
                window.KodaLabAI.syncUIButtons();
                window.KodaLabAI.renderChart();
            });
        });

        window.KodaLabAI.syncUIButtons();
        window.KodaLabAI.recordDailyHistory();
    },

    renderUI: async () => {
        const data = window.KodaLabAI.loadData();
        
        document.getElementById('ai-capital-val').textContent = `$${data.capital.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        document.getElementById('ai-unallocated-cash').textContent = `Unallocated: $${data.unallocatedCash.toLocaleString(undefined, {minimumFractionDigits:2})}`;
        
        let aiTotalVal = data.unallocatedCash;
        let aiHtml = '';

        if (data.aiHoldings.length === 0) {
            aiHtml = `<p class="text-center text-slate-500 text-[10px] py-4 border border-dashed border-border-dark rounded-xl">ยังไม่มีหุ้นใน AI Port กรุณากด Rebalance</p>`;
        } else {
            for (const h of data.aiHoldings) {
                let currentPrice = h.avgCost;
                try {
                    const res = await window.KodaLabAI.safeFetch(`https://finnhub.io/api/v1/quote?symbol=${h.symbol}`);
                    const q = await res.json();
                    if (q && q.c > 0) currentPrice = q.c;
                } catch(e) {}

                const val = currentPrice * h.shares;
                aiTotalVal += val;
                const profitPct = ((currentPrice - h.avgCost) / h.avgCost) * 100;
                const isUp = profitPct >= 0;

                aiHtml += `
                <div class="bg-background-dark/50 border border-border-dark rounded-xl p-3 flex justify-between items-center group relative">
                    <button class="absolute -left-2 -top-2 bg-danger text-white rounded-full size-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onclick="window.KodaLabAI.removeAIPosition('${h.symbol}')"><span class="material-symbols-outlined text-[12px]">close</span></button>
                    <div>
                        <p class="text-white font-bold text-sm">${h.symbol}</p>
                        <p class="text-slate-400 text-[9px]">Avg: $${h.avgCost.toFixed(2)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-white font-bold text-sm">$${val.toFixed(2)}</p>
                        <p class="${isUp ? 'text-success' : 'text-danger'} text-[10px] font-bold">${isUp ? '+' : ''}${profitPct.toFixed(2)}%</p>
                    </div>
                </div>`;
            }
        }
        document.getElementById('ai-holdings-list').innerHTML = aiHtml;
        document.getElementById('ai-total-val').textContent = `$${aiTotalVal.toLocaleString(undefined, {minimumFractionDigits:2})}`;

        const logContainer = document.getElementById('ai-trade-logs');
        if (data.aiHistoryLog.length === 0) {
            logContainer.innerHTML = `<p class="text-center text-slate-500 text-[10px] py-4">No AI trading history yet.</p>`;
        } else {
            const logsRev = [...data.aiHistoryLog].reverse().slice(0, 20);
            logContainer.innerHTML = logsRev.map(log => {
                const isBuy = log.action === 'BUY';
                return `
                <div class="border-l-2 ${isBuy ? 'border-success' : 'border-danger'} pl-3 py-1 mb-2">
                    <p class="text-[9px] text-slate-500 font-bold mb-0.5">${log.date}</p>
                    <p class="text-xs text-white font-bold">
                        <span class="${isBuy ? 'text-success' : 'text-danger'}">${log.action}</span> ${log.symbol} 
                        <span class="text-slate-400 font-normal">(${log.shares.toFixed(2)} sh @ $${log.price.toFixed(2)})</span>
                    </p>
                    <p class="text-[9px] text-primary mt-0.5">Reason: ${log.reason}</p>
                </div>`;
            }).join('');
        }

        let manualTotalVal = 0;
        let manualHtml = '';

        if (data.manualHoldings.length === 0) {
            manualHtml = `<p class="text-center text-slate-500 text-[10px] py-4 border border-dashed border-border-dark rounded-xl">No positions. Add manually.</p>`;
        } else {
            for (const h of data.manualHoldings) {
                let currentPrice = h.avgCost;
                try {
                    const res = await window.KodaLabAI.safeFetch(`https://finnhub.io/api/v1/quote?symbol=${h.symbol}`);
                    const q = await res.json();
                    if (q && q.c > 0) currentPrice = q.c;
                } catch(e) {}

                const val = currentPrice * h.shares;
                manualTotalVal += val;
                const profitPct = ((currentPrice - h.avgCost) / h.avgCost) * 100;
                const isUp = profitPct >= 0;

                manualHtml += `
                <div class="bg-background-dark/50 border border-border-dark rounded-xl p-3 flex justify-between items-center group relative">
                    <button class="absolute -left-2 -top-2 bg-danger text-white rounded-full size-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onclick="window.KodaLabAI.removeManualPosition('${h.symbol}')"><span class="material-symbols-outlined text-[12px]">close</span></button>
                    <div>
                        <p class="text-white font-bold text-sm">${h.symbol}</p>
                        <p class="text-slate-400 text-[9px]">Avg: $${h.avgCost.toFixed(2)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-white font-bold text-sm">$${val.toFixed(2)}</p>
                        <p class="${isUp ? 'text-success' : 'text-danger'} text-[10px] font-bold">${isUp ? '+' : ''}${profitPct.toFixed(2)}%</p>
                    </div>
                </div>`;
            }
        }
        document.getElementById('manual-holdings-list').innerHTML = manualHtml;
        document.getElementById('manual-total-val').textContent = `$${manualTotalVal.toLocaleString(undefined, {minimumFractionDigits:2})}`;

        window.KodaLabAI.renderChart(aiTotalVal, manualTotalVal);
    },

    removeAIPosition: (sym) => {
        const data = window.KodaLabAI.loadData();
        const idx = data.aiHoldings.findIndex(h => h.symbol === sym);
        if (idx !== -1) {
            data.unallocatedCash += (data.aiHoldings[idx].shares * data.aiHoldings[idx].avgCost);
            data.aiHoldings.splice(idx, 1);
            window.KodaLabAI.saveData(data);
            window.KodaLabAI.recordDailyHistory();
            window.KodaLabAI.renderChart();
        }
    },

    removeManualPosition: (sym) => {
        const data = window.KodaLabAI.loadData();
        const idx = data.manualHoldings.findIndex(h => h.symbol === sym);
        if (idx !== -1) {
            data.manualHoldings.splice(idx, 1);
            window.KodaLabAI.saveData(data);
            window.KodaLabAI.recordDailyHistory();
            window.KodaLabAI.renderChart();
        }
    },

    runAIRebalance: async () => {
    const data = window.KodaLabAI.loadData();
        
        if (data.capital <= 0) {
            return alert("โปรดฝากเงิน (CAPITAL) เข้าพอร์ตก่อนให้ AI บริหารครับ! กดปุ่ม + ได้เลย");
        }

        if (!confirm("AI จะทำการสแกนตลาด NYSE/NASDAQ แบบ Real-time ค้นหาหุ้น Large/Mid/Small Cap ด้วยตัวเอง ยืนยันการรันระบบไหมครับ?")) return;

        const btn = document.getElementById('btn-run-aifund');
        btn.disabled = true;
        btn.innerHTML = `<span class="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span> SCANNING MARKET...`;

        try {
            // 1. ดึงข้อมูลราคา "เฉพาะหุ้นที่มีในพอร์ตตอนนี้" เพื่อให้ AI รู้สถานะตัวเอง
            let liveMarketData = {};
            let currentAIFundValue = data.unallocatedCash;
            let currentHoldingsInfo = [];

            for (const h of data.aiHoldings) {
                try {
                    const priceRes = await window.KodaLabAI.safeFetch(`https://finnhub.io/api/v1/quote?symbol=${h.symbol}`);
                    const p = await priceRes.json();
                    const currentPrice = (p && p.c > 0) ? p.c : h.avgCost;
                    currentAIFundValue += (h.shares * currentPrice);
                    liveMarketData[h.symbol] = currentPrice;
                    currentHoldingsInfo.push({ symbol: h.symbol, shares: h.shares, current_price: currentPrice, avg_cost: h.avgCost });
                } catch(e) { }
            }

            // 2. Prompt แบบ Autonomous Search (ให้ AI ลงพื้นที่หาข้อมูลเอง)
            const prompt = `คุณคือ KODA AI Hedge Fund Manager หน้าที่ของคุณคือบริหารพอร์ตให้เติบโต ชนะ S&P500 

            [สถานะพอร์ตปัจจุบัน]:
            - เงินสดที่พร้อมลงทุน (Unallocated Cash): $${data.unallocatedCash.toFixed(2)}
            - มูลค่าพอร์ตรวมทั้งหมด (Total Value): $${currentAIFundValue.toFixed(2)}
            - หุ้นที่ถืออยู่ตอนนี้: ${JSON.stringify(currentHoldingsInfo)} (อิงราคาปัจจุบันตามนี้: ${JSON.stringify(liveMarketData)})

            [ภารกิจของคุณ]:
            1. MUST DO: ใช้เครื่องมือ Google Search เพื่อสแกนตลาดหุ้นสหรัฐฯ (NYSE, NASDAQ) ณ วันนี้!
            2. ค้นหาข่าวเศรษฐกิจ, งบการเงินล่าสุด, หรือกระแสเทคโนโลยี (เช่น Tech, Defense, Space, Biotech)
            3. สแกนหาโอกาสลงทุนทั้งใน Large Cap, Mid Cap และ Small Cap ห้ามตีกรอบตัวเองอยู่แค่หุ้นเดิมๆ
            4. เลือกหุ้นที่น่าสนใจที่สุดสำหรับการทำกำไร (BUY) หรือพิจารณาขายหุ้นที่มีอยู่แล้ว (SELL) หากกราฟ/ข่าวแย่ลง
            
            [ข้อควรระวัง]:
            - ห้ามสั่งซื้อ (BUY) ด้วยเงินรวมกันเกินเงินสดที่มี ($${data.unallocatedCash.toFixed(2)})
            - เลือกเฉพาะหุ้นที่มีการซื้อขายจริงใน NYSE หรือ NASDAQ เท่านั้น ห้ามเอาเหรียญคริปโตหรือ OTC
            - ไม่ต้องเดาราคาหุ้นตัวใหม่ที่คุณเพิ่งค้นเจอ ให้กำหนดเป็น "amount_usd" (งบประมาณที่อยากลง) ระบบจะไปดึงราคาจริงมาคำนวณจำนวนหุ้นเอง

            ตอบกลับเป็น JSON STRICT ONLY ห้ามมี Text อื่น โครงสร้างดังนี้:
            {
                "trades": [
                    { "action": "BUY", "symbol": "TICKER_NAME", "amount_usd": 300, "reason": "พบข่าวประกาศงบไตรมาสล่าสุดโต 50% และเป็นหุ้น Small Cap ที่ได้ประโยชน์จากนโยบายรัฐ..." },
                    { "action": "SELL", "symbol": "TICKER_NAME", "sell_percent": 100, "reason": "มีข่าวผู้บริหารลาออก ขายทิ้งเพื่อลดความเสี่ยง..." },
                    { "action": "HOLD", "symbol": "TICKER_NAME", "reason": "รอปัจจัยใหม่มาหนุน..." }
                ]
            }`;

            const GEMINI_KEY = window.ENV_KEYS?.GEMINI[0];
            if(!GEMINI_KEY) throw new Error("No Gemini Key");

            btn.innerHTML = `<span class="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span> AI THINKING...`;

            // ใช้ Temp 0.3 เพื่อให้มีความคิดสร้างสรรค์ในการค้นหาหุ้นใหม่ๆ แต่ยังคงรักษาโครงสร้าง JSON ได้ดี
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: prompt }] }],
                    tools: [{ googleSearch: {} }],
                    generationConfig: { temperature: 0.3 } 
                })
            });

            const resData = await response.json();
            const rawText = resData.candidates[0].content.parts[0].text;
            const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiPlan = JSON.parse(cleanJson);

            // 3. Execution Phase (คำนวณและซื้อขายด้วยราคาจริง ณ วินาทีนี้)
            const dateStr = new Date().toLocaleDateString('en-GB');
            let newUnallocated = data.unallocatedCash;
            let currentHoldingsMap = {};
            data.aiHoldings.forEach(h => currentHoldingsMap[h.symbol] = h);

            btn.innerHTML = `<span class="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span> EXECUTING...`;

            for (const trade of aiPlan.trades) {
                const sym = trade.symbol.toUpperCase();
                
                // 🚀 หัวใจสำคัญ: ดึงราคาจริงจาก API ทันทีที่ AI เลือกหุ้นมา (ปิดประตูมโนราคา 100%)
                let execPrice = liveMarketData[sym] || null;
                if (!execPrice && trade.action !== "HOLD") {
                    try {
                        const pRes = await window.KodaLabAI.safeFetch(`https://finnhub.io/api/v1/quote?symbol=${sym}`);
                        const pData = await pRes.json();
                        if (pData && pData.c > 0) execPrice = pData.c;
                    } catch(e) {}
                }
                
                // ถ้าระบบหาราคาหุ้นไม่ได้ (อาจเป็น Ticker ผิด หรือไม่มีอยู่จริง) ให้ข้ามคำสั่งนี้ไปเลย
                if (!execPrice && trade.action !== "HOLD") {
                    console.warn(`ข้ามคำสั่ง: หาราคาหุ้น ${sym} ไม่พบ`);
                    continue; 
                }

                if (trade.action === "BUY") {
                    const spendAmount = Math.min(trade.amount_usd, newUnallocated);
                    if (spendAmount < 5) continue; 
                    
                    const sharesToBuy = spendAmount / execPrice;
                    newUnallocated -= spendAmount;

                    if (currentHoldingsMap[sym]) {
                        const existing = currentHoldingsMap[sym];
                        existing.avgCost = ((existing.shares * existing.avgCost) + spendAmount) / (existing.shares + sharesToBuy);
                        existing.shares += sharesToBuy;
                    } else {
                        currentHoldingsMap[sym] = { symbol: sym, shares: sharesToBuy, avgCost: execPrice };
                    }
                    data.aiHistoryLog.push({ date: dateStr, action: 'BUY', symbol: sym, shares: sharesToBuy, price: execPrice, reason: trade.reason });
                
                } else if (trade.action === "SELL") {
                    if (currentHoldingsMap[sym]) {
                        const existing = currentHoldingsMap[sym];
                        const sellPct = Math.min(trade.sell_percent || 100, 100);
                        const sharesToSell = existing.shares * (sellPct / 100);
                        const cashReturned = sharesToSell * execPrice;
                        
                        newUnallocated += cashReturned;
                        existing.shares -= sharesToSell;
                        
                        data.aiHistoryLog.push({ date: dateStr, action: 'SELL', symbol: sym, shares: sharesToSell, price: execPrice, reason: trade.reason });

                        if (existing.shares <= 0.0001) delete currentHoldingsMap[sym];
                    }
                } else if (trade.action === "HOLD") {
                    if (currentHoldingsMap[sym]) {
                        // ดึงราคาล่าสุดที่เก็บไว้มาบันทึก หรือใช้ avgCost เดิม
                        const holdPrice = liveMarketData[sym] || currentHoldingsMap[sym].avgCost;
                        data.aiHistoryLog.push({ date: dateStr, action: 'HOLD', symbol: sym, shares: currentHoldingsMap[sym].shares, price: holdPrice, reason: trade.reason });
                    }
                }
            }

            data.aiHoldings = Object.values(currentHoldingsMap);
            data.unallocatedCash = newUnallocated;
            
            window.KodaLabAI.saveData(data);
            window.KodaLabAI.recordDailyHistory(); 
            window.KodaLabAI.renderChart();
            alert("✅ AI Agent สแกนตลาดและปรับพอร์ตเรียบร้อยแล้ว!");

        } catch(e) {
            console.error(e);
            alert("เกิดข้อผิดพลาดในการเรียก AI (อาจเป็นเพราะ API Limit หรือการแปลงผลลัพธ์) กรุณาลองใหม่ครับ");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<span class="material-symbols-outlined text-[14px]">auto_awesome</span> Rebalance`;
        }
    },
        
    recordDailyHistory: (aiTotalForced = null, manualTotalForced = null) => {
        const data = window.KodaLabAI.loadData();
        const today = new Date().toISOString().split('T')[0];
        
        let aiTotal = aiTotalForced;
        if (aiTotal === null) {
            aiTotal = data.unallocatedCash;
            data.aiHoldings.forEach(h => { aiTotal += (h.shares * h.avgCost); }); 
        }

        let manualTotal = manualTotalForced;
        if (manualTotal === null) {
            manualTotal = 0;
            data.manualHoldings.forEach(h => { manualTotal += (h.shares * h.avgCost); });
        }

        const idxAi = data.aiChartHistory.findIndex(h => h.date === today);
        if (idxAi !== -1) data.aiChartHistory[idxAi].val = aiTotal;
        else {
            if (data.aiChartHistory.length === 0) {
                const ytd = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                data.aiChartHistory.push({ date: ytd, val: data.capital > 0 ? data.capital : 0 });
            }
            data.aiChartHistory.push({ date: today, val: aiTotal });
        }

        const idxMan = data.manualChartHistory.findIndex(h => h.date === today);
        if (idxMan !== -1) data.manualChartHistory[idxMan].val = manualTotal;
        else {
            if (data.manualChartHistory.length === 0) {
                const ytd = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                data.manualChartHistory.push({ date: ytd, val: 0 });
            }
            data.manualChartHistory.push({ date: today, val: manualTotal });
        }
        
        localStorage.setItem('koda_hedge_fund', JSON.stringify(data));
    },

    getBenchmarkData: async (symbol, days) => {
        const now = Date.now();

        if (symbol === 'MAIN') {
            const cacheKey = `koda_bench_MAIN_${days}`;
            const cached = JSON.parse(localStorage.getItem(cacheKey));
            if (cached && (now - cached.timestamp < 43200000)) { 
                return cached.data;
            }

            const mainHis = JSON.parse(localStorage.getItem('koda_equity_history') || '[]');
            const data = mainHis.slice(-days).map(h => h.value);
            
            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data }));
            return data;
        }
        
        const cacheKey = `koda_bench_${symbol}_${days}`;
        const cached = JSON.parse(localStorage.getItem(cacheKey));
        if (cached && (now - cached.timestamp < 86400000)) { 
            return cached.data;
        }

        let range = '1mo';
        if (days > 30 && days <= 90) range = '3mo';
        else if (days > 90 && days <= 180) range = '6mo';
        else if (days > 180 && days <= 365) range = '1y';
        else if (days > 365) range = '5y';

        let yfSym = symbol;
        if (symbol === 'SPY' || symbol === 'QQQ') {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSym}?range=${range}&interval=1d`;
            const proxies = [
                `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
                `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
            ];
            
            for (let proxy of proxies) {
                try {
                    const res = await fetch(proxy);
                    if (!res.ok) continue;
                    let rawData = await res.json();
                    let yfData = rawData.contents ? (typeof rawData.contents === 'string' ? JSON.parse(rawData.contents) : rawData.contents) : rawData;
                    
                    if (yfData?.chart?.result?.[0]) {
                        const closes = yfData.chart.result[0].indicators.quote[0].close.filter(c => c !== null);
                        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: closes }));
                        return closes;
                    }
                } catch(e) { console.warn("Proxy failed", e); }
            }
            return [];
        } else {
            const to = Math.floor(Date.now() / 1000);
            const from = to - (days * 24 * 60 * 60);
            try {
                const res = await window.KodaLabAI.safeFetch(`https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}`);
                const data = await res.json();
                if (data.s === 'ok') {
                    localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: data.c }));
                    return data.c;
                }
            } catch(e) {}
            return [];
        }
    },

    renderChart: async () => {
        const ctx = document.getElementById('mock-fund-chart');
        if (!ctx) return;

        const data = window.KodaLabAI.loadData();
        const tfMap = { '7D': 7, '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '5y': 1825 };
        const days = tfMap[window.KodaLabAI.activeTF] || 30; 
        
        const isAI = window.KodaLabAI.baseChartMode === 'AI';
        const baseHistory = isAI ? data.aiChartHistory : data.manualChartHistory;
        
        let portData = baseHistory.slice(-days).map(h => h.val);
        let labels = baseHistory.slice(-days).map(h => h.date.substring(5)); 
        
        const isComparing = true; 
        let datasets = [];

        const firstValidVal = portData.find(v => v > 0) || 1;
        let portPct = portData.map(v => v === 0 ? 0 : ((v - firstValidVal) / firstValidVal) * 100);
        
        datasets.push({
            label: isAI ? 'AI Port' : 'Manual Port', data: portPct, borderColor: isAI ? '#34a8eb' : '#f97316', borderWidth: 2.5, tension: 0.3, pointRadius: 0
        });

        if (window.KodaLabAI.activeBench !== 'NONE') {
            let benchPct = [];
            const benchVals = await window.KodaLabAI.getBenchmarkData(window.KodaLabAI.activeBench, days);
            
            if (benchVals && benchVals.length > 0) {
                const alignedBench = benchVals.slice(-portData.length);
                const benchStart = alignedBench[0] || 1;
                benchPct = alignedBench.map(v => ((v - benchStart) / benchStart) * 100);
                datasets.push({
                    label: window.KodaLabAI.activeBench, data: benchPct, borderColor: '#64748b', borderWidth: 2, borderDash: [5, 5], tension: 0.3, pointRadius: 0
                });
            }

            const rangeNameMap = { '7D': '7D', '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Y', '5y': '5Y' };
            const benchNameMap = { 'SPY': 'S&P 500', 'QQQ': 'NASDAQ', 'MAIN': 'Main Port', 'BTC-USD': 'Bitcoin' };
            const tfLabel = rangeNameMap[window.KodaLabAI.activeTF] || '1M';
            const benchLabel = benchNameMap[window.KodaLabAI.activeBench] || 'S&P 500';

            const nameEl = document.getElementById('ai-bench-index-name');
            if(nameEl) nameEl.textContent = `${benchLabel} (${tfLabel})`;

            const iEl = document.getElementById('ai-bench-index-val');
            if (iEl) {
                if (benchPct.length > 0) {
                    const indexFinalPct = benchPct[benchPct.length - 1] || 0;
                    iEl.textContent = `${indexFinalPct >= 0 ? '+' : ''}${indexFinalPct.toFixed(2)}%`;
                    iEl.className = `text-lg font-black ${indexFinalPct >= 0 ? 'text-success' : 'text-danger'}`;
                } else {
                    iEl.textContent = '--';
                    iEl.className = 'text-lg font-black text-white';
                }
            }
        }

        if (window.KodaLabAI.chartInstance) window.KodaLabAI.chartInstance.destroy();
        window.KodaLabAI.chartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: { mode: 'index', intersect: false, callbacks: { label: c => `${c.dataset.label}: ${isComparing ? c.raw.toFixed(2)+'%' : '$'+c.raw.toLocaleString()}` } }
                },
                scales: { 
                    x: { display: false }, 
                    y: { position: 'right', grid: { color: '#232b3e' }, ticks: { color: '#94a3b8', callback: v => isComparing ? v + '%' : '$' + v.toLocaleString() } } 
                }
            }
        });

        const portFinalPct = portPct[portPct.length - 1] || 0;
        const pEl = document.getElementById('ai-bench-port-val');
        if(pEl) {
            pEl.textContent = `${portFinalPct >= 0 ? '+' : ''}${portFinalPct.toFixed(2)}%`;
            pEl.className = `text-lg font-black ${portFinalPct >= 0 ? 'text-success' : 'text-danger'}`;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.KodaLabAI.init();
    }, 500);
});
