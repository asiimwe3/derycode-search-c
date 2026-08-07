export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    engine: 'DeryCode AI',
    version: '2.0',
    modes: ['AI', 'Web', 'Images', 'News', 'Code', 'Videos'],
    pwa: true,
    startpageConnected: true,
    webScraping: true,
    languages: ['en', 'sw', 'lg', 'rn', 'luo', 'te'],
    message: 'All systems operational - Web search active'
  });
}
