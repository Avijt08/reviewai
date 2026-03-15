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
  return new Promise(function(resolve) {
    var data = '';
    req.on('data', function(c) { data += c; });
    req.on('end', function() {
      try { resolve(JSON.parse(data)); }
      catch(e) { resolve({}); }
    });
  });
}

function callGemini(code, language, categories) {
  return new Promise(function(resolve, reject) {
    var lang = language || 'JavaScript';

    var prompt = 'Review this ' + lang + ' code and identify issues.\n\nCode:\n' + code + '\n\nFor each issue found, classify it as bugs/security/perf/style, with severity high/medium/low. Give an overall quality score 0-100 and a one sentence summary.';

    var payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1000,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            score: { type: 'INTEGER' },
            summary: { type: 'STRING' },
            issues: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  type: { type: 'STRING' },
                  severity: { type: 'STRING' },
                  title: { type: 'STRING' },
                  description: { type: 'STRING' }
                },
                required: ['type', 'severity', 'title', 'description']
              }
            }
          },
          required: ['score', 'summary', 'issues']
        }
      }
    });

    var path = '/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY;

    var options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    var req = https.request(options, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try {
          var data = JSON.parse(body);
          if (data.error) return reject(new Error(data.error.message));
          var text = data.candidates[0].content.parts[0].text || '';
          var parsed = JSON.parse(text);
          resolve(parsed);
        } catch(e) {
          reject(new Error('Parse error: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

var server = http.createServer(function(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  var url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', version: '1.0.0', engine: 'gemini-2.5-flash', hasKey: !!GEMINI_API_KEY }));
  }

  if (req.method === 'POST' && url === '/api/review') {
    readBody(req).then(function(body) {
      if (!body.code || !body.code.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'No code provided' }));
      }
      if (!GEMINI_API_KEY) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'GEMINI_API_KEY not set' }));
      }
      callGemini(body.code, body.language, body.categories).then(function(result) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result: result }));
      }).catch(function(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Review failed', message: e.message }));
      });
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', function() {
  console.log('ReviewAI API running on port ' + PORT);
  console.log('Engine: gemini-2.5-flash');
  console.log('API key set: ' + !!GEMINI_API_KEY);
});
