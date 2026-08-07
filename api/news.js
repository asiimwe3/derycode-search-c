// DeryCode News Search API - Vercel Serverless
const MAX_QUERY_WORDS = 500;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.trim().length === 0) return res.status(400).json({ error: 'Query is required' });
  
  const words = q.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) return res.status(400).json({ error: `Query too long. Max ${MAX_QUERY_WORDS} words.` });
  
  const startTime = Date.now();
  const articles = [];
  
  try {
    // Method 1: Google News RSS
    try {
      const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      const r = await fetch(googleNewsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const xml = await r.text();
      
      // Parse RSS XML
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
      for (const item of items.slice(0, 12)) {
        const title = item.match(/<title>(.*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '') || '';
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
        const desc = item.match(/<description>(.*?)<\/description>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '')?.replace(/<[^>]+>/g, '') || '';
        const source = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || '';
        
        if (title && link) {
          articles.push({
            title: title.substring(0, 200),
            url: link,
            content: desc.substring(0, 250),
            date: pubDate,
            source: source,
            engine: 'google-news'
          });
        }
      }
    } catch (e) {}
    
    // Method 2: DuckDuckGo News as fallback
    if (articles.length === 0) {
      try {
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&iar=news`;
        const r = await fetch(ddgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await r.text();
        
        const re = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>.*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gs;
        let m; let c = 0;
        while ((m = re.exec(html)) !== null && c < 10) {
          let href = m[1].replace(/&amp;/g, '&');
          const uddg = href.match(/uddg=([^&]+)/);
          if (uddg) href = decodeURIComponent(uddg[1]);
          const title = m[2].replace(/<[^>]*>/g, '').trim();
          const content = m[3].replace(/<[^>]*>/g, '').trim();
          if (title && href.startsWith('http')) {
            articles.push({
              title: title.substring(0, 200),
              url: href,
              content: content.substring(0, 250),
              date: '',
              source: 'DuckDuckGo',
              engine: 'duckduckgo'
            });
            c++;
          }
        }
      } catch (e) {}
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    res.status(200).json({
      query: q,
      count: articles.length,
      time: elapsed,
      articles: articles.slice(0, 15),
      limits: { maxQueryWords: MAX_QUERY_WORDS }
    });
  } catch (error) {
    res.status(500).json({ error: 'News search failed', query: q, count: 0, articles: [] });
  }
}
