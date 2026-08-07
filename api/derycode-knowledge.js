// DeryCode Tech Knowledge Base - Built-in responses
// Covers all DeryCode projects, services, and GitHub repositories

export function isDeryCodeQuery(query) {
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

export function getDeryCodeKnowledge(query) {
  const lower = query.toLowerCase();

  // === FOUNDER / CEO ===
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

  // === SERVICES ===
  if (lower.includes('service') || lower.includes('offer') || lower.includes('what does') || lower.includes('what do')) {
    return {
      answer: "DeryCode Technologies offers 12 core services: 1) Business Website Development (from UGX 750,000) 2) Web Applications & SaaS Platforms (from UGX 2,200,000) 3) Mobile Apps iOS & Android (from UGX 4,400,000) 4) Banking & SACCO Software with MTN MoMo, Airtel Money integration (from UGX 3,800,000) 5) Business Management & ERP Systems (from UGX 3,500,000) 6) School Digital Libraries & LMS (from UGX 3,000,000) 7) Smart Contracts & Blockchain Development (from UGX 5,500,000) 8) AI & Automation Solutions (from UGX 2,500,000) 9) Digital Marketing & SEO (from UGX 1,500,000) 10) UI/UX Design & Branding (from UGX 1,200,000) 11) Token & Crypto Development (from UGX 6,000,000) 12) API & Payment Integrations - Pesapal, Flutterwave, Stripe, PayPal (from UGX 1,800,000). Contact: info@derycode.com or WhatsApp +256 772 002 326",
      sources: [{ title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' }],
      followups: ['How much does a website cost at DeryCode?', 'How can I contact DeryCode?', 'What projects has DeryCode built?']
    };
  }

  // === PRICING ===
  if (lower.includes('price') || lower.includes('cost') || lower.includes('how much') || lower.includes('fees') || lower.includes('charge')) {
    return {
      answer: "DeryCode Technologies Pricing: Business Websites: from UGX 750,000. Web Apps & SaaS: from UGX 2,200,000. E-commerce: from UGX 2,500,000. Mobile Apps (iOS/Android): from UGX 4,400,000. Banking & SACCO Software: from UGX 3,800,000. ERP Systems: from UGX 3,500,000. School Digital Libraries: from UGX 3,000,000. Smart Contracts & Blockchain: from UGX 5,500,000. AI & Automation: from UGX 2,500,000. Digital Marketing & SEO: from UGX 1,500,000. UI/UX Design: from UGX 1,200,000. API & Payment Integration: from UGX 1,800,000. Token & Crypto: from UGX 6,000,000. Contact for a free quote: info@derycode.com or WhatsApp +256 772 002 326",
      sources: [{ title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' }],
      followups: ['What services does DeryCode offer?', 'How can I contact DeryCode?', 'How long does a project take?']
    };
  }

  // === LOCATION ===
  if (lower.includes('where') || lower.includes('location') || lower.includes('address') || lower.includes('based') || lower.includes('office')) {
    return {
      answer: "DeryCode Technologies is headquartered in Kampala, Uganda, with operations in Kyenjojo and serving clients across the entire country including Fort Portal, Mbarara, Jinja, Gulu, and globally. Email: info@derycode.com | WhatsApp: +256 772 002 326 / +256 762 306 675 | Website: derycode.publicvm.com",
      sources: [{ title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' }],
      followups: ['What services does DeryCode offer?', 'How can I contact DeryCode?', 'Who is the founder of DeryCode?']
    };
  }

  // === CONTACT ===
  if (lower.includes('contact') || lower.includes('reach') || lower.includes('email') || lower.includes('phone') || lower.includes('whatsapp')) {
    return {
      answer: "Contact DeryCode Technologies: Email: info@derycode.com | WhatsApp: +256 772 002 326 / +256 762 306 675 | Website: derycode.publicvm.com | GitHub: github.com/asiimwe3 | LinkedIn: ug.linkedin.com/in/asiimwe-derick-501755313. Based in Kampala, Uganda, serving clients across East Africa and globally.",
      sources: [{ title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' }],
      followups: ['What services does DeryCode offer?', 'How much does a website cost?', 'Who is the founder?']
    };
  }

  // === DERYCODE SEARCH ===
  if (lower.includes('search') && (lower.includes('derycode') || lower.includes('engine'))) {
    return {
      answer: "DeryCode Search is a premium AI-powered search engine built in pure C with zero dependencies. It features: AI Summaries (auto-generated from top results), Knowledge Panels (Wikipedia summaries with thumbnails), Voice Search (Web Speech API), Autocomplete suggestions, Related searches, Search history (localStorage), and aggregates results from DuckDuckGo, Wikipedia, Bing, and GitHub. 6 search modes: Web, Images, News, Code, Videos, and AI Chat. Privacy-focused: no tracking, no ads. DeryCode dark/gold branding. Mobile responsive PWA. Two versions exist: a pure C version (github.com/asiimwe3/derycode-search-c) deployed on Vercel, and a Next.js version (github.com/asiimwe3/derycode-search). Live at derycode-search-c.vercel.app",
      sources: [
        { title: 'DeryCode Search (C Edition)', url: 'https://derycode-search-c.vercel.app' },
        { title: 'GitHub Repository', url: 'https://github.com/asiimwe3/derycode-search-c' }
      ],
      followups: ['What features does DeryCode Search have?', 'How does DeryCode Search work?', 'What other projects has DeryCode built?']
    };
  }

  // === DERYCODE WHATSAPP AGENT ===
  if (lower.includes('whatsapp') && lower.includes('derycode')) {
    return {
      answer: "DeryCode WhatsApp Agent is an AI-powered WhatsApp chatbot named 'Derick' that serves as a friendly company representative for DeryCode Technologies. It targets WhatsApp groups and individual leads, answering questions about DeryCode services, pricing, and projects. Built with Node.js and OpenAI GPT, it automates customer engagement and lead generation. GitHub: github.com/asiimwe3/derycode-whatsapp-agent. Features: automated responses, natural conversation, service recommendations, pricing information, and project portfolio sharing.",
      sources: [
        { title: 'DeryCode WhatsApp Agent', url: 'https://github.com/asiimwe3/derycode-whatsapp-agent' },
        { title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' }
      ],
      followups: ['What other AI projects has DeryCode built?', 'How can I contact DeryCode?', 'What services does DeryCode offer?']
    };
  }

  // === DERYCOIN ===
  if (lower.includes('derycoin') || lower.includes('dery coin')) {
    return {
      answer: "DeryCoin is a custom ERC-20 token smart contract built by DeryCode Technologies using Solidity and Hardhat on the Ethereum blockchain. It features standard ERC-20 functionality including transfer, approve, and allowance operations. The contract is deployed and verified on the Ethereum testnet. GitHub: github.com/asiimwe3/derycoin. Tech stack: Solidity, Hardhat, Ethers.js, Ethereum. DeryCode also offers custom token and crypto development services from UGX 6,000,000.",
      sources: [
        { title: 'DeryCoin Repository', url: 'https://github.com/asiimwe3/derycoin' },
        { title: 'DeryCode Token Development', url: 'https://derycode.publicvm.com/token-crypto-development.html' }
      ],
      followups: ['What blockchain services does DeryCode offer?', 'How much does a smart contract cost?', 'What other projects has DeryCode built?']
    };
  }

  // === DERYLOAN ===
  if (lower.includes('deryloan') || lower.includes('dery loan') || lower.includes('micro lend') || lower.includes('microfinance')) {
    return {
      answer: "DeryLoan is a micro-lending platform with loan calculation and management features, built by DeryCode Technologies. It includes loan calculators, borrower management, repayment tracking, and Supabase backend integration. Deployed as a web app at asiimwe3.github.io/deryloan/. Tech stack: HTML, JavaScript, Supabase. Designed for microfinance institutions in Uganda. GitHub: github.com/asiimwe3/deryloan",
      sources: [
        { title: 'DeryLoan Live', url: 'https://asiimwe3.github.io/deryloan/' },
        { title: 'DeryLoan Repository', url: 'https://github.com/asiimwe3/deryloan' }
      ],
      followups: ['What fintech services does DeryCode offer?', 'What is Sacco Wallet?', 'How can I contact DeryCode?']
    };
  }

  // === TROPICAL GARDENS HOTEL ===
  if (lower.includes('tropical') || lower.includes('gardens') || lower.includes('hotel')) {
    return {
      answer: "Tropical Gardens Hotel is a luxury hotel in Kyenjojo, Uganda with 25 rooms across 4 categories: Standard (UGX 80,000), Deluxe (UGX 150,000), Executive (UGX 200,000), and Family Suite (UGX 280,000). The website was built by DeryCode Technologies as a Progressive Web App (PWA) with: custom booking system, Supabase backend, Google Maps integration, offline support, Western Union payment integration, verified 5-star Google reviews, and OTA listings on Booking.com, Agoda, and TripAdvisor. Live at tropicalgardenshotel.com. GitHub: github.com/asiimwe3/tropical-gardens-hotel. Tech: HTML/CSS/JS PWA, Node/Express backend, Supabase, Vercel + GitHub Pages.",
      sources: [
        { title: 'Tropical Gardens Hotel', url: 'https://tropicalgardenshotel.com' },
        { title: 'GitHub Repository', url: 'https://github.com/asiimwe3/tropical-gardens-hotel' }
      ],
      followups: ['What other projects has DeryCode built?', 'How much does a hotel website cost?', 'How can I contact DeryCode?']
    };
  }

  // === PETERS MEDICARE ===
  if (lower.includes('peters') || lower.includes('medicare') || lower.includes('hospital') || lower.includes('healthcare')) {
    return {
      answer: "Peters Medicare Services is a professional healthcare platform for a medical center in Kyenjojo, Uganda. Built by DeryCode Technologies, it features: multi-page site with services (general medicine, maternal health, lab, dental, eye care), online booking system, donation portal, blog, and admin panel. Deployed on GitHub Pages at asiimwe3.github.io/peters-medicare-services/. Tech stack: Next.js, TypeScript, Tailwind CSS. GitHub: github.com/asiimwe3/peters-medicare-services",
      sources: [
        { title: 'Peters Medicare Live', url: 'https://asiimwe3.github.io/peters-medicare-services/' },
        { title: 'GitHub Repository', url: 'https://github.com/asiimwe3/peters-medicare-services' }
      ],
      followups: ['What other projects has DeryCode built?', 'How much does a hospital website cost?', 'How can I contact DeryCode?']
    };
  }

  // === SAGECO EVERGREEN ===
  if (lower.includes('sageco') || lower.includes('evergreen') || lower.includes('real estate') || (lower.includes('property') && !lower.includes('masters'))) {
    return {
      answer: "Sageco Evergreen Company Limited is a real estate and property technology company led by CEO Asiimwe Derick (also Founder of DeryCode). The platform features: broker registration (UGX 32,000), dashboard activation (UGX 45,000), property listings with image galleries, PesaPal payment integration, mobile marketplace app with 5-tab bottom navigation, and a market page designed as a Jumia-inspired marketplace. Two apps exist: a Next.js web platform at sagecoevergreen.publicvm.com (github.com/asiimwe3/sageco-evergreen-app) using Supabase, and a React Native/Expo mobile app. Tech stack: Next.js, Supabase, PesaPal, React Native, Expo, TypeScript.",
      sources: [
        { title: 'Sageco Evergreen Web', url: 'https://sagecoevergreen.publicvm.com' },
        { title: 'GitHub Repository', url: 'https://github.com/asiimwe3/sageco-evergreen-app' }
      ],
      followups: ['Who is the founder of DeryCode?', 'What other projects has DeryCode built?', 'How can I contact DeryCode?']
    };
  }

  // === SACCO WALLET ===
  if (lower.includes('sacco') || lower.includes('sacco wallet')) {
    return {
      answer: "Sacco Wallet is a multi-vendor e-commerce and digital banking platform built by DeryCode Technologies. It supports Farmers, Traders, Vendors, and Stores with features: integrated side-drawer navigation, GPS-based field measurement tools, AI crop recommendation engine using real-time NASA satellite climate data, marketplace for agricultural goods, savings and credit cooperative management, and Firebase authentication. Tech stack: Next.js, TypeScript, Firebase. Live at asiimwe3.github.io/sacco-wallet/. GitHub: github.com/asiimwe3/sacco-wallet. Visual design: cream background (#FAF8F4) with dark forest green (#1a4731) accent, pill-shaped UI components.",
      sources: [
        { title: 'Sacco Wallet Live', url: 'https://asiimwe3.github.io/sacco-wallet/' },
        { title: 'GitHub Repository', url: 'https://github.com/asiimwe3/sacco-wallet' }
      ],
      followups: ['What is AgroLink Uganda?', 'What fintech services does DeryCode offer?', 'How can I contact DeryCode?']
    };
  }

  // === AGROLINK UGANDA ===
  if (lower.includes('agrolink') || lower.includes('agro link') || lower.includes('farmer')) {
    return {
      answer: "AgroLink Uganda is a native Flutter mobile application for farmers and SACCOs in Uganda, built by DeryCode Technologies. Features: marketplace for agricultural goods, weather tracking, savings groups, market prices, and farmer tools. Architecture: Clean Architecture, Material Design 3, Riverpod for state management, GoRouter for navigation. Backend: Supabase with a 22-table PostgreSQL schema including RLS policies for farming records, SACCO financial tracking, and marketplace operations. Targets native Android release APK generation. GitHub: github.com/asiimwe3/agrolink-uganda. Tech stack: Dart, Flutter, Supabase, Riverpod.",
      sources: [
        { title: 'AgroLink Uganda', url: 'https://github.com/asiimwe3/agrolink-uganda' },
        { title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' }
      ],
      followups: ['What is Sacco Wallet?', 'What mobile apps has DeryCode built?', 'How can I contact DeryCode?']
    };
  }

  // === PROPERTY MASTERS ===
  if (lower.includes('property masters') || lower.includes('property master')) {
    return {
      answer: "Property Masters is a native Android real estate application built by DeryCode Technologies in Kotlin with Jetpack Compose. Features: property listings with images, Firebase Auth for login, subscription-based access with Pesapal payment integration (UGX 30,000 transaction cap), service-role backend access pattern, UI-level gating for edit/delete actions based on ownership, and live Base44 entity management. The platform is fully commercial-ready. GitHub: github.com/asiimwe3/property-masters. Tech stack: Kotlin, Jetpack Compose, Firebase, Pesapal, Base44 backend.",
      sources: [
        { title: 'Property Masters', url: 'https://github.com/asiimwe3/property-masters' },
        { title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' }
      ],
      followups: ['What other mobile apps has DeryCode built?', 'What is Sageco Evergreen?', 'How can I contact DeryCode?']
    };
  }

  // === TOORO MUSIC ===
  if (lower.includes('tooro') || lower.includes('music app') || lower.includes('music stream')) {
    return {
      answer: "Tooro Music is a React Native/Expo music streaming app for Tooro Kingdom artists in Uganda, built by DeryCode Technologies. Features: playlists, audio player, artist profiles, and music discovery. Live at tooro-music.vercel.app. GitHub: github.com/asiimwe3/tooro-music. Tech stack: TypeScript, React Native, Expo, Vercel. Showcases local Tooro Kingdom artists and their music.",
      sources: [
        { title: 'Tooro Music Live', url: 'https://tooro-music.vercel.app' },
        { title: 'GitHub Repository', url: 'https://github.com/asiimwe3/tooro-music' }
      ],
      followups: ['What other mobile apps has DeryCode built?', 'What projects has DeryCode built?', 'How can I contact DeryCode?']
    };
  }

  // === ELITE COMMUNITY ===
  if (lower.includes('elite community') || (lower.includes('elite') && lower.includes('community'))) {
    return {
      answer: "Elite Community is an AI-powered community platform built by DeryCode Technologies with analytics, member engagement, and content management features. Built with Vite + React + TypeScript. Live at asiimwe3.github.io/Elite-community-. GitHub: github.com/asiimwe3/Elite-community-. Features: AI-powered analytics, member profiles, engagement tracking, and content management tools.",
      sources: [
        { title: 'Elite Community Live', url: 'https://asiimwe3.github.io/Elite-community-/' },
        { title: 'GitHub Repository', url: 'https://github.com/asiimwe3/Elite-community-' }
      ],
      followups: ['What is Elite Members?', 'What other projects has DeryCode built?', 'How can I contact DeryCode?']
    };
  }

  // === ELITE MEMBERS ===
  if (lower.includes('elite members') || (lower.includes('elite') && (lower.includes('member') || lower.includes('membership')))) {
    return {
      answer: "Elite Members is an exclusive membership management platform built by DeryCode Technologies with tier-based benefits and member directory. Multiple versions exist: v1 (HTML/JS) at asiimwe3.github.io/elite-members, and v2 (HTML dashboard) at elite-members-six.vercel.app. Features: tier-based benefits, member directory, dashboard analytics. GitHub: github.com/asiimwe3/elite-members and github.com/asiimwe3/elite-members-v2. Tech stack: HTML, JavaScript, Vercel.",
      sources: [
        { title: 'Elite Members Live', url: 'https://asiimwe3.github.io/elite-members' },
        { title: 'Elite Members v2', url: 'https://elite-members-six.vercel.app' }
      ],
      followups: ['What is Elite Community?', 'What other projects has DeryCode built?', 'How can I contact DeryCode?']
    };
  }

  // === ELITE (general) ===
  if (lower.includes('elite')) {
    return {
      answer: "DeryCode Technologies has built multiple Elite platform projects: 1) Elite — community engagement platform with member profiles, events, and communication tools (github.com/asiimwe3/elite) 2) Elite Community — AI-powered community platform with analytics, member engagement, and content management, built with Vite + React (github.com/asiimwe3/Elite-community-) 3) Elite Members — exclusive membership management with tier-based benefits and member directory (github.com/asiimwe3/elite-members and github.com/asiimwe3/elite-members-v2). All live on GitHub Pages and Vercel.",
      sources: [
        { title: 'Elite Community', url: 'https://asiimwe3.github.io/Elite-community-/' },
        { title: 'Elite Members', url: 'https://asiimwe3.github.io/elite-members' }
      ],
      followups: ['What other projects has DeryCode built?', 'How can I contact DeryCode?', 'What services does DeryCode offer?']
    };
  }

  // === ADCON ===
  if (lower.includes('adcon') || lower.includes('ad con') || lower.includes('advertising') || lower.includes('marketing platform')) {
    return {
      answer: "AdCon is an advertising and marketing platform built by DeryCode Technologies for campaign management and analytics. Features: campaign creation, performance analytics, and marketing management tools. GitHub: github.com/asiimwe3/Adcon-. Topics: advertising, analytics, campaigns, marketing.",
      sources: [
        { title: 'AdCon Repository', url: 'https://github.com/asiimwe3/Adcon-' },
        { title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' }
      ],
      followups: ['What other projects has DeryCode built?', 'What digital marketing services does DeryCode offer?', 'How can I contact DeryCode?']
    };
  }

  // === SCHOOL MANAGEMENT SYSTEM ===
  if (lower.includes('school management') || (lower.includes('school') && lower.includes('system'))) {
    return {
      answer: "DeryCode Technologies has built multiple school/education platforms: 1) School Management System — comprehensive school administration platform for student enrollment, staff management, and academic tracking (github.com/asiimwe3/school-management-system) 2) School Report System — automated report card generation and student performance analytics, built with Vite + React (github.com/asiimwe3/school-report-system, live at asiimwe3.github.io/school-report-system/) 3) School Sync Manager — school admin panel with monorepo architecture (github.com/asiimwe3/school-sync-manager). Tech stack: TypeScript, React, Vite.",
      sources: [
        { title: 'School Management System', url: 'https://github.com/asiimwe3/school-management-system' },
        { title: 'School Report System', url: 'https://asiimwe3.github.io/school-report-system/' }
      ],
      followups: ['What education services does DeryCode offer?', 'What other projects has DeryCode built?', 'How can I contact DeryCode?']
    };
  }

  // === WORLDTECH YOUTH FOUNDATION ===
  if (lower.includes('worldtech') || lower.includes('youth foundation') || lower.includes('nonprofit') || lower.includes('charity')) {
    return {
      answer: "WorldTech Youth Foundation is a nonprofit organization website built by DeryCode Technologies to bring technology education to youth in Kyenjojo and across Uganda. Features: charity donation portal, youth tech education programs, community outreach. Built with React + TypeScript + Vite. Live at asiimwe3.github.io/worldtech-youth-foundation/. GitHub: github.com/asiimwe3/worldtech-youth-foundation. Tech stack: TypeScript, React, Vite, GitHub Pages.",
      sources: [
        { title: 'WorldTech Youth Foundation', url: 'https://asiimwe3.github.io/worldtech-youth-foundation/' },
        { title: 'GitHub Repository', url: 'https://github.com/asiimwe3/worldtech-youth-foundation' }
      ],
      followups: ['What training programs does DeryCode offer?', 'What other projects has DeryCode built?', 'How can I contact DeryCode?']
    };
  }

  // === DERICK AI PORTFOLIO ===
  if (lower.includes('portfolio') || lower.includes('derick ai')) {
    return {
      answer: "Derick AI Portfolio is a personal portfolio website for Asiimwe Derick, showcasing projects, skills, and AI-powered interactive features. Built with static HTML/CSS/JS. Live at asiimwe3.github.io/derick-ai-portfolio. GitHub: github.com/asiimwe3/derick-ai-portfolio. Features: project gallery, skills showcase, AI-powered interactive elements, and responsive design.",
      sources: [
        { title: 'Derick AI Portfolio', url: 'https://asiimwe3.github.io/derick-ai-portfolio' },
        { title: 'GitHub Repository', url: 'https://github.com/asiimwe3/derick-ai-portfolio' }
      ],
      followups: ['Who is Asiimwe Derick?', 'What projects has DeryCode built?', 'How can I contact DeryCode?']
    };
  }

  // === ALL PROJECTS / PORTFOLIO ===
  if (lower.includes('project') || lower.includes('portfolio') || lower.includes('work') || lower.includes('client') || lower.includes('case study') || lower.includes('built') || lower.includes('all')) {
    return {
      answer: "DeryCode Technologies has built 20+ projects across Uganda and East Africa. Full project portfolio:\n\n1. DeryCode Search — AI-powered search engine in pure C (derycode-search-c.vercel.app)\n2. DeryCode Website — PWA company website (derycode.publicvm.com)\n3. DeryCode WhatsApp Agent — AI chatbot named Derick\n4. DeryCoin — ERC-20 token smart contract on Ethereum\n5. DeryLoan — Micro-lending platform with Supabase\n6. Tropical Gardens Hotel — 25-room hotel PWA with booking (tropicalgardenshotel.com)\n7. Peters Medicare Services — Healthcare platform (asiimwe3.github.io/peters-medicare-services)\n8. Sageco Evergreen — Real estate platform (sagecoevergreen.publicvm.com)\n9. Sageco Evergreen App — React Native mobile app\n10. Sacco Wallet — Multi-vendor e-commerce + SACCO banking\n11. AgroLink Uganda — Flutter farmer & SACCO super app\n12. Property Masters — Android/Kotlin real estate app with Pesapal\n13. Tooro Music — React Native music streaming app (tooro-music.vercel.app)\n14. Elite Community — AI-powered community platform\n15. Elite Members — Membership management with tier benefits\n16. AdCon — Advertising and marketing platform\n17. School Management System — School administration platform\n18. School Report System — Report card generation (asiimwe3.github.io/school-report-system)\n19. School Sync Manager — School admin panel\n20. WorldTech Youth Foundation — Nonprofit for youth tech education\n21. Derick AI Portfolio — Personal portfolio website\n\nIndustries: finance, healthcare, education, real estate, agriculture, hospitality, music, blockchain. Contact: info@derycode.com | WhatsApp: +256 772 002 326",
      sources: [
        { title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' },
        { title: 'GitHub Profile', url: 'https://github.com/asiimwe3' }
      ],
      followups: ['What services does DeryCode offer?', 'How much does a website cost?', 'How can I contact DeryCode?']
    };
  }

  // === TRAINING ===
  if (lower.includes('training') || lower.includes('workshop') || lower.includes('learn') || lower.includes('teach') || lower.includes('course') || lower.includes('community')) {
    return {
      answer: "DeryCode Technologies offers professional training and workshops: 1) Live Coding Camps — hands-on programming workshops 2) Web Development Training — HTML, CSS, JavaScript, React, Next.js 3) Mobile App Development — Android, Flutter, React Native 4) Blockchain & Web3 Training 5) Digital Marketing Workshops. DeryCode also runs community outreach through the WorldTech Youth Foundation, bringing technology education to youth in Kyenjojo and across Uganda. Book a training session: info@derycode.com or WhatsApp +256 772 002 326",
      sources: [{ title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' }],
      followups: ['How can I book a training session?', 'What services does DeryCode offer?', 'Who is the founder?']
    };
  }

  // === PARTNER ===
  if (lower.includes('partner') || lower.includes('affiliate') || lower.includes('commission') || lower.includes('referral')) {
    return {
      answer: "DeryCode Partner Network allows non-technical individuals to earn commissions by referring business and education clients to DeryCode. The 4-step process: 1) Refer a client 2) Client signs up 3) Project completes 4) You earn commission. Partners earn commissions on successful referrals without needing technical skills. Join at derycode.publicvm.com or WhatsApp +256 772 002 326",
      sources: [{ title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' }],
      followups: ['What services does DeryCode offer?', 'How can I contact DeryCode?', 'How much does a website cost?']
    };
  }

  // === GENERAL DERYCODE INFO (fallback) ===
  return {
    answer: "DeryCode Technologies is Uganda's leading software development company, founded in 2021 by Asiimwe Derick. Based in Kampala, Uganda, DeryCode has built 20+ projects including: DeryCode Search (AI search engine in C), DeryCoin (ERC-20 token), Tropical Gardens Hotel (25-room hotel PWA), Peters Medicare (healthcare platform), Sageco Evergreen (real estate), Sacco Wallet (fintech), AgroLink Uganda (Flutter farmer app), Property Masters (Android real estate), Tooro Music (music streaming), Elite Community (AI platform), School Management Systems, and WorldTech Youth Foundation. Services: Website Development, Mobile Apps, Banking/SACCO Software, ERP Systems, Blockchain & Smart Contracts, AI & Automation, Digital Marketing, UI/UX Design, and ICT Consultancy. Contact: info@derycode.com | WhatsApp: +256 772 002 326 / +256 762 306 675 | Website: derycode.publicvm.com | GitHub: github.com/asiimwe3",
    sources: [
      { title: 'DeryCode Technologies', url: 'https://derycode.publicvm.com' },
      { title: 'GitHub Profile', url: 'https://github.com/asiimwe3' }
    ],
    followups: ['What services does DeryCode offer?', 'How much does a website cost?', 'What projects has DeryCode built?']
  };
}
