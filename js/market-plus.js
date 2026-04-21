// 🚀 KODA Market Plus Module (Phase 2 - TradingView Heatmap Integration)
window.KodaMarketPlus = {
    loadHeatmap: () => {
        const container = document.getElementById('tv-heatmap-container');
        if (!container) return;
        
        // ป้องกันการโหลดสคริปต์ซ้ำซ้อนถ้ามีกราฟอยู่แล้ว
        if (container.innerHTML !== '') return;

        // ดึง Widget จาก TradingView มาฝัง
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
        script.async = true;
        
        // ตั้งค่า Config ของ Heatmap (S&P 500, Dark Mode, ซ่อน Topbar เพื่อความคลีน)
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
        window.KodaMarketPlus.loadHeatmap();
    }
};

// 📌 ตรวจสอบและรันสคริปต์
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
