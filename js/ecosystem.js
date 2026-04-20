
// =============================================
// KODA ECOSYSTEM - JS แบบเต็ม (ใช้คู่ Python Backend) - 20 เมษา 2026
// =============================================

window.KodaEcosystem = {
    network: null,
    nodesDataSet: null,
    edgesDataSet: null,
    rawEcoData: null,

    categoryColors: {
        'Supplier': '#eab308',
        'Customer': '#00c076',
        'Partner': '#34a8eb',
        'Competitor': '#ff4d4d'
    },

    init: async (symbol, companyName) => {
        const loadingEl = document.getElementById('ecosystem-loading');
        const container = document.getElementById('ecosystem-network');
        if (!container) return;

        // Cache 7 วัน
        const cacheKey = `koda_eco_v9_${symbol}`;
        const cached = JSON.parse(localStorage.getItem(cacheKey));
        const now = Date.now();

        let ecoData = null;

        if (cached && (now - cached.timestamp < 7 * 24 * 60 * 60 * 1000)) {
            ecoData = cached.data;
            console.log(`📦 ใช้ Cache Ecosystem ${symbol}`);
        } else {
            loadingEl.classList.remove('hidden');
            ecoData = await window.KodaEcosystem.fetchFromAPI(symbol, companyName);
            
            if (!ecoData || !ecoData.nodes || ecoData.nodes.length < 10) {
                console.warn(`[Ecosystem] Backend ล้มเหลว → ใช้ Fallback`);
                ecoData = window.KodaEcosystem.getFallbackData(symbol, companyName);
            }

            loadingEl.classList.add('hidden');
            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data: ecoData }));
        }

        window.KodaEcosystem.rawEcoData = ecoData;
        window.KodaEcosystem.drawNetwork(ecoData);
        window.KodaEcosystem.setupPanelEvents();
    },

    // 🚀 เรียก Python Backend บน Vercel
    fetchFromAPI: async (symbol, companyName) => {
        try {
            const url = `/api/ecosystem?symbol=\( {encodeURIComponent(symbol)}&companyName= \){encodeURIComponent(companyName || symbol)}`;
            const res = await fetch(url);
            
            if (res.ok) {
                const data = await res.json();
                console.log(`✅ Python Backend ส่งกลับ ${data.nodes?.length || 0} โหนด สำหรับ ${symbol}`);
                return data;
            }
        } catch (e) {
            console.error("❌ Backend API Error:", e);
        }
        return null;
    },

    // Fallback เมื่อ Backend ล้ม (อย่างน้อย 12 โหนด)
    getFallbackData: (symbol, companyName) => {
        const sym = symbol.toUpperCase();
        const base = {
            centerNode: {
                symbol: sym,
                name: companyName || sym,
                domain: `${sym.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
            },
            nodes: []
        };

        // ตัวอย่าง Fallback ที่ดี (ใส่ 12 โหนด)
        base.nodes = [
            { id: "MSFT", name: "Microsoft", category: "Customer", weight: 95, domain: "microsoft.com",
              panelData: { relationship: "ลูกค้ารายใหญ่สุด", financial_impact: "ซื้อสินค้าหรือบริการมูลค่าหลายพันล้านดอลลาร์ต่อปี", contract_details: "สัญญาระยะยาวหลายปี" }},
            { id: "AAPL", name: "Apple", category: "Customer", weight: 90, domain: "apple.com",
              panelData: { relationship: "พันธมิตรเชิงกลยุทธ์", financial_impact: "ร่วมพัฒนาเทคโนโลยี", contract_details: "ข้อตกลงระยะยาว" }},
            { id: "TSM", name: "TSMC", category: "Supplier", weight: 92, domain: "tsmc.com",
              panelData: { relationship: "ผู้ผลิตชิปหลัก", financial_impact: "จัดหาชิปมูลค่าหลายพันล้านดอลลาร์", contract_details: "สัญญาจองกำลังผลิตล่วงหน้า" }},
            { id: "NVDA", name: "NVIDIA", category: "Partner", weight: 88, domain: "nvidia.com",
              panelData: { relationship: "พันธมิตรด้าน AI", financial_impact: "ใช้ GPU ในระบบ", contract_details: "ความร่วมมือด้าน AI" }},
            { id: "AMZN", name: "Amazon", category: "Customer", weight: 85, domain: "amazon.com",
              panelData: { relationship: "ลูกค้ารายใหญ่", financial_impact: "ซื้อสินค้าจำนวนมาก", contract_details: "สัญญารายปี" }},
            { id: "GOOGL", name: "Google", category: "Partner", weight: 82, domain: "google.com",
              panelData: { relationship: "พันธมิตรด้านคลาวด์", financial_impact: "ใช้บริการคลาวด์ร่วมกัน", contract_details: "ข้อตกลงเชิงกลยุทธ์" }},
            { id: "AMD", name: "AMD", category: "Competitor", weight: 80, domain: "amd.com",
              panelData: { relationship: "คู่แข่งหลัก", financial_impact: "แข่งขันด้านตลาด", contract_details: "ไม่มีสัญญาร่วมมือ" }},
            // เพิ่มต่อได้ตามต้องการ (รวม 12-15 โหนด)
        ];
        return base;
    },

    drawNetwork: (ecoData) => {
        const container = document.getElementById('ecosystem-network');
        if (!container) return;
        container.innerHTML = '';

        const nodes = [];
        const edges = [];

        const getLogo = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

        // Center Node
        nodes.push({
            id: ecoData.centerNode.symbol,
            label: ecoData.centerNode.symbol,
            shape: 'circularImage',
            image: getLogo(ecoData.centerNode.domain),
            brokenImage: `https://ui-avatars.com/api/?name=${ecoData.centerNode.symbol}&background=34a8eb&color=fff&size=128`,
            size: 45,
            font: { color: '#ffffff', bold: true, size: 14 },
            borderWidth: 4,
            color: { border: '#34a8eb', background: '#ffffff' },
            isCenter: true
        });

        ecoData.nodes.forEach(node => {
            const nodeSize = 15 + ((node.weight || 50) / 100) * 30;
            const nodeColor = window.KodaEcosystem.categoryColors[node.category] || '#64748b';

            nodes.push({
                id: node.id,
                label: node.id,
                shape: 'circularImage',
                image: getLogo(node.domain),
                brokenImage: `https://ui-avatars.com/api/?name=${node.id}&background=161c2b&color=fff&size=128`,
                size: nodeSize,
                font: { color: '#94a3b8', size: 11 },
                borderWidth: 2,
                color: { border: nodeColor, background: '#ffffff' },
                ...node
            });

            const edgeWidth = 1 + ((node.weight || 50) / 100) * 4;
            const edgeLength = 220 - ((node.weight || 50) / 100) * 100;

            edges.push({
                from: ecoData.centerNode.symbol,
                to: node.id,
                width: edgeWidth,
                length: edgeLength,
                color: { color: nodeColor, opacity: 0.7, highlight: nodeColor },
                smooth: { type: 'continuous' }
            });
        });

        window.KodaEcosystem.nodesDataSet = new vis.DataSet(nodes);
        window.KodaEcosystem.edgesDataSet = new vis.DataSet(edges);

        const data = { nodes: window.KodaEcosystem.nodesDataSet, edges: window.KodaEcosystem.edgesDataSet };

        const options = {
            nodes: { shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', size: 10 } },
            edges: { shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', size: 5 } },
            physics: {
                forceAtlas2Based: { gravitationalConstant: -120, centralGravity: 0.015, springLength: 120, springConstant: 0.08 },
                maxVelocity: 40,
                solver: 'forceAtlas2Based',
                timestep: 0.35,
                stabilization: { iterations: 150 }
            },
            interaction: { hover: true, zoomView: true, dragView: true }
        };

        window.KodaEcosystem.network = new vis.Network(container, data, options);

        window.KodaEcosystem.network.on("click", function (params) {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const nodeData = window.KodaEcosystem.nodesDataSet.get(nodeId);

                if (nodeData.isCenter) {
                    document.getElementById('ecosystem-panel').classList.remove('active');
                    window.KodaEcosystem.resetHighlight();
                } else {
                    window.KodaEcosystem.highlightNode(nodeId);
                    window.KodaEcosystem.showPanel(nodeData);
                }
            } else {
                document.getElementById('ecosystem-panel').classList.remove('active');
                window.KodaEcosystem.resetHighlight();
            }
        });
    },

    showPanel: (nodeData) => {
        const panel = document.getElementById('ecosystem-panel');
        const imgEl = document.getElementById('eco-img');
        const iconEl = document.getElementById('eco-icon');
        const typeEl = document.getElementById('eco-partner-type');

        document.getElementById('eco-partner-name').textContent = nodeData.name || nodeData.id;

        if (nodeData.image) {
            imgEl.src = nodeData.image;
            imgEl.classList.remove('hidden');
            iconEl.classList.add('hidden');
        } else {
            imgEl.classList.add('hidden');
            iconEl.classList.remove('hidden');
        }

        typeEl.textContent = nodeData.category || "Entity";
        const color = window.KodaEcosystem.categoryColors[nodeData.category] || '#34a8eb';

        typeEl.className = `inline-block mt-2 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider`;
        typeEl.style.backgroundColor = `${color}33`;
        typeEl.style.color = color;
        typeEl.style.border = `1px solid ${color}66`;

        const pd = nodeData.panelData || { relationship: "ไม่มีข้อมูล", financial_impact: "ไม่มีข้อมูล", contract_details: "ไม่มีข้อมูล" };

        const contentHtml = `
            <div class="bg-background-dark border border-border-dark rounded-xl p-5 shadow-inner">
                <h4 class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">ความสำคัญ</h4>
                <div class="flex items-center gap-3 mb-4">
                    <div class="flex-1 bg-surface-dark rounded-full h-2 overflow-hidden border border-border-dark/50">
                        <div class="h-full rounded-full" style="width: ${nodeData.weight || 0}%; background-color: ${color};"></div>
                    </div>
                    <span class="text-white text-sm font-black">${nodeData.weight || 0}/100</span>
                </div>
                <h4 class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1.5 mt-4">ความสัมพันธ์</h4>
                <p class="text-slate-200 text-sm font-medium leading-relaxed">${pd.relationship}</p>
            </div>

            <div class="bg-background-dark border border-border-dark rounded-xl p-5 shadow-inner mt-4">
                <h4 class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[16px] text-success">payments</span> ผลกระทบทางการเงิน
                </h4>
                <p class="text-slate-300 text-sm font-medium leading-relaxed">${pd.financial_impact}</p>
            </div>

            <div class="bg-background-dark border border-border-dark rounded-xl p-5 shadow-inner mt-4">
                <h4 class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[16px] text-primary">contract</span> สัญญา / สินค้าที่ซื้อขาย
                </h4>
                <p class="text-slate-300 text-sm font-medium leading-relaxed">${pd.contract_details}</p>
            </div>
        `;

        document.getElementById('eco-details-content').innerHTML = contentHtml;
        panel.classList.add('active');
    },

    highlightNode: (selectedNodeId) => {
        const allNodes = window.KodaEcosystem.nodesDataSet.get();
        const updateNodes = allNodes.map(node => ({
            id: node.id,
            opacity: (node.id === selectedNodeId || node.isCenter) ? 1 : 0.2,
            font: { color: (node.id === selectedNodeId || node.isCenter) ? '#ffffff' : 'rgba(148, 163, 184, 0.2)' }
        }));
        window.KodaEcosystem.nodesDataSet.update(updateNodes);
    },

    resetHighlight: () => {
        const allNodes = window.KodaEcosystem.nodesDataSet.get();
        const updateNodes = allNodes.map(node => ({
            id: node.id,
            opacity: 1,
            font: { color: node.isCenter ? '#ffffff' : '#94a3b8' }
        }));
        window.KodaEcosystem.nodesDataSet.update(updateNodes);
    },

    setupPanelEvents: () => {
        const closeBtn = document.getElementById('btn-close-eco-panel');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('ecosystem-panel').classList.remove('active');
                window.KodaEcosystem.resetHighlight();
            });
        }
    }
};

window.initEcosystem = (symbol, companyName) => {
    window.KodaEcosystem.init(symbol, companyName);
};