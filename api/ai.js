// DeryCode AI API - Vercel Serverless
// Gemini-style AI chat with conversation support

import { isDeryCodeQuery, getDeryCodeKnowledge } from './derycode-knowledge.js';

const MAX_QUERY_WORDS = 30;
const MAX_ANSWER_WORDS = 200;
const MAX_ANSWER_CHARS = 1200;

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
  
  // Check DeryCode knowledge base first
  if (isDeryCodeQuery(question)) {
    const kb = getDeryCodeKnowledge(question);
    const truncated = truncateWords(kb.answer, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
    return res.status(200).json({
      question,
      answer: truncated,
      sources: kb.sources,
      followups: kb.followups,
      results: [],
      model: 'DeryCode-AI-KnowledgeBase-v1',
      lang
    });
  }
  
  // Build effective query (conversation-aware)
  let effectiveQuery = question;
  if (history && history.length > 0) {
    const lastUser = [...history].reverse().find(m => m.role === 'user');
    if (lastUser) {
      let topic = lastUser.content.toLowerCase()
        .replace(/^(what is |what is the |what is a |who is |tell me about |explain |describe )/, '')
        .substring(0, 80);
      const isFollowup = ['its ','it ','this ','that ','the ','about ','more '].some(w => question.toLowerCase().startsWith(w)) || question.length < 25;
      if (isFollowup && topic) effectiveQuery = `${topic} ${question}`;
    }
  }
  
  // Clean query and generate search variants
  const queryVariants = buildQueryVariants(effectiveQuery);
  
  // Try each variant until we get results
  let wiki = null, ddg = null, webResults = [];
  
  for (const variant of queryVariants) {
    const [w, d, wr] = await Promise.all([
      fetchWikipedia(variant),
      fetchDuckDuckGo(variant),
      fetchDDGHTML(variant)
    ]);
    
    if (w || (d && d.content) || wr.length > 0) {
      wiki = w;
      ddg = d;
      webResults = wr;
      break;
    }
  }
  
  const sources = [];
  let answerText = '';
  
  if (wiki) {
    const extract = truncateWords(wiki.extract, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
    if (extract.length > 30) {
      answerText = extract;
      sources.push({ title: wiki.title, url: wiki.url, type: 'encyclopedia' });
    }
  }
  
  if (ddg && ddg.content && ddg.content.length > 30) {
    if (answerText) answerText += '\n\n';
    answerText += truncateWords(ddg.content, 80, 400);
    sources.push({ title: ddg.title, url: ddg.url, type: 'instant-answer' });
  }
  
  for (const r of webResults.slice(0, 2)) {
    if (r.content && r.content.length > 50 && answerText.length < MAX_ANSWER_CHARS - 200) {
      if (answerText) answerText += '\n\n';
      answerText += truncateWords(r.content, 60, 300);
      sources.push({ title: r.title, url: r.url, type: r.engine });
    }
  }
  
  if (!answerText || answerText.length < 20) {
    answerText = `I couldn't find specific information about "${question}". Try rephrasing your question or use the web search results below.`;
  }
  
  answerText = truncateWords(answerText, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
  answerText = answerText.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'");
  
  // Follow-ups
  const wordList = queryVariants[0].split(' ').filter(w => 
    !['what','is','the','about','its','it','tell','me','who','a','and','of','for','in','to','known','how','does','work'].includes(w.toLowerCase())
  );
  const topic = wordList.slice(0, 3).join(' ');
  const followups = topic ? [
    `Tell me more about ${topic}`,
    `What are the latest news about ${topic}?`,
    `Can you explain ${topic} in simple terms?`
  ] : ['Tell me more','What are the latest developments?','Can you explain in simpler terms?'];
  
  // Build results
  const allResults = [];
  if (wiki) allResults.push({ title: wiki.title, url: wiki.url, content: wiki.extract.substring(0,200), engine:'wikipedia', source:'Wikipedia', featured:true });
  if (ddg) allResults.push({ title: ddg.title, url: ddg.url, content: ddg.content.substring(0,200), engine:'duckduckgo', source:'DuckDuckGo', featured:true });
  allResults.push(...webResults.slice(0, 5));
  
  res.status(200).json({
    question, answer: answerText,
    sources: sources.slice(0, 5),
    followups,
    results: allResults.slice(0, 8),
    model: 'DeryCode-AI-Node-v1', lang
  });
}

function buildQueryVariants(q) {
  // Generate multiple search query variants from most specific to most general
  const variants = [];
  let cleaned = q.trim().replace(/\?$/, '').trim();
  
  // Remove question prefixes
  cleaned = cleaned.replace(/^(what is |what is the |what is a |what are |who is |who is the |who are |tell me about |explain |describe |how does |how do |how is |how are |when did |when was |where is |where are |why is |why are |can you |please )/i, '');
  
  // Remove trailing question phrases
  cleaned = cleaned.replace(/\s*(known for|famous for|known for\?|in africa|in uganda|in east africa)$/i, '').trim();
  
  // Variant 1: cleaned full query
  if (cleaned.length > 2) variants.push(cleaned);
  
  // Variant 2: first 4 words (significant)
  const words4 = cleaned.split(/\s+/).filter(w => w.length > 2).slice(0, 4).join(' ');
  if (words4.length > 2 && !variants.includes(words4)) variants.push(words4);
  
  // Variant 3: first 3 words
  const words3 = cleaned.split(/\s+/).filter(w => w.length > 2).slice(0, 3).join(' ');
  if (words3.length > 2 && !variants.includes(words3)) variants.push(words3);
  
  // Variant 4: first 2 words
  const words2 = cleaned.split(/\s+/).filter(w => w.length > 2).slice(0, 2).join(' ');
  if (words2.length > 2 && !variants.includes(words2)) variants.push(words2);
  
  // Variant 5: just the first significant word (proper noun likely)
  const words1 = cleaned.split(/\s+/).filter(w => w.length > 2 && w[0] === w[0].toUpperCase()).slice(0, 1).join(' ');
  if (words1.length > 2 && !variants.includes(words1)) variants.push(words1);
  
  // Variant 6: original query as-is
  if (!variants.includes(q)) variants.push(q);
  
  return variants.length > 0 ? variants : [q];
}

function truncateWords(text, maxWords, maxChars) {
  if (!text) return '';
  const words = text.split(/\s+/);
  let result = words.slice(0, maxWords).join(' ');
  if (result.length > maxChars) result = result.substring(0, maxChars);
  if (words.length > maxWords) result += '...';
  return result;
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
    while ((match = resultRegex.exec(html)) !== null && count < 6) {
      let href = match[1].replace(/&amp;/g, '&');
      const uddg = href.match(/uddg=([^&]+)/);
      if (uddg) href = decodeURIComponent(uddg[1]);
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const content = match[3].replace(/<[^>]*>/g, '').trim();
      if (title && href.startsWith('http')) {
        results.push({ title: title.substring(0,200), url: href, content: content.substring(0,300), engine:'duckduckgo', source:'DuckDuckGo', featured:false });
        count++;
      }
    }
    return results;
  } catch { return []; }
}
