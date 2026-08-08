// DeryCode Calculator API - Safe math expression evaluator
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const expr = (req.query.q || req.body && req.body.expr || '').trim();
  if (!expr) return res.status(400).json({ error: 'Expression required' });
  
  try {
    // Extract math expression from natural language
    let mathExpr = expr.toLowerCase()
      .replace(/what\s+is\s+/i, '')
      .replace(/calculate\s+/i, '')
      .replace(/compute\s+/i, '')
      .replace(/\?/g, '')
      .replace(/plus/g, '+')
      .replace(/minus/g, '-')
      .replace(/times|multiplied by/g, '*')
      .replace(/divided by/g, '/')
      .replace(/x(?=\s*\d)/g, '*')
      .replace(/mod/g, '%')
      .replace(/squared/g, '**2')
      .replace(/cubed/g, '**3')
      .replace(/square root of/g, 'Math.sqrt')
      .replace(/sqrt/g, 'Math.sqrt')
      .replace(/sin/g, 'Math.sin')
      .replace(/cos/g, 'Math.cos')
      .replace(/tan/g, 'Math.tan')
      .replace(/pi/gi, 'Math.PI')
      .replace(/e(?![a-z])/g, 'Math.E')
      .trim();
    
    // Safety: only allow numbers, operators, Math functions, parentheses
    if (!/^[\d\s+\-*/%.()MathsqrbtciEPI]+$/.test(mathExpr)) {
      return res.status(200).json({ error: 'Not a valid math expression', query: expr });
    }
    
    // Evaluate safely
    const result = Function('"use strict"; return (' + mathExpr + ')')();
    
    if (typeof result !== 'number' || !isFinite(result)) {
      return res.status(200).json({ error: 'Invalid calculation', query: expr });
    }
    
    // Format result nicely
    let formatted = result.toString();
    if (result % 1 !== 0) {
      formatted = (Math.round(result * 1000000) / 1000000).toString();
    }
    
    res.status(200).json({
      expression: expr,
      result: formatted,
      source: 'DeryCode Calculator'
    });
  } catch (e) {
    res.status(200).json({ error: 'Could not calculate: ' + expr, query: expr });
  }
}
