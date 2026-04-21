// 🚀 KODA Market Plus Module (Custom D3 Heatmap - Real Watchlist Data)
window.KodaMarketPlus = {
    heatmapInstance: null,
    zoomBehavior: null,
    svgSelection: null,
    gSelection: null,

    // 📌 สีตามมาตรฐาน TradingView
    getColor: (changePct) => {
        if (changePct <= -3) return '#f23645';
        if (changePct <= -1) return '#b32834';
        if (changePct < 0) return '#751c24';
        if (changePct === 0) return '#434651';
        if (changePct <= 1) return '#095c4e';
        if (changePct <= 2) return '#0b7a67';
        return '#089981'; // >= 3
    },

    // 📌 ดึงราคา Real-time จากตัวแปร Watchlist ที่แอปโหลดไว้แล้ว
    fetchHeatmapData: () => {
        // ใช้ข้อมูลจากตัวแปร KODA โดยตรงเพื่อความ Real-time
        const wl = window.kodaApiData?.watchlist || JSON.parse(localStorage.getItem('koda_portfolio_data'))?.watchlist || [];
        
        if (wl.length === 0) {
            return { name: "Root", children: [] };
        }

        const children = wl.map(s => {
            // คำนวณ % การเปลี่ยนแปลงล่าสุด (รองรับช่วงนอกเวลาทำการ)
            let pct = s.regularChangePct !== undefined ? s.regularChangePct : (s.previousClose > 0 ? ((s.currentPrice - s.previousClose) / s.previousClose) * 100 : 0);
            if (s.marketState && s.marketState !== 'REGULAR' && s.extPercent !== null && s.extPercent !== undefined) {
                pct = s.extPercent;
            }

            return {
                symbol: s.symbol,
                change: pct,
                cap: 100 // ให้กล่องเท่ากันทั้งหมดก่อน เพราะใน Watchlist ไม่มีข้อมูล Market Cap 
            };
        });

        return {
            name: "Watchlist",
            children: children
        };
    },

    drawHeatmap: () => {
        if (typeof d3 === 'undefined') {
            console.error("D3.js is not loaded!");
            return;
        }

        const container = document.getElementById('d3-heatmap-container');
        if (!container) return;

        const data = window.KodaMarketPlus.fetchHeatmapData();
        if (data.children.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-sm text-center pt-20">Watchlist is empty</p>';
            return;
        }
        
        const width = container.clientWidth;
        const height = container.clientHeight;

        d3.select(container).selectAll("*").remove();

        const svg = d3.select(container).append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [0, 0, width, height])
            .style("background-color", "#0a0e17"); // พื้นหลังสไตล์ KODA

        window.KodaMarketPlus.svgSelection = svg;
        const g = svg.append("g");
        window.KodaMarketPlus.gSelection = g;

        // 📌 ระบบ Pan & Zoom (ใช้นิ้วถ่าง หรือ ลูกกลิ้งเมาส์)
        window.KodaMarketPlus.zoomBehavior = d3.zoom()
            .scaleExtent([1, 8]) // ซูมเข้าสุด 8 เท่า
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
                updateLabelsVisibility(event.transform.k);
            });

        // เปิดการใช้งานซูม และเปลี่ยน Double Click ให้เป็น Reset
        svg.call(window.KodaMarketPlus.zoomBehavior)
           .on("dblclick.zoom", () => {
               // Double tap เพื่อ Reset กลับที่เดิม
               svg.transition().duration(500).call(window.KodaMarketPlus.zoomBehavior.transform, d3.zoomIdentity);
           });

        // คำนวณ Treemap
        const root = d3.hierarchy(data).sum(d => d.cap).sort((a, b) => b.value - a.value);
        d3.treemap().size([width, height]).paddingInner(1)(root);

        // วาดกล่อง (Cells)
        const cell = g.selectAll("g")
            .data(root.leaves())
            .join("g")
            .attr("transform", d => `translate(${d.x0},${d.y0})`);

        cell.append("rect")
            .attr("id", d => `rect-${d.data.symbol}`)
            .attr("width", d => d.x1 - d.x0)
            .attr("height", d => d.y1 - d.y0)
            .attr("fill", d => window.KodaMarketPlus.getColor(d.data.change))
            .attr("stroke", "#0a0e17")
            .attr("stroke-width", 1);

        // ฟังก์ชันอัปเดตข้อความและโลโก้แบบ Responsive
        const updateLabelsVisibility = (scale = 1) => {
            cell.each(function(d) {
                const node = d3.select(this);
                const rectW = (d.x1 - d.x0) * scale;
                const rectH = (d.y1 - d.y0) * scale;
                
                node.selectAll("text, circle").remove();

                // กล่องใหญ่: โชว์โลโก้จำลอง + Ticker + %
                if (rectW > 60 && rectH > 50) {
                    node.append("circle")
                        .attr("cx", (d.x1 - d.x0) / 2)
                        .attr("cy", (d.y1 - d.y0) / 2 - 12)
                        .attr("r", 12)
                        .attr("fill", "white");
                    node.append("text")
                        .attr("x", (d.x1 - d.x0) / 2)
                        .attr("y", (d.y1 - d.y0) / 2 - 12)
                        .attr("dy", "0.3em")
                        .attr("text-anchor", "middle")
                        .attr("fill", "#161c2b")
                        .attr("font-size", "12px")
                        .attr("font-weight", "900")
                        .text(d.data.symbol.charAt(0));

                    node.append("text")
                        .attr("x", (d.x1 - d.x0) / 2)
                        .attr("y", (d.y1 - d.y0) / 2 + 10)
                        .attr("text-anchor", "middle")
                        .attr("fill", "white")
                        .attr("font-size", "14px")
                        .attr("font-weight", "bold")
                        .text(d.data.symbol);

                    node.append("text")
                        .attr("x", (d.x1 - d.x0) / 2)
                        .attr("y", (d.y1 - d.y0) / 2 + 24)
                        .attr("text-anchor", "middle")
                        .attr("fill", "white")
                        .attr("font-size", "11px")
                        .text(`${d.data.change > 0 ? '+' : ''}${d.data.change.toFixed(2)}%`);
                } 
                // กล่องกลาง: โชว์แค่ Ticker
                else if (rectW > 30 && rectH > 20) {
                     node.append("text")
                        .attr("x", (d.x1 - d.x0) / 2)
                        .attr("y", (d.y1 - d.y0) / 2 + 4)
                        .attr("text-anchor", "middle")
                        .attr("fill", "white")
                        .attr("font-size", "12px")
                        .attr("font-weight", "bold")
                        .text(d.data.symbol);
                }
            });
        };

        updateLabelsVisibility(1);
    },

    updateHeatmapColors: () => {
        if (!window.KodaMarketPlus.gSelection) return;
        const data = window.KodaMarketPlus.fetchHeatmapData();
        
        // กวาดหาข้อมูลใหม่และเปลี่ยนเฉพาะสีของกล่อง ไม่วาดใหม่ ไม่กระพริบ
        data.children.forEach(item => {
            d3.select(`#rect-${item.symbol.replace(/[^a-zA-Z0-9]/g, '')}`)
              .transition().duration(500)
              .attr("fill", window.KodaMarketPlus.getColor(item.change));
        });
    },

    initDynamics: () => {
        // รอให้ D3 โหลดเสร็จก่อนวาด
        const checkD3 = setInterval(() => {
            if (typeof d3 !== 'undefined') {
                clearInterval(checkD3);
                window.KodaMarketPlus.drawHeatmap();
                
                // อัปเดตสีและเปอเซ็นต์ตาม Watchlist ทุก 5 วินาที
                setInterval(() => {
                    window.KodaMarketPlus.updateHeatmapColors();
                    // วาดกราฟใหม่เบาๆ เพื่อให้ % เปลี่ยน
                    window.KodaMarketPlus.drawHeatmap(); 
                }, 5000);
            }
        }, 100);
    }
};

const initMarketPlusApp = () => {
    if (document.getElementById('d3-heatmap-container')) {
        window.KodaMarketPlus.initDynamics();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMarketPlusApp);
} else {
    initMarketPlusApp(); 
}
