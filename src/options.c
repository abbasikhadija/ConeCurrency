#include "server.h"

#include <errno.h>
#include <getopt.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void print_usage(const char *program)
{
    printf("Usage: %s --mode sequential|concurrent --tickets N "
           "--workers N --queue N --port N --delay-ms N\n", program);
}

static int number(const char *text, int low, int high, int *value)
{
    char *end;
    long parsed;
    if (!text[0]) return -1;
    for (const char *p = text; *p; ++p)
        if (*p < '0' || *p > '9') return -1;
    errno = 0;
    parsed = strtol(text, &end, 10);
    if (errno || *end || parsed < low || parsed > high) return -1;
    *value = (int)parsed;
    return 0;
}

int parse_options(int argc, char **argv, struct server_config *config)
{
    static const struct option options[] = {
        {"mode", required_argument, NULL, 'm'},
        {"tickets", required_argument, NULL, 't'},
        {"workers", required_argument, NULL, 'w'},
        {"queue", required_argument, NULL, 'q'},
        {"port", required_argument, NULL, 'p'},
        {"delay-ms", required_argument, NULL, 'd'},
        {"help", no_argument, NULL, 'h'}, {NULL, 0, NULL, 0}
    };
    int option;
    *config = (struct server_config){0, 10, 4, 32, 8080, 20};
    optind = 1;
    opterr = 0;
    while ((option = getopt_long(argc, argv, "", options, NULL)) != -1) {
        int result = 0;
        switch (option) {
        case 'm':
            if (!strcmp(optarg, "sequential")) config->concurrent = 0;
            else if (!strcmp(optarg, "concurrent")) config->concurrent = 1;
            else return -1;
            break;
        case 't': result = number(optarg, 0, INT_MAX, &config->tickets); break;
        case 'w': result = number(optarg, 1, 1024, &config->workers); break;
        case 'q': result = number(optarg, 1, 1000000, &config->queue); break;
        case 'p': result = number(optarg, 1, 65535, &config->port); break;
        case 'd': result = number(optarg, 0, 60000, &config->delay_ms); break;
        case 'h': return 1;
        default: return -1;
        }
        if (result) return -1;
    }
    return optind == argc ? 0 : -1;
}
