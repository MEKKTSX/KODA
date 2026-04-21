// 🚀 KODA Market Plus Module (Custom D3 Heatmap)
window.KodaMarketPlus = {
    heatmapInstance: null,
    zoomBehavior: null,
    svgSelection: null,

    // 📌 สีตามมาตรฐาน TradingView
    getColor: (changePct) => {
        if (changePct <= -3) return '#f23645';
        if (changePct <= -2) return '#b32834';
        if (changePct <= -1) return '#751c24';
        if (changePct < 0) return '#5e1b20'; // แดงอ่อนมาก
        if (changePct === 0) return '#434651';
        if (changePct <= 1) return '#095c4e';
        if (changePct <= 2) return '#0b7a67';
        return '#089981'; // >= 3
    },

    // 📌 ดึงราคา Real-time (สมมติว่าดึงจาก API หลังบ้าน)
    fetchHeatmapData: async () => {
        // ... (โค้ดสำหรับดึงข้อมูล Watchlist แล้วแปลงเป็น Hierarchical Format สำหรับ D3) ...
        // ตัวอย่าง Data โครงสร้างที่ D3 ต้องการ:
        return {
            name: "Portfolio",
            children: [
                {
                    name: "Technology",
                    children: [
                        { symbol: "NVDA", cap: 2200, change: 1.5, price: 900 },
                        { symbol: "AAPL", cap: 2800, change: -0.5, price: 170 },
                        // ...
                    ]
                },
                // ...
            ]
        };
    },

    drawHeatmap: (data) => {
        const container = document.getElementById('d3-heatmap-container');
        if (!container) return;
        
        const width = container.clientWidth;
        const height = container.clientHeight;

        // ล้างของเก่า
        d3.select(container).selectAll("*").remove();

        const svg = d3.select(container).append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [0, 0, width, height]);

        window.KodaMarketPlus.svgSelection = svg;

        // กลุ่มสำหรับรองรับการซูม
        const g = svg.append("g");

        // 📌 ระบบ Zoom
        window.KodaMarketPlus.zoomBehavior = d3.zoom()
            .scaleExtent([1, 8]) // ซูมเข้าได้ 8 เท่า
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
                // 💡 เคล็ดลับ: คำนวณความสว่าง/ซ่อนข้อความตามระดับการซูมตรงนี้
                updateLabelsVisibility(event.transform.k);
            });

        svg.call(window.KodaMarketPlus.zoomBehavior);

        // 📌 คำนวณ Treemap Layout
        const root = d3.hierarchy(data).sum(d => d.cap).sort((a, b) => b.value - a.value);
        d3.treemap().size([width, height]).paddingInner(1)(root);

        // 📌 วาดกล่อง (Cells)
        const cell = g.selectAll("g")
            .data(root.leaves())
            .join("g")
            .attr("transform", d => `translate(${d.x0},${d.y0})`);

        cell.append("rect")
            .attr("id", d => d.data.symbol)
            .attr("width", d => d.x1 - d.x0)
            .attr("height", d => d.y1 - d.y0)
            .attr("fill", d => window.KodaMarketPlus.getColor(d.data.change))
            .attr("stroke", "#0a0e17")
            .attr("stroke-width", 1);

        // 📌 ใส่ข้อความ (ปรับปรุงให้แสดง/ซ่อนตามขนาดกล่อง)
        const updateLabelsVisibility = (scale = 1) => {
            cell.each(function(d) {
                const node = d3.select(this);
                const rectW = (d.x1 - d.x0) * scale;
                const rectH = (d.y1 - d.y0) * scale;
                
                // ลบข้อความเก่า
                node.selectAll("text, circle").remove();

                // ถ้ากล่องใหญ่พอ ให้วาด โลโก้ + ชื่อ + %
                if (rectW > 60 && rectH > 50) {
                    // จำลองโลโก้
                    node.append("circle")
                        .attr("cx", (d.x1 - d.x0) / 2)
                        .attr("cy", (d.y1 - d.y0) / 2 - 15)
                        .attr("r", 10)
                        .attr("fill", "white");
                    node.append("text")
                        .attr("x", (d.x1 - d.x0) / 2)
                        .attr("y", (d.y1 - d.y0) / 2 - 15)
                        .attr("dy", "0.3em")
                        .attr("text-anchor", "middle")
                        .attr("fill", "black")
                        .attr("font-size", "10px")
                        .attr("font-weight", "bold")
                        .text(d.data.symbol.charAt(0));

                    // Ticker
                    node.append("text")
                        .attr("x", (d.x1 - d.x0) / 2)
                        .attr("y", (d.y1 - d.y0) / 2 + 5)
                        .attr("text-anchor", "middle")
                        .attr("fill", "white")
                        .attr("font-size", "12px")
                        .attr("font-weight", "bold")
                        .text(d.data.symbol);

                    // % Change
                    node.append("text")
                        .attr("x", (d.x1 - d.x0) / 2)
                        .attr("y", (d.y1 - d.y0) / 2 + 20)
                        .attr("text-anchor", "middle")
                        .attr("fill", "white")
                        .attr("font-size", "10px")
                        .text(`${d.data.change > 0 ? '+' : ''}${d.data.change.toFixed(2)}%`);
                } 
                // ถ้ากล่องขนาดกลาง ให้วาดแค่ชื่อ
                else if (rectW > 30 && rectH > 20) {
                     node.append("text")
                        .attr("x", (d.x1 - d.x0) / 2)
                        .attr("y", (d.y1 - d.y0) / 2)
                        .attr("text-anchor", "middle")
                        .attr("fill", "white")
                        .attr("font-size", "10px")
                        .attr("font-weight", "bold")
                        .text(d.data.symbol);
                }
            });
        };

        updateLabelsVisibility(1); // เรียกครั้งแรกตอนวาดเสร็จ
    },

    updateHeatmapData: async () => {
        const newData = await window.KodaMarketPlus.fetchHeatmapData();
        // ถ้าใช้ D3 Update Pattern แบบ Advance เราสามารถอัปเดตแค่สีของ <rect> และข้อความ <text> ได้เลย โดยไม่ต้องวาดกล่องใหม่ทั้งหมด
        // (ซึ่งจะทำให้ไม่เกิดอาการกระพริบเลยแม้แต่น้อย)
        // ... (โค้ดส่วน Update Pattern) ...
    },

    initDynamics: () => {
        // วาดครั้งแรก
        window.KodaMarketPlus.fetchHeatmapData().then(data => {
            window.KodaMarketPlus.drawHeatmap(data);
        });

        // อัปเดตข้อมูลทุก 5 วินาที
        setInterval(() => {
            window.KodaMarketPlus.updateHeatmapData();
        }, 5000);

        // ควบคุมปุ่มซูม
        document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
            window.KodaMarketPlus.svgSelection.transition().call(window.KodaMarketPlus.zoomBehavior.scaleBy, 1.5);
        });
        document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
            window.KodaMarketPlus.svgSelection.transition().call(window.KodaMarketPlus.zoomBehavior.scaleBy, 0.5);
        });
        document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
            window.KodaMarketPlus.svgSelection.transition().call(window.KodaMarketPlus.zoomBehavior.transform, d3.zoomIdentity);
        });
    }
};
