# api/price.py
from http.server import BaseHTTPRequestHandler
import json
import yfinance as yf
from urllib.parse import urlparse, parse_qs
from datetime import datetime
import pytz
import math

# ฟังก์ชันกรองค่า Nan/Inf ให้ปลอดภัยก่อนแปลงเป็น JSON
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
        symbol = query.get('symbol', ['TSLA'])[0].strip().upper()
        mode = query.get('mode', ['price'])[0].strip().lower()

        try:
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
                "error": str(e),
                "symbol": symbol
            }

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

    def get_price(self, ticker, symbol):
        info = ticker.info
        regular_price = clean_val(info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose'))
        prev_close = clean_val(info.get('previousClose') or info.get('regularMarketPreviousClose'))
        pre_price = clean_val(info.get('preMarketPrice'))
        post_price = clean_val(info.get('postMarketPrice'))

        regular_change = clean_val(info.get('regularMarketChange'))
        if regular_change is None and regular_price and prev_close: regular_change = regular_price - prev_close
            
        regular_percent = clean_val(info.get('regularMarketChangePercent'))
        if regular_percent is None and regular_change and prev_close: regular_percent = (regular_change / prev_close) * 100

        pre_change = clean_val(info.get('preMarketChange'))
        if pre_change is None and pre_price and prev_close: pre_change = pre_price - prev_close
            
        pre_percent = clean_val(info.get('preMarketChangePercent'))
        if pre_percent is None and pre_change and prev_close: pre_percent = (pre_change / prev_close) * 100

        post_change = clean_val(info.get('postMarketChange'))
        if post_change is None and post_price and regular_price: post_change = post_price - regular_price
            
        post_percent = clean_val(info.get('postMarketChangePercent'))
        if post_percent is None and post_change and regular_price: post_percent = (post_change / regular_price) * 100

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
            "marketState": self.get_market_state()
        }

    def get_analysis(self, ticker, symbol):
        info = ticker.info
        
        # ดึงราคาเป้าหมาย
        targets = {
            "current": clean_val(info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')),
            "high": clean_val(info.get('targetHighPrice')),
            "low": clean_val(info.get('targetLowPrice')),
            "mean": clean_val(info.get('targetMeanPrice')),
            "median": clean_val(info.get('targetMedianPrice')),
            "analystCount": clean_val(info.get('numberOfAnalystOpinions'))
        }
        
        # ดึงข้อมูลการโหวตของนักวิเคราะห์
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
            earn = ticker.earnings_dates
            import pandas as pd
            if earn is not None and not earn.empty:
                now = pd.Timestamp.now(tz=earn.index.tz)
                future = earn[earn.index >= now].sort_index()
                if not future.empty: next_earnings = future.index[0].strftime('%Y-%m-%d')
                
                past = earn[earn.index < now].sort_index(ascending=False).head(10)
                for date_idx, row in past.iterrows():
                    try:
                        q_num = (date_idx.month - 1) // 3 + 1
                        est = clean_val(row.get("EPS Estimate"))
                        act = clean_val(row.get("Reported EPS"))
                        surp = clean_val(row.get("Surprise(%)"))
                        
                        earnings_data.append({
                            "quarter": f"{q_num} Q{date_idx.year}", "year": date_idx.year,
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