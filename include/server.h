#ifndef CONECURRENCY_SERVER_H
#define CONECURRENCY_SERVER_H

#include <signal.h>
#include <stdatomic.h>

struct server_config {
    int concurrent;
    int tickets;
    int workers;
    int queue;
    int port;
    int delay_ms;
};

/* Signal handler and worker threads share a lock-free stop flag. */
_Static_assert(ATOMIC_INT_LOCK_FREE == 2, "signal stop flag requires lock-free int atomics");
extern atomic_int server_stop;
int parse_options(int argc, char **argv, struct server_config *config);
void print_usage(const char *program);
int create_listener(int port);
/* Set once before workers start; handler configuration is immutable thereafter. */
void handler_configure(int delay_ms);
/* Reads one newline-terminated request and writes one reply. Never closes fd. */
void handle_client(int fd);
int sequential_run(int listen_fd);

#endif
