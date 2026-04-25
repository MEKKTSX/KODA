import os
import json
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 📌 รองรับหลายชื่อ env เผื่อสะกดต่างกันระหว่างโปรเจกต์/Environment
        def env_first(*names):
            for name in names:
                value = os.environ.get(name, '')
                if value and value.strip():
                    return value.strip()
            return ''

        data = {
            "ALPHAVANTAGE": env_first('ALPHAVANTAGE_KEY', 'ALPHAVANTAGE_KEYS', 'ALPHAVANTAGE_API_KEY'),
            "SERPER": env_first('SERPER_API_KEYS', 'SERPER_KEYS', 'SERPER_API_KEY'),
            "GEMINI": env_first('GEMINI_API_KEYS', 'GEMINI_KEYS', 'GEMINI_API_KEY'),
            "FINNHUB": env_first('FINNHUB_KEY_KEYS', 'FINNHUB_API_KEYS', 'FINNHUB_KEYS', 'FINNHUB_KEY')
        }
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Access-Control-Allow-Origin', '*') 
        self.end_headers()
        
        self.wfile.write(json.dumps(data).encode('utf-8'))
