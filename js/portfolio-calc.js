document.addEventListener('DOMContentLoaded', () => {
    
    let equityChartInstance = null;
    let currentSortMode = localStorage.getItem('koda_sort_mode') || 'profit-high'; 
    let isWhatIfMode = false; 
    let selectedWhatIfAsset = null; 

    // ดึง Cash มาด้วย ถ้าไม่มีให้เป็น 0
    const loadData = () => {
        let data = JSON.parse(localStorage.getItem('koda_portfolio_data') || '{"holdings":[], "cash": 0}');
        if (typeof data.cash === 'undefined') data.cash = 0;
        return data;
    };
    
    const saveData = (data) => {
        data.lastUpdated = Date.now(); 
        localStorage.setItem('koda_portfolio_data', JSON.stringify(data));
        window.dispatchEvent(new Event('storage'));
        document.dispatchEvent(new Event('portfolioUpdated'));
    };
        // ==========================================
    // 📌 ระบบ Manage Cash UI Modal
    // ==========================================
    const modalCash = document.getElementById('modal-manage-cash');
    const modalCashContent = document.getElementById('modal-manage-cash-content');
    const cashModeInput = document.getElementById('cash-mode');
    const tabDeposit = document.getElementById('tab-deposit');
    const tabWithdraw = document.getElementById('tab-withdraw');
    const cashLabel = document.getElementById('cash-label');
    const cashAmount = document.getElementById('cash-amount');
    const btnSubmitCash = document.getElementById('btn-submit-cash');
    const cashIconTitle = document.getElementById('cash-icon-title');

    // เปิด Modal Manage Cash
    document.getElementById('btn-manage-cash')?.addEventListener('click', () => {
        cashAmount.value = ''; 
        modalCash.classList.remove('hidden'); 
        modalCash.classList.add('flex');
        setTimeout(() => { 
            modalCash.classList.remove('opacity-0'); 
            modalCashContent.classList.remove('translate-y-full'); 
        }, 10);
    });

    // ปิด Modal Manage Cash
    document.getElementById('btn-close-cash-modal')?.addEventListener('click', () => {
        modalCash.classList.add('opacity-0'); 
        modalCashContent.classList.add('translate-y-full');
        setTimeout(() => { 
            modalCash.classList.add('hidden'); 
            modalCash.classList.remove('flex'); 
        }, 300);
    });

    // กดปุ่ม Deposit
    tabDeposit?.addEventListener('click', () => {
        cashModeInput.value = 'deposit';
        tabDeposit.className = 'flex-1 text-xs font-bold py-2.5 rounded-lg bg-success text-white transition-all shadow-md';
        tabWithdraw.className = 'flex-1 text-xs font-bold py-2.5 rounded-lg text-slate-500 hover:text-white transition-all';
        cashLabel.textContent = 'Deposit Amount ($)';
        cashLabel.className = 'text-xs text-success font-bold uppercase tracking-wider transition-colors';
        cashAmount.className = 'w-full bg-background-dark border border-border-dark focus:border-success focus:ring-1 focus:ring-success rounded-xl px-4 py-3 text-white mt-1.5 font-bold outline-none transition-colors';
        btnSubmitCash.textContent = 'Confirm Deposit';
        btnSubmitCash.className = 'w-full bg-success text-white font-bold rounded-xl py-3.5 mt-2 hover:bg-green-500 shadow-lg shadow-success/30 transition-colors text-lg';
        cashIconTitle.className = 'material-symbols-outlined text-success';
    });

    // กดปุ่ม Withdraw
    tabWithdraw?.addEventListener('click', () => {
        cashModeInput.value = 'withdraw';
        tabWithdraw.className = 'flex-1 text-xs font-bold py-2.5 rounded-lg bg-danger text-white transition-all shadow-md';
        tabDeposit.className = 'flex-1 text-xs font-bold py-2.5 rounded-lg text-slate-500 hover:text-white transition-all';
        cashLabel.textContent = 'Withdraw Amount ($)';
        cashLabel.className = 'text-xs text-danger font-bold uppercase tracking-wider transition-colors';
        cashAmount.className = 'w-full bg-background-dark border border-border-dark focus:border-danger focus:ring-1 focus:ring-danger rounded-xl px-4 py-3 text-white mt-1.5 font-bold outline-none transition-colors';
        btnSubmitCash.textContent = 'Confirm Withdraw';
        btnSubmitCash.className = 'w-full bg-danger text-white font-bold rounded-xl py-3.5 mt-2 hover:bg-red-500 shadow-lg shadow-danger/30 transition-colors text-lg';
        cashIconTitle.className = 'material-symbols-outlined text-danger';
    });

    // บันทึกเงินฝาก/ถอน ลง Data
    document.getElementById('manage-cash-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const amt = parseFloat(cashAmount.value);
        if (isNaN(amt) || amt <= 0) return;

        const data = loadData();
        const mode = cashModeInput.value;

        if (mode === 'deposit') {
            data.cash += amt;
        } else if (mode === 'withdraw') {
            if (amt > data.cash) {
                alert('Warning: ถอนยอดเงินสดมากกว่าที่มีอยู่ (ระบบอนุญาตให้ติดลบได้)');
            }
            data.cash -= amt;
        }

        saveData(data);
        updateUI();
        document.getElementById('btn-close-cash-modal').click();
    });


    // --- 2. Equity Curve History Builder ---
    const updateEquityHistory = (currentTotal) => {
        let history = JSON.parse(localStorage.getItem('koda_equity_history') || '[]');
        const today = new Date().toISOString().split('T')[0];

        if (currentTotal === 0 || (history.length > 0 && Math.abs(history[history.length-1].value - currentTotal) > 20000)) {
            history = []; 
        }

        if (history.length <= 1 && currentTotal > 0) {
            history = []; 
            for (let i = 7; i > 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                history.push({ date: d.toISOString().split('T')[0], value: 0 });
            }
            history.push({ date: today, value: currentTotal });
        } else if (currentTotal > 0) {
            const existingTodayIndex = history.findIndex(h => h.date === today);
            if (existingTodayIndex >= 0) {
                history[existingTodayIndex].value = currentTotal;
            } else {
                history.push({ date: today, value: currentTotal });
            }
        }

        if (history.length > 30) history = history.slice(history.length - 30);
        localStorage.setItem('koda_equity_history', JSON.stringify(history));
        
        if (history.length === 0) {
            return [
                { date: new Date(Date.now() - 86400000).toISOString().split('T')[0], value: 0 },
                { date: today, value: 0 }
            ];
        }
        return history;
    };

    const renderEquityChart = (historyData) => {
        const ctx = document.getElementById('equity-chart');
        if (!ctx) return;

        const labels = historyData.map(h => new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        const isTHB = localStorage.getItem('koda_currency') === 'THB';
        const rate = window.kodaTHBRate || 34.50;
        
        const dataPts = historyData.map(h => isTHB ? h.value * rate : h.value); 

        const firstVal = dataPts[0] || 0;
        const lastVal = dataPts[dataPts.length - 1] || 0;
        const isUp = lastVal >= firstVal;
        const colorLine = isUp ? '#00c076' : '#ff4d4d'; 
        const colorGlow = isUp ? 'rgba(0, 192, 118, 0.15)' : 'rgba(255, 77, 77, 0.15)';

        if (equityChartInstance) {
            equityChartInstance.data.labels = labels;
            equityChartInstance.data.datasets[0].data = dataPts;
            equityChartInstance.data.datasets[0].borderColor = colorLine;
            equityChartInstance.data.datasets[0].backgroundColor = (context) => {
                const chartCtx = context.chart.ctx;
                const gradient = chartCtx.createLinearGradient(0, 0, 0, 140);
                gradient.addColorStop(0, colorGlow); gradient.addColorStop(1, 'rgba(10, 14, 23, 0)');
                return gradient;
            };
            equityChartInstance.update();
            return;
        }

        equityChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: dataPts, borderColor: colorLine, borderWidth: 2.5,
                    pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#ffffff',
                    tension: 0.3, fill: true,
                    backgroundColor: (context) => {
                        const chartCtx = context.chart.ctx;
                        const gradient = chartCtx.createLinearGradient(0, 0, 0, 140);
                        gradient.addColorStop(0, colorGlow); gradient.addColorStop(1, 'rgba(10, 14, 23, 0)');
                        return gradient;
                    }
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false }, 
                    tooltip: {
                        backgroundColor: '#161c2b', titleColor: '#94a3b8', bodyColor: '#ffffff',
                        bodyFont: { weight: 'bold', size: 14 }, padding: 10, displayColors: false,
                        callbacks: { 
                            label: (ctx) => {
                                const rawVal = isTHB ? ctx.raw / rate : ctx.raw;
                                return window.formatKodaMoney ? window.formatKodaMoney(rawVal) : `$${rawVal.toFixed(2)}`;
                            }
                        }
                    } 
                },
                scales: { x: { display: false }, y: { display: false, min: Math.min(...dataPts) * 0.98 } },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    };

    const updateUI = () => {
        const data = loadData();
        let holdings = data.holdings || [];
        
        let cash = data.cash || 0; 
        let totalValue = cash; // Total Value เอา Cash ตั้งไว้ก่อน
        let totalCost = 0;

        holdings.forEach(h => {
            h.calculatedPrice = h.currentPrice || h.avgCost;
            h.calculatedValue = h.shares * h.calculatedPrice;
            h.calculatedCost = h.shares * h.avgCost;
            h.calculatedProfit = h.calculatedValue - h.calculatedCost;
            h.dailyUpside = h.previousClose ? ((h.calculatedPrice - h.previousClose) / h.previousClose) * 100 : 0;
            h.calculatedProfitPct = h.calculatedCost > 0 ? (h.calculatedProfit / h.calculatedCost) * 100 : 0;
            
            totalValue += h.calculatedValue; // เอามูลค่าหุ้นบวกเข้าไป
            totalCost += h.calculatedCost;
        });

        holdings.sort((a, b) => {
            if (currentSortMode === 'profit-high') return b.calculatedProfit - a.calculatedProfit;
            if (currentSortMode === 'profit-low') return a.calculatedProfit - b.calculatedProfit;
            if (currentSortMode === 'shares-high') return b.shares - a.shares;
            if (currentSortMode === 'upside-high') return b.dailyUpside - a.dailyUpside;
            return 0;
        });

        const container = document.getElementById('portfolio-container');
        let html = '';

        if (holdings.length === 0) {
            html = `<div class="flex flex-col items-center justify-center py-16 border border-dashed border-border-dark rounded-2xl bg-surface-dark/30">
                        <span class="material-symbols-outlined text-4xl text-slate-600 mb-2">add_business</span>
                        <p class="text-slate-400 text-sm font-medium">Your portfolio is empty.</p>
                    </div>`;
        } else {
            holdings.forEach((h) => {
                const realIndex = data.holdings.findIndex(item => item.symbol === h.symbol);

                const isUp = h.calculatedProfit >= 0;
                const colorCls = isUp ? 'text-success' : 'text-danger';
                const icon = isUp ? 'trending_up' : 'trending_down';
                const todayIsUp = h.dailyUpside >= 0;
                const todayColorCls = todayIsUp ? 'text-success' : 'text-danger';
                const logo1 = `https://assets.parqet.com/logos/symbol/${h.symbol}?format=png`;
                let logo2 = `https://financialmodelingprep.com/image-stock/${h.symbol.split(':')[1] || h.symbol.split('.')[0]}.png`;
                if(h.symbol.includes('BINANCE:')) logo2 = `https://financialmodelingprep.com/image-stock/${h.symbol.replace('BINANCE:','').replace('USDT','')}.png`;

                html += `
                <div class="bg-surface-dark border border-border-dark rounded-2xl p-4 flex items-center justify-between hover:bg-slate-800 transition-colors shadow-sm">
                    <a href="stock-detail.html?symbol=${h.symbol}" class="flex items-center gap-3 flex-1 min-w-0">
                        <div class="size-11 rounded-full bg-slate-800 border border-border-dark flex items-center justify-center overflow-hidden relative shrink-0 shadow-inner">
                            <span class="text-white font-bold text-[10px] absolute">${h.symbol.substring(0,2)}</span>
                            <img src="${logo1}" class="w-full h-full object-cover relative z-10 bg-surface-dark" onerror="this.onerror=null; this.src='${logo2}'; this.onerror=function(){this.style.display='none'};">
                        </div>
                        <div class="truncate pr-2">
                            <h3 class="text-white font-bold text-base leading-tight truncate">${h.symbol}</h3>
                            <p class="text-slate-400 text-[11px] mt-0.5 font-medium">${h.shares} sh <span class="text-slate-600">@</span> $${h.avgCost.toFixed(2)}</p>
                        </div>
                    </a>
                    <div class="text-right shrink-0">
                        <p class="text-white font-bold text-base leading-tight">$${h.calculatedValue.toFixed(2)}</p>
                        <p class="${colorCls} text-[11px] font-bold flex items-center justify-end gap-0.5 mt-1 bg-background-dark py-0.5 px-1.5 rounded-md border border-border-dark/50">
                            <span class="material-symbols-outlined text-[12px]">${icon}</span>
                            ${isUp ? '+' : ''}${window.formatKodaMoney ? window.formatKodaMoney(Math.abs(h.calculatedProfit)) : `$${Math.abs(h.calculatedProfit)}`} (${Math.abs(h.calculatedProfitPct).toFixed(2)}%)
                        </p>
                        <p class="${todayColorCls} text-[9px] font-bold text-right mt-1 tracking-wider uppercase">
                            Today: ${todayIsUp ? '+' : ''}${h.dailyUpside.toFixed(2)}%
                        </p>
                    </div>
                    <button class="ml-3 p-2 bg-danger/10 text-danger rounded-xl hover:bg-danger hover:text-white transition-colors border border-danger/20 btn-sell-trigger" data-index="${realIndex}" data-symbol="${h.symbol}" data-shares="${h.shares}" data-price="${h.calculatedPrice}">
                        <span class="material-symbols-outlined text-[18px]">sell</span>
                    </button>
                </div>`;
            });
        }

        container.innerHTML = html;

        const portTotalValEl = document.getElementById('port-total-val');
        const portCashValEl = document.getElementById('port-cash-val'); 
        const portUnrealizedValEl = document.getElementById('port-unrealized-val');
        if (portTotalValEl) portTotalValEl.textContent = window.formatKodaMoney ? window.formatKodaMoney(totalValue) : `$${totalValue.toFixed(2)}`;
        if (portCashValEl) portCashValEl.textContent = window.formatKodaMoney ? window.formatKodaMoney(cash) : `$${cash.toFixed(2)}`; // อัพเดทยอด Cash ลง UI
        document.getElementById('position-count').textContent = holdings.length;

        if (portUnrealizedValEl) {
            const totalProfit = (totalValue - cash) - totalCost; // กำไรคิดจากมูลค่าหุ้นเพียวๆ
            const totalProfitPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
            const isTotalUp = totalProfit >= 0;
            portUnrealizedValEl.innerHTML = `<span class="material-symbols-outlined text-[16px]">${isTotalUp ? 'trending_up' : 'trending_down'}</span> ${isTotalUp ? '+' : ''}${window.formatKodaMoney ? window.formatKodaMoney(Math.abs(totalProfit)) : `$${Math.abs(totalProfit)}`} (${totalProfitPct.toFixed(2)}%) All Time`;
            portUnrealizedValEl.className = `text-sm font-bold flex items-center gap-1 mt-1 ${isTotalUp ? 'text-success' : 'text-danger'}`;
        }

        if (totalValue > 0 && !isWhatIfMode) {
            renderEquityChart(updateEquityHistory(totalValue));
        } else if (totalValue === 0) {
            renderEquityChart([{date: new Date().toISOString().split('T')[0], value: 0}]);
        }

        document.querySelectorAll('.btn-sell-trigger').forEach(btn => {
            btn.addEventListener('click', (e) => { e.preventDefault(); openSellModal(btn.getAttribute('data-index'), btn.getAttribute('data-symbol'), btn.getAttribute('data-shares'), btn.getAttribute('data-price')); });
        });
    };

    const sortBtn = document.getElementById('sort-btn');
    const sortMenu = document.getElementById('sort-menu');
    const sortLabel = document.getElementById('sort-label');
    const sortOptions = document.querySelectorAll('.sort-option');

    if (sortOptions.length > 0 && sortLabel) {
        sortOptions.forEach(opt => {
            if (opt.getAttribute('data-val') === currentSortMode) {
                sortLabel.textContent = opt.getAttribute('data-label');
                opt.querySelector('.material-symbols-outlined').classList.remove('hidden');
            } else opt.querySelector('.material-symbols-outlined').classList.add('hidden');
        });
    }

    sortBtn?.addEventListener('click', (e) => { e.stopPropagation(); sortMenu.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => {
        if (sortBtn && !sortBtn.contains(e.target) && sortMenu && !sortMenu.contains(e.target)) sortMenu.classList.add('hidden');
        const wiBtn = document.getElementById('whatif-asset-btn');
        const wiMenu = document.getElementById('whatif-asset-menu');
        if (wiBtn && !wiBtn.contains(e.target) && wiMenu && !wiMenu.contains(e.target)) wiMenu.classList.add('hidden');
    });

    sortOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            currentSortMode = opt.getAttribute('data-val'); sortLabel.textContent = opt.getAttribute('data-label');
            sortMenu.classList.add('hidden'); sortOptions.forEach(o => o.querySelector('.material-symbols-outlined').classList.add('hidden'));
            opt.querySelector('.material-symbols-outlined').classList.remove('hidden');
            localStorage.setItem('koda_sort_mode', currentSortMode); updateUI(); 
        });
    });

    const modalWhatIf = document.getElementById('modal-whatif');
    const modalWhatIfContent = document.getElementById('modal-whatif-content');
    const whatIfAssetBtn = document.getElementById('whatif-asset-btn');
    const whatIfAssetMenu = document.getElementById('whatif-asset-menu');
    
    //whatIfAssetBtn?.addEventListener('click', (e) => { e.stopPropagation(); whatIfAssetMenu.classList.toggle('hidden'); });
    document.getElementById('mode-whatif')?.addEventListener('click', () => {
        const holdings = loadData().holdings || [];
        if (holdings.length === 0) { alert("Your portfolio is empty."); return; }
        whatIfAssetMenu.innerHTML = '';
        holdings.forEach(h => {
            const item = document.createElement('div');
            item.className = 'px-4 py-3 border-b border-border-dark/50 hover:bg-slate-800 cursor-pointer text-white font-bold text-sm transition-colors flex justify-between items-center';
            item.innerHTML = `<span>${h.symbol}</span> <span class="text-slate-500 text-[10px] font-normal bg-background-dark px-2 py-0.5 rounded border border-border-dark">${h.shares} sh</span>`;
            item.addEventListener('click', () => {
                document.getElementById('whatif-asset-label').textContent = `${h.symbol} (${h.shares} sh)`;
                document.getElementById('whatif-asset-label').classList.remove('text-slate-400');
                whatIfAssetMenu.classList.add('hidden');
                selectedWhatIfAsset = { symbol: h.symbol, shares: h.shares, cost: h.avgCost };
                document.getElementById('whatif-avg-cost').value = `$${h.avgCost.toFixed(2)}`;
                const asset = loadData().holdings.find(a => a.symbol === h.symbol);
                if(asset && asset.currentPrice) document.getElementById('whatif-target').value = asset.currentPrice;
                calculateWhatIf();
            });
            whatIfAssetMenu.appendChild(item);
        });
        modalWhatIf.classList.remove('hidden'); modalWhatIf.classList.add('flex');
        setTimeout(() => { modalWhatIf.classList.remove('opacity-0'); modalWhatIfContent.classList.remove('translate-y-full'); }, 10);
    });

    document.getElementById('btn-close-whatif')?.addEventListener('click', () => {
        modalWhatIf.classList.add('opacity-0'); modalWhatIfContent.classList.add('translate-y-full');
        setTimeout(() => { modalWhatIf.classList.add('hidden'); modalWhatIf.classList.remove('flex'); }, 300);
    });

    const calculateWhatIf = () => {
        if (!selectedWhatIfAsset || !document.getElementById('whatif-target').value) return;
        const profit = (selectedWhatIfAsset.shares * parseFloat(document.getElementById('whatif-target').value)) - (selectedWhatIfAsset.shares * selectedWhatIfAsset.cost);
        const profitPct = (selectedWhatIfAsset.shares * selectedWhatIfAsset.cost) > 0 ? (profit / (selectedWhatIfAsset.shares * selectedWhatIfAsset.cost)) * 100 : 0;
        const isUp = profit >= 0;
        document.getElementById('whatif-result').textContent = `${isUp ? '+' : ''}${window.formatKodaMoney ? window.formatKodaMoney(Math.abs(profit)) : `$${Math.abs(profit)}`}`;
        document.getElementById('whatif-result').className = `text-3xl font-black text-center transition-colors ${isUp ? 'text-success' : 'text-danger'}`;
        document.getElementById('whatif-result-pct').textContent = `${isUp ? '+' : ''}${profitPct.toFixed(2)}%`;
        document.getElementById('whatif-result-pct').className = `text-center text-sm font-bold mt-1 ${isUp ? 'text-success/80' : 'text-danger/80'}`;
    };
    document.getElementById('whatif-target').addEventListener('input', calculateWhatIf);

    const modalAdd = document.getElementById('modal-add-stock');
    const modalAddContent = document.getElementById('modal-content');
    document.getElementById('btn-open-add-stock')?.addEventListener('click', () => { modalAdd.classList.remove('hidden'); modalAdd.classList.add('flex'); setTimeout(() => { modalAdd.classList.remove('opacity-0'); modalAddContent.classList.remove('translate-y-full'); }, 10); });
    document.getElementById('btn-close-modal')?.addEventListener('click', () => { modalAdd.classList.add('opacity-0'); modalAddContent.classList.add('translate-y-full'); setTimeout(() => { modalAdd.classList.add('hidden'); modalAdd.classList.remove('flex'); }, 300); });

    document.getElementById('add-stock-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const sym = document.getElementById('add-symbol').value.toUpperCase().trim(); const sh = parseFloat(document.getElementById('add-shares').value); const cost = parseFloat(document.getElementById('add-cost').value);
        if (!sym || sh <= 0 || cost < 0) return;
        const data = loadData(); if (!data.holdings) data.holdings = [];
        
        data.cash -= (sh * cost); // หัก Cash ตอนซื้อ

        const existing = data.holdings.find(h => h.symbol === sym);
        if (existing) { existing.avgCost = ((existing.shares * existing.avgCost) + (sh * cost)) / (existing.shares += sh); } 
        else { data.holdings.push({ symbol: sym, shares: sh, avgCost: cost, currentPrice: cost, previousClose: cost }); }
        saveData(data); if (window.kodaApiData) window.kodaApiData.holdings = data.holdings; updateUI();
        document.getElementById('btn-close-modal').click(); e.target.reset();
    });

    const modalSell = document.getElementById('modal-sell-stock');
    const modalSellContent = document.getElementById('modal-sell-content');
    
    const openSellModal = (idx, sym, maxSh, pr) => {
        document.getElementById('sell-index').value = sym; 
        document.getElementById('sell-stock-info').textContent = `${sym} • Available: ${maxSh} Shares`;
        document.getElementById('sell-shares').value = ''; document.getElementById('sell-shares').max = maxSh; document.getElementById('sell-price').value = parseFloat(pr).toFixed(2);
        document.getElementById('btn-sell-50').onclick = () => document.getElementById('sell-shares').value = (maxSh * 0.5).toFixed(4);
        document.getElementById('btn-sell-100').onclick = () => document.getElementById('sell-shares').value = maxSh;
        modalSell.classList.remove('hidden'); modalSell.classList.add('flex'); setTimeout(() => { modalSell.classList.remove('opacity-0'); modalSellContent.classList.remove('translate-y-full'); }, 10);
    };
    
    document.getElementById('btn-close-sell-modal')?.addEventListener('click', () => { modalSell.classList.add('opacity-0'); modalSellContent.classList.add('translate-y-full'); setTimeout(() => { modalSell.classList.add('hidden'); modalSell.classList.remove('flex'); }, 300); });

    document.getElementById('sell-stock-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const sym = document.getElementById('sell-index').value; 
        const shToSell = parseFloat(document.getElementById('sell-shares').value);
        const sellPrice = parseFloat(document.getElementById('sell-price').value); // ดึงราคาที่ปลดล็อก
        const data = loadData();
        
        if (data.holdings) {
            const targetIdx = data.holdings.findIndex(h => h.symbol === sym);
            if (targetIdx !== -1) {
                data.cash += (shToSell * sellPrice); // คืน Cash ตอนขาย

                data.holdings[targetIdx].shares -= shToSell;
                if (data.holdings[targetIdx].shares <= 0.0001) data.holdings.splice(targetIdx, 1);
                saveData(data); 
                if (window.kodaApiData) window.kodaApiData.holdings = data.holdings; 
                updateUI();
            }
        }
        document.getElementById('btn-close-sell-modal').click();
    });

    updateUI();
    setInterval(() => { if (!isWhatIfMode) updateUI(); }, 3000); 
});
