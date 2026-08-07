/* Minimal JSON parser for DeryCode Search - pure C, zero dependencies */
#ifndef DC_JSON_H
#define DC_JSON_H

typedef enum { JSON_NULL, JSON_BOOL, JSON_NUM, JSON_STR, JSON_ARR, JSON_OBJ } JsonType;

typedef struct JsonValue {
    JsonType type;
    union {
        int boolean;
        double number;
        char *string;
        struct { struct JsonValue **items; int count; } array;
        struct { char **keys; struct JsonValue **values; int count; } object;
    };
} JsonValue;

static const char *json_skip(const char *s) {
    while (*s && (*s == ' ' || *s == '\t' || *s == '\n' || *s == '\r')) s++;
    return s;
}

static JsonValue *json_parse_value(const char **sp);

static char *json_parse_string_raw(const char **sp) {
    const char *s = *sp;
    if (*s != '"') return NULL;
    s++;
    int len = 0;
    char buf[8192];
    while (*s && *s != '"' && len < 8191) {
        if (*s == '\\') {
            s++;
            switch (*s) {
                case 'n': buf[len++] = '\n'; break;
                case 't': buf[len++] = '\t'; break;
                case 'r': buf[len++] = '\r'; break;
                case '\\': buf[len++] = '\\'; break;
                case '"': buf[len++] = '"'; break;
                case '/': buf[len++] = '/'; break;
                case 'u': {
                    if (s[1] && s[2] && s[3] && s[4]) {
                        unsigned int cp = 0;
                        for (int i = 1; i <= 4; i++) {
                            char c = s[i];
                            cp <<= 4;
                            if (c >= '0' && c <= '9') cp |= (c - '0');
                            else if (c >= 'a' && c <= 'f') cp |= (c - 'a' + 10);
                            else if (c >= 'A' && c <= 'F') cp |= (c - 'A' + 10);
                        }
                        s += 4;
                        if (cp < 0x80) {
                            buf[len++] = cp;
                        } else if (cp < 0x800) {
                            buf[len++] = 0xC0 | (cp >> 6);
                            buf[len++] = 0x80 | (cp & 0x3F);
                        } else {
                            buf[len++] = 0xE0 | (cp >> 12);
                            buf[len++] = 0x80 | ((cp >> 6) & 0x3F);
                            buf[len++] = 0x80 | (cp & 0x3F);
                        }
                    }
                    break;
                }
                default: buf[len++] = *s; break;
            }
            s++;
        } else {
            buf[len++] = *s++;
        }
    }
    buf[len] = 0;
    s++; /* skip closing quote */
    *sp = s;
    char *result = malloc(len + 1);
    memcpy(result, buf, len + 1);
    return result;
}

static JsonValue *json_parse_array(const char **sp) {
    const char *s = json_skip(*sp);
    if (*s != '[') return NULL;
    s++;
    s = json_skip(s);
    
    JsonValue *val = calloc(1, sizeof(JsonValue));
    val->type = JSON_ARR;
    val->array.items = NULL;
    val->array.count = 0;
    int cap = 0;
    
    if (*s == ']') { s++; *sp = s; return val; }
    
    while (*s) {
        JsonValue *item = json_parse_value(&s);
        if (!item) break;
        if (val->array.count >= cap) {
            cap = cap ? cap * 2 : 8;
            val->array.items = realloc(val->array.items, cap * sizeof(JsonValue *));
        }
        val->array.items[val->array.count++] = item;
        s = json_skip(s);
        if (*s == ',') { s++; s = json_skip(s); continue; }
        if (*s == ']') { s++; break; }
        break;
    }
    *sp = s;
    return val;
}

static JsonValue *json_parse_object(const char **sp) {
    const char *s = json_skip(*sp);
    if (*s != '{') return NULL;
    s++;
    s = json_skip(s);
    
    JsonValue *val = calloc(1, sizeof(JsonValue));
    val->type = JSON_OBJ;
    val->object.keys = NULL;
    val->object.values = NULL;
    val->object.count = 0;
    int cap = 0;
    
    if (*s == '}') { s++; *sp = s; return val; }
    
    while (*s) {
        char *key = json_parse_string_raw(&s);
        if (!key) break;
        s = json_skip(s);
        if (*s != ':') { free(key); break; }
        s++;
        s = json_skip(s);
        JsonValue *value = json_parse_value(&s);
        if (!value) { free(key); break; }
        
        if (val->object.count >= cap) {
            cap = cap ? cap * 2 : 8;
            val->object.keys = realloc(val->object.keys, cap * sizeof(char *));
            val->object.values = realloc(val->object.values, cap * sizeof(JsonValue *));
        }
        val->object.keys[val->object.count] = key;
        val->object.values[val->object.count] = value;
        val->object.count++;
        
        s = json_skip(s);
        if (*s == ',') { s++; s = json_skip(s); continue; }
        if (*s == '}') { s++; break; }
        break;
    }
    *sp = s;
    return val;
}

static JsonValue *json_parse_value(const char **sp) {
    const char *s = json_skip(*sp);
    JsonValue *val;
    
    switch (*s) {
        case '"': {
            char *str = json_parse_string_raw(&s);
            if (!str) return NULL;
            val = calloc(1, sizeof(JsonValue));
            val->type = JSON_STR;
            val->string = str;
            break;
        }
        case '[': val = json_parse_array(&s); break;
        case '{': val = json_parse_object(&s); break;
        case 't':
            if (strncmp(s, "true", 4) == 0) {
                val = calloc(1, sizeof(JsonValue));
                val->type = JSON_BOOL; val->boolean = 1;
                s += 4;
            } else return NULL;
            break;
        case 'f':
            if (strncmp(s, "false", 5) == 0) {
                val = calloc(1, sizeof(JsonValue));
                val->type = JSON_BOOL; val->boolean = 0;
                s += 5;
            } else return NULL;
            break;
        case 'n':
            if (strncmp(s, "null", 4) == 0) {
                val = calloc(1, sizeof(JsonValue));
                val->type = JSON_NULL;
                s += 4;
            } else return NULL;
            break;
        default: {
            char *end;
            double num = strtod(s, &end);
            if (end == s) return NULL;
            val = calloc(1, sizeof(JsonValue));
            val->type = JSON_NUM;
            val->number = num;
            s = end;
            break;
        }
    }
    *sp = s;
    return val;
}

JsonValue *json_parse(const char *str) {
    const char *s = str;
    return json_parse_value(&s);
}

const char *json_get_string(JsonValue *obj, const char *key) {
    if (!obj || obj->type != JSON_OBJ) return NULL;
    for (int i = 0; i < obj->object.count; i++) {
        if (strcmp(obj->object.keys[i], key) == 0) {
            JsonValue *v = obj->object.values[i];
            if (v->type == JSON_STR) return v->string;
        }
    }
    return NULL;
}

JsonValue *json_get_object(JsonValue *obj, const char *key) {
    if (!obj || obj->type != JSON_OBJ) return NULL;
    for (int i = 0; i < obj->object.count; i++) {
        if (strcmp(obj->object.keys[i], key) == 0) {
            return obj->object.values[i];
        }
    }
    return NULL;
}
JsonValue *json_get_array(JsonValue *obj, const char *key) {
    if (!obj || obj->type != JSON_OBJ) return NULL;
    for (int i = 0; i < obj->object.count; i++) {
        if (strcmp(obj->object.keys[i], key) == 0) {
            return obj->object.values[i];
        }
    }
    return NULL;
}

JsonValue *json_array_at(JsonValue *arr, int index) {
    if (!arr || arr->type != JSON_ARR || index >= arr->array.count) return NULL;
    return arr->array.items[index];
}

int json_array_len(JsonValue *arr) {
    if (!arr || arr->type != JSON_ARR) return 0;
    return arr->array.count;
}

void json_free(JsonValue *val) {
    if (!val) return;
    switch (val->type) {
        case JSON_STR: free(val->string); break;
        case JSON_ARR:
            for (int i = 0; i < val->array.count; i++) json_free(val->array.items[i]);
            free(val->array.items);
            break;
        case JSON_OBJ:
            for (int i = 0; i < val->object.count; i++) {
                free(val->object.keys[i]);
                json_free(val->object.values[i]);
            }
            free(val->object.keys);
            free(val->object.values);
            break;
        default: break;
    }
    free(val);
}

#endif
