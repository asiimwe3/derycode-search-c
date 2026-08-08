// DeryCode Weather API - Instant weather quick-answer
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Location required' });
  
  // Extract location from query like "weather in Kampala" or just "Kampala"
  let location = q.toLowerCase()
    .replace(/what.?s?\s+the\s+weather\s+(in|at|for)?\s*/i, '')
    .replace(/weather\s+(in|at|for)\s*/i, '')
    .replace(/\?/g, '')
    .replace(/weather/gi, '')
    .trim();
  
  if (!location) location = q.replace(/weather/gi, '').trim() || q;
  
  try {
    // Use wttr.in - free weather API, no key needed
    const wttrUrl = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;
    const response = await fetch(wttrUrl, {
      headers: { 'User-Agent': 'curl/7.68.0' }
    });
    
    if (!response.ok) throw new Error('Weather fetch failed');
    const data = await response.json();
    
    const current = data.current_condition && data.current_condition[0];
    if (!current) throw new Error('No current weather data');
    
    const area = data.nearest_area && data.nearest_area[0];
    const areaName = area ? area.areaName[0].value : location;
    const country = area ? area.country[0].value : '';
    const region = area ? area.region[0].value : '';
    
    // Parse today's forecast
    const today = data.weather && data.weather[0];
    const forecast = [];
    if (data.weather) {
      data.weather.slice(0, 3).forEach(function(day) {
        forecast.push({
          date: day.date,
          maxTemp: day.maxtempC + '°C',
          minTemp: day.mintempC + '°C',
          avgTemp: day.avgtempC + '°C',
          desc: day.hourly && day.hourly[4] ? day.hourly[4].weatherDesc[0].value : '',
          chanceRain: day.hourly && day.hourly[4] ? day.hourly[4].chanceofrain + '%' : ''
        });
      });
    }
    
    res.status(200).json({
      location: areaName,
      region: region,
      country: country,
      temp: current.temp_C + '°C',
      feelsLike: current.FeelsLikeC + '°C',
      condition: current.weatherDesc[0].value,
      humidity: current.humidity + '%',
      windSpeed: current.windspeedKmph + ' km/h',
      windDir: current.winddir16Point,
      visibility: current.visibility + ' km',
      uvIndex: current.uvIndex,
      cloudCover: current.cloudcover + '%',
      pressure: current.pressure + ' hPa',
      forecast: forecast,
      source: 'wttr.in'
    });
  } catch (e) {
    res.status(200).json({ 
      error: 'Could not fetch weather for: ' + location,
      query: q 
    });
  }
}
