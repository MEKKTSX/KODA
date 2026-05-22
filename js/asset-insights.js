// js/asset-insights.js (เวอร์ชัน Fast Cache & Unified Backend)

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = (urlParams.get('symbol') || 'TSLA').toUpperCase();
    
    if (symbol.includes(':') || symbol === 'XAUUSD') return;

    // เก็บข้อมูลหุ้นไว้ที่ตัวแปร Global ของหน้าต่างเพื่อให้ง่ายต่อการเรียกใช้ใน Modal ต่างๆ
    window.kodaStockInsightsData = null;

    // ==========================================
    // 📌 1. โครงสร้าง UI (คงเดิมตาม Design ของคุณ)
    // ==========================================
    const buildInsightsUI = () => {
        if (document.getElementById('section-asset-insights')) return;

        const insightsSection = document.createElement('section');
        insightsSection.id = 'section-asset-insights';
        insightsSection.className = 'px-4 pt-6 space-y-4';
        
        insightsSection.innerHTML = `
            <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-primary text-xl">psychology</span>
                <h3 class="text-slate-100 text-lg font-bold tracking-tight">Deep Intelligence</h3>
            </div>

            <div class="bg-surface-dark border border-border-dark rounded-2xl p-4 shadow-xl overflow-hidden relative group">
                <div class="flex items-center justify-between mb-5">
                    <h4 class="text-white text-sm font-bold flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-[18px]">account_tree</span> Business Ecosystem
                    </h4>
                    <button id="btn-refresh-eco" class="size-8 flex items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-white active:scale-90 transition-all duration-300">
                        <span class="material-symbols-outlined text-[18px]">sync</span>
                    </button>
                </div>
                <div id="ecosystem-container" class="min-h-[160px] flex flex-col justify-center transition-all duration-500">
                    <div class="text-center py-8">
                        <div class="size-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p class="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">Checking Data...</p>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div class="bg-surface-dark border border-border-dark rounded-2xl p-4 shadow-lg flex flex-col justify-between relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full bg-danger/50"></div>
                    <h4 class="text-slate-400 text-[10px] font-black flex items-center gap-1 uppercase tracking-widest">Short Interest</h4>
                    <div class="text-center my-3"><span class="text-3xl font-black text-white tracking-tighter" id="short-value">--</span><span class="text-slate-500 text-xs font-bold">%</span></div>
                    <div>
                        <div class="w-full bg-background-dark/50 rounded-full h-1.5 mb-2 overflow-hidden flex border border-border-dark"><div id="short-bar" class="bg-primary h-full rounded-full transition-all duration-1000" style="width: 0%"></div></div>
                        <p id="short-label" class="text-[9px] font-bold text-center text-slate-500 uppercase tracking-tighter">Scanning Float...</p>
                    </div>
                </div>

                <div class="bg-surface-dark border border-border-dark rounded-2xl p-4 shadow-lg flex flex-col justify-between relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full bg-success/50"></div>
                    <h4 class="text-slate-400 text-[10px] font-black flex items-center gap-1 uppercase tracking-widest">Earnings AI</h4>
                    <div class="text-center my-2" id="earn-ai-icon"><span class="material-symbols-outlined text-4xl text-slate-700 animate-pulse">analytics</span></div>
                    <p id="earn-ai-status" class="text-[10px] font-bold text-center text-slate-500 mt-1 leading-tight">Gathering...</p>
                </div>
            </div>
            
            <div class="bg-surface-dark border border-border-dark rounded-2xl p-4 shadow-xl mt-4 group">
                <div class="flex items-center justify-between mb-5">
                    <h4 class="text-white text-sm font-bold flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-[18px]">dashboard_customize</span> Strategy Canvas
                    </h4>
                    <button id="btn-refresh-bmc" class="size-8 flex items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-white active:scale-90 transition-all duration-300">
                        <span class="material-symbols-outlined text-[18px]">sync</span>
                    </button>
                </div>
                <div id="bmc-container" class="grid grid-cols-2 gap-2.5 transition-all duration-500">
                    <div class="col-span-2 text-center py-10">
                        <div class="size-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p class="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">Checking Data...</p>
                    </div>
                </div>
            </div>
        `;

        const mainEl = document.querySelector('main');
        const newsSection = document.getElementById('stock-news-container')?.closest('section');
        if (mainEl && newsSection) mainEl.insertBefore(insightsSection, newsSection);
        else if (mainEl) mainEl.appendChild(insightsSection);

        // ระบบติดตั้ง Modal สำหรับรับชมรายละเอียด BMC
        if (!document.getElementById('modal-bmc-detail')) {
            const bmcModalHTML = `
            <div id="modal-bmc-detail" class="fixed inset-0 z-[110] hidden items-center justify-center bg-background-dark/95 backdrop-blur-md transition-all duration-300 opacity-0 pb-10">
                <div class="bg-surface-dark border border-border-dark w-[90%] max-w-sm rounded-3xl flex flex-col shadow-2xl transform scale-95 transition-all duration-300" id="modal-bmc-content">
                    <div class="flex items-center justify-between p-5 border-b border-border-dark shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="size-8 rounded-xl bg-primary/20 flex items-center justify-center">
                                <span id="bmc-modal-icon" class="material-symbols-outlined text-primary text-[20px]">psychology</span>
                            </div>
                            <h3 id="bmc-modal-title" class="text-white font-bold text-sm uppercase tracking-widest">Detail</h3>
                        </div>
                        <button id="btn-close-bmc" class="text-slate-400 hover:text-white bg-slate-800 size-8 rounded-full flex items-center justify-center active:scale-75 transition-all"><span class="material-symbols-outlined text-[18px]">close</span></button>
                    </div>
                    <div class="p-6 text-slate-300 text-sm leading-relaxed font-medium bg-background-dark/20 rounded-b-3xl max-h-[60vh] overflow-y-auto no-scrollbar" id="bmc-modal-body"></div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', bmcModalHTML);
            document.getElementById('btn-close-bmc').addEventListener('click', closeBMCModal);
            document.getElementById('modal-bmc-detail').addEventListener('click', (e) => { if (e.target.id === 'modal-bmc-detail') closeBMCModal(); });
        }
    };

    const closeBMCModal = () => {
        const modal = document.getElementById('modal-bmc-detail');
        const modalContent = document.getElementById('modal-bmc-content');
        modal.classList.add('opacity-0'); modalContent.classList.add('scale-95');
        setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 200);
    };

    // ==========================================
    // 📌 2. ฟังก์ชันเรนเดอร์เนื้อหา (Render Engines)
    // ==========================================
    const renderEcosystemGrid = (data) => {
        const container = document.getElementById('ecosystem-container');
        if (!container || !data || !data.branches) return;
        const colors = ['text-success', 'text-orange-400', 'text-primary', 'text-purple-400', 'text-pink-400'];
        
        const branchesHtml = data.branches.map((branch, idx) => {
            const colorCls = colors[idx % colors.length];
            const itemsHtml = (branch.items || []).map(item => `<span class="text-[10px] text-slate-400 bg-background-dark border border-border-dark/50 px-2.5 py-1 rounded-lg shadow-inner font-medium">${item}</span>`).join('');
            return `<div class="relative pl-6 mb-5"><div class="absolute left-0 top-3 w-4 h-[1px] bg-border-dark"></div><div class="bg-surface-dark border border-border-dark px-3 py-1.5 rounded-xl inline-block text-[11px] font-black uppercase tracking-wider ${colorCls} mb-2.5 shadow-sm">${branch.name}</div><div class="flex flex-wrap gap-2">${itemsHtml}</div></div>`;
        }).join('');
        
        container.innerHTML = `<div class="pl-1"><div class="bg-primary/10 border border-primary/30 text-primary font-black px-4 py-2.5 rounded-2xl inline-flex items-center gap-2 mb-6 shadow-lg shadow-primary/5 uppercase text-xs tracking-widest"><span class="material-symbols-outlined text-[18px]">domain</span>${data.company || symbol}</div><div class="border-l border-border-dark ml-3 relative">${branchesHtml}</div></div>`;
    };

    const bmcConfig = [
        { id: 'vp', icon: 'diamond', title: 'Value', color: 'text-success', bg: 'bg-success/10', border: 'border-success/30' },
        { id: 'cs', icon: 'groups', title: 'Clients', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
        { id: 'ch', icon: 'hub', title: 'Channels', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' },
        { id: 'rs', icon: 'payments', title: 'Revenue', color: 'text-success', bg: 'bg-success/10', border: 'border-success/30' },
        { id: 'kr', icon: 'inventory_2', title: 'Resource', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
        { id: 'ka', icon: 'bolt', title: 'Activity', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
        { id: 'cr', icon: 'support_agent', title: 'Relations', color: 'text-pink-400', bg: 'bg-pink-400/10', border: 'border-pink-400/30' },
        { id: 'kp', icon: 'handshake', title: 'Partners', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' },
        { id: 'cs_cost', icon: 'account_balance_wallet', title: 'Costs', color: 'text-slate-300', bg: 'bg-slate-700/30', border: 'border-slate-500/30' }
    ];

    const renderBMCGrid = (bmcData) => {
        const container = document.getElementById('bmc-container');
        if (!container || !bmcData) return;
        container.innerHTML = bmcConfig.map(b => `<div onclick="window.openBMCModal('${b.id}')" class="flex flex-col items-center justify-center p-3 rounded-2xl border ${b.border} ${b.bg} cursor-pointer active:scale-90 transition-all duration-300 hover:bg-slate-800 group"><span class="material-symbols-outlined ${b.color} mb-1.5 text-[22px] group-hover:scale-110 transition-transform">${b.icon}</span><p class="text-white font-black text-[9px] uppercase tracking-widest">${b.title}</p></div>`).join('');
    };

    window.openBMCModal = (id) => {
        const item = bmcConfig.find(b => b.id === id);
        const bmcData = window.kodaStockInsightsData?.bmc;
        
        if (item && bmcData && bmcData[id]) {
            document.getElementById('bmc-modal-title').textContent = item.title + " Strategy";
            document.getElementById('bmc-modal-title').className = `font-black text-xs uppercase tracking-widest ${item.color}`;
            document.getElementById('bmc-modal-icon').className = `material-symbols-outlined ${item.color}`;
            
            const list = bmcData[id];
            document.getElementById('bmc-modal-body').innerHTML = `<div class="space-y-4">${(Array.isArray(list) ? list : [list]).map(t => `<div class="flex gap-3"><span class="size-1.5 rounded-full ${item.bg.replace('/10', '')} shrink-0 mt-1.5 shadow-lg"></span><p class="text-slate-200 text-sm font-medium leading-relaxed">${t}</p></div>`).join('')}</div>`;
            
            const modal = document.getElementById('modal-bmc-detail');
            const modalContent = document.getElementById('modal-bmc-content');
            modal.classList.remove('hidden'); modal.classList.add('flex');
            setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);
        }
    };

    const renderShort = (shortVal) => {
        const valEl = document.getElementById('short-value');
        const barEl = document.getElementById('short-bar');
        const labelEl = document.getElementById('short-label');
        if (!valEl || !barEl || !labelEl || shortVal === undefined) return;

        valEl.textContent = shortVal.toFixed(2);
        barEl.style.width = `${Math.min(100, shortVal * 3)}%`; 
        if (shortVal > 20) { barEl.className = 'bg-danger h-full rounded-full transition-all'; labelEl.innerHTML = `<span class="text-danger font-black">HIGH SQUEEZE RISK</span>`; }
        else if (shortVal > 10) { barEl.className = 'bg-orange-500 h-full rounded-full transition-all'; labelEl.innerHTML = `<span class="text-orange-500 font-bold">Elevated Shorting</span>`; }
        else { barEl.className = 'bg-primary h-full rounded-full transition-all'; labelEl.innerHTML = `<span class="text-primary font-bold">Normal Levels</span>`; }
    };

    const renderEarnings = (status) => {
        const iconEl = document.getElementById('earn-ai-icon');
        const statusEl = document.getElementById('earn-ai-status');
        if (!iconEl || !statusEl) return;

        if (status === 'BULLISH') {
            iconEl.innerHTML = `<span class="material-symbols-outlined text-4xl text-success drop-shadow-[0_0_10px_rgba(0,192,118,0.5)]">rocket_launch</span>`; 
            statusEl.innerHTML = `<span class="text-success font-black">BULLISH SURPRISE</span><br><span class="text-[9px] text-slate-400">Beat earnings consensus.</span>`;
        } else if (status === 'NEUTRAL') {
            iconEl.innerHTML = `<span class="material-symbols-outlined text-4xl text-primary">balance</span>`; 
            statusEl.innerHTML = `<span class="text-primary font-black">STABLE OUTLOOK</span><br><span class="text-[9px] text-slate-400">Performing as expected.</span>`;
        } else {
            iconEl.innerHTML = `<span class="material-symbols-outlined text-4xl text-danger">warning</span>`; 
            statusEl.innerHTML = `<span class="text-danger font-black">BEARISH RISK</span><br><span class="text-[9px] text-slate-400">Missed expectations.</span>`;
        }
    };

    // ==========================================
    // 📌 3. ท่อรวมดึงข้อมูลหมัดเดียวจบ (Unified Pipeline Fetcher)
    // ==========================================
    const fetchAllStockInsights = async () => {
        buildInsightsUI();

        try {
            // ดึงข้อมูลเบ็ดเสร็จจาก Endpoint หลังบ้านก้อนเดียวจบ
            const res = await fetch(`/api/get-stock-insights?symbol=${symbol}&_=${Date.now()}`);
            const result = await res.json();

            if (result && result.success && result.data) {
                const stockData = result.data;
                
                // ตรึงข้อมูลเข้าตัวแปร Global ไว้แจกจ่ายให้ระบบ Modal นำไปใช้ต่อ
                window.kodaStockInsightsData = stockData;

                // สั่งประมวลผลวาด UI ทั้งหมดพร้อมกันจากก้อนข้อมูลก้อนเดียวทันที
                renderEcosystemGrid(stockData.ecosystem);
                renderBMCGrid(stockData.bmc);
                renderShort(stockData.short_interest);
                renderEarnings(stockData.earnings_status);
            } else {
                throw new Error("Pipeline data layout mismatch");
            }
        } catch (e) {
            console.error("KODA Pipeline error:", e);
            document.getElementById('ecosystem-container').innerHTML = `<p class="text-danger text-xs text-center font-bold py-6">Failed to load asset intelligence.</p>`;
        }
    };

    // ปุ่มกดรีเฟรชข้อมูล (ให้ยิงโหลดใหม่ตามกระบวนการปกติ)
    document.getElementById('btn-refresh-eco')?.addEventListener('click', fetchAllStockInsights);
    document.getElementById('btn-refresh-bmc')?.addEventListener('click', fetchAllStockInsights);

    // เปิดหน้าจอมาให้เครื่องยนต์เริ่มทำงานทันที
    fetchAllStockInsights();
});