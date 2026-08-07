// DeryCode Web Scraping API - Vercel Serverless
// Extracts clean text content from any URL

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const url = req.query.url || req.body?.url || '';
  if (!url) return res.status(400).json({ error: 'URL is required' });
  
  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  
  try {
    const r = await fetch(targetUrl.href, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });
    
    const html = await r.text();
    const contentType = r.headers.get('content-type') || '';
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : targetUrl.hostname;
    
    // Extract meta description
    const descMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/is);
    const description = descMatch ? descMatch[1].trim() : '';
    
    // Extract meta keywords
    const keywordsMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)/is);
    const keywords = keywordsMatch ? keywordsMatch[1].trim() : '';
    
    // Extract Open Graph image
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/is);
    const ogImage = ogImageMatch ? ogImageMatch[1].trim() : '';
    
    // Extract og:site_name
    const siteNameMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/is);
    const siteName = siteNameMatch ? siteNameMatch[1].trim() : targetUrl.hostname.replace('www.', '');
    
    // Extract clean text content
    // Remove scripts, styles, nav, footer, header, aside
    let cleanHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');
    
    // Extract main content - try article, main, or body
    let mainContent = '';
    const articleMatch = cleanHtml.match(/<article[\s\S]*?<\/article>/i);
    const mainMatch = cleanHtml.match(/<main[\s\S]*?<\/main>/i);
    
    if (articleMatch) {
      mainContent = articleMatch[0];
    } else if (mainMatch) {
      mainContent = mainMatch[0];
    } else {
      // Use body content
      const bodyMatch = cleanHtml.match(/<body[\s\S]*?<\/body>/i);
      mainContent = bodyMatch ? bodyMatch[0] : cleanHtml;
    }
    
    // Convert to text
    let text = mainContent
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<br[^>]*>/gi, '\n')
      .replace(/<h[1-6][^>]*>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&[a-z]+;/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/ {2,}/g, ' ')
      .trim();
    
    // Extract headings for structure
    const headings = [];
    const hRegex = /<h([1-3])[^>]*>(.*?)<\/h\1>/gis;
    let hm;
    while ((hm = hRegex.exec(cleanHtml)) !== null) {
      const hText = hm[2].replace(/<[^>]+>/g, '').trim();
      if (hText.length > 2 && hText.length < 200) {
        headings.push({ level: parseInt(hm[1]), text: hText });
      }
    }
    
    // Extract links
    const links = [];
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
    let lm;
    let linkCount = 0;
    while ((lm = linkRegex.exec(cleanHtml)) !== null && linkCount < 10) {
      let href = lm[1];
      if (href.startsWith('/')) href = targetUrl.origin + href;
      if (href.startsWith('http') && !href.includes(targetUrl.hostname)) {
        const linkText = lm[2].replace(/<[^>]+>/g, '').trim();
        if (linkText.length > 3 && linkText.length < 100) {
          links.push({ text: linkText, url: href });
          linkCount++;
        }
      }
    }
    
    // Truncate text
    const maxChars = 3000;
    const truncatedText = text.length > maxChars ? text.substring(0, maxChars) + '...' : text;
    
    // Count words
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    
    res.status(200).json({
      url: targetUrl.href,
      title,
      description,
      keywords,
      siteName,
      ogImage,
      content: truncatedText,
      wordCount,
      headings: headings.slice(0, 15),
      links: links.slice(0, 8),
      scraped: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to scrape URL', 
      url: targetUrl?.href || url,
      message: error.message 
    });
  }
}
