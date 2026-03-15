const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 8080;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
  });
}

function callAnthropic(code, language, categories) {
  return new Promise((resolve, reject) => {
    const lang = language || 'JavaScript';
    const cats = (categories || ['bugs','security','perf','style']).join('|');

    const system = `You are an expert ${lang} code reviewer. Return ONLY valid JSON, no markdown, no backticks, no extra text. Use this exact structure: {"score":<number 0-100>,"summary":"<string>","issues":[{"type":"<${cats}>","severity":"<high|medium|low>","title":"<string>","description":"<string>"}]}. Give 2-5 issues.`;

    const payload = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: system,
      messages: [{ role: 'user', content: `Review this ${lang} code:\n\n${code}` }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.error) return reject(new Error(data.error.message));
          const text = (data.content || []).map(b => b.text || '').join('');
          const clean = text.replace(/```json|```/g, '').trim();
          resolve(JSON.parse(clean));
        } catch(e) {
          reject(new Error('Failed to parse response: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = req.url.split('?')[0];

  // Health check
  if (req.method === 'GET' && url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      version: '1.0.0',
      hasKey: !!ANTHROPIC_API_KEY
    }));
  }

  // Review endpoint
  if (req.method === 'POST' && url === '/api/review') {
    let body;
    try {
      body = await readBody(req);
    } catch(e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid request body' }));
    }

    if (!body.code || !body.code.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'No code provided' }));
    }

    if (!ANTHROPIC_API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in Railway variables' }));
    }

    try {
      const result = await callAnthropic(body.code, body.language, body.categories);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, result }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Review failed', message: e.message }));
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ReviewAI API running on port ${PORT}`);
  console.log(`API key set: ${!!ANTHROPIC_API_KEY}`);
});
