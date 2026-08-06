/* Multi-African Language Support for DeryCode AI */
#ifndef DC_LANGUAGES_H
#define DC_LANGUAGES_H

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
     "Buuza DeryCode AI ekintu kyona...", "Omutambi wo wa AI. Buuza ekintu kyona.",
     "Ruma", "DeryCode AI", "Ahamaruho", "Ebyebigyezeho", "Ebyarugire aha muguru",
     "Rondora aha Muguru", "Bigambo bya AI",
     "Nikareba ntaronda ebyarugire. Gezaako kubuuza konka.",
     "Nikitekateka..."},
    
    /* Luo (Acholi/Luo) */
    {"luo", "Luo", "Dholuo",
     "Penj DeryCode AI gin mang'eyo...", "Maromi me AI. Penj gin mang'eyo.",
     "Cwal", "DeryCode AI", "Kama odongo", "Ma marwach", "Gin ma otime i intanet",
     "Yiye i Intanet", "Lok me AI",
     "Onongo peya gin ma oyie. Tem dongo penji moker.",
     "Zwo tamo..."},
    
    /* Ateso */
    {"te", "Ateso", "Ateso",
     "Kopus DeryCode AI aki akongun...", "Ekamolo naikot AI. Kopus akongun.",
     "Rukor", "DeryCode AI", "Epar", "Eapar", "Aki internet",
     "Loka Internet", "Aki AI",
     "Akiyai nongo aki akongun. Tem aki aporopo.",
     "Eponai..."},
};

#define LANGUAGE_COUNT 6
#define MAX_QUERY_WORDS 30
#define MAX_ANSWER_WORDS 200
#define MAX_ANSWER_CHARS 1200

/* Get language by code */
static const Language *get_language(const char *code) {
    for (int i = 0; i < LANGUAGE_COUNT; i++) {
        if (strcmp(languages[i].code, code) == 0) return &languages[i];
    }
    return &languages[0]; /* default to English */
}

/* Count words in a string */
static int count_words(const char *str) {
    if (!str || !*str) return 0;
    int count = 0;
    const char *p = str;
    while (*p) {
        while (*p == ' ') p++;
        if (*p) count++;
        while (*p && *p != ' ') p++;
    }
    return count;
}

/* Truncate text to max words */
static void truncate_words(const char *input, char *output, int max_words, int max_chars) {
    int word_count = 0;
    int out_pos = 0;
    const char *p = input;
    
    while (*p && word_count < max_words && out_pos < max_chars - 1) {
        /* Skip spaces */
        while (*p == ' ' && out_pos < max_chars - 1) {
            output[out_pos++] = *p++;
        }
        if (!*p || word_count >= max_words) break;
        
        /* Copy word */
        while (*p && *p != ' ' && out_pos < max_chars - 1) {
            output[out_pos++] = *p++;
        }
        word_count++;
    }
    
    /* Add ellipsis if truncated */
    if (word_count >= max_words && *p) {
        int remaining = max_chars - 1 - out_pos;
        if (remaining >= 3) {
            output[out_pos++] = '.';
            output[out_pos++] = '.';
            output[out_pos++] = '.';
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
        return 0;
    }
    return 1;
}

#endif
