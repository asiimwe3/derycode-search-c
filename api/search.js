// DeryCode Search API - Vercel Serverless
// Multi-source: Wikipedia + DDG + Bing + Gemini-enhanced

const MAX_QUERY_WORDS = 30;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
const GEMINI_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.0-flash'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.trim().length === 0) return res.status(400).json({ error: 'Query is required' });
  
  const words = q.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) return res.status(400).json({ error: `Query too long. Max ${MAX_QUERY_WORDS} words.` });
  
  const startTime = Date.now();
  let cleaned = q.trim().replace(/\?$/, '').trim();
  cleaned = cleaned.replace(/^(what is |what is the |what is a |what are |who is |tell me about |explain |describe |how does )/i, '').trim();
  
  // Fetch from multiple sources in parallel
  const [wiki, ddg, ddgHtml, bingResults] = await Promise.all([
    fetchWikipedia(cleaned),
    fetchDuckDuckGo(cleaned),
    fetchDDGHTML(cleaned),
    fetchBing(cleaned)
  ]);
  
  // Merge and dedup
  let webResults = [...ddgHtml, ...bingResults];
  const seen = new Set();
  webResults = webResults.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
  
  // Knowledge panel
  let knowledgePanel = null;
  if (wiki) {
    knowledgePanel = { title: wiki.title, extract: wiki.extract.substring(0, 500), url: wiki.url, source: 'Wikipedia' };
  } else if (ddg) {
    knowledgePanel = { title: ddg.title, extract: ddg.content.substring(0, 500), url: ddg.url, source: 'DuckDuckGo' };
  }
  
  // Scrape top results for richer content
  for (const r of webResults.slice(0, 3)) {
    try {
      const scraped = await scrapeUrl(r.url);
      if (scraped && scraped.length > 50) {
        r.content = scraped.substring(0, 300);
        r.scraped = true;
      }
    } catch {}
  }
  
  // If still very few results, try DDG related topics
  if (webResults.length < 3 && ddg) {
    const ddgRelated = await fetchDDGRelated(cleaned);
    webResults.push(...ddgRelated);
  }
  
  // If Gemini is available and we have few results, generate a summary
  let aiSummary = null;
  if (GEMINI_API_KEY && webResults.length < 3) {
    aiSummary = await geminiSearchSummary(q, wiki, ddg, webResults);
  }
  
  const allResults = [];
  if (wiki) allResults.push({ title: wiki.title, url: wiki.url, content: wiki.extract?.substring(0,250), engine:'wikipedia', source:'Wikipedia', featured:true });
  if (ddg) allResults.push({ title: ddg.title, url: ddg.url, content: ddg.content?.substring(0,250), engine:'duckduckgo', source:'DuckDuckGo', featured:true });
  allResults.push(...webResults.slice(0, 8));
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  res.status(200).json({
    query: q, knowledgePanel, aiSummary,
    results: allResults,
    count: allResults.length, time: elapsed,
    limits: { maxQueryWords: MAX_QUERY_WORDS }
  });
}

async function geminiSearchSummary(q, wiki, ddg, webResults) {
  try {
    let context = '';
    if (wiki) context += `Wikipedia: ${wiki.extract.substring(0, 400)}\n`;
    if (ddg) context += `DDG: ${ddg.content.substring(0, 200)}\n`;
    for (const r of webResults.slice(0, 2)) {
      context += `${r.title}: ${r.content?.substring(0, 200)}\n`;
    }
    
    const prompt = `Provide a brief informative summary (max 150 words) about: "${q}". ${context ? 'Context: ' + context : ''} Answer:`;
    
    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 300 }
        }),
        signal: AbortSignal.timeout(8000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 20) {
          return text.trim().substring(0, 500);
        }
      }
      if (response.status === 429) continue;
    }
  } catch {}
  return null;
}

async function fetchDDGRelated(q) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const results = [];
    for (const t of (data.RelatedTopics || []).slice(0, 5)) {
      if (t && t.Text && t.FirstURL) {
        results.push({
          title: t.Text.substring(0, 100),
          url: t.FirstURL,
          content: t.Text.substring(0, 200),
          engine: 'duckduckgo',
          source: 'DuckDuckGo'
        });
      }
    }
    return results;
  } catch { return []; }
}

async function fetchBing(q) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}&count=10`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(6000)
    });
    const html = await r.text();
    const results = [];
    const resultRegex = /<li class="b_algo">\s*<h2><a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a><\/h2>.*?<p[^>]*>(.*?)<\/p>/gs;
    let match; let count = 0;
    while ((match = resultRegex.exec(html)) !== null && count < 8) {
      const href = match[1].replace(/&amp;/g, '&');
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const content = match[3].replace(/<[^>]*>/g, '').trim();
      if (title && href.startsWith('http')) {
        results.push({ title: title.substring(0,200), url: href, content: content.substring(0,300), engine:'bing', source:'Bing' });
        count++;
      }
    }
    return results;
  } catch { return []; }
}

async function scrapeUrl(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(5000), redirect: 'follow'
    });
    const html = await r.text();
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ').trim();
    return text.substring(0, 600);
  } catch { return ''; }
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
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
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
