// DeryCode Image Search API - Vercel Serverless
const MAX_QUERY_WORDS = 30;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.trim().length === 0) return res.status(400).json({ error: 'Query is required' });
  
  const words = q.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) return res.status(400).json({ error: `Query too long. Max ${MAX_QUERY_WORDS} words.` });
  
  const startTime = Date.now();
  
  try {
    // DuckDuckGo Image Search via HTML parsing
    const url = `https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await r.text();
    
    const images = [];
    
    // Try to extract image results from DDG
    // Method 1: Look for vqd token and use image API
    const vqdMatch = html.match(/vqd=['"](\d+(?:-\d+)?)/);
    
    if (vqdMatch) {
      const vqd = vqdMatch[1];
      const imgUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,,&p=1&s=0&sk=0&a=0`;
      
      try {
        const imgRes = await fetch(imgUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const imgData = await imgRes.json();
        
        if (imgData.results) {
          for (const item of imgData.results.slice(0, 20)) {
            images.push({
              title: (item.title || q).substring(0, 150),
              thumbnail: item.thumbnail || '',
              image: item.image || '',
              url: item.url || '',
              source: item.source || ''
            });
          }
        }
      } catch (e) {
        // Fall through to alternative methods
      }
    }
    
    // Method 2: Parse embedded JSON data
    if (images.length === 0) {
      const jsonMatches = html.match(/"thumbnail":\s*"([^"]+)"/g);
      if (jsonMatches) {
        for (const m of jsonMatches.slice(0, 20)) {
          const thumb = m.match(/"thumbnail":\s*"([^"]+)"/);
          if (thumb) {
            images.push({
              title: q,
              thumbnail: thumb[1].replace(/\\u002F/g, '/'),
              image: thumb[1].replace(/\\u002F/g, '/'),
              url: '',
              source: ''
            });
          }
        }
      }
    }
    
    // Method 3: Wikipedia images as fallback
    if (images.length === 0) {
      try {
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=400&titles=${encodeURIComponent(q)}&redirects=1`;
        const wikiRes = await fetch(wikiUrl, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
        const wikiData = await wikiRes.json();
        const pages = wikiData?.query?.pages;
        if (pages) {
          for (const page of Object.values(pages)) {
            if (page.thumbnail) {
              images.push({
                title: page.title,
                thumbnail: page.thumbnail.source,
                image: page.thumbnail.source,
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
                source: 'Wikipedia'
              });
            }
          }
        }
      } catch (e) {}
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    res.status(200).json({
      query: q,
      count: images.length,
      time: elapsed,
      images: images.slice(0, 24),
      limits: { maxQueryWords: MAX_QUERY_WORDS }
    });
  } catch (error) {
    res.status(500).json({ error: 'Image search failed', query: q, count: 0, images: [] });
  }
}
