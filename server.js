const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

function callGemini(code, language, categories) {
  return new Promise((resolve, reject) => {
    const lang = language || 'JavaScript';
    const cats = (categories || ['bugs','security','perf','style']).join('|');

    const prompt = `You are an expert ${lang} code reviewer. Analyze the following code and return ONLY valid JSON with no markdown, no backticks, no extra text whatsoever. Use exactly this structure:
{"score":<number 0-100>,"summary":"<one sentence assessment>","issues":[{"type":"<${cats}>","severity":"<high|medium|low>","title":"<short title>","description":"<specific fix suggestion>"}]}

Give 2-5 most important issues. Be specific and actionable.

Code to review:
${code}`;

    const payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1000
      }
    });

    const path = `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.error) return reject(new Error(data.error.message));
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const clean = text.replace(/```json|```/g, '').trim();
          resolve(JSON.parse(clean));
        } catch(e) {
          reject(new Error('Failed to parse Gemini response: ' + e.message));
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

  if (req.method === 'GET' && url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      version: '1.0.0',
      engine: 'gemini-2.5-flash',
      hasKey: !!GEMINI_API_KEY
    }));
  }

  if (req.method === 'POST' && url === '/api/review') {
    const body = await readBody(req);

    if (!body.code || !body.code.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'No code provided' }));
    }

    if (!GEMINI_API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'GEMINI_API_KEY not set in Railway variables' }));
    }

    try {
      const result = await callGemini(body.code, body.language, body.categories);
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
  console.log(`Engine: Gemini 2.0 Flash (Free)`);
  console.log(`API key set: ${!!GEMINI_API_KEY}`);
});
