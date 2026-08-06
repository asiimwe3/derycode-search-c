const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'sw', name: 'Kiswahili', native: 'Kiswahili' },
  { code: 'lg', name: 'Luganda', native: 'Luganda' },
  { code: 'rn', name: 'Runyoro', native: 'Runyoro' },
  { code: 'luo', name: 'Luo', native: 'Dholuo' },
  { code: 'te', name: 'Ateso', native: 'Ateso' }
];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(LANGUAGES);
}
