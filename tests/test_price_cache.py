import importlib.util
import sys
import types
import unittest
from pathlib import Path


def load_price_module():
    sys.modules.setdefault('yfinance', types.SimpleNamespace(Ticker=lambda symbol: None))
    sys.modules.setdefault('pandas', types.SimpleNamespace(Timestamp=types.SimpleNamespace(utcnow=lambda: None)))
    sys.modules.setdefault('pytz', types.SimpleNamespace(timezone=lambda name: None))

    module_path = Path(__file__).resolve().parents[1] / 'api' / 'price' / 'index.py'
    spec = importlib.util.spec_from_file_location('koda_price_index', module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PriceCacheTests(unittest.TestCase):
    def setUp(self):
        self.price = load_price_module()
        self.price.PRICE_CACHE.clear()

    def test_price_policy_uses_short_regular_market_ttl(self):
        ttl, header = self.price.get_cache_policy('price', 'REGULAR')

        self.assertEqual(ttl, 30)
        self.assertIn('s-maxage=30', header)
        self.assertIn('stale-while-revalidate=60', header)

    def test_price_policy_uses_longer_closed_market_ttl(self):
        ttl, header = self.price.get_cache_policy('price', 'CLOSED')

        self.assertEqual(ttl, 300)
        self.assertIn('s-maxage=300', header)

    def test_slow_modes_have_long_ttl(self):
        for mode in ('fx', 'financials', 'analysis'):
            ttl, header = self.price.get_cache_policy(mode)

            self.assertGreaterEqual(ttl, 21600)
            self.assertIn('public', header)

    def test_cache_get_expires_entries(self):
        response = {'success': True, 'symbol': 'AAPL'}
        self.price.cache_set('price|symbol:AAPL', response, 30, 'public, s-maxage=30', now=100)

        self.assertEqual(self.price.cache_get('price|symbol:AAPL', now=129), (response, 'public, s-maxage=30'))
        self.assertIsNone(self.price.cache_get('price|symbol:AAPL', now=131))
        self.assertNotIn('price|symbol:AAPL', self.price.PRICE_CACHE)

    def test_cache_key_includes_mode_and_query_dimensions(self):
        key = self.price.make_cache_key('chart', {
            'symbol': ['aapl'],
            'range': ['1y'],
            'interval': ['1d']
        })

        self.assertEqual(key, 'chart|symbol:AAPL|range:1Y|interval:1D')


if __name__ == '__main__':
    unittest.main()
