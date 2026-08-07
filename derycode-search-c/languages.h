/* Multi-African Language Support for DeryCode AI */
#ifndef DC_LANGUAGES_H
#define DC_LANGUAGES_H

/* Maximum limits - HIGH OUTPUT MODE */
#define MAX_QUERY_WORDS 500
#define MAX_ANSWER_WORDS 5000
#define MAX_ANSWER_CHARS 50000
#define MAX_GUIDE_STEPS 30

/* Supported languages */
typedef struct {
    char code[8];       /* "en", "sw", "lg", etc */
    char name[32];      /* "English", "Kiswahili", etc */
    char native[32];    /* Native name */
    /* UI strings */
    char placeholder[128];
    char welcome_sub[128];
    char send[16];
    char ai_name[32];
    char sources[32];
    char followups[32];
    char results[32];
    char search_web[32];
    char ai_chat[32];
    char no_results[256];
    char thinking[32];
} Language;

static const Language languages[] = {
    /* English */
    {"en", "English", "English",
     "Ask DeryCode AI anything...", "Your AI search assistant. Ask anything.",
     "Send", "DeryCode AI", "Sources", "Related", "Web results",
     "Web Search", "AI Chat",
     "I could not find results. Try rephrasing your question.",
     "Thinking..."},
    
    /* Kiswahili */
    {"sw", "Kiswahili", "Kiswahili",
     "Uliza DeryCode AI chochote...", "Msaidizi wako wa AI. Uliza chochote.",
     "Tuma", "DeryCode AI", "Vyanzo", "Vinavyohusiana", "Matokeo ya wavuti",
     "Tafuta Wavuti", "Mazungumzo ya AI",
     "Sikuweza kupata matokeo. Jaribu kuuliza tofauti.",
     "Inafikiri..."},
    
    /* Luganda */
    {"lg", "Luganda", "Luganda",
     "Buuza DeryCode AI kyonna...", "Yambi yo eya AI. Buuza kyonna.",
     "Tuma", "DeryCode AI", "Amaviro", "Ebyokugerageranya", "Ebyavudde ku mukutu",
     "Noonya ku Mukutu", "Bigambo bya AI",
     "Tsidde nsangire ebyavudde. Gezaako okubuuza dda.",
     "Ekyaakubakyekanira..."},
    
    /* Runyoro/Rutooro */
    {"rn", "Runyoro", "Runyoro",
     "Buuza DeryCode AI kihabuuza...", "Akarigamba kaitu aha AI. Buuza kihabuuza.",
     "Handiika", "DeryCode AI", "Emitwe", "Ebyokureeberera", "Ebyavugwire",
     "Ronda kaha intaneti", "Bigambo bya AI",
     "Tindaba byona. Gerageza kubuuza kandi.",
     "Nikyetegyerez'aho..."},
    
    /* French */
    {"fr", "French", "Francais",
     "Demandez a DeryCode AI...", "Votre assistant IA. Demandez n'importe quoi.",
     "Envoyer", "DeryCode AI", "Sources", "Connexes", "Resultats web",
     "Recherche web", "Chat IA",
     "Aucun resultat. Rephrasez votre question.",
     "Reflexion..."},
    
    /* Arabic */
    {"ar", "Arabic", "Arabic",
     "Ask DeryCode AI anything...", "Your AI search assistant. Ask anything.",
     "Send", "DeryCode AI", "Sources", "Related", "Web results",
     "Web Search", "AI Chat",
     "No results found. Try rephrasing.",
     "Thinking..."},
};
#define LANGUAGE_COUNT (sizeof(languages) / sizeof(Language))

/* Get language by code */
static const Language *get_language(const char *code) {
    if (!code) return &languages[0];
    for (int i = 0; i < LANGUAGE_COUNT; i++) {
        if (strcmp(languages[i].code, code) == 0) return &languages[i];
    }
    return &languages[0];
}

/* Count words in a string */
static int count_words(const char *str) {
    if (!str) return 0;
    int count = 0;
    int in_word = 0;
    while (*str) {
        if (*str == ' ' || *str == '\t' || *str == '\n' || *str == '\r') {
            in_word = 0;
        } else if (!in_word) {
            in_word = 1;
            count++;
        }
        str++;
    }
    return count;
}

/* Truncate text to N words and M chars */
static void truncate_words(const char *input, char *output, int max_words, int max_chars) {
    if (!input || !output || max_words <= 0 || max_chars <= 0) {
        if (output) output[0] = 0;
        return;
    }
    
    int word_count = 0;
    int out_pos = 0;
    const char *p = input;
    
    while (*p == ' ' && out_pos < max_chars - 1) {
        output[out_pos++] = *p++;
    }
    
    while (*p && word_count < max_words && out_pos < max_chars - 1) {
        while (*p == ' ' && out_pos < max_chars - 1) {
            output[out_pos++] = *p++;
        }
        if (!*p || word_count >= max_words) break;
        
        word_count++;
        while (*p && *p != ' ' && out_pos < max_chars - 1) {
            output[out_pos++] = *p++;
        }
    }
    
    if (word_count >= max_words && *p) {
        int remaining = max_chars - 1 - out_pos;
        if (remaining > 4) {
            out_pos += snprintf(output + out_pos, remaining, "...");
        }
    }
    
    output[out_pos] = 0;
}

/* Check if query exceeds word limit */
static int check_query_limit(const char *query, char *error_msg, int max_len) {
    int words = count_words(query);
    if (words > MAX_QUERY_WORDS) {
        snprintf(error_msg, max_len, 
            "Query too long. Maximum %d words allowed. You used %d.", MAX_QUERY_WORDS, words);
        return 1;
    }
    return 0;
}

#endif
