#include "booking.h"
#include "concurrent.h"
#include "server.h"
#include "stats.h"

#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

atomic_int server_stop;
static void stop_server(int signal_number) { (void)signal_number; server_stop = 1; }

int main(int argc, char **argv)
{
    struct server_config config;
    struct sigaction action = {0};
    int parsed = parse_options(argc, argv, &config);
    if (parsed) { print_usage(argv[0]); return parsed > 0 ? 0 : 2; }
#ifndef WITH_CONCURRENT
    if (config.concurrent) {
        fprintf(stderr, "Concurrent mode requires P3 modules; see docs/integration.md.\n");
        return 2;
    }
#endif
    action.sa_handler = SIG_IGN;
    sigemptyset(&action.sa_mask);
    if (sigaction(SIGPIPE, &action, NULL) < 0) { perror("SIGPIPE"); return 1; }
    action.sa_handler = stop_server;
    if (sigaction(SIGINT, &action, NULL) < 0 ||
        sigaction(SIGTERM, &action, NULL) < 0) { perror("signal setup"); return 1; }
    booking_init(config.tickets);
    handler_configure(config.delay_ms);
    int listener = create_listener(config.port);
    if (listener < 0) { perror("listen setup"); return 1; }
    printf("ConeCurrency %s on 127.0.0.1:%d\n",
           config.concurrent ? "concurrent" : "sequential", config.port);
    fflush(stdout);
    int result;
#ifdef WITH_CONCURRENT
    if (config.concurrent) result = concurrent_run(listener, &config);
    else
#endif
        result = sequential_run(listener);
    if (result < 0) perror("server loop");
    close(listener);
    stats_print();
    return result < 0 ? EXIT_FAILURE : EXIT_SUCCESS;
}
