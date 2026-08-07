// DeryCode Derick Agent - Step-by-Step Practical Guide Generator
// Named after Asiimwe Derick, founder of DeryCode Tech
// Surfaces what other search engines hide - 11 deep sources

const MAX_QUERY_WORDS = 60;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const body = req.body || {};
  const question = body.question || req.query.q || '';
  
  if (!question || question.trim().length === 0) {
    return res.status(400).json({ error: 'Question is required' });
  }
  
  const words = question.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) {
    return res.status(400).json({ error: `Query too long. Max ${MAX_QUERY_WORDS} words.` });
  }
  
  console.log(`[Derick] Guide for: "${question}" (${words} words)`);
  const startTime = Date.now();
  
  try {
    const [searchData, knowledgePanel] = await Promise.all([
      deepSearch(question),
      fetchWikipedia(question.replace(/\?$/, '').trim())
    ]);
    
    const guide = generateDerickGuide(question, searchData, knowledgePanel);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Derick] ${guide.steps.length} steps from ${guide.sourcesUsed.length} sources in ${elapsed}s`);
    
    res.status(200).json({
      query: question,
      topic: guide.topic,
      intro: guide.intro,
      steps: guide.steps,
      tips: guide.tips,
      warnings: guide.warnings,
      step_count: guide.steps.length,
      has_data: guide.has_data,
      agent: 'Derick',
      sources_used: guide.sourcesUsed,
      total_results: guide.totalResults,
      time: elapsed
    });
  } catch (e) {
    console.error('[Derick] Error:', e.message);
    res.status(200).json({
      query: question, topic: question,
      intro: `Error building guide for "${question}". Try rephrasing.`,
      steps: [], tips: '', warnings: '',
      step_count: 0, has_data: false, agent: 'Derick', error: e.message
    });
  }
}

// ============ DEEP SEARCH ============

// Check if query is academic/scientific
function isAcademicQuery(q) {
  const academic = ['research', 'paper', 'study', 'theory', 'algorithm', 'analysis',
    'physics', 'chemistry', 'biology', 'mathematics', 'quantum', 'neural',
    'machine learning', 'deep learning', 'artificial intelligence',
    'experiment', 'hypothesis', 'thesis', 'dissertation', 'peer review',
    'arxiv', 'journal', 'publication', 'scientific', 'conference'];
  const lower = q.toLowerCase();
  return academic.some(k => lower.includes(k));
}

// Extract query keywords for relevance matching
function getKeywords(q) {
  const stop = new Set(['the','a','an','is','are','how','to','do','does','what','who',
    'can','i','you','my','me','we','our','and','or','but','in','on','at','for',
    'of','with','from','by','about','into','your','this','that','it','its',
    'tell','explain','describe','show','give','want','need','like','please']);
  return q.toLowerCase().split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w))
    .map(w => w.replace(/[^a-z0-9]/g, ''));
}

// Score a result's relevance to the query (0-100)
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
  
  // Bonus for practical indicators
  const practical = ['step', 'guide', 'tutorial', 'how to', 'build', 'create',
    'setup', 'install', 'configure', 'example', 'learn', 'start', 'begin'];
  for (const p of practical) {
    if (titleLower.includes(p) || contentLower.includes(p)) score += 5;
  }
  
  // Penalty for academic content in non-academic queries
  const academicSignals = ['decay', 'particle', 'gravitational', 'quantum',
    'experiment', 'detector', 'physics', 'neutrino', 'boson', 'collider'];
  if (!keywords.some(k => academicSignals.includes(k))) {
    for (const a of academicSignals) {
      if (titleLower.includes(a) || contentLower.includes(a)) score -= 20;
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

async function deepSearch(query) {
  const allResults = [];
  const cleaned = query.trim().replace(/\?$/, '').trim()
    .replace(/^(what is |what is the |what is a |what are |who is |tell me about |explain |describe |how does |how to |how do |how can )/i, '').trim();
  
  const academic = isAcademicQuery(query);
  const keywords = getKeywords(query);
  
  // Build source list - conditionally include ArXiv
  const sources = [
    { fn: () => fetchStartpage(query), name: 'startpage' },
    { fn: () => fetchDuckDuckGo(query), name: 'duckduckgo' },
    { fn: () => fetchWikipedia(cleaned).then(w => w ? [{ 
      title: w.title, url: w.url, content: (w.extract||'').substring(0, 600),
      engine: 'wikipedia', source: 'Wikipedia', featured: true 
    }] : []), name: 'wikipedia' },
    { fn: () => fetchReddit(query), name: 'reddit' },
    { fn: () => fetchHackerNews(query), name: 'hackernews' },
    { fn: () => fetchStackExchange(query), name: 'stackexchange' },
    // ArXiv only for academic queries
    { fn: () => academic ? fetchArxiv(query) : Promise.resolve([]), name: 'arxiv' },
    { fn: () => fetchArchive(query), name: 'archive' },
    { fn: () => fetchOpenLibrary(query), name: 'openlibrary' },
    // Semantic Scholar only for academic queries
    { fn: () => academic ? fetchSemanticScholar(query) : Promise.resolve([]), name: 'semantic-scholar' },
    { fn: () => fetchGitHub(query), name: 'github' },
  ];
  
  const settled = await Promise.allSettled(sources.map(s => s.fn()));
  const sourcesUsed = [];
  
  settled.forEach((result, idx) => {
    if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
      sourcesUsed.push(sources[idx].name);
      // Add relevance score to each result
      for (const r of result.value) {
        r._score = relevanceScore(r, keywords);
      }
      allResults.push(...result.value);
    }
  });
  
  // Sort by relevance score (descending)
  allResults.sort((a, b) => (b._score || 0) - (a._score || 0));
  
  // Soft dedup
  const seen = new Set();
  const deduped = allResults.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
  
  return { results: deduped, sourcesUsed, totalResults: allResults.length };
}

// ============ SEARCH SOURCES ============

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
    for (const m of matches.slice(0, 15)) {
      let title = m[2].replace(/<[^>]+>/g, '').trim();
      let url = m[1];
      if (title.length > 3 && !title.includes('.css') && url.startsWith('http')) {
        let domain = ''; try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
        // Find snippet
        const block = html.substring(m.index, m.index + 2000);
        const snip = block.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/p>/s) 
                  || block.match(/class="[^"]*text[^"]*"[^>]*>(.*?)<\/p>/s);
        let content = snip ? snip[1].replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&middot;/g,'·').trim() : '';
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
        if (t.FirstURL && t.Text) {
          results.push({ title: t.Text.split(' - ')[0].substring(0,200), url: t.FirstURL, content: t.Text, engine: 'duckduckgo', source: 'DuckDuckGo' });
        }
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
      results.push({ 
        title: `${d.title} [r/${d.subreddit}]`, 
        url: `https://www.reddit.com${d.permalink}`, 
        content: (d.selftext || `Reddit discussion - ${d.score} upvotes`).substring(0, 800), 
        engine: 'reddit', source: 'Reddit' 
      });
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
      results.push({ 
        title: hit.title || hit.objectID, 
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`, 
        content: (hit.story_text || `Hacker News - ${hit.points || 0} points`).substring(0, 800), 
        engine: 'hackernews', source: 'Hacker News' 
      });
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
      results.push({ 
        title: item.title, url: item.link, 
        content: `Stack Overflow - ${item.score} votes, ${item.answer_count} answers`, 
        engine: 'stackexchange', source: 'Stack Overflow' 
      });
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
    const entries = xml.split('<entry>').slice(1);
    for (const entry of entries) {
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\n/g,' ');
      const id = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim();
      const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().substring(0,600);
      if (title && id) results.push({ title: `${title} - ArXiv`, url: id, content: summary || 'ArXiv preprint', engine: 'arxiv', source: 'ArXiv' });
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
      results.push({ 
        title: doc.title || doc.identifier, 
        url: `https://archive.org/details/${doc.identifier}`, 
        content: (doc.description || 'Internet Archive item').substring(0,600), 
        engine: 'archive', source: 'Internet Archive' 
      });
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
      const author = doc.author_name?.[0];
      results.push({ 
        title: `${doc.title} - Book`, 
        url: `https://openlibrary.org${doc.key}`, 
        content: author ? `Book by ${author}${doc.first_publish_year ? `, published ${doc.first_publish_year}` : ''}` : 'Open Library book', 
        engine: 'openlibrary', source: 'Open Library' 
      });
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
      results.push({ 
        title: paper.year ? `${paper.title} (${paper.year}) - Research` : `${paper.title} - Research`, 
        url: paper.url || 'https://www.semanticscholar.org', 
        content: (paper.abstract || 'Academic research paper').substring(0,600), 
        engine: 'semantic-scholar', source: 'Semantic Scholar' 
      });
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
      results.push({ 
        title: item.full_name, url: item.html_url, 
        content: (item.description || 'GitHub repository').substring(0,600), 
        engine: 'github', source: 'GitHub' 
      });
    }
    return results;
  } catch { return []; }
}

// ============ DERICK GUIDE GENERATOR ============

function generateDerickGuide(query, searchData, knowledgePanel) {
  const results = searchData.results;
  const sourcesUsed = searchData.sourcesUsed;
  
  if (!results || results.length === 0) {
    return { topic: query, intro: `No results found for "${query}". Try different keywords.`, steps: [], tips: '', warnings: '', has_data: false, sourcesUsed, totalResults: 0 };
  }
  
  // Build intro
  let intro = '';
  if (knowledgePanel && knowledgePanel.extract && knowledgePanel.extract.length > 50) {
    intro = `Here's a practical breakdown of "${query}":\n\n${extractKeySentences(knowledgePanel.extract, 2)}`;
  } else if (results[0]?.content && results[0].content.length > 30 && (results[0]._score || 0) > 10) {
    intro = `Here's a practical breakdown of "${query}":\n\n${extractKeySentences(results[0].content, 2)}`;
  } else {
    intro = `Here's a practical, step-by-step breakdown of "${query}" based on what I found across ${sourcesUsed.length} sources on the web.`;
  }
  
  const steps = [];
  const usedUrls = new Set();
  
  // Step 1: Understanding (knowledge panel if available)
  if (knowledgePanel && knowledgePanel.extract && knowledgePanel.extract.length > 50) {
    steps.push({
      step: 1,
      title: 'Understand the basics',
      content: `Before diving in, here's what you need to know:\n${extractKeySentences(knowledgePanel.extract, 3)}`,
      source_url: knowledgePanel.url,
      source_name: 'Wikipedia'
    });
    usedUrls.add(knowledgePanel.url);
  }
  
  // Steps 2+: Use relevance-scored results
  const practicalIndicators = ['step', 'first', 'then', 'next', 'after', 'begin', 'start',
    'install', 'create', 'build', 'configure', 'use', 'require', 'need', 'must',
    'should', 'important', 'option', 'choose', 'select', 'click', 'run', 'type',
    'code', 'command', 'example', 'tutorial', 'guide', 'how to', 'setup', 'deploy', 'implement'];
  
  let stepNum = steps.length + 1;
  
  // First pass: high-relevance + practical results
  for (const r of results) {
    if (steps.length >= 12) break;
    if (usedUrls.has(r.url)) continue;
    if (!r.content || r.content.length < 30) continue;
    if (r.featured && steps.length === 1) continue;
    
    const score = r._score || 0;
    const contentLower = (r.content || '').toLowerCase();
    const titleLower = (r.title || '').toLowerCase();
    const isPractical = practicalIndicators.some(p => contentLower.includes(p) || titleLower.includes(p));
    
    // Only use results with decent relevance (score >= 10) OR practical content
    if (score < 10 && !isPractical) continue;
    
    let stepTitle = (r.title || '').substring(0, 80);
    stepTitle = stepTitle.replace(/\s*-\s*(Wikipedia|GitHub|Reddit|Hacker News|Stack Overflow|ArXiv|Internet Archive|Open Library|Semantic Scholar|Book).*$/i, '');
    stepTitle = stepTitle.replace(/\s*\[r\/\w+\].*$/i, '');
    if (stepTitle.length > 75) stepTitle = stepTitle.substring(0, 72) + '...';
    
    steps.push({
      step: stepNum,
      title: stepTitle,
      content: extractKeySentences(r.content, 4),
      source_url: r.url,
      source_name: r.source
    });
    usedUrls.add(r.url);
    stepNum++;
  }
  
  // Second pass: if still not enough steps, use ALL remaining results
  if (steps.length < 4) {
    for (const r of results) {
      if (steps.length >= 10) break;
      if (usedUrls.has(r.url)) continue;
      if (!r.content || r.content.length < 30) continue;
      
      let stepTitle = (r.title || '').substring(0, 80);
      stepTitle = stepTitle.replace(/\s*-\s*(Wikipedia|GitHub|Reddit|Hacker News|Stack Overflow|ArXiv|Internet Archive|Open Library|Semantic Scholar|Book).*$/i, '');
      if (stepTitle.length > 75) stepTitle = stepTitle.substring(0, 72) + '...';
      
      steps.push({
        step: steps.length + 1,
        title: stepTitle,
        content: extractKeySentences(r.content, 4),
        source_url: r.url,
        source_name: r.source
      });
      usedUrls.add(r.url);
    }
  }
  
  const tips = `Pro tips:\n- Search for "${query} tutorial" on YouTube for visual walkthroughs\n- Check Reddit and Hacker News for real-world experiences\n- Stack Overflow has detailed technical answers\n- Try rephrasing if you need different results`;
  const warnings = `This guide is auto-generated from ${sourcesUsed.length} web sources. Always verify critical steps with the original sources linked in each step.`;
  
  return {
    topic: query, intro, steps, tips, warnings,
    has_data: steps.length > 0, sourcesUsed, totalResults: results.length
  };
}

function extractKeySentences(text, maxSentences) {
  if (!text) return '';
  maxSentences = maxSentences || 3;
  text = text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const sentences = text.split(/(?<=[.!?])\s+/);
  const result = [];
  let totalLen = 0;
  for (const s of sentences) {
    const t = s.trim();
    if (t.length > 30 && t.length < 500 && totalLen < 800) {
      result.push(t);
      totalLen += t.length;
      if (result.length >= maxSentences) break;
    }
  }
  return result.join(' ');
}
