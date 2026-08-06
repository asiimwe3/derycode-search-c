# DeryCode Search (C Edition)

A premium search engine built in **pure C** - zero frameworks, zero dependencies.

## Features
- AI Summaries (auto-generated from top results)
- Knowledge Panels (Wikipedia summaries with thumbnails)
- Voice Search (Web Speech API)
- Autocomplete suggestions
- Related searches
- Search history (localStorage)
- Aggregates results from DuckDuckGo, Wikipedia, and GitHub
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
- `search.h` - Search aggregation using curl binary via popen()
- `public/index.html` - Single-page frontend with embedded CSS/JS

## Deployment
Uses Docker for any cloud provider:
```bash
docker build -t derycode-search .
docker run -p 8080:8080 derycode-search
```

## License
MIT

Built in C by DeryCode Tech - Kyenjojo, Uganda
