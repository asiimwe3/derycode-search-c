// DeryCode Search API - Vercel Serverless
// Deep Search: 11 sources - surfaces what other engines hide
// Relevance-scored, academic sources conditional

const MAX_QUERY_WORDS = 60;

function isAcademicQuery(q) {
  const academic = ['research', 'paper', 'study', 'theory', 'algorithm', 'analysis',
    'physics', 'chemistry', 'biology', 'mathematics', 'quantum', 'neural',
    'machine learning', 'deep learning', 'artificial intelligence', 'experiment',
    'hypothesis', 'thesis', 'dissertation', 'journal', 'publication', 'scientific'];
  const lower = q.toLowerCase();
  return academic.some(k => lower.includes(k));
}

function getKeywords(q) {
  const stop = new Set(['the','a','an','is','are','how','to','do','does','what','who',
    'can','i','you','my','me','we','our','and','or','but','in','on','at','for',
    'of','with','from','by','about','into','your','this','that','it','its',
    'tell','explain','describe','show','give','want','need','like','please']);
  return q.toLowerCase().split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w))
    .map(w => w.replace(/[^a-z0-9]/g, ''));
}

function relevanceScore(result, keywords) {
  if (keywords.length === 0) return 50;
  const titleLower = (result.title || '').toLowerCase();
  const contentLower = (result.content || '').toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (kw.length < 3) continue;
    if (titleLower.includes(kw)) score += 15;
    if (contentLower.includes(kw)) score += 5;
  }
  // Penalty for academic content in non-academic queries
  if (!keywords.some(k => ['research','paper','physics','quantum','algorithm','neural','study','theory'].includes(k))) {
    const academicSignals = ['decay', 'particle', 'gravitational', 'quantum', 'experiment',
      'detector', 'physics', 'neutrino', 'boson', 'collider', 'lhc', 'atlas', 'cms'];
    for (const a of academicSignals) {
      if (titleLower.includes(a)) score -= 25;
    }
  }
  return Math.max(0, Math.min(100, score));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.trim().length === 0) return res.status(400).json({ error: 'Query is required' });
  
  const words = q.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) return res.status(400).json({ error: `Query too long. Max ${MAX_QUERY_WORDS} words.` });
  
  const startTime = Date.now();
  const cleaned = q.trim().replace(/\?$/, '').trim()
    .replace(/^(what is |what is the |what is a |what are |who is |tell me about |explain |describe |how does )/i, '').trim();
  
  const academic = isAcademicQuery(q);
  const keywords = getKeywords(q);
  
  const sources = [
    fetchStartpage(q),
    fetchDuckDuckGo(q),
    fetchWikipedia(cleaned).then(w => w ? [{ title: w.title, url: w.url, content: (w.extract||'').substring(0,600), engine: 'wikipedia', source: 'Wikipedia', featured: true }] : []),
    fetchReddit(q),
    fetchHackerNews(q),
    fetchStackExchange(q),
    academic ? fetchArxiv(q) : Promise.resolve([]),
    fetchArchive(q),
    fetchOpenLibrary(q),
    academic ? fetchSemanticScholar(q) : Promise.resolve([]),
    fetchGitHub(q)
  ];
  
  const settled = await Promise.allSettled(sources);
  const allResults = [];
  const sourcesUsed = [];
  const sourceNames = ['startpage', 'duckduckgo', 'wikipedia', 'reddit', 'hackernews', 'stackexchange', 'arxiv', 'archive', 'openlibrary', 'semantic-scholar', 'github'];
  let knowledgePanel = null;
  
  settled.forEach((result, idx) => {
    if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
      if (idx === 2) {
        const wiki = result.value[0];
        knowledgePanel = { title: wiki.title, extract: wiki.content, url: wiki.url, source: 'Wikipedia' };
      }
      sourcesUsed.push(sourceNames[idx]);
      for (const r of result.value) r._score = relevanceScore(r, keywords);
      allResults.push(...result.value);
    }
  });
  
  // Sort by relevance
  allResults.sort((a, b) => (b._score || 0) - (a._score || 0));
  
  // Soft dedup
  const seen = new Set();
  const deduped = allResults.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  res.status(200).json({
    query: q, knowledgePanel,
    results: deduped,
    count: deduped.length, sources: sourcesUsed, time: elapsed,
    limits: { maxQueryWords: MAX_QUERY_WORDS }
  });
}

// ============ SOURCES ============

async function fetchStartpage(q) {
  try {
    const r = await fetch('https://www.startpage.com/sp/search', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html', 'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `query=${encodeURIComponent(q)}&cat=web`,
      signal: AbortSignal.timeout(8000)
    });
    const html = await r.text();
    const results = [];
    const matches = [...html.matchAll(/<a[^>]*class="[^"]*result-title[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs)];
    for (const m of matches.slice(0, 20)) {
      let title = m[2].replace(/<[^>]+>/g, '').trim();
      let url = m[1];
      if (title.length > 3 && !title.includes('.css') && url.startsWith('http')) {
        let domain = ''; try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
        const block = html.substring(m.index, m.index + 2000);
        const snip = block.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/p>/s) || block.match(/class="[^"]*text[^"]*"[^>]*>(.*?)<\/p>/s);
        let content = snip ? snip[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&middot;/g,'·').trim() : '';
        results.push({ title: title.substring(0,200), url, content: content.substring(0,500), engine: 'startpage', source: domain || 'Startpage' });
      }
    }
    return results;
  } catch { return []; }
}

async function fetchDuckDuckGo(q) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    const results = [];
    if (data.AbstractText && data.AbstractURL) {
      results.push({ title: data.Heading || q, url: data.AbstractURL, content: data.AbstractText, engine: 'duckduckgo', source: 'DuckDuckGo', featured: true });
    }
    if (data.RelatedTopics) {
      for (const t of data.RelatedTopics.slice(0, 5)) {
        if (t.FirstURL && t.Text) results.push({ title: t.Text.split(' - ')[0].substring(0,200), url: t.FirstURL, content: t.Text, engine: 'duckduckgo', source: 'DuckDuckGo' });
      }
    }
    return results;
  } catch { return []; }
}

async function fetchWikipedia(q) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(q)}&redirects=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) return null;
    return { title: page.title, extract: page.extract || '', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}` };
  } catch { return null; }
}

async function fetchReddit(q) {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=relevance&limit=8&t=year`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const data = await r.json();
    const results = [];
    for (const child of (data?.data?.children || [])) {
      const d = child.data;
      results.push({ title: `${d.title} [r/${d.subreddit}]`, url: `https://www.reddit.com${d.permalink}`, content: (d.selftext || `Reddit discussion - ${d.score} upvotes`).substring(0, 800), engine: 'reddit', source: 'Reddit' });
    }
    return results;
  } catch { return []; }
}

async function fetchHackerNews(q) {
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=6`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    const results = [];
    for (const hit of (data?.hits || [])) {
      results.push({ title: hit.title || hit.objectID, url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`, content: (hit.story_text || `Hacker News - ${hit.points || 0} points`).substring(0, 800), engine: 'hackernews', source: 'Hacker News' });
    }
    return results;
  } catch { return []; }
}

async function fetchStackExchange(q) {
  try {
    const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=votes&q=${encodeURIComponent(q)}&pagesize=6&site=stackoverflow`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    const results = [];
    for (const item of (data?.items || [])) {
      results.push({ title: item.title, url: item.link, content: `Stack Overflow - ${item.score} votes, ${item.answer_count} answers`, engine: 'stackexchange', source: 'Stack Overflow' });
    }
    return results;
  } catch { return []; }
}

async function fetchArxiv(q) {
  try {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&max_results=4&sortBy=relevance`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(8000) });
    const xml = await r.text();
    const results = [];
    for (const entry of xml.split('<entry>').slice(1)) {
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\n/g,' ');
      const id = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim();
      if (title && id) results.push({ title: `${title} - ArXiv`, url: id, content: 'ArXiv academic preprint', engine: 'arxiv', source: 'ArXiv' });
    }
    return results;
  } catch { return []; }
}

async function fetchArchive(q) {
  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=description&rows=4&output=json&sort[]=downloads+desc`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    const results = [];
    for (const doc of (data?.response?.docs || [])) {
      results.push({ title: doc.title || doc.identifier, url: `https://archive.org/details/${doc.identifier}`, content: (doc.description || 'Internet Archive item').substring(0,600), engine: 'archive', source: 'Internet Archive' });
    }
    return results;
  } catch { return []; }
}

async function fetchOpenLibrary(q) {
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=4&fields=title,author_name,first_publish_year,key`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    const results = [];
    for (const doc of (data?.docs || [])) {
      results.push({ title: `${doc.title} - Book`, url: `https://openlibrary.org${doc.key}`, content: doc.author_name?.[0] ? `Book by ${doc.author_name[0]}` : 'Open Library book', engine: 'openlibrary', source: 'Open Library' });
    }
    return results;
  } catch { return []; }
}

async function fetchSemanticScholar(q) {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=4&fields=title,abstract,year,url`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    const results = [];
    for (const paper of (data?.data || [])) {
      results.push({ title: paper.year ? `${paper.title} (${paper.year})` : paper.title, url: paper.url || 'https://www.semanticscholar.org', content: (paper.abstract || 'Academic research paper').substring(0,600), engine: 'semantic-scholar', source: 'Semantic Scholar' });
    }
    return results;
  } catch { return []; }
}

async function fetchGitHub(q) {
  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=5`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0', 'Accept': 'application/vnd.github.v3+json' }, signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    const results = [];
    for (const item of (data?.items || [])) {
      results.push({ title: item.full_name, url: item.html_url, content: (item.description || 'GitHub repository').substring(0,600), engine: 'github', source: 'GitHub' });
    }
    return results;
  } catch { return []; }
}
