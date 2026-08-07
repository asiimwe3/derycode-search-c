# DeryCode Search (C Edition) - Enhanced v2.0

A premium search engine built in **pure C** - zero frameworks, zero dependencies.

## What's New in v2.0

- **16 Search Sources** (was 11) - now includes Google Books, Google News, Google Scholar, PubMed, Project Gutenberg
- **512 results per query** (was 128)
- **5000 word AI answers** (was 200) - comprehensive, detailed responses
- **500 word queries** (was 30) - ask complex questions
- **Book search + summarization** - find books across Google Books, Open Library, and Project Gutenberg
- **Deep content extraction** - fetches full page content from top results
- **Real-time news** - stays up to date with Google News RSS
- **30 step-by-step guides** (was 15) - more comprehensive Derick Agent
- **10 related searches** (was 6)

## All 16 Sources

1. DuckDuckGo Instant Answers
2. DuckDuckGo Full Web Results (HTML scraping - ALL results)
3. Wikipedia + Knowledge Panels
4. GitHub Repositories
5. Reddit (forum discussions)
6. Hacker News (tech discussions)
7. Stack Exchange / Stack Overflow (Q&A)
8. ArXiv (academic preprints)
9. Internet Archive (archived/deleted content)
10. Open Library (books)
11. Semantic Scholar (research papers)
12. **Google Books** (full book content + descriptions) *NEW*
13. **Google News** (real-time news) *NEW*
14. **Project Gutenberg** (free full books) *NEW*
15. **PubMed** (medical research) *NEW*
16. **Google Scholar** (academic papers) *NEW*

## Features
- AI Summaries (auto-generated from top results)
- Knowledge Panels (Wikipedia summaries with thumbnails)
- Voice Search (Web Speech API)
- Autocomplete suggestions
- Related searches (10 suggestions)
- Search history (localStorage)
- Derick Agent - Step-by-step practical guides (up to 30 steps)
- Book search and summarization
- Real-time news aggregation
- Deep content extraction (full page content)
- No filtering, no censorship, no safe search
- Privacy-focused: no tracking, no ads
- DeryCode dark/gold branding
- 6 African + international languages
- Mobile responsive

## API Endpoints
- `/api/search?q=QUERY` - Full search (16 sources, 512 results)
- `/api/search?q=QUERY&deep=1` - Deep search (includes full page extraction)
- `/api/ai` - AI chat with high-output answers (POST: {question, lang, history})
- `/api/derick` - Step-by-step practical guide (POST: {question, deep})
- `/api/books?q=QUERY` - Book search with summaries
- `/api/news?q=QUERY` - Real-time news
- `/api/suggest?q=QUERY` - Autocomplete suggestions
- `/api/languages` - List supported languages
- `/api/health` - Health check

## Build and Run
```bash
make
./derycode-search 8080
```

Then open http://localhost:8080

## Architecture
- `server.c` - HTTP server using POSIX sockets with fork() for concurrency
- `json.h` - Hand-written JSON parser (zero dependencies)
- `search.h` - Search aggregation from 16 sources + AI + Derick Agent
- `languages.h` - 6 languages + high output limits (500 query / 5000 answer words)
- `knowledge.h` - Built-in DeryCode knowledge base
- `public/index.html` - Single-page frontend with embedded CSS/JS

## Deployment
```bash
docker build -t derycode-search .
docker run -p 8080:8080 derycode-search
```

## License
MIT

Built in C by DeryCode Tech - Kyenjojo, Uganda
