# DeryCode Search (C Edition)

A premium search engine built in **pure C** - zero frameworks, zero dependencies.

## Features
- AI Summaries (auto-generated from top results)
- Knowledge Panels (Wikipedia summaries with thumbnails)
- Voice Search (Web Speech API)
- Autocomplete suggestions
- Related searches
- Search history (localStorage)
- **11 Search Sources** (surfaces what other engines hide):
  - DuckDuckGo Instant Answers
  - DuckDuckGo Full Web Results (HTML scraping - ALL results)
  - Wikipedia + Knowledge Panels
  - GitHub Repositories
  - Reddit (forum discussions Google demotes)
  - Hacker News (tech discussions)
  - Stack Exchange / Stack Overflow (Q&A)
  - ArXiv (academic preprints, not behind paywalls)
  - Internet Archive (archived/deleted content)
  - Open Library (books)
  - Semantic Scholar (research papers)
- **128 results per query** (Google caps at ~300, shows only 10)
- No filtering, no censorship, no safe search
- Privacy-focused: no tracking, no ads
- DeryCode dark/gold branding
- Mobile responsive

## Why C?
- Zero dependencies
- Blazing fast
- Minimal memory footprint
- No framework overhead
- Maximum control

## Build and Run
```bash
make
./derycode-search 8080
```

Then open http://localhost:8080

## Architecture
- `server.c` - HTTP server using POSIX sockets with fork() for concurrency
- `json.h` - Hand-written JSON parser (zero dependencies)
- `search.h` - Search aggregation from 11 sources using curl via popen()
- `public/index.html` - Single-page frontend with embedded CSS/JS

## Why 11 Sources?
Mainstream search engines filter, demote, and hide results. Google claims
"About 10,000,000 results" but only shows you ~10. DeryCode Search aggregates
from 11 independent sources to surface what they hide:
- Forum discussions (Reddit, Hacker News)
- Expert Q&A (Stack Overflow)
- Academic research (ArXiv, Semantic Scholar)
- Archived content (Internet Archive)
- Books (Open Library)
- Full web results (DuckDuckGo HTML)
No safe search, no filtering, no censorship.

## Deployment
Uses Docker for any cloud provider:
```bash
docker build -t derycode-search .
docker run -p 8080:8080 derycode-search
```

## License
MIT

Built in C by DeryCode Tech - Kyenjojo, Uganda
