import { createClient } from '@supabase/supabase-js';

const TABLE_NAME = 'world_news';
const MAX_RETURNED_NEWS = 15;
const MAX_NEW_INSERTS_PER_RUN = 12;
const REQUEST_TIMEOUT_MS = 10000;

function getSupabaseClient() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    return createClient(url, serviceKey);
}

function decodeEntities(value = '') {
    return value
        .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value = '') {
    return decodeEntities(value)
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeDate(value) {
    const parsed = value ? new Date(value) : new Date();
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        return new Date().toISOString();
    }
    return parsed.toISOString();
}

function tagValue(xml, tagName) {
    const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    return decodeEntities(xml.match(pattern)?.[1] || '').trim();
}

function parseXmlFeed(xml, sourceName) {
    const blocks = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];

    return blocks.slice(0, 8).map(block => {
        const title = stripHtml(tagValue(block, 'title'));
        const summary = stripHtml(
            tagValue(block, 'description') ||
            tagValue(block, 'content:encoded') ||
            tagValue(block, 'content') ||
            tagValue(block, 'summary')
        ).substring(0, 260);

        let link = tagValue(block, 'link');
        if (!link) {
            link = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || '';
        }

        const pubDate =
            tagValue(block, 'pubDate') ||
            tagValue(block, 'published') ||
            tagValue(block, 'updated') ||
            tagValue(block, 'dc:date');

        return {
            title,
            link: stripHtml(link),
            summary: summary || 'Open KODA AI analysis for deeper context on this event.',
            source: sourceName,
            created_at: normalizeDate(pubDate)
        };
    }).filter(item => item.title && item.link);
}

function normalizeProxyItems(items, sourceName) {
    return items.slice(0, 8).map(item => ({
        title: stripHtml(item.title || ''),
        link: (item.link || item.guid || '').trim(),
        summary: stripHtml(item.description || item.content || item.content_text || '').substring(0, 260) ||
            'Open KODA AI analysis for deeper context on this event.',
        source: sourceName,
        created_at: normalizeDate(item.pubDate || item.published || item.updated)
    })).filter(item => item.title && item.link);
}

async function fetchWithTimeout(url) {
    return fetch(url, {
        headers: {
            'User-Agent': 'KODA-NewsBot/1.0 (+https://github.com/MEKKTSX/KODA)',
            'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*'
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
}

async function fetchDirectFeed(feedUrl, sourceName) {
    const response = await fetchWithTimeout(feedUrl);
    if (!response.ok) {
        throw new Error(`Direct feed returned ${response.status}`);
    }

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('json') || text.trim().startsWith('{')) {
        const data = JSON.parse(text);
        return normalizeProxyItems(data.items || data.entries || [], sourceName);
    }

    return parseXmlFeed(text, sourceName);
}

async function fetchProxyFeed(feedUrl, sourceName) {
    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&_=${Date.now()}`;
    const response = await fetchWithTimeout(proxyUrl);
    if (!response.ok) {
        throw new Error(`rss2json returned ${response.status}`);
    }

    const data = await response.json();
    return normalizeProxyItems(data.items || [], sourceName);
}

async function fetchSource(source) {
    const feedUrls = [source.url, ...(source.fallbackUrls || [])];
    const errors = [];

    for (const feedUrl of feedUrls) {
        for (const loader of [fetchDirectFeed, fetchProxyFeed]) {
            try {
                const items = await loader(feedUrl, source.name);
                if (items.length > 0) {
                    return items;
                }
            } catch (error) {
                errors.push(`${feedUrl}: ${error.message}`);
            }
        }
    }

    console.warn(`[News Fetch Failure] ${source.name}`, errors);
    return [];
}

function dedupeNews(items) {
    const seen = new Set();
    const unique = [];

    for (const item of items) {
        const key = (item.link || item.title).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
    }

    return unique.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function interleaveFeeds(feeds) {
    const mixed = [];
    const maxLength = Math.max(0, ...feeds.map(feed => feed.length));

    for (let index = 0; index < maxLength; index++) {
        for (const feed of feeds) {
            if (feed[index]) mixed.push(feed[index]);
        }
    }

    return dedupeNews(mixed);
}

async function translateHeadlineToThai(englishTitle, sourceName, apiKey) {
    if (!apiKey) return englishTitle;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    const prompt = `Translate this finance/world-news headline into concise Thai. Return only one Thai headline, no quotes, no prefix.

Source: ${sourceName}
Headline: ${englishTitle}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });

        if (!response.ok) return englishTitle;

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || englishTitle;
    } catch {
        return englishTitle;
    }
}

async function insertNewItems(supabase, newsItems, geminiKeys) {
    let savedCount = 0;
    const errors = [];

    for (const news of newsItems) {
        if (savedCount >= MAX_NEW_INSERTS_PER_RUN) break;

        const { data: exists, error: existsError } = await supabase
            .from(TABLE_NAME)
            .select('id')
            .eq('source_url', news.link)
            .maybeSingle();

        if (existsError) {
            errors.push(`lookup failed for ${news.link}: ${existsError.message}`);
            continue;
        }
        if (exists) continue;

        const currentKey = geminiKeys[savedCount % Math.max(geminiKeys.length, 1)];
        const thaiTitle = await translateHeadlineToThai(news.title, news.source, currentKey);
        const { error: insertError } = await supabase.from(TABLE_NAME).insert([{
            title: thaiTitle,
            summary: news.summary,
            source_url: news.link,
            source_name: news.source,
            news_type: news.source.includes('Trump') ? 'truth' : 'geo',
            published_time: news.created_at,
            created_at: news.created_at
        }]);

        if (insertError) {
            errors.push(`insert failed for ${news.link}: ${insertError.message}`);
            continue;
        }

        savedCount++;
    }

    return { savedCount, errors };
}

async function pruneOldNews(supabase) {
    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('id')
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Supabase prune lookup failed: ${error.message}`);
    if (!data || data.length <= MAX_RETURNED_NEWS) return;

    const idsToDelete = data.slice(MAX_RETURNED_NEWS).map(item => item.id);
    const { error: deleteError } = await supabase.from(TABLE_NAME).delete().in('id', idsToDelete);
    if (deleteError) throw new Error(`Supabase prune delete failed: ${deleteError.message}`);
}

async function getLatestNews(supabase) {
    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(MAX_RETURNED_NEWS);

    if (error) throw new Error(`Supabase latest news lookup failed: ${error.message}`);
    return data || [];
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const supabase = getSupabaseClient();
        const cacheOnly = req.query?.cache === '1' || req.query?.mode === 'cache';
        const geminiKeys = (process.env.GEMINI_API_KEYS || '')
            .split(',')
            .map(key => key.trim())
            .filter(Boolean);

        if (cacheOnly) {
            await pruneOldNews(supabase);
            const freshNewsData = await getLatestNews(supabase);

            return res.status(200).json({
                success: true,
                data: freshNewsData,
                processed: 0,
                fetched: 0,
                cacheOnly: true,
                warnings: []
            });
        }

        const sources = [
            {
                name: 'Donald Trump (Truth Social)',
                url: 'https://rsshub.app/truthsocial/user/realDonaldTrump',
                fallbackUrls: ['https://www.trumpstruth.org/feed']
            },
            { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
            { name: 'CNBC World', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362' },
            { name: 'The Guardian World', url: 'https://www.theguardian.com/world/rss' },
            { name: 'Investing.com', url: 'https://www.investing.com/rss/news.rss' },
            { name: 'Seeking Alpha', url: 'https://seekingalpha.com/feed.xml' }
        ];

        const fetchedFeeds = await Promise.all(sources.map(fetchSource));
        const aggregatedNews = interleaveFeeds(fetchedFeeds);
        const { savedCount, errors } = await insertNewItems(supabase, aggregatedNews, geminiKeys);

        await pruneOldNews(supabase);
        const freshNewsData = await getLatestNews(supabase);

        return res.status(200).json({
            success: true,
            data: freshNewsData,
            processed: savedCount,
            fetched: aggregatedNews.length,
            sources: sources.map((source, index) => ({
                name: source.name,
                count: fetchedFeeds[index]?.length || 0
            })),
            warnings: errors
        });
    } catch (err) {
        console.error('[World News Pipeline Error]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
