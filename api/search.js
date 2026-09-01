// DeryCode Search API - Vercel Serverless
// Deep Search: 16 sources - surfaces what other engines hide
// Relevance-scored, academic sources conditional


// ============ DeryCode Ads — PPC Platform ============
let campaignStore = null;
let lastStoreFetch = 0;
const STORE_TTL = 30000; // Cache store for 30 seconds

async function getCampaignStore() {
  // Return cached store if fresh
  if (campaignStore && (Date.now() - lastStoreFetch) < STORE_TTL) return campaignStore;
  
  // Try Edge Config first
  const edgeConfigId = process.env.EDGE_CONFIG;
  const edgeConfigToken = process.env.EDGE_CONFIG_ACCESS_TOKEN;
  if (edgeConfigId && edgeConfigToken) {
    try {
      const res = await fetch(`https://edge-config.vercel.com/${edgeConfigId}?token=${edgeConfigToken}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || data;
        const campaigns = typeof items.campaigns === 'string' ? JSON.parse(items.campaigns) : (items.campaigns || []);
        const clicks = typeof items.clicks === 'string' ? JSON.parse(items.clicks) : (items.clicks || []);
        campaignStore = { campaigns, clicks };
        lastStoreFetch = Date.now();
        return campaignStore;
      }
    } catch (e) { /* Edge Config read failed, fall through to seed */ }
  }
  
  // Fallback: seed with default campaign
  campaignStore = {
    campaigns: [{
      id: 'seed-derycode-001',
      business: 'DeryCode Technologies',
      title: 'DeryCode \u2014 Software Development Company in Uganda',
      description: 'Custom software, web apps, mobile apps, blockchain & AI. DeryCode builds what off-the-shelf can\'t. Call +256 772 002 326',
      url: 'https://derycode.publicvm.com',
      keywords: ['website design uganda','software company uganda','web development uganda','mobile app development uganda','blockchain development uganda','seo uganda','derycode','software development kampala','app development uganda','erp software uganda','fintech uganda','ai chatbot uganda'],
      bid: 1000,
      budget: 100000,
      spent: 0,
      impressions: 0,
      clicks: 0,
      status: 'active',
      createdAt: new Date().toISOString()
    }],
    clicks: []
  };
  lastStoreFetch = Date.now();
  return campaignStore;
}

async function saveCampaignStore(store) {
  campaignStore = store;
  lastStoreFetch = Date.now();
  
  const edgeConfigId = process.env.EDGE_CONFIG;
  const edgeConfigToken = process.env.EDGE_CONFIG_ACCESS_TOKEN;
  if (edgeConfigId && edgeConfigToken) {
    try {
      await fetch(`https://edge-config.vercel.com/${edgeConfigId}/items?token=${edgeConfigToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            { operation: 'upsert', key: 'campaigns', value: JSON.stringify(store.campaigns) },
            { operation: 'upsert', key: 'clicks', value: JSON.stringify(store.clicks) }
          ]
        })
      });
    } catch (e) { /* Edge Config write failed, keep in-memory */ }
  }
}

function matchKeywords(queryKeywords, campaignKeywords) {
  const qSet = new Set(queryKeywords.map(k => k.toLowerCase().trim()));
  for (const ck of campaignKeywords) {
    const ckLower = ck.toLowerCase().trim();
    if (qSet.has(ckLower)) return true;
    for (const qk of queryKeywords) {
      if (qk.toLowerCase().includes(ckLower) || ckLower.includes(qk.toLowerCase())) return true;
    }
  }
  return false;
}

async function serveAds(query) {
  const store = await getCampaignStore();
  const queryKeywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
  const matched = store.campaigns.filter(c => 
    c.status === 'active' && c.budget > c.spent && matchKeywords(queryKeywords, c.keywords)
  );
  matched.sort((a, b) => b.bid - a.bid);
  const top3 = matched.slice(0, 3);
  for (const ad of top3) { ad.impressions++; }
  await saveCampaignStore(store);
  return top3;
}

async function trackClick(adId) {
  const store = await getCampaignStore();
  const campaign = store.campaigns.find(c => c.id === adId);
  if (!campaign || campaign.status !== 'active') return null;

  // Check wallet balance if advertiser email is set
  if (campaign.advertiserEmail) {
    const wallets = await getWallets();
    const wallet = wallets[campaign.advertiserEmail];
    if (!wallet || wallet.balance < campaign.bid) {
      // Auto-pause campaign — insufficient funds
      campaign.status = 'paused';
      campaign.pausedReason = 'insufficient_wallet_balance';
      await saveCampaignStore(store);
      return null;
    }
    // Deduct from wallet
    wallet.balance -= campaign.bid;
    wallet.totalSpent = (wallet.totalSpent || 0) + campaign.bid;
    await saveWallets(wallets);
  }

  // Also check legacy budget
  if (campaign.budget > 0 && campaign.spent >= campaign.budget) {
    campaign.status = 'paused';
    campaign.pausedReason = 'budget_exhausted';
    await saveCampaignStore(store);
    return null;
  }

  campaign.clicks++;
  campaign.spent += campaign.bid;
  store.clicks.push({ campaignId: adId, timestamp: new Date().toISOString() });
  await saveCampaignStore(store);
  return campaign.url;
}

// Handle ads API requests (action-based routing)
async function handleAdsRequest(req, res) {
  const action = req.query.action || 'serve';
  const q = req.query.q || '';
  
  if (action === 'click') {
    const url = await trackClick(req.query.id);
    if (url) { res.setHeader('Location', url); res.status(302).end(); return true; }
    res.status(404).json({ error: 'Campaign not found or inactive' }); return true;
  }
  
  if (action === 'list') {
    const store = await getCampaignStore();
    res.status(200).json({ campaigns: store.campaigns, totalClicks: store.clicks.length });
    return true;
  }
  
  if (action === 'analytics') {
    const store = await getCampaignStore();
    const id = req.query.id;
    if (id) {
      const c = store.campaigns.find(c => c.id === id);
      if (c) { res.status(200).json({ campaign: c, ctr: c.impressions > 0 ? (c.clicks / c.impressions * 100).toFixed(2) + '%' : '0%' }); return true; }
      res.status(404).json({ error: 'Campaign not found' }); return true;
    }
    const totalImpressions = store.campaigns.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = store.campaigns.reduce((s, c) => s + c.clicks, 0);
    const totalSpent = store.campaigns.reduce((s, c) => s + c.spent, 0);
    res.status(200).json({ totalImpressions, totalClicks, totalSpent, ctr: totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) + '%' : '0%', campaigns: store.campaigns.length });
    return true;
  }
  
  if (action === 'create' && req.method === 'POST') {
    const store = await getCampaignStore();
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    const campaign = {
      id: 'ad-' + Date.now(),
      business: data.business || '', title: data.title || '', description: data.description || '',
      url: data.url || '', keywords: data.keywords || [], bid: data.bid || 500,
      budget: data.budget || 10000, spent: 0, impressions: 0, clicks: 0,
      status: 'active', createdAt: new Date().toISOString(),
      advertiserEmail: data.advertiserEmail || ''
    };
    store.campaigns.push(campaign);
    await saveCampaignStore(store);
    res.status(201).json({ success: true, id: campaign.id }); return true;
  }
  
  if (action === 'update' && req.method === 'PUT') {
    const store = await getCampaignStore();
    const c = store.campaigns.find(c => c.id === req.query.id);
    if (!c) { res.status(404).json({ error: 'Not found' }); return true; }
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    Object.assign(c, data);
    await saveCampaignStore(store);
    res.status(200).json({ success: true }); return true;
  }
  
  if (action === 'delete' && req.method === 'DELETE') {
    const store = await getCampaignStore();
    store.campaigns = store.campaigns.filter(c => c.id !== req.query.id);
    await saveCampaignStore(store);
    res.status(200).json({ success: true }); return true;
  }
  
  // Default: serve ads
  const ads = await serveAds(q);
  res.status(200).json({ ads, count: ads.length });
  return true;
}
// ============ End DeryCode Ads ============

// ============ PesaPal Payment Integration ============
const PESAPAL_BASE = process.env.PESAPAL_ENV === 'sandbox'
  ? 'https://cybqa.pesapal.com/v3'
  : 'https://pay.pesapal.com/v3';
const PESAPAL_KEY = process.env.PESAPAL_CONSUMER_KEY;
const PESAPAL_SECRET = process.env.PESAPAL_CONSUMER_SECRET;
const PESAPAL_IPN_ID = process.env.PESAPAL_IPN_ID;
const SITE_URL = 'https://derycode-search-c.vercel.app';

async function getPesaPalToken() {
  const res = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ consumer_key: PESAPAL_KEY, consumer_secret: PESAPAL_SECRET })
  });
  const data = await res.json();
  return data.token;
}

// Wallet stored in Edge Config alongside campaigns
async function getWallets() {
  const edgeConfigId = process.env.EDGE_CONFIG;
  const edgeConfigToken = process.env.EDGE_CONFIG_ACCESS_TOKEN;
  if (edgeConfigId && edgeConfigToken) {
    try {
      const res = await fetch(`https://edge-config.vercel.com/${edgeConfigId}?token=${edgeConfigToken}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || data;
        const wallets = typeof items.wallets === 'string' ? JSON.parse(items.wallets) : (items.wallets || {});
        return wallets;
      }
    } catch (e) {}
  }
  return {};
}

async function saveWallets(wallets) {
  const edgeConfigId = process.env.EDGE_CONFIG;
  const edgeConfigToken = process.env.EDGE_CONFIG_ACCESS_TOKEN;
  if (edgeConfigId && edgeConfigToken) {
    try {
      await fetch(`https://edge-config.vercel.com/${edgeConfigId}/items?token=${edgeConfigToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ operation: 'upsert', key: 'wallets', value: JSON.stringify(wallets) }] })
      });
    } catch (e) {}
  }
}

async function getTransactions() {
  const edgeConfigId = process.env.EDGE_CONFIG;
  const edgeConfigToken = process.env.EDGE_CONFIG_ACCESS_TOKEN;
  if (edgeConfigId && edgeConfigToken) {
    try {
      const res = await fetch(`https://edge-config.vercel.com/${edgeConfigId}?token=${edgeConfigToken}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || data;
        const txns = typeof items.transactions === 'string' ? JSON.parse(items.transactions) : (items.transactions || []);
        return txns;
      }
    } catch (e) {}
  }
  return [];
}

async function saveTransactions(transactions) {
  const edgeConfigId = process.env.EDGE_CONFIG;
  const edgeConfigToken = process.env.EDGE_CONFIG_ACCESS_TOKEN;
  if (edgeConfigId && edgeConfigToken) {
    try {
      await fetch(`https://edge-config.vercel.com/${edgeConfigId}/items?token=${edgeConfigToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ operation: 'upsert', key: 'transactions', value: JSON.stringify(transactions) }] })
      });
    } catch (e) {}
  }
}

async function handlePaymentRequest(req, res) {
  const action = req.query.payment || '';

  // Initiate payment
  if (action === 'initiate' && req.method === 'POST') {
    if (!PESAPAL_KEY || !PESAPAL_SECRET) {
      res.status(500).json({ error: 'PesaPal credentials not configured' });
      return true;
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    const { amount, email, phone, first_name, last_name, business } = JSON.parse(body);

    if (!amount || !email || !phone) {
      res.status(400).json({ error: 'Missing required fields: amount, email, phone' });
      return true;
    }

    try {
      const reference = `ADSFUND-${Date.now()}`;
      const token = await getPesaPalToken();

      const orderRes = await fetch(`${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          id: reference,
          currency: 'UGX',
          amount: parseFloat(amount),
          description: `DeryCode Ads Top-up - ${business || 'Advertiser'}`,
          callback_url: `${SITE_URL}/ads.html?payment=success`,
          notification_id: PESAPAL_IPN_ID,
          billing_address: {
            email_address: email,
            phone_number: phone,
            first_name: first_name || 'Advertiser',
            last_name: last_name || business || 'DeryCode',
            country_code: 'UG',
          }
        })
      });
      const orderData = await orderRes.json();

      if (!orderData.redirect_url) {
        res.status(502).json({ error: orderData.error?.message || 'PesaPal order failed' });
        return true;
      }

      // Record transaction
      const transactions = await getTransactions();
      transactions.push({
        reference,
        order_tracking_id: orderData.order_tracking_id,
        amount: parseFloat(amount),
        email,
        phone,
        business: business || '',
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      await saveTransactions(transactions);

      res.status(200).json({
        success: true,
        redirect_url: orderData.redirect_url,
        order_tracking_id: orderData.order_tracking_id,
        reference
      });
      return true;
    } catch (err) {
      res.status(500).json({ error: 'Payment initiation failed: ' + err.message });
      return true;
    }
  }

  // IPN callback from PesaPal
  if (action === 'ipn') {
    try {
      const notification = req.method === 'GET' ? req.query : req.body;
      const { OrderTrackingId, OrderMerchantReference } = notification;

      if (!OrderTrackingId && !OrderMerchantReference) {
        res.status(400).json({ error: 'Missing reference' });
        return true;
      }

      const token = await getPesaPalToken();
      const statusRes = await fetch(
        `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${OrderTrackingId}`,
        { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } }
      );
      const statusData = await statusRes.json();
      const paymentStatus = statusData.payment_status_description || 'UNKNOWN';
      const reference = OrderMerchantReference || statusData.merchant_reference || '';

      if (paymentStatus === 'Completed' && reference) {
        // Credit the wallet
        const transactions = await getTransactions();
        const txn = transactions.find(t => t.reference === reference);
        if (txn && txn.status !== 'completed') {
          txn.status = 'completed';
          txn.payment_method = statusData.payment_method || '';
          txn.completedAt = new Date().toISOString();
          await saveTransactions(transactions);

          // Credit wallet (keyed by email)
          const wallets = await getWallets();
          const walletKey = txn.email;
          if (!wallets[walletKey]) {
            wallets[walletKey] = { balance: 0, totalDeposited: 0, totalSpent: 0, email: txn.email, business: txn.business };
          }
          wallets[walletKey].balance += txn.amount;
          wallets[walletKey].totalDeposited += txn.amount;
          await saveWallets(wallets);

          // Auto-activate any paused campaigns for this advertiser
          const store = await getCampaignStore();
          for (const c of store.campaigns) {
            if (c.advertiserEmail === txn.email && c.status === 'paused') {
              c.status = 'active';
            }
          }
          await saveCampaignStore(store);
        }
      }

      res.status(200).json({ success: true, reference, status: paymentStatus });
      return true;
    } catch (err) {
      res.status(200).json({ success: false, error: err.message });
      return true;
    }
  }

  // Confirm payment status
  if (action === 'confirm') {
    const { orderTrackingId, reference } = req.query;
    if (!orderTrackingId) {
      res.status(400).json({ error: 'Missing orderTrackingId' });
      return true;
    }
    try {
      const token = await getPesaPalToken();
      const statusRes = await fetch(
        `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
      );
      const statusData = await statusRes.json();
      const isComplete = statusData.payment_status_description === 'Completed';

      // Update transaction if just completed
      if (isComplete && reference) {
        const transactions = await getTransactions();
        const txn = transactions.find(t => t.reference === reference);
        if (txn && txn.status !== 'completed') {
          txn.status = 'completed';
          txn.payment_method = statusData.payment_method || '';
          txn.completedAt = new Date().toISOString();
          await saveTransactions(transactions);

          const wallets = await getWallets();
          const walletKey = txn.email;
          if (!wallets[walletKey]) {
            wallets[walletKey] = { balance: 0, totalDeposited: 0, totalSpent: 0, email: txn.email, business: txn.business };
          }
          wallets[walletKey].balance += txn.amount;
          wallets[walletKey].totalDeposited += txn.amount;
          await saveWallets(wallets);

          const store = await getCampaignStore();
          for (const c of store.campaigns) {
            if (c.advertiserEmail === txn.email && c.status === 'paused') {
              c.status = 'active';
            }
          }
          await saveCampaignStore(store);
        }
      }

      res.status(200).json({
        status: statusData.payment_status_description,
        complete: isComplete,
        amount: statusData.amount,
        tracking_id: orderTrackingId
      });
      return true;
    } catch (err) {
      res.status(500).json({ error: err.message });
      return true;
    }
  }

  // Register IPN URL with PesaPal
  if (action === 'register_ipn') {
    try {
      const token = await getPesaPalToken();
      const ipnUrl = `${SITE_URL}/api/search?payment=ipn`;
      const regRes = await fetch(`${PESAPAL_BASE}/api/URLSetup/RegisterIPN`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          url: ipnUrl,
          ipn_notification_type: 'GET'
        })
      });
      const regData = await regRes.json();
      res.status(200).json({
        success: true,
        ipn_url: ipnUrl,
        ipn_id: regData.ipn_id,
        status: regData.ipn_status_description,
        raw: regData
      });
      return true;
    } catch (err) {
      res.status(500).json({ error: err.message });
      return true;
    }
  }

  // List registered IPN URLs
  if (action === 'list_ipn') {
    try {
      const token = await getPesaPalToken();
      const listRes = await fetch(`${PESAPAL_BASE}/api/URLSetup/GetIPNList`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const listData = await listRes.json();
      res.status(200).json(listData);
      return true;
    } catch (err) {
      res.status(500).json({ error: err.message });
      return true;
    }
  }

  // Get wallet balance
  if (action === 'wallet') {
    const email = req.query.email;
    if (!email) {
      res.status(400).json({ error: 'Missing email' });
      return true;
    }
    const wallets = await getWallets();
    const wallet = wallets[email] || { balance: 0, totalDeposited: 0, totalSpent: 0 };
    res.status(200).json({ wallet });
    return true;
  }

  // Get transaction history
  if (action === 'transactions') {
    const email = req.query.email;
    const transactions = await getTransactions();
    const filtered = email ? transactions.filter(t => t.email === email) : transactions;
    res.status(200).json({ transactions: filtered.slice(-50), count: filtered.length });
    return true;
  }

  return false;
}
// ============ End PesaPal Payment ============


const MAX_QUERY_WORDS = 500;

// DeryCode website search — indexes derycode.publicvm.com
import { fetchDeryCodeSite } from './derycode-site.js';

function isAcademicQuery(q) {
  const academic = ['research', 'paper', 'study', 'theory', 'algorithm', 'analysis',
    'physics', 'chemistry', 'biology', 'mathematics', 'quantum', 'neural',
    'machine learning', 'deep learning', 'artificial intelligence', 'experiment',
    'hypothesis', 'thesis', 'dissertation', 'journal', 'publication', 'scientific'];
  const lower = q.toLowerCase();
  return academic.some(k => lower.includes(k));
}

function getKeywords(q) {
  const stop = new Set(['the','a','an','is','are','how','to','do','does','what','who',
    'can','i','you','my','me','we','our','and','or','but','in','on','at','for',
    'of','with','from','by','about','into','your','this','that','it','its',
    'tell','explain','describe','show','give','want','need','like','please']);
  return q.toLowerCase().split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w))
    .map(w => w.replace(/[^a-z0-9]/g, ''));
}

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
  // Penalty for academic content in non-academic queries
  if (!keywords.some(k => ['research','paper','physics','quantum','algorithm','neural','study','theory'].includes(k))) {
    const academicSignals = ['decay', 'particle', 'gravitational', 'quantum', 'experiment',
      'detector', 'physics', 'neutrino', 'boson', 'collider', 'lhc', 'atlas', 'cms'];
    for (const a of academicSignals) {
      if (titleLower.includes(a)) score -= 25;
    }
  }
  return Math.max(0, Math.min(100, score));
}


// Filter out obviously irrelevant results for known entity queries
function isNoiseResult(result, query) {
  const lower = query.toLowerCase().trim();
  const titleLower = (result.title || '').toLowerCase();
  const contentLower = (result.content || '').toLowerCase();
  const urlLower = (result.url || '').toLowerCase();
  
  // For "derycode" queries, filter out known noise patterns
  if (lower.includes('derycode') || lower.includes('dery code')) {
    // Irrelevant URLs that match on partial word fragments
    const noiseUrls = ['cern.ch', 'derrynh.gov', 'deri.io', 'derythm'];
    for (const noise of noiseUrls) {
      if (urlLower.includes(noise)) return true;
    }
    // Irrelevant title patterns
    if (titleLower.includes('code enforcement') && titleLower.includes('derry')) return true;
    if (titleLower.includes('theoretical physics')) return true;
    if (titleLower.includes('deri protocol')) return true;
    if (titleLower.includes('derythm')) return true;
  }
  
  return false;
}

export default async function handler(req, res) {
  // Route ads-specific requests
  if (req.query.action && req.query.action !== 'serve') {
    const handled = await handleAdsRequest(req, res);
    if (handled) return;
  }
  // Route /api/search?ads=true requests (standalone ads endpoint)
  if (req.query.ads === 'true' || (req.url && req.url.includes('/api/ads'))) {
    await handleAdsRequest(req, res);
    return;
  }

  // Route payment requests
  if (req.query.payment) {
    const handled = await handlePaymentRequest(req, res);
    if (handled) return;
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.trim().length === 0) return res.status(400).json({ error: 'Query is required' });
  
  const words = q.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) return res.status(400).json({ error: `Query too long. Max ${MAX_QUERY_WORDS} words.` });
  
  const startTime = Date.now();
  const cleaned = q.trim().replace(/\?$/, '').trim()
    .replace(/^(what is |what is the |what is a |what are |who is |tell me about |explain |describe |how does )/i, '').trim();
  
  const academic = isAcademicQuery(q);
  const keywords = getKeywords(q);
  const deep = req.query.deep === '1' || req.query.deep === 'true';
  
  // DeryCode Ads — fetch sponsored results inline
  const adsPromise = (async () => {
    try { return await serveAds(q); } catch (e) { return []; }
  })();
  
  const sources = [
    fetchDeryCodeSite(q),
    fetchStartpage(q),
    fetchDuckDuckGo(q),
    fetchWikipedia(cleaned).then(w => w ? [{ title: w.title, url: w.url, content: (w.extract||'').substring(0,600), engine: 'wikipedia', source: 'Wikipedia', featured: true }] : []),
    fetchReddit(q),
    fetchHackerNews(q),
    fetchStackExchange(q),
    academic ? fetchArxiv(q) : Promise.resolve([]),
    fetchArchive(q),
    fetchOpenLibrary(q),
    academic ? fetchSemanticScholar(q) : Promise.resolve([]),
    fetchGitHub(q)
    ,
    fetchGoogleBooks(q).then(d => d.results || []),
    fetchGoogleNews(q).then(d => d.results || []),
    fetchGutenberg(q).then(d => d.results || []),
    fetchPubMed(q),
    fetchScholar(q),
    // Deep Web sources - always included when deep=1, otherwise conditional
    deep ? fetchWikidata(q) : Promise.resolve([]),
    deep ? fetchCORE(q) : Promise.resolve([]),
    deep ? fetchWorldBank(q) : Promise.resolve([]),
    deep ? fetchAhmia(q) : Promise.resolve([]),
    deep ? fetchUnpaywall(q) : Promise.resolve([]),
    deep ? fetchArchiveOrgAdvanced(q) : Promise.resolve([])
  ];
  
  const settled = await Promise.allSettled(sources);
  const allResults = [];
  const sourcesUsed = [];
  const sourceNames = ['derycode', 'startpage', 'duckduckgo', 'wikipedia', 'reddit', 'hackernews', 'stackexchange', 'arxiv', 'archive', 'openlibrary', 'semantic-scholar', 'github', 'google-books', 'google-news', 'gutenberg', 'pubmed', 'scholar', 'wikidata', 'core', 'worldbank', 'ahmia', 'unpaywall', 'archive-advanced'];
  let knowledgePanel = null;
  
  // DeryCode knowledge panel for DeryCode-related queries
  const lowerQ = q.toLowerCase();
  if (lowerQ.includes('derycode') || lowerQ.includes('dery code') || lowerQ.includes('asiimwe')) {
    knowledgePanel = {
      title: 'DeryCode Technologies',
      extract: 'DeryCode Technologies is a software development company founded by Asiimwe Derick in 2021, headquartered in Kampala, Uganda. The company specializes in full-stack web development, mobile apps, fintech and banking systems, blockchain and Web3 solutions, AI and automation, digital libraries, and ERP systems. Notable projects include the DeryCode Search Engine, Tropical Gardens Hotel PWA, Sageco Evergreen, Property Masters, Peters Medicare Services, SACCO Wallet, AgroLink Uganda, and Tooro Music. Contact: info@derycode.com | WhatsApp: +256 772 002 326 / +256 762 306 675',
      url: 'https://derycode.publicvm.com',
      source: 'DeryCode Knowledge Base'
    };
  }
  
  settled.forEach((result, idx) => {
    if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
      if (idx === 2 && !knowledgePanel) {
        const wiki = result.value[0];
        knowledgePanel = { title: wiki.title, extract: wiki.content, url: wiki.url, source: 'Wikipedia' };
      }
      sourcesUsed.push(sourceNames[idx]);
      for (const r of result.value) r._score = relevanceScore(r, keywords);
      allResults.push(...result.value);
    }
  });
  
  // Sort by relevance
  allResults.sort((a, b) => (b._score || 0) - (a._score || 0));
  
  // Soft dedup
  const seen = new Set();
  const deduped = allResults.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
  
  // Filter out noise results for known entity queries
  const filtered = deduped.filter(r => !isNoiseResult(r, q));
  
  // For single-word queries, filter out results with zero keyword matches in title
  if (q.trim().split(/\s+/).length === 1 && keywords.length > 0) {
    const singleKw = keywords[0];
    const boosted = filtered.filter(r => {
      const titleLower = (r.title || '').toLowerCase();
      const urlLower = (r.url || '').toLowerCase();
      return titleLower.includes(singleKw) || urlLower.includes(singleKw);
    });
    const rest = filtered.filter(r => {
      const titleLower = (r.title || '').toLowerCase();
      const urlLower = (r.url || '').toLowerCase();
      return !titleLower.includes(singleKw) && !urlLower.includes(singleKw);
    });
    // Put exact matches first, then the rest sorted by score
    const final = boosted.concat(rest);
    const elapsed2 = ((Date.now() - startTime) / 1000).toFixed(2);
    return res.status(200).json({
      query: q, knowledgePanel,
      ads: await adsPromise,
      results: final.slice(0, 30),
      count: final.length, sources: sourcesUsed, time: elapsed2,
      limits: { maxQueryWords: MAX_QUERY_WORDS },
      deep: deep || false,
      deep_sources: deep ? ["Wikidata","CORE","World Bank","Ahmia (.onion)","CrossRef/Unpaywall","Internet Archive Advanced"] : []
    });
  }
  
  const adsResult = await adsPromise;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  res.status(200).json({
    query: q, knowledgePanel,
    ads: adsResult,
    results: deduped,
    count: deduped.length, sources: sourcesUsed, time: elapsed,
    limits: { maxQueryWords: MAX_QUERY_WORDS },
    deep: deep || false,
    deep_sources: deep ? ["Wikidata","CORE","World Bank","Ahmia (.onion)","CrossRef/Unpaywall","Internet Archive Advanced"] : []
  });
}

// ============ SOURCES ============

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
    for (const m of matches.slice(0, 20)) {
      let title = m[2].replace(/<[^>]+>/g, '').trim();
      let url = m[1];
      if (title.length > 3 && !title.includes('.css') && url.startsWith('http')) {
        let domain = ''; try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
        const block = html.substring(m.index, m.index + 2000);
        const snip = block.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/p>/s) || block.match(/class="[^"]*text[^"]*"[^>]*>(.*?)<\/p>/s);
        let content = snip ? snip[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&middot;/g,'·').trim() : '';
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
        if (t.FirstURL && t.Text) results.push({ title: t.Text.split(' - ')[0].substring(0,200), url: t.FirstURL, content: t.Text, engine: 'duckduckgo', source: 'DuckDuckGo' });
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
      results.push({ title: `${d.title} [r/${d.subreddit}]`, url: `https://www.reddit.com${d.permalink}`, content: (d.selftext || `Reddit discussion - ${d.score} upvotes`).substring(0, 800), engine: 'reddit', source: 'Reddit' });
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
      results.push({ title: hit.title || hit.objectID, url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`, content: (hit.story_text || `Hacker News - ${hit.points || 0} points`).substring(0, 800), engine: 'hackernews', source: 'Hacker News' });
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
      results.push({ title: item.title, url: item.link, content: `Stack Overflow - ${item.score} votes, ${item.answer_count} answers`, engine: 'stackexchange', source: 'Stack Overflow' });
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
    for (const entry of xml.split('<entry>').slice(1)) {
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\n/g,' ');
      const id = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim();
      if (title && id) results.push({ title: `${title} - ArXiv`, url: id, content: 'ArXiv academic preprint', engine: 'arxiv', source: 'ArXiv' });
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
      results.push({ title: doc.title || doc.identifier, url: `https://archive.org/details/${doc.identifier}`, content: (doc.description || 'Internet Archive item').substring(0,600), engine: 'archive', source: 'Internet Archive' });
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
      results.push({ title: `${doc.title} - Book`, url: `https://openlibrary.org${doc.key}`, content: doc.author_name?.[0] ? `Book by ${doc.author_name[0]}` : 'Open Library book', engine: 'openlibrary', source: 'Open Library' });
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
      results.push({ title: paper.year ? `${paper.title} (${paper.year})` : paper.title, url: paper.url || 'https://www.semanticscholar.org', content: (paper.abstract || 'Academic research paper').substring(0,600), engine: 'semantic-scholar', source: 'Semantic Scholar' });
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
      results.push({ title: item.full_name, url: item.html_url, content: (item.description || 'GitHub repository').substring(0,600), engine: 'github', source: 'GitHub' });
    }
    return results;
  } catch { return []; }
}

// NEW SOURCES - v2.0

async function fetchGoogleBooks(q) {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10&printType=books&projection=full`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(10000) });
    const data = await r.json();
    const results = [];
    const books = [];
    for (const item of (data?.items || [])) {
      const vol = item.volumeInfo || {};
      const authors = (vol.authors || ['Unknown']).join(', ');
      results.push({ title: `${vol.title} by ${authors}`, url: vol.infoLink || `https://books.google.com/books?q=${encodeURIComponent(vol.title||'')}`, content: (vol.description || `Book by ${authors}${vol.publishedDate ? ' (' + vol.publishedDate + ')' : ''}`).substring(0,1200), engine: 'google-books', source: 'Google Books' });
      books.push({ title: vol.title || '', author: authors, description: vol.description || 'No description available.', year: vol.publishedDate || '', publisher: vol.publisher || '', source: 'Google Books' });
    }
    return { results, books };
  } catch { return { results: [], books: [] }; }
}

async function fetchGoogleNews(q) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DeryCodeSearch/1.0)' }, signal: AbortSignal.timeout(10000) });
    const text = await r.text();
    const results = [];
    const news = [];
    const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const item of items.slice(0, 10)) {
      const titleMatch = item.match(/<title>(.*?)<\/title>/);
      const linkMatch = item.match(/<link>(.*?)<\/link>/);
      const descMatch = item.match(/<description>(.*?)<\/description>/);
      const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/);
      const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
      const title = titleMatch ? decodeHtml(titleMatch[1]) : '';
      const link = linkMatch ? linkMatch[1] : '';
      const desc = descMatch ? decodeHtml(descMatch[1]).replace(/<[^>]+>/g,'') : '';
      const source = sourceMatch ? sourceMatch[1] : 'Google News';
      const date = dateMatch ? dateMatch[1] : '';
      if (title) {
        results.push({ title, url: link, content: desc.substring(0,800), engine: 'google-news', source: `News: ${source}` });
        news.push({ title, snippet: desc, source, date, url: link });
      }
    }
    return { results, news };
  } catch { return { results: [], news: [] }; }
}

async function fetchGutenberg(q) {
  try {
    const url = `https://gutendex.com/books?search=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(10000) });
    const data = await r.json();
    const results = [];
    const books = [];
    for (const book of (data?.results || []).slice(0, 8)) {
      const authors = (book.authors || [{name:'Unknown'}]).map(a => a.name).join(', ');
      const subjects = (book.subjects || []).join(', ');
      results.push({ title: `${book.title} by ${authors} (FREE)`, url: `https://www.gutenberg.org/ebooks/${book.id}`, content: `Free public domain book by ${authors}. ${subjects.substring(0,500)}`, engine: 'gutenberg', source: 'Project Gutenberg' });
      books.push({ title: book.title || '', author: authors, description: `Free public domain book. ${subjects}`, source: 'Project Gutenberg' });
    }
    return { results, books };
  } catch { return { results: [], books: [] }; }
}

async function fetchPubMed(q) {
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q)}&retmax=6&retmode=json`;
    const sr = await fetch(searchUrl, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(10000) });
    const sd = await sr.json();
    const ids = (sd?.esearchresult?.idlist || []);
    if (ids.length === 0) return [];
    const sumUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
    const sumr = await fetch(sumUrl, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(10000) });
    const sumd = await sumr.json();
    const results = [];
    for (const uid of (sumd?.result?.uids || []).slice(0, 6)) {
      const art = sumd.result[uid];
      const authors = (art.authors || [{name:'Unknown'}]).map(a => a.name).join(', ');
      results.push({ title: art.title || '', url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`, content: `PubMed article by ${authors}, published ${art.pubdate || '?'} in ${art.source || 'PubMed'}. PMID: ${uid}`, engine: 'pubmed', source: 'PubMed' });
    }
    return results;
  } catch { return []; }
}

async function fetchScholar(q) {
  try {
    const url = `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}&hl=en&as_sdt=0,5`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0' }, signal: AbortSignal.timeout(10000) });
    const html = await r.text();
    const results = [];
    // Simple regex extraction of scholar results
    const blocks = html.split('gs_r gs_or').slice(1, 7);
    for (const block of blocks) {
      const titleMatch = block.match(/gs_rt[^>]*>([^<]+)/);
      const snippetMatch = block.match(/gs_rs[^>]*>([\s\S]*?)<\/div>/);
      const linkMatch = block.match(/href="([^"]+)"/);
      const metaMatch = block.match(/gs_a[^>]*>([\s\S]*?)<\/div>/);
      if (titleMatch) {
        const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        const link = linkMatch ? linkMatch[1] : '';
        const meta = metaMatch ? metaMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        results.push({ title, url: link || `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`, content: `${meta} - ${snippet}`.substring(0,800), engine: 'google-scholar', source: 'Google Scholar' });
      }
    }
    return results;
  } catch { return []; }
}


// === DEEP WEB SOURCES ===

// Wikidata - structured knowledge graph
async function fetchWikidata(q) {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&limit=8&format=json`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(10000) });
    const d = await r.json();
    const results = [];
    for (const item of (d.search || [])) {
      results.push({
        title: item.label || 'Wikidata Entity',
        url: `https://www.wikidata.org/wiki/${item.id}`,
        content: (item.description || 'Wikidata knowledge graph entry') + ` [ID: ${item.id}]`,
        engine: 'wikidata',
        source: 'Wikidata',
        deep: true
      });
    }
    return results;
  } catch { return []; }
}

// CORE - Open access research papers aggregator
async function fetchCORE(q) {
  try {
    const url = `https://api.core.ac.uk:443/v3/search/works?q=${encodeURIComponent(q)}&limit=8`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0', 'Accept': 'application/json' }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return [];
    const d = await r.json();
    const results = [];
    for (const item of (d.results || []).slice(0, 8)) {
      const work = item._source || item;
      results.push({
        title: work.title || 'CORE Research Paper',
        url: work.download_url || work.url || `https://core.ac.uk/search?q=${encodeURIComponent(q)}`,
        content: (work.abstract || work.description || 'Open access research paper from CORE repository').substring(0, 800),
        engine: 'core',
        source: 'CORE',
        deep: true
      });
    }
    return results;
  } catch { return []; }
}

// World Bank Open Data API
async function fetchWorldBank(q) {
  try {
    const url = `https://api.worldbank.org/v2/countries/all/indicators?format=json&per_page=8&prefix=`;
    // Search for indicators matching the query
    const searchUrl = `https://api.worldbank.org/v2/sources/2/search?q=${encodeURIComponent(q)}&format=json&per_page=8`;
    const r = await fetch(searchUrl, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const d = await r.json();
    const results = [];
    const items = d[1] || d.source || [];
    for (const item of (Array.isArray(items) ? items : []).slice(0, 8)) {
      const concept = item.concepts || item;
      results.push({
        title: item.name || 'World Bank Data Indicator',
        url: `https://data.worldbank.org/indicator/${item.id || ''}`,
        content: (item.sourceNote || item.description || 'World Bank open data indicator') + (item.id ? ` [Code: ${item.id}]` : ''),
        engine: 'worldbank',
        source: 'World Bank Data',
        deep: true
      });
    }
    return results;
  } catch { return []; }
}

// Ahmia - Clearnet search engine for .onion sites (Dark Web index)
async function fetchAhmia(q) {
  try {
    const url = `https://ahmia.fi/search/?q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return [];
    const html = await r.text();
    const results = [];
    // Parse Ahmia search results (they use li.result elements)
    const blocks = html.split('<li class="result"').slice(1, 9);
    for (const block of blocks) {
      const titleMatch = block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/);
      const linkMatch = block.match(/href="([^"]*\.onion[^"]*)"/);
      const descMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
      if (titleMatch || linkMatch) {
        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Onion Site';
        const link = linkMatch ? linkMatch[1] : '';
        const desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : 'Indexed .onion site';
        results.push({
          title: title,
          url: link || `https://ahmia.fi/search/?q=${encodeURIComponent(q)}`,
          content: '[DARK WEB] ' + desc.substring(0, 600),
          engine: 'ahmia',
          source: 'Ahmia (.onion)',
          deep: true,
          dark: true
        });
      }
    }
    if (results.length === 0) {
      results.push({
        title: 'No .onion results found via Ahmia',
        url: `https://ahmia.fi/search/?q=${encodeURIComponent(q)}`,
        content: 'Ahmia indexed no .onion pages for this query. Visit ahmia.fi to search directly.',
        engine: 'ahmia',
        source: 'Ahmia (.onion)',
        deep: true,
        dark: true
      });
    }
    return results;
  } catch { return []; }
}

// Unpaywall - Open access scholarly papers
async function fetchUnpaywall(q) {
  try {
    // Use Unpaywall's search via DOI lookup - we use CrossRef to find DOIs first
    const crossrefUrl = `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=8&select=DOI,title,abstract,author,published-print,URL`;
    const r = await fetch(crossrefUrl, { headers: { 'User-Agent': 'DeryCodeSearch/1.0 (mailto:info@derycode.com)' }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return [];
    const d = await r.json();
    const results = [];
    for (const item of (d.message?.items || []).slice(0, 8)) {
      const doi = item.DOI || '';
      const authors = (item.author || []).slice(0, 3).map(a => `${a.given || ''} ${a.family || ''}`.trim()).join(', ');
      const year = item['published-print']?.['date-parts']?.[0]?.[0] || '';
      const abstract = (item.abstract || '').replace(/<[^>]+>/g, '').substring(0, 600);
      results.push({
        title: (item.title || ['CrossRef Paper'])[0],
        url: item.URL || `https://doi.org/${doi}`,
        content: `[DOI: ${doi}] ${authors} ${year ? '(' + year + ')' : ''} - ${abstract || 'Scholarly paper with DOI'}`.substring(0, 800),
        engine: 'unpaywall',
        source: 'CrossRef/Unpaywall',
        deep: true,
        doi: doi
      });
    }
    return results;
  } catch { return []; }
}

// Internet Archive Advanced Search (deeper than basic archive search)
async function fetchArchiveOrgAdvanced(q) {
  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=date&fl[]=mediatype&fl[]=creator&rows=8&output=json`;
    const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(10000) });
    const d = await r.json();
    const results = [];
    for (const doc of (d.response?.docs || []).slice(0, 8)) {
      results.push({
        title: doc.title || 'Internet Archive Item',
        url: `https://archive.org/details/${doc.identifier}`,
        content: (doc.description || 'Archived digital content') + ` [Type: ${doc.mediatype || 'unknown'}, Date: ${doc.date || '?'}]`,
        engine: 'archive-advanced',
        source: 'Internet Archive',
        deep: true
      });
    }
    return results;
  } catch { return []; }
}


function decodeHtml(s) {
  if (!s) return '';
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(m,c)=>String.fromCharCode(parseInt(c)));
}
