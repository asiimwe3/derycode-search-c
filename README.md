# DeryCode AI Search Engine

A privacy-focused AI search engine with 23 data sources, 10 search modes, and zero tracking. Built by [DeryCode Technologies](https://derycode.publicvm.com), founded by [Asiimwe Derick](https://github.com/asiimwe3) in Kampala, Uganda.

## Live Demo

Try it at: https://derycode-search-c.vercel.app

## Features

- 10 search modes: AI Answers, Web, Images, News, Code, Derick AI, Books, Maps, Deep Web, Videos
- 23 data sources aggregated in real-time
- AI-powered answer generation from search results
- Wikipedia knowledge panels for entities
- Academic search (PubMed, Google Scholar, CrossRef)
- Multi-language support: English, Swahili, Luganda, Runyankole, Luo, Ateso
- Voice search and autocomplete suggestions
- No tracking, no ads, no cookies
- Installable Progressive Web App (PWA)

## Technology Stack

- **Core Engine:** C (POSIX sockets, fork concurrency)
- **Serverless APIs:** JavaScript (Vercel functions)
- **Frontend:** Vanilla HTML/CSS/JS (zero frameworks)
- **Deployment:** Vercel (production), Docker (self-hosted)

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/search?q=QUERY` | GET | Full search (23 sources) |
| `/api/ai` | POST | AI chat with high-output answers |
| `/api/derick` | POST | Step-by-step practical guides |
| `/api/books?q=QUERY` | GET | Book search with summaries |
| `/api/news?q=QUERY` | GET | Real-time news |
| `/api/images?q=QUERY` | GET | Image search |
| `/api/videos?q=QUERY` | GET | Video search |
| `/api/status` | GET | Health check |

## Local Development

```bash
# Serverless (Vercel)
npm install -g vercel
vercel dev

# Or build from C source
make
./derycode-search 8080
```

Then open http://localhost:8080

## Architecture

- `server.c` — HTTP server using POSIX sockets with fork() for concurrency
- `json.h` — Hand-written JSON parser (zero dependencies)
- `search.h` — Search aggregation from 23 sources + AI + Derick Agent
- `languages.h` — 6 languages + high output limits (500 query / 5000 answer words)
- `knowledge.h` — Built-in DeryCode knowledge base
- `api/` — Vercel serverless functions (production deployment)
- `public/index.html` — Single-page frontend with embedded CSS/JS

## Docker

```bash
docker build -t derycode-search .
docker run -p 8080:8080 derycode-search
```

## Author

**Asiimwe Derick** — Founder, DeryCode Technologies
- GitHub: [@asiimwe3](https://github.com/asiimwe3)
- Website: [derycode.publicvm.com](https://derycode.publicvm.com)
- Email: info@derycode.com
- WhatsApp: +256 772 002 326

## License

MIT — see [LICENSE](LICENSE) file.
