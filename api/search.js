// DeryCode Search API - Vercel Serverless
const MAX_QUERY_WORDS = 30;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.trim().length === 0) return res.status(400).json({ error: 'Query is required' });
  
  const words = q.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) {
    return res.status(400).json({ error: `Query too long. Maximum ${MAX_QUERY_WORDS} words. You used ${words}.`, max_words: MAX_QUERY_WORDS, used_words: words });
  }
  
  const startTime = Date.now();
  const variants = buildQueryVariants(q);
  
  let wiki = null, ddg = null, webResults = [];
  for (const variant of variants) {
    const [w, d, wr] = await Promise.all([fetchWikipedia(variant), fetchDuckDuckGo(variant), fetchDDGHTML(variant)]);
    if (w || (d && d.content) || wr.length > 0) { wiki = w; ddg = d; webResults = wr; break; }
  }
  
  const results = [];
  let kp = null, aiSummary = null;
  
  if (wiki) {
    kp = { title: wiki.title, extract: wiki.extract.substring(0, 500), url: wiki.url };
    results.push({ title: wiki.title, url: wiki.url, content: wiki.extract.substring(0,300), engine:'wikipedia', source:'Wikipedia', featured:true });
    aiSummary = wiki.extract.substring(0, 500);
  }
  if (ddg) {
    results.push({ title: ddg.title||q, url: ddg.url||'', content: ddg.content||'', engine:'duckduckgo', source:'DuckDuckGo', featured:true });
    if (!aiSummary) aiSummary = ddg.content;
  }
  results.push(...webResults.slice(0, 8));
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const enc = encodeURIComponent(q);
  
  res.status(200).json({
    query: q, count: results.length, time: elapsed,
    knowledgePanel: kp, aiSummary,
    results: results.slice(0, 10), related: [],
    external: { google:`https://www.google.com/search?q=${enc}`, bing:`https://www.bing.com/search?q=${enc}`, duckduckgo:`https://duckduckgo.com/?q=${enc}`, youtube:`https://www.youtube.com/results?search_query=${enc}` },
    limits: { maxQueryWords: MAX_QUERY_WORDS, maxAnswerWords: 200 }
  });
}

function buildQueryVariants(q) {
  const variants = [];
  let cleaned = q.trim().replace(/\?$/, '').trim();
  cleaned = cleaned.replace(/^(what is |what is the |what is a |what are |who is |who is the |who are |tell me about |explain |describe |how does |how do |how is |how are |when did |when was |where is |where are |why is |why are |can you |please )/i, '');
  cleaned = cleaned.replace(/\s*(known for|famous for|in africa|in uganda|in east africa)$/i, '').trim();
  
  if (cleaned.length > 2) variants.push(cleaned);
  const w4 = cleaned.split(/\s+/).filter(w=>w.length>2).slice(0,4).join(' ');
  if (w4.length>2 && !variants.includes(w4)) variants.push(w4);
  const w3 = cleaned.split(/\s+/).filter(w=>w.length>2).slice(0,3).join(' ');
  if (w3.length>2 && !variants.includes(w3)) variants.push(w3);
  const w2 = cleaned.split(/\s+/).filter(w=>w.length>2).slice(0,2).join(' ');
  if (w2.length>2 && !variants.includes(w2)) variants.push(w2);
  const w1 = cleaned.split(/\s+/).filter(w=>w.length>2 && w[0]===w[0].toUpperCase()).slice(0,1).join(' ');
  if (w1.length>2 && !variants.includes(w1)) variants.push(w1);
  if (!variants.includes(q)) variants.push(q);
  return variants.length > 0 ? variants : [q];
}

async function fetchWikipedia(q) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=400&titles=${encodeURIComponent(q)}&redirects=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) return null;
    return { title: page.title, extract: page.extract||'', thumbnail: page.thumbnail?.source||'', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}` };
  } catch { return null; }
}

async function fetchDuckDuckGo(q) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
    const data = await r.json();
    if (data.AbstractText && data.AbstractText.length > 30) return { title: data.Heading||q, content: data.AbstractText, url: data.AbstractURL||'' };
    return null;
  } catch { return null; }
}

async function fetchDDGHTML(q) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    const results = [];
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>.*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gs;
    let m; let c=0;
    while ((m=re.exec(html))!==null && c<6) {
      let h = m[1].replace(/&amp;/g,'&');
      const u = h.match(/uddg=([^&]+)/);
      if (u) h = decodeURIComponent(u[1]);
      const t = m[2].replace(/<[^>]*>/g,'').trim();
      const ct = m[3].replace(/<[^>]*>/g,'').trim();
      if (t && h.startsWith('http')) { results.push({title:t.substring(0,200),url:h,content:ct.substring(0,300),engine:'duckduckgo',source:'DuckDuckGo',featured:false}); c++; }
    }
    return results;
  } catch { return []; }
}
