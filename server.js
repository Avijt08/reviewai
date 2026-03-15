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

function callGemini(code, language) {
  return new Promise(function(resolve, reject) {
    var lang = language || 'JavaScript';

    var prompt = 'Review this ' + lang + ' code. Reply with ONLY a JSON object, no markdown, no backticks, no explanation before or after.\n\nFormat:\n{"score":75,"summary":"One sentence here","issues":[{"type":"bugs","severity":"high","title":"Short title","description":"Short description"}]}\n\nCode:\n' + code.substring(0, 600);

    var payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 600
      }
    });

    var path = '/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY;

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

          // Log full response for debugging
          console.log('=== GEMINI RAW RESPONSE ===');
          console.log(JSON.stringify(data, null, 2));
          console.log('===========================');

          if (data.error) return reject(new Error(data.error.message));

          var text = '';
          if (data.candidates && data.candidates[0]) {
            var candidate = data.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
              text = candidate.content.parts[0].text || '';
            }
          }

          console.log('=== EXTRACTED TEXT ===');
          console.log(text);
          console.log('======================');

          // Strip markdown
          text = text.replace(/```json/gi, '').replace(/```/gi, '').trim();

          // Find JSON boundaries
          var start = text.indexOf('{');
          var end = text.lastIndexOf('}');

          if (start === -1 || end === -1) {
            return reject(new Error('No JSON found. Raw text: ' + text.substring(0, 200)));
          }

          text = text.substring(start, end + 1);
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
    return res.end(JSON.stringify({ status: 'ok', version: '1.0.0', engine: 'gemini-2.0-flash', hasKey: !!GEMINI_API_KEY }));
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
      callGemini(body.code, body.language).then(function(result) {
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
  console.log('Engine: gemini-2.0-flash');
  console.log('API key set: ' + !!GEMINI_API_KEY);
});
