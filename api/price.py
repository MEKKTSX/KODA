from http.server import BaseHTTPRequestHandler
import json
import yfinance as yf
from urllib.parse import urlparse, parse_qs
from datetime import datetime
import pytz
import math
import pandas as pd

def clean_val(v):
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f): return None
        return f
    except:
        return None

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        mode = query.get('mode', ['price'])[0].strip().lower()

        try:
            if mode == 'fx':
                base = query.get('base', ['USD'])[0].strip().upper()
                target = query.get('target', ['THB'])[0].strip().upper()
                response = self.get_exchange_rate(base, target)
            else:
                symbol = query.get('symbol', ['TSLA'])[0].strip().upper()
                yf_sym = symbol
                if symbol == 'XAUUSD': yf_sym = 'GC=F'
                elif '.HK' in symbol: yf_sym = symbol.split('.')[0].zfill(4) + '.HK'
                elif 'OANDA:' in symbol: yf_sym = symbol.split(':')[1].replace('_', '') + '=X'
                elif 'BINANCE:' in symbol: yf_sym = symbol.split(':')[1].replace('USDT', '-USD')
                elif ':' in symbol: yf_sym = symbol.split(':')[1]

                ticker = yf.Ticker(yf_sym)

                if mode == 'financials':
                    response = self.get_financials(ticker, symbol)
                elif mode == 'analysis':
                    response = self.get_analysis(ticker, symbol)
                else:
                    response = self.get_price(ticker, symbol)

        except Exception as e:
            response = {
                "success": False,
                "error": str(e)
            }

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.end_headers()
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

    def get_exchange_rate(self, base, target):
        try:
            ticker = yf.Ticker(f"{base}{target}=X")
            info = ticker.info
            rate = clean_val(info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose'))
            if rate:
                return {"success": True, "base": base, "target": target, "rate": rate}
        except Exception:
            pass
        return {"success": False, "base": base, "target": target, "rate": 34.50}

    def get_price(self, ticker, symbol):
        info = ticker.info
        market_state = self.get_market_state()
        
        # ราคาหลัก
        regular_price = clean_val(info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose'))
        prev_close = clean_val(info.get('regularMarketPreviousClose') or info.get('previousClose'))
        
        # ดึงราคาจาก Fast History ถ้า Info เอ๋อ
        try:
            if regular_price is None or prev_close is None:
                hist = ticker.history(period="2d")
                if not hist.empty:
                    if regular_price is None: regular_price = clean_val(hist['Close'].iloc[-1])
                    if len(hist) > 1 and prev_close is None: prev_close = clean_val(hist['Close'].iloc[-2])
        except: pass

        pre_price = clean_val(info.get('preMarketPrice'))
        post_price = clean_val(info.get('postMarketPrice'))
        
        # 🚨 ดึงราคา Live 1 นาทีล่าสุด (แก้ปัญหา Yahoo แจ้งราคาค้าง)
        try:
            hist = ticker.history(period="1d", interval="1m", prepost=True)
            if not hist.empty:
                live_price = clean_val(hist['Close'].iloc[-1])
                
                if market_state == 'PRE':
                    if pre_price is None or pre_price == prev_close:
                        pre_price = live_price
                elif market_state == 'POST' or market_state == 'CLOSED':
                    if post_price is None or post_price == regular_price:
                        post_price = live_price
                elif market_state == 'REGULAR':
                    if regular_price is None or regular_price == prev_close:
                        regular_price = live_price
        except: pass

        # 📌 แก้บัคฐานการคำนวณ (Base Price) สำหรับ % ให้ถูกต้อง
        # 1. ตลาดปกติ: เทียบกับราคาปิดวันก่อนหน้า (prev_close)
        regular_change = clean_val(info.get('regularMarketChange'))
        if regular_change is None or regular_price != clean_val(info.get('regularMarketPrice')):
            if regular_price and prev_close: regular_change = regular_price - prev_close
            
        regular_percent = clean_val(info.get('regularMarketChangePercent'))
        if regular_percent is None or regular_price != clean_val(info.get('regularMarketPrice')):
            if regular_change and prev_close: regular_percent = (regular_change / prev_close) * 100

        # 2. 🚨 แก้บัคที่นี่: ก่อนเปิดตลาด (Pre-market) ต้องเทียบกับราคาปิดเมื่อวาน (regular_price) ไม่ใช่ prev_close
        pre_change = clean_val(info.get('preMarketChange'))
        if pre_change is None or pre_price != clean_val(info.get('preMarketPrice')):
            if pre_price and regular_price: pre_change = pre_price - regular_price
            
        pre_percent = clean_val(info.get('preMarketChangePercent'))
        if pre_percent is None or pre_price != clean_val(info.get('preMarketPrice')):
            if pre_change and regular_price: pre_percent = (pre_change / regular_price) * 100

        # 3. 🚨 แก้บัคที่นี่: หลังปิดตลาด (Post-market) ต้องเทียบกับราคาปิดวันนี้ (regular_price)
        post_change = clean_val(info.get('postMarketChange'))
        if post_change is None or post_price != clean_val(info.get('postMarketPrice')):
            if post_price and regular_price: post_change = post_price - regular_price
            
        post_percent = clean_val(info.get('postMarketChangePercent'))
        if post_percent is None or post_price != clean_val(info.get('postMarketPrice')):
            if post_change and regular_price: post_percent = (post_change / regular_price) * 100

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
            "marketState": market_state
        }

    def get_analysis(self, ticker, symbol):
        info = ticker.info
        targets = {
            "current": clean_val(info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')),
            "high": clean_val(info.get('targetHighPrice')),
            "low": clean_val(info.get('targetLowPrice')),
            "mean": clean_val(info.get('targetMeanPrice')),
            "median": clean_val(info.get('targetMedianPrice')),
            "analystCount": clean_val(info.get('numberOfAnalystOpinions'))
        }
        rec_data = {
            "strongBuy": 0, "buy": 0, "hold": 0, "sell": 0, "strongSell": 0, 
            "consensus": info.get('recommendationKey', 'none')
        }
        try:
            rec_df = ticker.recommendations
            if rec_df is not None and not rec_df.empty:
                latest = rec_df.iloc[0]
                rec_data['strongBuy'] = int(clean_val(latest.get('strongBuy', 0)) or 0)
                rec_data['buy'] = int(clean_val(latest.get('buy', 0)) or 0)
                rec_data['hold'] = int(clean_val(latest.get('hold', 0)) or 0)
                rec_data['sell'] = int(clean_val(latest.get('sell', 0)) or 0)
                rec_data['strongSell'] = int(clean_val(latest.get('strongSell', 0)) or 0)
        except: pass
            
        return {
            "success": True,
            "symbol": symbol,
            "targets": targets,
            "recommendation": rec_data
        }

    def get_financials(self, ticker, symbol):
        financials_data = []
        earnings_data = []
        next_earnings = None
        
        try:
            inc = ticker.quarterly_income_stmt
            if inc is not None and not inc.empty:
                for date_col in inc.columns[:5]:
                    try:
                        d_str = date_col.strftime('%Y-%m-%d')
                        q_num = (date_col.month - 1) // 3 + 1
                        q_str = f"Q{q_num} {date_col.year}"
                        
                        def gv(row_name):
                            try:
                                v = inc.loc[row_name, date_col]
                                return clean_val(v) or 0
                            except: return 0
                            
                        financials_data.append({
                            "dateRaw": d_str, "quarter": q_str,
                            "totalRevenue": gv("Total Revenue"), "grossProfit": gv("Gross Profit"),
                            "operatingIncome": gv("Operating Income"), "netIncome": gv("Net Income")
                        })
                    except: pass
        except Exception: pass
            
        try:
            earn = ticker.get_earnings_dates(limit=40)
            if earn is not None and not earn.empty:
                now = pd.Timestamp.utcnow()
                if earn.index.tz is None: earn.index = earn.index.tz_localize('UTC')
                else: earn.index = earn.index.tz_convert('UTC')
                    
                future = earn[earn.index >= now].sort_index()
                if not future.empty: next_earnings = future.index[0].strftime('%Y-%m-%d')
                
                past = earn[earn.index < now].sort_index(ascending=False).dropna(subset=['Reported EPS', 'EPS Estimate'], how='all').head(10)
                for date_idx, row in past.iterrows():
                    try:
                        q_num = (date_idx.month - 1) // 3 + 1
                        est = clean_val(row.get("EPS Estimate"))
                        act = clean_val(row.get("Reported EPS"))
                        surp = clean_val(row.get("Surprise(%)"))
                        
                        earnings_data.append({
                            "quarter": f"{q_num}Q{date_idx.year}", "year": date_idx.year,
                            "estimate": est, "actual": act, "surprise": (surp * 100) if surp is not None else 0 
                        })
                    except: pass
        except Exception: pass
            
        return {
            "success": True, "symbol": symbol, "financials": financials_data,
            "earnings": earnings_data, "nextEarningsDate": next_earnings
        }

    def get_market_state(self):
        ny_time = datetime.now(pytz.timezone('America/New_York'))
        day = ny_time.weekday()
        hour = ny_time.hour
        minute = ny_time.minute
        time_val = hour + minute / 60

        if day >= 5: return 'CLOSED'
        if 4 <= time_val < 9.5: return 'PRE'
        elif 9.5 <= time_val < 16: return 'REGULAR'
        elif 16 <= time_val < 20: return 'POST'
        return 'CLOSED'
