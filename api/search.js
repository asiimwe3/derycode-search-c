// DeryCode Search API - Vercel Serverless
// Primary: Startpage (Google results, works from Vercel!)
// Knowledge panel: Wikipedia API
// NO Gemini dependency

const MAX_QUERY_WORDS = 60;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.trim().length === 0) return res.status(400).json({ error: 'Query is required' });
  
  const words = q.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) return res.status(400).json({ error: `Query too long. Max ${MAX_QUERY_WORDS} words.` });
  
  const startTime = Date.now();
  let cleaned = q.trim().replace(/\?$/, '').trim();
  cleaned = cleaned.replace(/^(what is |what is the |what is a |what are |who is |tell me about |explain |describe |how does )/i, '').trim();
  
  // PRIMARY: Startpage search (uses Google results, works from Vercel!)
  let webResults = await fetchStartpage(q);
  
  // SECONDARY: Wikipedia knowledge panel only
  const wiki = await fetchWikipedia(cleaned);
  
  // Knowledge panel
  let knowledgePanel = null;
  if (wiki) {
    knowledgePanel = { title: wiki.title, extract: wiki.extract.substring(0, 800), url: wiki.url, source: 'Wikipedia' };
  }
  
  // Build final results
  const allResults = [];
  allResults.push(...webResults.slice(0, 20));
  // Add Wikipedia as knowledge panel
  if (wiki && !allResults.find(r => r.url === wiki.url)) {
    allResults.unshift({ 
      title: wiki.title, 
      url: wiki.url, 
      content: wiki.extract?.substring(0, 600), 
      engine: 'wikipedia', 
      source: 'Wikipedia', 
      featured: true 
    });
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  res.status(200).json({
    query: q, 
    knowledgePanel,
    results: allResults,
    count: allResults.length, 
    time: elapsed,
    limits: { maxQueryWords: MAX_QUERY_WORDS }
  });
}

// PRIMARY: Startpage search (privacy search engine using Google results)
async function fetchStartpage(q) {
  const results = [];
  try {
    // Page 1
    const r1 = await fetch('https://www.startpage.com/sp/search', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      body: `query=${encodeURIComponent(q)}&cat=web`,
      signal: AbortSignal.timeout(10000)
    });
    const html1 = await r1.text();
    
    // Extract hidden form fields for pagination (session token)
    const hiddenInputs = {};
    const inputMatches = [...html1.matchAll(/<input[^>]*type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)];
    for (const m of inputMatches) {
      hiddenInputs[m[1]] = m[2];
    }
    
    // Build page 2 body with session token
    let page2Body = `query=${encodeURIComponent(q)}&cat=web&page=2`;
    for (const [k, v] of Object.entries(hiddenInputs)) {
      page2Body += `&${k}=${encodeURIComponent(v)}`;
    }
    
    // Fetch page 2 using the session token
    let html2 = '';
    try {
      const r2 = await fetch('https://www.startpage.com/sp/search', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        body: page2Body,
        signal: AbortSignal.timeout(10000)
      });
      html2 = await r2.text();
    } catch {}
    
    // Parse both pages
    const htmls = [html1, html2];
    for (const html of htmls) {
    
    // Parse result titles and URLs
    // Startpage pattern: <a class="w-gl__result-title" href="URL">Title</a>
    const titleMatches = [...html.matchAll(/<a[^>]*class="[^"]*result-title[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs)];
    
    for (const m of titleMatches.slice(0, 20)) {
      let url = m[1];
      let title = m[2].replace(/<[^>]+>/g, '').trim();
      
      // Clean title (remove CSS artifacts)
      if (title.includes('.css-')) continue;
      title = title.replace(/\{[^}]*\}/g, '').trim();
      
      // Find snippet near this result
      const resultBlock = html.substring(m.index, m.index + 1500);
      const snippetMatch = resultBlock.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/p>/s) 
                        || resultBlock.match(/<span[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/span>/s)
                        || resultBlock.match(/class="[^"]*text[^"]*"[^>]*>(.*?)<\/p>/s);
      let snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '';
      
      // Get domain for source label
      let domain = '';
      try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
      
      if (title.length > 3 && url.startsWith('http')) {
        results.push({
          title: title.substring(0, 200),
          url: url,
          content: snippet.substring(0, 500),
          engine: 'startpage',
          source: domain || 'Startpage'
        });
      }
    }
    
    }
    return results;
  } catch (e) {
    console.error('Startpage error:', e.message);
    return results;
  }
}

// Wikipedia knowledge panel
async function fetchWikipedia(q) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(q)}&redirects=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) return null;
    return { title: page.title, extract: page.extract || '', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}` };
  } catch { return null; }
}
