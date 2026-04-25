import os
import json
import re
import unicodedata
from http.server import BaseHTTPRequestHandler


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

    for name in names:
        value = os.environ.get(name, '')
        if value and value.strip():
            return value.strip(), name

    for env_name, env_val in os.environ.items():
        if canonical_env_name(env_name) in targets and env_val and env_val.strip():
            return env_val.strip(), env_name

    return '', ''


def split_keys(raw, fixed_length=0):
    if not raw:
        return []
    raw = str(raw).strip()

    if fixed_length > 0 and not re.search(r'[\n,;]', raw) and len(raw) >= fixed_length * 2 and len(raw) % fixed_length == 0:
        return [raw[i:i + fixed_length].strip() for i in range(0, len(raw), fixed_length) if raw[i:i + fixed_length].strip()]

    return [x.strip() for x in re.split(r'[\n,;]+', raw) if x.strip()]


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        alpha_raw, alpha_env = env_first('ALPHAVANTAGE_KEY', 'ALPHAVANTAGE_KEYS', 'ALPHAVANTAGE_API_KEY')
        serper_raw, serper_env = env_first('SERPER_API_KEYS', 'SERPER_KEYS', 'SERPER_API_KEY')
        gemini_raw, gemini_env = env_first('GEMINI_API_KEYS', 'GEMINI_KEYS', 'GEMINI_API_KEY')
        finnhub_raw, finnhub_env = env_first('FINNHUB_KEY_KEYS', 'FINNHUB_API_KEYS', 'FINNHUB_KEYS', 'FINNHUB_KEY')

        alpha_count = len(split_keys(alpha_raw))
        serper_count = len(split_keys(serper_raw))
        gemini_count = len(split_keys(gemini_raw))
        finnhub_count = len(split_keys(finnhub_raw, 20))

        data = {
            "ok": True,
            "sources": {
                "ALPHAVANTAGE": alpha_env or None,
                "SERPER": serper_env or None,
                "GEMINI": gemini_env or None,
                "FINNHUB": finnhub_env or None
            },
            "counts": {
                "ALPHAVANTAGE": alpha_count,
                "SERPER": serper_count,
                "GEMINI": gemini_count,
                "FINNHUB": finnhub_count
            },
            "has_keys": {
                "ALPHAVANTAGE": alpha_count > 0,
                "SERPER": serper_count > 0,
                "GEMINI": gemini_count > 0,
                "FINNHUB": finnhub_count > 0
            }
        }

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
