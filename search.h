#include "languages.h"
/* Search aggregation module for DeryCode Search */
#ifndef DC_SEARCH_H
#define DC_SEARCH_H

#include "json.h"

/* HTTP response buffer */
typedef struct {
    char *data;
    size_t size;

} HttpResponse;

#define MAX_RESPONSE 1048576  /* 1MB */

/* HTML-escape a string for JSON output */
static void json_escape(char *out, const char *in, int max) {
    int j = 0;
    for (int i = 0; in[i] && j < max - 6; i++) {
        if (in[i] == '"') { out[j++] = '\\'; out[j++] = '"'; }
        else if (in[i] == '\\') { out[j++] = '\\'; out[j++] = '\\'; }
        else if (in[i] == '\n') { out[j++] = '\\'; out[j++] = 'n'; }
        else if (in[i] == '\r') { out[j++] = '\\'; out[j++] = 'r'; }
        else if (in[i] == '\t') { out[j++] = '\\'; out[j++] = 't'; }
        else if ((unsigned char)in[i] < 0x20) { continue; }
        else out[j++] = in[i];
    }
    out[j] = 0;
}


/* Fetch a URL using curl binary via popen */
static size_t write_callback(char *ptr, size_t size, size_t nmemb, void *userdata) {
    HttpResponse *resp = (HttpResponse *)userdata;
    size_t total = size * nmemb;
    resp->data = realloc(resp->data, resp->size + total + 1);
    memcpy(resp->data + resp->size, ptr, total);
    resp->size += total;
    resp->data[resp->size] = 0;
    return total;
}

/* URL-encode a string */
static char *url_encode(const char *str) {
    char *encoded = malloc(strlen(str) * 3 + 1);
    int j = 0;
    for (int i = 0; str[i]; i++) {
        unsigned char c = str[i];
        if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || 
            (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '~') {
            encoded[j++] = c;
        } else if (c == ' ') {
            encoded[j++] = '+';
        } else {
            j += sprintf(encoded + j, "%%%02X", c);
        }
    }
    encoded[j] = 0;
    return encoded;
}

/* Fetch URL using curl binary */
static char *http_get(const char *url, const char *user_agent) {
    char cmd[4096];
    /* Build curl command with headers */
    snprintf(cmd, sizeof(cmd), 
        "curl -s -L --max-time 8 -A \"%s\" -H \"Accept: application/json\" \"%s\" 2>/dev/null",
        user_agent, url);
    
    FILE *fp = popen(cmd, "r");
    if (!fp) return NULL;
    
    size_t cap = 65536;
    char *buf = malloc(cap);
    size_t len = 0;
    size_t r;
    
    while ((r = fread(buf + len, 1, cap - len - 1, fp)) > 0) {
        len += r;
        if (len >= cap - 1) {
            cap *= 2;
            buf = realloc(buf, cap);
        }
    }
    buf[len] = 0;
    pclose(fp);
    
    if (len == 0) { free(buf); return NULL; }
    return buf;
}

/* HTML entity decoder (basic) */
static void decode_html(char *str) {
    if (!str) return;
    char *dst = str;
    while (*str) {
        if (*str == '&' && str[1] == '#') {
            int code = atoi(str + 2);
            if (code > 0 && code < 256) {
                *dst++ = (char)code;
                str = strchr(str, ';');
                if (str) str++;
                continue;
            }
        }
        if (*str == '&') {
            if (strncmp(str, "&amp;", 5) == 0) { *dst++ = '&'; str += 5; continue; }
            if (strncmp(str, "&lt;", 4) == 0) { *dst++ = '<'; str += 4; continue; }
            if (strncmp(str, "&gt;", 4) == 0) { *dst++ = '>'; str += 4; continue; }
            if (strncmp(str, "&quot;", 6) == 0) { *dst++ = '"'; str += 6; continue; }
            if (strncmp(str, "&#39;", 5) == 0) { *dst++ = '\''; str += 5; continue; }
            if (strncmp(str, "&apos;", 6) == 0) { *dst++ = '\''; str += 6; continue; }
        }
        *dst++ = *str++;
    }
    *dst = 0;
}

/* Strip HTML tags */
static void strip_html(char *str) {
    if (!str) return;
    char *dst = str;
    int in_tag = 0;
    while (*str) {
        if (*str == '<') { in_tag = 1; str++; continue; }
        if (*str == '>') { in_tag = 0; str++; continue; }
        if (!in_tag) *dst++ = *str;
        str++;
    }
    *dst = 0;
}

/* Search result structure */
typedef struct {
    char title[512];
    char url[1024];
    char content[1024];
    char engine[32];
    char source[64];
    int featured;
} SearchResult;

/* Knowledge panel */
typedef struct {
    char title[256];
    char extract[2048];
    char thumbnail[512];
    char url[512];
    int has_data;
} KnowledgePanel;

/* AI summary */
typedef struct {
    char text[1024];
    int has_data;
} AiSummary;

/* Full search response */
typedef struct {
    SearchResult results[128];
    int result_count;
    KnowledgePanel kp;
    AiSummary ai;
    char related[6][128];
    double elapsed;
} SearchResponse;

/* Fetch DuckDuckGo Instant Answer API */
static void search_duckduckgo(const char *query, SearchResult *results, int *count, int max) {
    char *encoded = url_encode(query);
    char url[1024];
    snprintf(url, sizeof(url), 
        "https://api.duckduckgo.com/?q=%s&format=json&no_html=1&skip_disambig=1", encoded);
    free(encoded);
    
    char *raw = http_get(url, "DeryCodeSearch/1.0");
    if (!raw) return;
    
    JsonValue *json = json_parse(raw);
    free(raw);
    if (!json) return;
    
    /* Abstract */
    const char *abstract = json_get_string(json, "AbstractText");
    const char *abstract_url = json_get_string(json, "AbstractURL");
    const char *heading = json_get_string(json, "Heading");
    
    if (abstract && abstract_url && *count < max) {
        strncpy(results[*count].title, heading ? heading : query, 511);
        strncpy(results[*count].url, abstract_url, 1023);
        strncpy(results[*count].content, abstract, 1023);
        strcpy(results[*count].engine, "duckduckgo");
        strcpy(results[*count].source, "DuckDuckGo");
        results[*count].featured = 1;
        (*count)++;
    }
    
    /* Related topics */
    JsonValue *topics = json_get_array(json, "RelatedTopics");
    if (topics) {
        int len = json_array_len(topics);
        for (int i = 0; i < len && *count < max; i++) {
            JsonValue *topic = json_array_at(topics, i);
            if (!topic || topic->type != JSON_OBJ) continue;
            const char *first_url = json_get_string(topic, "FirstURL");
            const char *text = json_get_string(topic, "Text");
            if (first_url && text && strlen(text) > 5) {
                strncpy(results[*count].url, first_url, 1023);
                strncpy(results[*count].content, text, 1023);
                /* Use first part as title */
                strncpy(results[*count].title, text, 511);
                char *dash = strstr(results[*count].title, " - ");
                if (dash) *dash = 0;
                strcpy(results[*count].engine, "duckduckgo");
                strcpy(results[*count].source, "DuckDuckGo");
                results[*count].featured = 0;
                (*count)++;
            }
        }
    }
    
    json_free(json);
}

/* Fetch Wikipedia search */
static void search_wikipedia(const char *query, SearchResult *results, int *count, int max, KnowledgePanel *kp) {
    char *encoded = url_encode(query);
    char url[1024];
    
    /* Search API */
    snprintf(url, sizeof(url),
        "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=%s&format=json&srlimit=3", encoded);
    
    char *raw = http_get(url, "DeryCodeSearch/1.0");
    if (raw) {
        JsonValue *json = json_parse(raw);
        free(raw);
        if (json) {
            JsonValue *query_obj = json_get_array(json, "query");
            if (query_obj) {
                JsonValue *search = json_get_array(query_obj, "search");
                if (search) {
                    int len = json_array_len(search);
                    for (int i = 0; i < len && *count < max; i++) {
                        JsonValue *item = json_array_at(search, i);
                        if (!item) continue;
                        const char *title = json_get_string(item, "title");
                        const char *snippet = json_get_string(item, "snippet");
                        if (title) {
                            snprintf(results[*count].title, 511, "%s - Wikipedia", title);
                            char enc_title[256];
                            char *et = url_encode(title);
                            for (int j = 0; et[j]; j++) if (et[j] == '+') et[j] = '_';
                            snprintf(results[*count].url, 1023, "https://en.wikipedia.org/wiki/%s", et);
                            free(et);
                            if (snippet) {
                                strncpy(results[*count].content, snippet, 1023);
                                strip_html(results[*count].content);
                                strncat(results[*count].content, "...", 1023 - strlen(results[*count].content));
                            }
                            strcpy(results[*count].engine, "wikipedia");
                            strcpy(results[*count].source, "Wikipedia");
                            (*count)++;
                        }
                    }
                }
            }
            json_free(json);
        }
    }
    
    /* Knowledge panel - REST API */
    snprintf(url, sizeof(url),
        "https://en.wikipedia.org/api/rest_v1/page/summary/%s", encoded);
    /* Replace + with _ in the URL */
    for (char *p = url + strlen(url) - strlen(encoded); *p; p++) if (*p == '+') *p = '_';
    
    raw = http_get(url, "DeryCodeSearch/1.0");
    if (raw) {
        JsonValue *json = json_parse(raw);
        free(raw);
        if (json) {
            const char *type = json_get_string(json, "type");
            const char *title = json_get_string(json, "title");
            const char *extract = json_get_string(json, "extract");
            JsonValue *thumb = json_get_array(json, "thumbnail");
            const char *thumb_url = thumb ? json_get_string(thumb, "source") : NULL;
            JsonValue *content_urls = json_get_array(json, "content_urls");
            JsonValue *desktop = content_urls ? json_get_array(content_urls, "desktop") : NULL;
            const char *page_url = desktop ? json_get_string(desktop, "page") : NULL;
            
            if (type && strcmp(type, "disambiguation") != 0 && extract) {
                strncpy(kp->title, title ? title : "", 255);
                strncpy(kp->extract, extract, 2047);
                if (thumb_url) strncpy(kp->thumbnail, thumb_url, 511);
                if (page_url) strncpy(kp->url, page_url, 511);
                kp->has_data = 1;
            }
            json_free(json);
        }
    }
    
    free(encoded);
}

/* Fetch GitHub repos */
static void search_github(const char *query, SearchResult *results, int *count, int max) {
    char *encoded = url_encode(query);
    char url[1024];
    snprintf(url, sizeof(url),
        "https://api.github.com/search/repositories?q=%s&sort=stars&order=desc&per_page=4", encoded);
    free(encoded);
    
    char *raw = http_get(url, "DeryCodeSearch/1.0");
    if (!raw) return;
    
    JsonValue *json = json_parse(raw);
    free(raw);
    if (!json) return;
    
    JsonValue *items = json_get_array(json, "items");
    if (items) {
        int len = json_array_len(items);
        for (int i = 0; i < len && *count < max; i++) {
            JsonValue *item = json_array_at(items, i);
            if (!item) continue;
            const char *full_name = json_get_string(item, "full_name");
            const char *html_url = json_get_string(item, "html_url");
            const char *description = json_get_string(item, "description");
            
            if (full_name && html_url) {
                snprintf(results[*count].title, 511, "%s", full_name);
                strncpy(results[*count].url, html_url, 1023);
                strncpy(results[*count].content, description ? description : "No description available.", 1023);
                strcpy(results[*count].engine, "github");
                strcpy(results[*count].source, "GitHub");
                (*count)++;
            }
        }
    }
    json_free(json);
}

/* Generate AI summary from top results */
static void generate_ai_summary(SearchResponse *resp) {
    if (resp->result_count == 0) return;
    
    char summary[1024] = "";
    int added = 0;
    
    for (int i = 0; i < resp->result_count && i < 5 && added < 3; i++) {
        if (strlen(resp->results[i].content) > 30 && strlen(resp->results[i].content) < 500) {
            if (added > 0) strncat(summary, " ", sizeof(summary) - strlen(summary) - 1);
            strncat(summary, resp->results[i].content, sizeof(summary) - strlen(summary) - 1);
            added++;
        }
    }
    
    if (strlen(summary) > 50) {
        strncpy(resp->ai.text, summary, 1023);
        resp->ai.has_data = 1;
    }
}

/* Generate related searches */
static void generate_related(const char *query, SearchResponse *resp) {
    snprintf(resp->related[0], 127, "%s in Uganda", query);
    snprintf(resp->related[1], 127, "%s Africa", query);
    snprintf(resp->related[2], 127, "best %s", query);
    snprintf(resp->related[3], 127, "%s 2026", query);
    snprintf(resp->related[4], 127, "%s reviews", query);
    snprintf(resp->related[5], 127, "what is %s", query);
}

/* Soft deduplicate - only remove EXACT URL matches, keep different pages */
static void dedup_results(SearchResponse *resp) {
    for (int i = 0; i < resp->result_count; i++) {
        for (int j = i + 1; j < resp->result_count; j++) {
            if (strcmp(resp->results[i].url, resp->results[j].url) == 0) {
                /* Shift down */
                for (int k = j; k < resp->result_count - 1; k++) {
                    resp->results[k] = resp->results[k + 1];
                }
                resp->result_count--;
                j--;
            }
        }
    }
}


/* ============ DEEP SEARCH SOURCES (What Others Hide) ============ */

/* DuckDuckGo Full HTML Results - scrapes the actual search page for ALL results */
static void search_duckduckgo_html(const char *query, SearchResult *results, int *count, int max) {
    char *encoded = url_encode(query);
    char url[1024];
    snprintf(url, sizeof(url), "https://html.duckduckgo.com/html/?q=%s", encoded);
    free(encoded);
    
    /* Use a browser-like UA for HTML scraping */
    char cmd[4096];
    snprintf(cmd, sizeof(cmd),
        "curl -s -L --max-time 8 -A \"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36\" \"%s\" 2>/dev/null", url);
    
    FILE *fp = popen(cmd, "r");
    if (!fp) return;
    
    size_t cap = 131072;  /* 128KB for HTML pages */
    char *buf = malloc(cap);
    size_t len = 0, r;
    while ((r = fread(buf + len, 1, cap - len - 1, fp)) > 0) {
        len += r;
        if (len >= cap - 1) { cap *= 2; buf = realloc(buf, cap); }
    }
    buf[len] = 0;
    pclose(fp);
    
    if (len == 0) { free(buf); return; }
    
    /* Parse result blocks: <a class="result__a" href="URL">TITLE</a> */
    char *p = buf;
    int found = 0;
    while (p && *p && *count < max && found < 15) {
        /* Find result link */
        char *link_start = strstr(p, "class=\"result__a\"");
        if (!link_start) { 
            link_start = strstr(p, "class=\"result__url\"");
            if (!link_start) break;
        }
        
        /* Find href before this */
        char *href = link_start - 1;
        char *href_start = NULL;
        while (href > p) {
            if (strncmp(href, "href=\"", 6) == 0) { href_start = href + 6; break; }
            href--;
        }
        if (!href_start) { p = link_start + 10; continue; }
        
        /* Extract URL */
        char *href_end = strchr(href_start, '"');
        if (!href_end) break;
        int url_len = href_end - href_start;
        if (url_len > 1023) url_len = 1023;
        
        /* DDG wraps URLs in redirect links - extract actual URL */
        char actual_url[1024] = "";
        if (strncmp(href_start, "//duckduckgo.com/l/?uddg=", 25) == 0) {
            /* URL-encoded redirect - decode it */
            char *encoded_url = href_start + 25;
            int enc_len = (href_end - encoded_url < 1023) ? href_end - encoded_url : 1023;
            strncpy(actual_url, encoded_url, enc_len);
            actual_url[enc_len] = 0;
            /* URL decode */
            url_decode(actual_url);
            /* Strip &rut=... parameter */
            char *amp = strchr(actual_url, '&');
            if (amp) *amp = 0;
        } else {
            strncpy(actual_url, href_start, url_len);
            actual_url[url_len] = 0;
        }
        
        /* Find title text after the href */
        char *title_start = href_end + 1;
        /* Skip to > */
        char *gt = strchr(title_start, '>');
        if (!gt) { p = link_start + 10; continue; }
        title_start = gt + 1;
        char *title_end = strstr(title_start, "</a>");
        if (!title_end) { p = link_start + 10; continue; }
        int title_len = title_end - title_start;
        if (title_len > 511) title_len = 511;
        
        /* Find snippet */
        char *snippet_start = strstr(title_end, "class=\"result__snippet\"");
        char snippet[1024] = "";
        if (snippet_start) {
            char *sn_gt = strchr(snippet_start, '>');
            if (sn_gt) {
                char *sn_end = strstr(sn_gt + 1, "</a>");
                if (sn_end) {
                    int sn_len = sn_end - sn_gt - 1;
                    if (sn_len > 1023) sn_len = 1023;
                    strncpy(snippet, sn_gt + 1, sn_len);
                    snippet[sn_len] = 0;
                    strip_html(snippet);
                    decode_html(snippet);
                }
            }
        }
        
        /* Add result */
        strncpy(results[*count].url, actual_url, 1023);
        strncpy(results[*count].title, title_start, title_len);
        results[*count].title[title_len] = 0;
        strip_html(results[*count].title);
        decode_html(results[*count].title);
        strncpy(results[*count].content, snippet, 1023);
        strcpy(results[*count].engine, "ddg-html");
        strcpy(results[*count].source, "DuckDuckGo Web");
        results[*count].featured = 0;
        (*count)++;
        found++;
        
        p = title_end + 4;
    }
    
    free(buf);
}

/* Reddit JSON API - forum discussions that Google demotes */
static void search_reddit(const char *query, SearchResult *results, int *count, int max) {
    char *encoded = url_encode(query);
    char url[1024];
    snprintf(url, sizeof(url),
        "https://www.reddit.com/search.json?q=%s&sort=relevance&limit=10&t=year", encoded);
    free(encoded);
    
    char *raw = http_get(url, "DeryCodeSearch/1.0 (bot)");
    if (!raw) return;
    
    JsonValue *json = json_parse(raw);
    free(raw);
    if (!json) return;
    
    JsonValue *data = json_get_array(json, "data");
    if (data) {
        JsonValue *children = json_get_array(data, "children");
        if (children) {
            int len = json_array_len(children);
            for (int i = 0; i < len && *count < max; i++) {
                JsonValue *child = json_array_at(children, i);
                if (!child) continue;
                JsonValue *child_data = json_get_array(child, "data");
                if (!child_data) continue;
                const char *title = json_get_string(child_data, "title");
                const char *permalink = json_get_string(child_data, "permalink");
                const char *selftext = json_get_string(child_data, "selftext");
                const char *subreddit = json_get_string(child_data, "subreddit");
                int score = 0;
                const char *score_str = json_get_string(child_data, "score");
                if (score_str) score = atoi(score_str);
                
                if (title && permalink) {
                    snprintf(results[*count].title, 511, "%s [r/%s]", title, subreddit ? subreddit : "reddit");
                    snprintf(results[*count].url, 1023, "https://www.reddit.com%s", permalink);
                    if (selftext && strlen(selftext) > 10) {
                        strncpy(results[*count].content, selftext, 800);
                        results[*count].content[800] = 0;
                        strip_html(results[*count].content);
                    } else {
                        snprintf(results[*count].content, 1023, "Reddit discussion - %d upvotes", score);
                    }
                    strcpy(results[*count].engine, "reddit");
                    strcpy(results[*count].source, "Reddit");
                    (*count)++;
                }
            }
        }
    }
    json_free(json);
}

/* Hacker News via Algolia API - tech discussions */
static void search_hackernews(const char *query, SearchResult *results, int *count, int max) {
    char *encoded = url_encode(query);
    char url[1024];
    snprintf(url, sizeof(url),
        "https://hn.algolia.com/api/v1/search?query=%s&tags=story&hitsPerPage=8", encoded);
    free(encoded);
    
    char *raw = http_get(url, "DeryCodeSearch/1.0");
    if (!raw) return;
    
    JsonValue *json = json_parse(raw);
    free(raw);
    if (!json) return;
    
    JsonValue *hits = json_get_array(json, "hits");
    if (hits) {
        int len = json_array_len(hits);
        for (int i = 0; i < len && *count < max; i++) {
            JsonValue *hit = json_array_at(hits, i);
            if (!hit) continue;
            const char *title = json_get_string(hit, "title");
            const char *hn_url = json_get_string(hit, "url");
            const char *objectID = json_get_string(hit, "objectID");
            const char *story_text = json_get_string(hit, "story_text");
            int points = 0;
            const char *points_str = json_get_string(hit, "points");
            if (points_str) points = atoi(points_str);
            
            if (title) {
                strncpy(results[*count].title, title, 511);
                if (hn_url && strlen(hn_url) > 5) {
                    strncpy(results[*count].url, hn_url, 1023);
                } else if (objectID) {
                    snprintf(results[*count].url, 1023, "https://news.ycombinator.com/item?id=%s", objectID);
                }
                if (story_text && strlen(story_text) > 10) {
                    strncpy(results[*count].content, story_text, 800);
                    results[*count].content[800] = 0;
                    strip_html(results[*count].content);
                } else {
                    snprintf(results[*count].content, 1023, "Hacker News story - %d points", points);
                }
                strcpy(results[*count].engine, "hackernews");
                strcpy(results[*count].source, "Hacker News");
                (*count)++;
            }
        }
    }
    json_free(json);
}

/* Stack Exchange API - Q&A from Stack Overflow and friends */
static void search_stackexchange(const char *query, SearchResult *results, int *count, int max) {
    char *encoded = url_encode(query);
    char url[1024];
    snprintf(url, sizeof(url),
        "https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=votes&q=%s&pagesize=8&site=stackoverflow&filter=withbody", encoded);
    free(encoded);
    
    char *raw = http_get(url, "DeryCodeSearch/1.0");
    if (!raw) return;
    
    JsonValue *json = json_parse(raw);
    free(raw);
    if (!json) return;
    
    JsonValue *items = json_get_array(json, "items");
    if (items) {
        int len = json_array_len(items);
        for (int i = 0; i < len && *count < max; i++) {
            JsonValue *item = json_array_at(items, i);
            if (!item) continue;
            const char *title = json_get_string(item, "title");
            const char *link = json_get_string(item, "link");
            const char *body = json_get_string(item, "body");
            int score = 0;
            const char *score_str = json_get_string(item, "score");
            if (score_str) score = atoi(score_str);
            
            if (title) {
                strncpy(results[*count].title, title, 511);
                strip_html(results[*count].title);
                decode_html(results[*count].title);
                if (link) strncpy(results[*count].url, link, 1023);
                if (body) {
                    strncpy(results[*count].content, body, 800);
                    results[*count].content[800] = 0;
                    strip_html(results[*count].content);
                    decode_html(results[*count].content);
                } else {
                    snprintf(results[*count].content, 1023, "Stack Overflow - %d votes", score);
                }
                strcpy(results[*count].engine, "stackexchange");
                strcpy(results[*count].source, "Stack Overflow");
                (*count)++;
            }
        }
    }
    json_free(json);
}

/* ArXiv API - academic papers (preprints, not behind paywalls) */
static void search_arxiv(const char *query, SearchResult *results, int *count, int max) {
    char *encoded = url_encode(query);
    char url[1024];
    snprintf(url, sizeof(url),
        "https://export.arxiv.org/api/query?search_query=all:%s&max_results=5&sortBy=relevance", encoded);
    free(encoded);
    
    /* ArXiv returns XML, not JSON - use curl and parse with grep/sed */
    char cmd[4096];
    snprintf(cmd, sizeof(cmd),
        "curl -s -L --max-time 8 -A \"DeryCodeSearch/1.0\" \"%s\" 2>/dev/null", url);
    
    FILE *fp = popen(cmd, "r");
    if (!fp) return;
    
    size_t cap = 65536;
    char *buf = malloc(cap);
    size_t len = 0, r;
    while ((r = fread(buf + len, 1, cap - len - 1, fp)) > 0) {
        len += r;
        if (len >= cap - 1) { cap *= 2; buf = realloc(buf, cap); }
    }
    buf[len] = 0;
    pclose(fp);
    
    if (len == 0) { free(buf); return; }
    
    /* Parse XML entries: <entry><title>...</title><summary>...</summary><id>...</id></entry> */
    char *p = buf;
    int found = 0;
    while (p && *p && *count < max && found < 5) {
        char *entry = strstr(p, "<entry>");
        if (!entry) break;
        char *entry_end = strstr(entry, "</entry>");
        if (!entry_end) break;
        
        /* Title */
        char *title_start = strstr(entry, "<title>");
        char *title_end = strstr(title_start ? title_start : entry, "</title>");
        char *summary_start = strstr(entry, "<summary>");
        char *summary_end = strstr(summary_start ? summary_start : entry, "</summary>");
        char *id_start = strstr(entry, "<id>");
        char *id_end = strstr(id_start ? id_start : entry, "</id>");
        
        if (title_start && title_end && id_start && id_end) {
            title_start += 7;
            int tlen = title_end - title_start;
            if (tlen > 511) tlen = 511;
            strncpy(results[*count].title, title_start, tlen);
            results[*count].title[tlen] = 0;
            /* Clean whitespace */
            char *ws = results[*count].title;
            while (*ws == ' ' || *ws == '\n' || *ws == '\t') ws++;
            if (ws != results[*count].title) memmove(results[*count].title, ws, strlen(ws)+1);
            
            id_start += 4;
            int ilen = id_end - id_start;
            if (ilen > 1023) ilen = 1023;
            strncpy(results[*count].url, id_start, ilen);
            results[*count].url[ilen] = 0;
            /* Strip trailing whitespace */
            char *urlend = results[*count].url + strlen(results[*count].url) - 1;
            while (urlend > results[*count].url && (*urlend == ' ' || *urlend == '\n')) *urlend-- = 0;
            
            if (summary_start && summary_end) {
                summary_start += 9;
                int slen = summary_end - summary_start;
                if (slen > 800) slen = 800;
                strncpy(results[*count].content, summary_start, slen);
                results[*count].content[slen] = 0;
                strip_html(results[*count].content);
            } else {
                strcpy(results[*count].content, "ArXiv preprint paper");
            }
            
            strcpy(results[*count].engine, "arxiv");
            strcpy(results[*count].source, "ArXiv");
            (*count)++;
            found++;
        }
        
        p = entry_end + 8;
    }
    
    free(buf);
}

/* Internet Archive - archived content, old pages, media */
static void search_archive(const char *query, SearchResult *results, int *count, int max) {
    char *encoded = url_encode(query);
    char url[1024];
    snprintf(url, sizeof(url),
        "https://archive.org/advancedsearch.php?q=%s&fl[]=identifier&fl[]=title&fl[]=description&fl[]=downloads&rows=5&output=json&sort[]=downloads+desc", encoded);
    free(encoded);
    
    char *raw = http_get(url, "DeryCodeSearch/1.0");
    if (!raw) return;
    
    JsonValue *json = json_parse(raw);
    free(raw);
    if (!json) return;
    
    JsonValue *response = json_get_array(json, "response");
    if (response) {
        JsonValue *docs = json_get_array(response, "docs");
        if (docs) {
            int len = json_array_len(docs);
            for (int i = 0; i < len && *count < max; i++) {
                JsonValue *doc = json_array_at(docs, i);
                if (!doc) continue;
                const char *id = json_get_string(doc, "identifier");
                const char *title = json_get_string(doc, "title");
                const char *desc = json_get_string(doc, "description");
                
                if (id) {
                    snprintf(results[*count].title, 511, "%s", title ? title : id);
                    snprintf(results[*count].url, 1023, "https://archive.org/details/%s", id);
                    if (desc) {
                        strncpy(results[*count].content, desc, 800);
                        results[*count].content[800] = 0;
                        strip_html(results[*count].content);
                    } else {
                        strcpy(results[*count].content, "Internet Archive item");
                    }
                    strcpy(results[*count].engine, "archive");
                    strcpy(results[*count].source, "Internet Archive");
                    (*count)++;
                }
            }
        }
    }
    json_free(json);
}

/* Open Library - book search */
static void search_openlibrary(const char *query, SearchResult *results, int *count, int max) {
    char *encoded = url_encode(query);
    char url[1024];
    snprintf(url, sizeof(url),
        "https://openlibrary.org/search.json?q=%s&limit=5&fields=title,author_name,first_publish_year,subject,id", encoded);
    free(encoded);
    
    char *raw = http_get(url, "DeryCodeSearch/1.0");
    if (!raw) return;
    
    JsonValue *json = json_parse(raw);
    free(raw);
    if (!json) return;
    
    JsonValue *docs = json_get_array(json, "docs");
    if (docs) {
        int len = json_array_len(docs);
        for (int i = 0; i < len && *count < max; i++) {
            JsonValue *doc = json_array_at(docs, i);
            if (!doc) continue;
            const char *title = json_get_string(doc, "title");
            const char *key = json_get_string(doc, "key");
            
            if (title && key) {
                snprintf(results[*count].title, 511, "%s - Book", title);
                snprintf(results[*count].url, 1023, "https://openlibrary.org%s", key);
                
                /* Get author */
                JsonValue *authors = json_get_array(doc, "author_name");
                char author_str[256] = "";
                if (authors) {
                    const char *author = json_get_string(authors, "0");
                    if (author) snprintf(author_str, 255, "by %s", author);
                }
                
                const char *year = json_get_string(doc, "first_publish_year");
                if (year && strlen(author_str) > 0) {
                    snprintf(results[*count].content, 1023, "Book %s, first published %s", author_str, year);
                } else if (strlen(author_str) > 0) {
                    snprintf(results[*count].content, 1023, "Book %s", author_str);
                } else {
                    strcpy(results[*count].content, "Open Library book entry");
                }
                
                strcpy(results[*count].engine, "openlibrary");
                strcpy(results[*count].source, "Open Library");
                (*count)++;
            }
        }
    }
    json_free(json);
}

/* Semantic Scholar - research papers */
static void search_semantic_scholar(const char *query, SearchResult *results, int *count, int max) {
    char *encoded = url_encode(query);
    char url[1024];
    snprintf(url, sizeof(url),
        "https://api.semanticscholar.org/graph/v1/paper/search?query=%s&limit=5&fields=title,abstract,year,url,authors", encoded);
    free(encoded);
    
    char *raw = http_get(url, "DeryCodeSearch/1.0");
    if (!raw) return;
    
    JsonValue *json = json_parse(raw);
    free(raw);
    if (!json) return;
    
    JsonValue *data = json_get_array(json, "data");
    if (data) {
        int len = json_array_len(data);
        for (int i = 0; i < len && *count < max; i++) {
            JsonValue *paper = json_array_at(data, i);
            if (!paper) continue;
            const char *title = json_get_string(paper, "title");
            const char *paper_url = json_get_string(paper, "url");
            const char *abstract = json_get_string(paper, "abstract");
            const char *year = json_get_string(paper, "year");
            
            if (title) {
                if (year) {
                    snprintf(results[*count].title, 511, "%s (%s) - Research Paper", title, year);
                } else {
                    snprintf(results[*count].title, 511, "%s - Research Paper", title);
                }
                if (paper_url) {
                    strncpy(results[*count].url, paper_url, 1023);
                } else {
                    strcpy(results[*count].url, "https://www.semanticscholar.org");
                }
                if (abstract) {
                    strncpy(results[*count].content, abstract, 800);
                    results[*count].content[800] = 0;
                } else {
                    strcpy(results[*count].content, "Academic research paper from Semantic Scholar");
                }
                strcpy(results[*count].engine, "semantic-scholar");
                strcpy(results[*count].source, "Semantic Scholar");
                (*count)++;
            }
        }
    }
    json_free(json);
}


/* Main search function */
static SearchResponse *perform_search(const char *query) {
    SearchResponse *resp = calloc(1, sizeof(SearchResponse));
    struct timeval start, end;
    gettimeofday(&start, NULL);
    
    /* Search ALL sources - deep dive, no filtering */
    search_duckduckgo(query, resp->results, &resp->result_count, 128);
    search_wikipedia(query, resp->results, &resp->result_count, 128, &resp->kp);
    search_github(query, resp->results, &resp->result_count, 128);
    search_duckduckgo_html(query, resp->results, &resp->result_count, 128);
    search_reddit(query, resp->results, &resp->result_count, 128);
    search_hackernews(query, resp->results, &resp->result_count, 128);
    search_stackexchange(query, resp->results, &resp->result_count, 128);
    search_arxiv(query, resp->results, &resp->result_count, 128);
    search_archive(query, resp->results, &resp->result_count, 128);
    search_openlibrary(query, resp->results, &resp->result_count, 128);
    search_semantic_scholar(query, resp->results, &resp->result_count, 128);
    
    /* Post-process */
    dedup_results(resp);
    generate_ai_summary(resp);
    generate_related(query, resp);
    
    gettimeofday(&end, NULL);
    resp->elapsed = (end.tv_sec - start.tv_sec) + (end.tv_usec - start.tv_usec) / 1000000.0;
    
    return resp;
}

#endif

/* ============ DERICK AGENT - Step-by-Step Practical Guide ============ */

/* Derick step structure */
typedef struct {
    char title[256];
    char content[1024];
    char source_url[1024];
    char source_name[128];
} DerickStep;

/* Derick guide response */
typedef struct {
    DerickStep steps[15];
    int step_count;
    char intro[1024];
    char topic[256];
    char tips[512];
    char warnings[512];
    int has_data;
} DerickGuide;

/* Check if query is practical/how-to type */
static int is_practical_query(const char *query) {
    const char *indicators[] = {
        "how to", "how do", "how can", "what is", "what are",
        "explain", "understand", "learn", "build", "create",
        "make", "setup", "set up", "install", "configure",
        "deploy", "implement", "use", "fix", "solve",
        "start", "begin", "step by step", "guide", "tutorial",
        "practical", "example", "do i", "can i", "should i",
        NULL
    };
    for (int i = 0; indicators[i]; i++) {
        if (strcasestr(query, indicators[i])) return 1;
    }
    return 0;
}

/* Generate step-by-step practical guide from search results */
static DerickGuide *generate_derick_guide(const char *query, SearchResponse *search) {
    DerickGuide *guide = calloc(1, sizeof(DerickGuide));
    
    if (!search || search->result_count == 0) {
        snprintf(guide->intro, 1023, "I couldn't find enough information to create a practical guide for \"%s\". Try rephrasing your question.", query);
        guide->has_data = 0;
        return guide;
    }
    
    strncpy(guide->topic, query, 255);
    guide->has_data = 1;
    
    /* Build intro from knowledge panel or first result */
    if (search->kp.has_data && strlen(search->kp.extract) > 50) {
        /* Extract first 2 sentences for intro */
        char intro[1024];
        extract_key_sentences(search->kp.extract, intro, sizeof(intro));
        snprintf(guide->intro, 1023, "Here's a practical breakdown of \"%s\":\n\n%s", query, intro);
    } else if (search->results[0].content && strlen(search->results[0].content) > 30) {
        char intro[1024];
        extract_key_sentences(search->results[0].content, intro, sizeof(intro));
        snprintf(guide->intro, 1023, "Here's a practical breakdown of \"%s\":\n\n%s", query, intro);
    } else {
        snprintf(guide->intro, 1023, "Here's a practical, step-by-step breakdown of \"%s\" based on what I found across the web.", query);
    }
    
    /* Generate steps from search results */
    int step = 0;
    
    /* Step 1: Understanding - use knowledge panel or Wikipedia */
    if (search->kp.has_data && step < 15) {
        snprintf(guide->steps[step].title, 255, "Understand the basics");
        char content[1024];
        extract_key_sentences(search->kp.extract, content, sizeof(content));
        snprintf(guide->steps[step].content, 1023,
            "Before diving in, here's what you need to know:\n%s", content);
        strncpy(guide->steps[step].source_url, search->kp.url, 1023);
        strncpy(guide->steps[step].source_name, "Wikipedia", 127);
        step++;
    }
    
    /* Step 2+: Extract practical steps from results */
    for (int i = 0; i < search->result_count && step < 15; i++) {
        SearchResult *r = &search->results[i];
        if (!r->content || strlen(r->content) < 40) continue;
        
        /* Skip if we already used this as knowledge panel */
        if (i == 0 && search->kp.has_data) continue;
        
        /* Check if result has practical content */
        const char *practical_indicators[] = {
            "step", "first", "then", "next", "after", "begin", "start",
            "install", "create", "build", "configure", "use",
            "require", "need", "must", "should", "important",
            "option", "choose", "select", "click", "run", "type",
            "code", "command", "example", "tutorial", "guide",
            NULL
        };
        
        int is_practical = 0;
        for (int p = 0; practical_indicators[p]; p++) {
            if (strcasestr(r->content, practical_indicators[p])) {
                is_practical = 1;
                break;
            }
        }
        
        if (!is_practical) continue;
        
        /* Generate step title from result title */
        char step_title[256];
        strncpy(step_title, r->title, 255);
        step_title[255] = 0;
        
        /* Clean up title - remove "- Wikipedia", " - GitHub", etc */
        char *dash = strstr(step_title, " - ");
        if (dash) *dash = 0;
        if (strlen(step_title) > 80) {
            step_title[77] = '.';
            step_title[78] = '.';
            step_title[79] = '.';
            step_title[80] = 0;
        }
        
        /* Generate step number */
        snprintf(guide->steps[step].title, 255, "Step %d: %s", step, step_title);
        
        /* Use the content as the step explanation */
        char content[1024];
        extract_key_sentences(r->content, content, sizeof(content));
        if (strlen(content) > 30) {
            strncpy(guide->steps[step].content, content, 1023);
        } else {
            strncpy(guide->steps[step].content, r->content, 1023);
        }
        
        strncpy(guide->steps[step].source_url, r->url, 1023);
        strncpy(guide->steps[step].source_name, r->source, 127);
        step++;
    }
    
    /* If we couldn't extract practical steps, create generic ones from all results */
    if (step == 0 || (step == 1 && search->kp.has_data)) {
        for (int i = 0; i < search->result_count && step < 10; i++) {
            SearchResult *r = &search->results[i];
            if (!r->content || strlen(r->content) < 40) continue;
            if (i == 0 && search->kp.has_data) continue;
            
            char step_title[256];
            strncpy(step_title, r->title, 255);
            step_title[255] = 0;
            char *dash = strstr(step_title, " - ");
            if (dash) *dash = 0;
            if (strlen(step_title) > 80) {
                step_title[77] = '.';
                step_title[78] = '.';
                step_title[79] = '.';
                step_title[80] = 0;
            }
            
            snprintf(guide->steps[step].title, 255, "Step %d: %s", step, step_title);
            char content[1024];
            extract_key_sentences(r->content, content, sizeof(content));
            strncpy(guide->steps[step].content, content, 1023);
            strncpy(guide->steps[step].source_url, r->url, 1023);
            strncpy(guide->steps[step].source_name, r->source, 127);
            step++;
        }
    }
    
    guide->step_count = step;
    
    /* Generate tips from related searches */
    if (search->related[0][0]) {
        snprintf(guide->tips, 511,
            "Pro tips:\n- %s\n- %s\n- %s",
            search->related[0], search->related[3], search->related[4]);
    }
    
    /* Generate warnings */
    snprintf(guide->warnings, 511,
        "Remember: This guide is generated from live web results. "
        "Always verify critical steps with the original sources.");
    
    return guide;
}

/* Free Derick guide */
static void free_derick_guide(DerickGuide *guide) {
    if (guide) free(guide);
}

/* Build Derick JSON response */
static char *build_derick_json(DerickGuide *guide, const char *query) {
    char *json = malloc(MAX_RESPONSE);
    int offset = 0;
    
    char topic[512], intro[2048];
    json_escape(topic, guide->topic, 512);
    json_escape(intro, guide->intro, 2048);
    
    offset += sprintf(json + offset,
        "{\"query\":\"%s\",\"topic\":\"%s\",\"intro\":\"%s\",",
        query, topic, intro);
    
    /* Steps */
    offset += sprintf(json + offset, "\"steps\":[");
    for (int i = 0; i < guide->step_count; i++) {
        if (i > 0) offset += sprintf(json + offset, ",");
        char title[512], content[2048], source_url[2048], source_name[256];
        json_escape(title, guide->steps[i].title, 512);
        json_escape(content, guide->steps[i].content, 2048);
        json_escape(source_url, guide->steps[i].source_url, 2048);
        json_escape(source_name, guide->steps[i].source_name, 256);
        offset += sprintf(json + offset,
            "{\"step\":%d,\"title\":\"%s\",\"content\":\"%s\",\"source_url\":\"%s\",\"source_name\":\"%s\"}",
            i + 1, title, content, source_url, source_name);
    }
    offset += sprintf(json + offset, "]");
    
    /* Tips */
    char tips[1024];
    json_escape(tips, guide->tips, 1024);
    offset += sprintf(json + offset, ",\"tips\":\"%s\"", tips);
    
    /* Warnings */
    char warnings[1024];
    json_escape(warnings, guide->warnings, 1024);
    offset += sprintf(json + offset, ",\"warnings\":\"%s\"", warnings);
    
    /* Meta */
    offset += sprintf(json + offset,
        ",\"step_count\":%d,\"has_data\":%s,\"agent\":\"Derick\"}",
        guide->step_count, guide->has_data ? "true" : "false");
    
    return json;
}


/* ============ AI ANSWER SYNTHESIS (Gemini-style) ============ */

/* AI conversation message */
typedef struct {
    char role[16];    /* "user" or "assistant" */
    char content[2048];
} AiMessage;

/* AI response */
typedef struct {
    char answer[4096];
    char followups[3][256];
    int has_answer;
    /* Source citations */
    char source_titles[5][512];
    char source_urls[5][1024];
    int source_count;
} AiResponse;

#include "knowledge.h"

/* Extract the most relevant sentences from text */
static void extract_key_sentences(const char *text, char *output, int max_len) {
    if (!text || !*text) { output[0] = 0; return; }
    
    /* Split into sentences */
    const char *start = text;
    int out_pos = 0;
    int sentences_added = 0;
    int max_sentences = 4;
    
    while (*start && out_pos < max_len - 1 && sentences_added < max_sentences) {
        /* Find end of sentence */
        const char *end = start;
        while (*end && *end != '.' && *end != '!' && *end != '?') end++;
        if (*end) end++; /* include the punctuation */
        
        int len = end - start;
        if (len > 30 && len < 500) {
            /* This looks like a real sentence */
            if (out_pos > 0 && out_pos < max_len - 2) {
                output[out_pos++] = ' ';
            }
            int copy_len = len;
            if (out_pos + copy_len >= max_len - 1) {
                copy_len = max_len - 1 - out_pos;
            }
            memcpy(output + out_pos, start, copy_len);
            out_pos += copy_len;
            sentences_added++;
        }
        
        start = end;
        while (*start == ' ' || *start == '\n' || *start == '\t') start++;
    }
    output[out_pos] = 0;
}

/* Generate AI-style answer from search results */
static AiResponse *generate_ai_answer(const char *question, SearchResponse *search, AiMessage *history, int history_count) {
    AiResponse *resp = calloc(1, sizeof(AiResponse));
    
    /* Check DeryCode knowledge base first */
    if (is_derycode_query(question)) {
        const char *knowledge = get_derycode_knowledge(question);
        if (knowledge) {
            char truncated[4096];
            truncate_words(knowledge, truncated, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
            strncpy(resp->answer, truncated, 4095);
            resp->has_answer = 1;
            
            /* Add DeryCode sources */
            add_derycode_sources(resp);
            
            /* Generate follow-ups */
            snprintf(resp->followups[0], 255, "What services does DeryCode offer?");
            snprintf(resp->followups[1], 255, "How much does a website cost at DeryCode?");
            snprintf(resp->followups[2], 255, "How can I contact DeryCode?");
            
            printf("[AI] Answered from DeryCode knowledge base\n");
            return resp;
        }
    }
    
    char answer[4096] = "";
    int pos = 0;
    
    /* If we have conversation history, build a better search query */
    char effective_query[1024];
    strncpy(effective_query, question, 1023);
    
    if (history_count > 0) {
        /* Find the main topic from previous conversation */
        char main_topic[256] = "";
        for (int i = history_count - 1; i >= 0; i--) {
            if (strcmp(history[i].role, "user") == 0) {
                /* Extract key noun from first user message */
                if (i == 0 || strlen(main_topic) == 0) {
                    strncpy(main_topic, history[i].content, 255);
                    /* Try to extract just the topic (remove question words) */
                    char *p = main_topic;
                    /* Skip common question starters */
                    const char *starters[] = {"what is ", "what is the ", "what is a ", "who is ", "who is the ",
                                              "tell me about ", "explain ", "describe ", NULL};
                    for (int s = 0; starters[s]; s++) {
                        int slen = strlen(starters[s]);
                        if (strncasecmp(p, starters[s], slen) == 0) {
                            p += slen;
                            break;
                        }
                    }
                    if (p != main_topic) {
                        memmove(main_topic, p, strlen(p) + 1);
                    }
                    break;
                }
            }
        }
        
        /* If the current question is a follow-up (short, references "it", "its", "this") */
        int qlen = strlen(question);
        if (qlen < 60 && strlen(main_topic) > 0) {
            /* Check for follow-up indicators */
            const char *followup_words[] = {"its ", "it ", "this ", "that ", "the ", "about ", "more ", NULL};
            int is_followup = 0;
            for (int w = 0; followup_words[w]; w++) {
                if (strncasecmp(question, followup_words[w], strlen(followup_words[w])) == 0) {
                    is_followup = 1; break;
                }
            }
            if (is_followup || qlen < 25) {
                /* Combine topic with question for better search */
                snprintf(effective_query, sizeof(effective_query), "%s %s", main_topic, question);
            }
        }
    }
    
    /* If we refined the query, re-search */
    SearchResponse *effective_search = search;
    SearchResponse *new_search = NULL;
    if (strcmp(effective_query, question) != 0) {
        printf("[AI] Refined query: %s -> %s\n", question, effective_query);
        new_search = perform_search(effective_query);
        if (new_search && new_search->result_count > 0) {
            effective_search = new_search;
        }
    }
    
    /* Build the answer */
    /* Start with knowledge panel if available */
    if (effective_search->kp.has_data && strlen(effective_search->kp.extract) > 50) {
        char key_text[2048];
        extract_key_sentences(effective_search->kp.extract, key_text, sizeof(key_text));
        if (strlen(key_text) > 30) {
            pos += snprintf(answer + pos, sizeof(answer) - pos, "%s", key_text);
            if (resp->source_count < 5) {
                strncpy(resp->source_titles[resp->source_count], effective_search->kp.title, 511);
                strncpy(resp->source_urls[resp->source_count], 
                    strlen(effective_search->kp.url) > 0 ? effective_search->kp.url : "https://en.wikipedia.org", 1023);
                resp->source_count++;
            }
        }
    }
    
    /* Add featured DuckDuckGo result */
    for (int i = 0; i < effective_search->result_count; i++) {
        if (effective_search->results[i].featured && strlen(effective_search->results[i].content) > 30) {
            if (pos > 0 && pos < (int)sizeof(answer) - 3) {
                answer[pos++] = '\n'; answer[pos++] = '\n';
            }
            char key_text[2048];
            extract_key_sentences(effective_search->results[i].content, key_text, sizeof(key_text));
            pos += snprintf(answer + pos, sizeof(answer) - pos, "%s", key_text);
            if (resp->source_count < 5) {
                strncpy(resp->source_titles[resp->source_count], effective_search->results[i].title, 511);
                strncpy(resp->source_urls[resp->source_count], effective_search->results[i].url, 1023);
                resp->source_count++;
            }
            break;
        }
    }
    
    /* Add other relevant results */
    int added = 0;
    for (int i = 0; i < effective_search->result_count && added < 2; i++) {
        if (effective_search->results[i].featured) continue;
        if (strlen(effective_search->results[i].content) > 50) {
            char key_text[1024];
            extract_key_sentences(effective_search->results[i].content, key_text, sizeof(key_text));
            if (strlen(key_text) > 30) {
                if (pos > 0 && pos < (int)sizeof(answer) - 3) {
                    answer[pos++] = '\n'; answer[pos++] = '\n';
                }
                pos += snprintf(answer + pos, sizeof(answer) - pos, "%s", key_text);
                if (resp->source_count < 5) {
                    strncpy(resp->source_titles[resp->source_count], effective_search->results[i].title, 511);
                    strncpy(resp->source_urls[resp->source_count], effective_search->results[i].url, 1023);
                    resp->source_count++;
                }
                added++;
            }
        }
    }
    
    /* Clean up HTML entities in answer */
    /* Replace &quot; with ", &amp; with &, &lt; with <, &gt; with >, &#39; with ' */
    char cleaned[4096];
    int ci = 0;
    for (int i = 0; answer[i] && ci < 4095; i++) {
        if (answer[i] == '&') {
            if (strncmp(&answer[i], "&quot;", 6) == 0) { cleaned[ci++] = '\"'; i += 5; continue; }
            if (strncmp(&answer[i], "&amp;", 5) == 0) { cleaned[ci++] = '&'; i += 4; continue; }
            if (strncmp(&answer[i], "&lt;", 4) == 0) { cleaned[ci++] = '<'; i += 3; continue; }
            if (strncmp(&answer[i], "&gt;", 4) == 0) { cleaned[ci++] = '>'; i += 3; continue; }
            if (strncmp(&answer[i], "&#39;", 5) == 0) { cleaned[ci++] = '\''; i += 4; continue; }
            if (strncmp(&answer[i], "&#", 2) == 0) {
                /* Skip numeric entities */
                char *end = strchr(&answer[i], ';');
                if (end) { i = end - answer; continue; }
            }
        }
        cleaned[ci++] = answer[i];
    }
    cleaned[ci] = 0;
    /* Enforce word/char limit on AI answer */
    char truncated[4096];
    truncate_words(cleaned, truncated, MAX_ANSWER_WORDS, MAX_ANSWER_CHARS);
    strncpy(resp->answer, truncated, 4095);
    resp->has_answer = 1;
    
    /* Generate smart follow-up suggestions */
    char words[10][64];
    int word_count = 0;
    const char *wstart = effective_query;
    while (*wstart && word_count < 10) {
        while (*wstart == ' ') wstart++;
        const char *wend = wstart;
        while (*wend && *wend != ' ') wend++;
        int wlen = wend - wstart;
        if (wlen > 0 && wlen < 64) {
            memcpy(words[word_count], wstart, wlen);
            words[word_count][wlen] = 0;
            word_count++;
        }
        wstart = wend;
    }
    
    /* Build a clean topic from the effective query */
    char topic[128] = "";
    for (int i = 0; i < word_count && i < 4; i++) {
        /* Skip common question words */
        if (strcasecmp(words[i], "what") == 0 || strcasecmp(words[i], "is") == 0 ||
            strcasecmp(words[i], "the") == 0 || strcasecmp(words[i], "about") == 0 ||
            strcasecmp(words[i], "its") == 0 || strcasecmp(words[i], "it") == 0 ||
            strcasecmp(words[i], "tell") == 0 || strcasecmp(words[i], "me") == 0 ||
            strcasecmp(words[i], "who") == 0 || strcasecmp(words[i], "a") == 0) continue;
        if (strlen(topic) > 0) strncat(topic, " ", sizeof(topic) - strlen(topic) - 1);
        strncat(topic, words[i], sizeof(topic) - strlen(topic) - 1);
    }
    
    if (strlen(topic) > 0) {
        snprintf(resp->followups[0], 255, "Tell me more about %s", topic);
        snprintf(resp->followups[1], 255, "What are the latest news about %s?", topic);
        snprintf(resp->followups[2], 255, "Can you explain %s in simple terms?", topic);
    } else {
        snprintf(resp->followups[0], 255, "Tell me more");
        snprintf(resp->followups[1], 255, "What are the latest developments?");
        snprintf(resp->followups[2], 255, "Can you explain in simpler terms?");
    }
    
    /* Free new search if we created it */
    if (new_search) free(new_search);
    
    return resp;
}



/* Free AI response */
static void free_ai_response(AiResponse *resp) {
    if (resp) free(resp);
}

/* Build AI JSON response */
static char *build_ai_json(AiResponse *ai, SearchResponse *search, const char *question) {
    char *json = malloc(MAX_RESPONSE);
    int offset = 0;
    
    char answer[8192];
    json_escape(answer, ai->answer, 8192);
    
    offset += sprintf(json + offset, "{\"question\":\"%s\",\"answer\":\"%s\",\"model\":\"DeryCode-AI-C-v1\"", 
                      question, answer);
    
    /* Sources */
    offset += sprintf(json + offset, ",\"sources\":[");
    for (int i = 0; i < ai->source_count; i++) {
        if (i > 0) offset += sprintf(json + offset, ",");
        char title[1024], url[2048];
        json_escape(title, ai->source_titles[i], 1024);
        json_escape(url, ai->source_urls[i], 2048);
        offset += sprintf(json + offset, "{\"title\":\"%s\",\"url\":\"%s\"}", title, url);
    }
    offset += sprintf(json + offset, "]");
    
    /* Follow-ups */
    offset += sprintf(json + offset, ",\"followups\":[");
    for (int i = 0; i < 3; i++) {
        if (i > 0) offset += sprintf(json + offset, ",");
        char fu[512];
        json_escape(fu, ai->followups[i], 512);
        offset += sprintf(json + offset, "\"%s\"", fu);
    }
    offset += sprintf(json + offset, "]");
    
    /* Include search results too */
    offset += sprintf(json + offset, ",\"results\":[");
    for (int i = 0; i < search->result_count; i++) {
        if (i > 0) offset += sprintf(json + offset, ",");
        char title[1024], url[2048], content[2048], engine[64];
        json_escape(title, search->results[i].title, 1024);
        json_escape(url, search->results[i].url, 2048);
        json_escape(content, search->results[i].content, 2048);
        json_escape(engine, search->results[i].engine, 64);
        offset += sprintf(json + offset, 
            "{\"title\":\"%s\",\"url\":\"%s\",\"content\":\"%s\",\"engine\":\"%s\"}",
            title, url, content, engine);
    }
    offset += sprintf(json + offset, "]");
    
    offset += sprintf(json + offset, "}");
    
    return json;
}
