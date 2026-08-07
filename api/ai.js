// DeryCode AI API - Vercel Serverless
// NO Gemini dependency - uses Startpage web results + Wikipedia knowledge
// Provides AI-style answers by synthesizing web content

import { isDeryCodeQuery, getDeryCodeKnowledge } from './derycode-knowledge.js';

const MAX_QUERY_WORDS = 30;
const MAX_ANSWER_WORDS = 250;
const MAX_ANSWER_CHARS = 1500;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const body = req.body || {};
  const question = body.question || req.query.q || '';
  const history = body.history || [];
  const lang = body.lang || req.query.lang || 'en';
  
  if (!question || question.trim().length === 0) {
    return res.status(400).json({ error: 'Question is required' });
  }
  
  const words = question.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) {
    return res.status(400).json({
      error: `Query too long. Maximum ${MAX_QUERY_WORDS} words. You used ${words}.`,
      max_words: MAX_QUERY_WORDS,
      used_words: words
    });
  }
  
  // 1. Check DeryCode knowledge base first (instant)
  if (isDeryCodeQuery(question)) {
    const kb = getDeryCodeKnowledge(question);
    return res.status(200).json({
      question,
      answer: truncateWords(kb.answer, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS),
      sources: kb.sources,
      followups: kb.followups,
      results: [],
      model: 'DeryCode-KnowledgeBase',
      lang
    });
  }
  
  // 2. Fetch web context from Startpage + Wikipedia + DDG
  const effectiveQuery = buildEffectiveQuery(question, history);
  
  let wiki = null, ddg = null, webResults = [];
  [wiki, ddg, webResults] = await Promise.all([
    fetchWikipedia(effectiveQuery),
    fetchDuckDuckGo(effectiveQuery),
    fetchStartpage(effectiveQuery)
  ]);
  
  // Build sources list
  const sources = [];
  if (wiki && wiki.extract) {
    sources.push({ title: wiki.title, url: wiki.url, type: 'encyclopedia' });
  }
  if (ddg && ddg.content) {
    sources.push({ title: ddg.title, url: ddg.url, type: 'instant-answer' });
  }
  for (const r of webResults.slice(0, 5)) {
    sources.push({ title: r.title, url: r.url, type: r.engine });
  }
  
  // 3. Build answer from web context (NO Gemini - synthesize from real sources)
  let answerText = '';
  
  if (wiki && wiki.extract && wiki.extract.length > 30) {
    answerText += truncateWords(wiki.extract, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
  }
  
  if (ddg && ddg.content && ddg.content.length > 30) {
    if (answerText && !answerText.includes(ddg.content.substring(0, 50))) {
      answerText += '\n\n';
    }
    answerText += truncateWords(ddg.content, 80, 400);
  }
  
  for (const r of webResults.slice(0, 4)) {
    if (r.content && r.content.length > 50 && answerText.length < MAX_ANSWER_CHARS - 200) {
      if (answerText && answerText.includes(r.content.substring(0, 40))) continue;
      if (answerText) answerText += '\n\n';
      answerText += `${r.title}: ${truncateWords(r.content, 60, 250)}`;
    }
  }
  
  // 4. If not enough content, try scraping top results
  if ((!answerText || answerText.length < 50) && webResults.length > 0) {
    for (const r of webResults.slice(0, 3)) {
      try {
        const scraped = await scrapeUrl(r.url);
        if (scraped && scraped.length > 80) {
          if (answerText) answerText += '\n\n';
          answerText += truncateWords(scraped, 100, 500);
          if (!sources.find(s => s.url === r.url)) {
            sources.push({ title: r.title, url: r.url, type: 'scraped' });
          }
        }
      } catch {}
      if (answerText.length >= MAX_ANSWER_CHARS - 100) break;
    }
  }
  
  // 5. Final fallback
  if (!answerText || answerText.length < 20) {
    if (webResults.length > 0) {
      answerText = `Here are the top results I found for "${question}". Check the sources below for detailed information.`;
    } else {
      answerText = `I couldn't find specific information about "${question}". Try the Web search mode for more results, or rephrase your question.`;
    }
  }
  
  answerText = truncateWords(answerText, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
  answerText = cleanText(answerText);
  
  const allResults = buildResults(wiki, ddg, webResults);
  
  res.status(200).json({
    question,
    answer: answerText,
    sources: sources.slice(0, 5),
    followups: generateFollowups(effectiveQuery),
    results: allResults.slice(0, 8),
    model: 'DeryCode-Web-v2',
    lang,
    grounded: true
  });
}

// Startpage search (works from Vercel - uses Google results!)
async function fetchStartpage(q) {
  try {
    const r = await fetch('https://www.startpage.com/sp/search', {
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
    const html = await r.text();
    const results = [];
    
    const titleMatches = [...html.matchAll(/<a[^>]*class="[^"]*result-title[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs)];
    
    for (const m of titleMatches.slice(0, 10)) {
      let url = m[1];
      let title = m[2].replace(/<[^>]+>/g, '').trim();
      if (title.includes('.css-')) continue;
      title = title.replace(/\{[^}]*\}/g, '').trim();
      
      const resultBlock = html.substring(m.index, m.index + 1500);
      const snippetMatch = resultBlock.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/p>/s)
                        || resultBlock.match(/<span[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/span>/s)
                        || resultBlock.match(/class="[^"]*text[^"]*"[^>]*>(.*?)<\/p>/s);
      let snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim() : '';
      
      let domain = '';
      try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
      
      if (title.length > 3 && url.startsWith('http')) {
        results.push({
          title: title.substring(0, 200),
          url,
          content: snippet.substring(0, 300),
          engine: 'startpage',
          source: domain || 'Startpage',
          featured: false
        });
      }
    }
    return results;
  } catch { return []; }
}

// Wikipedia knowledge
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

// DuckDuckGo instant answer
async function fetchDuckDuckGo(q) {
  try {
    const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1`, {
      headers: { 'User-Agent': 'DeryCodeSearch/1.0' },
      signal: AbortSignal.timeout(6000)
    });
    const data = await r.json();
    if (data.AbstractText && data.AbstractText.length > 20) {
      return { title: data.Heading || q, content: data.AbstractText, url: data.AbstractURL || '' };
    }
    for (const t of (data.RelatedTopics || [])) {
      if (t && t.Text && t.Text.length > 50 && t.FirstURL) {
        return { title: t.Text.substring(0, 80), content: t.Text, url: t.FirstURL };
      }
    }
    return null;
  } catch { return null; }
}

// Scrape URL for content
async function scrapeUrl(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow'
    });
    const html = await r.text();
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').trim();
    return text.substring(0, 800);
  } catch { return ''; }
}

function buildResults(wiki, ddg, webResults) {
  const all = [];
  if (wiki) all.push({ title: wiki.title, url: wiki.url, content: wiki.extract?.substring(0, 300), engine: 'wikipedia', source: 'Wikipedia', featured: true });
  if (ddg && ddg.content) all.push({ title: ddg.title, url: ddg.url || '', content: ddg.content?.substring(0, 300), engine: 'duckduckgo', source: 'DuckDuckGo', featured: false });
  all.push(...webResults);
  return all;
}

function buildEffectiveQuery(question, history) {
  let q = question.trim();
  if (history && history.length > 0) {
    const lastUser = [...history].reverse().find(m => m.role === 'user');
    if (lastUser && lastUser.content) {
      const lastQ = lastUser.content.toLowerCase();
      const pronouns = ['it', 'this', 'that', 'they', 'them', 'he', 'she', 'his', 'her'];
      if (pronouns.some(p => q.toLowerCase().includes(` ${p} `) || q.toLowerCase().startsWith(`${p} `))) {
        q = `${lastQ} ${q}`;
      }
    }
  }
  return q;
}

function generateFollowups(q) {
  const base = q.trim().replace(/\?$/, '');
  return [
    `Tell me more about ${base}`,
    `What are the latest news on ${base}?`,
    `Find images of ${base}`,
    `What are people saying about ${base}?`
  ];
}

function truncateWords(text, maxWords, maxChars) {
  if (!text) return '';
  let truncated = text;
  if (truncated.length > maxChars) truncated = truncated.substring(0, maxChars);
  const words = truncated.split(/\s+/);
  if (words.length > maxWords) truncated = words.slice(0, maxWords).join(' ') + '...';
  return truncated;
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}
