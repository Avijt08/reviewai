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
          let clean = text.replace(/```json|```/gi, '').trim();
          const start = clean.indexOf('{');
          const end = clean.lastIndexOf('}');
          if (start === -1 || end === -1) throw new Error('No JSON found in response');
          clean = clean.substring(start, end + 1);
          // Fix common Gemini JSON issues - unescaped special chars
          clean = clean
            .replace(/[
