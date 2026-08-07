// DeryCode AI API - Vercel Serverless
// Accurate answer synthesis from multiple sources
// Prioritizes relevance, coherence, and factual accuracy

const MAX_QUERY_WORDS = 500;
const MAX_ANSWER_WORDS = 5000;
const MAX_ANSWER_CHARS = 5000;

// === Inlined from derycode-knowledge.js ===
// DeryCode Tech Knowledge Base - Built-in responses

function isDeryCodeQuery(query) {
  const keywords = [
    'derycode', 'dery code', 'asiimwe derick', 'derick asiimwe', 'traderderick',
    'sageco', 'sageco evergreen', 'tropical gardens', 'peters medicare',
    'derycoin', 'deryloan', 'sacco wallet', 'agrolink', 'property masters',
    'tooro music', 'elite community', 'elite members', 'adcon',
    'worldtech youth', 'school management', 'school report', 'school sync',
    'derycode search', 'derycode whatsapp', 'derick ai portfolio'
  ];
  const lower = query.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

function getDeryCodeKnowledge(query) {
  const lower = query.toLowerCase();

  if (lower.includes('asiimwe') || lower.includes('derick') || lower.includes('founder') || lower.includes('ceo') || lower.includes('who')) {
    return {
      answer: "Asiimwe Derick (also known as Derick Asiimwe or TraderDerick) is the Founder & CEO of DeryCode Technologies and CEO of Sageco Evergreen Company Limited. He founded DeryCode in 2021 to prove that world-class software, blockchain, and AI solutions can be built right here in Uganda — for clients across Africa and beyond. With hands-on experience across full-stack web development, mobile apps, fintech/SACCO platforms, and Web3, Derick leads every DeryCode project personally — from architecture to deployment. He is recognized as one of Uganda's top software engineers and blockchain developers. As CEO of Sageco Evergreen, he also leads innovative real estate and property technology solutions across Uganda. GitHub: github.com/asiimwe3 | LinkedIn: ug.linkedin.com/in/asiimwe-derick-501755313 | WhatsApp: +256 772 002 326 / +256 762 306 675 | Email: info@derycode.com",
      sources: [
        { title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' },
        { title: 'GitHub Profile', url: 'https://github.com/asiimwe3' }
      ],
      followups: ['What services does DeryCode offer?', 'What projects has DeryCode built?', 'How can I contact DeryCode?']
    };
  }

  if (lower.includes('service') || lower.includes('offer') || lower.includes('what does') || lower.includes('what do')) {
    return {
      answer: "DeryCode Technologies offers 12 core services: 1) Business Website Development (from UGX 750,000) 2) Web Applications & SaaS Platforms (from UGX 2,200,000) 3) Mobile Apps iOS & Android (from UGX 4,400,000) 4) Banking & SACCO Software with MTN MoMo, Airtel Money integration (from UGX 3,800,000) 5) Business Management & ERP Systems (from UGX 3,500,000) 6) School Digital Libraries & LMS (from UGX 3,000,000) 7) Smart Contracts & Blockchain Development (from UGX 5,500,000) 8) AI & Automation Solutions (from UGX 2,500,000) 9) Digital Marketing & SEO (from UGX 1,500,000) 10) UI/UX Design & Branding (from UGX 1,200,000) 11) Token & Crypto Development (from UGX 6,000,000) 12) API & Payment Integrations - Pesapal, Flutterwave, Stripe, PayPal (from UGX 1,800,000). Contact: info@derycode.com or WhatsApp +256 772 002 326",
      sources: [{ title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' }],
      followups: ['How much does a website cost at DeryCode?', 'How can I contact DeryCode?', 'What projects has DeryCode built?']
    };
  }

  if (lower.includes('price') || lower.includes('cost') || lower.includes('how much') || lower.includes('fees') || lower.includes('charge')) {
    return {
      answer: "DeryCode Technologies Pricing: Business Websites: from UGX 750,000. Web Apps & SaaS: from UGX 2,200,000. E-commerce: from UGX 2,500,000. Mobile Apps (iOS/Android): from UGX 4,400,000. Banking & SACCO Software: from UGX 3,800,000. ERP Systems: from UGX 3,500,000. School Digital Libraries: from UGX 3,000,000. Smart Contracts & Blockchain: from UGX 5,500,000. AI & Automation: from UGX 2,500,000. Digital Marketing & SEO: from UGX 1,500,000. UI/UX Design: from UGX 1,200,000. API & Payment Integration: from UGX 1,800,000. Token & Crypto: from UGX 6,000,000. Contact for a free quote: info@derycode.com or WhatsApp +256 772 002 326",
      sources: [{ title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' }],
      followups: ['What services does DeryCode offer?', 'How can I contact DeryCode?', 'How long does a project take?']
    };
  }

  if (lower.includes('where') || lower.includes('location') || lower.includes('address') || lower.includes('based') || lower.includes('office')) {
    return {
      answer: "DeryCode Technologies is headquartered in Kampala, Uganda, with operations in Kyenjojo and serving clients across the entire country including Fort Portal, Mbarara, Jinja, Gulu, and globally. Email: info@derycode.com | WhatsApp: +256 772 002 326 / +256 762 306 675 | Website: derycode.publicvm.com",
      sources: [{ title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' }],
      followups: ['What services does DeryCode offer?', 'How can I contact DeryCode?', 'Who is the founder of DeryCode?']
    };
  }

  if (lower.includes('contact') || lower.includes('reach') || lower.includes('email') || lower.includes('phone') || lower.includes('whatsapp')) {
    return {
      answer: "Contact DeryCode Technologies: Email: info@derycode.com | WhatsApp: +256 772 002 326 / +256 762 306 675 | Website: derycode.publicvm.com | GitHub: github.com/asiimwe3 | LinkedIn: ug.linkedin.com/in/asiimwe-derick-501755313. Based in Kampala, Uganda, serving clients across East Africa and globally.",
      sources: [{ title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' }],
      followups: ['What services does DeryCode offer?', 'How much does a website cost?', 'Who is the founder?']
    };
  }

  if (lower.includes('search') && (lower.includes('derycode') || lower.includes('engine'))) {
    return {
      answer: "DeryCode Search is a premium AI-powered search engine with 10 search modes and 22 sources. It features: AI Summaries (auto-generated from top results), Knowledge Panels (Wikipedia summaries), Voice Search, Autocomplete suggestions, Related searches, Search history, Deep Web search (Wikidata, CORE, World Bank, Ahmia .onion index, CrossRef, Internet Archive), Maps integration, Books search, and Code search. Privacy-focused: no tracking, no ads. Mobile responsive PWA. Live on Vercel. GitHub: github.com/asiimwe3/derycode-search-c",
      sources: [
        { title: 'DeryCode Search', url: 'https://derycode-search-c.vercel.app' },
        { title: 'GitHub Repository', url: 'https://github.com/asiimwe3/derycode-search-c' }
      ],
      followups: ['What features does DeryCode Search have?', 'How does DeryCode Search work?', 'What other projects has DeryCode built?']
    };
  }

  return null;
}

// === QUERY INTENT DETECTION ===
function detectIntent(question) {
  const lower = question.toLowerCase().trim();
  
  if (/^(how (do|to|can|does)|what (do|steps)|guide|tutorial|instructions|build|create|make|set up|install)/.test(lower)) {
    return 'howto';
  }
  if (/^(who is|who was|who are)/.test(lower)) {
    return 'person';
  }
  if (/^(what is|what are|what does|define|meaning of|definition)/.test(lower)) {
    return 'definition';
  }
  if (/^(when|what year|what date)/.test(lower)) {
    return 'date';
  }
  if (/^(where|what city|what country|location of)/.test(lower)) {
    return 'location';
  }
  if (/^(why|reason|cause)/.test(lower)) {
    return 'reason';
  }
  if (/news|latest|recent|today|current|happening|update/.test(lower)) {
    return 'news';
  }
  if (/vs|versus|compare|difference between|better/.test(lower)) {
    return 'comparison';
  }
  return 'general';
}

// === KEYWORD EXTRACTION ===
function getKeywords(q) {
  const stop = new Set(['the','a','an','is','are','was','were','how','to','do','does','what','who',
    'can','i','you','my','me','we','our','and','or','but','in','on','at','for',
    'of','with','from','by','about','into','your','this','that','it','its',
    'tell','explain','describe','show','give','want','need','like','please',
    'much','many','long','time','year','best','top','good','bad']);
  return q.toLowerCase().split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w))
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length > 2);
}

// === SNIPPET RELEVANCE SCORING ===
function scoreSnippet(snippet, keywords, intent) {
  if (!snippet || snippet.length < 30) return 0;
  const lower = snippet.toLowerCase();
  let score = 0;
  
  // Keyword matches
  for (const kw of keywords) {
    if (lower.includes(kw)) score += 10;
  }
  
  // Intent-specific scoring
  if (intent === 'definition' || intent === 'person') {
    // Prefer snippets that start with a definitive answer
    if (/^[A-Z][a-z].*(is|was|are|refers to|means|defined as)/.test(snippet.substring(0, 100))) {
      score += 25;
    }
  }
  
  if (intent === 'howto') {
    // Prefer snippets with step-by-step content
    if (/\d+[.)]|\bstep\b|\bfirst\b|\bthen\b|\bnext\b|\bfinally\b|guide|tutorial/.test(lower)) {
      score += 20;
    }
  }
  
  // Quality signals - penalize junk
  if (/cookie|privacy policy|terms of|sign up|log in|subscribe|download app|get started|menu|navigation|browse/.test(lower)) {
    score -= 30;
  }
  
  if (/^(hi |hey |hello |wanna |i want |i need |looking for )/.test(lower)) {
    score -= 20;
  }
  
  // Prefer longer, more informative snippets
  if (snippet.length > 200) score += 5;
  if (snippet.length > 400) score += 5;
  
  // Penalize very short snippets
  if (snippet.length < 80) score -= 15;
  
  return score;
}

// === SNIPPET QUALITY FILTER ===
function isLowQuality(text) {
  if (!text || text.length < 30) return true;
  const lower = text.toLowerCase();
  
  // Filter out navigation/menu text
  if (/^(home|about|contact|menu|search|login|sign up|register|cart|checkout|skip to|back to)/.test(lower)) return true;
  
  // Filter out cookie notices
  if (/cookie|privacy policy|we use cookies|accept cookies|gdpr|consent/.test(lower)) return true;
  
  // Filter out UI artifacts
  if (/click here|read more|learn more|view more|see all|show more/.test(lower) && text.length < 100) return true;
  
  // Filter out forum/social junk
  if (/^(hi |hey |hello |yo |sup )/.test(lower) && text.length < 150) return true;
  if (/\b(guys|check out|popped up|hit that|smash|like and subscribe|ring the bell)\b/.test(lower)) return true;
  
  // Filter out broken text (too many special chars)
  const specialRatio = (text.match(/[^a-zA-Z0-9\s]/g) || []).length / text.length;
  if (specialRatio > 0.25) return true;
  
  // Filter out URLs-only
  if (/^https?:\/\//.test(lower) && text.split(/\s+/).length < 10) return true;
  
  // Filter out marketing/promotional content
  if (/\b(free trial|buy now|shop now|order now|get started today|sign up for free|limited time|act now|don't miss)\b/.test(lower)) return true;
  
  // Filter out YouTube/video descriptions
  if (/\b(subscribe|hit the|ring the|smash that|notification bell|new video|check out my)\b/.test(lower)) return true;
  
  // Filter out GoDaddy/Squarespace/Wix promotional text
  if (/\b(godaddy|squarespace|wix\.com|weebly|wordpress\.com)\b/i.test(text) && /\b(free|builder|template|start|create)\b/i.test(lower)) return true;
  
  // Filter out very repetitive text
  const words = lower.split(/\s+/);
  if (words.length > 10) {
    const wordSet = new Set(words);
    if (wordSet.size / words.length < 0.4) return true; // Too repetitive
  }
  
  return false;
}

// === SENTENCE EXTRACTION ===
function extractSentences(text) {
  if (!text) return [];
  
  // Clean and split into sentences
  let clean = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Split on sentence boundaries
  const sentences = [];
  let current = '';
  let prevChar = '';
  
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    current += char;
    
    if (char === '.' || char === '!' || char === '?') {
      // Check if it's a real sentence end (not an abbreviation)
      const nextChar = clean[i + 1] || '';
      const isAbbrev = /\b(?:mr|dr|vs|etc|inc|corp|ltd|st|jr|sr|ph\.d|m\.d|b\.a|m\.s|u\.s|u\.k|e\.g|i\.e)\.$/i.test(current);
      
      if (!isAbbrev && (nextChar === ' ' || nextChar === '' || nextChar === '\n')) {
        const trimmed = current.trim();
        if (trimmed.length > 25) {
          sentences.push(trimmed);
        }
        current = '';
      }
    }
  }
  
  if (current.trim().length > 25) {
    sentences.push(current.trim());
  }
  
  return sentences;
}

// === SNIPPET DEDUPLICATION (sentence level) ===
function deduplicateSentences(sentences) {
  const result = [];
  const seen = new Set();
  
  for (const s of sentences) {
    // Create a normalized key (first 50 chars, lowercase, no punctuation)
    const key = s.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
    
    if (key.length < 10) continue;
    
    // Check for similar sentences
    let isDup = false;
    for (const r of result) {
      const rKey = r.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
      // Check if first 30 chars match
      if (key.substring(0, 30) === rKey.substring(0, 30)) {
        isDup = true;
        break;
      }
      // Check word overlap
      const words1 = new Set(s.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const words2 = new Set(r.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      if (words1.size > 3 && words2.size > 3) {
        let overlap = 0;
        for (const w of words1) if (words2.has(w)) overlap++;
        if (overlap / Math.min(words1.size, words2.size) > 0.6) {
          isDup = true;
          break;
        }
      }
    }
    
    if (!isDup) {
      seen.add(key);
      result.push(s);
    }
  }
  
  return result;
}

// === ANSWER SYNTHESIS ===
// Builds a coherent answer from multiple sources
// Preserves source order, prioritizes direct answers
async function synthesizeAnswer(question, wiki, ddg, webResults, query) {
  const intent = detectIntent(question);
  const keywords = getKeywords(query);
  
  // Collect and score all available snippets
  const snippets = [];
  
  // Priority 1: Wikipedia (highest reliability for factual queries)
  if (wiki && wiki.extract && wiki.extract.length > 50) {
    const wikiText = cleanSnippet(wiki.extract);
    if (wikiText.length > 30 && !isLowQuality(wikiText)) {
      snippets.push({
        text: wikiText,
        score: scoreSnippet(wikiText, keywords, intent) + 50,
        source: 'Wikipedia',
        url: wiki.url,
        priority: 1
      });
    }
  }
  
  // Priority 2: DuckDuckGo Instant Answer
  if (ddg && ddg.content && ddg.content.length > 50) {
    const ddgText = cleanSnippet(ddg.content);
    if (ddgText.length > 30 && !isLowQuality(ddgText)) {
      snippets.push({
        text: ddgText,
        score: scoreSnippet(ddgText, keywords, intent) + 30,
        source: 'DuckDuckGo',
        url: ddg.url || '',
        priority: 2
      });
    }
  }
  
  // Priority 3: Web results (scored by relevance)
  for (const r of webResults.slice(0, 8)) {
    if (r.content && r.content.length > 80) {
      const snippet = cleanSnippet(r.content);
      if (snippet.length > 50 && !isLowQuality(snippet)) {
        snippets.push({
          text: snippet,
          score: scoreSnippet(snippet, keywords, intent),
          source: r.source || r.engine || 'Web',
          url: r.url,
          priority: 3
        });
      }
    }
  }
  
  // Priority 4: Scrape top result if not enough quality content
  if (snippets.filter(s => s.score > 15).length < 2 && webResults.length > 0) {
    for (const r of webResults.slice(0, 3)) {
      if (r.engine === 'reddit' || r.engine === 'hackernews') continue;
      try {
        const scraped = await scrapeUrl(r.url);
        if (scraped && scraped.length > 200) {
          const clean = cleanSnippet(scraped);
          if (clean.length > 100 && !isLowQuality(clean)) {
            snippets.push({
              text: clean,
              score: scoreSnippet(clean, keywords, intent) + 10,
              source: r.source || 'Web',
              url: r.url,
              priority: 4
            });
          }
        }
      } catch {}
      if (snippets.filter(s => s.score > 15).length >= 3) break;
    }
  }
  
  // Sort snippets by score (highest first)
  snippets.sort((a, b) => b.score - a.score);
  
  // Filter out low-scoring snippets
  const goodSnippets = snippets.filter(s => s.score > 0);
  
  if (goodSnippets.length === 0) {
    return {
      answer: webResults.length > 0
        ? `I found ${webResults.length} web results for "${question}", but couldn't extract a clear answer. Please check the sources below for detailed information.`
        : `I couldn't find reliable information about "${question}". Try rephrasing your question or use Web search mode for more results.`,
      confidence: webResults.length > 0 ? 'low' : 'none'
    };
  }
  
  // Build answer by processing each snippet in score order
  // but preserving sentence order within each snippet
  let answerSentences = [];
  let totalLength = 0;
  const seenSentences = new Set();
  
  for (const snippet of goodSnippets.slice(0, 5)) {
    const sentences = extractSentences(snippet.text);
    
    for (const s of sentences) {
      if (totalLength + s.length > MAX_ANSWER_CHARS) break;
      if (s.length < 30) continue;
      if (isLowQuality(s)) continue;
      
      // Create a normalized key for dedup
      const key = s.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60);
      
      // Check for duplicates
      let isDup = false;
      for (const seen of seenSentences) {
        const seenKey = seen.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60);
        if (key.substring(0, 35) === seenKey.substring(0, 35)) {
          isDup = true;
          break;
        }
        // Word overlap check
        const words1 = new Set(s.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        const words2 = new Set(seen.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        if (words1.size > 3 && words2.size > 3) {
          let overlap = 0;
          for (const w of words1) if (words2.has(w)) overlap++;
          if (overlap / Math.min(words1.size, words2.size) > 0.6) {
            isDup = true;
            break;
          }
        }
      }
      
      if (!isDup) {
        // Score this sentence for relevance
        let sentScore = 0;
        const lower = s.toLowerCase();
        for (const kw of keywords) {
          if (lower.includes(kw)) sentScore += 5;
        }
        
        // Intent-specific boosts
        if (intent === 'definition' && /\b(is|are|was|were|refers to|means|defined as)\b/.test(lower.substring(0, 80))) {
          sentScore += 15;
        }
        if (intent === 'person' && /[A-Z][a-z]+ [A-Z][a-z]+/.test(s) && /\b(born|is|was|known|founded|led|serves|CEO|founder|president|minister)\b/.test(lower)) {
          sentScore += 15;
        }
        if (intent === 'howto' && /\b(step|first|then|next|finally|use|create|build|install|select|click|choose|configure)\b/.test(lower)) {
          sentScore += 10;
        }
        if (intent === 'date' && /\b(in|on|since|from)\s+\d{4}|(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(lower)) {
          sentScore += 15;
        }
        
        // Quality penalties
        if (/\b(cookie|subscribe|newsletter|sign up|download app|free trial|get started|read more|click here)\b/.test(lower)) {
          sentScore -= 40;
        }
        if (/\b(video|watch|youtube|subscribe|channel)\b/.test(lower) && intent !== 'howto') {
          sentScore -= 15;
        }
        if (/\b(guys|check out|popped up|hit that|smash|like and subscribe)\b/.test(lower)) {
          sentScore -= 30;
        }
        
        // Only include if score is positive
        if (sentScore >= -5) {
          answerSentences.push({ text: s, score: sentScore, sourcePriority: snippet.priority });
          seenSentences.add(s);
          totalLength += s.length + 1;
        }
      }
    }
    
    if (totalLength >= MAX_ANSWER_CHARS * 0.8) break;
  }
  
  // Don't sort! Keep original sentence order within each source
  // Sources are already processed in priority order (Wikipedia first, then DDG, then Web)
  // This preserves the natural reading flow of each source
  // answerSentences is already in the right order
  
  // The first sentence from the best source (usually Wikipedia) should lead
  // Only move a different sentence to first position if it's clearly a better direct answer
  // AND comes from the same or higher priority source
  if (answerSentences.length > 1) {
    const first = answerSentences[0];
    const lower = first.text.toLowerCase();
    
    // Check if first sentence is a good opening (contains query keywords and is a definition)
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    let firstHasKeywords = 0;
    for (const qw of queryWords) {
      if (lower.substring(0, 120).includes(qw)) firstHasKeywords++;
    }
    
    // If first sentence is already good, keep it
    if (firstHasKeywords >= Math.min(2, queryWords.length) || first.sourcePriority <= 1) {
      // First sentence is good, keep the order as is
    } else {
      // Try to find a better opening from the first 5 sentences
      for (let i = 1; i < Math.min(5, answerSentences.length); i++) {
        const s = answerSentences[i];
        const sl = s.text.toLowerCase();
        let kwCount = 0;
        for (const qw of queryWords) {
          if (sl.substring(0, 120).includes(qw)) kwCount++;
        }
        // If this sentence has more keywords in its opening, swap it to first
        if (kwCount > firstHasKeywords && s.sourcePriority <= first.sourcePriority) {
          const [better] = answerSentences.splice(i, 1);
          answerSentences.unshift(better);
          break;
        }
      }
    }
  }
  
  // Build the final answer
  let answer = answerSentences.map(s => s.text).join(' ');
  
  // Determine confidence
  let confidence = 'low';
  const sourceCount = new Set(goodSnippets.map(s => s.source)).size;
  if (sourceCount >= 3 && answer.length > 300) {
    confidence = 'high';
  } else if (sourceCount >= 2 && answer.length > 150) {
    confidence = 'medium';
  } else if (sourceCount >= 1) {
    confidence = 'low';
  }
  
  // Final cleanup
  answer = answer.replace(/^[.\u2026\u2022\u00b7]+\s*/, '');
  answer = answer.replace(/^\.\s+/, '');
  answer = answer.replace(/\s+/g, ' ').trim();
  
  // Ensure proper capitalization
  if (answer.length > 0 && answer[0] >= 'a' && answer[0] <= 'z') {
    answer = answer[0].toUpperCase() + answer.slice(1);
  }
  
  return { answer, confidence };
}

// === TEXT CLEANING ===
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
    .replace(/&[a-z]+;/g, '');
  
  // Remove date prefixes
  clean = clean.replace(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\s*[.·—\-]?\s*/i, '');
  clean = clean.replace(/^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*[.·—\-]?\s*/i, '');
  
  // Remove question echoes at start
  clean = clean.replace(/^(what is|what are|who is|how does|why is|tell me about)\s+[^?]{3,60}\?\s*/i, '');
  clean = clean.replace(/^(what is|what are|who is|how does|why is)\s+[^?]{3,60}\s+/i, '');
  
  // Remove source prefixes
  clean = clean.replace(/^[A-Z][^:.|\n]{5,80}\s*[-–—|]\s*[A-Z][^:.|\n]{2,60}:\s*/, '');
  
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
  
  // Remove leading dots
  clean = clean.replace(/^[.…]+\s*/, '');
  clean = clean.replace(/^\.\.+\s*/, '');
  clean = clean.replace(/^…\s*/, '');
  
  // Remove "Home:" prefixes
  clean = clean.replace(/^(Home|About|Overview)\s*[-:|]\s*/i, '');
  
  // Fix spacing
  clean = clean.replace(/\s+([,.;:!?])/g, '$1');
  clean = clean.replace(/([,.;:!?])(?=[A-Za-z])/g, '$1 ');
  clean = clean.replace(/[ \t]+/g, ' ');
  clean = clean.replace(/\n{3,}/g, '\n\n');
  clean = clean.trim();
  
  // Remove incomplete sentences at start
  clean = clean.replace(/^[a-z]{1,5}\s+(?=[A-Z])/, '');
  
  // Remove incomplete sentences at end
  clean = clean.replace(/\s+[a-z]{1,3}$/i, '');
  
  // Capitalize first letter
  if (clean.length > 0 && clean[0] >= 'a' && clean[0] <= 'z') {
    clean = clean[0].toUpperCase() + clean.slice(1);
  }
  
  // Cap at reasonable length
  if (clean.length > 2000) {
    const cutPoint = clean.lastIndexOf('. ', 1500);
    if (cutPoint > 200) {
      clean = clean.substring(0, cutPoint + 1);
    } else {
      const cutSpace = clean.lastIndexOf(' ', 1800);
      if (cutSpace > 200) {
        clean = clean.substring(0, cutSpace) + '...';
      } else {
        clean = clean.substring(0, 1800) + '...';
      }
    }
  }
  
  return clean;
}

// === FINAL TEXT CLEANER ===
function cleanText(text) {
  if (!text) return '';
  
  let clean = text;
  
  clean = clean.replace(/&[a-zA-Z]+;/g, match => {
    const map = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&middot;': '·', '&ndash;': '–', '&mdash;': '—', '&hellip;': '...' };
    return map[match] || '';
  });
  
  clean = clean.replace(/[ \t]+/g, ' ');
  clean = clean.replace(/\n{3,}/g, '\n\n');
  clean = clean.replace(/^\s+|\s+$/g, '');
  
  // Remove orphaned single characters
  clean = clean.replace(/\s+[a-z]\s+/gi, ' ');
  
  return clean.trim();
}

// === SEARCH PROVIDERS ===

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
      let snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '';
      
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
  q = q.replace(/^(what is the |what is a |what is an |what is |what are |what does |who is the |who is |who are |where is |where are |when was |when did |how does |how do |how is |why is |why are |why does |tell me about |tell me |explain |describe |define |give me |show me |find |search for )/i, '').trim();
  q = q.replace(/\?$/, '').trim();
  
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

// === MAIN HANDLER ===
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
  
  // 1. Check DeryCode knowledge base first
  if (isDeryCodeQuery(question)) {
    const kb = getDeryCodeKnowledge(question);
    if (kb) {
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
  
  // 4. Build synthesized answer
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
