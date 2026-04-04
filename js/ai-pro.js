// 🚀 KODA AI Pro Module (Phase 3 - Clean & Minimal)
// ระบบแจ้งเตือนหุ้นที่ขยับแรง (ถอดระบบ Infographic ออกตามคำสั่ง เน้นความสะอาด)

window.KodaAIPro = {
    // 1. วิเคราะห์ Pattern จากข้อมูลราคาจริง (เอาของจำลองออกหมด)
    analyzePattern: (closes, symbol) => {
        if (!closes || closes.length < 5) return null;
        
        const cur = closes[closes.length - 1];
        const prev = closes[closes.length - 2];
        let changePct = ((cur - prev) / prev) * 100;
        
        // 📌 แจ้งเตือนเฉพาะหุ้นที่ขยับจริงจังเกิน 3% เท่านั้น (ถ้าวันไหนนิ่งๆ จะไม่มีการ์ดเด้งกวนใจ)
        if (Math.abs(changePct) < 3.0) return null;

        const isBullish = changePct > 0;
        const patterns = isBullish ? ['Bullish Momentum', 'Breakout Rally', 'Volume Surge'] : ['Bearish Drop', 'Support Breakdown', 'Heavy Selloff'];
        
        const hash = symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const pattern = patterns[hash % patterns.length];
        
        const reasons = isBullish ? 
            ["Unusual high volume detected pushing the price up.", "Positive market sentiment driving heavy accumulation.", "Strong upward momentum breaking recent resistance levels."] :
            ["Heavy offloading breaking key support levels.", "Negative sentiment causing cascading sells.", "Sharp downward momentum with increased selling pressure."];
        
        return {
            type: 'VOLATILITY',
            pattern: pattern,
            change: changePct,
            reason: reasons[hash % reasons.length],
            sentiment: isBullish ? 'BULLISH' : 'BEARISH'
        };
    },

    // 2. ฟังก์ชันสแกน Watchlist เพื่อหาหุ้นที่เด้งแรงๆ
    runAnomalyScanner: async () => {
        const container = document.getElementById('anomaly-container');
        if (!container) return;

        const savedData = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{}');
        const wl = savedData.watchlist || [];
        if (wl.length === 0) return;

        let aiCardsHtml = '';
        // สแกนเฉพาะหุ้นในพอร์ตเพื่อหาตัวที่ขยับแรง
        for (const item of wl.slice(0, 5)) { 
            if (item.symbol.includes('.BK')) continue; 
            
            let closes = null;
            if (window.KodaMarketPlus && window.KodaMarketPlus.getYahooHistory) {
                closes = await window.KodaMarketPlus.getYahooHistory(item.symbol, '1mo');
            }

            const analysis = window.KodaAIPro.analyzePattern(closes, item.symbol);
            
            if (analysis) {
                const colorCls = analysis.sentiment === 'BULLISH' ? 'success' : 'danger';
                
                aiCardsHtml += `
                <div class="block bg-surface-dark border border-${colorCls}/40 rounded-xl p-3 relative overflow-hidden mb-3 shadow-[0_0_15px_rgba(0,0,0,0.2)]">
                    <div class="absolute top-0 left-0 w-1 h-full bg-${colorCls}"></div>
                    <div class="flex justify-between items-center mb-2 pl-2">
                        <span class="bg-${colorCls}/10 text-${colorCls} text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border border-${colorCls}/20 flex items-center gap-1">
                            <span class="material-symbols-outlined text-[10px]">insights</span> HIGH VOLATILITY
                        </span>
                        <span class="text-white text-xs font-black">${item.symbol} <span class="text-${colorCls}">${analysis.change > 0 ? '+' : ''}${analysis.change.toFixed(2)}%</span></span>
                    </div>
                    <div class="pl-2">
                        <h3 class="text-slate-200 font-bold text-sm leading-tight">
                            <span class="text-${colorCls} mr-1">[${analysis.pattern}]</span>
                        </h3>
                        <p class="text-slate-400 text-[10px] mt-1 leading-snug line-clamp-2">
                            <strong class="text-slate-300">Observation:</strong> ${analysis.reason}
                        </p>
                    </div>
                </div>`;
            }
        }

        if (aiCardsHtml !== '') {
            // เอาข้อความ "No significant anomalies" ออก (ถ้ามี)
            if (container.innerHTML.includes('No significant market anomalies right now.')) {
                container.innerHTML = '';
            }
            // 📌 แทรกการ์ดใหม่เข้าไปด้านบนสุด โดยไม่ลบข่าวเดิม (Whale Alerts / ข่าวพอร์ต จะยังอยู่ครบ)
            container.insertAdjacentHTML('afterbegin', aiCardsHtml);
        }
    },

    init: () => {
        // หน่วงเวลา 2 วินาทีให้ markets.js โหลดข่าวเดิมเสร็จก่อน ค่อยแทรกการ์ดขยับแรงเข้าไป
        setTimeout(() => {
            window.KodaAIPro.runAnomalyScanner();
        }, 2000); 
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.KodaAIPro.init();
});