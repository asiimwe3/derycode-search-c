// DeryCode Image Search API - Vercel Serverless
const MAX_QUERY_WORDS = 60;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.trim().length === 0) return res.status(400).json({ error: 'Query is required' });
  
  const words = q.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) return res.status(400).json({ error: `Query too long. Max ${MAX_QUERY_WORDS} words.` });
  
  const startTime = Date.now();
  const images = [];
  
  // Method 1: DuckDuckGo Image Search (with Referer header - critical!)
  try {
    const ddgUrl = `https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`;
    const r = await fetch(ddgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' }
    });
    const html = await r.text();
    
    const vqdMatch = html.match(/vqd=['"](\d+(?:-\d+)?)/);
    
    if (vqdMatch) {
      const vqd = vqdMatch[1];
      const imgUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,,&p=1&s=0&sk=0&a=0`;
      
      try {
        const imgRes = await fetch(imgUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Referer': 'https://duckduckgo.com/',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(8000)
        });
        const imgData = await imgRes.json();
        
        if (imgData.results) {
          for (const item of imgData.results.slice(0, 20)) {
            images.push({
              title: (item.title || q).substring(0, 150),
              thumbnail: item.thumbnail || '',
              image: item.image || '',
              url: item.url || '',
              source: item.source || 'DuckDuckGo'
            });
          }
        }
      } catch (e) {
        console.error('DDG i.js error:', e.message);
      }
    }
  } catch (e) {
    console.error('DDG page error:', e.message);
  }
  
  // Method 2: Bing Images (parse HTML)
  if (images.length < 6) {
    try {
      const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&form=HDRSC2`;
      const r = await fetch(bingUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        signal: AbortSignal.timeout(8000)
      });
      const html = await r.text();
      
      const murlMatches = [...html.matchAll(/murl&quot;:&quot;([^&]+)&quot;/g)];
      
      for (let i = 0; i < Math.min(murlMatches.length, 20); i++) {
        const imageUrl = murlMatches[i][1];
        if (imageUrl.startsWith('http') && !imageUrl.includes('bing.net/th')) {
          images.push({
            title: q,
            thumbnail: imageUrl,
            image: imageUrl,
            url: '',
            source: 'Bing'
          });
        }
      }
    } catch (e) {
      console.error('Bing images error:', e.message);
    }
  }
  
  // Method 3: Wikipedia images as fallback
  if (images.length < 3) {
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
    } catch (e) {
      console.error('Wiki images error:', e.message);
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  res.status(200).json({
    query: q,
    count: images.length,
    time: elapsed,
    images: images.slice(0, 24),
    limits: { maxQueryWords: MAX_QUERY_WORDS }
  });
}
