// DeryCode Derick Agent - Step-by-Step Practical Guide Generator
// Takes search results from all sources and breaks them into actionable steps
// Named after Asiimwe Derick, founder of DeryCode Tech

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
  
  console.log(`[Derick] Step-by-step guide for: ${question} (words: ${words})`);
  
  const startTime = Date.now();
  
  try {
    // Run deep search across all sources
    const [searchResults, knowledgePanel] = await Promise.all([
      deepSearch(question),
      fetchWikipedia(question)
    ]);
    
    // Generate step-by-step guide from search data
    const guide = generateDerickGuide(question, searchResults, knowledgePanel);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Derick] Generated ${guide.steps.length} steps in ${elapsed}s`);
    
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
      time: elapsed
    });
  } catch (e) {
    console.error('[Derick] Error:', e.message);
    res.status(200).json({
      query: question,
      topic: question,
      intro: `I encountered an error while building your guide for "${question}". Please try rephrasing your question.`,
      steps: [],
      tips: '',
      warnings: '',
      step_count: 0,
      has_data: false,
      agent: 'Derick',
      error: e.message
    });
  }
}

// ============ DEEP SEARCH - All Sources ============

async function deepSearch(query) {
  const allResults = [];
  const cleaned = query.trim().replace(/\?$/, '').trim()
    .replace(/^(what is |what is the |what is a |what are |who is |tell me about |explain |describe |how does |how to |how do )/i, '').trim();
  
  const sources = [
    fetchStartpage(query),
    fetchDuckDuckGo(query),
    fetchWikipedia(cleaned).then(w => w ? [{ 
      title: w.title, url: w.url, content: (w.extract||'').substring(0, 600), 
      engine: 'wikipedia', source: 'Wikipedia', featured: true 
    }] : []),
    fetchReddit(query),
    fetchHackerNews(query),
    fetchStackExchange(query),
    fetchArxiv(query),
    fetchArchive(query),
    fetchOpenLibrary(query),
    fetchSemanticScholar(query),
    fetchGitHub(query)
  ];
  
  const settled = await Promise.allSettled(sources);
  const sourcesUsed = [];
  const sourceNames = ['startpage', 'duckduckgo', 'wikipedia', 'reddit', 'hackernews', 'stackexchange', 'arxiv', 'archive', 'openlibrary', 'semantic-scholar', 'github'];
  
  settled.forEach((result, idx) => {
    if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
      sourcesUsed.push(sourceNames[idx]);
      allResults.push(...result.value);
    }
  });
  
  const seen = new Set();
  return {
    results: allResults.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    }),
    sourcesUsed
  };
}

async function fetchStartpage(q) {
  try {
    const r = await fetch('https://www.startpage.com/sp/search', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html', 'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `query=${encodeURIComponent(q)}&cat=web`,
      signal: AbortSignal.timeout(10000)
    });
    const html = await r.text();
    const results = [];
    const matches = [...html.matchAll(/<a[^>]*class="[^"]*result-title[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs)];
    for (const m of matches.slice(0, 15)) {
      let title = m[2].replace(/<[^>]+>/g, '').trim();
      let url = m[1];
      if (title.length > 3 && url.startsWith('http')) {
        let domain = ''; try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
        results.push({ title: title.substring(0, 200), url, content: '', engine: 'startpage', source: domain || 'Startpage' });
      }
    }
    return results;
  } catch { return []; }
}

async function fetchDuckDuckGo(q) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const results = [];
    if (data.AbstractText && data.AbstractURL) {
      results.push({ title: data.Heading || q, url: data.AbstractURL, content: data.AbstractText, engine: 'duckduckgo', source: 'DuckDuckGo', featured: true });
    }
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.FirstURL && topic.Text) {
          results.push({ title: topic.Text.split(' - ')[0].substring(0, 200), url: topic.FirstURL, content: topic.Text, engine: 'duckduckgo', source: 'DuckDuckGo' });
        }
      }
    }
    return results;
  } catch { return []; }
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

async function fetchReddit(q) {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=relevance&limit=8&t=year`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0 (bot)' } });
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
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const results = [];
    for (const hit of (data?.hits || [])) {
      results.push({ title: hit.title || hit.objectID, url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`, content: (hit.story_text || `Hacker News story - ${hit.points || 0} points`).substring(0, 800), engine: 'hackernews', source: 'Hacker News' });
    }
    return results;
  } catch { return []; }
}

async function fetchStackExchange(q) {
  try {
    const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=votes&q=${encodeURIComponent(q)}&pagesize=6&site=stackoverflow`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const results = [];
    for (const item of (data?.items || [])) {
      results.push({ title: item.title, url: item.link, content: `Stack Overflow Q&A - ${item.score} votes, ${item.answer_count} answers`, engine: 'stackexchange', source: 'Stack Overflow' });
    }
    return results;
  } catch { return []; }
}

async function fetchArxiv(q) {
  try {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&max_results=4&sortBy=relevance`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const xml = await r.text();
    const results = [];
    const entries = xml.split('<entry>').slice(1);
    for (const entry of entries) {
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\n/g, ' ');
      const id = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim();
      const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().substring(0, 600);
      if (title && id) results.push({ title: `${title} - ArXiv`, url: id, content: summary || 'ArXiv preprint', engine: 'arxiv', source: 'ArXiv' });
    }
    return results;
  } catch { return []; }
}

async function fetchArchive(q) {
  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=description&rows=4&output=json&sort[]=downloads+desc`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const results = [];
    for (const doc of (data?.response?.docs || [])) {
      results.push({ title: doc.title || doc.identifier, url: `https://archive.org/details/${doc.identifier}`, content: (doc.description || 'Internet Archive item').substring(0, 600), engine: 'archive', source: 'Internet Archive' });
    }
    return results;
  } catch { return []; }
}

async function fetchOpenLibrary(q) {
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=4&fields=title,author_name,first_publish_year,key`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const results = [];
    for (const doc of (data?.docs || [])) {
      const author = doc.author_name?.[0];
      const year = doc.first_publish_year;
      results.push({ title: `${doc.title} - Book`, url: `https://openlibrary.org${doc.key}`, content: author ? `Book by ${author}${year ? `, first published ${year}` : ''}` : 'Open Library book entry', engine: 'openlibrary', source: 'Open Library' });
    }
    return results;
  } catch { return []; }
}

async function fetchSemanticScholar(q) {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=4&fields=title,abstract,year,url`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const results = [];
    for (const paper of (data?.data || [])) {
      results.push({ title: paper.year ? `${paper.title} (${paper.year}) - Research` : `${paper.title} - Research`, url: paper.url || 'https://www.semanticscholar.org', content: (paper.abstract || 'Academic research paper').substring(0, 600), engine: 'semantic-scholar', source: 'Semantic Scholar' });
    }
    return results;
  } catch { return []; }
}

async function fetchGitHub(q) {
  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=5`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0', 'Accept': 'application/vnd.github.v3+json' } });
    const data = await r.json();
    const results = [];
    for (const item of (data?.items || [])) {
      results.push({ title: item.full_name, url: item.html_url, content: (item.description || 'GitHub repository').substring(0, 600), engine: 'github', source: 'GitHub' });
    }
    return results;
  } catch { return []; }
}

// ============ DERICK GUIDE GENERATOR ============

function generateDerickGuide(query, searchData, knowledgePanel) {
  const results = searchData.results;
  const sourcesUsed = searchData.sourcesUsed;
  
  if (!results || results.length === 0) {
    return { topic: query, intro: `I couldn't find enough information to create a practical guide for "${query}". Try rephrasing your question.`, steps: [], tips: '', warnings: '', has_data: false, sourcesUsed };
  }
  
  let intro = '';
  if (knowledgePanel && knowledgePanel.extract && knowledgePanel.extract.length > 50) {
    intro = `Here's a practical breakdown of "${query}":\n\n${extractKeySentences(knowledgePanel.extract, 2)}`;
  } else if (results[0]?.content && results[0].content.length > 30) {
    intro = `Here's a practical breakdown of "${query}":\n\n${extractKeySentences(results[0].content, 2)}`;
  } else {
    intro = `Here's a practical, step-by-step breakdown of "${query}" based on what I found across the web.`;
  }
  
  const steps = [];
  
  if (knowledgePanel && knowledgePanel.extract && knowledgePanel.extract.length > 50) {
    steps.push({ step: 1, title: 'Understand the basics', content: `Before diving in, here's what you need to know:\n${extractKeySentences(knowledgePanel.extract, 3)}`, source_url: knowledgePanel.url, source_name: 'Wikipedia' });
  }
  
  const practicalIndicators = ['step', 'first', 'then', 'next', 'after', 'begin', 'start', 'install', 'create', 'build', 'configure', 'use', 'require', 'need', 'must', 'should', 'important', 'option', 'choose', 'select', 'click', 'run', 'type', 'code', 'command', 'example', 'tutorial', 'guide', 'how to', 'setup', 'deploy', 'implement'];
  
  let stepNum = steps.length + 1;
  
  for (const r of results) {
    if (steps.length >= 15) break;
    if (!r.content || r.content.length < 40) continue;
    if (r.featured && steps.length === 1) continue;
    
    const lowerContent = r.content.toLowerCase();
    const isPractical = practicalIndicators.some(ind => lowerContent.includes(ind));
    if (!isPractical && steps.length < 3) continue;
    
    let stepTitle = (r.title || '').substring(0, 80);
    stepTitle = stepTitle.replace(/\s*-\s*(Wikipedia|GitHub|Reddit|Hacker News|Stack Overflow|ArXiv|Internet Archive|Open Library|Semantic Scholar).*$/i, '');
    if (stepTitle.length > 75) stepTitle = stepTitle.substring(0, 72) + '...';
    
    steps.push({ step: stepNum, title: stepTitle, content: extractKeySentences(r.content, 4), source_url: r.url, source_name: r.source });
    stepNum++;
  }
  
  if (steps.length < 3) {
    for (const r of results) {
      if (steps.length >= 10) break;
      if (!r.content || r.content.length < 40) continue;
      if (steps.some(s => s.source_url === r.url)) continue;
      let stepTitle = (r.title || '').substring(0, 80);
      stepTitle = stepTitle.replace(/\s*-\s*(Wikipedia|GitHub|Reddit|Hacker News|Stack Overflow|ArXiv|Internet Archive|Open Library|Semantic Scholar).*$/i, '');
      if (stepTitle.length > 75) stepTitle = stepTitle.substring(0, 72) + '...';
      steps.push({ step: steps.length + 1, title: stepTitle, content: extractKeySentences(r.content, 4), source_url: r.url, source_name: r.source });
    }
  }
  
  const tips = `Pro tips:\n- Search for "${query} tutorial" for video walkthroughs\n- Check Reddit and Hacker News for community discussions\n- Look for Stack Overflow answers for technical details\n- ArXiv and Semantic Scholar have academic papers on this topic`;
  const warnings = `This guide is generated from live web results across ${sourcesUsed.length} sources. Always verify critical steps with the original sources linked in each step.`;
  
  return { topic: query, intro, steps, tips, warnings, has_data: steps.length > 0, sourcesUsed };
}

function extractKeySentences(text, maxSentences) {
  if (!text) return '';
  maxSentences = maxSentences || 3;
  text = text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const sentences = text.split(/(?<=[.!?])\s+/);
  const result = [];
  let totalLen = 0;
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length > 30 && trimmed.length < 500 && totalLen < 800) {
      result.push(trimmed);
      totalLen += trimmed.length;
      if (result.length >= maxSentences) break;
    }
  }
  return result.join(' ');
}
