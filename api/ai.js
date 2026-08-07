// DeryCode AI API - Vercel Serverless
// Uses Google Gemini for current information + DeryCode knowledge base + web scraping

import { isDeryCodeQuery, getDeryCodeKnowledge } from './derycode-knowledge.js';

const MAX_QUERY_WORDS = 30;
const MAX_ANSWER_WORDS = 250;
const MAX_ANSWER_CHARS = 1500;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
const GEMINI_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-flash-latest'];

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
      model: 'DeryCode-KnowledgeBase + Gemini',
      lang
    });
  }
  
  // 2. Fetch web context - use DDG Lite (works server-side!) + Wikipedia
  const effectiveQuery = buildEffectiveQuery(question, history);
  const queryVariants = buildQueryVariants(effectiveQuery);
  
  let wiki = null, ddg = null, webResults = [];
  for (const variant of queryVariants) {
    const [w, d, ddgLiteResults] = await Promise.all([
      fetchWikipedia(variant),
      fetchDuckDuckGo(variant),
      fetchStartpage(variant)
    ]);
    if (w || (d && d.content) || ddgLiteResults.length > 0) {
      wiki = w; ddg = d; webResults = ddgLiteResults;
      break;
    }
  }
  
  // Build web context string
  let webContext = '';
  const sources = [];
  
  if (wiki && wiki.extract) {
    webContext += `Wikipedia: ${truncateWords(wiki.extract, 100, 600)}\n\n`;
    sources.push({ title: wiki.title, url: wiki.url, type: 'encyclopedia' });
  }
  if (ddg && ddg.content) {
    webContext += `DuckDuckGo: ${truncateWords(ddg.content, 60, 300)}\n\n`;
    sources.push({ title: ddg.title, url: ddg.url, type: 'instant-answer' });
  }
  for (const r of webResults.slice(0, 3)) {
    if (r.content && r.content.length > 50) {
      webContext += `${r.title}: ${truncateWords(r.content, 50, 250)}\n\n`;
      sources.push({ title: r.title, url: r.url, type: r.engine });
    }
  }
  
  // 3. Try Gemini API
  if (GEMINI_API_KEY) {
    const geminiAnswer = await askGemini(question, webContext, history, lang);
    if (geminiAnswer) {
      const allResults = buildResults(wiki, ddg, webResults);
      return res.status(200).json({
        question,
        answer: geminiAnswer,
        sources: sources.slice(0, 5),
        followups: generateFollowups(effectiveQuery),
        results: allResults.slice(0, 8),
        model: 'DeryCode-Gemini-v2',
        lang,
        grounded: true
      });
    }
  }
  
  // 4. Fallback: Use web context directly
  let answerText = '';
  
  if (wiki) {
    answerText += truncateWords(wiki.extract, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
  }
  if (ddg && ddg.content) {
    if (answerText) answerText += '\n\n';
    answerText += truncateWords(ddg.content, 80, 400);
  }
  for (const r of webResults.slice(0, 3)) {
    if (r.content && r.content.length > 50 && answerText.length < MAX_ANSWER_CHARS - 200) {
      if (answerText) answerText += '\n\n';
      answerText += truncateWords(r.content, 60, 300);
    }
  }
  
  // 5. If nothing found, try scraping top web results for content
  if ((!answerText || answerText.length < 30) && webResults.length > 0) {
    for (const r of webResults.slice(0, 2)) {
      try {
        const scraped = await scrapeUrl(r.url);
        if (scraped && scraped.length > 50) {
          if (answerText) answerText += '\n\n';
          answerText += truncateWords(scraped, 80, 400);
          if (!sources.find(s => s.url === r.url)) {
            sources.push({ title: r.title, url: r.url, type: 'scraped' });
          }
        }
      } catch {}
    }
  }
  
  // 6. Final fallback message
  if (!answerText || answerText.length < 20) {
    answerText = `I couldn't find specific information about "${question}". Try the Web search mode for more results, or rephrase your question.`;
  }
  
  answerText = truncateWords(answerText, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
  answerText = cleanText(answerText);
  
  const allResults = buildResults(wiki, ddg, webResults);
  
  res.status(200).json({
    question, answer: answerText,
    sources: sources.slice(0, 5),
    followups: generateFollowups(effectiveQuery),
    results: allResults.slice(0, 8),
    model: GEMINI_API_KEY ? 'DeryCode-Gemini-v2' : 'DeryCode-Web-v1',
    lang,
    grounded: false
  });
}

// Gemini API call with multi-model fallback
async function askGemini(question, webContext, history, lang) {
  const langInstruction = {
    en: 'Respond in English.',
    sw: 'Respond in Kiswahili.',
    lg: 'Respond in Luganda.',
    rn: 'Respond in Runyoro.',
    luo: 'Respond in Dholuo.',
    te: 'Respond in Ateso.'
  }[lang] || 'Respond in English.';
  
  let conversationHistory = '';
  if (history && history.length > 0) {
    const recent = history.slice(-4);
    for (const m of recent) {
      if (m.role === 'user') conversationHistory += `User: ${m.content}\n`;
      else if (m.role === 'assistant' && m.content) conversationHistory += `Assistant: ${m.content.substring(0, 300)}\n`;
    }
  }
  
  const prompt = `You are DeryCode AI, a helpful search assistant. ${langInstruction} Keep your answer concise (max 200 words). Be direct and informative.

IMPORTANT: Only output the answer itself. Do not include any meta commentary, word counts, self-checks, formatting notes, or thinking process. Just give the answer directly.

${webContext ? 'Web context for grounding:\n' + webContext : ''}
${conversationHistory ? 'Conversation so far:\n' + conversationHistory : ''}

User question: ${question}

Answer:`;
  
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 600, topP: 0.9 },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ]
  });
  
  // Try each model until one works
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 10) {
          let cleaned = cleanText(text);
          // Remove all meta artifacts (Gemini sometimes outputs thinking process)
          const metaPatterns = [
            /^(?:Word count|Draft|Direct|Tone|Language|Matches|Self-check|Checked|Yes|No|Persona|Instructions)[::]?\s*.*$/gim,
            /^\*[^*]*\*\s*$/gim,
            /^\d+\.\s*(?:Yes|No|Checked)\s*$/gim,
            /^.*?(?:meta instructions|formatting markers).*$/gim
          ];
          for (const p of metaPatterns) {
            cleaned = cleaned.replace(p, '').trim();
          }
          // Remove bold markers
          cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
          // Remove bullet markers
          cleaned = cleaned.replace(/^[-*•]\s+/gm, '');
          // Clean up extra whitespace
          cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
          if (cleaned.length > 10) {
            return truncateWords(cleaned, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
          }
        }
      }
      
      // 429 = rate limited, try next model
      // 404 = model not found, try next
      // 400 = bad request, try next
      if (response.status === 429 || response.status === 404 || response.status === 400) continue;
      
      // Other errors, log and try next
      const errText = await response.text();
      console.error(`Gemini ${model}:`, response.status, errText.substring(0, 200));
      continue;
    } catch (e) {
      console.error(`Gemini ${model}:`, e.message);
      continue;
    }
  }
  
  return null;
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
  const allResults = [];
  if (wiki) allResults.push({ title: wiki.title, url: wiki.url, content: wiki.extract?.substring(0,200), engine:'wikipedia', source:'Wikipedia', featured:true });
  if (ddg) allResults.push({ title: ddg.title, url: ddg.url, content: ddg.content?.substring(0,200), engine:'duckduckgo', source:'DuckDuckGo', featured:true });
  allResults.push(...webResults.slice(0, 5));
  return allResults;
}

function buildEffectiveQuery(question, history) {
  let q = question;
  if (history && history.length > 0) {
    const lastUser = [...history].reverse().find(m => m.role === 'user');
    if (lastUser) {
      let topic = lastUser.content.toLowerCase()
        .replace(/^(what is |what is the |what is a |who is |tell me about |explain |describe )/, '')
        .substring(0, 80);
      const isFollowup = ['its ','it ','this ','that ','the ','about ','more '].some(w => question.toLowerCase().startsWith(w)) || question.length < 25;
      if (isFollowup && topic) q = `${topic} ${question}`;
    }
  }
  return buildQueryVariants(q)[0];
}

function generateFollowups(query) {
  const wordList = query.split(' ').filter(w => 
    !['what','is','the','about','its','it','tell','me','who','a','and','of','for','in','to','known','how','does','work'].includes(w.toLowerCase())
  );
  const topic = wordList.slice(0, 3).join(' ');
  return topic ? [
    `Tell me more about ${topic}`,
    `What are the latest news about ${topic}?`,
    `Can you explain ${topic} in simple terms?`
  ] : ['Tell me more','What are the latest developments?','Can you explain in simpler terms?'];
}

function buildQueryVariants(q) {
  const variants = [];
  let cleaned = q.trim().replace(/\?$/, '').trim();
  cleaned = cleaned.replace(/^(what is |what is the |what is a |what are |who is |who is the |who are |tell me about |explain |describe |how does |how do |how is |how are |when did |when was |where is |where are |why is |why are |can you |please )/i, '');
  cleaned = cleaned.replace(/\s*(known for|famous for|in africa|in uganda|in east africa)$/i, '').trim();
  if (cleaned.length > 2) variants.push(cleaned);
  const words4 = cleaned.split(/\s+/).filter(w => w.length > 2).slice(0, 4).join(' ');
  if (words4.length > 2 && !variants.includes(words4)) variants.push(words4);
  const words3 = cleaned.split(/\s+/).filter(w => w.length > 2).slice(0, 3).join(' ');
  if (words3.length > 2 && !variants.includes(words3)) variants.push(words3);
  const words2 = cleaned.split(/\s+/).filter(w => w.length > 2).slice(0, 2).join(' ');
  if (words2.length > 2 && !variants.includes(words2)) variants.push(words2);
  if (!variants.includes(q)) variants.push(q);
  return variants.length > 0 ? variants : [q];
}

function cleanText(text) {
  return text
    .replace(/^Here's .*?:/i, '')
    .replace(/^Based on .*?:/i, '')
    .replace(/^According to .*?:/i, '')
    .replace(/&quot;/g,'"').replace(/&amp;/g,'&')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'")
    .trim();
}

function truncateWords(text, maxWords, maxChars) {
  if (!text) return '';
  const words = text.split(/\s+/);
  let result = words.slice(0, maxWords).join(' ');
  if (result.length > maxChars) result = result.substring(0, maxChars);
  if (words.length > maxWords) result += '...';
  return result;
}


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
    for (const m of titleMatches.slice(0, 8)) {
      let url = m[1];
      let title = m[2].replace(/<[^>]+>/g, '').trim();
      if (title.includes('.css-')) continue;
      title = title.replace(/\{[^}]*\}/g, '').trim();
      const resultBlock = html.substring(m.index, m.index + 1500);
      const snippetMatch = resultBlock.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/p>/s)
                        || resultBlock.match(/<span[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/span>/s);
      let snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() : '';
      let domain = '';
      try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
      if (title.length > 3 && url.startsWith('http')) {
        results.push({ title: title.substring(0,200), url, content: snippet.substring(0,250), engine:'startpage', source: domain || 'Startpage', featured:false });
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
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
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
