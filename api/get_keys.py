import os
import json
import unicodedata
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 📌 รองรับหลายชื่อ env เผื่อสะกดต่างกันระหว่างโปรเจกต์/Environment
        # รวมถึงกรณีตัวอักษรหน้าตาคล้ายกัน เช่น ALPHAVANTAGE_ΚΕY (Greek ΚΕY)
        def canonical_env_name(name):
            normalized = unicodedata.normalize('NFKC', str(name)).upper()
            confusable_map = str.maketrans({
                'Κ': 'K', 'κ': 'K',
                'Ε': 'E', 'ε': 'E',
                'Υ': 'Y', 'υ': 'Y',
                'ϒ': 'Y', 'Ϋ': 'Y', 'ý': 'Y', 'ÿ': 'Y'
            })
            normalized = normalized.translate(confusable_map)
            return ''.join(ch for ch in normalized if ch.isalnum() or ch == '_')

        def env_first(*names):
            targets = {canonical_env_name(n) for n in names}

            # 1) เช็คชื่อ env ตรง ๆ ก่อน (เร็วสุด)
            for name in names:
                value = os.environ.get(name, '')
                if value and value.strip():
                    return value.strip()

            # 2) เช็คแบบ normalize เผื่อชื่อมี unicode confusable
            for env_name, env_val in os.environ.items():
                if canonical_env_name(env_name) in targets and env_val and env_val.strip():
                    return env_val.strip()

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
