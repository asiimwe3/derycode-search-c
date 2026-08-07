// DeryCode Website Search — indexes derycode.publicvm.com pages and blog articles
// Adds the DeryCode website as a searchable source in the engine

const DERYCODE_SITE = 'https://derycode.publicvm.com';

// All indexable pages on the DeryCode website
const SITE_PAGES = [
  { url: '/', title: 'DeryCode Technologies — Software, Blockchain, AI & Web3 Development in Uganda', 
    keywords: ['software', 'development', 'uganda', 'blockchain', 'ai', 'web3', 'mobile apps', 'website'] },
  { url: '/about.html', title: 'About DeryCode Technologies — Uganda\'s Leading Software Company',
    keywords: ['about', 'company', 'team', 'uganda', 'kampala', 'kyenjojo', 'software'] },
  { url: '/blog.html', title: 'DeryCode Blog — Tech Insights, Tutorials & Industry News',
    keywords: ['blog', 'articles', 'tutorials', 'tech', 'news', 'insights'] },
  { url: '/docs.html', title: 'DeryCode Documentation — API References & Developer Guides',
    keywords: ['docs', 'documentation', 'api', 'reference', 'guide', 'developer'] },
  { url: '/ai-automation.html', title: 'AI & Automation Services — DeryCode Technologies',
    keywords: ['ai', 'automation', 'artificial intelligence', 'machine learning', 'chatbot'] },
  { url: '/api-payment-integrations.html', title: 'API & Payment Integration Services — DeryCode',
    keywords: ['api', 'payment', 'integration', 'momo', 'mobile money', 'stripe', 'paypal'] },
  { url: '/banking-sacco-software.html', title: 'Banking & SACCO Software — DeryCode Technologies',
    keywords: ['banking', 'sacco', 'software', 'financial', 'fintech', 'uganda', 'savings', 'loans'] },
  { url: '/business-management-erp.html', title: 'Business Management & ERP Software — DeryCode',
    keywords: ['erp', 'business', 'management', 'software', 'inventory', 'accounting'] },
  { url: '/business-websites.html', title: 'Business Website Development — DeryCode Technologies',
    keywords: ['website', 'business', 'web', 'development', 'design', 'responsive'] },
  { url: '/digital-marketing.html', title: 'Digital Marketing Services — DeryCode Technologies',
    keywords: ['digital', 'marketing', 'seo', 'social media', 'advertising', 'google ads'] },
  { url: '/mobile-apps.html', title: 'Mobile App Development — DeryCode Technologies',
    keywords: ['mobile', 'app', 'android', 'ios', 'flutter', 'react native', 'development'] },
  { url: '/partners.html', title: 'Our Partners & Technology Stack — DeryCode',
    keywords: ['partners', 'technology', 'stack', 'collaboration'] },
  { url: '/school-digital-libraries.html', title: 'School Digital Libraries & LMS — DeryCode',
    keywords: ['school', 'lms', 'library', 'education', 'e-learning', 'digital'] },
  { url: '/smart-contracts.html', title: 'Smart Contract Development — DeryCode Technologies',
    keywords: ['smart', 'contract', 'blockchain', 'ethereum', 'solidity', 'web3'] },
  { url: '/token-crypto-development.html', title: 'Token & Cryptocurrency Development — DeryCode',
    keywords: ['token', 'crypto', 'cryptocurrency', 'blockchain', 'ico', 'defi', 'erc20'] },
  { url: '/uiux-design-branding.html', title: 'UI/UX Design & Branding — DeryCode Technologies',
    keywords: ['ui', 'ux', 'design', 'branding', 'interface', 'user experience', 'figma'] },
  { url: '/web-applications.html', title: 'Web Application Development — DeryCode Technologies',
    keywords: ['web', 'application', 'development', 'saas', 'progressive', 'pwa'] },
  { url: '/case-study-derycoin.html', title: 'Case Study: DeryCoin — Cryptocurrency for Uganda',
    keywords: ['derycoin', 'cryptocurrency', 'blockchain', 'uganda', 'case study'] },
  { url: '/case-study-peters-medicare.html', title: 'Case Study: St. Peters Medical Center',
    keywords: ['peters', 'medical', 'healthcare', 'hospital', 'case study', 'website'] },
  { url: '/case-study-sacco-wallet.html', title: 'Case Study: SACCO Wallet — Mobile Banking App',
    keywords: ['sacco', 'wallet', 'mobile', 'banking', 'case study', 'fintech'] },
  { url: '/case-study-sageco-evergreen.html', title: 'Case Study: Sageco Evergreen — ERP System',
    keywords: ['sageco', 'erp', 'business', 'management', 'case study'] },
  { url: '/case-study-tropical-gardens-hotel.html', title: 'Case Study: Tropical Gardens Hotel — Booking System',
    keywords: ['tropical', 'gardens', 'hotel', 'booking', 'case study', 'reservation'] },
  { url: '/editorial-methodology.html', title: 'Editorial Methodology — DeryCode Blog Standards',
    keywords: ['editorial', 'methodology', 'standards', 'blog', 'writing'] },
  { url: '/privacy.html', title: 'Privacy Policy — DeryCode Technologies',
    keywords: ['privacy', 'policy', 'data', 'terms', 'legal'] },
];

// Blog articles
const BLOG_ARTICLES = [
  { url: '/blog-post.html?id=ai-chatbot-uganda', title: 'Building AI Chatbots for Ugandan Businesses',
    keywords: ['ai', 'chatbot', 'uganda', 'business', 'automation', 'whatsapp'] },
  { url: '/blog-post.html?id=best-software-company-uganda', title: 'Best Software Development Company in Uganda 2026',
    keywords: ['best', 'software', 'company', 'uganda', 'development', '2026'] },
  { url: '/blog-post.html?id=blockchain-uganda', title: 'Blockchain Technology in Uganda: A Complete Guide',
    keywords: ['blockchain', 'uganda', 'crypto', 'technology', 'guide'] },
  { url: '/blog-post.html?id=derycoin', title: 'DeryCoin: Uganda\'s First Utility Token Explained',
    keywords: ['derycoin', 'token', 'crypto', 'uganda', 'cryptocurrency', 'utility'] },
  { url: '/blog-post.html?id=digital-marketing-uganda', title: 'Digital Marketing Strategies for Ugandan Businesses',
    keywords: ['digital', 'marketing', 'uganda', 'seo', 'social media', 'business'] },
  { url: '/blog-post.html?id=erp-software-uganda', title: 'ERP Software Solutions in Uganda: Complete Guide',
    keywords: ['erp', 'software', 'uganda', 'business', 'management', 'guide'] },
  { url: '/blog-post.html?id=mobile-money-integration-guide', title: 'Mobile Money Integration Guide for Developers',
    keywords: ['mobile money', 'integration', 'mtn', 'airtel', 'api', 'payment', 'developer'] },
  { url: '/blog-post.html?id=momo-integration', title: 'MTN MoMo API Integration: Step-by-Step Tutorial',
    keywords: ['mtn', 'momo', 'api', 'integration', 'mobile money', 'tutorial', 'payment'] },
  { url: '/blog-post.html?id=pwa-uganda', title: 'Progressive Web Apps in Uganda: Why They Matter',
    keywords: ['pwa', 'progressive', 'web app', 'uganda', 'mobile', 'offline'] },
  { url: '/blog-post.html?id=sacco-banking', title: 'SACCO Banking Software: Transforming Uganda\'s Financial Sector',
    keywords: ['sacco', 'banking', 'software', 'uganda', 'financial', 'fintech'] },
  { url: '/blog-post.html?id=school-management-system-uganda', title: 'School Management Systems in Uganda: A Guide',
    keywords: ['school', 'management', 'system', 'uganda', 'education', 'software'] },
  { url: '/blog-post.html?id=seo-uganda-guide', title: 'SEO in Uganda: A Complete Guide for Businesses',
    keywords: ['seo', 'uganda', 'guide', 'google', 'search', 'optimization', 'business'] },
  { url: '/blog-post.html?id=website-cost-uganda', title: 'How Much Does a Website Cost in Uganda?',
    keywords: ['website', 'cost', 'uganda', 'price', 'pricing', 'development', 'ugx'] },
];

const ALL_PAGES = [...SITE_PAGES, ...BLOG_ARTICLES];

function scorePage(page, keywords) {
  if (!keywords || keywords.length === 0) return 0;
  const titleLower = (page.title || '').toLowerCase();
  const keywordStr = (page.keywords || []).join(' ').toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (kw.length < 3) continue;
    if (titleLower.includes(kw)) score += 20;
    if (keywordStr.includes(kw)) score += 10;
  }
  return score;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  
  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: 'Query is required' });
  }
  
  // Extract keywords from query
  const stop = new Set(['the','a','an','is','are','how','to','do','does','what','who',
    'can','i','you','my','me','we','our','and','or','but','in','on','at','for',
    'of','with','from','by','about','into','your','this','that','it','its']);
  const keywords = q.toLowerCase().split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w))
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length > 0);
  
  // Score all pages
  const scored = ALL_PAGES.map(page => ({
    title: page.title,
    url: `${DERYCODE_SITE}${page.url}`,
    content: `DeryCode Technologies — ${page.title}. Software development, blockchain, AI, web3, mobile apps in Uganda.`,
    engine: 'derycode-site',
    source: 'DeryCode',
    _score: scorePage(page, keywords)
  })).filter(r => r._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 10);
  
  res.json({ results: scored, count: scored.length, source: 'DeryCode Website' });
}

// Also export as a function for use in the main search API
export async function fetchDeryCodeSite(q) {
  const stop = new Set(['the','a','an','is','are','how','to','do','does','what','who',
    'can','i','you','my','me','we','our','and','or','but','in','on','at','for',
    'of','with','from','by','about','into','your','this','that','it','its']);
  const keywords = q.toLowerCase().split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w))
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length > 0);
  
  return ALL_PAGES.map(page => ({
    title: page.title,
    url: `${DERYCODE_SITE}${page.url}`,
    content: `DeryCode Technologies — ${page.title}. ${page.keywords.join(', ')}.`,
    engine: 'derycode-site',
    source: 'DeryCode',
    _score: scorePage(page, keywords)
  })).filter(r => r._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 8);
}
