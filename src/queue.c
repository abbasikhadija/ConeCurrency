/*
 * queue.c - P3: bounded, thread-safe FIFO of client socket descriptors.
 *
 * Ice cream shop: this is the rope line. The accept thread (Door Manager)
 * adds kids with queue_try_push; worker threads (cashiers) take them with
 * queue_pop. One mutex (the clipboard) protects every field. One condition
 * variable (the bell) wakes sleeping workers when a kid arrives or the shop
 * closes.
 *
 * Ownership: a successful push transfers the fd to the queue; a successful
 * pop transfers it to the calling worker, which must close it.
 */
#include "queue.h"

#include <pthread.h>
#include <stdlib.h>

struct client_queue {
    int *items;              /* circular buffer of fds                  */
    size_t capacity;         /* fixed size, never changes after init    */
    size_t head;             /* index of the next fd to pop             */
    size_t tail;             /* index of the next free slot             */
    size_t count;            /* number of fds currently stored          */
    bool closed;             /* true after queue_close                  */
    pthread_mutex_t lock;    /* protects every field above              */
    pthread_cond_t not_empty;/* signalled on push; broadcast on close   */
};

struct client_queue *queue_init(size_t capacity)
{
    if (capacity == 0) return NULL;

    struct client_queue *queue = calloc(1, sizeof *queue);
    if (!queue) return NULL;

    queue->items = calloc(capacity, sizeof *queue->items);
    if (!queue->items) goto fail_queue;
    queue->capacity = capacity;

    if (pthread_mutex_init(&queue->lock, NULL) != 0) goto fail_items;
    if (pthread_cond_init(&queue->not_empty, NULL) != 0) goto fail_mutex;
    return queue;

fail_mutex:
    pthread_mutex_destroy(&queue->lock);
fail_items:
    free(queue->items);
fail_queue:
    free(queue);
    return NULL;
}

bool queue_try_push(struct client_queue *queue, int fd)
{
    bool stored = false;

    pthread_mutex_lock(&queue->lock);
    if (!queue->closed && queue->count < queue->capacity) {
        queue->items[queue->tail] = fd;
        queue->tail = (queue->tail + 1) % queue->capacity;
        queue->count++;
        stored = true;
        /* Ring the bell: wake exactly one sleeping worker. */
        pthread_cond_signal(&queue->not_empty);
    }
    pthread_mutex_unlock(&queue->lock);

    /* false: full or closed. The caller still owns fd and must close it. */
    return stored;
}

bool queue_pop(struct client_queue *queue, int *fd)
{
    pthread_mutex_lock(&queue->lock);

    /* `while`, not `if`: re-check after every wake-up (spurious wakeups,
     * or another worker took the item first). pthread_cond_wait releases
     * the lock while sleeping and re-acquires it before returning. */
    while (queue->count == 0 && !queue->closed)
        pthread_cond_wait(&queue->not_empty, &queue->lock);

    if (queue->count == 0) {
        /* Closed and fully drained: tell the worker to go home. */
        pthread_mutex_unlock(&queue->lock);
        return false;
    }

    *fd = queue->items[queue->head];
    queue->head = (queue->head + 1) % queue->capacity;
    queue->count--;
    pthread_mutex_unlock(&queue->lock);
    /* The lock is released BEFORE the worker handles the client, so a
     * worker never holds the queue lock and the booking lock together. */
    return true;
}

void queue_close(struct client_queue *queue)
{
    pthread_mutex_lock(&queue->lock);
    queue->closed = true;
    /* Shout to everyone: every sleeping worker must wake and re-check. */
    pthread_cond_broadcast(&queue->not_empty);
    pthread_mutex_unlock(&queue->lock);
}

struct queue_snapshot queue_stats(struct client_queue *queue)
{
    struct queue_snapshot snapshot;

    pthread_mutex_lock(&queue->lock);
    snapshot.pending = queue->count;
    snapshot.capacity = queue->capacity;
    snapshot.closed = queue->closed;
    pthread_mutex_unlock(&queue->lock);
    return snapshot;
}

void queue_destroy(struct client_queue *queue)
{
    /* Precondition: every worker has been joined, so no thread can touch
     * the queue any more. In normal shutdown the workers drained it first,
     * so no fds remain stored here. */
    if (!queue) return;
    pthread_cond_destroy(&queue->not_empty);
    pthread_mutex_destroy(&queue->lock);
    free(queue->items);
    free(queue);
}
