// DeryCode Search API - Vercel Serverless
// Web search with AI summary, knowledge panel, and page scraping

const MAX_QUERY_WORDS = 30;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.trim().length === 0) return res.status(400).json({ error: 'Query is required' });
  
  const words = q.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) return res.status(400).json({ error: `Query too long. Max ${MAX_QUERY_WORDS} words.` });
  
  const startTime = Date.now();
  
  // Clean query
  let cleaned = q.trim().replace(/\?$/, '').trim();
  cleaned = cleaned.replace(/^(what is |what is the |what is a |what are |who is |tell me about |explain |describe |how does )/i, '').trim();
  
  // Fetch from multiple sources in parallel
  const [wiki, ddg, webResults] = await Promise.all([
    fetchWikipedia(cleaned),
    fetchDuckDuckGo(cleaned),
    fetchDDGHTML(cleaned)
  ]);
  
  // Knowledge panel
  let knowledgePanel = null;
  if (wiki) {
    knowledgePanel = {
      title: wiki.title,
      extract: wiki.extract.substring(0, 500),
      url: wiki.url,
      source: 'Wikipedia'
    };
  }
  
  // AI summary from collected context
  let aiSummary = '';
  if (wiki && wiki.extract) aiSummary += wiki.extract.substring(0, 400) + ' ';
  if (ddg && ddg.content) aiSummary += ddg.content.substring(0, 200) + ' ';
  for (const r of webResults.slice(0, 2)) {
    if (r.content) aiSummary += r.content.substring(0, 150) + ' ';
  }
  
  // Scrape top 2 web results for richer content
  const scrapedResults = [];
  for (const r of webResults.slice(0, 2)) {
    try {
      const scraped = await scrapeUrl(r.url);
      if (scraped && scraped.content) {
        r.content = scraped.content.substring(0, 300);
        r.scraped = true;
        if (scraped.ogImage) r.image = scraped.ogImage;
        if (scraped.siteName && !r.source) r.source = scraped.siteName;
      }
    } catch {}
  }
  
  const allResults = [];
  if (wiki) allResults.push({ title: wiki.title, url: wiki.url, content: wiki.extract?.substring(0,250), engine:'wikipedia', source:'Wikipedia', featured:true });
  if (ddg) allResults.push({ title: ddg.title, url: ddg.url, content: ddg.content?.substring(0,250), engine:'duckduckgo', source:'DuckDuckGo', featured:true });
  allResults.push(...webResults.slice(0, 8));
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  res.status(200).json({
    query: q,
    knowledgePanel,
    aiSummary: aiSummary.trim().substring(0, 800) || undefined,
    results: allResults,
    count: allResults.length,
    time: elapsed,
    limits: { maxQueryWords: MAX_QUERY_WORDS }
  });
}

async function scrapeUrl(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(5000)
    });
    const html = await r.text();
    
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    const descMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/is);
    
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    
    return {
      title: titleMatch?.[1]?.trim() || '',
      description: descMatch?.[1]?.trim() || '',
      content: text.substring(0, 500)
    };
  } catch { return null; }
}

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

async function fetchDuckDuckGo(q) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    if (data.AbstractText && data.AbstractText.length > 30) {
      return { title: data.Heading || q, content: data.AbstractText, url: data.AbstractURL || '' };
    }
    return null;
  } catch { return null; }
}

async function fetchDDGHTML(q) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    const results = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>.*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gs;
    let match; let count = 0;
    while ((match = resultRegex.exec(html)) !== null && count < 8) {
      let href = match[1].replace(/&amp;/g, '&');
      const uddg = href.match(/uddg=([^&]+)/);
      if (uddg) href = decodeURIComponent(uddg[1]);
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const content = match[3].replace(/<[^>]*>/g, '').trim();
      if (title && href.startsWith('http')) {
        results.push({ title: title.substring(0,200), url: href, content: content.substring(0,300), engine:'duckduckgo', source:'DuckDuckGo' });
        count++;
      }
    }
    return results;
  } catch { return []; }
}
