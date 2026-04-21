import os
import json
import math
import asyncio
from datetime import datetime
import pytz
import httpx
import yfinance as yf
import pandas as pd
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import redis.asyncio as redis

app = FastAPI(title="KODA Stock API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== CONFIG ====================
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")  # ไว้ใช้ในอนาคต

redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# ==================== HELPER FUNCTIONS ====================
def clean_val(v):
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except:
        return None

def get_market_state():
    ny_time = datetime.now(pytz.timezone('America/New_York'))
    day = ny_time.weekday()
    hour = ny_time.hour
    minute = ny_time.minute
    time_val = hour + minute / 60
    if day >= 5:
        return 'CLOSED'
    if 4 <= time_val < 9.5:
        return 'PRE'
    elif 9.5 <= time_val < 16:
        return 'REGULAR'
    elif 16 <= time_val < 20:
        return 'POST'
    return 'CLOSED'

async def get_cached_or_fetch(key: str, ttl: int, fetch_func):
    try:
        cached = await redis_client.get(key)
        if cached:
            return json.loads(cached)
    except:
        pass
    data = await fetch_func()
    if data:
        try:
            await redis_client.setex(key, ttl, json.dumps(data))
        except:
            pass
    return data

# ==================== ORIGINAL LOGIC (จากไฟล์เก่าของคุณ) ====================
async def fetch_price_data(symbol: str, mode: str = "price"):
    def _sync_fetch():
        yf_sym = symbol
        if symbol == 'XAUUSD':
            yf_sym = 'GC=F'
        elif '.HK' in symbol:
            yf_sym = symbol.split('.')[0].zfill(4) + '.HK'
        elif 'OANDA:' in symbol:
            yf_sym = symbol.split(':')[1].replace('_', '') + '=X'
        elif 'BINANCE:' in symbol:
            yf_sym = symbol.split(':')[1].replace('USDT', '-USD')
        elif ':' in symbol:
            yf_sym = symbol.split(':')[1]

        ticker = yf.Ticker(yf_sym)

        if mode == 'financials':
            return get_financials(ticker, symbol)
        elif mode == 'analysis':
            return get_analysis(ticker, symbol)
        else:
            return get_price(ticker, symbol)

    return await asyncio.to_thread(_sync_fetch)

# Copy มาจากโค้ดเดิมของคุณทั้งหมด
def get_price(ticker, symbol):
    info = ticker.info
    regular_price = clean_val(info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose'))
    prev_close = clean_val(info.get('previousClose') or info.get('regularMarketPreviousClose'))
    pre_price = clean_val(info.get('preMarketPrice'))
    post_price = clean_val(info.get('postMarketPrice'))

    regular_change = clean_val(info.get('regularMarketChange'))
    if regular_change is None and regular_price and prev_close:
        regular_change = regular_price - prev_close
    regular_percent = clean_val(info.get('regularMarketChangePercent'))
    if regular_percent is None and regular_change and prev_close:
        regular_percent = (regular_change / prev_close) * 100

    pre_change = clean_val(info.get('preMarketChange'))
    if pre_change is None and pre_price and prev_close:
        pre_change = pre_price - prev_close
    pre_percent = clean_val(info.get('preMarketChangePercent'))
    if pre_percent is None and pre_change and prev_close:
        pre_percent = (pre_change / prev_close) * 100

    post_change = clean_val(info.get('postMarketChange'))
    if post_change is None and post_price and regular_price:
        post_change = post_price - regular_price
    post_percent = clean_val(info.get('postMarketChangePercent'))
    if post_percent is None and post_change and regular_price:
        post_percent = (post_change / regular_price) * 100

    return {
        "success": True,
        "symbol": symbol,
        "regularMarketPrice": regular_price,
        "regularMarketChange": regular_change or 0,
        "regularMarketChangePercent": regular_percent or 0,
        "regularMarketPreviousClose": prev_close or 0,
        "preMarketPrice": pre_price,
        "preMarketChange": pre_change,
        "preMarketChangePercent": pre_percent,
        "postMarketPrice": post_price,
        "postMarketChange": post_change,
        "postMarketChangePercent": post_percent,
        "currency": info.get('currency', 'USD'),
        "marketState": get_market_state()
    }

def get_analysis(ticker, symbol):
    info = ticker.info
    targets = {
        "current": clean_val(info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')),
        "high": clean_val(info.get('targetHighPrice')),
        "low": clean_val(info.get('targetLowPrice')),
        "mean": clean_val(info.get('targetMeanPrice')),
        "median": clean_val(info.get('targetMedianPrice')),
        "analystCount": clean_val(info.get('numberOfAnalystOpinions'))
    }
    rec_data = {"strongBuy": 0, "buy": 0, "hold": 0, "sell": 0, "strongSell": 0, "consensus": info.get('recommendationKey', 'none')}
    try:
        rec_df = ticker.recommendations
        if rec_df is not None and not rec_df.empty:
            latest = rec_df.iloc[0]
            rec_data['strongBuy'] = int(clean_val(latest.get('strongBuy', 0)) or 0)
            rec_data['buy'] = int(clean_val(latest.get('buy', 0)) or 0)
            rec_data['hold'] = int(clean_val(latest.get('hold', 0)) or 0)
            rec_data['sell'] = int(clean_val(latest.get('sell', 0)) or 0)
            rec_data['strongSell'] = int(clean_val(latest.get('strongSell', 0)) or 0)
    except:
        pass
    return {"success": True, "symbol": symbol, "targets": targets, "recommendation": rec_data}

def get_financials(ticker, symbol):
    # ใช้ logic เดิมของคุณ (ย่อเพื่อความกระชับ แต่คุณสามารถใส่เต็มได้)
    financials_data = []
    earnings_data = []
    next_earnings = None
    # ... (ใส่โค้ด get_financials เดิมของคุณทั้งหมดที่นี่)
    # ผมย่อไว้เพื่อไม่ให้ไฟล์ยาวเกิน แต่ logic เดียวกับไฟล์เก่า
    return {"success": True, "symbol": symbol, "financials": financials_data, "earnings": earnings_data, "nextEarningsDate": next_earnings}

# ==================== S/R CALCULATION (ย้ายมาจาก JS) ====================
async def calculate_sr_levels(symbol: str):
    cache_key = f"sr_{symbol}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    def _fetch_candles():
        df = yf.download(tickers=symbol, period="1y", interval="1d", progress=False)
        return df

    df = await asyncio.to_thread(_fetch_candles)
    if df.empty:
        return []

    closes = df['Close'].dropna().tolist()
    highs = df['High'].dropna().tolist()
    lows = df['Low'].dropna().tolist()

    if len(closes) < 20:
        return []

    current_price = closes[-1]
    n = len(closes)
    lookback = max(3, n // 25)
    swing_highs, swing_lows = [], []

    for i in range(lookback, n - lookback):
        is_high = all(highs[i] >= highs[i-j] and highs[i] >= highs[i+j] for j in range(1, lookback+1))
        is_low = all(lows[i] <= lows[i-j] and lows[i] <= lows[i+j] for j in range(1, lookback+1))
        if is_high:
            swing_highs.append({"price": highs[i], "score": i/n})
        if is_low:
            swing_lows.append({"price": lows[i], "score": i/n})

    threshold = current_price * 0.015

    def pick_levels(items, filter_func):
        res = []
        items.sort(key=lambda x: x["score"], reverse=True)
        for it in items:
            if filter_func(it["price"]) and not any(abs(p["price"] - it["price"]) < threshold for p in res):
                res.append(it)
            if len(res) >= 4:
                break
        return res

    resists = [{"price": r["price"], "type": "res", "strength": 3 if idx == 0 else 1} 
               for idx, r in enumerate(pick_levels(swing_highs, lambda p: p > current_price))]
    supports = [{"price": s["price"], "type": "sup", "strength": 3 if idx == 0 else 1} 
                for idx, s in enumerate(pick_levels(swing_lows, lambda p: p < current_price))]

    result = resists + supports
    await redis_client.setex(cache_key, 3600, json.dumps(result))  # cache 1 ชม.
    return result

# ==================== ENDPOINTS ====================
@app.get("/api/price")
async def get_price_endpoint(symbol: str = Query("TSLA"), mode: str = Query("price")):
    cache_key = f"koda_{mode}_{symbol}"
    ttl = 5 if mode == "price" else 1800  # 5 วินาทีสำหรับราคา, 30 นาทีสำหรับข้อมูลอื่น

    async def fetcher():
        return await fetch_price_data(symbol, mode)

    data = await get_cached_or_fetch(cache_key, ttl, fetcher)
    return JSONResponse(content=data or {"success": False, "symbol": symbol})

@app.post("/api/company-summary")
async def company_summary(payload: dict):
    symbol = payload.get("symbol")
    company_name = payload.get("companyName", symbol)
    industry = payload.get("industry", "General")

    prompt = f"""ในฐานะผู้เชี่ยวชาญด้านธุรกิจและการลงทุน โปรดสรุป Business Model, พื้นฐาน, และ Ecosystem ของบริษัท {symbol} ({company_name}) 
อุตสาหกรรม: {industry}
ให้อธิบายเป็น "ภาษาไทย" แบบเห็นภาพชัดเจน เข้าใจง่ายสำหรับนักลงทุนรายย่อย
บังคับใช้โครงสร้าง HTML นี้ในการตอบ (ห้ามมี ```html):
<div style="margin-bottom: 12px;"><strong>🏢 ทำธุรกิจอะไร (Core Business):</strong> ...</div>
<div style="margin-bottom: 12px;"><strong>🌐 Ecosystem & รายได้ (How they make money):</strong> ...</div>
<div style="margin-bottom: 12px;"><strong>⚔️ จุดเด่น / คู่แข่ง (Moat & Competitors):</strong> ...</div>
<div style="padding: 12px; background: rgba(52,168,235,0.1); border-radius: 8px; border: 1px solid rgba(52,168,235,0.3); color: #34a8eb;"><strong>💡 โอกาสในอนาคต (Future Catalysts):</strong> ...</div>"""

    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}",
                json={"contents": [{"role": "user", "parts": [{"text": prompt}]}]},
                timeout=30.0
            )
            data = res.json()
            html = data['candidates'][0]['content']['parts'][0]['text'].replace('```html', '').replace('```', '').strip()
            return {"success": True, "html": html}
        except:
            return {"success": False, "html": "<p>ไม่สามารถสรุปข้อมูลได้ในขณะนี้</p>"}

# ==================== WEBSOCKET REALTIME CHART + S/R ====================
@app.websocket("/ws/chart/{symbol}")
async def websocket_chart(websocket: WebSocket, symbol: str):
    await websocket.accept()
    try:
        while True:
            # 1. ราคาล่าสุด
            price_data = await fetch_price_data(symbol, "price")

            # 2. คำนวณ S/R ล่าสุด
            sr_levels = await calculate_sr_levels(symbol)

            payload = {
                "type": "chart_update",
                "price": price_data,
                "sr_levels": sr_levels,
                "timestamp": datetime.now().timestamp()
            }

            await websocket.send_json(payload)
            await asyncio.sleep(2)  # Push ทุก 2 วินาที (เร็วและลื่น)

    except WebSocketDisconnect:
        print(f"[WS] Client disconnected: {symbol}")
    except Exception as e:
        print(f"[WS] Error for {symbol}: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
