#ifndef CONECURRENCY_THREADPOOL_H
#define CONECURRENCY_THREADPOOL_H

#include "queue.h"

struct thread_pool;
/* Workers invoke handler(fd), then close(fd). Stop joins all workers.
 * Queue must be closed before pool_stop; destroy queue after joining. */
struct thread_pool *pool_start(int n, struct client_queue *queue,
                              void (*handler)(int));
void pool_stop(struct thread_pool *pool);

#endif
