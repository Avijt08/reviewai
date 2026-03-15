<div align="center">

<svg width="72" height="72" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="34" height="34" rx="9" fill="#c8f135"/>
  <path d="M11 12 L6 17 L11 22" stroke="#0a0a0a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M23 12 L28 17 L23 22" stroke="#0a0a0a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M14 17 L16.2 19.2 L20 14.5" stroke="#0a0a0a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>

# ReviewAI

### Instant AI-Powered Code Reviews

Catch bugs, security holes, and performance issues in seconds — before they hit production.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-reviewai.vercel.app-c8f135?style=for-the-badge&logo=vercel&logoColor=black)](https://reviewai.vercel.app)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=for-the-badge)](LICENSE)
[![Built with Claude](https://img.shields.io/badge/Built%20with-Claude%20AI-orange?style=for-the-badge)](https://anthropic.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)

</div>

---

## What is ReviewAI?

ReviewAI is an AI-powered code review agent that gives developers instant, actionable feedback on their code. Instead of waiting hours for a colleague to review your PR, paste your code and get a full review in under 3 seconds.

It checks for:

- 🐛 **Bugs** — null pointer errors, off-by-one mistakes, unhandled edge cases
- 🔒 **Security** — SQL injection, XSS, exposed secrets, insecure dependencies  
- ⚡ **Performance** — N+1 queries, memory leaks, inefficient loops
- ✨ **Code Style** — readability, maintainability, best practices

Every review produces a **quality score (0–100)** so you can track improvement over time.

---

## Demo

> Try it live → **[reviewai.vercel.app](https://reviewai.vercel.app)**

Paste any code snippet and get a review instantly. No signup needed for the free tier (3 reviews/day).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JS |
| Backend | Node.js + Express |
| AI Engine | Anthropic Claude (claude-sonnet-4) |
| Hosting (Frontend) | Vercel (free) |
| Hosting (Backend) | Railway (free tier) |
| Payments | Gumroad |

---

## Project Structure

```
reviewai/
├── index.html          # Full landing page + app UI
├── server.js           # Express API with rate limiting
├── package.json        # Backend dependencies
├── .env.example        # Environment variable template
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- An Anthropic API key → [Get one free](https://console.anthropic.com)

### Run Locally

```bash
# 1. Clone the repo
git clone https://github.com/Avijt08/reviewai.git
cd reviewai

# 2. Install backend dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 4. Start the backend server
npm run dev
# Server runs on http://localhost:3001

# 5. Open the frontend
# Just open index.html in your browser
```

### Environment Variables

Create a `.env` file in the root:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
FRONTEND_URL=http://localhost:5500
PORT=3001
```

---

## API Reference

### `POST /api/review`

Analyze a code snippet and return issues.

**Request body:**
```json
{
  "code": "function getUser(id) { ... }",
  "language": "JavaScript",
  "categories": ["bugs", "security", "perf", "style"]
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "score": 42,
    "summary": "Several critical security vulnerabilities found.",
    "issues": [
      {
        "type": "security",
        "severity": "high",
        "title": "SQL Injection vulnerability",
        "description": "String concatenation in SQL query allows injection. Use parameterized queries instead: db.execute('SELECT * FROM users WHERE id = ?', [id])",
        "line": 2
      }
    ]
  }
}
```

**Rate limits:**
- Free tier: 3 requests per 24 hours (per IP)
- Pro tier: Unlimited (coming soon via API key auth)

---

## Deployment

### Frontend → Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (from project root)
vercel

# Your site is live at https://reviewai-xxx.vercel.app
```

### Backend → Railway

1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Add environment variables in the Railway dashboard
4. Your API is live automatically

---

## Pricing

| Plan | Price | Reviews |
|------|-------|---------|
| Free | ₹0/month | 3/day |
| Pro | ₹499/month | Unlimited |
| Team | ₹2,999/month | Unlimited (10 seats) |

→ [Get Pro on Gumroad](https://gumroad.com)

---

## Roadmap

- [x] Core review engine (bugs, security, perf, style)
- [x] Quality score (0–100)
- [x] Free tier with rate limiting
- [x] Multi-language support (12+ languages)
- [ ] GitHub PR integration
- [ ] VS Code extension
- [ ] Review history & dashboard
- [ ] Team workspace
- [ ] Slack bot integration
- [ ] API key auth for Pro users

---

## Contributing

Contributions are welcome! Feel free to open an issue or submit a PR.

```bash
# Fork the repo, then:
git checkout -b feature/your-feature-name
git commit -m "Add your feature"
git push origin feature/your-feature-name
# Open a Pull Request
```

---

## License

Licensed under the [Apache 2.0 License](LICENSE).

---

<div align="center">

Built with ❤️ using [Claude AI](https://anthropic.com) by [@Avijt08](https://github.com/Avijt08)

⭐ Star this repo if you find it useful!

</div>
