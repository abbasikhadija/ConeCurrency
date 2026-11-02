#ifndef CONECURRENCY_QUEUE_H
#define CONECURRENCY_QUEUE_H

#include <stdbool.h>
#include <stddef.h>

/* Opaque P3-owned queue. Proposed concrete signatures for team review.
 * close wakes sleepers; pop drains pending fds before returning false.
 * A successful push transfers fd ownership to the queue/worker. */
struct client_queue;
struct queue_snapshot { size_t pending; size_t capacity; bool closed; };
struct client_queue *queue_init(size_t capacity);
bool queue_try_push(struct client_queue *queue, int fd);
bool queue_pop(struct client_queue *queue, int *fd);
void queue_close(struct client_queue *queue);
struct queue_snapshot queue_stats(struct client_queue *queue);
void queue_destroy(struct client_queue *queue);

#endif
