const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 8080;
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

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

function callGroq(code, language) {
  return new Promise(function(resolve, reject) {
    var lang = language || 'JavaScript';

    var systemPrompt = 'You are a code reviewer. You MUST respond with ONLY a valid JSON object. No markdown. No backticks. No text before or after. Just the raw JSON.\n\nJSON structure:\n{"score":<0-100>,"summary":"one sentence","issues":[{"type":"bugs|security|perf|style","severity":"high|medium|low","title":"short title","description":"fix suggestion"}]}';

    var userPrompt = 'Review this ' + lang + ' code and return JSON only:\n\n' + code.substring(0, 800);

    var payload = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    var options = {
      hostname: 'api.groq.com',
      port: 443,
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_API_KEY,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    var req = https.request(options, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try {
          var data = JSON.parse(body);
          console.log('Groq response status:', res.statusCode);
          if (data.error) return reject(new Error(data.error.message));
          var text = data.choices[0].message.content || '';
          console.log('Groq text:', text.substring(0, 200));
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
    return res.end(JSON.stringify({ status: 'ok', version: '1.0.0', engine: 'llama-3.3-70b (groq)', hasKey: !!GROQ_API_KEY }));
  }

  if (req.method === 'POST' && url === '/api/review') {
    readBody(req).then(function(body) {
      if (!body.code || !body.code.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'No code provided' }));
      }
      if (!GROQ_API_KEY) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'GROQ_API_KEY not set in Railway variables' }));
      }
      callGroq(body.code, body.language).then(function(result) {
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
  console.log('Engine: llama-3.3-70b via Groq (Free)');
  console.log('API key set: ' + !!GROQ_API_KEY);
});
