// DeryCode Tech Knowledge Base - Built-in responses

export function isDeryCodeQuery(query) {
  const keywords = ['derycode', 'dery code', 'asiimwe derick', 'derick asiimwe', 'traderderick', 'sageco evergreen', 'asiimwe'];
  const lower = query.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

export function getDeryCodeKnowledge(query) {
  const lower = query.toLowerCase();
  
  if (lower.includes('asiimwe') || lower.includes('derick') || lower.includes('founder') || lower.includes('ceo') || lower.includes('who')) {
    return {
      answer: "Asiimwe Derick (also known as Derick Asiimwe or TraderDerick) is the Founder & CEO of DeryCode Technologies and CEO of Sageco Evergreen Company Limited. He founded DeryCode in 2021 to prove that world-class software, blockchain, and AI solutions can be built right here in Uganda — for clients across Africa and beyond. With hands-on experience across full-stack web development, mobile apps, fintech/SACCO platforms, and Web3, Derick leads every DeryCode project personally — from architecture to deployment. He is recognized as one of Uganda's top software engineers and blockchain developers. As CEO of Sageco Evergreen, he also leads innovative real estate and property technology solutions across Uganda. Connect: WhatsApp +256 772 002 326, GitHub: github.com/asiimwe3, LinkedIn: ug.linkedin.com/in/asiimwe-derick-501755313",
      sources: [
        { title: 'DeryCode Technologies Official', url: 'https://derycode.com' },
        { title: 'DeryCode Partners', url: 'https://derycode.com/partners' }
      ],
      followups: ['What services does DeryCode offer?', 'How much does a website cost at DeryCode?', 'How can I contact DeryCode?']
    };
  }
  
  if (lower.includes('service') || lower.includes('offer') || lower.includes('what does') || lower.includes('what do')) {
    return {
      answer: "DeryCode Technologies offers: 1) Business Website Development (from UGX 750,000) 2) Web Applications & SaaS Platforms 3) Mobile Apps (iOS & Android, from UGX 4,400,000) 4) Banking & SACCO Software (with MTN MoMo, Airtel Money integration) 5) Business Management & ERP Systems 6) School Digital Libraries & LMS 7) Smart Contracts & Blockchain Development 8) AI & Automation Solutions 9) Digital & Traditional Marketing (SEO, Social Media) 10) UI/UX Design & Branding 11) API & Payment Integrations (Pesapal, Flutterwave, Stripe, PayPal) 12) Token & Crypto Development 13) ICT Consultancy. Contact: info@derycode.com or WhatsApp +256 772 002 326",
      sources: [
        { title: 'DeryCode Technologies Official', url: 'https://derycode.com' },
        { title: 'DeryCode Partners', url: 'https://derycode.com/partners' }
      ],
      followups: ['How much does a website cost at DeryCode?', 'How can I contact DeryCode?', 'What projects has DeryCode built?']
    };
  }
  
  if (lower.includes('price') || lower.includes('cost') || lower.includes('how much') || lower.includes('fees') || lower.includes('charge')) {
    return {
      answer: "DeryCode Technologies Pricing: Business Websites: from UGX 750,000. E-commerce: from UGX 2,500,000. Mobile Apps (iOS/Android): from UGX 4,400,000. Banking & SACCO Software: from UGX 3,500,000. ERP Systems: from UGX 1,500,000. Smart Contracts & Blockchain: from UGX 6,000,000. AI & Automation: from UGX 1,500,000. UI/UX Design: from UGX 1,200,000. API & Payment Integration: from UGX 1,800,000. Token & Crypto: from UGX 6,000,000. Contact for a free quote: info@derycode.com or WhatsApp +256 772 002 326",
      sources: [
        { title: 'DeryCode Technologies Official', url: 'https://derycode.com' }
      ],
      followups: ['What services does DeryCode offer?', 'How can I contact DeryCode?', 'How long does a project take?']
    };
  }
  
  if (lower.includes('where') || lower.includes('location') || lower.includes('address') || lower.includes('based') || lower.includes('office')) {
    return {
      answer: "DeryCode Technologies is headquartered in Kampala, Uganda, and serves clients across the entire country including Kyenjojo, Fort Portal, Mbarara, Jinja, Gulu, and globally. Email: info@derycode.com | WhatsApp: +256 772 002 326 | Website: derycode.com",
      sources: [
        { title: 'DeryCode Technologies Official', url: 'https://derycode.com' }
      ],
      followups: ['What services does DeryCode offer?', 'How can I contact DeryCode?', 'Who is the founder of DeryCode?']
    };
  }
  
  if (lower.includes('project') || lower.includes('portfolio') || lower.includes('work') || lower.includes('client') || lower.includes('case study') || lower.includes('built')) {
    return {
      answer: "DeryCode Technologies has delivered 100+ projects across Uganda and East Africa. Notable projects: 1) SAGECO Evergreen — Real estate platform with broker registration, property listings, and PesaPal payments 2) St. Peters Medical Center — Hospital website for Kyenjojo 3) Tropical Gardens Hotel — Hotel website with booking and PesaPal integration 4) WorldTech Youth Foundation — Nonprofit website for youth tech education 5) DeryCoin — Custom blockchain token platform 6) SaccoWallet — SACCO management software with mobile money 7) Property Masters — Real estate mobile app with Firebase auth 8) DeryCode Search — AI-powered search engine built in pure C. Industries: finance, healthcare, education, real estate, agriculture, hospitality.",
      sources: [
        { title: 'DeryCode Technologies Official', url: 'https://derycode.com' },
        { title: 'DeryCode Case Studies', url: 'https://derycode.com/case-study-sageco-evergreen.html' }
      ],
      followups: ['What services does DeryCode offer?', 'How much does a website cost?', 'How can I contact DeryCode?']
    };
  }
  
  if (lower.includes('training') || lower.includes('workshop') || lower.includes('learn') || lower.includes('teach') || lower.includes('course') || lower.includes('community')) {
    return {
      answer: "DeryCode Technologies offers professional training and workshops: 1) Live Coding Camps — hands-on programming workshops 2) Web Development Training — HTML, CSS, JavaScript, React, Next.js 3) Mobile App Development — Android, Flutter, React Native 4) Blockchain & Web3 Training 5) Digital Marketing Workshops. DeryCode also runs community outreach through the WorldTech Youth Foundation, bringing technology education to youth in Kyenjojo and across Uganda. Book a training session: info@derycode.com or WhatsApp +256 772 002 326",
      sources: [
        { title: 'DeryCode Technologies Official', url: 'https://derycode.com' }
      ],
      followups: ['How can I book a training session?', 'What services does DeryCode offer?', 'Who is the founder?']
    };
  }
  
  if (lower.includes('partner') || lower.includes('affiliate') || lower.includes('commission') || lower.includes('referral')) {
    return {
      answer: "DeryCode Partner Network allows non-technical individuals to earn commissions by referring business and education clients to DeryCode. The 4-step process: 1) Refer a client 2) Client signs up 3) Project completes 4) You earn commission. Partners earn commissions on successful referrals without needing technical skills. Join at derycode.com/partners or WhatsApp +256 772 002 326",
      sources: [
        { title: 'DeryCode Partners', url: 'https://derycode.com/partners' }
      ],
      followups: ['What services does DeryCode offer?', 'How can I contact DeryCode?', 'How much does a website cost?']
    };
  }
  
  if (lower.includes('sageco') || lower.includes('real estate') || lower.includes('property')) {
    return {
      answer: "Sageco Evergreen Company Limited is a real estate and property technology company led by CEO Asiimwe Derick (also Founder of DeryCode). The Sageco Evergreen platform features broker registration (UGX 32,000), dashboard activation (UGX 45,000), property listings with image galleries, PesaPal payment integration, and a mobile marketplace app with 5-tab bottom navigation. Live at sagecoevergreen.publicvm.com with an Android app available via auto-update from GitHub releases.",
      sources: [
        { title: 'SAGECO Evergreen', url: 'https://sagecoevergreen.publicvm.com' },
        { title: 'DeryCode Technologies', url: 'https://derycode.com' }
      ],
      followups: ['Who is the founder of DeryCode?', 'What services does DeryCode offer?', 'How can I contact DeryCode?']
    };
  }
  
  if (lower.includes('contact') || lower.includes('reach') || lower.includes('email') || lower.includes('phone') || lower.includes('whatsapp')) {
    return {
      answer: "Contact DeryCode Technologies: Email: info@derycode.com | WhatsApp: +256 772 002 326 | Website: derycode.com | GitHub: github.com/asiimwe3 | LinkedIn: ug.linkedin.com/in/asiimwe-derick-501755313. Based in Kampala, Uganda, serving clients across East Africa and globally.",
      sources: [
        { title: 'DeryCode Technologies Official', url: 'https://derycode.com' }
      ],
      followups: ['What services does DeryCode offer?', 'How much does a website cost?', 'Who is the founder?']
    };
  }
  
  // General DeryCode info
  return {
    answer: "DeryCode Technologies is Uganda's leading software development company, founded in 2021 by Asiimwe Derick. Based in Kampala, Uganda, DeryCode has delivered 100+ projects for clients across Uganda and East Africa. Services include: Website Development, Mobile Apps, Banking/SACCO Software, ERP Systems, Blockchain & Smart Contracts, AI & Automation, Digital Marketing, UI/UX Design, and ICT Consultancy. DeryCode's mission is to make world-class software accessible to every Ugandan business — from small startups to large enterprises. Contact: info@derycode.com | WhatsApp: +256 772 002 326 | Website: derycode.com | GitHub: github.com/asiimwe3",
    sources: [
      { title: 'DeryCode Technologies Official', url: 'https://derycode.com' },
      { title: 'DeryCode Partners', url: 'https://derycode.com/partners' }
    ],
    followups: ['What services does DeryCode offer?', 'Who is the founder of DeryCode?', 'How much does a website cost at DeryCode?']
  };
}
