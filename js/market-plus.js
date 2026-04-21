// 🚀 KODA Market Plus Module (TradingView Heatmap - 30s Auto Refresh)
window.KodaMarketPlus = {
    injectTradingViewWidget: () => {
        const container = document.getElementById('tv-heatmap-container');
        if (!container) return;
        
        // ล้างกราฟเก่าทิ้งก่อน (ถ้ามี)
        container.innerHTML = '';

        // ดึง Widget จาก TradingView มาฝังใหม่
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
        // โหลดครั้งแรกทันทีที่เปิดหน้าเว็บ
        window.KodaMarketPlus.injectTradingViewWidget();

        // 📌 บังคับรีเฟรชกราฟทุกๆ 30 วินาที (30000 ms)
        setInterval(() => {
            window.KodaMarketPlus.injectTradingViewWidget();
        }, 30000); 
    }
};

// 📌 ตรวจสอบและรันสคริปต์เมื่อโหลดหน้าเว็บเสร็จ
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
