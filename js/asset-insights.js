// js/asset-insights.js (เวอร์ชันปลอดภัย 100% ปิดตายลูปนรก)
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = (urlParams.get('symbol') || 'TSLA').toUpperCase();
    
    if (symbol.includes(':') || symbol === 'XAUUSD') return;

    const fetchKodaAiSummary = async () => {
        const contentEl = document.getElementById('ai-company-content');
        const dateEl = document.getElementById('ai-summary-date');
        
        if (!contentEl) return;

        contentEl.innerHTML = `
            <div class="text-center py-8">
                <div class="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p class="text-slate-500 text-[10px] font-bold uppercase tracking-wider animate-pulse">KODA Intelligence กำลังเจาะลึกปัจจัยพื้นฐาน...</p>
            </div>
        `;

        try {
            const res = await fetch(`/api/get-stock-insights?symbol=${symbol}&_=${Date.now()}`);
            const result = await res.json();

            if (result && result.success && result.data) {
                const stockData = result.data;
                
                contentEl.innerHTML = `
                    <div class="text-slate-300 text-sm leading-relaxed space-y-4 font-medium">
                        ${stockData.ai_summary || 'ไม่มีข้อมูลบทวิเคราะห์บริษัทนี้ในระบบ'}
                    </div>
                `;
                
                if (dateEl && stockData.last_updated) {
                    const formattedDate = new Date(stockData.last_updated).toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: 'numeric'
                    });
                    dateEl.textContent = `Last updated: ${formattedDate}`;
                }
            } else {
                throw new Error("Pipeline Error");
            }
        } catch (e) {
            console.error("KODA AI Fetch error:", e);
            contentEl.innerHTML = `<p class="text-danger text-xs text-center font-bold py-4">เกิดข้อผิดพลาดในการดึงข้อมูลระบบสรุปบริษัท</p>`;
        }
    };

    document.getElementById('btn-refresh-summary')?.addEventListener('click', fetchKodaAiSummary);
    fetchKodaAiSummary();
});