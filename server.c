/*
 * DeryCode Search - C HTTP Server with AI
 * Multi-language, mobile-optimized, word-limited
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
#define MAX_REQUEST 65536
#define MAX_RESPONSE 1048576
#define MAX_BODY 32768

static volatile int running = 1;

void handle_signal(int sig) {
    (void)sig;
    running = 0;
    printf("\nShutting down DeryCode Search...\n");
    exit(0);
}

/* URL-encode */
static char *url_encode_local(const char *str) {
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

/* URL-decode in place */
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

/* Extract query parameter from URL path */
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

/* Parse JSON body from POST request */
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

/* Build search JSON response */
static char *build_search_json(SearchResponse *resp, const char *query) {
    char *json = malloc(MAX_RESPONSE);
    int offset = 0;
    
    char q_esc[1024];
    json_escape(q_esc, query, 1024);
    offset += sprintf(json + offset, "{\"query\":\"%s\",\"count\":%d,\"time\":\"%.2f\"", 
                      q_esc, resp->result_count, resp->elapsed);
    
    if (resp->kp.has_data) {
        char title[512], extract[4096], thumb[1024], url[1024];
        json_escape(title, resp->kp.title, 512);
        json_escape(extract, resp->kp.extract, 4096);
        json_escape(thumb, resp->kp.thumbnail, 1024);
        json_escape(url, resp->kp.url, 1024);
        
        offset += sprintf(json + offset, ",\"knowledgePanel\":{\"title\":\"%s\",\"extract\":\"%s\"",
                          title, extract);
        if (strlen(thumb) > 0) offset += sprintf(json + offset, ",\"thumbnail\":\"%s\"", thumb);
        if (strlen(url) > 0) offset += sprintf(json + offset, ",\"url\":\"%s\"", url);
        offset += sprintf(json + offset, "}");
    } else {
        offset += sprintf(json + offset, ",\"knowledgePanel\":null");
    }
    
    if (resp->ai.has_data) {
        char summary[2048];
        json_escape(summary, resp->ai.text, 2048);
        offset += sprintf(json + offset, ",\"aiSummary\":\"%s\"", summary);
    } else {
        offset += sprintf(json + offset, ",\"aiSummary\":null");
    }
    
    offset += sprintf(json + offset, ",\"results\":[");
    for (int i = 0; i < resp->result_count; i++) {
        if (i > 0) offset += sprintf(json + offset, ",");
        char title[1024], url[2048], content[2048], engine[64], source[128];
        json_escape(title, resp->results[i].title, 1024);
        json_escape(url, resp->results[i].url, 2048);
        json_escape(content, resp->results[i].content, 2048);
        json_escape(engine, resp->results[i].engine, 64);
        json_escape(source, resp->results[i].source, 128);
        
        offset += sprintf(json + offset, 
            "{\"title\":\"%s\",\"url\":\"%s\",\"content\":\"%s\",\"engine\":\"%s\",\"source\":\"%s\",\"featured\":%d}",
            title, url, content, engine, source, resp->results[i].featured);
    }
    offset += sprintf(json + offset, "]");
    
    offset += sprintf(json + offset, ",\"related\":[");
    for (int i = 0; i < 6; i++) {
        if (i > 0) offset += sprintf(json + offset, ",");
        char rel[256];
        json_escape(rel, resp->related[i], 256);
        offset += sprintf(json + offset, "\"%s\"", rel);
    }
    offset += sprintf(json + offset, "]");
    
    char *encoded = url_encode_local(query);
    offset += sprintf(json + offset, 
        ",\"external\":{\"google\":\"https://www.google.com/search?q=%s\","
        "\"bing\":\"https://www.bing.com/search?q=%s\","
        "\"duckduckgo\":\"https://duckduckgo.com/?q=%s\","
        "\"youtube\":\"https://www.youtube.com/results?search_query=%s\"}",
        encoded, encoded, encoded, encoded);
    free(encoded);
    
    /* Add word limit info */
    offset += sprintf(json + offset, ",\"limits\":{\"maxQueryWords\":%d,\"maxAnswerWords\":%d}", 
                      MAX_QUERY_WORDS, MAX_ANSWER_WORDS);
    
    offset += sprintf(json + offset, "}");
    return json;
}

/* Serve static HTML */
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
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: %ld\r\nCache-Control: max-age=3600\r\n\r\n",
        size);
    
    write(client_fd, header, strlen(header));
    write(client_fd, html, size);
    free(html);
}

/* Send JSON response */
static void send_json(int client_fd, const char *json, int status) {
    int len = strlen(json);
    char header[256];
    snprintf(header, sizeof(header),
        "HTTP/1.1 %d OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: %d\r\nAccess-Control-Allow-Origin: *\r\n\r\n",
        status, len);
    write(client_fd, header, strlen(header));
    write(client_fd, json, len);
}

/* Serve search API */
static void serve_search(int client_fd, const char *path) {
    char *query = get_param(path, "q");
    
    if (!query || strlen(query) == 0) {
        send_json(client_fd, "{\"error\":\"Query is required\"}", 400);
        if (query) free(query);
        return;
    }
    
    /* Check word limit */
    int words = count_words(query);
    if (words > MAX_QUERY_WORDS) {
        char err[256];
        snprintf(err, sizeof(err), 
            "{\"error\":\"Query too long. Maximum %d words. You used %d.\",\"max_words\":%d,\"used_words\":%d}",
            MAX_QUERY_WORDS, words, MAX_QUERY_WORDS, words);
        send_json(client_fd, err, 400);
        free(query);
        return;
    }
    
    printf("[SEARCH] %s (%d words)\n", query, words);
    
    SearchResponse *resp = perform_search(query);
    char *json = build_search_json(resp, query);
    send_json(client_fd, json, 200);
    
    free(json);
    free(resp);
    free(query);
}

/* Serve AI API (Gemini-style chat with language support) */
static void serve_ai(int client_fd, const char *request, int total_len, const char *path) {
    char *query = NULL;
    AiMessage history[20];
    int history_count = 0;
    char lang_code[8] = "en";
    
    if (strncmp(request, "POST", 4) == 0) {
        char *body = get_json_body(request, total_len);
        if (body) {
            JsonValue *json = json_parse(body);
            free(body);
            
            if (json) {
                const char *q = json_get_string(json, "question");
                if (q) query = strdup(q);
                
                const char *lang = json_get_string(json, "lang");
                if (lang) strncpy(lang_code, lang, 7);
                
                JsonValue *hist = json_get_array(json, "history");
                if (hist && hist->type == JSON_ARR) {
                    int len = json_array_len(hist);
                    if (len > 20) len = 20;
                    for (int i = 0; i < len; i++) {
                        JsonValue *msg = json_array_at(hist, i);
                        if (msg && msg->type == JSON_OBJ) {
                            const char *role = json_get_string(msg, "role");
                            const char *content = json_get_string(msg, "content");
                            if (role && content) {
                                strncpy(history[history_count].role, role, 15);
                                strncpy(history[history_count].content, content, 2047);
                                history_count++;
                            }
                        }
                    }
                }
                json_free(json);
            }
        }
    } else {
        query = get_param(path, "q");
        char *lp = get_param(path, "lang");
        if (lp) { strncpy(lang_code, lp, 7); free(lp); }
    }
    
    if (!query || strlen(query) == 0) {
        send_json(client_fd, "{\"error\":\"Question is required\"}", 400);
        if (query) free(query);
        return;
    }
    
    /* Check word limit */
    int words = count_words(query);
    if (words > MAX_QUERY_WORDS) {
        char err[256];
        snprintf(err, sizeof(err), 
            "{\"error\":\"Query too long. Maximum %d words. You used %d.\",\"max_words\":%d,\"used_words\":%d}",
            MAX_QUERY_WORDS, words, MAX_QUERY_WORDS, words);
        send_json(client_fd, err, 400);
        free(query);
        return;
    }
    
    const Language *lang = get_language(lang_code);
    printf("[AI] %s (lang: %s, words: %d, history: %d)\n", query, lang_code, words, history_count);
    
    /* Perform search to get context */
    SearchResponse *search = perform_search(query);
    
    /* Generate AI answer */
    AiResponse *ai = generate_ai_answer(query, search, history, history_count);
    
    /* Build and send response */
    char *json = build_ai_json(ai, search, query);
    send_json(client_fd, json, 200);
    
    free(json);
    free_ai_response(ai);
    free(search);
    free(query);
}


/* Serve Derick Agent - Step-by-step practical guide */
static void serve_derick(int client_fd, const char *request, int total_len, const char *path) {
    char *query = NULL;
    
    if (strncmp(request, "POST", 4) == 0) {
        char *body = get_json_body(request, total_len);
        if (body) {
            JsonValue *json = json_parse(body);
            free(body);
            if (json) {
                const char *q = json_get_string(json, "question");
                if (q) query = strdup(q);
                json_free(json);
            }
        }
    } else {
        query = get_param(path, "q");
    }
    
    if (!query || strlen(query) == 0) {
        send_json(client_fd, "{\"error\":\"Question is required\"}", 400);
        if (query) free(query);
        return;
    }
    
    /* Check word limit */
    int words = count_words(query);
    if (words > MAX_QUERY_WORDS) {
        char err[256];
        snprintf(err, sizeof(err),
            "{\"error\":\"Query too long. Maximum %d words.\"}", MAX_QUERY_WORDS);
        send_json(client_fd, err, 400);
        free(query);
        return;
    }
    
    printf("[Derick] Step-by-step guide for: %s (words: %d)\n", query, words);
    
    /* Perform deep search */
    SearchResponse *search = perform_search(query);
    
    /* Generate step-by-step guide */
    DerickGuide *guide = generate_derick_guide(query, search);
    
    /* Build and send response */
    char *json = build_derick_json(guide, query);
    send_json(client_fd, json, 200);
    
    free(json);
    free_derick_guide(guide);
    free(search);
    free(query);
}

/* Serve autocomplete */
static void serve_suggest(int client_fd, const char *path) {
    char *query = get_param(path, "q");
    
    if (!query || strlen(query) < 2) {
        send_json(client_fd, "[]", 200);
        if (query) free(query);
        return;
    }
    
    /* Enforce word limit */
    if (count_words(query) > MAX_QUERY_WORDS) {
        send_json(client_fd, "[]", 200);
        free(query);
        return;
    }
    
    char *encoded = url_encode_local(query);
    char url[1024];
    snprintf(url, sizeof(url),
        "https://suggestqueries.google.com/complete/search?client=firefox&q=%s", encoded);
    free(encoded);
    
    char *raw = http_get(url, "DeryCodeSearch/1.0");
    
    char *json_out;
    if (raw) {
        JsonValue *json = json_parse(raw);
        if (json && json->type == JSON_ARR && json_array_len(json) >= 2) {
            JsonValue *suggestions = json_array_at(json, 1);
            if (suggestions && suggestions->type == JSON_ARR) {
                int len = json_array_len(suggestions);
                if (len > 6) len = 6;
                
                char *buf = malloc(8192);
                int off = 0;
                off += sprintf(buf + off, "[");
                for (int i = 0; i < len; i++) {
                    if (i > 0) off += sprintf(buf + off, ",");
                    JsonValue *s = json_array_at(suggestions, i);
                    if (s && s->type == JSON_STR) {
                        char esc[256];
                        json_escape(esc, s->string, 256);
                        off += sprintf(buf + off, "\"%s\"", esc);
                    }
                }
                off += sprintf(buf + off, "]");
                json_out = buf;
            } else {
                json_out = strdup("[]");
            }
        } else {
            json_out = strdup("[]");
        }
        if (json) json_free(json);
        free(raw);
    } else {
        json_out = strdup("[]");
    }
    
    send_json(client_fd, json_out, 200);
    free(json_out);
    free(query);
}

/* Serve languages list */
static void serve_languages(int client_fd) {
    char *json = malloc(8192);
    int off = 0;
    off += sprintf(json + off, "[");
    for (int i = 0; i < LANGUAGE_COUNT; i++) {
        if (i > 0) off += sprintf(json + off, ",");
        off += sprintf(json + off, 
            "{\"code\":\"%s\",\"name\":\"%s\",\"native\":\"%s\"}",
            languages[i].code, languages[i].name, languages[i].native);
    }
    off += sprintf(json + off, "]");
    send_json(client_fd, json, 200);
    free(json);
}

/* Handle a single HTTP request */
static void handle_request(int client_fd) {
    char request[MAX_REQUEST];
    int bytes = recv(client_fd, request, MAX_REQUEST - 1, 0);
    if (bytes <= 0) { close(client_fd); return; }
    request[bytes] = 0;
    
    char method[8], path[2048];
    sscanf(request, "%s %s", method, path);
    
    if (strncmp(path, "/api/derick", 11) == 0) {
        serve_derick(client_fd, request, bytes, path);
    } else if (strncmp(path, "/api/ai", 7) == 0) {
        serve_ai(client_fd, request, bytes, path);
    } else if (strncmp(path, "/api/search", 11) == 0) {
        serve_search(client_fd, path);
    } else if (strncmp(path, "/api/suggest", 12) == 0) {
        serve_suggest(client_fd, path);
    } else if (strncmp(path, "/api/languages", 14) == 0) {
        serve_languages(client_fd);
    } else if (strcmp(path, "/") == 0 || strcmp(path, "/index.html") == 0) {
        serve_html(client_fd);
    } else if (strcmp(path, "/health") == 0) {
        send_json(client_fd, "{\"status\":\"healthy\",\"lang\":\"c\",\"ai\":true,\"languages\":6,\"sources\":11,\"max_results\":128}", 200);
    } else {
        const char *err = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n";
        write(client_fd, err, strlen(err));
    }
    
    close(client_fd);
}

int main(int argc, char *argv[]) {
    int port = PORT;
    if (argc > 1) port = atoi(argv[1]);
    
    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);
    signal(SIGCHLD, SIG_IGN);
    
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) { perror("Socket creation failed"); return 1; }
    
    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
    
    struct sockaddr_in addr;
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(port);
    
    if (bind(server_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("Bind failed"); return 1;
    }
    
    if (listen(server_fd, 128) < 0) { perror("Listen failed"); return 1; }
    
    printf("DeryCode Search - C Edition with AI\n");
    printf("Listening on port %d\n", port);
    printf("Derick: /api/derick | AI chat: /api/ai | Search: /api/search | Languages: /api/languages\n");
    printf("6 African languages | Word limit: %d query, %d answer\n", MAX_QUERY_WORDS, MAX_ANSWER_WORDS);
    printf("Built with pure C - no frameworks, no dependencies\n\n");
    fflush(stdout);
    
    while (running) {
        int client_fd = accept(server_fd, NULL, NULL);
        if (client_fd < 0) {
            if (errno == EINTR) continue;
            continue;
        }
        
        pid_t pid = fork();
        if (pid == 0) {
            close(server_fd);
            handle_request(client_fd);
            exit(0);
        } else {
            close(client_fd);
        }
    }
    
    close(server_fd);
    return 0;
}
