#include "booking.h"
#include "protocol.h"
#include "server.h"
#include "stats.h"

#include <errno.h>
#include <poll.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <time.h>
#include <unistd.h>

static int work_delay_ms;

void handler_configure(int delay_ms) { work_delay_ms = delay_ms; }

static long long milliseconds(void)
{
    struct timespec now;
    if (clock_gettime(CLOCK_MONOTONIC, &now) < 0) return -1;
    return (long long)now.tv_sec * 1000 + now.tv_nsec / 1000000;
}

static int wait_fd(int fd, short events, long long deadline)
{
    struct pollfd item = {fd, events, 0};
    for (;;) {
        long long now = milliseconds();
        int result;
        if (server_stop || now < 0 || now >= deadline) return -1;
        /* Short polls allow SIGINT to interrupt active clients promptly. */
        int timeout = (int)(deadline - now);
        if (timeout > 100) timeout = 100;
        result = poll(&item, 1, timeout);
        if (result > 0) return (item.revents & (events | POLLHUP)) ? 0 : -1;
        if (result < 0 && errno != EINTR) return -1;
    }
}

static void reply(int fd, const char *message)
{
    size_t offset = 0, length = strlen(message);
    long long deadline = milliseconds() + CLIENT_TIMEOUT_SECONDS * 1000;
    while (offset < length && wait_fd(fd, POLLOUT, deadline) == 0) {
        ssize_t count = write(fd, message + offset, length - offset);
        if (count > 0) offset += (size_t)count;
        else if (count < 0 && errno == EINTR) continue;
        else break;
    }
}

void handle_client(int fd)
{
    char request[MAX_REQ];
    size_t used = 0;
    int complete = 0;
    struct timeval timeout = {CLIENT_TIMEOUT_SECONDS, 0};
    long long deadline = milliseconds() + CLIENT_TIMEOUT_SECONDS * 1000;
    if (setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof timeout) < 0 ||
        setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof timeout) < 0)
        return;
    while (used < sizeof request && wait_fd(fd, POLLIN, deadline) == 0) {
        /* Read through the first newline, including fragmented TCP requests. */
        ssize_t count = read(fd, request + used, 1);
        if (count == 1) {
            if (request[used++] == '\n') { complete = 1; break; }
        } else if (count < 0 && errno == EINTR) continue;
        else break;
    }
    if (server_stop) return;
    if (!complete || used != 5 || memcmp(request, "BOOK\n", 5)) {
        stats_inc(STAT_BAD);
        reply(fd, REPLY_BAD_REQUEST);
        return;
    }
    /* Workers may block termination signals, so observe the shared stop flag
     * between short sleep slices instead of sleeping up to 60 seconds. */
    long long work_end = milliseconds() + work_delay_ms;
    while (!server_stop) {
        long long left = work_end - milliseconds();
        if (left <= 0) break;
        if (left > 100) left = 100;
        struct timespec delay = {0, (long)left * 1000000L};
        while (!server_stop && nanosleep(&delay, &delay) < 0 && errno == EINTR) {}
    }
    if (server_stop) return;
    if (booking_try_reserve() == BOOK_OK) {
        stats_inc(STAT_BOOKED);
        reply(fd, REPLY_BOOKED);
    } else {
        stats_inc(STAT_SOLD_OUT);
        reply(fd, REPLY_SOLD_OUT);
    }
}
