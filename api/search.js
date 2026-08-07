// DeryCode Search API - Vercel Serverless
// Sources: DDG API + Wikipedia external links + Gemini google_search
// No Wikipedia dependency for search results - only for knowledge panel

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
  
  // Fetch from sources that WORK from Vercel
  const [ddgFull, wiki, wikiExtLinks] = await Promise.all([
    fetchDDGFull(q),
    fetchWikipedia(cleaned),
    fetchWikipediaExtLinks(cleaned)
  ]);
  
  // If Wikipedia extlinks returned nothing, try via search
  let finalExtLinks = wikiExtLinks;
  if (finalExtLinks.length === 0) {
    finalExtLinks = await fetchWikipediaExtLinksSearch(cleaned);
  }
  
  // Build web results from DDG related topics + Wikipedia external links
  let webResults = [];
  
  // DDG related topics (these have real external URLs like stackoverflow.com, github.com, etc.)
  if (ddgFull && ddgFull.related) {
    webResults.push(...ddgFull.related);
  }
  
  // Wikipedia external links (real external websites referenced by Wikipedia)
  if (finalExtLinks && finalExtLinks.length > 0) {
    webResults.push(...finalExtLinks);
  }
  
  // If Gemini is available, use google_search tool for REAL Google results
  if (GEMINI_API_KEY) {
    const geminiResults = await geminiGoogleSearch(q);
    if (geminiResults && geminiResults.length > 0) {
      // Gemini results go FIRST (they're the best)
      webResults = [...geminiResults, ...webResults];
    }
  }
  
  // Dedup by URL
  const seen = new Set();
  webResults = webResults.filter(r => {
    const urlNorm = r.url.toLowerCase().replace(/%20/g, ' ').replace(/_/g, ' ');
    if (seen.has(urlNorm)) return false;
    seen.add(urlNorm);
    return true;
  });
  
  // Knowledge panel
  let knowledgePanel = null;
  if (wiki) {
    knowledgePanel = { title: wiki.title, extract: wiki.extract.substring(0, 400), url: wiki.url, source: 'Wikipedia' };
  } else if (ddgFull && ddgFull.instant) {
    knowledgePanel = { title: ddgFull.instant.title, extract: ddgFull.instant.content.substring(0, 400), url: ddgFull.instant.url, source: 'DuckDuckGo' };
  }
  
  // Scrape top 2 results
  const scrapePromises = webResults.slice(0, 2).map(async r => {
    try {
      const scraped = await scrapeUrl(r.url);
      if (scraped && scraped.length > 50) {
        r.content = scraped.substring(0, 400);
        r.scraped = true;
      }
    } catch {}
  });
  await Promise.all(scrapePromises);
  
  // Gemini summary
  let aiSummary = null;
  if (GEMINI_API_KEY) {
    aiSummary = await geminiSummary(q, wiki, webResults);
  }
  
  // Build final results
  const allResults = [];
  allResults.push(...webResults.slice(0, 10));
  // Add Wikipedia as knowledge panel (not as a search result)
  if (wiki && !allResults.find(r => r.url === wiki.url)) {
    allResults.unshift({ title: wiki.title, url: wiki.url, content: wiki.extract?.substring(0,300), engine:'wikipedia', source:'Wikipedia', featured:true });
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  res.status(200).json({
    query: q, knowledgePanel, aiSummary,
    results: allResults,
    count: allResults.length, time: elapsed,
    limits: { maxQueryWords: MAX_QUERY_WORDS }
  });
}

// DDG API: get instant answer + related topics (with real external URLs)
async function fetchDDGFull(q) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const result = { instant: null, related: [] };
    
    // Instant answer
    if (data.AbstractText && data.AbstractText.length > 30) {
      result.instant = { title: data.Heading || q, content: data.AbstractText, url: data.AbstractURL || '' };
    }
    
    // Related topics - these have real external URLs!
    for (const t of (data.RelatedTopics || [])) {
      if (t && t.Text && t.FirstURL) {
        // Get the actual URL (DDG API returns duckduckgo.com/... URLs for some, 
        // but the external ones are real)
        const extUrl = t.FirstURL;
        if (!extUrl.includes('duckduckgo.com')) {
          result.related.push({
            title: t.Text.substring(0, 100),
            url: extUrl,
            content: t.Text.substring(0, 200),
            engine: 'duckduckgo',
            source: 'DuckDuckGo'
          });
        }
      } else if (t && t.Topics && Array.isArray(t.Topics)) {
        for (const nt of t.Topics.slice(0, 3)) {
          if (nt.Text && nt.FirstURL && !nt.FirstURL.includes('duckduckgo.com')) {
            result.related.push({
              title: nt.Text.substring(0, 100),
              url: nt.FirstURL,
              content: nt.Text.substring(0, 200),
              engine: 'duckduckgo',
              source: 'DuckDuckGo'
            });
          }
        }
      }
    }
    
    // Also check Results array
    for (const r of (data.Results || [])) {
      if (r.FirstURL && !r.FirstURL.includes('duckduckgo.com')) {
        result.related.push({
          title: r.Text || r.FirstURL,
          url: r.FirstURL,
          content: r.Text || '',
          engine: 'duckduckgo',
          source: 'DuckDuckGo'
        });
      }
    }
    
    return result;
  } catch { return null; }
}

// Wikipedia external links - REAL external websites from Wikipedia pages
async function fetchWikipediaExtLinks(q) {
  try {
    // Use redirects=1 to handle title mismatches
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extlinks&titles=${encodeURIComponent(q)}&ellimit=15&elprotocol=https&redirects=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const pages = data?.query?.pages;
    if (!pages) return [];
    const page = Object.values(pages)[0];
    if (!page || !page.extlinks) return [];
    const results = [];
    for (const link of (page.extlinks || []).slice(0, 10)) {
      const linkUrl = link['*'];
      if (linkUrl && !linkUrl.includes('wikipedia.org') && !linkUrl.includes('wikimedia')) {
        let title = linkUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
        results.push({
          title: title,
          url: linkUrl,
          content: '',
          engine: 'web',
          source: title
        });
      }
    }
    return results;
  } catch { return []; }
}

// Gemini google_search tool - REAL Google search results

// If extlinks failed, try searching Wikipedia for the right title, then get extlinks
async function fetchWikipediaExtLinksSearch(q) {
  try {
    // Search Wikipedia for the right title
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=1&srsearch=${encodeURIComponent(q)}`;
    const searchR = await fetch(searchUrl, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const searchData = await searchR.json();
    const searchResults = searchData?.query?.search || [];
    if (searchResults.length === 0) return [];
    const exactTitle = searchResults[0].title;
    // Now get extlinks for the exact title
    return await fetchWikipediaExtLinks(exactTitle);
  } catch { return []; }
}

async function geminiGoogleSearch(q) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Search for: ${q}. List the top 5 most relevant websites with their titles and URLs. Format as: TITLE - URL` }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
      }),
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) return [];
    const data = await response.json();
    const candidate = data?.candidates?.[0];
    if (!candidate) return [];
    
    const results = [];
    
    // Extract grounding chunks (these contain real Google search results with URLs)
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
    for (const chunk of groundingChunks.slice(0, 8)) {
      const web = chunk?.web;
      if (web && web.uri) {
        results.push({
          title: web.title || web.uri,
          url: web.uri,
          content: '',
          engine: 'google',
          source: 'Google'
        });
      }
    }
    
    return results;
  } catch { return []; }
}

async function geminiSummary(q, wiki, webResults) {
  try {
    let context = '';
    if (wiki) context += `${wiki.extract.substring(0, 300)}\n`;
    for (const r of webResults.slice(0, 3)) {
      context += `${r.title}: ${r.content?.substring(0, 150)}\n`;
    }
    const prompt = `Brief summary (max 120 words) about: "${q}". ${context ? 'Context: ' + context : ''} Answer directly:`;
    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 250 }
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 20) return text.trim().replace(/\*+/g, '').substring(0, 400);
      }
      if (response.status === 429) continue;
    }
  } catch {}
  return null;
}

async function scrapeUrl(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(5000), redirect: 'follow'
    });
    const html = await r.text();
    return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().substring(0, 600);
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
