// DeryCode Code Search API - Vercel Serverless
const MAX_QUERY_WORDS = 30;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.trim().length === 0) return res.status(400).json({ error: 'Query is required' });
  
  const words = q.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) return res.status(400).json({ error: `Query too long. Max ${MAX_QUERY_WORDS} words.` });
  
  const startTime = Date.now();
  const results = [];
  
  try {
    // GitHub Code Search via API (unauthenticated, limited results)
    try {
      const ghUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=10`;
      const r = await fetch(ghUrl, { headers: { 'User-Agent': 'DeryCodeSearch/1.0', 'Accept': 'application/vnd.github.v3+json' } });
      const data = await r.json();
      
      if (data.items) {
        for (const repo of data.items.slice(0, 10)) {
          results.push({
            title: repo.full_name,
            url: repo.html_url,
            content: (repo.description || '').substring(0, 250),
            stars: repo.stargazers_count || 0,
            language: repo.language || '',
            engine: 'github',
            source: 'GitHub',
            type: 'repository'
          });
        }
      }
    } catch (e) {}
    
    // DuckDuckGo as supplementary
    if (results.length < 5) {
      try {
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q + ' code github programming')} `;
        const r = await fetch(ddgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await r.text();
        const re = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>.*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gs;
        let m; let c = 0;
        while ((m = re.exec(html)) !== null && c < 5) {
          let href = m[1].replace(/&amp;/g, '&');
          const uddg = href.match(/uddg=([^&]+)/);
          if (uddg) href = decodeURIComponent(uddg[1]);
          const title = m[2].replace(/<[^>]*>/g, '').trim();
          const content = m[3].replace(/<[^>]*>/g, '').trim();
          if (title && href.startsWith('http') && !results.some(r => r.url === href)) {
            results.push({
              title: title.substring(0, 200),
              url: href,
              content: content.substring(0, 250),
              stars: 0,
              language: '',
              engine: 'duckduckgo',
              source: 'DuckDuckGo',
              type: 'web'
            });
            c++;
          }
        }
      } catch (e) {}
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    res.status(200).json({
      query: q,
      count: results.length,
      time: elapsed,
      results: results.slice(0, 12),
      limits: { maxQueryWords: MAX_QUERY_WORDS }
    });
  } catch (error) {
    res.status(500).json({ error: 'Code search failed', query: q, count: 0, results: [] });
  }
}
