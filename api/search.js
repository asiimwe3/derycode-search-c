// DeryCode Search API - Vercel Serverless
// Sources: Wikipedia (search+extract) + DDG API + Gemini-enhanced results

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
  const [wiki, ddg, ddgHtml, wikiSearch, wikiRelated, wikiExtLinks] = await Promise.all([
    fetchWikipedia(cleaned),
    fetchDuckDuckGo(cleaned),
    fetchDDGHTML(cleaned),
    fetchWikipediaSearch(cleaned),
    fetchWikipediaRelated(cleaned),
    fetchWikipediaExtLinks(cleaned)
  ]);
  
  // Merge results
  let webResults = [...ddgHtml];
  
  // Add Wikipedia external links FIRST (these are real external websites!)
  if (wikiExtLinks && wikiExtLinks.length > 0) {
    for (const el of wikiExtLinks) {
      if (!webResults.find(r => r.url === el.url)) {
        webResults.push(el);
      }
    }
  }
  // Add Wikipedia search results
  if (wikiSearch && wikiSearch.length > 0) {
    for (const ws of wikiSearch) {
      if (!webResults.find(r => r.url === ws.url)) {
        webResults.push(ws);
      }
    }
  }
  // Add Wikipedia related pages
  if (wikiRelated && wikiRelated.length > 0) {
    for (const wr of wikiRelated) {
      if (!webResults.find(r => r.url === wr.url)) {
        webResults.push(wr);
      }
    }
  }
  
  // Dedup by URL (normalize Wikipedia URLs - %20 and _ are equivalent)
  const seen = new Set();
  webResults = webResults.filter(r => {
    let urlNorm = r.url.toLowerCase()
      .replace(/%20/g, ' ')
      .replace(/_/g, ' ')
      .replace(/%28/g, '(')
      .replace(/%29/g, ')')
      .replace(/%27/g, "'");
    urlNorm = urlNorm.split('#')[0];
    if (seen.has(urlNorm)) return false;
    seen.add(urlNorm);
    return true;
  });
  
  // Try DDG related topics
  if (webResults.length < 3) {
    const ddgRelated = await fetchDDGRelated(cleaned);
    webResults.push(...ddgRelated);
  }
  
  // Knowledge panel
  let knowledgePanel = null;
  if (wiki) {
    knowledgePanel = { title: wiki.title, extract: wiki.extract.substring(0, 500), url: wiki.url, source: 'Wikipedia' };
  } else if (ddg) {
    knowledgePanel = { title: ddg.title, extract: ddg.content.substring(0, 500), url: ddg.url, source: 'DuckDuckGo' };
  }
  
  // Scrape top results for richer content
  const scrapePromises = webResults.slice(0, 3).map(async r => {
    try {
      const scraped = await scrapeUrl(r.url);
      if (scraped && scraped.length > 50) {
        r.content = scraped.substring(0, 400);
        r.scraped = true;
      }
    } catch {}
  });
  await Promise.all(scrapePromises);
  
  // Gemini summary + Gemini-generated related links
  let aiSummary = null;
  let geminiLinks = [];
  if (GEMINI_API_KEY) {
    const geminiData = await geminiSearchEnhance(q, wiki, ddg, webResults);
    aiSummary = geminiData.summary;
    geminiLinks = geminiData.links;
    // Add Gemini-generated links if we have few web results
    for (const gl of geminiLinks) {
      if (!webResults.find(r => r.url === gl.url)) {
        webResults.push(gl);
      }
    }
  }
  
  // Build final results
  const allResults = [];
  if (wiki) allResults.push({ title: wiki.title, url: wiki.url, content: wiki.extract?.substring(0,300), engine:'wikipedia', source:'Wikipedia', featured:true });
  if (ddg) allResults.push({ title: ddg.title, url: ddg.url, content: ddg.content?.substring(0,300), engine:'duckduckgo', source:'DuckDuckGo', featured:true });
  // Dedup against featured results
  const featuredUrls = new Set(allResults.map(r => r.url.toLowerCase().replace(/%20/g,' ').replace(/_/g,' ')));
  for (const r of webResults) {
    const rNorm = r.url.toLowerCase().replace(/%20/g,' ').replace(/_/g,' ');
    if (!featuredUrls.has(rNorm) && allResults.length < 10) {
      allResults.push(r);
      featuredUrls.add(rNorm);
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  res.status(200).json({
    query: q, knowledgePanel, aiSummary,
    results: allResults,
    count: allResults.length, time: elapsed,
    limits: { maxQueryWords: MAX_QUERY_WORDS }
  });
}

// Gemini-enhanced search: generates summary + suggests real related URLs
async function geminiSearchEnhance(q, wiki, ddg, webResults) {
  let summary = null;
  let links = [];
  
  try {
    let context = '';
    if (wiki) context += `Wikipedia: ${wiki.extract.substring(0, 400)}\n`;
    if (ddg) context += `DDG: ${ddg.content.substring(0, 200)}\n`;
    for (const r of webResults.slice(0, 2)) {
      context += `${r.title}: ${r.content?.substring(0, 200)}\n`;
    }
    
    // Prompt for summary + related links
    const prompt = `You are a search assistant. For the query "${q}", provide:
1. A brief summary (max 150 words)
2. 3-5 related websites with their URLs (real, well-known websites)

Context: ${context || 'No additional context available.'}

Format your response as JSON:
{"summary": "...", "links": [{"title": "...", "url": "https://...", "description": "..."}]}

Only include real, existing websites. Do not make up URLs.`;

    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 600 }
        }),
        signal: AbortSignal.timeout(8000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 20) {
          // Try to parse JSON from response
          try {
            // Find JSON in the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.summary) summary = parsed.summary.trim();
              if (parsed.links && Array.isArray(parsed.links)) {
                links = parsed.links.filter(l => l.url && l.url.startsWith('http')).map(l => ({
                  title: l.title || l.url,
                  url: l.url,
                  content: l.description || '',
                  engine: 'gemini',
                  source: 'AI Recommended'
                }));
              }
            } else {
              // If no JSON, just use the text as summary
              summary = text.trim().substring(0, 500);
            }
          } catch {
            summary = text.trim().substring(0, 500);
          }
          break;
        }
      }
      if (response.status === 429) continue;
    }
  } catch {}
  
  return { summary, links };
}

// Wikipedia search API (returns multiple matching pages)

// Wikipedia REST API - get related pages

// Wikipedia External Links - get actual external URLs from Wikipedia page
async function fetchWikipediaExtLinks(q) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extlinks&titles=${encodeURIComponent(q)}&ellimit=15&elprotocol=https`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const pages = data?.query?.pages;
    if (!pages) return [];
    const page = Object.values(pages)[0];
    if (!page || !page.extlinks) return [];
    const results = [];
    for (const link of (page.extlinks || []).slice(0, 8)) {
      const linkUrl = link['*'];
      if (linkUrl && !linkUrl.includes('wikipedia.org') && !linkUrl.includes('wikimedia')) {
        // Try to get a title from the URL
        let title = linkUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
        results.push({
          title: title,
          url: linkUrl,
          content: 'External link from Wikipedia',
          engine: 'web',
          source: 'Wikipedia External'
        });
      }
    }
    return results;
  } catch { return []; }
}

async function fetchWikipediaRelated(q) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=links&titles=${encodeURIComponent(q)}&pllimit=5`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const pages = data?.query?.pages;
    if (!pages) return [];
    const page = Object.values(pages)[0];
    if (!page || !page.links) return [];
    const results = [];
    for (const link of (page.links || []).slice(0, 5)) {
      results.push({
        title: link.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(link.title.replace(/ /g, '_'))}`,
        content: '',
        engine: 'wikipedia',
        source: 'Wikipedia Related'
      });
    }
    return results;
  } catch { return []; }
}

async function fetchWikipediaSearch(q) {
  try {
    // Use Wikipedia's search API to find related pages
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=3&srsearch=${encodeURIComponent(q)}&srprop=snippet`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const searchResults = data?.query?.search || [];
    const results = [];
    for (const sr of searchResults) {
      const title = sr.title;
      const snippet = (sr.snippet || '').replace(/<[^>]*>/g, '').trim();
      results.push({
        title: title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        content: snippet.substring(0, 300),
        engine: 'wikipedia',
        source: 'Wikipedia'
      });
    }
    return results;
  } catch { return []; }
}

async function fetchDDGRelated(q) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const results = [];
    for (const t of (data.RelatedTopics || []).slice(0, 10)) {
      if (t && t.Text && t.FirstURL) {
        results.push({
          title: t.Text.substring(0, 100),
          url: t.FirstURL,
          content: t.Text.substring(0, 200),
          engine: 'duckduckgo',
          source: 'DuckDuckGo'
        });
      } else if (t && t.Topics && Array.isArray(t.Topics)) {
        // Nested topics
        for (const nt of t.Topics.slice(0, 3)) {
          if (nt.Text && nt.FirstURL) {
            results.push({
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
