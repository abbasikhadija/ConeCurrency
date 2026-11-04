/*
 * concurrent.c - P3: the concurrent-mode accept loop (the Door Manager).
 *
 * The main thread only lets clients in and places them in the bounded
 * queue. A fixed pool of worker threads serves them. When the queue is
 * full the client is told "ERR BUSY" immediately (load shedding).
 *
 * Contract (include/concurrent.h, docs/integration.md):
 *   - listen_fd is borrowed: main closes it after we return.
 *   - main installs the SIGINT/SIGTERM handler that sets server_stop.
 *   - We own the queue and pool lifecycle and must join every worker
 *     before returning, on success and on error paths.
 */
#include "concurrent.h"
#include "protocol.h"
#include "queue.h"
#include "stats.h"
#include "threadpool.h"

#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <string.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

#define POLL_INTERVAL_MS 500   /* notice Ctrl+C at least twice a second */

/* Queue full: answer quickly and say goodbye. The accept thread still
 * owns fd here, so it is the one that closes it. */
static void reject_busy(int fd)
{
    char discard[MAX_REQ];
    ssize_t ignored;

    stats_inc(STAT_BUSY);
    /* A fresh socket has an empty send buffer, so this write does not
     * block the accept loop. SIGPIPE is ignored process-wide by main. */
    ignored = write(fd, REPLY_BUSY, strlen(REPLY_BUSY));
    (void)ignored;
    /* Tell the client we are done, then drain any request bytes that
     * already arrived. Closing with unread data makes Linux send a reset,
     * which could destroy the ERR BUSY reply before the client reads it. */
    shutdown(fd, SHUT_WR);
    if (fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK) == 0)
        while (read(fd, discard, sizeof discard) > 0) {}
    close(fd);
}

int concurrent_run(int listen_fd, const struct server_config *config)
{
    struct client_queue *queue;
    struct thread_pool *pool;
    struct pollfd listener = {listen_fd, POLLIN, 0};
    int result = 0;
    int saved_errno = 0;

    /* Opening the shop: build the rope line, hire the cashiers. */
    queue = queue_init((size_t)config->queue);
    if (!queue) { errno = ENOMEM; return -1; }

    pool = pool_start(config->workers, queue, handle_client);
    if (!pool) {
        queue_destroy(queue);       /* pool_start already joined any workers */
        errno = EAGAIN;
        return -1;
    }

    while (!server_stop) {
        /* Watch the door, but look up every half second for "CLOSING". */
        int ready = poll(&listener, 1, POLL_INTERVAL_MS);
        if (ready < 0) {
            if (errno == EINTR) continue;
            saved_errno = errno; result = -1; break;
        }
        if (ready == 0 || server_stop) continue;
        if (!(listener.revents & POLLIN)) { saved_errno = EIO; result = -1; break; }

        int fd = accept(listen_fd, NULL, NULL);
        if (fd < 0) {
            if (errno == EINTR || errno == ECONNABORTED || errno == EAGAIN) continue;
            if (errno == EMFILE || errno == ENFILE) {
                /* Out of descriptors: back off briefly instead of spinning. */
                struct timespec pause = {0, 10 * 1000 * 1000};
                nanosleep(&pause, NULL);
                continue;
            }
            saved_errno = errno; result = -1; break;
        }

        if (!queue_try_push(queue, fd))
            reject_busy(fd);        /* full: we still own fd */
        /* else: the queue now owns fd; a worker will close it */
    }

    /* Closing time: no new kids, wake every cashier, let them drain the
     * line, wait for all of them to leave, then take down the rope. */
    queue_close(queue);
    pool_stop(pool);
    queue_destroy(queue);

    if (result < 0) errno = saved_errno;
    return result;
}
