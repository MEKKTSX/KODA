export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const { symbol, range = '1y' } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });

    const rangeMap = { '3M': '3mo', '6M': '6mo', '1Y': '1y', '3Y': '5y' };
    const yahooRange = rangeMap[range] || range;

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${yahooRange}&interval=1d`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://finance.yahoo.com/',
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Yahoo returned ${response.status}` });
        }

        const data = await response.json();
        res.status(200).json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

