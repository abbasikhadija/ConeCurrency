#include "server.h"

#include <errno.h>
#include <poll.h>
#include <sys/socket.h>
#include <unistd.h>

int sequential_run(int listen_fd)
{
    struct pollfd listener = {listen_fd, POLLIN, 0};
    while (!server_stop) {
        int ready = poll(&listener, 1, 500);
        if (ready < 0) { if (errno == EINTR) continue; return -1; }
        if (!ready || server_stop) continue;
        if (!(listener.revents & POLLIN)) return -1;
        int fd = accept(listen_fd, NULL, NULL);
        if (fd < 0) {
            if (errno == EINTR || errno == ECONNABORTED) continue;
            return -1;
        }
        handle_client(fd);
        close(fd);
    }
    return 0;
}
