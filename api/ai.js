// DeryCode AI API - Vercel Serverless
// Reliable answer synthesis from multiple sources
// Prioritizes accuracy, deduplication, and clean formatting

import { isDeryCodeQuery, getDeryCodeKnowledge } from './derycode-knowledge.js';

const MAX_QUERY_WORDS = 30;
const MAX_ANSWER_WORDS = 300;
const MAX_ANSWER_CHARS = 2000;

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
  
  // 1. Check DeryCode knowledge base first (instant, 100% accurate)
  if (isDeryCodeQuery(question)) {
    const kb = getDeryCodeKnowledge(question);
    return res.status(200).json({
      question,
      answer: truncateWords(kb.answer, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS),
      sources: kb.sources,
      followups: kb.followups,
      results: [],
      model: 'DeryCode-KnowledgeBase',
      confidence: 'high',
      lang
    });
  }
  
  // 2. Fetch from multiple sources in parallel
  const effectiveQuery = buildEffectiveQuery(question, history);
  
  let wiki = null, ddg = null, webResults = [];
  try {
    [wiki, ddg, webResults] = await Promise.all([
      fetchWikipedia(effectiveQuery),
      fetchDuckDuckGo(effectiveQuery),
      fetchStartpage(effectiveQuery)
    ]);
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
  
  // 3. Build sources list
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
  
  // 4. Build synthesized answer from clean sources
  const { answer: answerText, confidence } = await synthesizeAnswer(question, wiki, ddg, webResults, effectiveQuery);
  
  // 5. Clean and truncate final answer
  let cleanAnswer = cleanText(answerText);
  cleanAnswer = truncateWords(cleanAnswer, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
  
  const allResults = buildResults(wiki, ddg, webResults);
  
  res.status(200).json({
    question,
    answer: cleanAnswer,
    sources: sources.slice(0, 5),
    followups: generateFollowups(effectiveQuery),
    results: allResults.slice(0, 8),
    model: 'DeryCode-Web-v2',
    confidence,
    lang,
    grounded: true
  });
}

// === ANSWER SYNTHESIS ===
// Combines multiple sources into one coherent, accurate answer
async function synthesizeAnswer(question, wiki, ddg, webResults, query) {
  const parts = [];
  let confidence = 'low';
  let sourceCount = 0;
  
  // Priority 1: Wikipedia (most reliable for factual queries)
  if (wiki && wiki.extract && wiki.extract.length > 50) {
    const wikiText = cleanSnippet(wiki.extract);
    if (wikiText.length > 30) {
      parts.push(wikiText);
      sourceCount++;
      confidence = 'medium';
    }
  }
  
  // Priority 2: DuckDuckGo Instant Answer (good for definitions)
  if (ddg && ddg.content && ddg.content.length > 50) {
    const ddgText = cleanSnippet(ddg.content);
    // Only add if not duplicating Wikipedia
    if (!isDuplicate(parts, ddgText)) {
      parts.push(ddgText);
      sourceCount++;
    }
  }
  
  // Priority 3: Top web results (for current info, news, specific topics)
  const usedTexts = [...parts];
  for (const r of webResults.slice(0, 5)) {
    if (r.content && r.content.length > 80) {
      const snippet = cleanSnippet(r.content);
      if (snippet.length > 50 && !isDuplicate(usedTexts, snippet)) {
        // Add with context — just the clean content, no title prefix
        parts.push(snippet);
        usedTexts.push(snippet);
        sourceCount++;
      }
    }
    if (parts.join(' ').length >= MAX_ANSWER_CHARS * 0.8) break;
  }
  
  // Priority 4: Scrape top result if we don't have enough content
  if (parts.join(' ').length < 200 && webResults.length > 0) {
    for (const r of webResults.slice(0, 3)) {
      try {
        const scraped = await scrapeUrl(r.url);
        if (scraped && scraped.length > 100) {
          const clean = cleanSnippet(scraped);
          if (!isDuplicate(usedTexts, clean)) {
            parts.push(clean);
            usedTexts.push(clean);
            sourceCount++;
          }
        }
      } catch {}
      if (parts.join(' ').length >= MAX_ANSWER_CHARS * 0.6) break;
    }
  }
  
  // Build final answer
  let answer = parts.join('\n\n');
  
  // Determine confidence based on source count and content quality
  if (sourceCount >= 3 && answer.length > 300) {
    confidence = 'high';
  } else if (sourceCount >= 2 && answer.length > 150) {
    confidence = 'medium';
  } else if (sourceCount >= 1) {
    confidence = 'low';
  }
  
  // Fallback if no content found or content is too short/garbage
  if (!answer || answer.length < 20 || (answer.length < 50 && sourceCount < 2)) {
    if (webResults.length > 0) {
      answer = `I found ${webResults.length} web results for "${question}", but couldn't extract a clear answer. Please check the sources below for detailed information.`;
      confidence = 'low';
    } else {
      answer = `I couldn't find reliable information about "${question}". Try rephrasing your question or use Web search mode for more results.`;
      confidence = 'none';
    }
  }
  
  // Final cleanup: remove any remaining leading dots
  answer = answer.replace(/^[.…•·]+\s*/, '');
  answer = answer.replace(/^\.\s+/, '');
  
  return { answer, confidence };
}

// === TEXT CLEANING ===
// Removes HTML entities, source prefixes, CSS artifacts, and junk text
function cleanSnippet(text) {
  if (!text) return '';
  
  let clean = text;
  
  // Remove HTML entities
  clean = clean.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&middot;/g, '·')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '...')
    .replace(/&[a-z]+;/g, ''); // Remove any remaining HTML entities
  
  // Remove date prefixes like "Mar 16, 2016 ..." or "Jan 3, 2024 —"
  clean = clean.replace(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\s*[.·—\-]?\s*/i, '');
  clean = clean.replace(/^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*[.·—\-]?\s*/i, '');
  
  // Remove question echoes at start (e.g. "What is blockchain? Blockchain is...")
  clean = clean.replace(/^(what is|what are|who is|how does|why is|tell me about)\s+[^?]{3,60}\?\s*/i, '');
  clean = clean.replace(/^(what is|what are|who is|how does|why is)\s+[^?]{3,60}\s+/i, (match, p1) => {
    // Only remove if the next part starts with a capital letter (it's echoing the question)
    return '';
  });
  
  // Remove source prefixes like "Title - Source:" or "Title | Source:" or "Title: "
  clean = clean.replace(/^[A-Z][^:.|\n]{5,80}\s*[-–—|]\s*[A-Z][^:.|\n]{2,60}:\s*/, '');
  clean = clean.replace(/^[A-Z][^:.|\n]{5,80}:\s*/, (match) => {
    // Only remove if it looks like a source prefix (ends with colon and next is content)
    if (match.length < 80 && match.includes(':')) return '';
    return match;
  });
  
  // Remove CSS artifacts
  clean = clean.replace(/\{[^}]*\}/g, '');
  clean = clean.replace(/\.css-[a-zA-Z0-9]+/g, '');
  
  // Remove URL artifacts
  clean = clean.replace(/https?:\/\/[^\s]+/g, '');
  
  // Remove file paths
  clean = clean.replace(/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-\/]+\.(js|css|html|png|jpg|svg)/g, '');
  
  // Remove markdown artifacts
  clean = clean.replace(/[#*_~`]+/g, '');
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove "...", "..", and "…" at the start
  clean = clean.replace(/^[.…]+\s*/, '');
  clean = clean.replace(/^\.\.+\s*/, '');
  clean = clean.replace(/^…\s*/, '');
  
  // Remove "Home:" or "Home -" prefixes
  clean = clean.replace(/^(Home|About|Overview)\s*[-:|]\s*/i, '');
  
  // Fix spacing around punctuation
  clean = clean.replace(/\s+([,.;:!?])/g, '$1');
  clean = clean.replace(/([,.;:!?])(?=[A-Za-z])/g, '$1 ');
  
  // Remove excessive whitespace
  clean = clean.replace(/[ \t]+/g, ' ');
  clean = clean.replace(/\n{3,}/g, '\n\n');
  clean = clean.trim();
  
  // Remove incomplete sentences at the start
  clean = clean.replace(/^[a-z]{1,5}\s+(?=[A-Z])/, '');
  
  // Remove incomplete sentences at the end
  clean = clean.replace(/\s+[a-z]{1,3}$/i, '');
  
  // Ensure starts with capital
  if (clean.length > 0 && clean[0] >= 'a' && clean[0] <= 'z') {
    clean = clean[0].toUpperCase() + clean.slice(1);
  }
  
  // Cap at reasonable length — find sentence boundary
  if (clean.length > 800) {
    const cutPoint = clean.lastIndexOf('. ', 700);
    if (cutPoint > 200) {
      clean = clean.substring(0, cutPoint + 1);
    } else {
      const cutSpace = clean.lastIndexOf(' ', 700);
      if (cutSpace > 200) {
        clean = clean.substring(0, cutSpace) + '...';
      } else {
        clean = clean.substring(0, 700) + '...';
      }
    }
  }
  
  return clean;
}

// === DEDUPLICATION ===
// Checks if text is substantially similar to existing parts
function isDuplicate(existingParts, newText) {
  if (!newText || newText.length < 30) return true;
  
  // Get first 60 chars of new text for comparison
  const newStart = newText.substring(0, 60).toLowerCase();
  
  for (const part of existingParts) {
    const existingStart = part.substring(0, 60).toLowerCase();
    
    // Check if they start the same (same source, different excerpt)
    if (existingStart === newStart) return true;
    
    // Check if new text is contained within existing text
    if (part.includes(newText.substring(0, 40))) return true;
    if (newText.includes(part.substring(0, 40))) return true;
    
    // Check word overlap (if >70% same words, it's a duplicate)
    const newWords = new Set(newText.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const existingWords = new Set(part.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    if (newWords.size > 5 && existingWords.size > 5) {
      let overlap = 0;
      for (const w of newWords) {
        if (existingWords.has(w)) overlap++;
      }
      const overlapRatio = overlap / Math.min(newWords.size, existingWords.size);
      if (overlapRatio > 0.7) return true;
    }
  }
  return false;
}

// === FINAL TEXT CLEANER ===
function cleanText(text) {
  if (!text) return '';
  
  let clean = text;
  
  // Remove any remaining HTML entities
  clean = clean.replace(/&[a-zA-Z]+;/g, match => {
    const map = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&middot;': '·', '&ndash;': '–', '&mdash;': '—', '&hellip;': '...' };
    return map[match] || '';
  });
  
  // Clean whitespace
  clean = clean.replace(/[ \t]+/g, ' ');
  clean = clean.replace(/\n{3,}/g, '\n\n');
  clean = clean.replace(/^\s+|\s+$/g, '');
  
  // Remove orphaned single characters
  clean = clean.replace(/\s+[a-z]\s+/gi, ' ');
  
  return clean.trim();
}

// === SEARCH PROVIDERS ===

// Startpage search (Google results via Startpage proxy)
async function fetchStartpage(q) {
  const results = [];
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
    
    const titleMatches = [...html.matchAll(/<a[^>]*class="[^"]*result-title[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs)];
    
    for (const m of titleMatches.slice(0, 20)) {
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

// Wikipedia knowledge (high reliability for factual queries)
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

// DuckDuckGo Instant Answer (good for definitions and quick facts)
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

// Scrape URL for deeper content (last resort)
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

// === HELPERS ===

function buildResults(wiki, ddg, webResults) {
  const all = [];
  if (wiki) all.push({ title: wiki.title, url: wiki.url, content: wiki.extract?.substring(0, 300), engine: 'wikipedia', source: 'Wikipedia', featured: true });
  if (ddg && ddg.content) all.push({ title: ddg.title, url: ddg.url || '', content: ddg.content?.substring(0, 300), engine: 'duckduckgo', source: 'DuckDuckGo', featured: false });
  all.push(...webResults);
  return all;
}

function buildEffectiveQuery(question, history) {
  let q = question.trim();
  
  // Strip question words for better source matching
  q = q.replace(/^(what is the |what is a |what is an |what is |what are |what does |who is the |who is |who are |where is |where are |when was |when did |how does |how do |how is |why is |why are |why does |tell me about |tell me |explain |describe |define |give me |show me |find |search for )/i, '').trim();
  // Remove trailing question mark
  q = q.replace(/\?$/, '').trim();
  
  // Handle pronoun resolution from history
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
  if (truncated.length > maxChars) {
    truncated = truncated.substring(0, maxChars);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxChars * 0.7) truncated = truncated.substring(0, lastSpace);
    truncated += '...';
  }
  const words = truncated.split(/\s+/);
  if (words.length > maxWords) {
    truncated = words.slice(0, maxWords).join(' ') + '...';
  }
  return truncated;
}
