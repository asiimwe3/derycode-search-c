export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    engine: 'DeryCode AI',
    version: '2.0',
    modes: ['AI', 'Web', 'Images', 'News', 'Code', 'Derick', 'Books', 'Maps', 'Deep', 'Videos'],
    sources: 22,
    maxResults: 512,
    maxQueryWords: 500,
    maxAnswerWords: 5000,
    pwa: true,
    features: ['Google Books', 'Google News', 'Google Scholar', 'PubMed', 'Project Gutenberg', 'DeryMap', 'Deep Web Search', 'Dark Web (.onion) Index', 'Wikidata', 'CORE Research', 'World Bank Data', 'CrossRef DOIs', 'Deep Content Extraction', 'Book Summarization'],
    languages: ['en', 'sw', 'lg', 'rn', 'luo', 'te'],
    message: 'All systems operational - 16 sources active'
  });
}
