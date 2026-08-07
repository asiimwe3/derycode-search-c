export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    engine: 'DeryCode AI',
    version: '2.0',
    modes: ['AI', 'Web', 'Images', 'News', 'Code', 'Videos'],
    pwa: true,
    geminiConnected: !!process.env.GEMINI_API_KEY,
    webScraping: true,
    languages: ['en', 'sw', 'lg', 'rn', 'luo', 'te'],
    message: process.env.GEMINI_API_KEY 
      ? 'All systems operational - Gemini AI connected' 
      : 'Add GEMINI_API_KEY env var to enable live AI responses'
  });
}
