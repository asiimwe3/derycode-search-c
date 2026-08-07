// DeryCode Books Search API - Vercel Serverless
const MAX_QUERY_WORDS = 500;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.trim().length === 0) return res.status(400).json({ error: 'Query is required' });
  
  const words = q.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) return res.status(400).json({ error: `Query too long. Max ${MAX_QUERY_WORDS} words.` });
  
  const books = [];
  
  try {
    // Google Books
    try {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=15&printType=books&projection=full`;
      const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(10000) });
      const data = await r.json();
      for (const item of (data?.items || [])) {
        const vol = item.volumeInfo || {};
        const authors = (vol.authors || ['Unknown']).join(', ');
        books.push({
          title: vol.title || '',
          author: authors,
          description: vol.description || 'No description available.',
          year: vol.publishedDate || '',
          publisher: vol.publisher || '',
          source: 'Google Books'
        });
      }
    } catch (e) {}
    
    // Project Gutenberg
    try {
      const url = `https://gutendex.com/books?search=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(10000) });
      const data = await r.json();
      for (const book of (data?.results || []).slice(0, 10)) {
        const authors = (book.authors || [{name:'Unknown'}]).map(a => a.name).join(', ');
        const subjects = (book.subjects || []).join(', ');
        books.push({
          title: book.title || '',
          author: authors,
          description: `Free public domain book. ${subjects}`,
          source: 'Project Gutenberg'
        });
      }
    } catch (e) {}
    
    // Open Library
    try {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=title,author_name,first_publish_year,subject`;
      const r = await fetch(url, { headers: { 'User-Agent': 'DeryCodeSearch/1.0' }, signal: AbortSignal.timeout(10000) });
      const data = await r.json();
      for (const doc of (data?.docs || []).slice(0, 10)) {
        const authors = (doc.author_name || ['Unknown']).join(', ');
        books.push({
          title: doc.title || '',
          author: authors,
          description: `Book by ${authors}${doc.first_publish_year ? ' (first published ' + doc.first_publish_year + ')' : ''}`,
          year: doc.first_publish_year ? String(doc.first_publish_year) : '',
          source: 'Open Library'
        });
      }
    } catch (e) {}
    
    res.status(200).json({ query: q, book_count: books.length, books });
  } catch (e) {
    res.status(200).json({ query: q, book_count: 0, books: [], error: e.message });
  }
}
