import os
import json
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 📌 ดึงค่าตามชื่อ "เป๊ะๆ" ที่คุณตั้งไว้ใน Vercel Environment
        data = {
            "ALPHAVANTAGE": os.environ.get('ALPHAVANTAGE_KEY', ''),
            "SERPER": os.environ.get('SERPER_API_KEYS', ''),
            "GEMINI": os.environ.get('GEMINI_API_KEYS', ''),
            "FINNHUB": os.environ.get('FINNHUB_KEY_KEYS', '')
        }
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        # 🚀 ป้องกันการติด Cache เผื่อเราเปลี่ยนคีย์ใหม่ใน Vercel
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Access-Control-Allow-Origin', '*') 
        self.end_headers()
        
        # ส่งข้อมูลกลับไปเป็น JSON ให้ js/keys.js ของคุณ
        self.wfile.write(json.dumps(data).encode('utf-8'))
