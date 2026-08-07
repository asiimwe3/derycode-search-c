// DeryCode Maps API - Vercel Serverless
// Uses OpenStreetMap Nominatim (free) for geocoding + Google Maps embed for display

const MAX_QUERY_WORDS = 500;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query.q || '';
  if (!q || q.trim().length === 0) return res.status(400).json({ error: 'Query is required' });
  
  const words = q.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (words > MAX_QUERY_WORDS) return res.status(400).json({ error: `Query too long. Max ${MAX_QUERY_WORDS} words.` });
  
  const places = [];
  
  try {
    // Method 1: OpenStreetMap Nominatim (free geocoding)
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=10&addressdetails=1&extratags=1`;
      const r = await fetch(nomUrl, { 
        headers: { 'User-Agent': 'DeryCodeSearch/1.0 (info@derycode.com)' }, 
        signal: AbortSignal.timeout(10000) 
      });
      const data = await r.json();
      
      for (const item of (data || [])) {
        const addr = item.address || {};
        const displayName = item.display_name || '';
        const parts = displayName.split(',').map(p => p.trim());
        
        places.push({
          name: parts[0] || addr.name || q,
          full_address: displayName,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          type: item.type || addr.type || 'place',
          category: item.category || 'location',
          country: addr.country || '',
          city: addr.city || addr.town || addr.village || addr.county || '',
          state: addr.state || '',
          road: addr.road || addr.pedestrian || '',
          postcode: addr.postcode || '',
          importance: item.importance || 0,
          osm_id: item.osm_id,
          osm_type: item.osm_type,
          // Google Maps links (same pattern used in Tropical Gardens Hotel)
          gmaps_link: `https://maps.google.com/?q=${encodeURIComponent(displayName)}`,
          gmaps_directions: `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lon}`,
          // OpenStreetMap embed
          osm_embed: `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(item.lon)-0.01}%2C${parseFloat(item.lat)-0.01}%2C${parseFloat(item.lon)+0.01}%2C${parseFloat(item.lat)+0.01}&layer=mapnik&marker=${item.lat}%2C${item.lon}`,
          osm_link: `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lon}#map=16/${item.lat}/${item.lon}`
        });
      }
    } catch (e) {}
    
    // Method 2: Google Maps search link as fallback
    if (places.length === 0) {
      places.push({
        name: q,
        full_address: '',
        lat: null,
        lon: null,
        gmaps_link: `https://maps.google.com/?q=${encodeURIComponent(q)}`,
        gmaps_directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`,
        osm_embed: `https://www.openstreetmap.org/export/embed.html?bbox=0%2C0%2C0%2C0&layer=mapnik&marker=0%2C0`,
        osm_link: `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`,
        note: 'No detailed results found. Click Google Maps link to search.'
      });
    }
    
    // Sort by importance
    places.sort((a, b) => (b.importance || 0) - (a.importance || 0));
    
    res.status(200).json({
      query: q,
      place_count: places.length,
      places,
      gmaps_search: `https://maps.google.com/?q=${encodeURIComponent(q)}`,
      osm_search: `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`
    });
  } catch (e) {
    res.status(200).json({
      query: q,
      place_count: 0,
      places: [],
      gmaps_search: `https://maps.google.com/?q=${encodeURIComponent(q)}`,
      error: e.message
    });
  }
}
