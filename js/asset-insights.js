// js/asset-insights.js (เวอร์ชันคลีนระบบต่อเข้ากล่อง KODA AI Summary ดั้งเดิม)

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = (urlParams.get('symbol') || 'TSLA').toUpperCase();
    
    if (symbol.includes(':') || symbol === 'XAUUSD') return;

    const fetchKodaAiSummary = async () => {
        const contentEl = document.getElementById('ai-company-content');
        const dateEl = document.getElementById('ai-summary-date');
        
        if (!contentEl) return;

        // แสดงสัญลักษณ์ Loading ระหว่างรอข้อมูลในตู้เดิม
        contentEl.innerHTML = `
            <div class="text-center py-6">
                <div class="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p class="text-slate-500 text-[10px] font-bold uppercase tracking-wider animate-pulse">KODA AI กำลังดึงข้อมูลและประมวลผลพื้นฐาน...</p>
            </div>
        `;

        try {
            const res = await fetch(`/api/get-stock-insights?symbol=${symbol}&_=${Date.now()}`);
            const result = await res.json();

            if (result && result.success && result.data) {
                const stockData = result.data;
                
                // ฉีดข้อมูลสรุปข้อเท็จจริงแบบ Data-driven ลงในกล่องเดิมที่มีอยู่แล้วในหน้าเว็บ
                contentEl.innerHTML = `
                    <p class="text-slate-300 text-sm leading-relaxed font-medium">
                        ${stockData.ai_summary || 'ไม่มีข้อมูลบทวิเคราะห์สรุปบริษัทนี้ในฐานข้อมูล'}
                    </p>
                `;
                
                // อัปเดตวันที่อัปข้อมูล
                if (dateEl && stockData.last_updated) {
                    const formattedDate = new Date(stockData.last_updated).toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: 'numeric'
                    });
                    dateEl.textContent = `Last updated: ${formattedDate}`;
                }
            } else {
                throw new Error("Pipeline structure mismatch");
            }
        } catch (e) {
            console.error("KODA AI Fetch error:", e);
            contentEl.innerHTML = `<p class="text-danger text-xs text-center font-bold py-4">เกิดข้อผิดพลาดในการเชื่อมต่อท่อข้อมูลสรุปบริษัท</p>`;
        }
    };

    // ผูกเหตุการณ์กดรีเฟรชกับปุ่มเดิมของหน้าตู้โครงสร้างหลัก
    document.getElementById('btn-refresh-summary')?.addEventListener('click', fetchKodaAiSummary);

    // สั่งให้โหลดตัวเลขบทสรุปทันทีเมื่อเปิดหน้าเว็บเข้ามา
    fetchKodaAiSummary();
});