/*
 * DeryCode Search - C HTTP Server with AI - ENHANCED
 * High output limits, 16 sources, book summarization, deep extraction
 * Built in pure C by DeryCode Tech, Uganda
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <sys/wait.h>
#include <sys/time.h>
#include <errno.h>

#include "json.h"
#include "search.h"
#include "languages.h"
#include "knowledge.h"

#define PORT 8080
#define MAX_REQUEST 131072       /* 128KB - was 64KB */
#define MAX_RESPONSE (4*1048576)  /* 4MB - was 1MB */
#define MAX_BODY 262144           /* 256KB - was 32KB */

static volatile int running = 1;

void handle_signal(int sig) {
    (void)sig;
    running = 0;
    printf("\nShutting down DeryCode Search...\n");
    exit(0);
}

static char *url_encode_local(const char *str) {
    char *encoded = malloc(strlen(str) * 3 + 1);
    int j = 0;
    for (int i = 0; str[i]; i++) {
        unsigned char c = str[i];
        if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
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

static void url_decode(char *str) {
    char *dst = str;
    while (*str) {
        if (*str == '%' && str[1] && str[2]) {
            char hex[3] = {str[1], str[2], 0};
            *dst++ = (char)strtol(hex, NULL, 16);
            str += 3;
        } else if (*str == '+') {
            *dst++ = ' ';
            str++;
        } else {
            *dst++ = *str++;
        }
    }
    *dst = 0;
}

static char *get_param(const char *path, const char *param) {
    const char *qmark = strchr(path, '?');
    if (!qmark) return NULL;
    const char *p = qmark + 1;
    int param_len = strlen(param);
    while (p && *p) {
        if (strncmp(p, param, param_len) == 0 && p[param_len] == '=') {
            const char *start = p + param_len + 1;
            const char *end = strchr(start, '&');
            if (!end) end = start + strlen(start);
            int len = end - start;
            char *value = malloc(len + 1);
            memcpy(value, start, len);
            value[len] = 0;
            url_decode(value);
            return value;
        }
        p = strchr(p, '&');
        if (p) p++;
    }
    return NULL;
}

static char *get_json_body(const char *request, int total_len) {
    (void)total_len;
    const char *body_start = strstr(request, "\r\n\r\n");
    if (!body_start) return NULL;
    body_start += 4;
    const char *cl = strcasestr(request, "Content-Length:");
    if (!cl) return strdup(body_start);
    int content_length = atoi(cl + 15);
    if (content_length <= 0 || content_length > MAX_BODY) return NULL;
    char *body = malloc(content_length + 1);
    memcpy(body, body_start, content_length);
    body[content_length] = 0;
    return body;
}

static char *build_search_json(SearchResponse *resp, const char *query) {
    char *json = malloc(MAX_RESPONSE);
    int offset = 0;
    char q_esc[1024]; json_escape(q_esc, query, 1024);
    offset += sprintf(json + offset, "{\"query\":\"%s\",\"count\":%d,\"time\":\"%.2f\",\"source_count\":%d,",
                      q_esc, resp->result_count, resp->elapsed, resp->source_count);
    
    if (resp->kp.has_data) {
        char title[512], extract[8192], thumb[1024], url[2048];
        json_escape(title, resp->kp.title, 512);
        json_escape(extract, resp->kp.extract, 8192);
        json_escape(thumb, resp->kp.thumbnail, 1024);
        json_escape(url, resp->kp.url, 2048);
        offset += sprintf(json + offset, "\"knowledgePanel\":{\"title\":\"%s\",\"extract\":\"%s\"", title, extract);
        if (strlen(thumb) > 0) offset += sprintf(json + offset, ",\"thumbnail\":\"%s\"", thumb);
        if (strlen(url) > 0) offset += sprintf(json + offset, ",\"url\":\"%s\"", url);
        offset += sprintf(json + offset, "},");
    } else {
        offset += sprintf(json + offset, "\"knowledgePanel\":null,");
    }
    
    if (resp->ai.has_data) {
        char summary[8192]; json_escape(summary, resp->ai.text, 8192);
        offset += sprintf(json + offset, "\"aiSummary\":\"%s\",", summary);
    } else {
        offset += sprintf(json + offset, "\"aiSummary\":null,");
    }
    
    offset += sprintf(json + offset, "\"results\":[");
    for (int i = 0; i < resp->result_count; i++) {
        if (i > 0) offset += sprintf(json + offset, ",");
        char title[1024], url[2048], content[8192], engine[64], source[128];
        json_escape(title, resp->results[i].title, 1024);
        json_escape(url, resp->results[i].url, 2048);
        json_escape(content, resp->results[i].content, 8192);
        json_escape(engine, resp->results[i].engine, 64);
        json_escape(source, resp->results[i].source, 128);
        offset += sprintf(json + offset,
            "{\"title\":\"%s\",\"url\":\"%s\",\"content\":\"%s\",\"engine\":\"%s\",\"source\":\"%s\",\"featured\":%d}",
            title, url, content, engine, source, resp->results[i].featured);
    }
    offset += sprintf(json + offset, "],");
    
    /* Books */
    offset += sprintf(json + offset, "\"books\":[");
    for (int i = 0; i < resp->book_count; i++) {
        if (i > 0) offset += sprintf(json + offset, ",");
        char bt[1024], ba[512], bd[8192], bs[256], by[64];
        json_escape(bt, resp->books[i].title, 1024);
        json_escape(ba, resp->books[i].author, 512);
        json_escape(bd, resp->books[i].description, 8192);
        json_escape(bs, resp->books[i].source, 256);
        json_escape(by, resp->books[i].publish_year, 64);
        offset += sprintf(json + offset,
            "{\"title\":\"%s\",\"author\":\"%s\",\"description\":\"%s\",\"source\":\"%s\",\"year\":\"%s\"}",
            bt, ba, bd, bs, by);
    }
    offset += sprintf(json + offset, "],");
    
    /* News */
    offset += sprintf(json + offset, "\"news\":[");
    for (int i = 0; i < resp->news_count; i++) {
        if (i > 0) offset += sprintf(json + offset, ",");
        char nt[1024], ns[4096], nso[256], nd[64], nu[2048];
        json_escape(nt, resp->news[i].title, 1024);
        json_escape(ns, resp->news[i].snippet, 4096);
        json_escape(nso, resp->news[i].source, 256);
        json_escape(nd, resp->news[i].date, 64);
        json_escape(nu, resp->news[i].url, 2048);
        offset += sprintf(json + offset,
            "{\"title\":\"%s\",\"snippet\":\"%s\",\"source\":\"%s\",\"date\":\"%s\",\"url\":\"%s\"}",
            nt, ns, nso, nd, nu);
    }
    offset += sprintf(json + offset, "],");
    
    offset += sprintf(json + offset, "\"related\":[");
    for (int i = 0; i < 10; i++) {
        if (i > 0) offset += sprintf(json + offset, ",");
        char rel[256]; json_escape(rel, resp->related[i], 256);
        offset += sprintf(json + offset, "\"%s\"", rel);
    }
    offset += sprintf(json + offset, "],");
    
    char *encoded = url_encode_local(query);
    offset += sprintf(json + offset,
        "\"external\":{\"google\":\"https://www.google.com/search?q=%s\",\"bing\":\"https://www.bing.com/search?q=%s\",\"duckduckgo\":\"https://duckduckgo.com/?q=%s\",\"youtube\":\"https://www.youtube.com/results?search_query=%s\"},",
        encoded, encoded, encoded, encoded);
    free(encoded);
    
    offset += sprintf(json + offset, "\"limits\":{\"maxQueryWords\":%d,\"maxAnswerWords\":%d,\"maxResults\":%d,\"sources\":%d}",
                      MAX_QUERY_WORDS, MAX_ANSWER_WORDS, MAX_RESULTS, resp->source_count);
    
    offset += sprintf(json + offset, "}");
    return json;
}

static void serve_html(int client_fd) {
    FILE *f = fopen("public/index.html", "r");
    if (!f) {
        const char *err = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
        write(client_fd, err, strlen(err));
        return;
    }
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);
    char *html = malloc(size + 1);
    fread(html, 1, size, f);
    html[size] = 0;
    fclose(f);
    char header[256];
    snprintf(header, sizeof(header),
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: %ld\r\nCache-Control: max-age=3600\r\n\r\n", size);
    write(client_fd, header, strlen(header));
    write(client_fd, html, size);
    free(html);
}

static void send_json(int client_fd, const char *json, int status) {
    int len = strlen(json);
    char header[256];
    snprintf(header, sizeof(header),
        "HTTP/1.1 %d OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: %d\r\nAccess-Control-Allow-Origin: *\r\n\r\n",
        status, len);
    write(client_fd, header, strlen(header));
    write(client_fd, json, len);
}

static void serve_search(int client_fd, const char *path) {
    char *query = get_param(path, "q");
    char *deep = get_param(path, "deep");
    if (!query || strlen(query) == 0) {
        send_json(client_fd, "{\"error\":\"Query is required\"}", 400);
        if (query) free(query); if (deep) free(deep);
        return;
    }
    int words = count_words(query);
    if (words > MAX_QUERY_WORDS) {
        char err[256];
        snprintf(err, sizeof(err), "{\"error\":\"Query too long. Max %d words. You used %d.\"}", MAX_QUERY_WORDS, words);
        send_json(client_fd, err, 400);
        free(query); if (deep) free(deep);
        return;
    }
    printf("[SEARCH] %s (%d words, deep: %s)\n", query, words, deep ? "yes" : "no");
    SearchResponse *resp = (deep && strcmp(deep, "1") == 0) ? perform_deep_search(query) : perform_search(query);
    char *json = build_search_json(resp, query);
    send_json(client_fd, json, 200);
    free(json); free(resp); free(query); if (deep) free(deep);
}

static void serve_ai(int client_fd, const char *request, int total_len, const char *path) {
    char *query = NULL;
    AiMessage history[20]; int history_count = 0;
    char lang_code[8] = "en";
    if (strncmp(request, "POST", 4) == 0) {
        char *body = get_json_body(request, total_len);
        if (body) {
            JsonValue *json = json_parse(body); free(body);
            if (json) {
                const char *q = json_get_string(json, "question"); if (q) query = strdup(q);
                const char *lang = json_get_string(json, "lang"); if (lang) strncpy(lang_code, lang, 7);
                JsonValue *hist = json_get_array(json, "history");
                if (hist && hist->type == JSON_ARR) {
                    int len = json_array_len(hist); if (len > 20) len = 20;
                    for (int i = 0; i < len; i++) {
                        JsonValue *msg = json_array_at(hist, i);
                        if (msg && msg->type == JSON_OBJ) {
                            const char *role = json_get_string(msg, "role"), *content = json_get_string(msg, "content");
                            if (role && content) { strncpy(history[history_count].role, role, 15); strncpy(history[history_count].content, content, 4095); history_count++; }
                        }
                    }
                }
                json_free(json);
            }
        }
    } else {
        query = get_param(path, "q"); char *lp = get_param(path, "lang");
        if (lp) { strncpy(lang_code, lp, 7); free(lp); }
    }
    if (!query || strlen(query) == 0) {
        send_json(client_fd, "{\"error\":\"Question is required\"}", 400);
        if (query) free(query); return;
    }
    int words = count_words(query);
    if (words > MAX_QUERY_WORDS) {
        char err[256]; snprintf(err, sizeof(err), "{\"error\":\"Query too long. Max %d words.\"}", MAX_QUERY_WORDS);
        send_json(client_fd, err, 400); free(query); return;
    }
    const Language *lang = get_language(lang_code);
    printf("[AI] %s (lang: %s, words: %d, history: %d)\n", query, lang_code, words, history_count);
    SearchResponse *search = perform_search(query);
    AiResponse *ai = generate_ai_answer(query, search, history, history_count);
    char *json = build_ai_json(ai, search, query);
    send_json(client_fd, json, 200);
    free(json); free_ai_response(ai); free(search); free(query);
}

static void serve_derick(int client_fd, const char *request, int total_len, const char *path) {
    char *query = NULL;
    char *deep = NULL;
    if (strncmp(request, "POST", 4) == 0) {
        char *body = get_json_body(request, total_len);
        if (body) {
            JsonValue *json = json_parse(body); free(body);
            if (json) {
                const char *q = json_get_string(json, "question"); if (q) query = strdup(q);
                const char *d = json_get_string(json, "deep"); if (d) deep = strdup(d);
                json_free(json);
            }
        }
    } else {
        query = get_param(path, "q");
        deep = get_param(path, "deep");
    }
    if (!query || strlen(query) == 0) {
        send_json(client_fd, "{\"error\":\"Question is required\"}", 400);
        if (query) free(query); if (deep) free(deep); return;
    }
    int words = count_words(query);
    if (words > MAX_QUERY_WORDS) {
        char err[256]; snprintf(err, sizeof(err), "{\"error\":\"Query too long. Max %d words.\"}", MAX_QUERY_WORDS);
        send_json(client_fd, err, 400); free(query); if (deep) free(deep); return;
    }
    printf("[Derick] Guide for: %s (words: %d, deep: %s)\n", query, words, deep ? "yes" : "no");
    SearchResponse *search = (deep && strcmp(deep, "1") == 0) ? perform_deep_search(query) : perform_search(query);
    DerickGuide *guide = generate_derick_guide(query, search);
    char *json = build_derick_json(guide, query);
    send_json(client_fd, json, 200);
    free(json); free_derick_guide(guide); free(search); free(query); if (deep) free(deep);
}

static void serve_books(int client_fd, const char *path) {
    char *query = get_param(path, "q");
    if (!query || strlen(query) == 0) {
        send_json(client_fd, "{\"error\":\"Query is required\"}", 400);
        if (query) free(query); return;
    }
    printf("[BOOKS] %s\n", query);
    SearchResponse *search = perform_search(query);
    char *json = malloc(MAX_RESPONSE); int off = 0;
    off += sprintf(json+off, "{\"query\":\"%s\",\"book_count\":%d,\"books\":[", query, search->book_count);
    for (int i = 0; i < search->book_count; i++) {
        if (i > 0) off += sprintf(json+off, ",");
        char bt[1024], ba[512], bd[8192], bs[256], by[64], bp[512];
        json_escape(bt, search->books[i].title, 1024);
        json_escape(ba, search->books[i].author, 512);
        json_escape(bd, search->books[i].description, 8192);
        json_escape(bs, search->books[i].source, 256);
        json_escape(by, search->books[i].publish_year, 64);
        json_escape(bp, search->books[i].publisher, 512);
        off += sprintf(json+off,
            "{\"title\":\"%s\",\"author\":\"%s\",\"description\":\"%s\",\"source\":\"%s\",\"year\":\"%s\",\"publisher\":\"%s\"}",
            bt, ba, bd, bs, by, bp);
    }
    off += sprintf(json+off, "]}");
    send_json(client_fd, json, 200);
    free(json); free(search); free(query);
}

static void serve_news(int client_fd, const char *path) {
    char *query = get_param(path, "q");
    if (!query || strlen(query) == 0) {
        send_json(client_fd, "{\"error\":\"Query is required\"}", 400);
        if (query) free(query); return;
    }
    printf("[NEWS] %s\n", query);
    SearchResponse *search = perform_search(query);
    char *json = malloc(MAX_RESPONSE); int off = 0;
    off += sprintf(json+off, "{\"query\":\"%s\",\"news_count\":%d,\"news\":[", query, search->news_count);
    for (int i = 0; i < search->news_count; i++) {
        if (i > 0) off += sprintf(json+off, ",");
        char nt[1024], ns[4096], nso[256], nd[64], nu[2048];
        json_escape(nt, search->news[i].title, 1024);
        json_escape(ns, search->news[i].snippet, 4096);
        json_escape(nso, search->news[i].source, 256);
        json_escape(nd, search->news[i].date, 64);
        json_escape(nu, search->news[i].url, 2048);
        off += sprintf(json+off,
            "{\"title\":\"%s\",\"snippet\":\"%s\",\"source\":\"%s\",\"date\":\"%s\",\"url\":\"%s\"}",
            nt, ns, nso, nd, nu);
    }
    off += sprintf(json+off, "]}");
    send_json(client_fd, json, 200);
    free(json); free(search); free(query);
}

static void serve_suggest(int client_fd, const char *path) {
    char *query = get_param(path, "q");
    if (!query || strlen(query) < 2) { send_json(client_fd, "[]", 200); if (query) free(query); return; }
    if (count_words(query) > MAX_QUERY_WORDS) { send_json(client_fd, "[]", 200); free(query); return; }
    char *encoded = url_encode_local(query);
    char url[1024];
    snprintf(url, sizeof(url), "https://suggestqueries.google.com/complete/search?client=firefox&q=%s", encoded);
    free(encoded);
    char *raw = http_get(url, "DeryCodeSearch/1.0");
    char *json_out;
    if (raw) {
        JsonValue *json = json_parse(raw);
        if (json && json->type == JSON_ARR && json_array_len(json) >= 2) {
            JsonValue *suggestions = json_array_at(json, 1);
            if (suggestions && suggestions->type == JSON_ARR) {
                int len = json_array_len(suggestions); if (len > 8) len = 8;
                char *buf = malloc(8192); int off = 0;
                off += sprintf(buf + off, "[");
                for (int i = 0; i < len; i++) {
                    if (i > 0) off += sprintf(buf + off, ",");
                    JsonValue *s = json_array_at(suggestions, i);
                    if (s && s->type == JSON_STR) { char esc[256]; json_escape(esc, s->string, 256); off += sprintf(buf + off, "\"%s\"", esc); }
                }
                off += sprintf(buf + off, "]"); json_out = buf;
            } else json_out = strdup("[]");
        } else json_out = strdup("[]");
        if (json) json_free(json); free(raw);
    } else json_out = strdup("[]");
    send_json(client_fd, json_out, 200); free(json_out); free(query);
}

static void serve_languages(int client_fd) {
    char *json = malloc(8192); int off = 0; off += sprintf(json + off, "[");
    for (int i = 0; i < LANGUAGE_COUNT; i++) {
        if (i > 0) off += sprintf(json + off, ",");
        off += sprintf(json + off, "{\"code\":\"%s\",\"name\":\"%s\",\"native\":\"%s\"}", languages[i].code, languages[i].name, languages[i].native);
    }
    off += sprintf(json + off, "]"); send_json(client_fd, json, 200); free(json);
}

static void handle_request(int client_fd) {
    char *request = malloc(MAX_REQUEST);
    int bytes = recv(client_fd, request, MAX_REQUEST - 1, 0);
    if (bytes <= 0) { close(client_fd); free(request); return; }
    request[bytes] = 0;
    char method[8], path[4096];
    sscanf(request, "%s %s", method, path);
    
    if (strncmp(path, "/api/derick", 11) == 0) serve_derick(client_fd, request, bytes, path);
    else if (strncmp(path, "/api/ai", 7) == 0) serve_ai(client_fd, request, bytes, path);
    else if (strncmp(path, "/api/books", 10) == 0) serve_books(client_fd, path);
    else if (strncmp(path, "/api/news", 9) == 0) serve_news(client_fd, path);
    else if (strncmp(path, "/api/search", 11) == 0) serve_search(client_fd, path);
    else if (strncmp(path, "/api/suggest", 12) == 0) serve_suggest(client_fd, path);
    else if (strncmp(path, "/api/languages", 15) == 0) serve_languages(client_fd);
    else if (strncmp(path, "/api/health", 11) == 0)
        send_json(client_fd, "{\"status\":\"healthy\",\"lang\":\"c\",\"ai\":true,\"languages\":6,\"sources\":16,\"max_results\":512,\"max_query_words\":500,\"max_answer_words\":5000}", 200);
    else if (strcmp(path, "/") == 0 || strncmp(path, "/index.html", 11) == 0) serve_html(client_fd);
    else {
        const char *err = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
        write(client_fd, err, strlen(err));
    }
    close(client_fd); free(request);
}

int main(int argc, char *argv[]) {
    signal(SIGCHLD, SIG_IGN);
    signal(SIGTERM, handle_signal);
    signal(SIGINT, handle_signal);
    
    int port = PORT;
    if (argc > 1) port = atoi(argv[1]);
    
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) { perror("socket"); exit(1); }
    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
    
    struct sockaddr_in addr;
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(port);
    
    if (bind(server_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) { perror("bind"); exit(1); }
    if (listen(server_fd, 128) < 0) { perror("listen"); exit(1); }
    
    printf("DeryCode Search Engine v2.0 (Enhanced)\n");
    printf("16 search sources | 512 max results | 5000 word answers\n");
    printf("Book search + summarization | Deep content extraction\n");
    printf("Listening on port %d\n", port);
    
    while (running) {
        int client_fd = accept(server_fd, NULL, NULL);
        if (client_fd < 0) { if (errno == EINTR) continue; perror("accept"); continue; }
        pid_t pid = fork();
        if (pid == 0) { close(server_fd); handle_request(client_fd); exit(0); }
        close(client_fd);
    }
    close(server_fd);
    return 0;
}
