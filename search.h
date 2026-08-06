/* Search aggregation module for DeryCode Search */
#ifndef DC_SEARCH_H
#define DC_SEARCH_H

#include "json.h"

/* HTTP response buffer */
typedef struct {
    char *data;
    size_t size;
} HttpResponse;

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
    SearchResult results[32];
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

/* Deduplicate results by URL */
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

/* Main search function */
static SearchResponse *perform_search(const char *query) {
    SearchResponse *resp = calloc(1, sizeof(SearchResponse));
    struct timeval start, end;
    gettimeofday(&start, NULL);
    
    /* Search all sources */
    search_duckduckgo(query, resp->results, &resp->result_count, 32);
    search_wikipedia(query, resp->results, &resp->result_count, 32, &resp->kp);
    search_github(query, resp->results, &resp->result_count, 32);
    
    /* Post-process */
    dedup_results(resp);
    generate_ai_summary(resp);
    generate_related(query, resp);
    
    gettimeofday(&end, NULL);
    resp->elapsed = (end.tv_sec - start.tv_sec) + (end.tv_usec - start.tv_usec) / 1000000.0;
    
    return resp;
}

#endif
