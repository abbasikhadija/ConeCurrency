/*
 * threadpool.c - P3: fixed team of worker threads (the cashiers).
 *
 * Every worker repeats: take the next client from the queue, let the
 * injected handler serve it, then close the connection. Workers are
 * created once at startup and reused for every client.
 *
 * Contract (include/threadpool.h):
 *   - Workers call handler(fd) and then close(fd); handler never closes.
 *   - Close the queue BEFORE pool_stop, destroy the queue AFTER it.
 *   - pool_start returns NULL on failure, with nothing left running.
 */
#include "threadpool.h"

#include <pthread.h>
#include <signal.h>
#include <stdlib.h>
#include <unistd.h>

struct thread_pool {
    pthread_t *threads;          /* one entry per worker              */
    int count;                   /* number of workers actually started*/
    struct client_queue *queue;  /* shared rope line (borrowed)       */
    void (*handler)(int);        /* how to serve one client (injected)*/
};

/* One cashier's whole working day. */
static void *worker_main(void *arg)
{
    struct thread_pool *pool = arg;
    int fd;

    /* queue_pop sleeps while the line is empty and returns false only
     * when the queue is closed AND drained: then this worker goes home. */
    while (queue_pop(pool->queue, &fd)) {
        pool->handler(fd);   /* P2: read request, book, reply (no close) */
        close(fd);           /* this worker owns fd, so it closes it once */
    }
    return NULL;
}

struct thread_pool *pool_start(int n, struct client_queue *queue,
                               void (*handler)(int))
{
    if (n <= 0 || !queue || !handler) return NULL;

    struct thread_pool *pool = calloc(1, sizeof *pool);
    if (!pool) return NULL;
    pool->threads = calloc((size_t)n, sizeof *pool->threads);
    if (!pool->threads) { free(pool); return NULL; }
    pool->queue = queue;
    pool->handler = handler;

    /* Earplugs: block SIGINT/SIGTERM while creating workers. New threads
     * inherit this mask, so Ctrl+C is only ever delivered to the calling
     * (accept) thread, whose original mask is restored below. */
    sigset_t block, previous;
    sigemptyset(&block);
    sigaddset(&block, SIGINT);
    sigaddset(&block, SIGTERM);
    pthread_sigmask(SIG_BLOCK, &block, &previous);

    int error = 0;
    while (pool->count < n) {
        error = pthread_create(&pool->threads[pool->count], NULL, worker_main, pool);
        if (error != 0) break;          /* pthread returns the error, not errno */
        pool->count++;
    }

    pthread_sigmask(SIG_SETMASK, &previous, NULL);

    if (error != 0) {
        /* Partial failure: send the workers we did hire home, then report. */
        queue_close(queue);
        for (int i = 0; i < pool->count; i++) pthread_join(pool->threads[i], NULL);
        free(pool->threads);
        free(pool);
        return NULL;
    }
    return pool;
}

void pool_stop(struct thread_pool *pool)
{
    if (!pool) return;
    /* The queue is already closed, so each worker finishes its current
     * client, drains what is left, then returns. Join = wait for that. */
    for (int i = 0; i < pool->count; i++) pthread_join(pool->threads[i], NULL);
    free(pool->threads);
    free(pool);
}
