export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.length < 2) return res.status(200).json([]);
  
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`;
    const r = await fetch(url);
    const data = await r.json();
    const suggestions = (data[1] || []).slice(0, 6);
    res.status(200).json(suggestions);
  } catch {
    res.status(200).json([]);
  }
}
