#include "languages.h"
/* Search aggregation module for DeryCode Search - ENHANCED EDITION */
#ifndef DC_SEARCH_H
#define DC_SEARCH_H

#include "json.h"

typedef struct { char *data; size_t size; } HttpResponse;

#define MAX_RESPONSE (4 * 1048576)
#define MAX_RESULTS 512
#define MAX_HTTP_TIMEOUT 12

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

static char *url_encode(const char *str) {
    char *e = malloc(strlen(str) * 3 + 1); int j = 0;
    for (int i = 0; str[i]; i++) {
        unsigned char c = str[i];
        if (isalnum(c) || c=='-'||c=='_'||c=='.'||c=='~') e[j++]=c;
        else if (c==' ') e[j++]='+';
        else j += sprintf(e+j,"%%%02X",c);
    }
    e[j]=0; return e;
}

static char *http_get(const char *url, const char *ua) {
    char cmd[8192];
    snprintf(cmd,sizeof(cmd),"curl -s -L --max-time %d -A \"%s\" -H \"Accept: application/json,text/html,*/*\" \"%s\" 2>/dev/null",MAX_HTTP_TIMEOUT,ua,url);
    FILE *fp = popen(cmd,"r"); if (!fp) return NULL;
    size_t cap=131072; char *buf=malloc(cap); size_t len=0,r;
    while ((r=fread(buf+len,1,cap-len-1,fp))>0) { len+=r; if(len>=cap-1){cap*=2; if(cap>4*1048576)break; buf=realloc(buf,cap);} }
    buf[len]=0; pclose(fp);
    if(len==0){free(buf);return NULL;} return buf;
}

static void decode_html(char *s) {
    if(!s) return; char *d=s;
    while(*s) {
        if(*s=='&') {
            if(!strncmp(s,"&amp;",5)){*d++='&';s+=5;continue;}
            if(!strncmp(s,"&lt;",4)){*d++='<';s+=4;continue;}
            if(!strncmp(s,"&gt;",4)){*d++='>';s+=4;continue;}
            if(!strncmp(s,"&quot;",6)){*d++='"';s+=6;continue;}
            if(!strncmp(s,"&#39;",5)||!strncmp(s,"&apos;",6)){*d++='\'';s+=(*s=='&'?5:6);continue;}
            if(!strncmp(s,"&nbsp;",6)){*d++=' ';s+=6;continue;}
        }
        *d++=*s++;
    }
    *d=0;
}

static void strip_html(char *s) {
    if(!s) return; char *d=s; int tag=0;
    while(*s) {
        if(*s=='<'){tag=1;s++;continue;}
        if(*s=='>'){tag=0;s++;continue;}
        if(!tag)*d++=*s; s++;
    }
    *d=0;
}

typedef struct { char title[512]; char url[1024]; char content[4096]; char engine[32]; char source[64]; int featured; } SearchResult;
typedef struct { char title[256]; char extract[4096]; char thumbnail[512]; char url[512]; int has_data; } KnowledgePanel;
typedef struct { char text[4096]; int has_data; } AiSummary;
typedef struct { char title[512]; char author[256]; char description[4096]; char isbn[32]; char cover_url[512]; char publish_year[16]; char publisher[256]; char subjects[512]; char source[64]; int has_data; } BookResult;
typedef struct { char title[512]; char url[1024]; char snippet[2048]; char source[128]; char date[32]; char image_url[512]; } NewsResult;
typedef struct { char title[512]; char url[1024]; char content[16384]; char author[256]; char date[32]; int has_data; } FullContent;

typedef struct {
    SearchResult results[MAX_RESULTS]; int result_count;
    KnowledgePanel kp; AiSummary ai;
    char related[10][128]; double elapsed; int source_count;
    int book_count; BookResult books[20];
    int news_count; NewsResult news[20];
} SearchResponse;

typedef struct { char role[16]; char content[4096]; } AiMessage;
typedef struct { char answer[MAX_ANSWER_CHARS]; char sources[2048]; char topic[256]; int has_data; char follow_ups[3][256]; } AiResponse;
typedef struct { char title[256]; char content[4096]; char source_url[1024]; char source_name[128]; } DerickStep;
typedef struct { DerickStep steps[MAX_GUIDE_STEPS]; int step_count; char intro[2048]; char topic[256]; char tips[2048]; char warnings[1024]; int has_data; char deep_content[8192]; int has_deep_content; } DerickGuide;

static void extract_key_sentences(const char *t, char *o, int m) {
    if(!t||!o||m<=0){if(o)o[0]=0;return;} strncpy(o,t,m-1); o[m-1]=0;
}

static void dedup_results(SearchResponse *r) {
    for(int i=0;i<r->result_count;i++)
        for(int j=i+1;j<r->result_count;j++)
            if(strcasecmp(r->results[i].url,r->results[j].url)==0) {
                memmove(&r->results[j],&r->results[j+1],(r->result_count-j-1)*sizeof(SearchResult));
                r->result_count--; j--;
            }
}

static void generate_ai_summary(SearchResponse *r) {
    if(r->result_count==0){r->ai.has_data=0;return;}
    int off=0;
    if(r->kp.has_data && strlen(r->kp.extract)>50) {
        off+=snprintf(r->ai.text+off,sizeof(r->ai.text)-off,"%s\n\n",r->kp.extract);
    }
    for(int i=0;i<r->result_count&&i<20&&off<(int)sizeof(r->ai.text)-512;i++) {
        if(strlen(r->results[i].content)<50) continue;
        char sn[2048]; extract_key_sentences(r->results[i].content,sn,sizeof(sn));
        if(strlen(sn)>30) { off+=snprintf(r->ai.text+off,sizeof(r->ai.text)-off,"[%s] %s\n\n",r->results[i].source,sn); }
    }
    r->ai.has_data=(off>50)?1:0;
}

static void generate_related(const char *q, SearchResponse *r) {
    snprintf(r->related[0],127,"what is %s",q);
    snprintf(r->related[1],127,"how to %s",q);
    snprintf(r->related[2],127,"%s explained",q);
    snprintf(r->related[3],127,"%s tutorial",q);
    snprintf(r->related[4],127,"best %s",q);
    snprintf(r->related[5],127,"%s examples",q);
    snprintf(r->related[6],127,"%s vs alternatives",q);
    snprintf(r->related[7],127,"%s latest news",q);
    snprintf(r->related[8],127,"%s cost pricing",q);
    snprintf(r->related[9],127,"%s reviews",q);
}
/* ========== SEARCH SOURCES ========== */

static void search_duckduckgo(const char *query, SearchResult *results, int *count, int max) {
    char *enc=url_encode(query); char url[1024];
    snprintf(url,sizeof(url),"https://api.duckduckgo.com/?q=%s&format=json&no_html=1&skip_disambig=1",enc);
    free(enc); char *raw=http_get(url,"DeryCodeSearch/1.0"); if(!raw) return;
    JsonValue *json=json_parse(raw); free(raw); if(!json) return;
    const char *ab=json_get_string(json,"Abstract");
    if(ab&&strlen(ab)>20&&*count<max) {
        strncpy(results[*count].title,"DuckDuckGo Instant Answer",511);
        strncpy(results[*count].url,"https://duckduckgo.com",1023);
        strncpy(results[*count].content,ab,4095);
        strcpy(results[*count].engine,"duckduckgo"); strcpy(results[*count].source,"DuckDuckGo");
        results[*count].featured=1; (*count)++;
    }
    JsonValue *topics=json_get_array(json,"RelatedTopics");
    if(topics&&topics->type==JSON_ARR) {
        int len=json_array_len(topics); if(len>15)len=15;
        for(int i=0;i<len&&*count<max;i++) {
            JsonValue *t=json_array_at(topics,i); if(!t||t->type!=JSON_OBJ) continue;
            const char *tx=json_get_string(t,"Text"),*fu=json_get_string(t,"FirstURL");
            if(tx&&fu&&strlen(tx)>20) {
                strncpy(results[*count].title,tx,100); results[*count].title[100]=0;
                strncpy(results[*count].url,fu,1023); strncpy(results[*count].content,tx,4095);
                strcpy(results[*count].engine,"duckduckgo"); strcpy(results[*count].source,"DuckDuckGo");
                results[*count].featured=0; (*count)++;
            }
        }
    }
    json_free(json);
}

static void search_wikipedia(const char *query, SearchResult *results, int *count, int max, KnowledgePanel *kp) {
    char *enc=url_encode(query); char url[1024];
    snprintf(url,sizeof(url),"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=%s&format=json&srlimit=5",enc);
    free(enc); char *raw=http_get(url,"DeryCodeSearch/1.0"); if(!raw) return;
    JsonValue *json=json_parse(raw); free(raw); if(!json) return;
    JsonValue *qo=json_get_object(json,"query"); if(!qo){json_free(json);return;}
    JsonValue *sa=json_get_array(qo,"search"); if(!sa||sa->type!=JSON_ARR){json_free(json);return;}
    int len=json_array_len(sa); if(len>5)len=5;
    for(int i=0;i<len&&*count<max;i++) {
        JsonValue *s=json_array_at(sa,i); if(!s) continue;
        const char *title=json_get_string(s,"title"),*snip=json_get_string(s,"snippet");
        if(title) {
            char pu[512]; snprintf(pu,sizeof(pu),"https://en.wikipedia.org/wiki/%s",title);
            for(char *p=pu;*p;*p==' '?*p='_':0,p++);
            strncpy(results[*count].title,title,511); strncpy(results[*count].url,pu,1023);
            if(snip){strncpy(results[*count].content,snip,4095);decode_html(results[*count].content);}
            strcpy(results[*count].engine,"wikipedia"); strcpy(results[*count].source,"Wikipedia");
            results[*count].featured=(i==0)?1:0; (*count)++;
        }
    }
    json_free(json);
    /* Knowledge panel */
    enc=url_encode(query); snprintf(url,sizeof(url),"https://en.wikipedia.org/api/rest_v1/page/summary/%s",enc); free(enc);
    raw=http_get(url,"DeryCodeSearch/1.0"); if(raw) {
        JsonValue *kj=json_parse(raw); free(raw);
        if(kj) {
            const char *t=json_get_string(kj,"title"),*ex=json_get_string(kj,"extract");
            if(t)strncpy(kp->title,t,255); if(ex)strncpy(kp->extract,ex,4095);
            JsonValue *th=json_get_object(kj,"thumbnail");
            if(th){const char *tu=json_get_string(th,"source");if(tu)strncpy(kp->thumbnail,tu,511);}
            JsonValue *cu=json_get_object(kj,"content_urls");
            if(cu){JsonValue *de=json_get_object(cu,"desktop");if(de){const char *pu=json_get_string(de,"page");if(pu)strncpy(kp->url,pu,511);}}
            kp->has_data=(ex&&strlen(ex)>20)?1:0; json_free(kj);
        }
    }
}

static void search_github(const char *query, SearchResult *results, int *count, int max) {
    char *enc=url_encode(query); char url[1024];
    snprintf(url,sizeof(url),"https://api.github.com/search/repositories?q=%s&sort=stars&order=desc&per_page=10",enc);
    free(enc); char *raw=http_get(url,"DeryCodeSearch/1.0"); if(!raw) return;
    JsonValue *json=json_parse(raw); free(raw); if(!json) return;
    JsonValue *items=json_get_array(json,"items"); if(!items||items->type!=JSON_ARR){json_free(json);return;}
    int len=json_array_len(items); if(len>10)len=10;
    for(int i=0;i<len&&*count<max;i++) {
        JsonValue *it=json_array_at(items,i); if(!it) continue;
        const char *name=json_get_string(it,"full_name"),*desc=json_get_string(it,"description"),*hu=json_get_string(it,"html_url");
        if(name&&hu) {
            strncpy(results[*count].title,name,511); strncpy(results[*count].url,hu,1023);
            if(desc)strncpy(results[*count].content,desc,4095);
            strcpy(results[*count].engine,"github"); strcpy(results[*count].source,"GitHub");
            results[*count].featured=0; (*count)++;
        }
    }
    json_free(json);
}

static void search_duckduckgo_html(const char *query, SearchResult *results, int *count, int max) {
    char *enc=url_encode(query); char url[2048];
    snprintf(url,sizeof(url),"https://html.duckduckgo.com/html/?q=%s",enc); free(enc);
    char cmd[4096];
    snprintf(cmd,sizeof(cmd),"curl -s -L --max-time %d -A \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0\" \"%s\" 2>/dev/null",MAX_HTTP_TIMEOUT,url);
    FILE *fp=popen(cmd,"r"); if(!fp) return;
    size_t cap=262144; char *html=malloc(cap); size_t len=0,r;
    while((r=fread(html+len,1,cap-len-1,fp))>0){len+=r;if(len>=cap-1){cap*=2;html=realloc(html,cap);}if(cap>1048576)break;}
    html[len]=0; pclose(fp); if(len==0){free(html);return;}
    char *p=html; int found=0;
    while(p&&*p&&found<30&&*count<max) {
        char *ls=strstr(p,"result__a\" href=\""); if(!ls)ls=strstr(p,"result__url\" href=\""); if(!ls)break;
        ls+=16; char *le=strchr(ls,'"'); if(!le)break;
        int ul=le-ls; if(ul>0&&ul<1024) {
            char ru[1024]; strncpy(ru,ls,ul); ru[ul]=0; decode_html(ru);
            char *ts=strchr(le,'>'); if(ts){ts++; char *te=strchr(ts,'<'); if(te){int tl=te-ts; if(tl>0&&tl<512){
                char title[512]; strncpy(title,ts,tl); title[tl]=0; decode_html(title); strip_html(title);
                char *ss=strstr(te,"result__snippet\">");
                if(ss){ss+=18; char *se=strstr(ss,"</a>"); if(!se)se=strstr(ss,"</div>");
                if(se){int sl=se-ss; if(sl>0&&sl<4096){
                    char sn[4096]; strncpy(sn,ss,sl); sn[sl]=0; decode_html(sn); strip_html(sn);
                    strncpy(results[*count].title,title,511); strncpy(results[*count].url,ru,1023);
                    strncpy(results[*count].content,sn,4095);
                    strcpy(results[*count].engine,"ddg-html"); strcpy(results[*count].source,"DuckDuckGo Web");
                    results[*count].featured=0; (*count)++; found++;
                }}}}
            }}}
        }
        p=le+1;
    }
    free(html);
}
static void search_reddit(const char *query, SearchResult *results, int *count, int max) {
    char *enc=url_encode(query); char url[1024];
    snprintf(url,sizeof(url),"https://www.reddit.com/search.json?q=%s&sort=relevance&limit=15&t=year",enc); free(enc);
    char *raw=http_get(url,"DeryCodeSearch/1.0"); if(!raw) return;
    JsonValue *json=json_parse(raw); free(raw); if(!json) return;
    JsonValue *data=json_get_object(json,"data"); if(!data){json_free(json);return;}
    JsonValue *children=json_get_array(data,"children"); if(!children||children->type!=JSON_ARR){json_free(json);return;}
    int len=json_array_len(children); if(len>15)len=15;
    for(int i=0;i<len&&*count<max;i++) {
        JsonValue *c=json_array_at(children,i); if(!c) continue;
        JsonValue *d=json_get_object(c,"data"); if(!d) continue;
        const char *title=json_get_string(d,"title"),*self=json_get_string(d,"selftext"),
                   *perm=json_get_string(d,"permalink"),*sub=json_get_string(d,"subreddit");
        if(title&&perm) {
            char fu[1024]; snprintf(fu,sizeof(fu),"https://www.reddit.com%s",perm);
            strncpy(results[*count].title,title,511); strncpy(results[*count].url,fu,1023);
            if(self&&strlen(self)>20) strncpy(results[*count].content,self,4095);
            else snprintf(results[*count].content,4095,"Discussion in r/%s",sub?sub:"reddit");
            strcpy(results[*count].engine,"reddit");
            snprintf(results[*count].source,63,"Reddit r/%s",sub?sub:"");
            results[*count].featured=0; (*count)++;
        }
    }
    json_free(json);
}

static void search_hackernews(const char *query, SearchResult *results, int *count, int max) {
    char *enc=url_encode(query); char url[1024];
    snprintf(url,sizeof(url),"https://hn.algolia.com/api/v1/search?query=%s&tags=story&hitsPerPage=10",enc); free(enc);
    char *raw=http_get(url,"DeryCodeSearch/1.0"); if(!raw) return;
    JsonValue *json=json_parse(raw); free(raw); if(!json) return;
    JsonValue *hits=json_get_array(json,"hits"); if(!hits||hits->type!=JSON_ARR){json_free(json);return;}
    int len=json_array_len(hits); if(len>10)len=10;
    for(int i=0;i<len&&*count<max;i++) {
        JsonValue *h=json_array_at(hits,i); if(!h) continue;
        const char *title=json_get_string(h,"title"),*url_str=json_get_string(h,"url"),
                   *pts=json_get_string(h,"points"),*oid=json_get_string(h,"objectID");
        if(title) {
            if(url_str&&strlen(url_str)>5) strncpy(results[*count].url,url_str,1023);
            else snprintf(results[*count].url,1023,"https://news.ycombinator.com/item?id=%s",oid?oid:"");
            strncpy(results[*count].title,title,511);
            snprintf(results[*count].content,4095,"Hacker News story (%s points)",pts?pts:"?");
            strcpy(results[*count].engine,"hackernews"); strcpy(results[*count].source,"Hacker News");
            results[*count].featured=0; (*count)++;
        }
    }
    json_free(json);
}

static void search_stackexchange(const char *query, SearchResult *results, int *count, int max) {
    char *enc=url_encode(query); char url[1024];
    snprintf(url,sizeof(url),"https://api.stackexchange.com/2.3/search?order=desc&sort=votes&intitle=%s&site=stackoverflow&pagesize=10&filter=withbody",enc); free(enc);
    char cmd[4096];
    snprintf(cmd,sizeof(cmd),"curl -s -L --max-time %d -A \"DeryCodeSearch/1.0\" -H \"Accept-Encoding: identity\" \"%s\" 2>/dev/null",MAX_HTTP_TIMEOUT,url);
    FILE *fp=popen(cmd,"r"); if(!fp) return;
    size_t cap=131072; char *buf=malloc(cap); size_t len=0,r;
    while((r=fread(buf+len,1,cap-len-1,fp))>0){len+=r;if(len>=cap-1){cap*=2;buf=realloc(buf,cap);}}
    buf[len]=0; pclose(fp);
    JsonValue *json=json_parse(buf); free(buf); if(!json) return;
    JsonValue *items=json_get_array(json,"items"); if(!items||items->type!=JSON_ARR){json_free(json);return;}
    int num=json_array_len(items); if(num>10)num=10;
    for(int i=0;i<num&&*count<max;i++) {
        JsonValue *it=json_array_at(items,i); if(!it) continue;
        const char *title=json_get_string(it,"title"),*link=json_get_string(it,"link"),*body=json_get_string(it,"body");
        if(title&&link) {
            strncpy(results[*count].title,title,511); strncpy(results[*count].url,link,1023);
            if(body){strncpy(results[*count].content,body,4095);strip_html(results[*count].content);decode_html(results[*count].content);}
            strcpy(results[*count].engine,"stackexchange"); strcpy(results[*count].source,"Stack Overflow");
            results[*count].featured=0; (*count)++;
        }
    }
    json_free(json);
}

static void search_arxiv(const char *query, SearchResult *results, int *count, int max) {
    char *enc=url_encode(query); char url[1024];
    snprintf(url,sizeof(url),"https://export.arxiv.org/api/query?search_query=all:%s&max_results=8&sortBy=relevance",enc); free(enc);
    char *raw=http_get(url,"DeryCodeSearch/1.0"); if(!raw) return;
    char *p=raw; int found=0;
    while(p&&*p&&found<8&&*count<max) {
        char *entry=strstr(p,"<entry>"); if(!entry) break;
        char *ts=strstr(entry,"<title>"),*te=strstr(entry,"</title>");
        char *ss=strstr(entry,"<summary>"),*se=strstr(entry,"</summary>");
        char *is=strstr(entry,"<id>"),*ie=strstr(entry,"</id>");
        if(ts&&te&&ss&&se) {
            ts+=7; int tl=te-ts; ss+=9; int sl=se-ss;
            char title[512]; strncpy(title,ts,tl>511?511:tl); title[tl>511?511:tl]=0; decode_html(title); strip_html(title);
            char summary[4096]; strncpy(summary,ss,sl>4095?4095:sl); summary[sl>4095?4095:sl]=0; decode_html(summary); strip_html(summary);
            char au[512]=""; if(is&&ie){is+=4; int il=ie-is; strncpy(au,is,il>511?511:il); au[il>511?511:il]=0;}
            strncpy(results[*count].title,title,511); strncpy(results[*count].url,au,1023);
            strncpy(results[*count].content,summary,4095);
            strcpy(results[*count].engine,"arxiv"); strcpy(results[*count].source,"ArXiv");
            results[*count].featured=0; (*count)++; found++;
        }
        p=entry+7;
    }
    free(raw);
}

static void search_archive(const char *query, SearchResult *results, int *count, int max) {
    char *enc=url_encode(query); char url[2048];
    snprintf(url,sizeof(url),"https://archive.org/advancedsearch.php?q=%s&fl[]=identifier&fl[]=title&fl[]=description&rows=10&output=json",enc); free(enc);
    char *raw=http_get(url,"DeryCodeSearch/1.0"); if(!raw) return;
    JsonValue *json=json_parse(raw); free(raw); if(!json) return;
    JsonValue *resp=json_get_object(json,"response"); if(!resp){json_free(json);return;}
    JsonValue *docs=json_get_array(resp,"docs"); if(!docs||docs->type!=JSON_ARR){json_free(json);return;}
    int len=json_array_len(docs); if(len>10)len=10;
    for(int i=0;i<len&&*count<max;i++) {
        JsonValue *d=json_array_at(docs,i); if(!d) continue;
        const char *title=json_get_string(d,"title"),*id=json_get_string(d,"identifier"),*desc=json_get_string(d,"description");
        if(title&&id) {
            char au[1024]; snprintf(au,sizeof(au),"https://archive.org/details/%s",id);
            strncpy(results[*count].title,title,511); strncpy(results[*count].url,au,1023);
            if(desc){strncpy(results[*count].content,desc,4095);strip_html(results[*count].content);}
            strcpy(results[*count].engine,"archive"); strcpy(results[*count].source,"Internet Archive");
            results[*count].featured=0; (*count)++;
        }
    }
    json_free(json);
}

static void search_openlibrary(const char *query, SearchResult *results, int *count, int max) {
    char *enc=url_encode(query); char url[2048];
    snprintf(url,sizeof(url),"https://openlibrary.org/search.json?q=%s&limit=10&fields=title,author_name,first_publish_year,subject,id,isbn,description",enc); free(enc);
    char *raw=http_get(url,"DeryCodeSearch/1.0"); if(!raw) return;
    JsonValue *json=json_parse(raw); free(raw); if(!json) return;
    JsonValue *docs=json_get_array(json,"docs"); if(!docs||docs->type!=JSON_ARR){json_free(json);return;}
    int len=json_array_len(docs); if(len>10)len=10;
    for(int i=0;i<len&&*count<max;i++) {
        JsonValue *d=json_array_at(docs,i); if(!d) continue;
        const char *title=json_get_string(d,"title"); if(!title) continue;
        JsonValue *authors=json_get_array(d,"author_name"); char author[256]="Unknown";
        if(authors&&authors->type==JSON_ARR&&json_array_len(authors)>0) {
            JsonValue *a=json_array_at(authors,0); if(a&&a->type==JSON_STR) strncpy(author,a->string,255);
        }
        const char *year=json_get_string(d,"first_publish_year");
        char bu[1024]; snprintf(bu,sizeof(bu),"https://openlibrary.org/search?q=%s",url_encode(title));
        if(year) snprintf(results[*count].content,4095,"Book by %s (first published %s)",author,year);
        else snprintf(results[*count].content,4095,"Book by %s",author);
        strncpy(results[*count].title,title,511); strncpy(results[*count].url,bu,1023);
        strcpy(results[*count].engine,"openlibrary"); strcpy(results[*count].source,"Open Library");
        results[*count].featured=0; (*count)++;
    }
    json_free(json);
}

static void search_semantic_scholar(const char *query, SearchResult *results, int *count, int max) {
    char *enc=url_encode(query); char url[1024];
    snprintf(url,sizeof(url),"https://api.semanticscholar.org/graph/v1/paper/search?query=%s&limit=8&fields=title,abstract,year,url,authors",enc); free(enc);
    char *raw=http_get(url,"DeryCodeSearch/1.0"); if(!raw) return;
    JsonValue *json=json_parse(raw); free(raw); if(!json) return;
    JsonValue *data=json_get_array(json,"data"); if(!data||data->type!=JSON_ARR){json_free(json);return;}
    int len=json_array_len(data); if(len>8)len=8;
    for(int i=0;i<len&&*count<max;i++) {
        JsonValue *p=json_array_at(data,i); if(!p) continue;
        const char *title=json_get_string(p,"title"),*ab=json_get_string(p,"abstract"),
                   *url_str=json_get_string(p,"url"),*year=json_get_string(p,"year");
        if(title) {
            strncpy(results[*count].title,title,511);
            if(url_str) strncpy(results[*count].url,url_str,1023);
            if(ab) strncpy(results[*count].content,ab,4095);
            if(year){char ys[64]; snprintf(ys,sizeof(ys)," (%s)",year); strncat(results[*count].content,ys,63);}
            strcpy(results[*count].engine,"semantic-scholar"); strcpy(results[*count].source,"Semantic Scholar");
            results[*count].featured=0; (*count)++;
        }
    }
    json_free(json);
}
/* ========== NEW SOURCES ========== */

/* Google Books - full book search */
static void search_google_books(const char *query, SearchResult *results, int *count, int max, BookResult *books, int *book_count) {
    char *enc=url_encode(query); char url[2048];
    snprintf(url,sizeof(url),"https://www.googleapis.com/books/v1/volumes?q=%s&maxResults=15&printType=books&projection=full",enc); free(enc);
    char *raw=http_get(url,"DeryCodeSearch/1.0"); if(!raw) return;
    JsonValue *json=json_parse(raw); free(raw); if(!json) return;
    JsonValue *items=json_get_array(json,"items"); if(!items||items->type!=JSON_ARR){json_free(json);return;}
    int len=json_array_len(items); if(len>15)len=15;
    for(int i=0;i<len&&*count<max;i++) {
        JsonValue *item=json_array_at(items,i); if(!item) continue;
        JsonValue *vol=json_get_object(item,"volumeInfo"); if(!vol) continue;
        const char *title=json_get_string(vol,"title"),*desc=json_get_string(vol,"description"),
                   *info_url=json_get_string(vol,"infoLink"),*pub=json_get_string(vol,"publisher"),
                   *pub_date=json_get_string(vol,"publishedDate");
        JsonValue *authors=json_get_array(vol,"authors"); char author[256]="Unknown";
        if(authors&&authors->type==JSON_ARR&&json_array_len(authors)>0) {
            JsonValue *a=json_array_at(authors,0); if(a&&a->type==JSON_STR) strncpy(author,a->string,255);
        }
        char cover_url[512]=""; JsonValue *img=json_get_object(vol,"imageLinks");
        if(img){const char *thumb=json_get_string(img,"thumbnail"); if(thumb) strncpy(cover_url,thumb,511);}
        char subjects[512]=""; JsonValue *cats=json_get_array(vol,"categories");
        if(cats&&cats->type==JSON_ARR&&json_array_len(cats)>0) {
            JsonValue *c=json_array_at(cats,0); if(c&&c->type==JSON_STR) strncpy(subjects,c->string,511);
        }
        if(title) {
            snprintf(results[*count].title,511,"%s by %s",title,author);
            if(info_url) strncpy(results[*count].url,info_url,1023);
            else snprintf(results[*count].url,1023,"https://books.google.com/books?q=%s",url_encode(title));
            if(desc) strncpy(results[*count].content,desc,4095);
            else snprintf(results[*count].content,4095,"Book by %s%s%s%s",author,pub?", published by ":"",pub?pub:"",pub_date?", ":"");
            strcpy(results[*count].engine,"google-books"); strcpy(results[*count].source,"Google Books");
            results[*count].featured=0; (*count)++;
            if(*book_count<20) {
                strncpy(books[*book_count].title,title,511); strncpy(books[*book_count].author,author,255);
                if(desc) strncpy(books[*book_count].description,desc,4095);
                else snprintf(books[*book_count].description,4095,"No description available.");
                if(cover_url[0]) strncpy(books[*book_count].cover_url,cover_url,511);
                if(pub_date) strncpy(books[*book_count].publish_year,pub_date,15);
                if(pub) strncpy(books[*book_count].publisher,pub,255);
                if(subjects[0]) strncpy(books[*book_count].subjects,subjects,511);
                strcpy(books[*book_count].source,"Google Books"); books[*book_count].has_data=1; (*book_count)++;
            }
        }
    }
    json_free(json);
}

/* Google News - stay up to date */
static void search_google_news(const char *query, SearchResult *results, int *count, int max, NewsResult *news, int *news_count) {
    char *enc=url_encode(query); char url[2048];
    snprintf(url,sizeof(url),"https://news.google.com/rss/search?q=%s&hl=en-US&gl=US&ceid=US:en",enc); free(enc);
    char cmd[4096];
    snprintf(cmd,sizeof(cmd),"curl -s -L --max-time %d -A \"Mozilla/5.0 (compatible; DeryCodeSearch/1.0)\" \"%s\" 2>/dev/null",MAX_HTTP_TIMEOUT,url);
    FILE *fp=popen(cmd,"r"); if(!fp) return;
    size_t cap=131072; char *xml=malloc(cap); size_t len=0,r;
    while((r=fread(xml+len,1,cap-len-1,fp))>0){len+=r;if(len>=cap-1){cap*=2;xml=realloc(xml,cap);}}
    xml[len]=0; pclose(fp); if(len==0){free(xml);return;}
    char *p=xml; int found=0;
    while(p&&*p&&found<15&&*count<max) {
        char *is=strstr(p,"<item>"); if(!is) break;
        char *ie=strstr(is,"</item>"); if(!ie) break;
        char *ts=strstr(is,"<title>"),*te=strstr(is,"</title>");
        char *ls=strstr(is,"<link>"),*le=strstr(is,"</link>");
        char *ds=strstr(is,"<description>"),*de=strstr(is,"</description>");
        char *ss=strstr(is,"<source"),*pds=strstr(is,"<pubDate>"),*pde=strstr(is,"</pubDate>");
        if(ts&&te){ts+=7; int tl=te-ts;
            char title[512]; strncpy(title,ts,tl>511?511:tl); title[tl>511?511:tl]=0; decode_html(title); strip_html(title);
            char link[1024]=""; if(ls&&le){ls+=6; int ll=le-ls; strncpy(link,ls,ll>1023?1023:ll); link[ll>1023?1023:ll]=0;}
            char desc[4096]=""; if(ds&&de){ds+=13; int dl=de-ds; strncpy(desc,ds,dl>4095?4095:dl); desc[dl>4095?4095:dl]=0; decode_html(desc); strip_html(desc);}
            char src[128]="Google News";
            if(ss){char*sa=strstr(ss,">"); if(sa){sa++; char*sc=strstr(sa,"</source>"); if(sc){int sl=sc-sa; strncpy(src,sa,sl>127?127:sl); src[sl>127?127:sl]=0;}}}
            char pd[32]=""; if(pds&&pde){pds+=9; int pl=pde-pds; strncpy(pd,pds,pl>31?31:pl); pd[pl>31?31:pl]=0;}
            strncpy(results[*count].title,title,511);
            if(link[0]) strncpy(results[*count].url,link,1023);
            strncpy(results[*count].content,desc[0]?desc:"News article",4095);
            strcpy(results[*count].engine,"google-news");
            snprintf(results[*count].source,63,"News: %s",src);
            results[*count].featured=0; (*count)++;
            if(*news_count<20){strncpy(news[*news_count].title,title,511);if(link[0])strncpy(news[*news_count].url,link,1023);strncpy(news[*news_count].snippet,desc,2047);strncpy(news[*news_count].source,src,127);strncpy(news[*news_count].date,pd,31);(*news_count)++;}
            found++;
        }
        p=ie+7;
    }
    free(xml);
}

/* Project Gutenberg - free full books */
static void search_gutenberg(const char *query, SearchResult *results, int *count, int max, BookResult *books, int *book_count) {
    char *enc=url_encode(query); char url[1024];
    snprintf(url,sizeof(url),"https://gutendex.com/books?search=%s",enc); free(enc);
    char *raw=http_get(url,"DeryCodeSearch/1.0"); if(!raw) return;
    JsonValue *json=json_parse(raw); free(raw); if(!json) return;
    JsonValue *results_arr=json_get_array(json,"results"); if(!results_arr||results_arr->type!=JSON_ARR){json_free(json);return;}
    int len=json_array_len(results_arr); if(len>10)len=10;
    for(int i=0;i<len&&*count<max;i++) {
        JsonValue *book=json_array_at(results_arr,i); if(!book) continue;
        const char *title=json_get_string(book,"title");
        int book_id=0; JsonValue *id_val=json_get(book,"id");
        if(id_val&&id_val->type==JSON_NUM) book_id=(int)id_val->number;
        JsonValue *authors=json_get_array(book,"authors"); char author[256]="Unknown";
        if(authors&&authors->type==JSON_ARR&&json_array_len(authors)>0) {
            JsonValue *a=json_array_at(authors,0); if(a){const char*name=json_get_string(a,"name"); if(name) strncpy(author,name,255);}
        }
        char subjects[512]=""; JsonValue *subj=json_get_array(book,"subjects");
        if(subj&&subj->type==JSON_ARR&&json_array_len(subj)>0){JsonValue*s=json_array_at(subj,0); if(s&&s->type==JSON_STR) strncpy(subjects,s->string,511);}
        if(title&&book_id>0) {
            char bu[256]; snprintf(bu,sizeof(bu),"https://www.gutenberg.org/ebooks/%d",book_id);
            snprintf(results[*count].title,511,"%s by %s (FREE)",title,author);
            strncpy(results[*count].url,bu,1023);
            snprintf(results[*count].content,4095,"Free public domain book by %s. %s",author,subjects);
            strcpy(results[*count].engine,"gutenberg"); strcpy(results[*count].source,"Project Gutenberg");
            results[*count].featured=0; (*count)++;
            if(*book_count<20) {
                strncpy(books[*book_count].title,title,511); strncpy(books[*book_count].author,author,255);
                snprintf(books[*book_count].description,4095,"Free public domain book. %s",subjects);
                snprintf(books[*book_count].isbn,31,"gutenberg-%d",book_id);
                strncpy(books[*book_count].subjects,subjects,511);
                strcpy(books[*book_count].source,"Project Gutenberg"); books[*book_count].has_data=1; (*book_count)++;
            }
        }
    }
    json_free(json);
}

/* PubMed - medical research */
static void search_pubmed(const char *query, SearchResult *results, int *count, int max) {
    char *enc=url_encode(query); char url[2048];
    snprintf(url,sizeof(url),"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=%s&retmax=8&retmode=json",enc); free(enc);
    char *raw=http_get(url,"DeryCodeSearch/1.0"); if(!raw) return;
    JsonValue *json=json_parse(raw); free(raw); if(!json) return;
    JsonValue *result=json_get_object(json,"esearchresult"); if(!result){json_free(json);return;}
    JsonValue *id_list=json_get_array(result,"idlist"); if(!id_list||id_list->type!=JSON_ARR){json_free(json);return;}
    int len=json_array_len(id_list); if(len>8)len=8;
    char ids_str[512]="";
    for(int i=0;i<len;i++) {
        JsonValue *id_val=json_array_at(id_list,i); if(!id_val) continue;
        if(i>0) strncat(ids_str,",",sizeof(ids_str)-strlen(ids_str)-1);
        if(id_val->type==JSON_STR) strncat(ids_str,id_val->string,sizeof(ids_str)-strlen(ids_str)-1);
        else if(id_val->type==JSON_NUM){char ns[32]; snprintf(ns,sizeof(ns),"%d",(int)id_val->number); strncat(ids_str,ns,sizeof(ids_str)-strlen(ids_str)-1);}
    }
    json_free(json);
    if(strlen(ids_str)==0) return;
    char url2[2048];
    snprintf(url2,sizeof(url2),"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=%s&retmode=json",ids_str);
    raw=http_get(url2,"DeryCodeSearch/1.0"); if(!raw) return;
    json=json_parse(raw); free(raw); if(!json) return;
    JsonValue *r2=json_get_object(json,"result"); if(!r2){json_free(json);return;}
    JsonValue *uids=json_get_array(r2,"uids"); if(!uids||uids->type!=JSON_ARR){json_free(json);return;}
    int nu=json_array_len(uids); if(nu>8)nu=8;
    for(int i=0;i<nu&&*count<max;i++) {
        JsonValue *uv=json_array_at(uids,i); if(!uv||uv->type!=JSON_STR) continue;
        JsonValue *art=json_get_object(r2,uv->string); if(!art) continue;
        const char *title=json_get_string(art,"title"),*pd=json_get_string(art,"pubdate"),*src=json_get_string(art,"source");
        char fa[256]="Unknown"; JsonValue *aa=json_get_array(art,"authors");
        if(aa&&aa->type==JSON_ARR&&json_array_len(aa)>0){JsonValue*a=json_array_at(aa,0); if(a){const char*name=json_get_string(a,"name"); if(name) strncpy(fa,name,255);}}
        if(title) {
            strncpy(results[*count].title,title,511);
            snprintf(results[*count].url,1023,"https://pubmed.ncbi.nlm.nih.gov/%s/",uv->string);
            snprintf(results[*count].content,4095,"PubMed article by %s, published %s in %s. PMID: %s",fa,pd?pd:"?",src?src:"PubMed",uv->string);
            strcpy(results[*count].engine,"pubmed"); strcpy(results[*count].source,"PubMed");
            results[*count].featured=0; (*count)++;
        }
    }
    json_free(json);
}

/* Google Scholar via scraping */
static void search_scholar(const char *query, SearchResult *results, int *count, int max) {
    char *enc=url_encode(query); char url[2048];
    snprintf(url,sizeof(url),"https://scholar.google.com/scholar?q=%s&hl=en&as_sdt=0,5",enc); free(enc);
    char cmd[4096];
    snprintf(cmd,sizeof(cmd),"curl -s -L --max-time %d -A \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0\" \"%s\" 2>/dev/null",MAX_HTTP_TIMEOUT,url);
    FILE *fp=popen(cmd,"r"); if(!fp) return;
    size_t cap=131072; char *html=malloc(cap); size_t len=0,r;
    while((r=fread(html+len,1,cap-len-1,fp))>0){len+=r;if(len>=cap-1){cap*=2;html=realloc(html,cap);}if(cap>524288)break;}
    html[len]=0; pclose(fp); if(len==0){free(html);return;}
    char *p=html; int found=0;
    while(p&&*p&&found<8&&*count<max) {
        char *rd=strstr(p,"gs_r gs_or"); if(!rd)rd=strstr(p,"data-rid="); if(!rd) break;
        char *ts=strstr(rd,"gs_rt"); if(!ts){p=rd+10;continue;} ts=strstr(ts,">");
        if(!ts){p=rd+10;continue;} ts++; char *te=strchr(ts,'<'); if(!te){p=rd+10;continue;}
        int tl=te-ts; char title[512]; strncpy(title,ts,tl>511?511:tl); title[tl>511?511:tl]=0; strip_html(title); decode_html(title);
        char snippet[4096]=""; char *ss=strstr(te,"gs_rs");
        if(ss){ss=strstr(ss,">"); if(ss){ss++; char*se=strstr(ss,"</div>"); if(se){int sl=se-ss; strncpy(snippet,ss,sl>4095?4095:sl); snippet[sl>4095?4095:sl]=0; strip_html(snippet); decode_html(snippet);}}}
        char meta[512]=""; char *ms=strstr(te,"gs_a");
        if(ms){ms=strstr(ms,">"); if(ms){ms++; char*me=strstr(ms,"</div>"); if(me){int ml=me-ms; strncpy(meta,ms,ml>511?511:ml); meta[ml>511?511:ml]=0; strip_html(meta); decode_html(meta);}}}
        char link[1024]=""; char *ls=strstr(rd,"href=\"");
        if(ls){ls+=6; char*le=strchr(ls,'"'); if(le){int ll=le-ls; strncpy(link,ls,ll>1023?1023:ll); link[ll>1023?1023:ll]=0;}}
        if(strlen(title)>5) {
            strncpy(results[*count].title,title,511);
            if(link[0]) strncpy(results[*count].url,link,1023);
            else snprintf(results[*count].url,1023,"https://scholar.google.com/scholar?q=%s",url_encode(title));
            snprintf(results[*count].content,4095,"%s%s%s",meta,meta[0]?" - ":"",snippet);
            strcpy(results[*count].engine,"google-scholar"); strcpy(results[*count].source,"Google Scholar");
            results[*count].featured=0; (*count)++; found++;
        }
        p=rd+10;
    }
    free(html);
}

/* Deep content extraction */
static FullContent *extract_full_content(const char *target_url) {
    FullContent *fc=calloc(1,sizeof(FullContent)); if(!target_url||strlen(target_url)==0){fc->has_data=0;return fc;}
    char cmd[8192];
    snprintf(cmd,sizeof(cmd),"curl -s -L --max-time %d -A \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0\" \"%s\" 2>/dev/null",MAX_HTTP_TIMEOUT,target_url);
    FILE *fp=popen(cmd,"r"); if(!fp){fc->has_data=0;return fc;}
    size_t cap=262144; char *html=malloc(cap); size_t len=0,r;
    while((r=fread(html+len,1,cap-len-1,fp))>0){len+=r;if(len>=cap-1){cap*=2;if(cap>1048576)break;html=realloc(html,cap);}}
    html[len]=0; pclose(fp); if(len==0){free(html);fc->has_data=0;return fc;}
    char *ts=strstr(html,"<title>"),*te=strstr(html,"</title>");
    if(ts&&te){ts+=7; int tl=te-ts; if(tl>0&&tl<512){strncpy(fc->title,ts,tl);fc->title[tl]=0;decode_html(fc->title);strip_html(fc->title);}}
    strncpy(fc->url,target_url,1023);
    char *md=strstr(html,"name=\"description\"");
    if(md){char*cs=strstr(md,"content=\""); if(cs){cs+=9; char*ce=strchr(cs,'"'); if(ce){int cl=ce-cs; if(cl>0&&cl<4096){strncpy(fc->content,cs,cl);fc->content[cl]=0;decode_html(fc->content);}}}}
    char *ms=strstr(html,"<article"); if(!ms)ms=strstr(html,"<main"); if(!ms)ms=strstr(html,"class=\"content\"");
    if(ms){char*end=strstr(ms,"</article>"); if(!end)end=strstr(ms,"</main>"); if(!end)end=ms+32768;
        int cl=end-ms; if(cl>0&&cl<65536){char*ct=malloc(cl+1); strncpy(ct,ms,cl); ct[cl]=0; strip_html(ct); decode_html(ct);
            if(strlen(fc->content)<200){strncpy(fc->content,ct,16383);fc->content[16383]=0;} free(ct);}}
    if(strlen(fc->content)<100){char*p=html;int off=0;
        while(p&&*p&&off<16383){char*ps=strstr(p,"<p"); if(!ps)break; char*tsp=strchr(ps,'>'); if(!tsp){p=ps+2;continue;} tsp++; char*pe=strstr(tsp,"</p>"); if(!pe)break;
            int pl=pe-tsp; if(pl>0&&pl<4096&&off+pl<16383){char para[4096]; strncpy(para,tsp,pl); para[pl]=0; strip_html(para); decode_html(para); if(strlen(para)>20) off+=snprintf(fc->content+off,16383-off,"%s\n\n",para);} p=pe+4;}}
    free(html); fc->has_data=(strlen(fc->content)>50)?1:0; return fc;
}

static void generate_book_summary(BookResult *book, char *output, int max_len) {
    if(!book||!book->has_data){if(output)output[0]=0;return;} int off=0;
    off+=snprintf(output+off,max_len-off,"BOOK SUMMARY\n\nTitle: %s\nAuthor: %s\n",book->title,book->author);
    if(book->publish_year[0]) off+=snprintf(output+off,max_len-off,"Published: %s\n",book->publish_year);
    if(book->publisher[0]) off+=snprintf(output+off,max_len-off,"Publisher: %s\n",book->publisher);
    if(book->subjects[0]) off+=snprintf(output+off,max_len-off,"Subjects: %s\n",book->subjects);
    if(book->source[0]) off+=snprintf(output+off,max_len-off,"Source: %s\n",book->source);
    off+=snprintf(output+off,max_len-off,"\n\nDESCRIPTION:\n%s\n",book->description[0]?book->description:"No description available.");
    output[off]=0;
}
/* Main search function - 16 sources */
static SearchResponse *perform_search(const char *query) {
    SearchResponse *resp=calloc(1,sizeof(SearchResponse));
    struct timeval start,end; gettimeofday(&start,NULL);
    resp->source_count=16;
    search_duckduckgo(query,resp->results,&resp->result_count,MAX_RESULTS);
    search_wikipedia(query,resp->results,&resp->result_count,MAX_RESULTS,&resp->kp);
    search_github(query,resp->results,&resp->result_count,MAX_RESULTS);
    search_duckduckgo_html(query,resp->results,&resp->result_count,MAX_RESULTS);
    search_reddit(query,resp->results,&resp->result_count,MAX_RESULTS);
    search_hackernews(query,resp->results,&resp->result_count,MAX_RESULTS);
    search_stackexchange(query,resp->results,&resp->result_count,MAX_RESULTS);
    search_arxiv(query,resp->results,&resp->result_count,MAX_RESULTS);
    search_archive(query,resp->results,&resp->result_count,MAX_RESULTS);
    search_openlibrary(query,resp->results,&resp->result_count,MAX_RESULTS);
    search_semantic_scholar(query,resp->results,&resp->result_count,MAX_RESULTS);
    search_google_books(query,resp->results,&resp->result_count,MAX_RESULTS,resp->books,&resp->book_count);
    search_google_news(query,resp->results,&resp->result_count,MAX_RESULTS,resp->news,&resp->news_count);
    search_gutenberg(query,resp->results,&resp->result_count,MAX_RESULTS,resp->books,&resp->book_count);
    search_pubmed(query,resp->results,&resp->result_count,MAX_RESULTS);
    search_scholar(query,resp->results,&resp->result_count,MAX_RESULTS);
    dedup_results(resp); generate_ai_summary(resp); generate_related(query,resp);
    gettimeofday(&end,NULL);
    resp->elapsed=(end.tv_sec-start.tv_sec)+(end.tv_usec-start.tv_usec)/1000000.0;
    return resp;
}

static SearchResponse *perform_deep_search(const char *query) {
    SearchResponse *resp=perform_search(query);
    for(int i=0;i<3&&i<resp->result_count;i++) {
        if(strlen(resp->results[i].url)>10) {
            FullContent *fc=extract_full_content(resp->results[i].url);
            if(fc&&fc->has_data){int cl=strlen(resp->results[i].content); int rem=sizeof(resp->results[i].content)-cl-1;
                if(rem>200) snprintf(resp->results[i].content+cl,rem,"\n\n[DEEP EXTRACTION]: %s",fc->content);}
            if(fc) free(fc);
        }
    }
    return resp;
}

#endif

/* ============ DERICK AGENT - Enhanced ============ */

static DerickGuide *generate_derick_guide(const char *query, SearchResponse *search) {
    DerickGuide *guide=calloc(1,sizeof(DerickGuide));
    if(!search||search->result_count==0){snprintf(guide->intro,2047,"No results for \"%s\".",query);guide->has_data=0;return guide;}
    strncpy(guide->topic,query,255); guide->has_data=1;
    if(search->kp.has_data&&strlen(search->kp.extract)>50)
        snprintf(guide->intro,2047,"Comprehensive breakdown of \"%s\":\n\n%s",query,search->kp.extract);
    else if(search->results[0].content&&strlen(search->results[0].content)>30)
        snprintf(guide->intro,2047,"Comprehensive breakdown of \"%s\":\n\n%s",query,search->results[0].content);
    else snprintf(guide->intro,2047,"Breakdown of \"%s\" from %d sources.",query,search->source_count);
    
    int step=0;
    if(search->kp.has_data&&step<MAX_GUIDE_STEPS){
        snprintf(guide->steps[step].title,255,"Step %d: Understand the basics",step+1);
        snprintf(guide->steps[step].content,4095,"Key info:\n%s",search->kp.extract);
        strncpy(guide->steps[step].source_url,search->kp.url,1023);
        strncpy(guide->steps[step].source_name,"Wikipedia",127); step++;
    }
    for(int i=0;i<search->result_count&&step<MAX_GUIDE_STEPS;i++){
        SearchResult *r=&search->results[i]; if(!r->content||strlen(r->content)<40) continue; if(i==0&&search->kp.has_data) continue;
        char st[256]; strncpy(st,r->title,255); st[255]=0; char*d=strstr(st," - "); if(d)*d=0;
        if(strlen(st)>80){st[77]='.';st[78]='.';st[79]='.';st[80]=0;}
        snprintf(guide->steps[step].title,255,"Step %d: %s",step+1,st);
        strncpy(guide->steps[step].content,r->content,4095);
        strncpy(guide->steps[step].source_url,r->url,1023);
        strncpy(guide->steps[step].source_name,r->source,127); step++;
    }
    guide->step_count=step;
    if(search->related[0][0]) snprintf(guide->tips,2047,"Pro tips:\n1. %s\n2. %s\n3. %s\n4. %s\n5. %s\n6. %s\n7. %s",
        search->related[0],search->related[1],search->related[2],search->related[3],search->related[4],search->related[5],search->related[6]);
    snprintf(guide->warnings,1023,"Generated from %d sources. %d results found. Verify with original sources.",search->source_count,search->result_count);
    return guide;
}

static void free_derick_guide(DerickGuide *g){if(g)free(g);}

static char *build_derick_json(DerickGuide *guide, const char *query) {
    char *json=malloc(MAX_RESPONSE); int off=0;
    char topic[512],intro[4096]; json_escape(topic,guide->topic,512); json_escape(intro,guide->intro,4096);
    off+=sprintf(json+off,"{\"query\":\"%s\",\"topic\":\"%s\",\"intro\":\"%s\",",query,topic,intro);
    off+=sprintf(json+off,"\"steps\":[");
    for(int i=0;i<guide->step_count;i++){
        if(i>0) off+=sprintf(json+off,",");
        char title[512],content[8192],su[2048],sn[256];
        json_escape(title,guide->steps[i].title,512); json_escape(content,guide->steps[i].content,8192);
        json_escape(su,guide->steps[i].source_url,2048); json_escape(sn,guide->steps[i].source_name,256);
        off+=sprintf(json+off,"{\"step\":%d,\"title\":\"%s\",\"content\":\"%s\",\"source_url\":\"%s\",\"source_name\":\"%s\"}",i+1,title,content,su,sn);
    }
    off+=sprintf(json+off,"]");
    char tips[4096],warn[2048]; json_escape(tips,guide->tips,4096); json_escape(warn,guide->warnings,2048);
    off+=sprintf(json+off,",\"tips\":\"%s\",\"warnings\":\"%s\",\"step_count\":%d}",tips,warn,guide->step_count);
    return json;
}

static AiResponse *generate_ai_answer(const char *question, SearchResponse *search, AiMessage *history, int history_count) {
    AiResponse *ai=calloc(1,sizeof(AiResponse));
    if(!search||search->result_count==0){snprintf(ai->answer,MAX_ANSWER_CHARS-1,"No info for \"%s\".",question);ai->has_data=0;return ai;}
    strncpy(ai->topic,question,255); ai->has_data=1;
    extern int is_derycode_query(const char*); extern const char* get_derycode_knowledge(const char*);
    if(is_derycode_query(question)){const char*k=get_derycode_knowledge(question); if(k){strncpy(ai->answer,k,MAX_ANSWER_CHARS-1);snprintf(ai->sources,2047,"DeryCode Knowledge Base");return ai;}}
    int off=0;
    off+=snprintf(ai->answer+off,MAX_ANSWER_CHARS-off,"Based on %d search sources:\n\n",search->source_count);
    if(search->kp.has_data&&strlen(search->kp.extract)>20) off+=snprintf(ai->answer+off,MAX_ANSWER_CHARS-off,"OVERVIEW:\n%s\n\n",search->kp.extract);
    for(int i=0;i<search->result_count&&i<40&&off<MAX_ANSWER_CHARS-2048;i++){
        SearchResult *r=&search->results[i]; if(!r->content||strlen(r->content)<30) continue;
        char sn[4096]; extract_key_sentences(r->content,sn,sizeof(sn));
        if(strlen(sn)>30) off+=snprintf(ai->answer+off,MAX_ANSWER_CHARS-off,"[%s] %s\nSource: %s\n\n",r->source,sn,r->url);
    }
    if(search->book_count>0){off+=snprintf(ai->answer+off,MAX_ANSWER_CHARS-off,"\nRECOMMENDED BOOKS (%d):\n",search->book_count);
        for(int i=0;i<search->book_count&&i<10;i++) off+=snprintf(ai->answer+off,MAX_ANSWER_CHARS-off,"- %s by %s%s%s\n  %.200s\n\n",search->books[i].title,search->books[i].author,search->books[i].publish_year[0]?" (":"",search->books[i].publish_year[0]?search->books[i].publish_year:"",search->books[i].description);}
    if(search->news_count>0){off+=snprintf(ai->answer+off,MAX_ANSWER_CHARS-off,"\nLATEST NEWS (%d):\n",search->news_count);
        for(int i=0;i<search->news_count&&i<8;i++) off+=snprintf(ai->answer+off,MAX_ANSWER_CHARS-off,"- %s (%s)\n  %s\n  %s\n\n",search->news[i].title,search->news[i].date,search->news[i].snippet[0]?search->news[i].snippet:"No preview",search->news[i].url);}
    snprintf(ai->follow_ups[0],255,"Tell me more about %s",question);
    snprintf(ai->follow_ups[1],255,"Latest developments in %s",question);
    snprintf(ai->follow_ups[2],255,"Books about %s",question);
    off=0;
    for(int i=0;i<search->result_count&&i<20;i++){if(i>0)off+=snprintf(ai->sources+off,2047-off,", "); off+=snprintf(ai->sources+off,2047-off,"%s",search->results[i].source);}
    return ai;
}

static void free_ai_response(AiResponse *ai){if(ai)free(ai);}

static char *build_ai_json(AiResponse *ai, SearchResponse *search, const char *query) {
    char *json=malloc(MAX_RESPONSE); int off=0;
    char answer[MAX_ANSWER_CHARS+100],sources[4096],topic[512];
    json_escape(answer,ai->answer,MAX_ANSWER_CHARS+100); json_escape(sources,ai->sources,4096); json_escape(topic,ai->topic,512);
    off+=sprintf(json+off,"{\"query\":\"%s\",\"answer\":\"%s\",\"sources\":\"%s\",\"topic\":\"%s\",\"has_data\":%d,",query,answer,sources,topic,ai->has_data);
    off+=sprintf(json+off,"\"follow_ups\":[");
    for(int i=0;i<3;i++){if(i>0)off+=sprintf(json+off,",");char fu[512];json_escape(fu,ai->follow_ups[i],512);off+=sprintf(json+off,"\"%s\"",fu);}
    off+=sprintf(json+off,"],\"result_count\":%d,\"source_count\":%d,",search->result_count,search->source_count);
    off+=sprintf(json+off,"\"books\":[");
    for(int i=0;i<search->book_count;i++){if(i>0)off+=sprintf(json+off,",");
        char bt[1024],ba[512],bd[8192]; json_escape(bt,search->books[i].title,1024); json_escape(ba,search->books[i].author,512); json_escape(bd,search->books[i].description,8192);
        off+=sprintf(json+off,"{\"title\":\"%s\",\"author\":\"%s\",\"description\":\"%s\",\"source\":\"%s\"}",bt,ba,bd,search->books[i].source);}
    off+=sprintf(json+off,"],\"news\":[");
    for(int i=0;i<search->news_count;i++){if(i>0)off+=sprintf(json+off,",");
        char nt[1024],ns[4096],nso[256],nd[64],nu[2048]; json_escape(nt,search->news[i].title,1024); json_escape(ns,search->news[i].snippet,4096); json_escape(nso,search->news[i].source,256); json_escape(nd,search->news[i].date,64); json_escape(nu,search->news[i].url,2048);
        off+=sprintf(json+off,"{\"title\":\"%s\",\"snippet\":\"%s\",\"source\":\"%s\",\"date\":\"%s\",\"url\":\"%s\"}",nt,ns,nso,nd,nu);}
    off+=sprintf(json+off,"]}");
    return json;
}
