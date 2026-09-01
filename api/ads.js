// DeryCode Ads — Sponsored Search Results & Campaign Management
// Version 1.0 — Built for DeryCode Search Engine
// Revenue model: PPC (pay-per-click) for Ugandan & East African businesses

import { kv } from '@vercel/kv';

// ============ STORAGE ============
// Uses Vercel KV for persistence. Falls back to in-memory if KV not configured.

const inMemoryStore = {
  campaigns: [
    {
      id: 'seed-001',
      business: 'DeryCode Technologies',
      title: 'Professional Website Development in Uganda — From UGX 750K',
      description: 'Custom websites, web apps, mobile apps & SEO. Built by DeryCode. Contact today!',
      url: 'https://derycode.publicvm.com',
      keywords: ['website design uganda', 'web development kampala', 'website developer uganda', 'software company uganda'],
      bid: 1500, // UGX per click
      budget: 100000, // UGX monthly budget
      spent: 0,
      clicks: 0,
      impressions: 0,
      status: 'active',
      category: 'technology',
      createdAt: new Date().toISOString(),
      phone: '+256772002326'
    }
  ],
  advertisers: [
    {
      id: 'adv-001',
      name: 'DeryCode Technologies',
      email: 'info@derycode.com',
      phone: '+256772002326',
      balance: 100000,
      createdAt: new Date().toISOString()
    }
  ]
};

async function getCampaigns() {
  try {
    if (process.env.KV_REST_API_URL) {
      const data = await kv.get('dc_campaigns');
      return data || inMemoryStore.campaigns;
    }
  } catch (e) { /* KV not configured */ }
  return inMemoryStore.campaigns;
}

async function saveCampaigns(campaigns) {
  try {
    if (process.env.KV_REST_API_URL) {
      await kv.set('dc_campaigns', campaigns);
    }
  } catch (e) { /* KV not configured */ }
  inMemoryStore.campaigns = campaigns;
}

async function getAdvertisers() {
  try {
    if (process.env.KV_REST_API_URL) {
      const data = await kv.get('dc_advertisers');
      return data || inMemoryStore.advertisers;
    }
  } catch (e) { /* KV not configured */ }
  return inMemoryStore.advertisers;
}

async function saveAdvertisers(advertisers) {
  try {
    if (process.env.KV_REST_API_URL) {
      await kv.set('dc_advertisers', advertisers);
    }
  } catch (e) { /* KV not configured */ }
  inMemoryStore.advertisers = advertisers;
}

// ============ AD MATCHING ============

function matchAds(query, campaigns) {
  const lowerQ = query.toLowerCase();
  const matched = [];
  
  for (const c of campaigns) {
    if (c.status !== 'active') continue;
    if (c.spent >= c.budget) continue;
    
    const keywords = c.keywords || [];
    let bestMatch = null;
    let bestScore = 0;
    
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      if (lowerQ.includes(kwLower) || kwLower.includes(lowerQ)) {
        const score = kwLower === lowerQ ? 100 : (lowerQ.includes(kwLower) ? 80 : 60);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = kw;
        }
      }
    }
    
    // Also match on partial keyword overlap
    if (!bestMatch) {
      const queryWords = lowerQ.split(/\s+/).filter(w => w.length > 2);
      for (const kw of keywords) {
        const kwWords = kw.toLowerCase().split(/\s+/);
        const overlap = kwWords.filter(w => queryWords.includes(w));
        if (overlap.length >= 2) {
          const score = overlap.length * 20;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = kw;
          }
        }
      }
    }
    
    if (bestMatch) {
      matched.push({ ...c, matchScore: bestScore, matchedKeyword: bestMatch });
    }
  }
  
  // Sort by bid amount (highest bidder gets top position)
  matched.sort((a, b) => b.bid - a.bid);
  
  return matched.slice(0, 3); // Max 3 sponsored results per search
}

// ============ CLICK TRACKING ============

async function recordClick(campaignId) {
  const campaigns = await getCampaigns();
  const campaign = campaigns.find(c => c.id === campaignId);
  if (!campaign) return { error: 'Campaign not found' };
  if (campaign.status !== 'active') return { error: 'Campaign inactive' };
  if (campaign.spent >= campaign.budget) return { error: 'Budget exhausted' };
  
  campaign.clicks += 1;
  campaign.spent += campaign.bid;
  
  await saveCampaigns(campaigns);
  
  return { 
    success: true, 
    url: campaign.url,
    clickCost: campaign.bid,
    remainingBudget: campaign.budget - campaign.spent
  };
}

async function recordImpression(campaignIds) {
  if (!campaignIds || campaignIds.length === 0) return;
  const campaigns = await getCampaigns();
  let updated = false;
  for (const id of campaignIds) {
    const c = campaigns.find(camp => camp.id === id);
    if (c) {
      c.impressions += 1;
      updated = true;
    }
  }
  if (updated) await saveCampaigns(campaigns);
}

// ============ ADMIN / MANAGEMENT ============

function genId() {
  return 'camp-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

async function createCampaign(data) {
  const campaigns = await getCampaigns();
  const campaign = {
    id: genId(),
    business: data.business || '',
    title: data.title || '',
    description: data.description || '',
    url: data.url || '',
    keywords: (data.keywords || []).map(k => k.toLowerCase().trim()).filter(k => k.length > 0),
    bid: parseInt(data.bid) || 1000,
    budget: parseInt(data.budget) || 50000,
    spent: 0,
    clicks: 0,
    impressions: 0,
    status: data.status || 'active',
    category: data.category || 'general',
    phone: data.phone || '',
    createdAt: new Date().toISOString()
  };
  campaigns.push(campaign);
  await saveCampaigns(campaigns);
  return campaign;
}

async function updateCampaign(id, data) {
  const campaigns = await getCampaigns();
  const campaign = campaigns.find(c => c.id === id);
  if (!campaign) return null;
  const updatable = ['business', 'title', 'description', 'url', 'keywords', 'bid', 'budget', 'status', 'category', 'phone'];
  for (const field of updatable) {
    if (data[field] !== undefined) {
      if (field === 'keywords') {
        campaign.keywords = data[field].map(k => k.toLowerCase().trim()).filter(k => k.length > 0);
      } else if (field === 'bid' || field === 'budget') {
        campaign[field] = parseInt(data[field]);
      } else {
        campaign[field] = data[field];
      }
    }
  }
  await saveCampaigns(campaigns);
  return campaign;
}

async function deleteCampaign(id) {
  const campaigns = await getCampaigns();
  const filtered = campaigns.filter(c => c.id !== id);
  if (filtered.length === campaigns.length) return false;
  await saveCampaigns(filtered);
  return true;
}

// ============ ANALYTICS ============

async function getAnalytics(campaignId) {
  const campaigns = await getCampaigns();
  if (campaignId) {
    const c = campaigns.find(camp => camp.id === campaignId);
    if (!c) return null;
    return {
      campaign: c,
      stats: {
        clicks: c.clicks,
        impressions: c.impressions,
        ctr: c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) + '%' : '0%',
        spent: c.spent,
        budget: c.budget,
        remaining: c.budget - c.spent,
        budgetUsed: c.budget > 0 ? ((c.spent / c.budget) * 100).toFixed(1) + '%' : '0%'
      }
    };
  }
  // All campaigns summary
  const total = campaigns.reduce((acc, c) => {
    acc.clicks += c.clicks;
    acc.impressions += c.impressions;
    acc.revenue += c.spent;
    acc.budget += c.budget;
    return acc;
  }, { clicks: 0, impressions: 0, revenue: 0, budget: 0 });
  
  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'active').length,
    totalClicks: total.clicks,
    totalImpressions: total.impressions,
    totalRevenue: total.revenue,
    totalBudget: total.budget,
    averageCTR: total.impressions > 0 ? ((total.clicks / total.impressions) * 100).toFixed(2) + '%' : '0%',
    campaigns: campaigns.map(c => ({
      id: c.id, business: c.business, title: c.title, status: c.status,
      clicks: c.clicks, impressions: c.impressions, spent: c.spent,
      budget: c.budget, bid: c.bid
    }))
  };
}

// ============ MAIN HANDLER ============

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const action = req.query.action || 'serve';
  
  // GET /api/ads?q=keyword — Serve ads for a search query
  if (req.method === 'GET' && action === 'serve') {
    const q = req.query.q || '';
    if (!q || q.trim().length === 0) return res.status(200).json({ ads: [] });
    
    const campaigns = await getCampaigns();
    const ads = matchAds(q, campaigns);
    
    // Record impressions
    if (ads.length > 0) {
      await recordImpression(ads.map(a => a.id));
    }
    
    // Return ad data (without internal tracking fields)
    const cleanAds = ads.map(a => ({
      id: a.id,
      title: a.title,
      description: a.description,
      url: a.url,
      business: a.business,
      bid: a.bid,
      matchScore: a.matchScore,
      matchedKeyword: a.matchedKeyword,
      phone: a.phone,
      sponsored: true
    }));
    
    return res.status(200).json({ ads: cleanAds, count: cleanAds.length });
  }
  
  // GET /api/ads?action=click&id=campaign-id — Track click and redirect
  if (req.method === 'GET' && action === 'click') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'Campaign ID required' });
    const result = await recordClick(id);
    if (result.error) return res.status(400).json(result);
    // Redirect to the ad URL
    return res.redirect(302, result.url);
  }
  
  // GET /api/ads?action=list — List all campaigns (admin)
  if (req.method === 'GET' && action === 'list') {
    const campaigns = await getCampaigns();
    return res.status(200).json({ campaigns, count: campaigns.length });
  }
  
  // GET /api/ads?action=analytics — Get analytics (all or single campaign)
  if (req.method === 'GET' && action === 'analytics') {
    const analytics = await getAnalytics(req.query.id);
    return res.status(200).json(analytics);
  }
  
  // POST /api/ads?action=create — Create new campaign
  if (req.method === 'POST' && action === 'create') {
    const campaign = await createCampaign(req.body);
    return res.status(201).json({ success: true, campaign });
  }
  
  // PUT /api/ads?action=update&id=campaign-id — Update campaign
  if (req.method === 'PUT' && action === 'update') {
    const campaign = await updateCampaign(req.query.id, req.body);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    return res.status(200).json({ success: true, campaign });
  }
  
  // DELETE /api/ads?action=delete&id=campaign-id — Delete campaign
  if (req.method === 'DELETE' && action === 'delete') {
    const deleted = await deleteCampaign(req.query.id);
    if (!deleted) return res.status(404).json({ error: 'Campaign not found' });
    return res.status(200).json({ success: true });
  }
  
  // POST /api/ads?action=payment — Process MoMo payment (placeholder for MTN MoMo API)
  if (req.method === 'POST' && action === 'payment') {
    const { phone, amount, campaignId } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'Phone and amount required' });
    
    // TODO: Integrate MTN MoMo API collection request
    // For now, return payment instructions
    return res.status(200).json({
      success: true,
      message: 'Payment initiated',
      instructions: 'Dial *165*1*1*772002326*' + amount + '# to pay UGX ' + amount + ' via MTN MoMo',
      amount: amount,
      phone: phone,
      campaignId: campaignId || null,
      status: 'pending'
    });
  }
  
  return res.status(400).json({ error: 'Invalid action' });
}
