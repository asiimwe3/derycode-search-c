/*
 * DeryCode Search - C HTTP Server
 * A premium search engine written in pure C
 * Built by DeryCode Tech, Uganda
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

#define PORT 8080
#define MAX_REQUEST 8192
#define MAX_RESPONSE 1048576  /* 1MB */

static volatile int running = 1;

void handle_signal(int sig) {
    running = 0;
    printf("\nShutting down DeryCode Search...\n");
    exit(0);
}

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

/* Extract query parameter from URL */
static char *get_param(const char *url, const char *path_prefix, const char *param) {
    /* Find the path */
    const char *path = url;
    if (strncmp(path, "GET ", 4) == 0) path += 4;
    if (strncmp(path, "POST ", 5) == 0) path += 5;
    
    /* Check if path matches */
    if (strncmp(path, path_prefix, strlen(path_prefix)) != 0) return NULL;
    
    /* Find query string */
    const char *qmark = strchr(path, '?');
    if (!qmark) return NULL;
    
    /* Find the parameter */
    const char *p = qmark + 1;
    int param_len = strlen(param);
    
    while (p && *p) {
        if (strncmp(p, param, param_len) == 0 && p[param_len] == '=') {
            /* Found it - extract value */
            const char *start = p + param_len + 1;
            const char *end = strchr(start, '&');
            if (!end) end = strchr(start, ' ');
            if (!end) end = start + strlen(start);
            
            int len = end - start;
            char *value = malloc(len + 1);
            memcpy(value, start, len);
            value[len] = 0;
            
            /* URL decode */
            char *dst = value;
            for (int i = 0; i < len; i++) {
                if (value[i] == '%' && i + 2 < len) {
                    char hex[3] = {value[i+1], value[i+2], 0};
                    *dst++ = (char)strtol(hex, NULL, 16);
                    i += 2;
                } else if (value[i] == '+') {
                    *dst++ = ' ';
                } else {
                    *dst++ = value[i];
                }
            }
            *dst = 0;
            return value;
        }
        p = strchr(p, '&');
        if (p) p++;
    }
    return NULL;
}

/* Build search JSON response */
static char *build_search_json(SearchResponse *resp, const char *query) {
    char *json = malloc(MAX_RESPONSE);
    int offset = 0;
    
    offset += sprintf(json + offset, "{\"query\":\"%s\",\"count\":%d,\"time\":\"%.2f\"", 
                      query, resp->result_count, resp->elapsed);
    
    /* Knowledge panel */
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
    
    /* AI summary */
    if (resp->ai.has_data) {
        char summary[2048];
        json_escape(summary, resp->ai.text, 2048);
        offset += sprintf(json + offset, ",\"aiSummary\":\"%s\"", summary);
    } else {
        offset += sprintf(json + offset, ",\"aiSummary\":null");
    }
    
    /* Results array */
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
    
    /* Related searches */
    offset += sprintf(json + offset, ",\"related\":[");
    for (int i = 0; i < 6; i++) {
        if (i > 0) offset += sprintf(json + offset, ",");
        char rel[256];
        json_escape(rel, resp->related[i], 256);
        offset += sprintf(json + offset, "\"%s\"", rel);
    }
    offset += sprintf(json + offset, "]");
    
    /* External links */
    char *encoded = url_encode(query);
    offset += sprintf(json + offset, 
        ",\"external\":{\"google\":\"https://www.google.com/search?q=%s\","
        "\"bing\":\"https://www.bing.com/search?q=%s\","
        "\"duckduckgo\":\"https://duckduckgo.com/?q=%s\","
        "\"youtube\":\"https://www.youtube.com/results?search_query=%s\"}",
        encoded, encoded, encoded, encoded);
    free(encoded);
    
    offset += sprintf(json + offset, "}");
    
    return json;
}

/* Serve static HTML frontend */
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

/* Serve search API */
static void serve_search(int client_fd, const char *request) {
    char *query = get_param(request, "/api/search", "q");
    
    if (!query || strlen(query) == 0) {
        const char *err = "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nContent-Length: 30\r\n\r\n{\"error\":\"Query is required\"}";
        write(client_fd, err, strlen(err));
        if (query) free(query);
        return;
    }
    
    printf("[SEARCH] %s\n", query);
    
    SearchResponse *resp = perform_search(query);
    char *json = build_search_json(resp, query);
    int json_len = strlen(json);
    
    char header[256];
    snprintf(header, sizeof(header),
        "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: %d\r\nCache-Control: s-maxage=60\r\nAccess-Control-Allow-Origin: *\r\n\r\n",
        json_len);
    
    write(client_fd, header, strlen(header));
    write(client_fd, json, json_len);
    
    free(json);
    free(resp);
    free(query);
}

/* Serve autocomplete */
static void serve_suggest(int client_fd, const char *request) {
    char *query = get_param(request, "/api/suggest", "q");
    
    if (!query || strlen(query) < 2) {
        const char *empty = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n[]";
        write(client_fd, empty, strlen(empty));
        if (query) free(query);
        return;
    }
    
    char *encoded = url_encode(query);
    char url[1024];
    snprintf(url, sizeof(url),
        "https://suggestqueries.google.com/complete/search?client=firefox&q=%s", encoded);
    free(encoded);
    
    char *raw = http_get(url, "DeryCodeSearch/1.0");
    
    char *json_out;
    if (raw) {
        JsonValue *json = json_parse(raw);
        if (json) {
            JsonValue *arr = json_get_array(json, NULL);
            /* The response is [query, [suggestions]] */
            if (json->type == JSON_ARR && json_array_len(json) >= 2) {
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
            json_free(json);
        } else {
            json_out = strdup("[]");
        }
        free(raw);
    } else {
        json_out = strdup("[]");
    }
    
    int len = strlen(json_out);
    char header[256];
    snprintf(header, sizeof(header),
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: %d\r\n\r\n", len);
    write(client_fd, header, strlen(header));
    write(client_fd, json_out, len);
    free(json_out);
    free(query);
}

/* Handle a single HTTP request */
static void handle_request(int client_fd, struct sockaddr_in *client_addr) {
    char request[MAX_REQUEST];
    int bytes = recv(client_fd, request, MAX_REQUEST - 1, 0);
    if (bytes <= 0) { close(client_fd); return; }
    request[bytes] = 0;
    
    /* Parse the request method and path */
    char method[8], path[1024];
    sscanf(request, "%s %s", method, path);
    
    if (strncmp(path, "/api/search", 11) == 0) {
        serve_search(client_fd, request);
    } else if (strncmp(path, "/api/suggest", 12) == 0) {
        serve_suggest(client_fd, request);
    } else if (strcmp(path, "/") == 0 || strcmp(path, "/index.html") == 0) {
        serve_html(client_fd);
    } else if (strcmp(path, "/health") == 0) {
        const char *health = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 27\r\n\r\n{\"status\":\"healthy\",\"lang\":\"c\"}";
        write(client_fd, health, strlen(health));
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
    signal(SIGCHLD, SIG_IGN); /* Reap child processes */
    
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) {
        perror("Socket creation failed");
        return 1;
    }
    
    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
    
    struct sockaddr_in addr;
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(port);
    
    if (bind(server_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("Bind failed");
        return 1;
    }
    
    if (listen(server_fd, 128) < 0) {
        perror("Listen failed");
        return 1;
    }
    
    printf("DeryCode Search - C Edition\n");
    printf("Listening on port %d\n", port);
    printf("Premium search engine for Africa\n");
    printf("Built with pure C - no frameworks, no dependencies\n\n");
    fflush(stdout);
    
    while (running) {
        struct sockaddr_in client_addr;
        socklen_t client_len = sizeof(client_addr);
        int client_fd = accept(server_fd, (struct sockaddr *)&client_addr, &client_len);
        
        if (client_fd < 0) {
            if (errno == EINTR) continue;
            perror("Accept failed");
            continue;
        }
        
        /* Fork to handle request concurrently */
        pid_t pid = fork();
        if (pid == 0) {
            /* Child process */
            close(server_fd);
            handle_request(client_fd, &client_addr);
            exit(0);
        } else {
            /* Parent process */
            close(client_fd);
        }
    }
    
    close(server_fd);
    return 0;
}
