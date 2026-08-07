/* DeryCode Tech Knowledge Base - Built-in responses */
#ifndef DC_KNOWLEDGE_H
#define DC_KNOWLEDGE_H

#include <ctype.h>

/* Check if query is about DeryCode or Asiimwe Derick */
static int is_derycode_query(const char *query) {
    const char *keywords[] = {
        "derycode", "dery code", "asiimwe derick", "derick asiimwe",
        "traderderick", "sageco evergreen", "asiimwe", NULL
    };
    
    char lower[1024];
    int i;
    for (i = 0; query[i] && i < 1023; i++) {
        lower[i] = tolower(query[i]);
    }
    lower[i] = 0;
    
    for (i = 0; keywords[i]; i++) {
        if (strstr(lower, keywords[i])) return 1;
    }
    return 0;
}

/* Get specific DeryCode knowledge based on query */
static const char *get_derycode_knowledge(const char *query) {
    char lower[1024];
    int i;
    for (i = 0; query[i] && i < 1023; i++) lower[i] = tolower(query[i]);
    lower[i] = 0;
    
    /* About Asiimwe Derick / founder */
    if (strstr(lower, "asiimwe") || strstr(lower, "derick") || strstr(lower, "founder") || strstr(lower, "ceo") || strstr(lower, "who")) {
        return "Asiimwe Derick (also known as Derick Asiimwe or TraderDerick) is the Founder & CEO of DeryCode Technologies and CEO of Sageco Evergreen Company Limited. "
               "He founded DeryCode in 2021 to prove that world-class software, blockchain, and AI solutions can be built right here in Uganda — for clients across Africa and beyond. "
               "With hands-on experience across full-stack web development, mobile apps, fintech/SACCO platforms, and Web3, Derick leads every DeryCode project personally — from architecture to deployment. "
               "He is recognized as one of Uganda's top software engineers and blockchain developers. "
               "As CEO of Sageco Evergreen Company Limited, he also leads innovative real estate and property technology solutions across Uganda. "
               "Connect with him on WhatsApp: +256 772 002 326, GitHub: github.com/asiimwe3, or LinkedIn: ug.linkedin.com/in/asiimwe-derick-501755313";
    }
    
    /* About services */
    if (strstr(lower, "service") || strstr(lower, "offer") || strstr(lower, "what does") || strstr(lower, "what do")) {
        return "DeryCode Technologies offers: \n"
               "1. Business Website Development (from UGX 750,000)\n"
               "2. Web Applications & SaaS Platforms\n"
               "3. Mobile Apps (iOS & Android, from UGX 4,400,000)\n"
               "4. Banking & SACCO Software (with MTN MoMo, Airtel Money integration)\n"
               "5. Business Management & ERP Systems\n"
               "6. School Digital Libraries & LMS\n"
               "7. Smart Contracts & Blockchain Development\n"
               "8. AI & Automation Solutions\n"
               "9. Digital & Traditional Marketing (SEO, Social Media)\n"
               "10. UI/UX Design & Branding\n"
               "11. API & Payment Integrations (Pesapal, Flutterwave, Stripe, PayPal)\n"
               "12. Token & Crypto Development\n"
               "13. ICT Consultancy\n"
               "Contact: info@derycode.com or WhatsApp +256 772 002 326";
    }
    
    /* About pricing */
    if (strstr(lower, "price") || strstr(lower, "cost") || strstr(lower, "how much") || strstr(lower, "fees") || strstr(lower, "charge")) {
        return "DeryCode Technologies Pricing:\n"
               "Business Websites: from UGX 750,000\n"
               "E-commerce Sites: from UGX 2,500,000\n"
               "Mobile Apps (iOS/Android): from UGX 4,400,000\n"
               "Banking & SACCO Software: from UGX 3,500,000\n"
               "Business Management/ERP: from UGX 1,500,000\n"
               "Smart Contracts & Blockchain: from UGX 6,000,000\n"
               "AI & Automation: from UGX 1,500,000\n"
               "UI/UX Design & Branding: from UGX 1,200,000\n"
               "API & Payment Integration: from UGX 1,800,000\n"
               "Token & Crypto Development: from UGX 6,000,000\n"
               "School Digital Libraries: custom pricing\n"
               "Contact for a free quote: info@derycode.com or WhatsApp +256 772 002 326";
    }
    
    /* About location */
    if (strstr(lower, "where") || strstr(lower, "location") || strstr(lower, "address") || strstr(lower, "based") || strstr(lower, "office")) {
        return "DeryCode Technologies is headquartered in Kampala, Uganda, and serves clients across the entire country including Kyenjojo, Fort Portal, Mbarara, Jinja, Gulu, and globally. "
               "Email: info@derycode.com | WhatsApp: +256 772 002 326 | Website: derycode.com";
    }
    
    /* About projects / portfolio */
    if (strstr(lower, "project") || strstr(lower, "portfolio") || strstr(lower, "work") || strstr(lower, "client") || strstr(lower, "case study")) {
        return "DeryCode Technologies has delivered 100+ projects across Uganda and East Africa. Notable projects:\n"
               "1. SAGECO Evergreen — Real estate & property technology platform with broker registration, property listings, and PesaPal payments\n"
               "2. St. Peters Medical Center — Hospital website for Kyenjojo with appointment scheduling\n"
               "3. Tropical Gardens Hotel — Hotel website with booking, gallery, and PesaPal integration\n"
               "4. WorldTech Youth Foundation — Nonprofit website for youth tech education in Kyenjojo\n"
               "5. DeryCoin — Custom blockchain token and crypto platform\n"
               "6. SaccoWallet — SACCO management software with mobile money integration\n"
               "7. Property Masters — Real estate mobile app with Firebase auth and auto-updates\n"
               "8. DeryCode Search — AI-powered search engine built in pure C\n"
               "Industries served: finance, healthcare, education, real estate, agriculture, hospitality, and more.";
    }
    
    /* About training */
    if (strstr(lower, "training") || strstr(lower, "workshop") || strstr(lower, "learn") || strstr(lower, "teach") || strstr(lower, "course") || strstr(lower, "community")) {
        return "DeryCode Technologies offers professional training and workshops including:\n"
               "1. Live Coding Camps — hands-on programming workshops\n"
               "2. Web Development Training — HTML, CSS, JavaScript, React, Next.js\n"
               "3. Mobile App Development — Android, Flutter, React Native\n"
               "4. Blockchain & Web3 Training\n"
               "5. Digital Marketing Workshops\n"
               "DeryCode also runs community outreach programs through the WorldTech Youth Foundation, bringing technology education to youth in Kyenjojo and across Uganda. "
               "Book a training session: info@derycode.com or WhatsApp +256 772 002 326";
    }
    
    /* About partners */
    if (strstr(lower, "partner") || strstr(lower, "affiliate") || strstr(lower, "commission") || strstr(lower, "referral")) {
        return "DeryCode Partner Network allows non-technical individuals to earn commissions by referring business and education clients to DeryCode. "
               "The 4-step referral process: 1) Refer a client 2) Client signs up 3) Project completes 4) You earn commission. "
               "Partners earn commissions on successful referrals without needing technical skills. "
               "Join the partner network at derycode.com/partners or WhatsApp +256 772 002 326";
    }
    
    /* About Sageco Evergreen */
    if (strstr(lower, "sageco") || strstr(lower, "real estate") || strstr(lower, "property")) {
        return "Sageco Evergreen Company Limited is a real estate and property technology company led by CEO Asiimwe Derick (also Founder of DeryCode). "
               "The Sageco Evergreen platform features broker registration (UGX 32,000), dashboard activation (UGX 45,000), property listings with image galleries, "
               "PesaPal payment integration, and a mobile marketplace app with 5-tab bottom navigation. "
               "It is live at sagecoevergreen.publicvm.com with an Android app available via auto-update from GitHub releases.";
    }
    
    /* General about DeryCode */
    return "DeryCode Technologies is Uganda's leading software development company, founded in 2021 by Asiimwe Derick. "
           "Based in Kampala, Uganda, DeryCode has delivered 100+ projects for clients across Uganda and East Africa. "
           "Services include: Website Development, Mobile Apps, Banking/SACCO Software, ERP Systems, Blockchain & Smart Contracts, "
           "AI & Automation, Digital Marketing, UI/UX Design, and ICT Consultancy. "
           "DeryCode's mission is to make world-class software accessible to every Ugandan business — from small startups to large enterprises. "
           "Contact: info@derycode.com | WhatsApp: +256 772 002 326 | Website: derycode.com | GitHub: github.com/asiimwe3";
}

/* Get DeryCode source info */
static void add_derycode_sources(AiResponse *resp) {
    snprintf(resp->sources, 2047, "DeryCode Technologies Official (https://derycode.com), DeryCode Partners (https://derycode.com/partners)");
}

#endif
