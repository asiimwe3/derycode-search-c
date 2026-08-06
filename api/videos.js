// DeryCode Video Search API - Vercel Serverless
const MAX_QUERY_WORDS = 30;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.trim().length === 0) return res.status(400).json({ error: 'Query is required' });
  
  const words = q.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) return res.status(400).json({ error: `Query too long. Max ${MAX_QUERY_WORDS} words.` });
  
  const startTime = Date.now();
  const videos = [];
  
  try {
    // YouTube search via HTML parsing (no API key needed)
    try {
      const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      const r = await fetch(ytUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      const html = await r.text();
      
      // Extract video data from YouTube's embedded JSON
      const scriptMatches = html.match(/var ytInitialData = ({.*?});<\/script>/s);
      if (scriptMatches) {
        const data = JSON.parse(scriptMatches[1]);
        const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
        
        for (const item of contents) {
          const v = item.videoRenderer;
          if (v) {
            videos.push({
              title: v.title?.runs?.[0]?.text || v.title?.simpleText || '',
              videoId: v.videoId,
              url: `https://www.youtube.com/watch?v=${v.videoId}`,
              thumbnail: v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url || '',
              duration: v.lengthText?.simpleText || '',
              views: v.viewCountText?.simpleText || v.viewCountText?.runs?.map(r => r.text).join('') || '',
              channel: v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || '',
              channelUrl: v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl 
                ? `https://www.youtube.com${v.ownerText.runs[0].navigationEndpoint.browseEndpoint.canonicalBaseUrl}` 
                : '',
              published: v.publishedTimeText?.simpleText || '',
              engine: 'youtube'
            });
          }
        }
      }
    } catch (e) {}
    
    // Fallback: DuckDuckGo Video Search
    if (videos.length === 0) {
      try {
        const ddgUrl = `https://duckduckgo.com/?q=${encodeURIComponent(q)}&ia=videos&iar=videos`;
        const r = await fetch(ddgUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await r.text();
        
        const vqdMatch = html.match(/vqd=['"](\d+(?:-\d+)?)/);
        if (vqdMatch) {
          const vqd = vqdMatch[1];
          const vidUrl = `https://duckduckgo.com/v.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,,&p=1&s=0&sk=0&a=0`;
          
          try {
            const vidRes = await fetch(vidUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            const vidData = await vidRes.json();
            
            if (vidData.results) {
              for (const item of vidData.results.slice(0, 15)) {
                videos.push({
                  title: (item.title || q).substring(0, 200),
                  videoId: '',
                  url: item.content || item.url || '',
                  thumbnail: item.thumbnail || item.image || '',
                  duration: item.duration || '',
                  views: '',
                  channel: item.uploader || '',
                  channelUrl: '',
                  published: item.publishedOn || '',
                  engine: 'duckduckgo'
                });
              }
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
    
    // Last resort: Wikipedia related images as video placeholders
    if (videos.length === 0) {
      try {
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(q + ' video')}&srlimit=5`;
        const wikiRes = await fetch(wikiUrl, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' } });
        const wikiData = await wikiRes.json();
        const results = wikiData?.query?.search || [];
        for (const item of results.slice(0, 5)) {
          videos.push({
            title: item.title,
            videoId: '',
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
            thumbnail: '',
            duration: '',
            views: '',
            channel: 'Wikipedia',
            channelUrl: '',
            published: '',
            engine: 'wikipedia'
          });
        }
      } catch (e) {}
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    res.status(200).json({
      query: q,
      count: videos.length,
      time: elapsed,
      videos: videos.slice(0, 20),
      limits: { maxQueryWords: MAX_QUERY_WORDS }
    });
  } catch (error) {
    res.status(500).json({ error: 'Video search failed', query: q, count: 0, videos: [] });
  }
}
