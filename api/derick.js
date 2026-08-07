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
      tools: guide.tools,
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


// ============ SOFTWARE NAME EXTRACTION ============

const SOFTWARE_CATEGORIES = {
  'code editor': ['vs code', 'visual studio code', 'sublime text', 'atom', 'neovim', 'vim', 'emacs', 'jetbrains', 'intellij', 'webstorm', 'phpstorm', 'pycharm', 'eclipse', 'netbeans', 'xcode', 'cursor'],
  'web framework': ['react', 'next.js', 'nextjs', 'vue', 'vue.js', 'nuxt', 'angular', 'svelte', 'sveltekit', 'express', 'express.js', 'django', 'flask', 'laravel', 'rails', 'ruby on rails', 'spring', 'spring boot', 'asp.net', 'fastapi', 'gatsby', 'remix', 'astro', 'solid.js', 'solidjs'],
  'language': ['python', 'javascript', 'typescript', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'dart', 'scala', 'r', 'matlab', 'perl', 'elixir', 'clojure', 'haskell', 'lua', 'objective-c', 'solidity', 'golang'],
  'database': ['mysql', 'postgresql', 'postgres', 'mongodb', 'mongo', 'redis', 'sqlite', 'firebase', 'supabase', 'dynamodb', 'elasticsearch', 'mariadb', 'oracle', 'cassandra', 'influxdb', 'neo4j', 'prisma', 'drizzle'],
  'cloud': ['aws', 'amazon web services', 'azure', 'google cloud', 'gcp', 'vercel', 'netlify', 'heroku', 'digitalocean', 'cloudflare', 'render', 'railway', 'fly.io', 'docker', 'kubernetes', 'terraform', 'ansible'],
  'css': ['tailwind', 'tailwindcss', 'bootstrap', 'sass', 'scss', 'less', 'styled-components', 'material-ui', 'mui', 'chakra', 'ant-design', 'bulma', 'css-in-js'],
  'mobile': ['flutter', 'react native', 'expo', 'kotlin', 'swift', 'xamarin', 'ionic', 'capacitor', 'cordova', 'phonegap'],
  'design': ['figma', 'adobe xd', 'sketch', 'canva', 'gimp', 'inkscape', 'framer', 'photoshop', 'illustrator', 'blender'],
  'devops': ['docker', 'kubernetes', 'jenkins', 'github actions', 'gitlab ci', 'circleci', 'travis', 'terraform', 'ansible', 'vagrant', 'prometheus', 'grafana', 'nginx', 'apache', 'caddy', 'traefik'],
  'blockchain': ['solidity', 'ethereum', 'hardhat', 'truffle', 'ganache', 'web3.js', 'web3js', 'ethers.js', 'ethers', 'metamask', 'infura', 'alchemy', 'moralis', 'foundry', 'brownie', 'openzeppelin', 'ipfs', 'polygon', 'solana', 'anchor', 'cosmos', 'polkadot', 'substrate'],
  'ai/ml': ['pytorch', 'tensorflow', 'scikit-learn', 'sklearn', 'keras', 'opencv', 'pandas', 'numpy', 'jupyter', 'huggingface', 'hugging face', 'transformers', 'langchain', 'openai', 'anthropic', 'ollama', 'llama', 'stable diffusion', 'midjourney'],
  'cms': ['wordpress', 'drupal', 'joomla', 'shopify', 'webflow', 'ghost', 'strapi', 'sanity', 'contentful', 'wix', 'squarespace', 'magento'],
  'orm': ['prisma', 'drizzle', 'typeorm', 'sequelize', 'mongoose', 'sqlalchemy', 'gorm', 'hibernate', 'entity framework'],
  'testing': ['jest', 'mocha', 'cypress', 'playwright', 'selenium', 'puppeteer', 'vitest', 'testing-library', 'pytest', 'unittest', 'jasmine', 'karma', 'cucumber'],
  'api': ['rest', 'graphql', 'apollo', 'postman', 'insomnia', 'swagger', 'openapi', 'grpc', 'tRPC', 'trpc', 'hasura', 'supabase'],
  'version control': ['git', 'github', 'gitlab', 'bitbucket', 'mercurial', 'svn'],
  'package manager': ['npm', 'yarn', 'pnpm', 'pip', 'poetry', 'cargo', 'maven', 'gradle', 'composer', 'nuget', 'brew', 'apt', 'nix'],
  'build tool': ['webpack', 'vite', 'rollup', 'esbuild', 'parcel', 'turbo', 'turboRepo', 'nx', 'gulp', 'grunt', 'make', 'cmake', 'bazel'],
};

const TOOL_LINKS = {
  'vs code': 'https://code.visualstudio.com', 'visual studio code': 'https://code.visualstudio.com',
  'react': 'https://react.dev', 'next.js': 'https://nextjs.org', 'nextjs': 'https://nextjs.org',
  'vue': 'https://vuejs.org', 'vue.js': 'https://vuejs.org', 'nuxt': 'https://nuxt.com',
  'angular': 'https://angular.io', 'svelte': 'https://svelte.dev', 'sveltekit': 'https://kit.svelte.dev',
  'express': 'https://expressjs.com', 'express.js': 'https://expressjs.com',
  'django': 'https://djangoproject.com', 'flask': 'https://flask.palletsprojects.com',
  'laravel': 'https://laravel.com', 'rails': 'https://rubyonrails.org', 'ruby on rails': 'https://rubyonrails.org',
  'spring boot': 'https://spring.io/projects/spring-boot', 'fastapi': 'https://fastapi.tiangolo.com',
  'gatsby': 'https://gatsbyjs.com', 'remix': 'https://remix.run', 'astro': 'https://astro.build',
  'python': 'https://python.org', 'typescript': 'https://typescriptlang.org',
  'javascript': 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
  'rust': 'https://rust-lang.org', 'go': 'https://go.dev', 'golang': 'https://go.dev',
  'node.js': 'https://nodejs.org', 'nodejs': 'https://nodejs.org',
  'mysql': 'https://mysql.com', 'postgresql': 'https://postgresql.org', 'postgres': 'https://postgresql.org',
  'mongodb': 'https://mongodb.com', 'mongo': 'https://mongodb.com', 'redis': 'https://redis.io',
  'sqlite': 'https://sqlite.org', 'firebase': 'https://firebase.google.com', 'supabase': 'https://supabase.com',
  'dynamodb': 'https://aws.amazon.com/dynamodb', 'prisma': 'https://prisma.io', 'drizzle': 'https://orm.drizzle.team',
  'docker': 'https://docker.com', 'kubernetes': 'https://kubernetes.io',
  'tailwind': 'https://tailwindcss.com', 'tailwindcss': 'https://tailwindcss.com',
  'bootstrap': 'https://getbootstrap.com', 'sass': 'https://sass-lang.com',
  'flutter': 'https://flutter.dev', 'react native': 'https://reactnative.dev', 'expo': 'https://expo.dev',
  'figma': 'https://figma.com', 'canva': 'https://canva.com',
  'wordpress': 'https://wordpress.org', 'shopify': 'https://shopify.com', 'webflow': 'https://webflow.com',
  'strapi': 'https://strapi.io', 'sanity': 'https://sanity.io',
  'github': 'https://github.com', 'gitlab': 'https://gitlab.com',
  'npm': 'https://npmjs.com', 'yarn': 'https://yarnpkg.com', 'pnpm': 'https://pnpm.io',
  'vite': 'https://vitejs.dev', 'webpack': 'https://webpack.js.org',
  'jest': 'https://jestjs.io', 'cypress': 'https://cypress.io', 'playwright': 'https://playwright.dev',
  'puppeteer': 'https://pptr.dev', 'vitest': 'https://vitest.dev',
  'rest': 'https://restfulapi.net', 'graphql': 'https://graphql.org',
  'apollo': 'https://apollographql.com', 'postman': 'https://postman.com',
  'solidity': 'https://soliditylang.org', 'ethereum': 'https://ethereum.org',
  'hardhat': 'https://hardhat.org', 'foundry': 'https://getfoundry.sh',
  'pytorch': 'https://pytorch.org', 'tensorflow': 'https://tensorflow.org',
  'scikit-learn': 'https://scikit-learn.org', 'sklearn': 'https://scikit-learn.org',
  'pandas': 'https://pandas.pydata.org', 'numpy': 'https://numpy.org',
  'jupyter': 'https://jupyter.org', 'huggingface': 'https://huggingface.co',
  'langchain': 'https://langchain.com', 'vercel': 'https://vercel.com',
  'netlify': 'https://netlify.com', 'cloudflare': 'https://cloudflare.com',
  'wix': 'https://wix.com', 'squarespace': 'https://squarespace.com',
  'digitalocean': 'https://digitalocean.com', 'heroku': 'https://heroku.com',
  'render': 'https://render.com',
  'android studio': 'https://developer.android.com/studio',
  'c++': 'https://isocpp.org', 'c#': 'https://dotnet.microsoft.com',
  'php': 'https://php.net', 'ruby': 'https://ruby-lang.org',
  'swift': 'https://swift.org', 'kotlin': 'https://kotlinlang.org',
  'dart': 'https://dart.dev', 'scala': 'https://scala-lang.org',
};

function extractSoftwareNames(results, query) {
  const found = {};
  const queryLower = query.toLowerCase();
  const allText = results.map(r => (r.title || '') + ' ' + (r.content || '')).join(' ').toLowerCase();
  
  // Detect query intent
  const isHowTo = /^(how to|how do|how can|how do i|how to make|how to build|how to create|what tools|best tools|which tools|recommend|what software)/i.test(query.trim());
  const isComparison = /(vs|versus|or|compare|better|alternative)/i.test(query);
  const isLearning = /^(what is|what are|explain|learn|understand|introduction to|getting started)/i.test(query.trim());
  
  for (const [category, tools] of Object.entries(SOFTWARE_CATEGORIES)) {
    for (const tool of tools) {
      // Check if tool is mentioned in results or query
      const inQuery = queryLower.includes(tool);
      const inResults = allText.includes(tool);
      
      if (inQuery || inResults) {
        // Count occurrences as a rough relevance signal
        let count = 0; try { const escaped = tool.replace(/[.*+?^${}()|\[\]\\]/g, '\\$&'); count = (allText.match(new RegExp(escaped, 'g')) || []).length; } catch(e) {}
        if (inQuery) count += 5; // Boost if mentioned in query
        
        if (!found[tool] || found[tool].count < count) {
          found[tool] = {
            name: tool.charAt(0).toUpperCase() + tool.slice(1),
            category: category,
            count: count,
            url: TOOL_LINKS[tool] || null,
            inQuery: inQuery
          };
        }
      }
    }
  }
  
  // Sort by count (most mentioned first)
  const sorted = Object.values(found).sort((a, b) => b.count - a.count);
  
  // Group by category, take top tools per category
  const byCategory = {};
  for (const t of sorted) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    if (byCategory[t.category].length < 4) byCategory[t.category].push(t);
  }
  
  // Flatten and return top 15
  const result = sorted.slice(0, 15);
  
  return result.length > 0 ? result : null;
}

// ============ TUTORIAL SYNTHESIS ============

function generateTutorialSteps(query, results, knowledgePanel) {
  const steps = [];
  const usedUrls = new Set();
  const queryLower = query.toLowerCase();
  
  // Detect intent type
  const isHowTo = /^(how to|how do|how can|how do i|how to make|how to build|how to create|how to setup|how to install|how to configure|how to deploy)/i.test(query.trim());
  const isWhatIs = /^(what is|what are|what does|explain|describe|tell me about)/i.test(query.trim());
  const isBestTools = /(best tools|what tools|which tools|recommend.*tool|what software|best software|top tools)/i.test(query);
  const isComparison = /(vs|versus|compare|better|alternative|or)/i.test(query);
  const isLearning = /^(learn|understand|introduction to|getting started|beginner|start)/i.test(query.trim());
  
  // Step 1: Concept overview (from knowledge panel or top result)
  if (isHowTo) {
    if (knowledgePanel && knowledgePanel.extract) {
      steps.push({
        step: 1,
        title: 'Prerequisites & Overview',
        content: synthesizeOverview(query, knowledgePanel.extract, results),
        source_url: knowledgePanel.url,
        source_name: 'Wikipedia'
      });
      usedUrls.add(knowledgePanel.url);
    } else {
      const top = results.find(r => r.content && r.content.length > 80 && (r._score || 0) > 5);
      if (top) {
        steps.push({
          step: 1,
          title: 'Prerequisites & Overview',
          content: synthesizeOverview(query, top.content, results),
          source_url: top.url,
          source_name: top.source
        });
        usedUrls.add(top.url);
      }
    }
  }
  
  // Extract practical steps from results
  const practicalResults = results
    .filter(r => r.content && r.content.length > 50)
    .filter(r => !usedUrls.has(r.url))
    .sort((a, b) => (b._score || 0) - (a._score || 0));
  
  let stepNum = steps.length + 1;
  const maxSteps = isHowTo ? 10 : 8;
  
  for (const r of practicalResults) {
    if (steps.length >= maxSteps) break;
    
    // Synthesize tutorial content from this result
    const tutorialContent = synthesizeStep(query, r, stepNum, isHowTo);
    if (!tutorialContent) continue;
    
    let stepTitle = (r.title || '').substring(0, 80);
    stepTitle = stepTitle.replace(/\s*-\s*(Wikipedia|GitHub|Reddit|Hacker News|Stack Overflow|ArXiv|Internet Archive|Open Library|Semantic Scholar|Book).*$/i, '');
    stepTitle = stepTitle.replace(/\s*\[r\/\w+\].*$/i, '');
    
    // For how-to queries, generate action-oriented titles
    if (isHowTo && stepNum > 1) {
      stepTitle = generateStepTitle(r, stepNum);
    }
    
    if (stepTitle.length > 75) stepTitle = stepTitle.substring(0, 72) + '...';
    
    steps.push({
      step: stepNum,
      title: stepTitle,
      content: tutorialContent,
      source_url: r.url,
      source_name: r.source
    });
    usedUrls.add(r.url);
    stepNum++;
  }
  
  return steps;
}

function synthesizeOverview(query, baseContent, allResults) {
  // Build a 2-3 sentence overview from the best content
  let overview = extractKeySentences(baseContent, 3);
  
  // Add context from other results if overview is short
  if (overview.length < 100) {
    for (const r of allResults.slice(0, 3)) {
      if (r.content && r.content.length > 50) {
        overview += ' ' + extractKeySentences(r.content, 1);
        if (overview.length > 300) break;
      }
    }
  }
  
  // Clean up
  overview = overview.replace(/\s+/g, ' ').trim();
  if (overview.length > 500) overview = overview.substring(0, 497) + '...';
  
  return overview;
}

function synthesizeStep(query, result, stepNum, isHowTo) {
  let content = result.content || '';
  
  // Clean HTML and entities
  content = content.replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Extract the most practical sentences
  const sentences = content.split(/(?<=[.!?])\s+/);
  const practical = [];
  let totalLen = 0;
  
  for (const s of sentences) {
    const t = s.trim();
    if (t.length < 20 || t.length > 500) continue;
    if (totalLen > 600) break;
    
    // Prioritize sentences with action words / practical indicators
    const lower = t.toLowerCase();
    const hasAction = /^(first|then|next|after|start|begin|create|install|configure|build|setup|run|open|click|select|choose|use|add|write|type|enter|download|deploy|set|define|import|include|require|make|write|test|check|verify|ensure)/i.test(t);
    const hasCode = /(npm|pip|yarn|git|docker|cd|mkdir|sudo|apt|brew|cargo|go get|python|node|ruby gem)/.test(t);
    const hasNumber = /^(step\s*\d|\d+\.)/i.test(t);
    
    if (hasAction || hasCode || hasNumber || (isHowTo && t.length > 40 && t.length < 300)) {
      practical.push(t);
      totalLen += t.length;
      if (practical.length >= 4) break;
    }
  }
  
  // If no practical sentences found, fall back to first few good sentences
  if (practical.length === 0) {
    for (const s of sentences) {
      const t = s.trim();
      if (t.length > 30 && t.length < 400 && totalLen < 400) {
        practical.push(t);
        totalLen += t.length;
        if (practical.length >= 3) break;
      }
    }
  }
  
  const result = practical.join(' ');
  return result.length > 20 ? result : content.substring(0, 400);
}

function generateStepTitle(result, stepNum) {
  const title = (result.title || '').toLowerCase();
  const content = (result.content || '').toLowerCase();
  
  // Try to generate action-oriented titles based on content
  const actionWords = {
    'install': 'Install Required Tools',
    'setup': 'Set Up Your Environment',
    'configure': 'Configure Settings',
    'create': 'Create Your Project',
    'build': 'Build the Application',
    'deploy': 'Deploy & Go Live',
    'test': 'Test & Debug',
    'design': 'Design the Interface',
    'database': 'Set Up the Database',
    'frontend': 'Build the Frontend',
    'backend': 'Build the Backend',
    'api': 'Create the API',
    'auth': 'Add Authentication',
    'style': 'Style with CSS',
    'optimize': 'Optimize Performance',
    'learn': 'Learn the Basics',
    'start': 'Get Started',
    'begin': 'Getting Started'
  };
  
  for (const [key, label] of Object.entries(actionWords)) {
    if (title.includes(key) || content.includes(key)) {
      return label;
    }
  }
  
  // Default: use cleaned title
  let cleanTitle = (result.title || '').substring(0, 70);
  cleanTitle = cleanTitle.replace(/\s*-\s*(Wikipedia|GitHub|Reddit|Stack Overflow|Hacker News|ArXiv).*$/i, '');
  return cleanTitle || `Step ${stepNum}`;
}


// ============ DERICK GUIDE GENERATOR ============

function generateDerickGuide(query, searchData, knowledgePanel) {
  const results = searchData.results;
  const sourcesUsed = searchData.sourcesUsed;
  
  if (!results || results.length === 0) {
    return { topic: query, intro: `No results found for "${query}". Try different keywords.`, steps: [], tips: '', warnings: '', has_data: false, sourcesUsed, totalResults: 0, tools: null };
  }
  
  // Extract recommended software/tools from results
  const tools = extractSoftwareNames(results, query);
  
  // Generate tutorial-style steps (not just search result links)
  const steps = generateTutorialSteps(query, results, knowledgePanel);
  
  // Build intro
  let intro = '';
  const queryType = detectQueryType(query);
  
  if (queryType === 'how-to') {
    intro = `Here's a practical, step-by-step tutorial for "${query}":`;
    if (tools && tools.length > 0) {
      intro += ` I found ${tools.length} relevant tools across the results.`;
    }
  } else if (queryType === 'what-is') {
    intro = `Here's what you need to know about "${query}":`;
  } else if (queryType === 'best-tools') {
    intro = `Here are the best tools and software for "${query}":`;
  } else if (queryType === 'learning') {
    intro = `Here's a beginner-friendly guide to "${query}":`;
  } else {
    intro = `Here's a practical breakdown of "${query}" based on ${sourcesUsed.length} web sources.`;
  }
  
  if (knowledgePanel && knowledgePanel.extract && knowledgePanel.extract.length > 50) {
    intro += `\n\n${extractKeySentences(knowledgePanel.extract, 2)}`;
  } else if (results[0]?.content && results[0].content.length > 30 && (results[0]._score || 0) > 10) {
    intro += `\n\n${extractKeySentences(results[0].content, 2)}`;
  }
  
  const tips = `Pro tips:\n- Search for "${query} tutorial" on YouTube for visual walkthroughs\n- Check Reddit and Hacker News for real-world experiences\n- Stack Overflow has detailed technical answers\n- Try rephrasing if you need different results`;
  const warnings = `This guide is auto-generated from ${sourcesUsed.length} web sources. Always verify critical steps with the original sources linked in each step.`;
  
  return {
    topic: query, intro, steps, tips, warnings, tools,
    has_data: steps.length > 0, sourcesUsed, totalResults: results.length
  };
}

function detectQueryType(query) {
  const q = query.trim().toLowerCase();
  if (/^(how to|how do|how can|how do i|how to make|how to build|how to create|how to setup|how to install|how to configure|how to deploy)/i.test(q)) return 'how-to';
  if (/(best tools|what tools|which tools|recommend.*tool|what software|best software|top tools|top.*frameworks|best.*libraries)/i.test(q)) return 'best-tools';
  if (/^(what is|what are|what does|explain|describe|tell me about)/i.test(q)) return 'what-is';
  if (/^(learn|understand|introduction to|getting started|beginner|start)/i.test(q)) return 'learning';
  return 'general';
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
