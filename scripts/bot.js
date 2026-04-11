const fs = require('fs');

// 1. อ่านข้อมูลปัจจุบัน
const portfolioPath = './portfolio.json';
let data = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));

// Helper ดึงข้อมูล
async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    return await res.json();
}

async function run() {
    console.log("🚀 AI Bot Starting...");

    // 2. ดึงราคาหุ้น (ใช้ Finnhub)
    const finnhubKey = process.env.FINNHUB_KEY;
    let liveMarketData = {};
    let symbols = [...new Set([...data.aiHoldings.map(h=>h.symbol), 'NVDA','AAPL','TSLA','MSFT','AMZN','META','GOOGL'])];
    
    // ดึงราคาทีละตัว (แบบง่ายๆ เพื่อเลี่ยง Rate Limit)
    for (let sym of symbols) {
        try {
            const p = await fetchJSON(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${finnhubKey}`);
            if(p.c > 0) liveMarketData[sym] = p.c;
        } catch(e) {}
    }

    // คำนวณมูลค่าพอร์ต
    let currentVal = data.unallocatedCash;
    data.aiHoldings.forEach(h => {
        if(liveMarketData[h.symbol]) currentVal += h.shares * liveMarketData[h.symbol];
        else currentVal += h.shares * h.avgCost;
    });

    // 3. เรียก AI ตัดสินใจ (Gemini)
    const prompt = `คุณคือ AI Trader
    สถานะ: เงินสด $${data.unallocatedCash}, พอร์ตมูลค่า $${currentVal}
    ถือหุ้น: ${JSON.stringify(data.aiHoldings)}
    ราคาตลาด: ${JSON.stringify(liveMarketData)}
    
    จงตัดสินใจ Buy/Sell/Hold เพื่อเป้าหมายโต 40% ต่อปี
    กฎ: ตำแหน่งละไม่เกิน 20% พอร์ต, ต้องมี SL -10%, TP +30%
    
    ตอบ JSON ONLY (ไม่มี Text อื่น):
    { "trades": [{ "action": "BUY", "symbol": "...", "allocation_usd": 100, "reason": "..." }] }`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_KEY}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } })
    });
    const aiData = await res.json();
    const aiPlan = JSON.parse(aiData.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim());

    // 4. ประมวลผลคำสั่ง (Logic ย่อ)
    let cash = data.unallocatedCash;
    let map = {};
    data.aiHoldings.forEach(h => map[h.symbol] = h);

    for (let t of aiPlan.trades) {
        if (!t.symbol || t.action === 'HOLD') continue;
        let price = liveMarketData[t.symbol] || t.entry_price;
        if(!price) continue;

        if (t.action === 'BUY' && cash > 100) {
            let buyAmt = Math.min(t.allocation_usd, cash * 0.9); // กันเงินสำรอง 10%
            let shares = buyAmt / price;
            if (map[t.symbol]) {
                let oldVal = map[t.symbol].shares * map[t.symbol].avgCost;
                map[t.symbol].avgCost = (oldVal + buyAmt) / (map[t.symbol].shares + shares);
                map[t.symbol].shares += shares;
            } else {
                map[t.symbol] = { symbol: t.symbol, shares: shares, avgCost: price };
            }
            cash -= buyAmt;
            data.aiHistoryLog.push({ date: new Date().toISOString(), action: 'BUY', symbol: t.symbol, shares, price, reason: t.reason });
        } else if (t.action === 'SELL' && map[t.symbol]) {
            let h = map[t.symbol];
            let sellVal = h.shares * price;
            cash += sellVal;
            data.aiHistoryLog.push({ date: new Date().toISOString(), action: 'SELL', symbol: t.symbol, shares: h.shares, price, reason: t.reason });
            delete map[t.symbol];
        }
    }

    // 5. บันทึกผลลัพธ์
    data.unallocatedCash = cash;
    data.aiHoldings = Object.values(map);
    data.lastUpdated = new Date().toISOString();

    fs.writeFileSync(portfolioPath, JSON.stringify(data, null, 2));
    console.log("✅ Done! New Cash:", cash);
}

run().catch(e => { console.error(e); process.exit(1); });
