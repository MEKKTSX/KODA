// 🚀 KODA Market Plus Module (Phase 3 - Stable TradingView Integration & Accurate Scanner)
window.KodaMarketPlus = {
    injectTradingViewWidget: () => {
        const container = document.getElementById('tv-heatmap-container');
        if (!container) return;
        
        container.innerHTML = '';

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
        script.async = true;
        
        script.innerHTML = JSON.stringify({
          "exchanges": [],
          "dataSource": "SPX500",
          "grouping": "sector",
          "blockSize": "market_cap_basic",
          "blockColor": "change",
          "locale": "en",
          "symbolUrl": "",
          "colorTheme": "dark",
          "hasTopBar": false,
          "isTransparent": true,
          "saveImage": false,
          "backgroundColor": "rgba(0, 0, 0, 0)",
          "width": "100%",
          "height": "100%"
        });
        
        container.appendChild(script);
    },

    initDynamics: () => {
        window.KodaMarketPlus.injectTradingViewWidget();
        setInterval(() => {
            window.KodaMarketPlus.injectTradingViewWidget();
        }, 900000); 
    },

    // 🚀 เพิ่มสูตรคำนวณ RSI ที่แม่นยำระดับ TradingView
    calculateExactRSI: (closes, period = 14) => {
        if (closes.length < period + 1) return 50; 
        let gains = 0, losses = 0;
        
        // ชุดแรก
        for (let i = 1; i <= period; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }
        let avgGain = gains / period;
        let avgLoss = losses / period;
        
        // เกลี่ยค่า EMA
        for (let i = period + 1; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff >= 0) {
                avgGain = (avgGain * (period - 1) + diff) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) - diff) / period;
            }
        }
        
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    },

    // 🚀 ฟังก์ชันหลักสำหรับคัดกรองหุ้นตาม Filter (นำไปเรียกใช้ในหน้าหลัก)
    applyFilters: (stockData, candles) => {
        // ถ้าไม่ได้เลือก Filter อะไรเลย ให้ผ่านหมด
        if (!window.activeFilters || window.activeFilters.size === 0) return true;

        let pass = true;
        const currentPrice = stockData.currentPrice;
        const metrics = stockData.metrics || {}; 
        
        // 1. กรอง Technicals
        if (candles && candles.closes && candles.closes.length > 0) {
            if (window.activeFilters.has('rsi_overbought')) {
                const rsi = window.KodaMarketPlus.calculateExactRSI(candles.closes);
                if (rsi <= 70) pass = false;
            }
            if (window.activeFilters.has('rsi_oversold')) {
                const rsi = window.KodaMarketPlus.calculateExactRSI(candles.closes);
                if (rsi >= 35) pass = false;
            }
            if (window.activeFilters.has('vol_spike') && candles.volumes.length >= 21) {
                const lastVol = candles.volumes[candles.volumes.length - 1];
                const avgVol = candles.volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
                if (lastVol < avgVol * 2) pass = false;
            }
        } else {
            // ถ้าข้อมูลกราฟไม่มา ให้กรอง Technical ตกไปเลย
            if (window.activeFilters.has('rsi_overbought') || 
                window.activeFilters.has('rsi_oversold') || 
                window.activeFilters.has('vol_spike')) pass = false;
        }

        // 2. กรอง Fundamentals
        if (window.activeFilters.has('ath_drop_30')) {
            const high52 = metrics['52WeekHigh'] || currentPrice;
            const dropPct = ((high52 - currentPrice) / high52) * 100;
            if (dropPct <= 30) pass = false;
        }
        if (window.activeFilters.has('low_up_30')) {
            const low52 = metrics['52WeekLow'] || currentPrice;
            const upPct = ((currentPrice - low52) / low52) * 100;
            if (upPct <= 30) pass = false;
        }
        if (window.activeFilters.has('pe_below_15')) {
            const pe = metrics['peExclExtraTTM'] || 999;
            if (pe >= 15 || pe <= 0) pass = false;
        }

        return pass;
    }
};

const initMarketPlusApp = () => {
    if (document.getElementById('tv-heatmap-container')) {
        window.KodaMarketPlus.initDynamics();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMarketPlusApp);
} else {
    initMarketPlusApp(); 
}
