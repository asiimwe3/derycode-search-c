// DeryCode AI API - Vercel Serverless
// Uses Google Gemini for current information + DeryCode knowledge base + web scraping

import { isDeryCodeQuery, getDeryCodeKnowledge } from './derycode-knowledge.js';

const MAX_QUERY_WORDS = 30;
const MAX_ANSWER_WORDS = 250;
const MAX_ANSWER_CHARS = 1500;

// Gemini API config
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';

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
  
  // 1. Check DeryCode knowledge base first (instant, no API call)
  if (isDeryCodeQuery(question)) {
    const kb = getDeryCodeKnowledge(question);
    const truncated = truncateWords(kb.answer, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
    return res.status(200).json({
      question,
      answer: truncated,
      sources: kb.sources,
      followups: kb.followups,
      results: [],
      model: 'DeryCode-KnowledgeBase + Gemini',
      lang
    });
  }
  
  // 2. Fetch web context (Wikipedia + DuckDuckGo) for grounding
  const effectiveQuery = buildEffectiveQuery(question, history);
  const [wiki, ddg, webResults] = await Promise.all([
    fetchWikipedia(effectiveQuery),
    fetchDuckDuckGo(effectiveQuery),
    fetchDDGHTML(effectiveQuery)
  ]);
  
  // Build context from web results
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
  
  // 3. Try Gemini API for a synthesized, current answer
  if (GEMINI_API_KEY) {
    try {
      const geminiAnswer = await askGemini(question, webContext, history, lang);
      if (geminiAnswer) {
        // Scrape top result for additional context if available
        let scrapedContent = '';
        if (webResults.length > 0 && webResults[0].url) {
          try {
            const scrapeRes = await fetch(`https://${req.headers.host}/api/scrape?url=${encodeURIComponent(webResults[0].url)}`);
            const scrapeData = await scrapeRes.json();
            if (scrapeData.content) {
              scrapedContent = scrapeData.content.substring(0, 500);
            }
          } catch {}
        }
        
        const allResults = [];
        if (wiki) allResults.push({ title: wiki.title, url: wiki.url, content: wiki.extract?.substring(0,200), engine:'wikipedia', source:'Wikipedia', featured:true });
        if (ddg) allResults.push({ title: ddg.title, url: ddg.url, content: ddg.content?.substring(0,200), engine:'duckduckgo', source:'DuckDuckGo', featured:true });
        allResults.push(...webResults.slice(0, 5));
        
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
    } catch (e) {
      console.error('Gemini error:', e.message);
      // Fall through to fallback
    }
  }
  
  // 4. Fallback: Use web context directly (no Gemini key)
  let answerText = '';
  
  if (wiki) {
    answerText += truncateWords(wiki.extract, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
  }
  if (ddg && ddg.content) {
    if (answerText) answerText += '\n\n';
    answerText += truncateWords(ddg.content, 80, 400);
  }
  for (const r of webResults.slice(0, 2)) {
    if (r.content && r.content.length > 50 && answerText.length < MAX_ANSWER_CHARS - 200) {
      if (answerText) answerText += '\n\n';
      answerText += truncateWords(r.content, 60, 300);
    }
  }
  
  if (!answerText || answerText.length < 20) {
    answerText = `I couldn't find specific information about "${question}". Try rephrasing or use Web search mode.`;
  }
  
  answerText = truncateWords(answerText, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
  answerText = answerText.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'");
  
  const allResults = [];
  if (wiki) allResults.push({ title: wiki.title, url: wiki.url, content: wiki.extract?.substring(0,200), engine:'wikipedia', source:'Wikipedia', featured:true });
  if (ddg) allResults.push({ title: ddg.title, url: ddg.url, content: ddg.content?.substring(0,200), engine:'duckduckgo', source:'DuckDuckGo', featured:true });
  allResults.push(...webResults.slice(0, 5));
  
  res.status(200).json({
    question, answer: answerText,
    sources: sources.slice(0, 5),
    followups: generateFollowups(effectiveQuery),
    results: allResults.slice(0, 8),
    model: GEMINI_API_KEY ? 'DeryCode-Gemini-v2' : 'DeryCode-Web-v1',
    lang,
    grounded: !!GEMINI_API_KEY
  });
}

// Gemini API call
async function askGemini(question, webContext, history, lang) {
  const langInstruction = {
    en: 'Respond in English.',
    sw: 'Respond in Kiswahili.',
    lg: 'Respond in Luganda.',
    rn: 'Respond in Runyoro.',
    luo: 'Respond in Dholuo.',
    te: 'Respond in Ateso.'
  }[lang] || 'Respond in English.';
  
  // Build conversation context
  let conversationHistory = '';
  if (history && history.length > 0) {
    const recent = history.slice(-4);
    for (const m of recent) {
      if (m.role === 'user') conversationHistory += `User: ${m.content}\n`;
      else if (m.role === 'assistant' && m.content) conversationHistory += `Assistant: ${m.content.substring(0, 300)}\n`;
    }
  }
  
  const systemPrompt = `You are DeryCode AI, a helpful search assistant. Provide accurate, current information. ${langInstruction}
Keep your answer concise (max 200 words). If web context is provided, use it as grounding but add your own knowledge too.
Be direct and informative. If you're not sure, say so.

${webContext ? 'Web context for grounding:\n' + webContext : ''}
${conversationHistory ? 'Conversation so far:\n' + conversationHistory : ''}

Question: ${question}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 600,
        topP: 0.9
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    }),
    signal: AbortSignal.timeout(10000)
  });
  
  if (!response.ok) {
    const errText = await response.text();
    console.error('Gemini API error:', response.status, errText);
    return null;
  }
  
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) return null;
  
  // Clean and truncate
  let cleaned = text.trim()
    .replace(/^Here's .*?:/i, '')
    .replace(/^Based on .*?:/i, '')
    .replace(/^According to .*?:/i, '')
    .trim();
  
  return truncateWords(cleaned, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
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
