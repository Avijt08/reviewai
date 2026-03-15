// ReviewAI - Backend API Server
// Stack: Node.js + Express + Anthropic SDK
// Deploy: Vercel (free) or Railway

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

// Rate limiting — free users: 3/day, pro users: unlimited
const freeLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3,
  message: { error: 'free_limit_reached', message: 'Upgrade to Pro for unlimited reviews' }
});

// ────────────────────────────────────────────────────────────
// POST /api/review  — main review endpoint
// ────────────────────────────────────────────────────────────
app.post('/api/review', freeLimiter, async (req, res) => {
  const { code, language, categories } = req.body;

  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'No code provided' });
  }

  const lang = language || 'JavaScript';
  const cats = categories || ['bugs', 'security', 'perf', 'style'];

  const systemPrompt = `You are an expert ${lang} code reviewer. Analyze the code and return ONLY a JSON object with this structure:
{
  "score": <0-100>,
  "summary": "<one sentence overall assessment>",
  "issues": [
    {
      "type": "<${cats.join('|')}>",
      "severity": "<high|medium|low>",
      "title": "<short issue title>",
      "description": "<specific explanation and fix suggestion>",
      "line": <line number if applicable, or null>
    }
  ]
}
Focus on: ${cats.join(', ')}. Include 2-5 most impactful issues. Be specific and actionable. Return ONLY the JSON, no markdown.`;

  try {
    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Review this ${lang} code:\n\n${code}` }]
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const text = data.content?.map(b => b.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    res.json({ success: true, result });

  } catch (err) {
    console.error('Review error:', err.message);
    res.status(500).json({ error: 'Review failed', message: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/health  — health check
// ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ReviewAI API running on port ${PORT}`));

module.exports = app;
