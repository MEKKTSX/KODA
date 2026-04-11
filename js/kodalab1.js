// 🚀 KODA Lab Extension: AI Hedge Fund & Manual Mock Portfolio (Final Clean Build)
window.KodaLabAI = {
  chartInstance: null,
  baseChartMode: 'AI',
  activeBench: 'SPY',
  activeTF: '1mo',
  finnhubKeyIdx: 0,
  geminiKeyIdx: 0,

  // 1. 🌐 Helper Functions
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
        if (data.answerBox && data.answerBox.snippet) snippet += `- ${data.answerBox.snippet}\n`;
        if (data.organic) { data.organic.slice(0, 4).forEach(r => snippet += `- ${r.title}: ${r.snippet}\n`); }
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
    const defaultData = { capital: 0, unallocatedCash: 0, aiHoldings: [], aiHistoryLog: [], aiChartHistory: [], manualHoldings: [], manualChartHistory: [] };    return JSON.parse(localStorage.getItem('koda_hedge_fund') || JSON.stringify(defaultData));
  },

  saveData: (data) => {
    localStorage.setItem('koda_hedge_fund', JSON.stringify(data));
    window.KodaLabAI.renderUI();
  },

  // ☁️ New: Cloud Sync Function
  syncFromCloud: async () => {
    try {
      // ⚠️ เปลี่ยน USERNAME และ REPO ให้เป็นของคุณ
      const url = 'https://raw.githubusercontent.com/MEKKTSX/KODA/main/portfolio.json';
      const res = await fetch(url + '?t=' + Date.now());
      if (res.ok) {
        const cloudData = await res.json();
        // รวมข้อมูล Cloud เข้ากับ LocalStorage
        localStorage.setItem('koda_hedge_fund', JSON.stringify(cloudData));
        console.log("☁️ Synced from GitHub Cloud");
        return true;
      }
    } catch(e) {
      console.warn("⚠️ Cloud Sync failed (Offline mode):", e);
    }
    return false;
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
    const btnMan = document.getElementById('btn-base-manual');    if(window.KodaLabAI.baseChartMode === 'AI') {
      btnAi?.classList.add('bg-primary', 'text-white'); btnAi?.classList.remove('text-slate-500', 'bg-background-dark');
      btnMan?.classList.remove('bg-primary', 'text-white'); btnMan?.classList.add('text-slate-500');
    } else {
      btnMan?.classList.add('bg-primary', 'text-white'); btnMan?.classList.remove('text-slate-500', 'bg-background-dark');
      btnAi?.classList.remove('bg-primary', 'text-white'); btnAi?.classList.add('text-slate-500');
    }
  },

  // ⚙️ Initialization
  init: async () => {
    // ☁️ Sync from cloud first
    await window.KodaLabAI.syncFromCloud();

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
      const val = parseFloat(prompt("จำนวนเงินที่ต้องการฝากเข้า AI Fund (USD): ", "1000"));
      if (isNaN(val) || val <= 0) return;
      const data = window.KodaLabAI.loadData();
      data.capital += val;
      data.unallocatedCash += val; 
      window.KodaLabAI.saveData(data);
      window.KodaLabAI.recordDailyHistory(); 
      window.KodaLabAI.renderChart();
    });
    document.getElementById('btn-withdraw-capital')?.addEventListener('click', () => {
      const val = parseFloat(prompt("จำนวนเงินที่ต้องการถอน (USD): ", "500"));
      if (isNaN(val) || val <= 0) return;
      const data = window.KodaLabAI.loadData();
      if (val > data.unallocatedCash) {
        alert(`ถอนไม่ได้! คุณมีเงินสดว่าง (Unallocated Cash) แค่ $${data.unallocatedCash.toFixed(2)}`);
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
    window.KodaLabAI.renderUI(); // Render immediately
    window.KodaLabAI.renderChart();
  },

  // 🎨 UI Render
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
             <button class="absolute -left-2 -top-2 bg-danger text-white rounded-full size-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onclick="window.KodaLabAI.removeAIPosition('${h.symbol}')"> <span class="material-symbols-outlined text-[12px]">close</span> </button>
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
      manualHtml = `<p class="text-center text-slate-500 text-[10px] py-4 border border-dashed border-border-dark rounded-xl">No positions.</p>`;
    } else {
      for (const h of data.manualHoldings) {
        let currentPrice = h.avgCost;
        try {
          const res = await window.KodaLabAI.safeFetch(`https://finnhub.io/api/v1/quote?symbol=${h.symbol}`);          const q = await res.json();
          if (q && q.c > 0) currentPrice = q.c;
        } catch(e) {}
        const val = currentPrice * h.shares;
        manualTotalVal += val;
        manualHtml += `<div class="bg-background-dark/50 border border-border-dark rounded-xl p-2 flex justify-between text-xs"><span>${h.symbol}</span><span>$${val.toFixed(2)}</span></div>`;
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

  // 🧠 AI Hedge Fund Logic (Core Rebalance)
  runAIRebalance: async () => {
    const data = window.KodaLabAI.loadData();
    if (data.capital <= 0) return alert("โปรดฝากเงิน (CAPITAL) เข้าพอร์ตก่อนให้ AI บริหารครับ!");
    if (!confirm("AI จะสแกนตลาด + ข่าว + ตัดสินใจแบบ Hedge Fund (มี TP/SL) ยืนยันการรันไหมครับ?")) return;

    const btn = document.getElementById('btn-run-aifund');
    btn.disabled = true;
    btn.innerHTML = `<span class="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span> SCANNING...`;

    try {
      // 1. Discovery & Prices
      const baseWatchlist = ['ASTS','ONDS','RKLB','RBLX','NVDA','AAPL','MSFT','TSLA','AMZN','GOOGL','META','AVGO','PLTR','SOFI'];      const holdings = data.aiHoldings.map(h => h.symbol);
      
      let discoveredSymbols = [];
      try {
        const newsCtx = await window.KodaLabAI.fetchSerperContext("top performing US stocks today catalyst earnings breakout");
        const matches = newsCtx.match(/\b[A-Z]{2,5}\b/g) || [];
        discoveredSymbols = [...new Set(matches.filter(s => !['THE','AND','FOR','YOU','THIS','WITH','HAVE','WILL','FROM','THEY','BEEN','WERE','SAID','NEWS','STOCK','MARKET','FED','AI','USD'].includes(s) && s.length >= 2 && s.length <= 5))];
      } catch(e) {}

      const candidatePool = [...new Set([...holdings, ...baseWatchlist, ...discoveredSymbols])].slice(0, 35);
      
      let liveMarketData = {};
      let currentAIFundValue = data.unallocatedCash;
      let currentHoldingsInfo = [];

      for (const h of data.aiHoldings) {
        try {
          const res = await window.KodaLabAI.safeFetch(`https://finnhub.io/api/v1/quote?symbol=${h.symbol}`);
          const p = await res.json();
          const price = (p && p.c > 0) ? p.c : h.avgCost;
          currentAIFundValue += (h.shares * price);
          liveMarketData[h.symbol] = price;
          currentHoldingsInfo.push({ symbol: h.symbol, shares: h.shares, current_price: price, avg_cost: h.avgCost });
        } catch(e) {}
      }

      for (const sym of candidatePool) {
        if (!liveMarketData[sym]) {
          try {
            const res = await window.KodaLabAI.safeFetch(`https://finnhub.io/api/v1/quote?symbol=${sym}`);
            const p = await res.json();
            if (p && p.c > 0 && p.c < 10000) liveMarketData[sym] = p.c;
          } catch(e) {}
        }
      }

      // 2. AI Decision
      const totalPortfolioValue = currentAIFundValue;
      const prompt = `คุณคือ KODA AI Hedge Fund Manager
เป้าหมาย: โต 40-50%/ปี, Drawdown <15%
เงินสด: $${data.unallocatedCash.toFixed(2)} | มูลค่ารวม: $${totalPortfolioValue.toFixed(2)}
ถืออยู่: ${JSON.stringify(currentHoldingsInfo)} | ราคาตลาด: ${JSON.stringify(liveMarketData)}

กฎ:
1. ตำแหน่งเดียวไม่เกิน 20% พอร์ต
2. ทุก BUY ต้องมี stop_loss (-8~12%) และ take_profit (+25~50%)
3. ห้ามขายขาดทุนหนัก (>15%) เว้นแต่มีเหตุผล Macro/Fundamental ชัดเจน
4. Risk/Reward >= 1:2.5

ตอบ JSON ONLY:{ "trades": [{ "action": "BUY|SELL|HOLD", "symbol": "NVDA", "allocation_usd": 300, "entry_price": 185.50, "stop_loss": 172.00, "take_profit": 215.00, "reason": "เหตุผล..." }] }`;

      const GEMINI_KEY = window.ENV_KEYS?.GEMINI?.[0];
      if(!GEMINI_KEY) throw new Error("No Gemini Key");

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: { temperature: 0.2 }
        })
      });

      const resData = await response.json();
      const rawText = resData.candidates[0].content.parts[0].text;
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const aiPlan = JSON.parse(cleanJson);

      // 3. Validation & Execution
      const validatedTrades = [];
      const dateStr = new Date().toLocaleDateString('en-GB');
      let remainingCash = data.unallocatedCash;

      for (const trade of aiPlan.trades || []) {
        const sym = trade.symbol?.toUpperCase();
        const action = trade.action?.toUpperCase();
        if (!sym || !action) continue;
        
        let execPrice = liveMarketData[sym] || null;
        if (!execPrice) {
          try {
            const pRes = await window.KodaLabAI.safeFetch(`https://finnhub.io/api/v1/quote?symbol=${sym}`);
            const pData = await pRes.json();
            if (pData && pData.c > 0 && pData.c < 10000) execPrice = pData.c;
          } catch(e) {}
        }
        if (!execPrice) continue;

        if (action === "BUY") {
          let alloc = parseFloat(trade.allocation_usd) || 0;
          if (alloc > remainingCash * 0.85) alloc = Math.max(remainingCash * 0.8, 50);
          if (alloc < 50 || alloc > totalPortfolioValue * 0.2) continue;
          
          const sharesToBuy = alloc / execPrice;
          remainingCash -= alloc;
          validatedTrades.push({
            action: 'BUY', symbol: sym, shares: sharesToBuy, price: execPrice,
            stop_loss: parseFloat(trade.stop_loss) || (execPrice * 0.9),            take_profit: parseFloat(trade.take_profit) || (execPrice * 1.35),
            reason: trade.reason || "AI Analysis"
          });
        } else if (action === "SELL") {
          const holding = currentHoldingsInfo.find(h => h.symbol === sym);
          if (!holding) continue;
          const currentPnL = ((execPrice - holding.avg_cost) / holding.avg_cost) * 100;
          if (currentPnL < -15 && !trade.reason.toLowerCase().includes('macro') && !trade.reason.toLowerCase().includes('fundamental')) continue;
          
          const sellPct = Math.min(parseFloat(trade.sell_percent || 100), 100);
          const sharesToSell = holding.shares * (sellPct / 100);
          if (sharesToSell < 0.01) continue;
          remainingCash += (sharesToSell * execPrice);
          validatedTrades.push({
            action: 'SELL', symbol: sym, shares: sharesToSell, price: execPrice,
            reason: trade.reason || "AI Thesis Change"
          });
        } else if (action === "HOLD") {
          validatedTrades.push({
            action: 'HOLD', symbol: sym, shares: 0, price: execPrice,
            reason: trade.reason || "Monitoring"
          });
        }
      }

      let newUnallocated = data.unallocatedCash;
      let currentHoldingsMap = {};
      data.aiHoldings.forEach(h => currentHoldingsMap[h.symbol] = {...h});

      for (const t of validatedTrades) {
        const sym = t.symbol;
        if (t.action === 'BUY') {
          const existing = currentHoldingsMap[sym];
          if (existing) {
            const oldVal = existing.shares * existing.avgCost;
            existing.avgCost = (oldVal + (t.shares * t.price)) / (existing.shares + t.shares);
            existing.shares += t.shares;
          } else {
            currentHoldingsMap[sym] = { symbol: sym, shares: t.shares, avgCost: t.price, stop_loss: t.stop_loss, take_profit: t.take_profit };
          }
          newUnallocated -= (t.shares * t.price);
          data.aiHistoryLog.push({ date: dateStr, action: 'BUY', symbol: sym, shares: t.shares, price: t.price, reason: t.reason });
        } else if (t.action === 'SELL') {
          const existing = currentHoldingsMap[sym];
          if (existing) {
            newUnallocated += (t.shares * t.price);
            existing.shares -= t.shares;
            data.aiHistoryLog.push({ date: dateStr, action: 'SELL', symbol: sym, shares: t.shares, price: t.price, reason: t.reason });
            if (existing.shares <= 0.001) delete currentHoldingsMap[sym];
          }        } else {
          data.aiHistoryLog.push({ date: dateStr, action: 'HOLD', symbol: sym, shares: 0, price: t.price, reason: t.reason });
        }
      }

      data.aiHoldings = Object.values(currentHoldingsMap);
      data.unallocatedCash = Math.max(0, newUnallocated);
      
      window.KodaLabAI.saveData(data);
      window.KodaLabAI.recordDailyHistory(); 
      window.KodaLabAI.renderChart();
      alert(`✅ AI Hedge Fund เสร็จสิ้น!\n📊 Trade ที่ผ่าน Validate: ${validatedTrades.length}\n💵 เงินสดคงเหลือ: $${data.unallocatedCash.toFixed(2)}`);

    } catch(e) {
      console.error("AI Rebalance Error:", e);
      alert("เกิดข้อผิดพลาดในการเรียก AI");
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
    if (idxMan !== -1) data.manualChartHistory[idxMan].val = manualTotal;    else {
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
    const cacheKey = `koda_bench_${symbol}_${days}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    if (cached && (now - cached.timestamp < 86400000)) return cached.data;

    let range = '1mo';
    if (days > 30 && days <= 90) range = '3mo';
    else if (days > 90 && days <= 180) range = '6mo';
    else if (days > 180 && days <= 365) range = '1y';
    else if (days > 365) range = '5y';

    if (symbol === 'SPY' || symbol === 'QQQ') {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d`;
      try {
        const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
        if (!res.ok) return [];
        const yfData = await res.json();
        if (yfData?.chart?.result?.[0]) {
          const closes = yfData.chart.result[0].indicators.quote[0].close.filter(c => c !== null);
          localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: closes }));
          return closes;
        }
      } catch(e) {}
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
    }
    return [];
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
      const benchNameMap = { 'SPY': 'S&P 500', 'QQQ': 'NASDAQ', 'BTC-USD': 'Bitcoin' };
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
          iEl.textContent = '--';          iEl.className = 'text-lg font-black text-white';
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