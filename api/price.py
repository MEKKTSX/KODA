# api/price.py
from http.server import BaseHTTPRequestHandler
import json
import yfinance as yf
from urllib.parse import urlparse, parse_qs
from datetime import datetime
import pytz

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # ดึง symbol จาก query string
        query = parse_qs(urlparse(self.path).query)
        symbol = query.get('symbol', ['TSLA'])[0].strip().upper()

        try:
            # แปลง symbol ให้ yfinance ใช้ได้
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
            info = ticker.info

            # ดึงราคาหลักแบบปลอดภัย
            regular_price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
            prev_close = info.get('previousClose') or info.get('regularMarketPreviousClose')
            
            pre_price = info.get('preMarketPrice')
            post_price = info.get('postMarketPrice')

            # คำนวณเปอร์เซ็นต์ส่วนต่าง (เผื่อ YF ไม่ส่งค่ามาให้)
            regular_change = info.get('regularMarketChange')
            if regular_change is None and regular_price and prev_close:
                regular_change = regular_price - prev_close
                
            regular_percent = info.get('regularMarketChangePercent')
            if regular_percent is None and regular_change and prev_close:
                regular_percent = (regular_change / prev_close) * 100

            pre_change = info.get('preMarketChange')
            if pre_change is None and pre_price and prev_close:
                pre_change = pre_price - prev_close
                
            pre_percent = info.get('preMarketChangePercent')
            if pre_percent is None and pre_change and prev_close:
                pre_percent = (pre_change / prev_close) * 100

            post_change = info.get('postMarketChange')
            if post_change is None and post_price and regular_price:
                post_change = post_price - regular_price
                
            post_percent = info.get('postMarketChangePercent')
            if post_percent is None and post_change and regular_price:
                post_percent = (post_change / regular_price) * 100

            response = {
                "success": True,
                "symbol": symbol,
                "regularMarketPrice": float(regular_price) if regular_price else None,
                "regularMarketChange": float(regular_change) if regular_change else 0,
                "regularMarketChangePercent": float(regular_percent) if regular_percent else 0,
                "regularMarketPreviousClose": float(prev_close) if prev_close else 0,
                "preMarketPrice": float(pre_price) if pre_price else None,
                "preMarketChange": float(pre_change) if pre_change else None,
                "preMarketChangePercent": float(pre_percent) if pre_percent else None,
                "postMarketPrice": float(post_price) if post_price else None,
                "postMarketChange": float(post_change) if post_change else None,
                "postMarketChangePercent": float(post_percent) if post_percent else None,
                "currency": info.get('currency', 'USD'),
                "marketState": self.get_market_state()
            }

        except Exception as e:
            response = {
                "success": False,
                "error": str(e),
                "symbol": symbol
            }

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

    def get_market_state(self):
        # คำนวณเวลาฝั่งเซิร์ฟเวอร์แบบเป๊ะๆ 
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