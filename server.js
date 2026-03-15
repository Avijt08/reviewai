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

function sanitize(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ');
}

function callGemini(code, language) {
  return new Promise(function(resolve, reject) {
    var lang = language || 'JavaScript';

    var prompt = 'Review this ' + lang + ' code. Reply with ONLY a JSON object, no markdown.\n\nIMPORTANT: In all string values use only simple ASCII characters. No newlines, no special characters, no code snippets inside strings.\n\nJSON format:\n{"score":75,"summary":"Brief assessment here","issues":[{"type":"bugs","severity":"high","title":"Issue title","description":"Simple description of the fix"}]}\n\nCode to review:\n' + code.substring(0, 800);

    var payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 800
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

          // Strip markdown
          text = text.replace(/```json/gi, '').replace(/```/gi, '').trim();

          // Extract JSON boundaries
          var start = text.indexOf('{');
          var end = text.lastIndexOf('}');
          if (start === -1 || end === -1) throw new Error('No JSON found');
          text = text.substring(start, end + 1);

          // Build safe result by parsing field by field
          var scoreMatch = text.match(/"score"\s*:\s*(\d+)/);
          var summaryMatch = text.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);

          var result = {
            score: scoreMatch ? parseInt(scoreMatch[1]) : 50,
            summary: summaryMatch ? summaryMatch[1] : 'Code reviewed.',
            issues: []
          };

          // Extract each issue block safely
          var issueStart = text.indexOf('"issues"');
          if (issueStart !== -1) {
            var issueText = text.substring(issueStart);
            var typeMatches = issueText.match(/"type"\s*:\s*"([^"]+)"/g) || [];
            var severityMatches = issueText.match(/"severity"\s*:\s*"([^"]+)"/g) || [];
            var titleMatches = issueText.match(/"title"\s*:\s*"([^"]+)"/g) || [];
            var descMatches = issueText.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/g) || [];

            var count = Math.min(typeMatches.length, titleMatches.length, 5);
            for (var i = 0; i < count; i++) {
              var typeVal = typeMatches[i] ? typeMatches[i].replace(/"type"\s*:\s*"/, '').replace(/"$/, '') : 'style';
              var sevVal = severityMatches[i] ? severityMatches[i].replace(/"severity"\s*:\s*"/, '').replace(/"$/, '') : 'medium';
              var titleVal = titleMatches[i] ? titleMatches[i].replace(/"title"\s*:\s*"/, '').replace(/"$/, '') : 'Issue';
              var descVal = descMatches[i] ? descMatches[i].replace(/"description"\s*:\s*"/, '').replace(/"$/, '') : 'See code for details';

              result.issues.push({
                type: typeVal,
                severity: sevVal,
                title: titleVal,
                description: descVal
              });
            }
          }

          resolve(result);
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
  console.log('Engine: gemini-2.5-flash');
  console.log('API key set: ' + !!GEMINI_API_KEY);
});
